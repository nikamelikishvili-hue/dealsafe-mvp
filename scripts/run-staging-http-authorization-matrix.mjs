import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pngProbe = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function fail(message) {
  throw new Error(`Staging HTTP authorization matrix rejected: ${message}`);
}

function claims(token, allowExpired = false) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) fail('a token is malformed.');
    const value = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!uuidPattern.test(value.sub) || value.role !== 'authenticated') fail('a token has invalid claims.');
    const expired = Number(value.exp) <= Math.floor(Date.now() / 1000);
    if (allowExpired !== expired) fail(allowExpired ? 'the expired token is still active.' : 'an active token is expired.');
    return value;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Staging HTTP')) throw error;
    fail('a token is malformed.');
  }
}

function exactOrigin(value, label) {
  const parsed = new URL(String(value || ''));
  if (parsed.protocol !== 'https:' || parsed.origin !== String(value).replace(/\/$/, '') || parsed.username || parsed.password || parsed.search || parsed.hash) {
    fail(`${label} must be an exact HTTPS origin.`);
  }
  return parsed.origin;
}

async function bounded(fetchImplementation, url, init) {
  const response = await fetchImplementation(url, { redirect: 'error', ...init });
  const body = (await response.text().catch(() => '')).slice(0, 4096);
  return { status: response.status, body };
}

function headers(key, token, origin, extra = {}) {
  return {
    apikey: key,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Origin: origin,
    ...extra,
  };
}

function emptyRpcBody(body) {
  const normalized = body.trim();
  return normalized === '' || normalized === 'null' || normalized === '[]' || normalized === '{}';
}

export async function runStagingHttpAuthorizationMatrix({
  fetchImplementation = fetch,
  supabaseUrl,
  publishableKey,
  origin,
  dealId,
  sellerToken,
  buyerToken,
  outsiderToken,
  expiredToken,
}) {
  const baseUrl = exactOrigin(supabaseUrl, 'SUPABASE_URL');
  const browserOrigin = exactOrigin(origin, 'DEALIVRA_HTTP_MATRIX_ORIGIN');
  if (!baseUrl.endsWith('.supabase.co')) fail('SUPABASE_URL must be a hosted Supabase project.');
  const key = String(publishableKey || '').trim();
  if (!key || /^sb_secret_/i.test(key)) fail('a publishable key is required.');
  if (!uuidPattern.test(dealId)) fail('the synthetic accepted deal ID is invalid.');

  const seller = claims(sellerToken);
  const buyer = claims(buyerToken);
  const outsider = claims(outsiderToken);
  claims(expiredToken, true);
  if (new Set([seller.sub, buyer.sub, outsider.sub]).size !== 3) fail('seller, buyer, and outsider must be different accounts.');

  const rpcUrl = `${baseUrl}/rest/v1/rpc/get_deal_action_plan`;
  const rpcBody = JSON.stringify({ p_deal_id: dealId });
  const rpcCall = token => bounded(fetchImplementation, rpcUrl, {
    method: 'POST',
    headers: headers(key, token, browserOrigin, { 'Content-Type': 'application/json' }),
    body: rpcBody,
  });
  const [sellerRpc, buyerRpc, outsiderRpc, expiredRpc, anonymousRpc] = await Promise.all([
    rpcCall(sellerToken), rpcCall(buyerToken), rpcCall(outsiderToken), rpcCall(expiredToken), rpcCall(''),
  ]);

  const rows = [
    ['Data API seller', sellerRpc.status, sellerRpc.status === 200 && !emptyRpcBody(sellerRpc.body)],
    ['Data API buyer', buyerRpc.status, buyerRpc.status === 200 && !emptyRpcBody(buyerRpc.body)],
    ['Data API outsider', outsiderRpc.status, outsiderRpc.status === 200 && emptyRpcBody(outsiderRpc.body)],
    ['Data API expired', expiredRpc.status, [401, 403].includes(expiredRpc.status)],
    ['Data API anonymous', anonymousRpc.status, [401, 403].includes(anonymousRpc.status)],
  ];

  const nonce = randomUUID();
  const sellerPath = `${seller.sub}/dat003-${nonce}.png`;
  const buyerPath = `${buyer.sub}/dat003-${nonce}.png`;
  const objectUrl = path => `${baseUrl}/storage/v1/object/deal-media/${path.split('/').map(encodeURIComponent).join('/')}`;
  const upload = (token, path) => bounded(fetchImplementation, objectUrl(path), {
    method: 'POST',
    headers: headers(key, token, browserOrigin, { 'Content-Type': 'image/png', 'x-upsert': 'false' }),
    body: pngProbe,
  });
  const remove = (token, path) => bounded(fetchImplementation, objectUrl(path), {
    method: 'DELETE',
    headers: headers(key, token, browserOrigin),
  });

  const outsiderUpload = await upload(outsiderToken, sellerPath);
  const expiredUpload = await upload(expiredToken, sellerPath);
  const anonymousUpload = await upload('', sellerPath);
  const sellerUpload = await upload(sellerToken, sellerPath);
  const buyerUpload = await upload(buyerToken, buyerPath);
  rows.push(
    ['Storage outsider cross-user upload', outsiderUpload.status, ![200, 201].includes(outsiderUpload.status)],
    ['Storage expired upload', expiredUpload.status, [401, 403].includes(expiredUpload.status)],
    ['Storage anonymous upload', anonymousUpload.status, [401, 403].includes(anonymousUpload.status)],
    ['Storage seller own upload', sellerUpload.status, [200, 201].includes(sellerUpload.status)],
    ['Storage buyer own upload', buyerUpload.status, [200, 201].includes(buyerUpload.status)],
  );

  const cleanup = [];
  if ([200, 201].includes(sellerUpload.status)) cleanup.push(await remove(sellerToken, sellerPath));
  if ([200, 201].includes(buyerUpload.status)) cleanup.push(await remove(buyerToken, buyerPath));
  rows.push(['Storage cleanup', cleanup.length ? Math.max(...cleanup.map(item => item.status)) : null, cleanup.length === 2 && cleanup.every(item => [200, 204].includes(item.status))]);

  return {
    schema: 'dealivra.staging-http-authorization-matrix.v1',
    recorded_at: new Date().toISOString(),
    results: rows.map(([surface, status, passed]) => ({ surface, http_status: status, outcome: passed ? 'PASS' : 'FAIL' })),
    passed: rows.every(([, , passed]) => passed),
  };
}

async function main() {
  const report = await runStagingHttpAuthorizationMatrix({
    supabaseUrl: process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    origin: process.env.DEALIVRA_HTTP_MATRIX_ORIGIN,
    dealId: process.env.DEALIVRA_HTTP_MATRIX_DEAL_ID,
    sellerToken: process.env.DEALIVRA_HTTP_MATRIX_SELLER_TOKEN,
    buyerToken: process.env.DEALIVRA_HTTP_MATRIX_BUYER_TOKEN,
    outsiderToken: process.env.DEALIVRA_HTTP_MATRIX_OUTSIDER_TOKEN,
    expiredToken: process.env.DEALIVRA_HTTP_MATRIX_EXPIRED_TOKEN,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Staging HTTP authorization matrix failed.'}\n`);
    process.exitCode = 1;
  });
}
