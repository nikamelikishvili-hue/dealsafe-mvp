import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const readJson = relativePath => JSON.parse(readFileSync(new URL(relativePath, root), 'utf8'));
const readText = relativePath => readFileSync(new URL(relativePath, root), 'utf8');
const authRequest = (body = {}, headers = {}) => ({
  method: 'POST',
  headers: {
    origin: 'https://dealivra.test',
    host: 'dealivra.test',
    ...headers,
  },
  body,
});
const createResponse = () => ({
  statusCode: 200,
  headers: new Map(),
  payload: undefined,
  ended: false,
  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value);
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(value) {
    this.payload = value;
    return this;
  },
  end() {
    this.ended = true;
    return this;
  },
});
const authProviderSession = refreshToken => ({
  access_token: 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature',
  refresh_token: refreshToken,
  expires_in: 3600,
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'user@example.com',
    email_confirmed_at: '2026-07-26T00:00:00Z',
    user_metadata: { display_name: 'Test User' },
  },
});
const withAuthProvider = async (fetchImplementation, callback) => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = '  https://project.example.supabase.co/  ';
  process.env.SUPABASE_PUBLISHABLE_KEY = '  sb_publishable_\n test  ';
  globalThis.fetch = fetchImplementation;

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
};

test('runtime and development dependencies are exactly pinned', () => {
  const packageJson = readJson('package.json');
  const entries = Object.entries({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  });

  assert.ok(entries.length > 0);
  for (const [name, version] of entries) {
    assert.match(
      version,
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
      `${name} must use an exact reviewed version instead of "${version}"`,
    );
  }
});

test('npm is the only repository package-manager lockfile', () => {
  assert.equal(existsSync(join(rootPath, 'package-lock.json')), true);
  assert.equal(existsSync(join(rootPath, 'pnpm-lock.yaml')), false);
  assert.equal(existsSync(join(rootPath, 'yarn.lock')), false);
});

test('Vercel configuration includes the minimum browser security headers', () => {
  const vercel = readJson('vercel.json');
  const globalHeaders = vercel.headers.find(rule => rule.source === '/(.*)')?.headers ?? [];
  const values = new Map(globalHeaders.map(header => [header.key.toLowerCase(), header.value]));

  for (const required of [
    'content-security-policy',
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
    'referrer-policy',
    'permissions-policy',
  ]) {
    assert.ok(values.has(required), `Missing ${required}`);
  }

  const csp = values.get('content-security-policy');
  for (const directive of [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "connect-src 'self'",
  ]) {
    assert.ok(csp.includes(directive), `CSP must contain ${directive}`);
  }

  const scriptPolicy = csp.match(/script-src[^;]*/)?.[0] ?? '';
  assert.equal(scriptPolicy.includes("'unsafe-inline'"), false);

  const html = readText('index.html');
  const inlineScripts = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .filter(Boolean);
  for (const source of inlineScripts) {
    const hash = createHash('sha256').update(source).digest('base64');
    assert.ok(scriptPolicy.includes(`'sha256-${hash}'`), 'Every inline script must have a CSP hash');
  }
});

test('private analytics removes query strings before collection', () => {
  const html = readText('index.html');
  assert.match(html, /url\.origin\s*\+\s*url\.pathname/);
  assert.doesNotMatch(html, /dangerouslySetInnerHTML/);
});

test('the production-readiness specification is complete and linked', () => {
  const requiredDocuments = [
    'README.md',
    '00_MASTER_PLAN.md',
    '01_US_MVP_SCOPE.md',
    '02_SYSTEM_ARCHITECTURE.md',
    '03_SECURITY_THREAT_MODEL.md',
    '04_DATA_ACCESS_RETENTION.md',
    '05_PAYMENTS_KYC_DISPUTES.md',
    '06_DESIGN_SYSTEM_UX_STANDARD.md',
    '07_TEST_RELEASE_GATES.md',
    '08_IMPLEMENTATION_BACKLOG.md',
    '09_PROGRESS_LOG.md',
    '10_ENVIRONMENT_CONFIGURATION.md',
    '11_LEGACY_IDENTIFIER_REGISTER.md',
  ];

  for (const document of requiredDocuments) {
    assert.equal(
      existsSync(join(rootPath, 'docs', 'production-readiness', document)),
      true,
      `Missing ${document}`,
    );
  }

  const repositoryReadme = readText('README.md');
  assert.match(repositoryReadme, /docs\/production-readiness\/README\.md/);
});

test('browser auth keeps the long-lived refresh secret in an HttpOnly cookie', () => {
  const authService = readText('src/services/supabaseRest.ts');
  const serverAuth = readText('server/authShared.mjs');
  const loginFunction = readText('api/auth/login.mjs');
  const refreshFunction = readText('api/auth/refresh.mjs');

  assert.match(authService, /sessionStorage\.setItem\(sessionStorageKey/);
  assert.doesNotMatch(authService, /localStorage\.setItem\(/);
  assert.match(authService, /fetch\('\/api\/auth\/login'/);
  assert.match(authService, /fetch\('\/api\/auth\/refresh'/);
  assert.match(serverAuth, /__Host-dealivra-refresh/);
  assert.match(serverAuth, /HttpOnly; Secure; SameSite=Strict/);
  assert.match(serverAuth, /Path=\$\{refreshCookiePath\}/);
  assert.match(loginFunction, /publicSession\(data\)/);
  assert.match(refreshFunction, /setRefreshCookie\(response, data\.refresh_token\)/);
});

test('auth endpoints enforce same-origin POST requests and do not cache responses', () => {
  const shared = readText('server/authShared.mjs');
  const vercel = readJson('vercel.json');
  const spaRewrite = vercel.rewrites.find(rule => rule.destination === '/index.html');

  assert.match(shared, /request\.method === 'POST'/);
  assert.match(shared, /new URL\(origin\)\.host !== host/);
  assert.match(shared, /no-store, max-age=0/);
  assert.ok(spaRewrite);
  assert.match(spaRewrite.source, /api\//);
});

test('production database hardening is deny-by-default with narrow RPC allowlists', () => {
  const migration = readText('supabase/production_auth_rbac_hardening.sql');
  const schema = readText('supabase/schema.sql');
  const anonymousBlock = migration.split('authenticated_api constant text[]')[0];

  assert.match(migration, /revoke all privileges on all tables in schema public from anon, authenticated/i);
  assert.match(migration, /revoke all privileges on all functions in schema public/i);
  assert.match(migration, /app_role in \('member', 'support', 'compliance', 'admin'\)/);
  assert.match(anonymousBlock, /'get_public_deal'/);
  assert.match(anonymousBlock, /'verify_agreement_record'/);
  assert.doesNotMatch(anonymousBlock, /'accept_deal'/);
  assert.doesNotMatch(anonymousBlock, /'get_admin_reports'/);

  assert.match(schema, /for select to authenticated/);
  assert.match(schema, /for update to authenticated[\s\S]*with check \(auth\.uid\(\) = id\)/);
  assert.match(schema, /seller inserts draft deals/);
  assert.match(schema, /seller updates own draft deals/);
});

test('auth handlers never return a refresh token to browser JavaScript', async () => {
  const { default: login } = await import('../api/auth/login.mjs');
  let requestedUrl;
  let requestedApiKey;
  const response = createResponse();

  await withAuthProvider(async (url, init) => {
    requestedUrl = String(url);
    requestedApiKey = init.headers.apikey;
    return new Response(JSON.stringify(authProviderSession('server-only-refresh-secret')), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, () => login(authRequest({
    email: 'user@example.com',
    password: 'ExamplePass123',
  }), response));

  assert.equal(response.statusCode, 200);
  assert.equal(requestedUrl, 'https://project.example.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(requestedApiKey, 'sb_publishable_test');
  assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(JSON.stringify(response.payload).includes('server-only-refresh-secret'), false);
  assert.equal(response.payload.access_token.startsWith('header.'), true);
});

test('signup rejects cross-origin requests before contacting the auth provider', async () => {
  const { default: signup } = await import('../api/auth/signup.mjs');
  const response = createResponse();
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  }, () => signup(authRequest({
    displayName: 'Test User',
    email: 'user@example.com',
    password: 'ExamplePass123',
  }, {
    origin: 'https://attacker.example',
  }), response));

  assert.equal(response.statusCode, 403);
  assert.equal(response.payload.error, 'Cross-origin authentication is not allowed.');
  assert.equal(providerCalled, false);
});

test('signup validates password strength before contacting the auth provider', async () => {
  const { default: signup } = await import('../api/auth/signup.mjs');
  const response = createResponse();
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  }, () => signup(authRequest({
    displayName: 'Test User',
    email: 'user@example.com',
    password: 'weak',
  }), response));

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.error, /12\+ characters/);
  assert.equal(providerCalled, false);
});

test('signup keeps email-confirmation accounts signed out without creating a refresh cookie', async () => {
  const { default: signup } = await import('../api/auth/signup.mjs');
  const response = createResponse();
  let submittedBody;

  await withAuthProvider(async (_url, init) => {
    submittedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'user@example.com',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, () => signup(authRequest({
    displayName: '  Test User  ',
    email: '  USER@EXAMPLE.COM  ',
    password: 'ExamplePass123',
  }), response));

  assert.equal(response.statusCode, 202);
  assert.deepEqual(response.payload, {
    session: null,
    needsEmailConfirmation: true,
  });
  assert.equal(response.headers.has('set-cookie'), false);
  assert.equal(submittedBody.email, 'user@example.com');
  assert.equal(submittedBody.data.display_name, 'Test User');
});

test('refresh rotates the HttpOnly cookie without exposing its secret', async () => {
  const { default: refresh } = await import('../api/auth/refresh.mjs');
  const response = createResponse();
  let requestedUrl;
  let submittedBody;

  await withAuthProvider(async (url, init) => {
    requestedUrl = String(url);
    submittedBody = JSON.parse(init.body);
    return new Response(JSON.stringify(authProviderSession('new/refresh+secret')), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, () => refresh(authRequest({}, {
    cookie: '__Host-dealivra-refresh=old%2Frefresh%2Bsecret',
  }), response));

  assert.equal(response.statusCode, 200);
  assert.equal(requestedUrl, 'https://project.example.supabase.co/auth/v1/token?grant_type=refresh_token');
  assert.deepEqual(submittedBody, { refresh_token: 'old/refresh+secret' });
  assert.match(
    response.headers.get('set-cookie'),
    /__Host-dealivra-refresh=new%2Frefresh%2Bsecret;.*HttpOnly; Secure; SameSite=Strict/,
  );
  assert.equal(JSON.stringify(response.payload).includes('new/refresh+secret'), false);
});

test('failed refresh clears the server-only cookie', async () => {
  const { default: refresh } = await import('../api/auth/refresh.mjs');
  const response = createResponse();

  await withAuthProvider(async () => new Response(JSON.stringify({
    error: 'invalid refresh token',
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  }), () => refresh(authRequest({}, {
    cookie: '__Host-dealivra-refresh=expired-secret',
  }), response));

  assert.equal(response.statusCode, 401);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(response.payload.error, 'Your session expired. Please sign in again.');
});

test('malformed refresh cookies fail safely without contacting the auth provider', async () => {
  const { default: refresh } = await import('../api/auth/refresh.mjs');
  const response = createResponse();
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  }, () => refresh(authRequest({}, {
    cookie: '__Host-dealivra-refresh=%E0%A4%A',
  }), response));

  assert.equal(response.statusCode, 401);
  assert.equal(response.payload.error, 'Your session expired. Please sign in again.');
  assert.equal(providerCalled, false);
});

test('logout clears the refresh cookie even when provider revocation is unavailable', async () => {
  const { default: logout } = await import('../api/auth/logout.mjs');
  const response = createResponse();
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await withAuthProvider(async () => {
      throw new Error('provider unavailable');
    }, () => logout(authRequest({}, {
      authorization: 'Bearer short-lived-access-token',
    }), response));
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 204);
  assert.equal(response.ended, true);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

test('server auth rejects privileged keys before contacting the provider', async () => {
  const { supabaseAuthRequest } = await import('../server/authShared.mjs');
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  let providerCalled = false;
  process.env.SUPABASE_URL = 'https://project.example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = ['sb', 'secret', 'must-never-be-used-here'].join('_');
  globalThis.fetch = async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  };

  try {
    await assert.rejects(
      () => supabaseAuthRequest('token?grant_type=password', {
        method: 'POST',
        body: '{}',
      }),
      /publishable key is invalid/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  }

  assert.equal(providerCalled, false);
});

test('runtime configuration has documented safe-failure and secret-boundary checks', () => {
  const authService = readText('src/services/supabaseRest.ts');
  const environmentStandard = readText('docs/production-readiness/10_ENVIRONMENT_CONFIGURATION.md');
  const example = readText('.env.example');

  assert.match(authService, /sb_secret_/);
  assert.match(authService, /Account service is temporarily unavailable/);
  assert.match(environmentStandard, /must never contain a Supabase `service_role` JWT/);
  assert.match(environmentStandard, /Preview, Staging, and Production must not share/);
  assert.match(example, /Never use sb_secret_ or service_role/);
});

test('new browser runtime identifiers use Dealivra with explicit legacy cleanup only', () => {
  const addressAutocomplete = readText('src/AddressAutocomplete.tsx');
  const authService = readText('src/services/supabaseRest.ts');
  const i18n = readText('src/i18nFull.ts');
  const checkoutFunction = readText('supabase/functions/stripe-create-checkout/index.ts');
  const legacyRegister = readText('docs/production-readiness/11_LEGACY_IDENTIFIER_REGISTER.md');

  assert.doesNotMatch(addressAutocomplete, /dealsafe/i);
  assert.match(addressAutocomplete, /__dealivraGoogleMapsReady/);
  assert.match(authService, /dealivra-session-updated/);
  assert.match(authService, /dealivra-session-expired/);
  assert.match(i18n, /const languageKey='dealivra_language'/);
  assert.match(i18n, /localStorage\.removeItem\(legacyLanguageKey\)/);
  assert.match(checkoutFunction, /DEALIVRA_PLATFORM_FEE_BPS/);
  assert.match(checkoutFunction, /DEALSAFE_PLATFORM_FEE_BPS/);
  assert.match(legacyRegister, /Approved migration aliases/);
  assert.match(legacyRegister, /must not be reused for a new feature/);
});

test('secret scanner recognizes high-risk credentials without returning their values', async () => {
  const { scanText } = await import('../scripts/scan-repository-secrets.mjs');
  const fakeGitHubToken = ['ghp', 'A'.repeat(36)].join('_');
  const fakeStripeSecret = ['sk', 'live', 'B'.repeat(24)].join('_');
  const fakePrivateKey = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
  const input = [fakeGitHubToken, fakeStripeSecret, fakePrivateKey].join('\n');
  const matches = scanText(input);

  assert.deepEqual(matches, [
    'Private key material',
    'GitHub access token',
    'Stripe secret key',
  ]);
  assert.equal(JSON.stringify(matches).includes(fakeGitHubToken), false);
  assert.equal(JSON.stringify(matches).includes(fakeStripeSecret), false);
});
