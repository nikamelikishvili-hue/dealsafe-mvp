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
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = 'https://project.example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

  const response = {
    statusCode: 200,
    headers: new Map(),
    payload: undefined,
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
    end() { return this; },
  };

  globalThis.fetch = async () => new Response(JSON.stringify({
    access_token: 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature',
    refresh_token: 'server-only-refresh-secret',
    expires_in: 3600,
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'user@example.com',
      email_confirmed_at: '2026-07-26T00:00:00Z',
      user_metadata: { display_name: 'Test User' },
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    await login({
      method: 'POST',
      headers: { origin: 'https://dealivra.test', host: 'dealivra.test' },
      body: { email: 'user@example.com', password: 'ExamplePass123' },
    }, response);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  }

  assert.equal(response.statusCode, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(JSON.stringify(response.payload).includes('server-only-refresh-secret'), false);
  assert.equal(response.payload.access_token.startsWith('header.'), true);
});
