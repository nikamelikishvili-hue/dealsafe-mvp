import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const protectedFunctions = [
  'evidence-files',
  'stripe-connect',
  'stripe-create-checkout',
  'stripe-release-payment',
  'stripe-resolve-dispute',
];

function decodeClaims(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error();
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('The MFA matrix token is malformed.');
  }
}

function authenticationMethods(claims) {
  return Array.isArray(claims?.amr)
    ? claims.amr.map(method => method?.method).filter(value => typeof value === 'string')
    : [];
}

export function validateMatrixTokens(aal1Token, aal2Token) {
  if (!aal1Token || !aal2Token) {
    throw new Error('Both password-only and AAL2 control tokens are required.');
  }
  const aal1 = decodeClaims(aal1Token);
  const aal2 = decodeClaims(aal2Token);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const aal1Methods = authenticationMethods(aal1);
  const aal2Methods = authenticationMethods(aal2);
  if (
    typeof aal1.sub !== 'string'
    || aal1.sub !== aal2.sub
    || aal1.role !== 'authenticated'
    || aal2.role !== 'authenticated'
    || aal1.aal !== 'aal1'
    || aal2.aal !== 'aal2'
    || !aal1Methods.includes('password')
    || !aal2Methods.includes('password')
    || !aal2Methods.includes('totp')
    || !Number.isFinite(Number(aal1.exp))
    || !Number.isFinite(Number(aal2.exp))
    || Number(aal1.exp) <= nowSeconds
    || Number(aal2.exp) <= nowSeconds
    || Number(aal1.exp) > nowSeconds + 2 * 60 * 60
    || Number(aal2.exp) > nowSeconds + 2 * 60 * 60
  ) {
    throw new Error(
      'The MFA matrix requires short-lived same-account AAL1 password and AAL2 password-plus-TOTP sessions.',
    );
  }
  return { subject: aal1.sub };
}

function cleanOrigin(value) {
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'https:'
    || parsed.origin !== value.replace(/\/$/, '')
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('DEALIVRA_MFA_MATRIX_ORIGIN must be an exact HTTPS origin.');
  }
  return parsed.origin;
}

function cleanSupabaseUrl(value) {
  const parsed = new URL(value);
  const local = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  if (
    (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:'))
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname !== '' && parsed.pathname !== '/')
  ) {
    throw new Error('SUPABASE_URL must contain only the project origin.');
  }
  return parsed.origin;
}

async function boundedResponse(response) {
  const text = (await response.text().catch(() => '')).slice(0, 4096);
  return { status: response.status, body: text };
}

function mfaDenied(result) {
  return result.status === 403
    && /DEALIVRA_MFA_REQUIRED|mfa_required|multi-factor verification is required/i.test(result.body);
}

function result(surface, negative, control, passed, detail) {
  return {
    surface,
    password_only_status: negative?.status ?? null,
    aal2_control_status: control?.status ?? null,
    outcome: passed ? 'PASS' : detail === 'SKIP' ? 'SKIP' : 'FAIL',
    detail,
  };
}

async function request(fetchImplementation, url, publishableKey, token, origin, init = {}) {
  return boundedResponse(await fetchImplementation(url, {
    ...init,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      Origin: origin,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  }));
}

export async function runMfaPasswordOnlyMatrix({
  fetchImplementation = fetch,
  supabaseUrl,
  publishableKey,
  aal1Token,
  aal2Token,
  origin,
  storageObject,
}) {
  validateMatrixTokens(aal1Token, aal2Token);
  const baseUrl = cleanSupabaseUrl(supabaseUrl);
  const browserOrigin = cleanOrigin(origin);
  const normalizedKey = String(publishableKey || '').replace(/\s+/g, '');
  if (!normalizedKey || /^sb_secret_/i.test(normalizedKey)) {
    throw new Error('A publishable Supabase key is required; secret keys are prohibited.');
  }

  const results = [];
  const dataUrl = `${baseUrl}/rest/v1/rpc/current_user_app_role`;
  const aal1Data = await request(
    fetchImplementation,
    dataUrl,
    normalizedKey,
    aal1Token,
    browserOrigin,
    { method: 'POST', body: '{}' },
  );
  const aal2Data = await request(
    fetchImplementation,
    dataUrl,
    normalizedKey,
    aal2Token,
    browserOrigin,
    { method: 'POST', body: '{}' },
  );
  results.push(result(
    'Data API',
    aal1Data,
    aal2Data,
    mfaDenied(aal1Data) && aal2Data.status === 200,
    'AAL1 must receive the governed 403; AAL2 must reach the RPC.',
  ));

  if (typeof storageObject === 'string' && /^[a-z0-9][a-z0-9._-]{1,62}\/.+$/i.test(storageObject)) {
    const storageUrl = `${baseUrl}/storage/v1/object/authenticated/${storageObject
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/')}`;
    const storageOptions = { method: 'GET', headers: { Range: 'bytes=0-0' } };
    const aal1Storage = await request(
      fetchImplementation,
      storageUrl,
      normalizedKey,
      aal1Token,
      browserOrigin,
      storageOptions,
    );
    const aal2Storage = await request(
      fetchImplementation,
      storageUrl,
      normalizedKey,
      aal2Token,
      browserOrigin,
      storageOptions,
    );
    results.push(result(
      'Storage',
      aal1Storage,
      aal2Storage,
      ![200, 206].includes(aal1Storage.status) && [200, 206].includes(aal2Storage.status),
      'A known protected object must be denied to AAL1 and readable to AAL2.',
    ));
  } else {
    results.push(result(
      'Storage',
      null,
      null,
      false,
      'SKIP',
    ));
  }

  for (const functionName of protectedFunctions) {
    const functionUrl = `${baseUrl}/functions/v1/${functionName}`;
    const options = { method: 'POST', body: '{}' };
    const aal1Function = await request(
      fetchImplementation,
      functionUrl,
      normalizedKey,
      aal1Token,
      browserOrigin,
      options,
    );
    const aal2Function = await request(
      fetchImplementation,
      functionUrl,
      normalizedKey,
      aal2Token,
      browserOrigin,
      options,
    );
    results.push(result(
      `Edge Function: ${functionName}`,
      aal1Function,
      aal2Function,
      mfaDenied(aal1Function)
        && !mfaDenied(aal2Function)
        && ![401, 403].includes(aal2Function.status),
      'AAL1 must stop at MFA; AAL2 may proceed to the deliberately invalid no-op body.',
    ));
  }

  return {
    schema: 'dealivra.mfa-password-only-matrix.v1',
    recorded_at: new Date().toISOString(),
    results,
    passed: results.every(item => item.outcome === 'PASS'),
  };
}

async function main() {
  const report = await runMfaPasswordOnlyMatrix({
    supabaseUrl: process.env.SUPABASE_URL || '',
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    aal1Token: process.env.DEALIVRA_MFA_MATRIX_AAL1_TOKEN || '',
    aal2Token: process.env.DEALIVRA_MFA_MATRIX_AAL2_TOKEN || '',
    origin: process.env.DEALIVRA_MFA_MATRIX_ORIGIN || '',
    storageObject: process.env.DEALIVRA_MFA_MATRIX_STORAGE_OBJECT || '',
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : 'MFA matrix failed.'}\n`);
    process.exitCode = 1;
  });
}
