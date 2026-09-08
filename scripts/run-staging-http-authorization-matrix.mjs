import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readBoundedResponseText } from '../server/responseBodyBoundary.mjs';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const projectRefPattern = /^[a-z0-9]{20}$/;
const publishableKeyPattern = /^sb_publishable_[A-Za-z0-9_-]{16,256}$/;
const maximumResponseBytes = 65_536;
const maximumRequestTimeoutMs = 10_000;
const allowedDealStatuses = new Set(['accepted', 'completed', 'disputed', 'cancelled']);
const legacyStorageDenialCodes = new Set(['AccessDenied', 'unauthorized', '42501']);
const pngProbe = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function fail(message) {
  throw new Error('Staging HTTP authorization matrix rejected: ' + message);
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function claims(token, baseUrl, allowExpired = false) {
  try {
    if (typeof token !== 'string' || token.length > 8192) fail('a token is malformed.');
    const parts = token.split('.');
    if (
      parts.length !== 3
      || parts[0].length > 1024
      || parts[1].length > 6144
      || parts[2].length < 16
      || parts[2].length > 2048
      || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part)
        || Buffer.from(part, 'base64url').toString('base64url') !== part)
    ) fail('a token is malformed.');

    const decoder = new TextDecoder('utf-8', { fatal: true });
    const header = JSON.parse(decoder.decode(Buffer.from(parts[0], 'base64url')));
    const value = JSON.parse(decoder.decode(Buffer.from(parts[1], 'base64url')));
    if (
      !object(header)
      || !['HS256', 'ES256', 'RS256'].includes(header.alg)
      || !object(value)
      || typeof value.sub !== 'string'
      || !uuidPattern.test(value.sub)
      || value.role !== 'authenticated'
      || value.aud !== 'authenticated'
      || value.iss !== baseUrl + '/auth/v1'
      || !Number.isSafeInteger(value.exp)
      || value.exp <= 0
    ) fail('a token has invalid claims.');

    const expired = value.exp <= Math.floor(Date.now() / 1000);
    if (allowExpired !== expired) fail('a token has the wrong expiry state.');

    // Decoding is only an isolation preflight. Supabase must still verify each
    // signature and authorize every actual request.
    return { sub: value.sub.toLowerCase() };
  } catch {
    fail('a token is malformed or has invalid environment-bound claims.');
  }
}

function exactOrigin(value, label) {
  try {
    if (typeof value !== 'string' || value.length > 2048) throw new Error();
    const parsed = new URL(value);
    if (
      parsed.protocol !== 'https:'
      || parsed.origin !== value
      || parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
    ) throw new Error();
    return parsed.origin;
  } catch {
    fail(label + ' must be an exact HTTPS origin.');
  }
}

async function bounded(fetchImplementation, url, init, requestTimeoutMs) {
  const controller = new AbortController();
  let timeout;
  let status = null;
  let cancelBody = () => undefined;

  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImplementation(url, {
          ...init,
          redirect: 'error',
          signal: controller.signal,
        });
        if (!(response instanceof Response)) throw new Error();
        status = response.status;

        if (response.redirected || status < 200 || (status >= 300 && status < 400)) {
          response.body?.cancel().catch(() => undefined);
          throw new Error();
        }

        let boundedResponse = response;
        if (response.body) {
          const reader = response.body.getReader();
          cancelBody = () => {
            reader.cancel().catch(() => undefined);
          };

          // Retain a cancellable upstream reader while the shared byte boundary
          // owns its reader. AbortSignal alone cannot cancel an injected stream.
          const stream = new ReadableStream({
            async pull(streamController) {
              try {
                const chunk = await reader.read();
                if (chunk.done) streamController.close();
                else streamController.enqueue(chunk.value);
              } catch {
                streamController.error(new Error('Remote response body was rejected.'));
              }
            },
            cancel() {
              cancelBody();
            },
          });
          boundedResponse = new Response(stream, { status, headers: response.headers });
        }

        if (controller.signal.aborted) {
          cancelBody();
          throw new Error();
        }

        const body = await readBoundedResponseText(boundedResponse, maximumResponseBytes);
        const isJson = /^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '');
        let value;
        let jsonValid = false;

        if (isJson) {
          try {
            value = JSON.parse(body);
            jsonValid = true;
          } catch {
            // Empty, unreadable, or malformed data is not an empty projection.
          }
        }

        return { status, jsonValid, value, transportPassed: true };
      })(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          cancelBody();
          reject(new Error('Remote request did not complete.'));
        }, requestTimeoutMs);
      }),
    ]);
  } catch {
    controller.abort();
    cancelBody();
    return { status, jsonValid: false, transportPassed: false };
  } finally {
    clearTimeout(timeout);
  }
}

function headers(key, token, origin, extra = {}) {
  return {
    apikey: key,
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    Origin: origin,
    ...extra,
  };
}

function validParticipantRpc(result, expectedRole) {
  return result.transportPassed && result.status === 200 && result.jsonValid
    && Array.isArray(result.value) && result.value.length === 1
    && object(result.value[0]) && result.value[0].viewer_role === expectedRole
    && allowedDealStatuses.has(result.value[0].deal_status);
}

function emptyProjection(result) {
  return result.transportPassed && result.status === 200 && result.jsonValid
    && Array.isArray(result.value) && result.value.length === 0;
}

function denied(result, allowLegacyStorage = false) {
  return result.transportPassed && (
    [401, 403].includes(result.status)
    || allowLegacyStorage && result.status === 400 && result.jsonValid
      && object(result.value) && legacyStorageDenialCodes.has(result.value.code)
  );
}

function successfulUpload(result) {
  return result.transportPassed && [200, 201].includes(result.status)
    && result.jsonValid && object(result.value);
}

function report(rows) {
  return {
    schema: 'dealivra.staging-http-authorization-matrix.v1',
    recorded_at: new Date().toISOString(),
    results: rows.map(([surface, status, passed]) => ({
      surface,
      http_status: status,
      outcome: passed ? 'PASS' : 'FAIL',
    })),
    passed: rows.every(([, , passed]) => passed),
  };
}

export async function runStagingHttpAuthorizationMatrix({
  fetchImplementation = fetch,
  environment,
  stagingProjectRef,
  productionProjectRef,
  requestTimeoutMs = maximumRequestTimeoutMs,
  supabaseUrl,
  publishableKey,
  origin,
  dealId,
  sellerToken,
  buyerToken,
  outsiderToken,
  expiredToken,
}) {
  if (
    environment !== 'staging'
    || typeof stagingProjectRef !== 'string'
    || typeof productionProjectRef !== 'string'
    || !projectRefPattern.test(stagingProjectRef)
    || !projectRefPattern.test(productionProjectRef)
    || stagingProjectRef === productionProjectRef
  ) fail('distinct, exact Staging and Production project references are required in the staging environment.');

  const baseUrl = exactOrigin(supabaseUrl, 'SUPABASE_URL');
  const browserOrigin = exactOrigin(origin, 'DEALIVRA_HTTP_MATRIX_ORIGIN');
  if (baseUrl !== 'https://' + stagingProjectRef + '.supabase.co') {
    fail('SUPABASE_URL must match the isolated Staging project.');
  }
  if (typeof publishableKey !== 'string' || !publishableKeyPattern.test(publishableKey)) {
    fail('a modern publishable key is required; secret and legacy JWT keys are prohibited.');
  }
  const key = publishableKey;

  if (typeof dealId !== 'string' || !uuidPattern.test(dealId)) {
    fail('the synthetic accepted deal ID is invalid.');
  }
  if (
    !Number.isSafeInteger(requestTimeoutMs)
    || requestTimeoutMs < 1
    || requestTimeoutMs > maximumRequestTimeoutMs
  ) fail('the request timeout must be between 1 and 10000 milliseconds.');

  const seller = claims(sellerToken, baseUrl);
  const buyer = claims(buyerToken, baseUrl);
  const outsider = claims(outsiderToken, baseUrl);
  claims(expiredToken, baseUrl, true);

  if (new Set([seller.sub, buyer.sub, outsider.sub]).size !== 3) {
    fail('seller, buyer, and outsider must be different accounts.');
  }

  const request = (url, init) => bounded(fetchImplementation, url, init, requestTimeoutMs);
  const rpcUrl = baseUrl + '/rest/v1/rpc/get_deal_action_plan';
  const rpcBody = JSON.stringify({ p_deal_id: dealId });
  const rpcCall = token => request(rpcUrl, {
    method: 'POST',
    headers: headers(key, token, browserOrigin, { 'Content-Type': 'application/json' }),
    body: rpcBody,
  });

  const [sellerRpc, buyerRpc, outsiderRpc, expiredRpc, anonymousRpc] = await Promise.all([
    rpcCall(sellerToken),
    rpcCall(buyerToken),
    rpcCall(outsiderToken),
    rpcCall(expiredToken),
    rpcCall(''),
  ]);

  const rows = [
    ['Data API seller', sellerRpc.status, validParticipantRpc(sellerRpc, 'seller')],
    ['Data API buyer', buyerRpc.status, validParticipantRpc(buyerRpc, 'buyer')],
    ['Data API outsider', outsiderRpc.status, emptyProjection(outsiderRpc)],
    ['Data API expired', expiredRpc.status, denied(expiredRpc)],
    ['Data API anonymous', anonymousRpc.status, denied(anonymousRpc)],
    ['Storage outsider cross-user upload', null, false],
    ['Storage expired upload', null, false],
    ['Storage anonymous upload', null, false],
    ['Storage seller own upload', null, false],
    ['Storage buyer own upload', null, false],
    ['Storage cleanup', null, false],
  ];

  if (rows.slice(0, 5).some(([, , passed]) => !passed)) return report(rows);

  const basename = 'dat003-' + randomUUID() + '.png';

  // Register all possible writes before POST, including denial probes: a lost
  // response does not establish that an object was never persisted.
  const probes = [
    {
      owner: seller.sub,
      token: sellerToken,
      path: seller.sub + '/' + basename,
      requiresVisibility: false,
    },
    {
      owner: buyer.sub,
      token: buyerToken,
      path: buyer.sub + '/' + basename,
      requiresVisibility: false,
    },
  ];

  const objectUrl = path =>
    baseUrl + '/storage/v1/object/deal-media/' + path.split('/').map(encodeURIComponent).join('/');

  const upload = (token, path) => request(objectUrl(path), {
    method: 'POST',
    headers: headers(key, token, browserOrigin, { 'Content-Type': 'image/png', 'x-upsert': 'false' }),
    body: pngProbe,
  });

  const remove = probe => request(baseUrl + '/storage/v1/object/deal-media', {
    method: 'DELETE',
    headers: headers(key, probe.token, browserOrigin, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: [probe.path] }),
  });

  const list = probe => request(baseUrl + '/storage/v1/object/list/deal-media', {
    method: 'POST',
    headers: headers(key, probe.token, browserOrigin, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      prefix: probe.owner,
      search: basename,
      limit: 2,
      offset: 0,
    }),
  });

  try {
    const uploads = [
      [outsiderToken, probes[0], true],
      [expiredToken, probes[0], true],
      ['', probes[0], true],
      [sellerToken, probes[0], false],
      [buyerToken, probes[1], false],
    ];

    for (let index = 0; index < uploads.length; index += 1) {
      const [token, probe, expectDenial] = uploads[index];
      const result = await upload(token, probe.path);
      // Only an explicit authorization denial establishes that this attempt
      // did not write. A lost response or server error leaves a possible write.
      if (!denied(result, true)) probe.requiresVisibility = true;

      rows[index + 5][1] = result.status;
      rows[index + 5][2] = expectDenial ? denied(result, true) : successfulUpload(result);
      if (!result.transportPassed) break;
    }
  } finally {
    const cleanup = await Promise.all(probes.map(async probe => {
      // A positive listing prevents deny-all SELECT from falsely proving every
      // object absent. Only this run's two owner-specific nonce paths are removed.
      const before = await list(probe);
      const witnessed = before.transportPassed
        && before.status === 200
        && before.jsonValid
        && Array.isArray(before.value)
        && before.value.length === 1
        && object(before.value[0])
        && before.value[0].name === basename;

      const removed = await remove(probe);
      const after = await list(probe);
      const removalPassed = removed.transportPassed && (
        removed.status === 204
        || removed.status === 200 && removed.jsonValid && Array.isArray(removed.value)
      );

      return {
        statuses: [before.status, removed.status, after.status],
        passed: (!probe.requiresVisibility || witnessed) && removalPassed && emptyProjection(after),
      };
    }));

    const statuses = cleanup.flatMap(item => item.statuses);
    rows[10][1] = statuses.some(status => status === null) ? null : Math.max(...statuses);
    rows[10][2] = cleanup.every(item => item.passed);
  }

  return report(rows);
}

async function main() {
  const report = await runStagingHttpAuthorizationMatrix({
    environment: process.env.DEALIVRA_DATABASE_ENVIRONMENT,
    stagingProjectRef: process.env.DEALIVRA_STAGING_SUPABASE_PROJECT_REF,
    productionProjectRef: process.env.DEALIVRA_PRODUCTION_SUPABASE_PROJECT_REF,
    supabaseUrl: process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    origin: process.env.DEALIVRA_HTTP_MATRIX_ORIGIN,
    dealId: process.env.DEALIVRA_HTTP_MATRIX_DEAL_ID,
    sellerToken: process.env.DEALIVRA_HTTP_MATRIX_SELLER_TOKEN,
    buyerToken: process.env.DEALIVRA_HTTP_MATRIX_BUYER_TOKEN,
    outsiderToken: process.env.DEALIVRA_HTTP_MATRIX_OUTSIDER_TOKEN,
    expiredToken: process.env.DEALIVRA_HTTP_MATRIX_EXPIRED_TOKEN,
  });

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    process.stderr.write(
      'Staging HTTP authorization matrix rejected before completion; check the protected configuration.\n',
    );
    process.exitCode = 1;
  });
}
