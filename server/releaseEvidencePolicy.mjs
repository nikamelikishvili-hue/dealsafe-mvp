const evidenceSchema = 'dealivra.release-evidence.v1';
const commitPattern = /^[0-9a-f]{40}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const catalogVersionPattern = /^\d{4}-\d{2}-\d{2}\.\d+$/;
const nodeVersionPattern = /^\d+\.x$/;
const safePathPattern = /^[A-Za-z0-9._@+()[\]/-]{1,180}$/;
const maximumEvidenceFiles = 200;
const maximumEvidenceFileBytes = 5_000_000;
const maximumEvidenceTotalBytes = 20_000_000;

export const requiredReleaseChecks = Object.freeze([
  'catalog_verified',
  'dependency_policy_passed',
  'browser_storage_policy_passed',
  'outbound_transport_policy_passed',
  'typecheck_passed',
  'foundation_tests_passed',
  'incident_drill_passed',
  'secret_scan_passed',
  'production_build_passed',
  'performance_budgets_passed',
  'preview_smoke_passed',
  'dependency_audit_high_passed',
]);

const requiredEvidencePaths = Object.freeze([
  '.github/workflows/ci.yml',
  '.nvmrc',
  'catalog/active-release.json',
  'package-lock.json',
  'package.json',
  'scripts/create-release-evidence.mjs',
  'scripts/scan-repository-secrets.mjs',
  'scripts/verify-browser-storage-policy.mjs',
  'scripts/verify-dependency-policy.mjs',
  'scripts/verify-build-budgets.mjs',
  'scripts/verify-outbound-transport-policy.mjs',
  'server/releaseEvidencePolicy.mjs',
  'src/catalog.v1.json',
  'vercel.json',
  'vite.config.ts',
  'dist/index.html',
]);

function hasExactKeys(value, expected) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length === expected.length
    && expected.every(key => Object.hasOwn(value, key));
}

function isSafeEvidencePath(value) {
  return typeof value === 'string'
    && safePathPattern.test(value)
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.split('/').includes('..');
}

function normalizeFile(value) {
  if (!hasExactKeys(value, ['path', 'sha256', 'bytes'])) return null;
  if (!isSafeEvidencePath(value.path)) return null;
  if (typeof value.sha256 !== 'string' || !sha256Pattern.test(value.sha256)) {
    return null;
  }
  if (
    !Number.isSafeInteger(value.bytes)
    || value.bytes < 1
    || value.bytes > maximumEvidenceFileBytes
  ) {
    return null;
  }
  return {
    path: value.path,
    sha256: value.sha256,
    bytes: value.bytes,
  };
}

export function buildReleaseEvidence(input) {
  if (!hasExactKeys(input, [
    'schema',
    'commit',
    'node',
    'catalog_version',
    'checks',
    'files',
  ])) return null;
  if (input.schema !== evidenceSchema) return null;
  if (typeof input.commit !== 'string' || !commitPattern.test(input.commit)) {
    return null;
  }
  if (typeof input.node !== 'string' || !nodeVersionPattern.test(input.node)) {
    return null;
  }
  if (
    typeof input.catalog_version !== 'string'
    || !catalogVersionPattern.test(input.catalog_version)
  ) {
    return null;
  }
  if (
    !Array.isArray(input.checks)
    || input.checks.length !== requiredReleaseChecks.length
    || input.checks.some((check, index) => check !== requiredReleaseChecks[index])
  ) {
    return null;
  }
  if (
    !Array.isArray(input.files)
    || input.files.length < requiredEvidencePaths.length
    || input.files.length > maximumEvidenceFiles
  ) {
    return null;
  }

  const files = input.files.map(normalizeFile);
  if (files.some(file => file === null)) return null;
  const paths = files.map(file => file.path);
  if (new Set(paths).size !== paths.length) return null;
  if (paths.some((path, index) => index > 0 && path <= paths[index - 1])) {
    return null;
  }
  if (requiredEvidencePaths.some(path => !paths.includes(path))) return null;
  if (!paths.some(path => /^dist\/assets\/.+\.js$/.test(path))) return null;
  if (!paths.some(path => /^dist\/assets\/.+\.css$/.test(path))) return null;

  const totalBytes = files.reduce((total, file) => total + file.bytes, 0);
  if (totalBytes > maximumEvidenceTotalBytes) return null;

  return {
    schema: evidenceSchema,
    commit: input.commit,
    source_tree: 'clean',
    node: input.node,
    catalog_version: input.catalog_version,
    checks: [...requiredReleaseChecks],
    files,
    total_bytes: totalBytes,
    network_access: 'not_required',
    production_authorization: 'not_granted',
  };
}
