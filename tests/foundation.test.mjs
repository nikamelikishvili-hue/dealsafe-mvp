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

  assert.deepEqual(vercel.redirects, [
    {
      source: '/:path*',
      has: [
        {
          type: 'header',
          key: 'host',
          value: 'dealsafe-mvp.vercel.app',
        },
      ],
      destination: 'https://dealsafe-mvp-nika13.vercel.app/:path*',
      permanent: false,
    },
  ]);
});

test('private analytics removes query strings before collection', () => {
  const html = readText('index.html');
  const main = readText('src/main.tsx');
  assert.match(html, /url\.origin\s*\+\s*url\.pathname/);
  assert.doesNotMatch(html, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(html, /src="\/_vercel\/insights\/script\.js"/);
  assert.match(main, /location\.hostname\.endsWith\('\.vercel\.app'\)/);
  assert.match(main, /analyticsScript\.src\s*=\s*'\/_vercel\/insights\/script\.js'/);
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
    '12_CATALOG_GOVERNANCE.md',
    '13_SESSION_SECURITY.md',
    '14_IMMEDIATE_SESSION_REVOCATION.md',
    '15_EDGE_ORIGIN_SECURITY.md',
    '16_STRIPE_WEBHOOK_REPLAY_SAFETY.md',
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
  assert.match(serverAuth, /const refreshCookiePath = '\/';/);
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
  const apiClient = readText('src/services/supabaseRest.ts');
  const anonymousBlock = migration.split('authenticated_api constant text[]')[0];
  const allowedRpcs = new Set(
    [...migration.matchAll(/'([a-z][a-z0-9_]+)'/g)].map(match => match[1]),
  );
  const clientRpcs = new Set(
    [...apiClient.matchAll(/\/rest\/v1\/rpc\/([a-z][a-z0-9_]+)/g)].map(match => match[1]),
  );

  assert.match(migration, /revoke all privileges on all tables in schema public from anon, authenticated/i);
  assert.match(migration, /revoke all privileges on all functions in schema public/i);
  assert.match(migration, /app_role in \('member', 'support', 'compliance', 'admin'\)/);
  assert.match(migration, /drop policy if exists "seller inserts draft deals"/);
  assert.match(migration, /drop policy if exists "seller updates own draft deals"/);
  assert.match(migration, /seller_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /create index if not exists deals_seller_id_idx/);
  assert.match(migration, /create index if not exists deals_buyer_id_idx/);
  assert.match(anonymousBlock, /'get_public_deal'/);
  assert.match(anonymousBlock, /'verify_agreement_record'/);
  assert.doesNotMatch(anonymousBlock, /'accept_deal'/);
  assert.doesNotMatch(anonymousBlock, /'get_admin_reports'/);

  for (const rpc of clientRpcs) {
    assert.equal(
      allowedRpcs.has(rpc),
      true,
      `Browser RPC ${rpc} must be present in the reviewed production allowlist`,
    );
  }

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
  assert.match(response.headers.get('set-cookie'), /Path=\/;/);
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

test('auth endpoints reject oversized parsed JSON before contacting the provider', async () => {
  const { default: login } = await import('../api/auth/login.mjs');
  const response = createResponse();
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  }, () => login(authRequest({
    email: 'user@example.com',
    password: 'ExamplePass123',
    padding: 'x'.repeat(17_000),
  }), response));

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.error, 'Enter a valid email and password.');
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
    /__Host-dealivra-refresh=new%2Frefresh%2Bsecret; Path=\/;.*HttpOnly; Secure; SameSite=Strict/,
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

test('ordinary logout revokes only the current session', async () => {
  const { default: logout } = await import('../api/auth/logout.mjs');
  const response = createResponse();
  let requestedUrl = '';

  await withAuthProvider(async input => {
    requestedUrl = String(input);
    return new Response(null, { status: 204 });
  }, () => logout(authRequest({}, {
    authorization: 'Bearer current-session-token',
  }), response));

  assert.equal(response.statusCode, 204);
  assert.match(requestedUrl, /\/auth\/v1\/logout\?scope=local$/);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

test('other-session logout keeps the current refresh cookie', async () => {
  const { default: logout } = await import('../api/auth/logout.mjs');
  const response = createResponse();
  let requestedUrl = '';

  await withAuthProvider(async input => {
    requestedUrl = String(input);
    return new Response(null, { status: 204 });
  }, () => logout(authRequest({ scope: 'others' }, {
    authorization: 'Bearer current-session-token',
  }), response));

  assert.equal(response.statusCode, 204);
  assert.match(requestedUrl, /\/auth\/v1\/logout\?scope=others$/);
  assert.equal(response.headers.has('set-cookie'), false);
});

test('global logout clears the current cookie only after provider success', async () => {
  const { default: logout } = await import('../api/auth/logout.mjs');
  const response = createResponse();

  await withAuthProvider(async input => {
    assert.match(String(input), /\/auth\/v1\/logout\?scope=global$/);
    return new Response(null, { status: 204 });
  }, () => logout(authRequest({ scope: 'global' }, {
    authorization: 'Bearer current-session-token',
  }), response));

  assert.equal(response.statusCode, 204);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

test('invalid logout scopes fail without contacting the provider', async () => {
  const { default: logout } = await import('../api/auth/logout.mjs');
  const response = createResponse();
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    return new Response(null, { status: 204 });
  }, () => logout(authRequest({ scope: 'all-devices-maybe' }, {
    authorization: 'Bearer current-session-token',
  }), response));

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.error, 'Sign-out scope is invalid.');
  assert.equal(providerCalled, false);
  assert.equal(response.headers.has('set-cookie'), false);
});

test('failed other-session revocation never reports success or clears the current cookie', async () => {
  const { default: logout } = await import('../api/auth/logout.mjs');
  const response = createResponse();
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await withAuthProvider(async () => {
      throw new Error('provider unavailable');
    }, () => logout(authRequest({ scope: 'others' }, {
      authorization: 'Bearer current-session-token',
    }), response));
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 503);
  assert.match(response.payload.error, /Could not reach the account service/);
  assert.equal(response.headers.has('set-cookie'), false);
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

test('verification includes a production-preview navigation smoke test', () => {
  const packageJson = readJson('package.json');
  const smokeTest = readText('scripts/smoke-preview.mjs');

  assert.match(packageJson.scripts.verify, /npm run smoke:preview/);
  assert.equal(packageJson.scripts['smoke:preview'], 'node scripts/smoke-preview.mjs');
  assert.match(smokeTest, /expectApplicationPage\('\/terms'\)/);
  assert.match(smokeTest, /expectApplicationPage\('\/\?start=signin'\)/);
  assert.match(smokeTest, /serviceWorkerResponse/);
});

test('versioned catalog endpoint returns a bounded vehicle catalog with CDN caching', async () => {
  const { default: catalog } = await import('../api/catalog.mjs');
  const response = createResponse();

  await catalog({
    method: 'GET',
    query: { category: 'vehicle' },
    headers: {},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.schemaVersion, 1);
  assert.match(response.payload.version, /^\d{4}-\d{2}-\d{2}\.\d+$/);
  assert.equal(response.payload.category, 'vehicle');
  assert.ok(response.payload.brands.some(brand => brand.id === 'bmw' && brand.models.includes('X5')));
  assert.ok(response.payload.years.includes('2021'));
  assert.match(response.headers.get('cache-control'), /max-age=300/);
  assert.match(response.headers.get('vercel-cdn-cache-control'), /stale-while-revalidate=86400/);
});

test('guided catalog endpoint serves every reviewed category with a manual fallback path', async () => {
  const { default: catalog } = await import('../api/catalog.mjs');
  const catalogComponent = readText('src/SmartCatalogFields.tsx');
  const expectedCategories = new Map([
    ['phone', ['apple', 'iPhone 16 Pro']],
    ['tablet', ['samsung', 'Galaxy Tab S11 Ultra']],
    ['laptop', ['apple', 'MacBook Air 13-inch M5']],
    ['vehicle', ['honda', 'Accord']],
    ['watch', ['rolex', 'Submariner']],
    ['camera', ['nikon', 'Z6III']],
    ['gaming', ['sony', 'PlayStation 5 Pro']],
    ['tools', ['milwaukee', 'M18 FUEL Hammer Drill']],
  ]);

  assert.match(catalogComponent, /OTHER_CATALOG_VALUE/);
  assert.match(catalogComponent, /t\('Not listed'\)/);

  for (const [category, [brandId, model]] of expectedCategories) {
    const response = createResponse();
    await catalog({
      method: 'GET',
      query: { category },
      headers: {},
    }, response);

    assert.equal(response.statusCode, 200, `${category} should be available`);
    assert.equal(response.payload.category, category);
    assert.equal(response.payload.market, 'US');
    assert.ok(
      response.payload.brands.some(brand => brand.id === brandId && brand.models.includes(model)),
      `${category} should include the reviewed ${model} option`,
    );
    assert.ok(response.payload.brands.length <= 100);
    assert.ok(response.payload.brands.every(brand => brand.models.length <= 250));
  }
});

test('structured catalog identity is persisted with stable IDs and a legacy-safe backfill', () => {
  const migration = readText('supabase/structured_catalog_persistence.sql');
  const domain = readText('src/domain.ts');
  const smartCatalog = readText('src/smartCatalog.ts');
  const service = readText('src/services/supabaseRest.ts');
  const application = readText('src/app.tsx');

  for (const column of [
    'category_id',
    'catalog_version',
    'catalog_brand_id',
    'catalog_brand_label',
    'catalog_model_id',
    'catalog_model_label',
    'model_year',
    'catalog_variant_id',
    'catalog_variant_label',
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}`));
    assert.match(service, new RegExp(`${column}:`));
  }

  assert.match(migration, /category_id = coalesce\(category_id, 'general'\)/);
  assert.match(migration, /catalog_version = coalesce\(catalog_version, 'legacy'\)/);
  assert.match(migration, /deals_catalog_facets_idx/);
  assert.match(migration, /'catalog_identity',v_catalog/);
  assert.match(migration, /grant insert \([\s\S]*category_id[\s\S]*\) on public\.deals to authenticated/);
  assert.doesNotMatch(migration, /grant (?:select|insert|update|delete|all)[^;]* on public\.deals to anon/i);
  assert.match(domain, /export interface DealCatalogIdentity/);
  assert.match(smartCatalog, /export function buildDealCatalogIdentity/);
  assert.match(smartCatalog, /selection\.brand === OTHER_CATALOG_VALUE \? 'other'/);
  assert.match(service, /function catalogWriteColumns/);
  assert.match(application, /buildDealCatalogIdentity\(dealTemplate,catalogSelectionRef\.current\)/);
});

test('public catalog projection omits participant and restricted evidence fields', () => {
  const migration = readText('supabase/structured_catalog_persistence.sql');
  const publicProjection = migration.slice(
    migration.indexOf('create function public.get_public_deal'),
    migration.indexOf('drop function if exists public.get_my_saved_deals'),
  );

  assert.match(publicProjection, /category_id text/);
  assert.match(publicProjection, /catalog_brand_id text/);
  assert.match(publicProjection, /catalog_model_id text/);
  assert.match(publicProjection, /model_year smallint/);
  assert.doesNotMatch(publicProjection, /seller_id text|seller_id uuid|buyer_id text|buyer_id uuid/);
  assert.doesNotMatch(publicProjection, /serial_ciphertext|acceptance_code_hash|verification_reference/);
  assert.match(publicProjection, /moderation\.status='hidden'/);
});

test('catalog endpoint rejects unsupported categories and write methods', async () => {
  const { default: catalog } = await import('../api/catalog.mjs');
  const unsupportedResponse = createResponse();
  const writeResponse = createResponse();

  await catalog({
    method: 'GET',
    query: { category: 'unreviewed' },
    headers: {},
  }, unsupportedResponse);
  await catalog({
    method: 'POST',
    query: {},
    headers: {},
  }, writeResponse);

  assert.equal(unsupportedResponse.statusCode, 400);
  assert.equal(writeResponse.statusCode, 405);
  assert.equal(writeResponse.headers.get('allow'), 'GET');
});

test('VIN endpoint rejects invalid and cross-origin requests before contacting NHTSA', async () => {
  const { default: vin } = await import('../api/vehicles/vin.mjs');
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('The provider must not be called.');
  };

  try {
    const invalidResponse = createResponse();
    await vin(authRequest({ vin: 'NOT-A-VIN' }), invalidResponse);
    assert.equal(invalidResponse.statusCode, 400);

    const crossOriginResponse = createResponse();
    await vin(authRequest(
      { vin: '1HGCM82633A004352' },
      { origin: 'https://attacker.example' },
    ), crossOriginResponse);
    assert.equal(crossOriginResponse.statusCode, 403);
    assert.equal(crossOriginResponse.payload.error, 'Cross-origin VIN checks are not allowed.');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('VIN decoding maps only reviewed NHTSA fields and reuses its bounded memory cache', async () => {
  const { default: vin } = await import('../api/vehicles/vin.mjs');
  const { resetVehicleVinCacheForTests } = await import('../server/vehicleVinShared.mjs');
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  resetVehicleVinCacheForTests();
  globalThis.fetch = async url => {
    providerCalls += 1;
    assert.match(String(url), /vpic\.nhtsa\.dot\.gov\/api\/vehicles\/DecodeVinValues\//);
    assert.match(String(url), /modelyear=2003/);
    return new Response(JSON.stringify({
      Results: [{
        VIN: '1HGCM82633A004352',
        Make: 'HONDA',
        Model: 'Accord',
        ModelYear: '2003',
        VehicleType: 'PASSENGER CAR',
        BodyClass: 'Sedan/Saloon',
        ErrorCode: '0',
        UnreviewedProviderField: 'must not leave the server',
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const firstResponse = createResponse();
    const secondResponse = createResponse();
    await vin(authRequest({ vin: '1hgcm82633a004352', modelYear: '2003' }), firstResponse);
    await vin(authRequest({ vin: '1HGCM82633A004352', modelYear: '2003' }), secondResponse);

    assert.equal(firstResponse.statusCode, 200);
    assert.deepEqual(firstResponse.payload.vehicle, {
      vin: '1HGCM82633A004352',
      make: 'HONDA',
      model: 'Accord',
      modelYear: '2003',
      vehicleType: 'PASSENGER CAR',
      bodyClass: 'Sedan/Saloon',
      source: 'NHTSA vPIC',
      verifiedAt: firstResponse.payload.vehicle.verifiedAt,
    });
    assert.match(firstResponse.payload.vehicle.verifiedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(JSON.stringify(firstResponse.payload).includes('UnreviewedProviderField'), false);
    assert.equal(secondResponse.payload.vehicle.verifiedAt, firstResponse.payload.vehicle.verifiedAt);
    assert.equal(providerCalls, 1);
    assert.match(firstResponse.headers.get('cache-control'), /no-store/);
  } finally {
    globalThis.fetch = originalFetch;
    resetVehicleVinCacheForTests();
  }
});

test('VIN provider requests time out with a safe error code', async () => {
  const { decodeVehicleVin, resetVehicleVinCacheForTests } = await import('../server/vehicleVinShared.mjs');
  resetVehicleVinCacheForTests();
  const hangingFetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });

  await assert.rejects(
    () => decodeVehicleVin('1HGCM82633A004352', '2003', {
      fetchImplementation: hangingFetch,
      timeoutMs: 5,
    }),
    error => error?.code === 'VIN_PROVIDER_TIMEOUT',
  );
});

const loadCatalogSearchModule = async () => {
  const typescript = await import('typescript');
  const source = readText('src/catalogSearch.ts');
  const output = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ES2022,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
};

test('catalog search URL state is bounded, shareable, and preserves unrelated navigation state', async () => {
  const {
    mergeCatalogSearchParams,
    readCatalogSearchState,
  } = await loadCatalogSearchModule();
  const parsed = readCatalogSearchState(
    '?start=create&q=iphone&category=phone&brand=apple&model=iphone-15&year=9999&status=published',
  );

  assert.deepEqual(parsed, {
    query: 'iphone',
    categoryId: 'phone',
    brandId: 'apple',
    modelId: 'iphone-15',
    modelYear: null,
    status: 'published',
  });
  assert.equal(
    mergeCatalogSearchParams('?start=create&deal=ABC123', parsed),
    '?start=create&deal=ABC123&q=iphone&category=phone&brand=apple&model=iphone-15&status=published',
  );
});

test('catalog search uses structured facets instead of guessing identity from titles', async () => {
  const {
    emptyCatalogSearchState,
    filterCatalogDeals,
    getCatalogFacetOptions,
  } = await loadCatalogSearchModule();
  const base = {
    description: 'A sufficiently complete item description.',
    priceCents: 10000,
    currency: 'USD',
    condition: 'Good',
    deliveryMethod: 'Ship to buyer',
    status: 'published',
    sellerName: 'Seller',
    sellerVerification: 'not_started',
    agreementVersion: 1,
    createdAt: '2026-07-27T00:00:00Z',
  };
  const deals = [
    {
      ...base,
      id: 'phone',
      publicId: 'PHONE001',
      title: 'Apple iPhone 15 · 256 GB',
      catalog: {
        categoryId: 'phone',
        catalogVersion: '2026-07-24.1',
        brandId: 'apple',
        brandLabel: 'Apple',
        modelId: 'iphone-15',
        modelLabel: 'iPhone 15',
        variantId: '256-gb',
        variantLabel: '256 GB',
      },
    },
    {
      ...base,
      id: 'vehicle',
      publicId: 'CAR00001',
      title: '2021 BMW X5',
      catalog: {
        categoryId: 'vehicle',
        catalogVersion: '2026-07-24.1',
        brandId: 'bmw',
        brandLabel: 'BMW',
        modelId: 'x5',
        modelLabel: 'X5',
        modelYear: 2021,
      },
    },
    {
      ...base,
      id: 'legacy',
      publicId: 'LEGACY01',
      title: '2021 BMW X5',
      catalog: {
        categoryId: 'general',
        catalogVersion: 'legacy',
      },
    },
  ];
  const vehicleFilters = {
    ...emptyCatalogSearchState(),
    categoryId: 'vehicle',
    brandId: 'bmw',
    modelId: 'x5',
    modelYear: 2021,
  };

  assert.deepEqual(filterCatalogDeals(deals, vehicleFilters).map(deal => deal.id), ['vehicle']);
  assert.deepEqual(
    filterCatalogDeals(deals, { ...emptyCatalogSearchState(), query: 'apple 256' })
      .map(deal => deal.id),
    ['phone'],
  );
  const facets = getCatalogFacetOptions(deals, vehicleFilters);
  assert.deepEqual(facets.brands.map(option => option.id), ['bmw']);
  assert.deepEqual(facets.models.map(option => option.id), ['x5']);
  assert.deepEqual(facets.years.map(option => option.id), ['2021']);
});

test('private catalog filtering is rendered once for both dashboard and Watchlist and remains noindex', () => {
  const app = readText('src/app.tsx');
  const panel = readText('src/CatalogSearchPanel.tsx');
  const styles = readText('src/catalog-search.css');

  assert.match(app, /<CatalogSearchPanel deals=\{availableDeals\}/);
  assert.match(app, /<SavedDealsPanel items=\{filteredSavedDeals\}/);
  assert.match(app, /<EnhancedDashboard deals=\{filteredDeals\} allDeals=\{deals\}/);
  assert.match(app, /view==='home'&&isAuthenticated/);
  assert.match(app, /indexable:false/);
  assert.match(panel, /Filters stay in this URL/);
  assert.match(panel, /Choose category first/);
  assert.match(styles, /@media\(max-width:480px\)/);
});

test('active catalog release has verified ownership, evidence, source, metrics, and rollback controls', async () => {
  const pointer = readJson('catalog/active-release.json');
  const manifest = readJson(pointer.manifest);
  const { validateCatalogRelease } = await import('../scripts/validate-catalog-release.mjs');
  const report = validateCatalogRelease(rootPath);

  assert.equal(pointer.catalogVersion, manifest.catalogVersion);
  assert.equal(report.catalogVersion, pointer.catalogVersion);
  assert.equal(report.categoryCount, 8);
  assert.ok(report.brandCount > 0);
  assert.ok(report.modelCount > report.brandCount);
  assert.equal(report.sha256, manifest.dataset.sha256);
  assert.equal(manifest.ownership.businessOwner, 'Product Operations');
  assert.equal(manifest.ownership.technicalOwner, 'Engineering');
  assert.equal(manifest.ownership.riskReviewer, 'Trust & Safety');
  assert.equal(manifest.rollback.databaseRollbackRequired, false);
  assert.equal(manifest.rollback.preserveHistoricalDeals, true);
});

test('catalog adoption metrics are aggregate, admin-only, and exclude participant identifiers', () => {
  const migration = readText('supabase/catalog_governance_metrics.sql');
  const client = readText('src/services/supabaseRest.ts');
  const app = readText('src/app.tsx');

  assert.match(migration, /if not public\.is_dealsafe_admin\(\)/);
  assert.match(migration, /p_days not in \(7, 30, 90\)/);
  assert.match(migration, /group by deal\.catalog_version, deal\.category_id/);
  assert.match(migration, /revoke all on function public\.get_admin_catalog_adoption\(integer\) from public, anon/);
  assert.match(migration, /grant execute on function public\.get_admin_catalog_adoption\(integer\) to authenticated/);
  assert.doesNotMatch(migration, /returns table\([\s\S]*\bdeal_id\b/);
  assert.doesNotMatch(migration, /returns table\([\s\S]*\buser_id\b/);
  assert.doesNotMatch(migration, /returns table\([\s\S]*\bemail\b/);
  assert.match(client, /getAdminCatalogAdoption/);
  assert.match(app, /<AdminCatalogCenter session=\{session\}\/>/);
  assert.match(app, /Only aggregate version and category counts are returned/);
});

test('catalog governance validation is part of the full release gate', () => {
  const packageJson = readJson('package.json');
  const governance = readText('docs/production-readiness/12_CATALOG_GOVERNANCE.md');
  const readinessIndex = readText('docs/production-readiness/README.md');
  const adminStyles = readText('src/admin-catalog.css');

  assert.equal(packageJson.scripts['catalog:verify'], 'node scripts/validate-catalog-release.mjs');
  assert.match(packageJson.scripts.verify, /^npm run catalog:verify && /);
  assert.match(readinessIndex, /12_CATALOG_GOVERNANCE\.md/);
  assert.match(governance, /Rollback never rewrites `deals\.catalog_version`/);
  assert.match(governance, /Every guided category keeps a keyboard-accessible \*\*Not listed\*\* path/);
  assert.match(governance, /Deal ID, public ID, user ID, email, address/);
  assert.match(adminStyles, /@media \(max-width: 700px\)/);
  assert.match(adminStyles, /\.admin-catalog-grid\s*\{\s*grid-template-columns: 1fr;/);
});

test('account session inventory is current-user-only, minimal, and deny-by-default', () => {
  const migration = readText('supabase/account_session_security.sql');
  const hardening = readText('supabase/production_auth_rbac_hardening.sql');

  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /where auth\.uid\(\) is not null/);
  assert.match(migration, /sessions\.user_id = auth\.uid\(\)/);
  assert.match(migration, /auth\.jwt\(\) ->> 'session_id'/);
  assert.match(migration, /revoke all on function public\.get_my_account_sessions\(\) from public, anon/);
  assert.match(migration, /grant execute on function public\.get_my_account_sessions\(\) to authenticated/);
  assert.doesNotMatch(migration, /\bip\b/);
  assert.doesNotMatch(migration, /refresh_token/);
  assert.match(hardening, /'get_my_account_sessions'/);
});

test('session security UI separates current, other, and global sign-out actions', () => {
  const component = readText('src/AccountSessionSecurity.tsx');
  const client = readText('src/services/supabaseRest.ts');
  const styles = readText('src/session-security.css');
  const app = readText('src/app.tsx');
  const sessionStandard = readText('docs/production-readiness/13_SESSION_SECURITY.md');

  assert.match(client, /scope:SignOutScope='local'/);
  assert.match(client, /sessionForRemoteRevocation\(session\)/);
  assert.match(client, /revokeServerSession\(current\.accessToken,'others'\)/);
  assert.match(client, /revokeServerSession\(current\.accessToken,'global'\)/);
  assert.match(component, /Sign out other devices/);
  assert.match(component, /Sign out everywhere/);
  assert.match(component, /You will need to sign in again everywhere/);
  assert.match(component, /Review your account sessions without exposing location or IP information/);
  assert.match(app, /<AccountSessionSecurity session=\{session\}/);
  assert.match(styles, /@media\(max-width:720px\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /\.session-security-heading\{[^}]*height:auto;min-height:0/);
  assert.match(sessionStandard, /14_IMMEDIATE_SESSION_REVOCATION\.md/);
  assert.match(sessionStandard, /SEC-002 remains open until the required two-device negative authorization test/);
});

test('active-session lookup is minimal, owner-bound, and service-only for arbitrary identifiers', () => {
  const validation = readText('supabase/active_session_validation.sql');

  assert.match(validation, /security definer/g);
  assert.match(validation, /set search_path = ''/g);
  assert.match(validation, /active_session\.id = p_session_id/);
  assert.match(validation, /active_session\.user_id = p_user_id/);
  assert.match(validation, /active_session\.not_after is null[\s\S]*active_session\.not_after > now\(\)/);
  assert.match(validation, /request_user_id is distinct from auth\.uid\(\)/);
  assert.match(validation, /revoke all on function public\.is_auth_session_active_for_service\(uuid, uuid\)[\s\S]*from public, anon, authenticated/);
  assert.match(validation, /grant execute on function public\.is_auth_session_active_for_service\(uuid, uuid\)[\s\S]*to service_role/);
});

test('Data API and Storage require a currently active authenticated session with rollback', () => {
  const enforcement = readText('supabase/active_session_enforcement.sql');
  const rollback = readText('supabase/active_session_enforcement_rollback.sql');

  assert.match(enforcement, /request_role in \('', 'anon', 'service_role'\)/);
  assert.match(enforcement, /raise sqlstate 'PGRST'/);
  assert.match(enforcement, /'status', 401/);
  assert.match(enforcement, /set pgrst\.db_pre_request = 'public\.enforce_active_auth_session'/);
  assert.match(enforcement, /as restrictive[\s\S]*for all[\s\S]*to authenticated/);
  assert.match(enforcement, /select public\.is_current_auth_session_active\(\)/);
  assert.match(rollback, /reset pgrst\.db_pre_request/);
  assert.match(rollback, /drop policy if exists "authenticated sessions must be active"/);
  assert.match(rollback, /notify pgrst, 'reload config'/);
});

test('protected Edge Functions validate the Auth session row after JWT verification', () => {
  const common = readText('supabase/functions/_shared/common.ts');
  const config = readText('supabase/config.toml');

  assert.match(common, /admin\.auth\.getUser\(token\)/);
  assert.match(common, /claims\.session_id/);
  assert.match(common, /subject !== data\.user\.id/);
  assert.match(common, /role !== "authenticated"/);
  assert.match(common, /\.rpc\(\s*"is_auth_session_active_for_service"/);
  assert.match(common, /sessionActive !== true/);
  assert.match(common, /return \(await requireActiveUserSession\(request\)\)\.user/);
  assert.match(common, /session is invalid or expired\/i\.test\(message\)[\s\S]*\? 401/);
  assert.match(config, /\[functions\.stripe-webhook\][\s\S]*verify_jwt = false/);
});

test('immediate-session runbook covers every current request path and the remaining live test', () => {
  const standard = readText('docs/production-readiness/14_IMMEDIATE_SESSION_REVOCATION.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(standard, /Data API \(`\/rest\/v1`\)/);
  assert.match(standard, /Storage \(`\/storage\/v1`\)/);
  assert.match(standard, /Protected Stripe Edge Functions/);
  assert.match(standard, /Stripe webhook/);
  assert.match(standard, /Realtime \| Not used/);
  assert.match(standard, /two-device end-to-end test/);
  assert.match(standard, /active_session_enforcement_rollback\.sql/);
  assert.match(readinessIndex, /14_IMMEDIATE_SESSION_REVOCATION\.md/);
});

test('protected payment Edge Functions use an exact fail-closed browser origin boundary', () => {
  const common = readText('supabase/functions/_shared/common.ts');
  const protectedFunctions = [
    'stripe-connect',
    'stripe-create-checkout',
    'stripe-release-payment',
    'stripe-resolve-dispute',
  ];

  assert.doesNotMatch(common, /Access-Control-Allow-Origin["']?\s*:\s*["']\*/);
  assert.match(common, /request\.headers\.get\("Origin"\)/);
  assert.match(common, /value === "null"/);
  assert.match(common, /exactBrowserOrigins\(\)\.has\(parsed\.origin\)/);
  assert.match(common, /isOwnedVercelPreview\(parsed\)/);
  assert.match(common, /DEALIVRA_VERCEL_PROJECT_SLUG/);
  assert.match(common, /DEALIVRA_VERCEL_TEAM_SLUG/);
  assert.match(common, /requestedHeaders\.some\(\(header\) => !browserRequestHeaders\.has\(header\)\)/);
  assert.match(common, /Access-Control-Allow-Origin", origin/);
  assert.match(common, /"Vary": "Origin"/);

  for (const functionName of protectedFunctions) {
    const source = readText(`supabase/functions/${functionName}/index.ts`);
    assert.match(source, /handleBrowserRequest\(request/);
    assert.doesNotMatch(source, /corsHeaders/);
  }
});

test('Stripe webhook stays signature-authenticated and outside browser CORS', () => {
  const webhook = readText('supabase/functions/stripe-webhook/index.ts');
  const config = readText('supabase/config.toml');
  const originStandard = readText('docs/production-readiness/15_EDGE_ORIGIN_SECURITY.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(webhook, /verifyStripeSignature/);
  assert.match(webhook, /Stripe-Signature/);
  assert.doesNotMatch(webhook, /handleBrowserRequest/);
  assert.match(config, /\[functions\.stripe-webhook\][\s\S]*verify_jwt = false/);
  assert.match(originStandard, /The Stripe webhook is intentionally excluded/);
  assert.match(originStandard, /never return `Access-Control-Allow-Origin: \*`/);
  assert.match(originStandard, /future SEC-001 server-managed session architecture/);
  assert.match(readinessIndex, /15_EDGE_ORIGIN_SECURITY\.md/);
});

test('Stripe webhook claims and applies each provider event through one fenced transaction', () => {
  const webhook = readText('supabase/functions/stripe-webhook/index.ts');
  const migration = readText('supabase/stripe_webhook_replay_safety.sql');
  const standard = readText('docs/production-readiness/16_STRIPE_WEBHOOK_REPLAY_SAFETY.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(webhook, /\.rpc\("claim_stripe_webhook_event"/);
  assert.match(webhook, /\.rpc\("apply_stripe_webhook_event"/);
  assert.match(webhook, /\.rpc\("fail_stripe_webhook_event"/);
  assert.match(webhook, /difference \|= signature\.charCodeAt\(index\) \^ expected\.charCodeAt\(index\)/);
  assert.match(webhook, /maxWebhookBytes = 262_144/);
  assert.match(webhook, /contentLength > maxWebhookBytes/);
  assert.match(webhook, /Number\.isSafeInteger\(timestampNumber\)/);
  assert.doesNotMatch(webhook, /\.from\("stripe_webhook_events"\)/);
  assert.doesNotMatch(webhook, /\.from\("protected_payments"\)/);
  assert.doesNotMatch(webhook, /\.from\("audit_events"\)/);
  assert.match(webhook, /if \(event\.livemode\) return webhookError\(400\)/);
  assert.match(webhook, /messages\[code\] \|\| "The payment was not completed/);
  assert.doesNotMatch(webhook, /last_payment_error\?\.message/);

  assert.match(migration, /for update/g);
  assert.match(migration, /claim_token uuid/);
  assert.match(migration, /v_event\.claim_token is distinct from p_claim_token/);
  assert.match(migration, /v_event\.claimed_at >= now\(\) - make_interval/);
  assert.match(migration, /on conflict \(id\) do nothing/);
  assert.match(migration, /stripe_webhook_events_payment_id_idx/);
  assert.match(migration, /payment_reference_not_found/);
  assert.match(migration, /payment_identifier_mismatch/);
  assert.match(migration, /v_event\.stripe_created_at >= v_state_time/);
  assert.match(migration, /v_previous_status <> 'refunded'/);
  assert.match(migration, /p_event_type = 'charge\.refunded'/);
  assert.match(migration, /status = 'processed'[\s\S]*processed_at = now\(\)/);
  assert.match(migration, /revoke all on function public\.claim_stripe_webhook_event[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.apply_stripe_webhook_event[\s\S]*to service_role/);

  assert.match(standard, /random fencing token/);
  assert.match(standard, /raw\s+provider errors are not stored/);
  assert.match(readinessIndex, /16_STRIPE_WEBHOOK_REPLAY_SAFETY\.md/);
});

test('trusted payment commands freeze financial snapshots and fence every provider action', () => {
  const migration = readText('supabase/stripe_trusted_payment_commands.sql');
  const rollbackTests = readText('supabase/tests/stripe_trusted_payment_commands_rollback.sql');
  const checkout = readText('supabase/functions/stripe-create-checkout/index.ts');
  const release = readText('supabase/functions/stripe-release-payment/index.ts');
  const dispute = readText('supabase/functions/stripe-resolve-dispute/index.ts');
  const verification = readText('supabase/functions/_shared/financial.ts');
  const app = readText('src/app.tsx');
  const client = readText('src/services/supabaseRest.ts');
  const standard = readText('docs/production-readiness/17_TRUSTED_PAYMENT_COMMANDS.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(migration, /create table if not exists public\.stripe_financial_commands/);
  assert.match(migration, /alter table public\.stripe_financial_commands enable row level security/);
  assert.match(migration, /revoke all on table public\.stripe_financial_commands from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.stripe_financial_commands to service_role/);
  assert.match(migration, /create or replace function public\.prepare_stripe_checkout/);
  assert.match(migration, /create or replace function public\.prepare_stripe_financial_command/);
  assert.match(migration, /create or replace function public\.finalize_stripe_financial_command/);
  assert.match(migration, /create or replace function public\.fail_stripe_financial_command/);
  assert.match(migration, /for update/g);
  assert.match(migration, /checkout_snapshot_conflict/);
  assert.match(migration, /payment_snapshot_mismatch/);
  assert.match(migration, /illegal_payment_transition/);
  assert.match(migration, /v_command\.claim_token is distinct from p_claim_token/);
  assert.match(migration, /app_role <> 'admin' or not v_actor\.is_admin/);
  assert.match(migration, /revoke all on function public\.prepare_stripe_financial_command[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.finalize_stripe_financial_command[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /raw_provider/);

  assert.match(rollbackTests, /concurrent checkout reservation was not fenced/);
  assert.match(rollbackTests, /stale release worker finalized the payment/);
  assert.match(rollbackTests, /amount mismatch was accepted/);
  assert.match(rollbackTests, /currency mismatch was accepted/);
  assert.match(rollbackTests, /seller account mismatch was accepted/);
  assert.match(rollbackTests, /illegal payment transition was accepted/);
  assert.match(rollbackTests, /refund did not atomically resolve payment, dispute, and deal/);

  assert.match(checkout, /\.rpc\("prepare_stripe_checkout"/);
  assert.match(checkout, /\.rpc\(\s*"attach_stripe_checkout_session"/);
  assert.match(checkout, /DEALIVRA_PLATFORM_FEE_VERSION/);
  assert.match(checkout, /dealivra_payment_id: reservation\.paymentId/);
  assert.doesNotMatch(checkout, /\.upsert\(/);
  assert.doesNotMatch(checkout, /\.from\("protected_payments"\)/);
  assert.doesNotMatch(checkout, /\.from\("audit_events"\)/);

  for (const source of [release, dispute]) {
    assert.match(source, /\.rpc\(\s*"prepare_stripe_financial_command"/);
    assert.match(source, /verifyTrustedStripePayment/);
    assert.match(source, /\.rpc\(\s*"finalize_stripe_financial_command"/);
    assert.match(source, /\.rpc\("fail_stripe_financial_command"/);
    assert.doesNotMatch(source, /\.from\("protected_payments"\)/);
    assert.doesNotMatch(source, /\.from\("audit_events"\)/);
  }

  assert.match(verification, /intent\.amount_received !== command\.itemAmountCents/);
  assert.match(verification, /intent\.transfer_group !== command\.transferGroup/);
  assert.match(verification, /account\.id !== command\.sellerStripeAccountId/);
  assert.match(verification, /metadata\.dealivra_payment_id === command\.paymentId/);
  assert.doesNotMatch(app, /Release funds to seller/);
  assert.doesNotMatch(app, /releaseProtectedPayment/);
  assert.doesNotMatch(client, /releaseProtectedPayment/);
  assert.match(app, /waiting for Dealivra operations review/);
  assert.match(standard, /provider-success\/recording-uncertain/);
  assert.match(readinessIndex, /17_TRUSTED_PAYMENT_COMMANDS\.md/);
});

test('Stripe webhook rejects untrusted financial event fields before state transition', () => {
  const webhook = readText('supabase/functions/stripe-webhook/index.ts');
  const migration = readText('supabase/stripe_webhook_replay_safety.sql');

  assert.match(webhook, /p_amount_cents: refs\.amountCents/);
  assert.match(webhook, /p_currency: refs\.currency/);
  assert.match(webhook, /p_transfer_group: refs\.transferGroup/);
  assert.match(webhook, /p_metadata_payment_id: refs\.metadataPaymentId/);
  assert.match(webhook, /event\.type === "charge\.refunded"[\s\S]*object\.amount_refunded/);
  assert.match(webhook, /event\.type === "charge\.dispute\.created"[\s\S]*object\.charge/);

  assert.match(migration, /payment_amount_mismatch/);
  assert.match(migration, /payment_currency_mismatch/);
  assert.match(migration, /payment_snapshot_mismatch/);
  assert.match(migration, /payment_metadata_incomplete/);
  assert.match(migration, /payment_transfer_group_mismatch/);
  assert.match(migration, /p_event_type = 'charge\.dispute\.created'[\s\S]*p_amount_cents > v_payment\.item_amount_cents/);
  assert.match(migration, /v_payment\.fee_version <> 'legacy_v1'/);
});
