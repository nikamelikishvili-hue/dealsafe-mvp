import {
  compareServedAsset,
  normalizeDeploymentOrigin,
  parseAllowedDeploymentHosts,
  servedAssetManifestFile,
  servedAssetUrl,
  validateServedAssetManifest,
} from '../server/servedAssetIntegrityPolicy.mjs';
import { validateServedBrowserHeaders } from '../server/servedBrowserHeaderPolicy.mjs';

const commitPattern = /^[0-9a-f]{40}$/;
const maximumManifestBytes = 250_000;
const maximumAssetBytes = 5_000_000;
const requestTimeoutMilliseconds = 15_000;
const verificationConcurrency = 4;

function fail(message) {
  throw new Error(`Served asset verification rejected: ${message}`);
}

async function readBounded(response, maximumBytes) {
  const declaredLength = response.headers.get('content-length');
  if (
    declaredLength
    && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes)
  ) {
    fail('a response exceeds its bounded size');
  }
  if (!response.body) fail('a response body is missing');

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      fail('a response exceeds its bounded size');
    }
    chunks.push(value);
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

const allowedHosts = parseAllowedDeploymentHosts(
  process.env.DEALIVRA_ALLOWED_DEPLOYMENT_HOSTS?.trim() ?? '',
);
if (!allowedHosts) {
  fail('DEALIVRA_ALLOWED_DEPLOYMENT_HOSTS must contain exact approved hosts');
}
const origin = normalizeDeploymentOrigin(
  process.env.DEALIVRA_DEPLOYMENT_ORIGIN?.trim() ?? '',
  allowedHosts,
);
if (!origin) {
  fail('DEALIVRA_DEPLOYMENT_ORIGIN is not an approved exact HTTPS origin');
}
const expectedCommit = process.env.DEALIVRA_DEPLOYMENT_COMMIT?.trim() ?? '';
if (!commitPattern.test(expectedCommit)) {
  fail('DEALIVRA_DEPLOYMENT_COMMIT must be an exact lowercase commit SHA');
}

const bypassToken = process.env.DEALIVRA_DEPLOYMENT_BYPASS_TOKEN?.trim() ?? '';
if (
  bypassToken.length > 512
  || /[\r\n]/.test(bypassToken)
) {
  fail('the deployment protection token is invalid');
}
const requestHeaders = bypassToken
  ? { 'x-vercel-protection-bypass': bypassToken }
  : {};

async function fetchExact(url, maximumBytes, { verifyBrowserHeaders = false } = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: requestHeaders,
    redirect: 'manual',
    signal: AbortSignal.timeout(requestTimeoutMilliseconds),
  });
  if (response.status >= 300 && response.status < 400) {
    fail('redirects are not accepted');
  }
  if (!response.ok) fail(`an asset returned HTTP ${response.status}`);
  const responseUrl = new URL(response.url);
  const requestedUrl = new URL(url);
  if (
    responseUrl.origin !== origin
    || responseUrl.pathname !== requestedUrl.pathname
    || responseUrl.search
    || responseUrl.hash
  ) {
    fail('a response crossed the approved deployment boundary');
  }
  if (verifyBrowserHeaders && !validateServedBrowserHeaders(response.headers)) {
    fail('the deployment response is missing the reviewed browser security headers');
  }
  return readBounded(response, maximumBytes);
}

const manifestUrl = new URL(`/${servedAssetManifestFile}`, `${origin}/`).href;
const manifestBytes = await fetchExact(manifestUrl, maximumManifestBytes, {
  verifyBrowserHeaders: true,
});
let manifestValue;
try {
  manifestValue = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
} catch {
  fail('the served manifest is not valid UTF-8 JSON');
}
const manifest = validateServedAssetManifest(manifestValue);
if (!manifest) fail('the served manifest failed the bounded schema policy');
if (manifest.source_commit !== expectedCommit) {
  fail('the served manifest does not match the expected deployment commit');
}

let nextAssetIndex = 0;
let verifiedAssets = 0;
async function verifyNextAsset() {
  while (nextAssetIndex < manifest.assets.length) {
    const asset = manifest.assets[nextAssetIndex];
    nextAssetIndex += 1;
    const url = servedAssetUrl(origin, asset.path);
    if (!url) fail('the manifest contains an unsafe asset path');
    const bytes = await fetchExact(url, maximumAssetBytes);
    const comparison = compareServedAsset(asset, bytes);
    if (!comparison?.matches) {
      fail('a served asset does not match the reviewed manifest');
    }
    verifiedAssets += 1;
  }
}

await Promise.all(Array.from(
  { length: Math.min(verificationConcurrency, manifest.assets.length) },
  () => verifyNextAsset(),
));
if (verifiedAssets !== manifest.asset_count) {
  fail('the complete served asset set was not verified');
}

console.log(JSON.stringify({
  schema: 'dealivra.served-asset-verification-result.v1',
  status: 'verified',
  source_commit: expectedCommit,
  origin_host: new URL(origin).hostname,
  asset_count: verifiedAssets,
  total_bytes: manifest.total_bytes,
  browser_headers: 'verified',
}));
