import { createHash } from 'node:crypto';

export const servedAssetManifestFile = 'dealivra-asset-manifest.json';
export const servedAssetManifestSchema = 'dealivra.served-asset-manifest.v1';

const commitPattern = /^[0-9a-f]{40}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const safeAssetPathPattern = /^[A-Za-z0-9._@+()[\]/-]{1,180}$/;
const maximumAssetFiles = 200;
const maximumAssetBytes = 5_000_000;
const maximumTotalBytes = 20_000_000;
const maximumAllowedHosts = 12;

function hasExactKeys(value, expected) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length === expected.length
    && expected.every(key => Object.hasOwn(value, key));
}

function isSafeAssetPath(value) {
  return typeof value === 'string'
    && safeAssetPathPattern.test(value)
    && value !== servedAssetManifestFile
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.split('/').includes('..');
}

function normalizeAsset(value) {
  if (!hasExactKeys(value, ['path', 'sha256', 'bytes'])) return null;
  if (!isSafeAssetPath(value.path)) return null;
  if (typeof value.sha256 !== 'string' || !sha256Pattern.test(value.sha256)) {
    return null;
  }
  if (
    !Number.isSafeInteger(value.bytes)
    || value.bytes < 1
    || value.bytes > maximumAssetBytes
  ) {
    return null;
  }
  return {
    path: value.path,
    sha256: value.sha256,
    bytes: value.bytes,
  };
}

function normalizeFiles(files) {
  if (
    !Array.isArray(files)
    || files.length < 4
    || files.length > maximumAssetFiles
  ) {
    return null;
  }

  const normalized = files.map(normalizeAsset);
  if (normalized.some(file => file === null)) return null;
  const paths = normalized.map(file => file.path);
  if (new Set(paths).size !== paths.length) return null;
  if (paths.some((path, index) => index > 0 && path <= paths[index - 1])) {
    return null;
  }
  if (!paths.includes('index.html') || !paths.includes('sw.js')) return null;
  if (!paths.some(path => /^assets\/.+\.js$/.test(path))) return null;
  if (!paths.some(path => /^assets\/.+\.css$/.test(path))) return null;

  const totalBytes = normalized.reduce((total, file) => total + file.bytes, 0);
  if (totalBytes > maximumTotalBytes) return null;
  return { files: normalized, totalBytes };
}

export function buildServedAssetManifest(input) {
  if (!hasExactKeys(input, ['schema', 'source_commit', 'files'])) return null;
  if (input.schema !== servedAssetManifestSchema) return null;
  if (
    typeof input.source_commit !== 'string'
    || !commitPattern.test(input.source_commit)
  ) {
    return null;
  }

  const normalized = normalizeFiles(input.files);
  if (!normalized) return null;
  return {
    schema: servedAssetManifestSchema,
    source_commit: input.source_commit,
    assets: normalized.files,
    asset_count: normalized.files.length,
    total_bytes: normalized.totalBytes,
    content_exposure: 'hashes_only',
  };
}

export function validateServedAssetManifest(value) {
  if (!hasExactKeys(value, [
    'schema',
    'source_commit',
    'assets',
    'asset_count',
    'total_bytes',
    'content_exposure',
  ])) {
    return null;
  }
  if (value.content_exposure !== 'hashes_only') return null;

  const normalized = buildServedAssetManifest({
    schema: value.schema,
    source_commit: value.source_commit,
    files: value.assets,
  });
  if (!normalized) return null;
  if (
    value.asset_count !== normalized.asset_count
    || value.total_bytes !== normalized.total_bytes
  ) {
    return null;
  }
  return normalized;
}

export function parseAllowedDeploymentHosts(value) {
  if (typeof value !== 'string') return null;
  const hosts = value
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);
  if (hosts.length < 1 || hosts.length > maximumAllowedHosts) return null;
  if (new Set(hosts).size !== hosts.length) return null;
  if (hosts.some(host => (
    host.length > 253
    || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
  ))) {
    return null;
  }
  return hosts;
}

export function normalizeDeploymentOrigin(
  value,
  allowedHosts,
  { allowLocalPreview = false } = {},
) {
  if (typeof value !== 'string' || value.length > 500) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.username
    || url.password
    || url.search
    || url.hash
    || (url.pathname !== '/' && url.pathname !== '')
  ) {
    return null;
  }

  const isLocalPreview = allowLocalPreview
    && url.protocol === 'http:'
    && url.hostname === '127.0.0.1'
    && /^\d{2,5}$/.test(url.port);
  if (isLocalPreview) return url.origin;

  if (url.protocol !== 'https:' || url.port) return null;
  if (
    !Array.isArray(allowedHosts)
    || !allowedHosts.includes(url.hostname.toLowerCase())
  ) {
    return null;
  }
  return url.origin;
}

export function servedAssetUrl(origin, path) {
  if (!isSafeAssetPath(path)) return null;
  const url = new URL(`/${path}`, `${origin}/`);
  if (url.origin !== origin) return null;
  return url.href;
}

export function compareServedAsset(asset, bytes) {
  const normalized = normalizeAsset(asset);
  if (!normalized || !(bytes instanceof Uint8Array)) return null;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return {
    matches: bytes.byteLength === normalized.bytes && sha256 === normalized.sha256,
    bytes: bytes.byteLength,
    sha256,
  };
}
