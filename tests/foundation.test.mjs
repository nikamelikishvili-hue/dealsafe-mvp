import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import cspReportHandler from '../api/security/csp-report.mjs';

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
const cspRequest = (body, contentType = 'application/csp-report', method = 'POST') => ({
  method,
  headers: {
    'content-type': contentType,
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
const authProviderSession = (refreshToken, options = {}) => ({
  access_token: `header.${Buffer.from(JSON.stringify({
    exp: options.exp ?? 4102444800,
    iat: options.iat ?? Math.floor(Date.now() / 1000),
    ...(options.sub ? { sub: options.sub } : {}),
    ...(options.role ? { role: options.role } : {}),
    ...(options.aal ? { aal: options.aal } : {}),
    ...(options.amr ? { amr: options.amr } : {}),
  })).toString('base64url')}.signature`,
  refresh_token: refreshToken,
  expires_in: 3600,
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'user@example.com',
    email_confirmed_at: '2026-07-26T00:00:00Z',
    user_metadata: { display_name: 'Test User' },
    factors: options.factors ?? [],
  },
});
const withAuthProvider = async (fetchImplementation, callback) => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const originalForwardingMode = process.env.DEALIVRA_AUTH_IP_FORWARDING_MODE;
  const originalAuthSecretKey = process.env.SUPABASE_AUTH_SECRET_KEY;
  const originalCurrentPasswordMode = process.env.DEALIVRA_CURRENT_PASSWORD_MODE;
  process.env.SUPABASE_URL = '  https://project.example.supabase.co/  ';
  process.env.SUPABASE_PUBLISHABLE_KEY = '  sb_publishable_\n test  ';
  process.env.DEALIVRA_AUTH_IP_FORWARDING_MODE = 'disabled';
  process.env.DEALIVRA_CURRENT_PASSWORD_MODE = 'staged';
  delete process.env.SUPABASE_AUTH_SECRET_KEY;
  globalThis.fetch = fetchImplementation;

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
    if (originalForwardingMode === undefined) {
      delete process.env.DEALIVRA_AUTH_IP_FORWARDING_MODE;
    } else {
      process.env.DEALIVRA_AUTH_IP_FORWARDING_MODE = originalForwardingMode;
    }
    if (originalAuthSecretKey === undefined) delete process.env.SUPABASE_AUTH_SECRET_KEY;
    else process.env.SUPABASE_AUTH_SECRET_KEY = originalAuthSecretKey;
    if (originalCurrentPasswordMode === undefined) {
      delete process.env.DEALIVRA_CURRENT_PASSWORD_MODE;
    } else {
      process.env.DEALIVRA_CURRENT_PASSWORD_MODE = originalCurrentPasswordMode;
    }
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
    'reporting-endpoints',
    'x-permitted-cross-domain-policies',
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
    'report-uri /api/security/csp-report',
    'report-to csp-endpoint',
  ]) {
    assert.ok(csp.includes(directive), `CSP must contain ${directive}`);
  }

  const scriptPolicy = csp.match(/script-src[^;]*/)?.[0] ?? '';
  assert.equal(scriptPolicy.includes("'unsafe-inline'"), false);
  assert.equal(values.get('reporting-endpoints'), 'csp-endpoint="/api/security/csp-report"');
  assert.equal(values.get('x-permitted-cross-domain-policies'), 'none');

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
          type: 'host',
          value: 'dealsafe-mvp.vercel.app',
        },
      ],
      destination: 'https://dealsafe-mvp-nika13.vercel.app/:path*',
      permanent: false,
    },
  ]);
});

test('CSP report endpoint fails safely for invalid request shapes', async () => {
  const methodResponse = createResponse();
  await cspReportHandler(cspRequest({}, 'application/csp-report', 'GET'), methodResponse);
  assert.equal(methodResponse.statusCode, 405);
  assert.equal(methodResponse.headers.get('allow'), 'POST');

  const contentTypeResponse = createResponse();
  await cspReportHandler(cspRequest({}, 'text/plain'), contentTypeResponse);
  assert.equal(contentTypeResponse.statusCode, 415);

  const invalidResponse = createResponse();
  await cspReportHandler(cspRequest('{invalid'), invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);

  const oversizedResponse = createResponse();
  await cspReportHandler(
    cspRequest('x'.repeat(16_385), 'application/reports+json'),
    oversizedResponse,
  );
  assert.equal(oversizedResponse.statusCode, 413);
  assert.equal(oversizedResponse.headers.get('cache-control'), 'no-store, max-age=0');
});

test('CSP report endpoint records only bounded privacy-safe diagnostics', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = value => warnings.push(String(value));

  try {
    const legacyResponse = createResponse();
    await cspReportHandler(cspRequest({
      'csp-report': {
        'document-uri': 'https://dealivra.com/deals/550e8400-e29b-41d4-a716-446655440000?token=secret#details',
        'blocked-uri': 'https://evil.example/payload.js?account=user@example.com',
        'source-file': 'https://dealivra.com/assets/app.js?v=private',
        'effective-directive': 'script-src-elem',
        'violated-directive': "script-src 'self'",
        disposition: 'enforce',
        'status-code': 200,
        'line-number': 12,
        'column-number': 8,
        sample: 'document.cookie',
        referrer: 'https://private.example/user@example.com',
        'original-policy': 'secret-policy',
      },
    }), legacyResponse);
    assert.equal(legacyResponse.statusCode, 204);
    assert.equal(legacyResponse.ended, true);

    const modernResponse = createResponse();
    await cspReportHandler(cspRequest([{
      type: 'csp-violation',
      body: {
        documentURL: 'https://dealivra.com/account/123456789?session=secret',
        blockedURL: 'inline',
        effectiveDirective: 'style-src-elem',
        disposition: 'enforce',
        sample: 'private inline style',
      },
    }], 'application/reports+json'), modernResponse);
    assert.equal(modernResponse.statusCode, 204);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warnings.length, 2);
  const combined = warnings.join('\n');
  assert.doesNotMatch(combined, /token=|session=|document\.cookie|private inline|user@example|secret-policy/);
  assert.doesNotMatch(combined, /original.policy|referrer|sample/i);

  const legacyLog = JSON.parse(warnings[0]);
  assert.equal(legacyLog.schema, 'dealivra.csp-violation.v1');
  assert.equal(legacyLog.document_url, 'https://dealivra.com/deals/:id');
  assert.equal(legacyLog.blocked_url, 'https://evil.example/payload.js');
  assert.equal(legacyLog.source_url, 'https://dealivra.com/assets/app.js');
  assert.equal(legacyLog.effective_directive, 'script-src-elem');

  const modernLog = JSON.parse(warnings[1]);
  assert.equal(modernLog.document_url, 'https://dealivra.com/account/:id');
  assert.equal(modernLog.blocked_url, 'inline');
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
    '17_TRUSTED_PAYMENT_COMMANDS.md',
    '18_PAYMENT_PROVIDER_OBSERVABILITY.md',
    '19_SECURITY_DEFINER_GOVERNANCE.md',
    '20_AUTH_PASSWORD_SECURITY.md',
    '21_AUTHENTICATED_RPC_MATRIX.md',
    '22_RLS_POLICY_PERFORMANCE.md',
    '23_FOREIGN_KEY_INDEX_GOVERNANCE.md',
    '24_IMMUTABLE_AUDIT_EVENTS.md',
    '25_EVIDENCE_FILE_SECURITY.md',
    '26_EVIDENCE_INTEGRITY_VIEWER.md',
    '27_EVIDENCE_LIFECYCLE_GOVERNANCE.md',
    '28_MFA_AND_PRIVILEGED_STEP_UP.md',
    '29_CSP_REPORTING_AND_BROWSER_HEADERS.md',
    '30_PRIVILEGED_MFA_ROLLOUT_EVIDENCE.md',
    '31_PRIVILEGED_MFA_RECOVERY_CONTROL.md',
    '32_MFA_PASSWORD_ONLY_NEGATIVE_MATRIX.md',
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

test('evidence lifecycle deletion is review-gated, hold-aware, and Storage-verified', () => {
  const migration = readText('supabase/evidence_lifecycle_governance.sql');
  const worker = readText('supabase/functions/evidence-maintenance/index.ts');
  const viewerEndpoint = readText('supabase/functions/evidence-files/index.ts');
  const functionConfig = readText('supabase/config.toml');
  const adminCenter = readText('src/EvidenceLifecycleCenter.tsx');

  assert.match(migration, /status\s*=\s*'pending_review'/);
  assert.match(migration, /approve_evidence_deletion/);
  assert.match(migration, /evidence_has_active_legal_hold/);
  assert.match(migration, /dispute\.status in \('open', 'evidence_requested', 'under_review'\)/);
  assert.match(migration, /vault\.create_secret/);
  assert.match(migration, /dealivra-evidence-lifecycle-inventory/);
  assert.match(migration, /dealivra-evidence-maintenance-worker/);
  assert.match(migration, /revoke update, delete, truncate, trigger[\s\S]*evidence_lifecycle_events/);
  assert.match(migration, /with \(security_invoker = true, security_barrier = true\)/);

  assert.match(functionConfig, /\[functions\.evidence-maintenance\][\s\S]*verify_jwt = false/);
  assert.match(worker, /x-dealivra-maintenance-secret/);
  assert.match(worker, /claim_evidence_maintenance_jobs/);
  assert.match(worker, /requireUser\(request\)/);
  assert.match(worker, /requireOperator\(userId\)/);
  assert.doesNotMatch(worker, /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']+/);

  const removalIndex = worker.indexOf('.remove([job.storage_path])');
  const absenceCheckIndex = worker.indexOf('.download(job.storage_path)', removalIndex);
  const completionIndex = worker.indexOf('"complete_evidence_maintenance_job"', absenceCheckIndex);
  assert.ok(removalIndex >= 0, 'Worker must delete with the Storage API');
  assert.ok(absenceCheckIndex > removalIndex, 'Worker must verify absence after Storage removal');
  assert.ok(completionIndex > absenceCheckIndex, 'Metadata completion must happen after absence verification');

  assert.match(viewerEndpoint, /evidence\.lifecycle_status !== "retained"/);
  assert.match(adminCenter, /Evidence lifecycle center/);
  assert.doesNotMatch(adminCenter, /storage_path|maintenance_secret|scan_reference/);
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

test('password login with a verified TOTP factor stays pending until AAL2 verification', async () => {
  const { default: login } = await import('../api/auth/login.mjs');
  const response = createResponse();
  const factor = {
    id: '11111111-1111-4111-8111-111111111111',
    factor_type: 'totp',
    status: 'verified',
    friendly_name: 'Primary authenticator',
    created_at: '2026-07-28T00:00:00Z',
    updated_at: '2026-07-28T00:00:00Z',
  };

  await withAuthProvider(async () => new Response(JSON.stringify(
    authProviderSession('must-not-reach-browser', { aal: 'aal1', factors: [factor] }),
  ), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }), () => login(authRequest({
    email: 'user@example.com',
    password: 'ExamplePass123!',
  }), response));

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.mfa_required, true);
  assert.equal(response.payload.factors[0].id, factor.id);
  assert.equal(response.payload.factors[0].friendlyName, 'Primary authenticator');
  assert.equal(response.payload.pending_access_token.startsWith('header.'), true);
  assert.equal(JSON.stringify(response.payload).includes('must-not-reach-browser'), false);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

test('password login fails closed for a verified factor the app cannot challenge', async () => {
  const { default: login } = await import('../api/auth/login.mjs');
  const response = createResponse();
  const unsupportedFactor = {
    id: '11111111-1111-4111-8111-111111111111',
    factor_type: 'phone',
    status: 'verified',
  };

  await withAuthProvider(async () => new Response(JSON.stringify(
    authProviderSession('must-not-be-issued', {
      aal: 'aal1',
      factors: [unsupportedFactor],
    }),
  ), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }), () => login(authRequest({
    email: 'user@example.com',
    password: 'ExamplePass123!',
  }), response));

  assert.equal(response.statusCode, 403);
  assert.match(response.payload.error, /unsupported authenticator method/);
  assert.equal(JSON.stringify(response.payload).includes('must-not-be-issued'), false);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

test('MFA challenge verification promotes the session and keeps its refresh token HttpOnly', async () => {
  const { default: mfa } = await import('../api/auth/mfa.mjs');
  const response = createResponse();
  const factorId = '11111111-1111-4111-8111-111111111111';
  const requested = [];

  await withAuthProvider(async (url, init) => {
    requested.push({
      url: String(url),
      body: init.body ? JSON.parse(init.body) : null,
    });
    if (String(url).endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        factors: [{
          id: factorId,
          factor_type: 'totp',
          status: 'verified',
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (String(url).endsWith(`/factors/${factorId}/challenge`)) {
      return new Response(JSON.stringify({ id: '22222222-2222-4222-8222-222222222222' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(authProviderSession('verified-refresh-secret', {
      aal: 'aal2',
    })), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, () => mfa(authRequest({
    action: 'challenge_and_verify',
    purpose: 'login',
    factorId,
    code: '123456',
  }, {
    authorization: 'Bearer pending-aal1-token',
  }), response));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(requested.map(item => item.url), [
    'https://project.example.supabase.co/auth/v1/user',
    `https://project.example.supabase.co/auth/v1/factors/${factorId}/challenge`,
    `https://project.example.supabase.co/auth/v1/factors/${factorId}/verify`,
  ]);
  assert.deepEqual(requested[2].body, {
    challenge_id: '22222222-2222-4222-8222-222222222222',
    code: '123456',
  });
  assert.match(response.headers.get('set-cookie'), /verified-refresh-secret/);
  assert.equal(JSON.stringify(response.payload).includes('verified-refresh-secret'), false);
});

test('MFA endpoint validates action inputs before contacting the provider', async () => {
  const { default: mfa } = await import('../api/auth/mfa.mjs');
  const response = createResponse();
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('Provider must not be called.');
  }, () => mfa(authRequest({
    action: 'challenge_and_verify',
    factorId: 'not-a-factor',
    code: '12ab',
  }, {
    authorization: 'Bearer pending-token',
  }), response));

  assert.equal(response.statusCode, 400);
  assert.equal(providerCalled, false);
  assert.equal(response.payload.error, 'The authenticator request is invalid.');
});

test('privileged MFA removal preserves the two-authenticator floor', async () => {
  const { default: mfa } = await import('../api/auth/mfa.mjs');
  const response = createResponse();
  const factorId = '11111111-1111-4111-8111-111111111111';
  const factors = [
    {
      id: factorId,
      factor_type: 'totp',
      status: 'verified',
      friendly_name: 'Primary authenticator',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      factor_type: 'totp',
      status: 'verified',
      friendly_name: 'Backup authenticator',
    },
  ];
  const requested = [];
  const accessToken = authProviderSession('unused', {
    aal: 'aal2',
    amr: [{
      method: 'totp',
      timestamp: Math.floor(Date.now() / 1000),
    }],
    factors,
  }).access_token;

  await withAuthProvider(async (url, init) => {
    requested.push({ url: String(url), method: init.method });
    if (String(url).endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        factors,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (String(url).endsWith('/rest/v1/rpc/current_user_app_role')) {
      return new Response(JSON.stringify('admin'), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error('The factor delete request must not be sent.');
  }, () => mfa(authRequest({
    action: 'unenroll',
    factorId,
  }, {
    authorization: `Bearer ${accessToken}`,
  }), response));

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.error, /Add and verify another authenticator/);
  assert.deepEqual(requested.map(item => item.url), [
    'https://project.example.supabase.co/auth/v1/user',
    'https://project.example.supabase.co/rest/v1/rpc/current_user_app_role',
  ]);
});

test('token refresh cannot replace recent TOTP verification for MFA removal', async () => {
  const { default: mfa } = await import('../api/auth/mfa.mjs');
  const response = createResponse();
  const factorId = '11111111-1111-4111-8111-111111111111';
  const currentTime = Math.floor(Date.now() / 1000);
  const factors = [{
    id: factorId,
    factor_type: 'totp',
    status: 'verified',
    friendly_name: 'Primary authenticator',
  }];
  const accessToken = authProviderSession('unused', {
    aal: 'aal2',
    factors,
    iat: currentTime,
    amr: [
      { method: 'totp', timestamp: currentTime - (11 * 60) },
      { method: 'token_refresh', timestamp: currentTime },
    ],
  }).access_token;
  let providerCalls = 0;

  await withAuthProvider(async (url) => {
    providerCalls += 1;
    assert.equal(String(url), 'https://project.example.supabase.co/auth/v1/user');
    return new Response(JSON.stringify({
      id: '00000000-0000-0000-0000-000000000001',
      factors,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, () => mfa(authRequest({
    action: 'unenroll',
    factorId,
  }, {
    authorization: `Bearer ${accessToken}`,
  }), response));

  assert.equal(response.statusCode, 403);
  assert.match(response.payload.error, /Sign in again and verify/);
  assert.equal(providerCalls, 1);
});

test('unfinished MFA enrollment cancellation cannot remove a verified factor', async () => {
  const { default: mfa } = await import('../api/auth/mfa.mjs');
  const response = createResponse();
  const factorId = '11111111-1111-4111-8111-111111111111';
  let providerCalls = 0;

  await withAuthProvider(async (url) => {
    providerCalls += 1;
    assert.equal(String(url), 'https://project.example.supabase.co/auth/v1/user');
    return new Response(JSON.stringify({
      id: '00000000-0000-0000-0000-000000000001',
      factors: [{
        id: factorId,
        factor_type: 'totp',
        status: 'verified',
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, () => mfa(authRequest({
    action: 'cancel_enrollment',
    factorId,
  }, {
    authorization: 'Bearer existing-session',
  }), response));

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.error, /Only an unfinished authenticator setup/);
  assert.equal(providerCalls, 1);
});

test('account MFA removal performs fresh step-up before factor deletion', () => {
  const accountMfa = readText('src/AccountMfaSecurity.tsx');
  const client = readText('src/services/supabaseRest.ts');
  const styles = readText('src/mfa-step-up.css');

  assert.match(client, /export async function verifyMfaStepUp/);
  assert.match(client, /action:'challenge_and_verify'[\s\S]*purpose:'login'/);
  assert.match(client, /verifyMfaFactor\(session,factorId,code,'enrollment'\)/);
  assert.match(client, /verifyMfaFactor\(session,factorId,code,'step_up'\)/);
  assert.match(
    accountMfa,
    /await verifyMfaStepUp\([\s\S]*await unenrollMfaFactor\(verifiedSession,confirmRemove\)/,
  );
  assert.match(accountMfa, /autoComplete="one-time-code"/);
  assert.match(accountMfa, /role="region"[\s\S]*aria-labelledby="mfa-remove-title"/);
  assert.match(accountMfa, /factor\.id!==factorId/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /max-width: 430px/);
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
    password: 'ExamplePass123!',
  }, {
    origin: 'https://attacker.example',
  }), response));

  assert.equal(response.statusCode, 403);
  assert.equal(response.payload.error, 'Cross-origin authentication is not allowed.');
  assert.equal(providerCalled, false);
});

test('signup validates password strength before contacting the auth provider', async () => {
  const { default: signup } = await import('../api/auth/signup.mjs');
  let providerCalled = false;

  for (const password of ['weak', 'ExamplePass123']) {
    const response = createResponse();
    await withAuthProvider(async () => {
      providerCalled = true;
      throw new Error('The provider must not be called.');
    }, () => signup(authRequest({
      displayName: 'Test User',
      email: 'user@example.com',
      password,
    }), response));

    assert.equal(response.statusCode, 400);
    assert.match(response.payload.error, /12\+ characters/);
    assert.match(response.payload.error, /symbol/);
  }
  assert.equal(providerCalled, false);
});

test('signup rejection gives recovery guidance without exposing account existence', async () => {
  const { default: signup } = await import('../api/auth/signup.mjs');
  const response = createResponse();

  await withAuthProvider(async () => new Response(JSON.stringify({
    code: 'user_already_exists',
    message: 'Sensitive provider detail must not reach the browser.',
  }), {
    status: 422,
    headers: { 'Content-Type': 'application/json' },
  }), () => signup(authRequest({
    displayName: 'Test User',
    email: 'user@example.com',
    password: 'ExamplePass123!',
  }), response));

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.error, /sign in or choose Forgot password/);
  assert.doesNotMatch(response.payload.error, /already exists|Sensitive provider detail/);
});

test('signup preserves provider throttling as an actionable retry response', async () => {
  const { default: signup } = await import('../api/auth/signup.mjs');
  const response = createResponse();

  await withAuthProvider(async () => new Response(JSON.stringify({
    code: 'over_email_send_rate_limit',
  }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  }), () => signup(authRequest({
    displayName: 'Test User',
    email: 'user@example.com',
    password: 'ExamplePass123!',
  }), response));

  assert.equal(response.statusCode, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(response.payload.retryAfter, 60);
  assert.match(response.payload.error, /Wait at least one minute/);
  assert.match(response.payload.error, /reset your password/);
});

test('password recovery stays same-origin and does not reveal account existence', async () => {
  const { default: recover } = await import('../api/auth/recover.mjs');
  const response = createResponse();
  let providerUrl = '';
  let providerBody = null;

  await withAuthProvider(async (url, init) => {
    providerUrl = String(url);
    providerBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      code: 'user_not_found',
      message: 'Sensitive provider detail must not reach the browser.',
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }, () => recover(authRequest({
    email: 'USER@example.com',
  }), response));

  assert.equal(response.statusCode, 202);
  assert.match(response.payload.message, /If an account exists/);
  assert.doesNotMatch(response.payload.message, /user_not_found|Sensitive provider detail/);
  assert.match(providerUrl, /\/auth\/v1\/recover\?redirect_to=https%3A%2F%2Fdealivra\.test$/);
  assert.deepEqual(providerBody, { email: 'user@example.com' });
});

test('password recovery rejects cross-origin abuse before contacting the provider', async () => {
  const { default: recover } = await import('../api/auth/recover.mjs');
  const response = createResponse();
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  }, () => recover(authRequest({
    email: 'user@example.com',
  }, {
    origin: 'https://attacker.example',
  }), response));

  assert.equal(response.statusCode, 403);
  assert.equal(providerCalled, false);
});

test('password recovery and sign-in preserve bounded provider retry guidance', async () => {
  const { default: recover } = await import('../api/auth/recover.mjs');
  const { default: login } = await import('../api/auth/login.mjs');

  for (const [handler, body] of [
    [recover, { email: 'user@example.com' }],
    [login, { email: 'user@example.com', password: 'ExamplePass123!' }],
  ]) {
    const response = createResponse();
    await withAuthProvider(async () => new Response(JSON.stringify({
      code: 'over_request_rate_limit',
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '999999',
      },
    }), () => handler(authRequest(body), response));

    assert.equal(response.statusCode, 429);
    assert.equal(response.headers.get('retry-after'), '300');
    assert.equal(response.payload.retryAfter, 300);
    assert.match(response.payload.error, /Wait at least one minute/);
  }
});

test('Auth proxy IP forwarding is disabled by default and never trusts an inbound address silently', async () => {
  const { supabaseAuthRequest } = await import('../server/authShared.mjs');
  let providerHeaders;

  await withAuthProvider(async (_input, init) => {
    providerHeaders = init.headers;
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, () => supabaseAuthRequest('token?grant_type=password', {
    method: 'POST',
    body: '{}',
  }, authRequest({}, {
    'x-vercel-forwarded-for': '198.51.100.24',
  })));

  assert.equal(providerHeaders.apikey, 'sb_publishable_test');
  assert.equal('Sb-Forwarded-For' in providerHeaders, false);
});

test('enforced Auth proxy forwarding uses only the server secret and exact Vercel client IP', async () => {
  const { supabaseAuthRequest } = await import('../server/authShared.mjs');
  const secretKey = ['sb', 'secret', 'X'.repeat(32)].join('_');
  let providerHeaders;

  await withAuthProvider(async (_input, init) => {
    providerHeaders = init.headers;
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, async () => {
    process.env.DEALIVRA_AUTH_IP_FORWARDING_MODE = 'enforced';
    process.env.SUPABASE_AUTH_SECRET_KEY = secretKey;
    await supabaseAuthRequest('token?grant_type=password', {
      method: 'POST',
      headers: {
        apikey: 'untrusted-override',
        'Sb-Forwarded-For': '203.0.113.9',
      },
      body: '{}',
    }, authRequest({}, {
      'x-vercel-forwarded-for': '198.51.100.24',
    }));
  });

  assert.equal(providerHeaders.apikey, secretKey);
  assert.equal(providerHeaders['Sb-Forwarded-For'], '198.51.100.24');
  assert.equal('Authorization' in providerHeaders, false);
});

test('enforced Auth proxy forwarding fails closed for missing or ambiguous client IPs', async () => {
  const { supabaseAuthRequest } = await import('../server/authShared.mjs');
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  }, async () => {
    process.env.DEALIVRA_AUTH_IP_FORWARDING_MODE = 'enforced';
    process.env.SUPABASE_AUTH_SECRET_KEY = ['sb', 'secret', 'Y'.repeat(32)].join('_');

    for (const forwardedIp of [undefined, '198.51.100.24, 203.0.113.8', 'not-an-ip']) {
      const headers = forwardedIp === undefined
        ? {}
        : { 'x-vercel-forwarded-for': forwardedIp };
      await assert.rejects(
        () => supabaseAuthRequest('token?grant_type=password', {
          method: 'POST',
          body: '{}',
        }, authRequest({}, headers)),
        /client address could not be verified/,
      );
    }
  });

  assert.equal(providerCalled, false);
});

test('session refresh and MFA preserve provider throttling without destroying the current session', async () => {
  const { default: refresh } = await import('../api/auth/refresh.mjs');
  const { default: mfa } = await import('../api/auth/mfa.mjs');
  const refreshResponse = createResponse();

  await withAuthProvider(async () => new Response(JSON.stringify({
    code: 'over_request_rate_limit',
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '30',
    },
  }), () => refresh(authRequest({}, {
    cookie: '__Host-dealivra-refresh=current-secret',
  }), refreshResponse));

  assert.equal(refreshResponse.statusCode, 429);
  assert.equal(refreshResponse.headers.get('retry-after'), '30');
  assert.equal(refreshResponse.headers.has('set-cookie'), false);

  const mfaResponse = createResponse();
  let providerCall = 0;
  await withAuthProvider(async () => {
    providerCall += 1;
    if (providerCall === 1) {
      return new Response(JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        factors: [{
          id: '11111111-1111-4111-8111-111111111111',
          factor_type: 'totp',
          status: 'verified',
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      code: 'over_request_rate_limit',
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '45',
      },
    });
  }, () => mfa(authRequest({
    action: 'challenge_and_verify',
    factorId: '11111111-1111-4111-8111-111111111111',
    code: '123456',
    purpose: 'login',
  }, {
    authorization: 'Bearer pending-mfa-token',
  }), mfaResponse));

  assert.equal(mfaResponse.statusCode, 429);
  assert.equal(mfaResponse.headers.get('retry-after'), '45');
  assert.equal(mfaResponse.headers.has('set-cookie'), false);
  assert.equal(providerCall, 2);
});

test('password recovery completion uses the same-origin server boundary and clears old session state', async () => {
  const { default: password } = await import('../api/auth/password.mjs');
  const response = createResponse();
  let providerBody;
  let providerAuthorization = '';

  await withAuthProvider(async (input, init) => {
    assert.match(String(input), /\/auth\/v1\/user$/);
    providerBody = JSON.parse(init.body);
    providerAuthorization = init.headers.Authorization;
    return new Response(JSON.stringify({
      id: '00000000-0000-0000-0000-000000000001',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, () => password(authRequest({
    action: 'recovery',
    newPassword: 'RecoveredPassword123!',
  }, {
    authorization: 'Bearer recovery-access-token',
  }), response));

  assert.equal(response.statusCode, 204);
  assert.equal(response.ended, true);
  assert.deepEqual(providerBody, { password: 'RecoveredPassword123!' });
  assert.equal(providerAuthorization, 'Bearer recovery-access-token');
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

test('signed-in password changes fail closed until provider current-password verification is approved', async () => {
  const { default: password } = await import('../api/auth/password.mjs');
  const response = createResponse();
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  }, () => password(authRequest({
    action: 'change',
    currentPassword: 'CurrentPassword123!',
    newPassword: 'DifferentPassword123!',
  }, {
    authorization: 'Bearer signed-in-access-token',
  }), response));

  assert.equal(response.statusCode, 503);
  assert.match(response.payload.error, /temporarily unavailable/);
  assert.match(response.payload.error, /Password recovery remains available/);
  assert.equal(providerCalled, false);
});

test('enforced signed-in password change sends current password only to the Auth provider', async () => {
  const { default: password } = await import('../api/auth/password.mjs');
  const response = createResponse();
  let providerBody;

  await withAuthProvider(async (_input, init) => {
    providerBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      id: '00000000-0000-0000-0000-000000000001',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, async () => {
    process.env.DEALIVRA_CURRENT_PASSWORD_MODE = 'enforced';
    await password(authRequest({
      action: 'change',
      currentPassword: 'CurrentPassword123!',
      newPassword: 'DifferentPassword123!',
    }, {
      authorization: 'Bearer signed-in-access-token',
    }), response);
  });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(providerBody, {
    password: 'DifferentPassword123!',
    current_password: 'CurrentPassword123!',
  });
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(response.payload, undefined);
});

test('password mutation validates inputs and preserves bounded provider throttling', async () => {
  const { default: password } = await import('../api/auth/password.mjs');
  const weakResponse = createResponse();
  let providerCalls = 0;

  await withAuthProvider(async () => {
    providerCalls += 1;
    return new Response(JSON.stringify({
      code: 'over_request_rate_limit',
      message: 'Raw provider message must not reach the browser.',
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '25',
      },
    });
  }, async () => {
    await password(authRequest({
      action: 'recovery',
      newPassword: 'weak',
    }, {
      authorization: 'Bearer recovery-access-token',
    }), weakResponse);
    assert.equal(weakResponse.statusCode, 400);
    assert.equal(providerCalls, 0);

    const limitedResponse = createResponse();
    await password(authRequest({
      action: 'recovery',
      newPassword: 'RecoveredPassword123!',
    }, {
      authorization: 'Bearer recovery-access-token',
    }), limitedResponse);
    assert.equal(limitedResponse.statusCode, 429);
    assert.equal(limitedResponse.headers.get('retry-after'), '25');
    assert.equal(limitedResponse.payload.retryAfter, 25);
    assert.doesNotMatch(
      JSON.stringify(limitedResponse.payload),
      /Raw provider message|RecoveredPassword123|recovery-access-token/,
    );
  });

  assert.equal(providerCalls, 1);
});

test('auth abuse telemetry and firewall rollout remain privacy-safe and staged', () => {
  const shared = readText('server/authShared.mjs');
  const client = readText('src/services/supabaseRest.ts');
  const app = readText('src/app.tsx');
  const recovery = readText('api/auth/recover.mjs');
  const forwarding = readText('docs/production-readiness/36_AUTH_PROXY_CLIENT_IP_BOUNDARY.md');
  const passwordBoundary = readText('docs/production-readiness/37_PASSWORD_MUTATION_BOUNDARY.md');
  const standard = readText('docs/production-readiness/35_AUTH_ABUSE_AND_RATE_LIMIT_ROLLOUT.md');
  const readinessIndex = readText('docs/production-readiness/README.md');
  const rejectionLogger = shared.match(
    /export function logAuthRejection[\s\S]*?\n}\n/,
  )?.[0] ?? '';

  assert.match(shared, /schema: 'dealivra\.auth\.rejection\.v1'/);
  assert.match(shared, /Math\.min\(Math\.max\(parsedRetryAfter, 1\), 300\)/);
  assert.match(shared, /response\.setHeader\('Retry-After'/);
  assert.ok(rejectionLogger);
  assert.doesNotMatch(rejectionLogger, /email|password|token|cookie|x-forwarded-for/i);
  assert.match(client, /fetch\('\/api\/auth\/recover'/);
  assert.doesNotMatch(client, /auth\/v1\/recover\?/);
  assert.match(client, /class AuthenticationApiError extends Error/);
  assert.match(client, /Try again in \$\{retryAfterSeconds\}/);
  assert.match(client, /isTransientAuthenticationError\(error\)/);
  assert.match(client, /if\(isTransientAuthenticationError\(error\)\)throw error;[\s\S]*expireSession\(\)/);
  assert.match(app, /if\(isTransientAuthenticationError\(error\)\)\{setAuthMessage\(error\.message\);return\}/);
  const recoveredPassword = client.match(
    /export async function updateRecoveredPassword[\s\S]*?\n}/,
  )?.[0] ?? '';
  const accountPassword = client.match(
    /export async function updateAccountPassword[\s\S]*?\n}/,
  )?.[0] ?? '';
  assert.match(recoveredPassword, /fetch\('\/api\/auth\/password'/);
  assert.doesNotMatch(recoveredPassword, /auth\/v1\/user|supabaseUrl/);
  assert.match(accountPassword, /currentPassword/);
  assert.match(accountPassword, /fetch\('\/api\/auth\/password'/);
  assert.doesNotMatch(accountPassword, /auth\/v1\/user|supabaseUrl/);
  assert.match(app, /autoComplete="current-password"/);
  assert.match(recovery, /requireSameOrigin/);
  assert.match(recovery, /requestOrigin\(request\)/);
  assert.match(recovery, /If an account exists for this email/);
  assert.match(standard, /first live firewall stage is \*\*log-only\*\*/i);
  assert.match(standard, /POST `?\/api\/auth\/signup`?/);
  assert.match(standard, /Preview enforcement/);
  assert.match(standard, /No rule is created or published/i);
  assert.match(forwarding, /DEALIVRA_AUTH_IP_FORWARDING_MODE/);
  assert.match(forwarding, /x-vercel-forwarded-for/);
  assert.match(forwarding, /not active/i);
  assert.match(passwordBoundary, /DEALIVRA_CURRENT_PASSWORD_MODE/);
  assert.match(passwordBoundary, /not active/i);
  assert.match(readinessIndex, /35_AUTH_ABUSE_AND_RATE_LIMIT_ROLLOUT\.md/);
  assert.match(readinessIndex, /36_AUTH_PROXY_CLIENT_IP_BOUNDARY\.md/);
  assert.match(readinessIndex, /37_PASSWORD_MUTATION_BOUNDARY\.md/);
});

test('failed password login directs the user to secure account recovery', async () => {
  const { default: login } = await import('../api/auth/login.mjs');
  const response = createResponse();

  await withAuthProvider(async () => new Response(JSON.stringify({
    code: 'invalid_credentials',
    message: 'Sensitive provider detail must not reach the browser.',
  }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  }), () => login(authRequest({
    email: 'user@example.com',
    password: 'WrongPassword123!',
  }), response));

  assert.equal(response.statusCode, 401);
  assert.match(response.payload.error, /choose Forgot password/);
  assert.doesNotMatch(response.payload.error, /invalid_credentials|Sensitive provider detail/);
});

test('password guidance and every application mutation require the provider symbol class', () => {
  const signup = readText('api/auth/signup.mjs');
  const client = readText('src/services/supabaseRest.ts');
  const app = readText('src/app.tsx');
  const standard = readText('docs/production-readiness/20_AUTH_PASSWORD_SECURITY.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(signup, /number, and a symbol/);
  assert.match(client, /number, and a symbol/);
  assert.match(app, /12 characters with uppercase, lowercase, a number, and a symbol/);
  assert.match(app, /12\+ characters with uppercase, lowercase, a number, and a symbol/);
  assert.match(standard, /Minimum password length \| `12`/);
  assert.match(standard, /Leaked-password protection \| Unavailable on the current Free plan/);
  assert.match(standard, /must not claim compromised-password screening/);
  assert.match(readinessIndex, /20_AUTH_PASSWORD_SECURITY\.md/);
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
    password: 'ExamplePass123!',
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

test('refresh requires AAL2 for every verified factor type', async () => {
  const { default: refresh } = await import('../api/auth/refresh.mjs');
  const response = createResponse();

  await withAuthProvider(async () => new Response(JSON.stringify(
    authProviderSession('must-not-rotate', {
      aal: 'aal1',
      factors: [{
        id: '11111111-1111-4111-8111-111111111111',
        factor_type: 'phone',
        status: 'verified',
      }],
    }),
  ), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }), () => refresh(authRequest({}, {
    cookie: '__Host-dealivra-refresh=existing-secret',
  }), response));

  assert.equal(response.statusCode, 401);
  assert.match(response.payload.error, /Verify your authenticator/);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(JSON.stringify(response.payload).includes('must-not-rotate'), false);
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

test('MFA enforcement is shared by Data API, Storage, protected functions, and account UI', () => {
  const migration = readText('supabase/mfa_assurance_enforcement.sql');
  const rollback = readText('supabase/mfa_assurance_enforcement_rollback.sql');
  const readiness = readText('supabase/mfa_privileged_enrollment_readiness.sql');
  const rollbackTests = readText('supabase/tests/mfa_assurance_enforcement_rollback.sql');
  const edgeCommon = readText('supabase/functions/_shared/common.ts');
  const paymentErrors = readText('supabase/functions/_shared/payment-observability.ts');
  const evidenceEndpoint = readText('supabase/functions/evidence-files/index.ts');
  const accountMfa = readText('src/AccountMfaSecurity.tsx');
  const loginMfa = readText('src/MfaLoginVerification.tsx');
  const client = readText('src/services/supabaseRest.ts');
  const app = readText('src/app.tsx');
  const standard = readText('docs/production-readiness/28_MFA_AND_PRIVILEGED_STEP_UP.md');

  assert.match(migration, /auth\.mfa_factors/);
  assert.match(migration, /factor\.status = 'verified'/);
  assert.match(migration, /factor\.factor_type = 'totp'/);
  assert.match(migration, /'support', 'compliance', 'admin'/);
  assert.match(migration, /verified_totp_factors >= 2/);
  assert.match(migration, /DEALIVRA_PRIVILEGED_MFA_ENROLLMENT_INCOMPLETE/);
  assert.match(migration, /request_aal = 'aal2'/);
  assert.match(migration, /DEALIVRA_MFA_REQUIRED/);
  assert.match(migration, /'status', 403/);
  assert.match(migration, /as restrictive[\s\S]*for all[\s\S]*to authenticated/);
  assert.match(rollback, /drop policy if exists "MFA assurance required for protected accounts"/);
  assert.match(rollback, /drop function if exists dealsafe_private\.is_current_mfa_assurance_sufficient/);
  assert.match(rollbackTests, /SEC-003 private assurance helper boundary is not exact/);
  assert.match(readiness, /rollout_blocked_accounts/);
  assert.match(readiness, /activation_state/);
  assert.match(readiness, /verified_totp_factors >= 2/);
  assert.doesNotMatch(readiness, /email|friendly_name|secret|phone/i);

  assert.match(edgeCommon, /data\.user\.factors\?\.some/);
  assert.match(edgeCommon, /\["support", "compliance", "admin"\]/);
  assert.match(edgeCommon, /assuranceLevel !== "aal2"/);
  assert.match(edgeCommon, /Multi-factor verification is required/);
  assert.match(paymentErrors, /"mfa_required"[\s\S]*403/);
  assert.match(evidenceEndpoint, /code: "mfa_required"[\s\S]*403/);

  assert.match(accountMfa, /Authenticator protection/);
  assert.match(accountMfa, /autoComplete="one-time-code"/);
  assert.match(accountMfa, /A second enrolled device reduces account-recovery risk/);
  assert.match(accountMfa, /must keep at least/);
  assert.doesNotMatch(accountMfa, /dangerouslySetInnerHTML/);
  assert.match(loginMfa, /STEP 2 OF 2/);
  assert.match(client, /pendingAccessToken/);
  assert.match(client, /action:'cancel_enrollment'/);
  assert.match(client, /claims\?\.aal!=='aal2'/);
  assert.match(client, /window\.dispatchEvent\(new Event\(mfaRequiredEvent\)\)/);
  assert.match(app, /<AccountMfaSecurity session=\{session\}/);
  assert.match(app, /<MfaLoginVerification challenge=\{mfaLogin\}/);
  assert.match(standard, /TOTP is not phishing-resistant/);
  assert.match(standard, /Privileged enrollment runbook/);
  assert.match(standard, /Privileged lost-factor matrix/);
  assert.match(standard, /Secret material[\s\S]*Never recorded/);
  assert.match(standard, /does not authorize public launch/);
});

test('privileged MFA recovery request policy rejects secrets and requires recent TOTP AAL2', async () => {
  const {
    hasRecentTotpAal2,
    parseRecoveryRequest,
    RecoveryRequestError,
  } = await import('../server/mfaRecoveryPolicy.mjs');
  const now = Math.floor(Date.now() / 1000);
  const targetUserId = '22222222-2222-4222-8222-222222222222';

  assert.deepEqual(parseRecoveryRequest({
    action: 'open',
    targetUserId,
    caseReference: 'SEC-2026-0042',
    reasonCode: 'lost_all_factors',
    evidenceReference: 'IDENTITY-REPROOF-0042',
  }), {
    action: 'open',
    rpc: 'open_privileged_mfa_recovery_case',
    parameters: {
      p_target_user_id: targetUserId,
      p_case_reference: 'SEC-2026-0042',
      p_reason_code: 'lost_all_factors',
      p_evidence_reference: 'IDENTITY-REPROOF-0042',
    },
  });

  for (const evidenceReference of [
    'token=do-not-store',
    'person@example.com',
    'TOTP secret value',
  ]) {
    assert.throws(() => parseRecoveryRequest({
      action: 'open',
      targetUserId,
      caseReference: 'SEC-2026-0042',
      reasonCode: 'lost_all_factors',
      evidenceReference,
    }), RecoveryRequestError);
  }

  const recentAal2 = authProviderSession('unused', {
    aal: 'aal2',
    amr: [
      { method: 'password', timestamp: now - 60 },
      { method: 'totp', timestamp: now - 30 },
    ],
  }).access_token;
  const staleAal2 = authProviderSession('unused', {
    aal: 'aal2',
    amr: [{ method: 'totp', timestamp: now - 11 * 60 }],
  }).access_token;
  const passwordOnly = authProviderSession('unused', {
    aal: 'aal1',
    amr: [{ method: 'password', timestamp: now }],
  }).access_token;

  assert.equal(hasRecentTotpAal2(recentAal2, now), true);
  assert.equal(hasRecentTotpAal2(staleAal2, now), false);
  assert.equal(hasRecentTotpAal2(passwordOnly, now), false);
  assert.equal(hasRecentTotpAal2('not-a-jwt', now), false);
});

test('MFA recovery endpoint validates before provider access and rejects password-only operators', async () => {
  const { default: recovery } = await import('../api/security/mfa-recovery.mjs');
  const now = Math.floor(Date.now() / 1000);
  const passwordOnly = authProviderSession('unused', {
    aal: 'aal1',
    amr: [{ method: 'password', timestamp: now }],
  }).access_token;
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  }, async () => {
    const malformedResponse = createResponse();
    await recovery(authRequest({
      action: 'open',
      targetUserId: 'not-a-uuid',
      caseReference: 'SEC-2026-0042',
      reasonCode: 'lost_all_factors',
      evidenceReference: 'IDENTITY-REPROOF-0042',
    }, {
      authorization: `Bearer ${passwordOnly}`,
    }), malformedResponse);
    assert.equal(malformedResponse.statusCode, 400);

    const aal1Response = createResponse();
    await recovery(authRequest({
      action: 'open',
      targetUserId: '22222222-2222-4222-8222-222222222222',
      caseReference: 'SEC-2026-0042',
      reasonCode: 'lost_all_factors',
      evidenceReference: 'IDENTITY-REPROOF-0042',
    }, {
      authorization: `Bearer ${passwordOnly}`,
    }), aal1Response);
    assert.equal(aal1Response.statusCode, 403);
    assert.match(aal1Response.payload.error, /authenticator/i);
  });

  assert.equal(providerCalled, false);
});

test('recent TOTP AAL2 recovery operator reaches only the validated RPC', async () => {
  const { default: recovery } = await import('../api/security/mfa-recovery.mjs');
  const now = Math.floor(Date.now() / 1000);
  const accessToken = authProviderSession('unused', {
    aal: 'aal2',
    amr: [{ method: 'totp', timestamp: now }],
  }).access_token;
  const targetUserId = '22222222-2222-4222-8222-222222222222';
  const createdCaseId = '33333333-3333-4333-8333-333333333333';
  const providerCalls = [];

  await withAuthProvider(async (input, init) => {
    providerCalls.push({
      url: String(input),
      authorization: init?.headers?.Authorization,
      body: init?.body,
    });
    if (String(input).endsWith('/rest/v1/rpc/current_user_app_role')) {
      return new Response(JSON.stringify('admin'), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(createdCaseId), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, async () => {
    const response = createResponse();
    await recovery(authRequest({
      action: 'open',
      targetUserId,
      caseReference: 'SEC-2026-0042',
      reasonCode: 'lost_all_factors',
      evidenceReference: 'IDENTITY-REPROOF-0042',
    }, {
      authorization: `Bearer ${accessToken}`,
    }), response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.payload, { result: createdCaseId });
  });

  assert.equal(providerCalls.length, 2);
  assert.match(providerCalls[0].url, /\/rest\/v1\/rpc\/current_user_app_role$/);
  assert.match(providerCalls[1].url, /\/rest\/v1\/rpc\/open_privileged_mfa_recovery_case$/);
  assert.equal(providerCalls[1].authorization, `Bearer ${accessToken}`);
  assert.deepEqual(JSON.parse(providerCalls[1].body), {
    p_target_user_id: targetUserId,
    p_case_reference: 'SEC-2026-0042',
    p_reason_code: 'lost_all_factors',
    p_evidence_reference: 'IDENTITY-REPROOF-0042',
  });
});

test('password-only negative matrix records status-only evidence for every protected surface', async () => {
  const {
    runMfaPasswordOnlyMatrix,
    validateMatrixTokens,
  } = await import('../scripts/run-mfa-password-only-matrix.mjs');
  const now = Math.floor(Date.now() / 1000);
  const subject = '44444444-4444-4444-8444-444444444444';
  const aal1Token = authProviderSession('unused', {
    sub: subject,
    role: 'authenticated',
    exp: now + 15 * 60,
    aal: 'aal1',
    amr: [{ method: 'password', timestamp: now }],
  }).access_token;
  const aal2Token = authProviderSession('unused', {
    sub: subject,
    role: 'authenticated',
    exp: now + 15 * 60,
    aal: 'aal2',
    amr: [
      { method: 'password', timestamp: now },
      { method: 'totp', timestamp: now },
    ],
  }).access_token;
  const storageObject = 'deal-evidence/mfa-matrix/control-object.txt';

  assert.deepEqual(validateMatrixTokens(aal1Token, aal2Token), { subject });
  assert.throws(
    () => validateMatrixTokens(aal2Token, aal1Token),
    /short-lived same-account AAL1 password and AAL2 password-plus-TOTP sessions/,
  );

  const fetchImplementation = async (input, init) => {
    const url = String(input);
    const passwordOnly = init?.headers?.Authorization === `Bearer ${aal1Token}`;
    if (url.includes('/rest/v1/')) {
      return new Response(
        passwordOnly ? '{"message":"DEALIVRA_MFA_REQUIRED"}' : '"admin"',
        { status: passwordOnly ? 403 : 200 },
      );
    }
    if (url.includes('/storage/v1/')) {
      return new Response(passwordOnly ? 'not permitted' : 'x', {
        status: passwordOnly ? 403 : 206,
      });
    }
    if (url.includes('/functions/v1/')) {
      return new Response(
        passwordOnly ? '{"code":"mfa_required"}' : '{"code":"invalid_body"}',
        { status: passwordOnly ? 403 : 400 },
      );
    }
    throw new Error(`Unexpected matrix URL: ${url}`);
  };

  const report = await runMfaPasswordOnlyMatrix({
    fetchImplementation,
    supabaseUrl: 'https://project.example.supabase.co',
    publishableKey: 'sb_publishable_test',
    aal1Token,
    aal2Token,
    origin: 'https://preview.dealivra.com',
    storageObject,
  });

  assert.equal(report.passed, true);
  assert.equal(report.results.length, 7);
  assert.equal(report.results.every(row => row.outcome === 'PASS'), true);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(aal1Token), false);
  assert.equal(serialized.includes(aal2Token), false);
  assert.equal(serialized.includes(subject), false);
  assert.equal(serialized.includes(storageObject), false);
  assert.equal(serialized.includes('DEALIVRA_MFA_REQUIRED'), false);
  assert.equal(serialized.includes('invalid_body'), false);
});

test('privileged MFA recovery SQL is private, dual-control, immutable, and unapplied by design', () => {
  const migration = readText('supabase/privileged_mfa_recovery_control.sql');
  const rollbackTests = readText('supabase/tests/privileged_mfa_recovery_control_rollback.sql');
  const negativeDatabaseTest = readText('supabase/tests/mfa_password_only_negative_matrix_rollback.sql');
  const endpoint = readText('api/security/mfa-recovery.mjs');
  const policy = readText('server/mfaRecoveryPolicy.mjs');
  const matrix = readText('scripts/run-mfa-password-only-matrix.mjs');
  const hardening = readText('supabase/production_auth_rbac_hardening.sql');
  const recoveryStandard = readText('docs/production-readiness/31_PRIVILEGED_MFA_RECOVERY_CONTROL.md');
  const matrixStandard = readText('docs/production-readiness/32_MFA_PASSWORD_ONLY_NEGATIVE_MATRIX.md');

  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all on table[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /current_user_has_recent_totp_step_up/);
  assert.match(migration, /now\(\) - interval '10 minutes'/);
  assert.match(migration, /DEALIVRA_RECOVERY_SECOND_REVIEWER_REQUIRED/);
  assert.match(migration, /reviewed_by is null or reviewed_by <> requested_by/);
  assert.match(migration, /from auth\.sessions/);
  assert.match(migration, /from auth\.mfa_factors/);
  assert.match(migration, /interval '72 hours'/);
  assert.match(migration, /array\['payout', 'email', 'mfa'\]/);
  assert.match(migration, /security_notification_outbox/);
  assert.match(migration, /insert into public\.audit_events/);
  assert.match(migration, /to authenticated/);
  assert.match(migration, /to service_role/);
  assert.match(migration, /set search_path = ''/);

  assert.match(rollbackTests, /private recovery table gained direct role access/);
  assert.match(rollbackTests, /dual-control review state changed/);
  assert.match(rollbackTests, /immutable recovery event dependency is missing/);
  assert.match(rollbackTests, /rollback;/);
  assert.match(negativeDatabaseTest, /password-only privileged request was accepted/);
  assert.match(negativeDatabaseTest, /AAL2 control request was unexpectedly rejected/);
  assert.match(negativeDatabaseTest, /rollback;/);

  assert.match(endpoint, /requireSameOrigin/);
  assert.match(endpoint, /hasRecentTotpAal2/);
  assert.match(endpoint, /privilegedRoles/);
  assert.match(policy, /forbiddenReferencePattern/);
  assert.match(policy, /nowSeconds - timestamp <= 10 \* 60/);
  assert.match(matrix, /Response bodies, user IDs|password_only_status/);
  assert.doesNotMatch(matrix, /process\.stdout\.write\([^)]*aal1Token/);

  for (const rpc of [
    'assert_my_sensitive_change_allowed',
    'get_my_sensitive_change_holds',
    'get_privileged_mfa_recovery_cases',
    'open_privileged_mfa_recovery_case',
    'record_privileged_recovery_identity_proof',
    'review_privileged_mfa_recovery_case',
  ]) {
    assert.match(hardening, new RegExp(`'${rpc}'`));
  }

  assert.match(recoveryStandard, /deliberately not active in\s+production/i);
  assert.match(recoveryStandard, /does not authorize/i);
  assert.match(matrixStandard, /Any `SKIP` is a failed activation gate/);
});

test('sensitive-change recovery enforcement is staged safely and fails closed when activated', async () => {
  const {
    assertSensitiveChangeAllowed,
    sensitiveChangeProtectionMode,
  } = await import('../server/sensitiveChangeProtection.mjs');

  let stagedProviderCalled = false;
  const staged = await assertSensitiveChangeAllowed('access-token', 'mfa', {
    environment: {},
    request: async () => {
      stagedProviderCalled = true;
      return new Response(null, { status: 204 });
    },
  });
  assert.deepEqual(staged, { enforced: false });
  assert.equal(stagedProviderCalled, false);

  const enforced = await assertSensitiveChangeAllowed('access-token', 'payout', {
    environment: { DEALIVRA_RECOVERY_CONTROL_MODE: 'enforced' },
    request: async (token, rpc, parameters) => {
      assert.equal(token, 'access-token');
      assert.equal(rpc, 'assert_my_sensitive_change_allowed');
      assert.deepEqual(parameters, { p_scope: 'payout' });
      return new Response(null, { status: 204 });
    },
  });
  assert.deepEqual(enforced, { enforced: true });

  await assert.rejects(
    () => assertSensitiveChangeAllowed('access-token', 'mfa', {
      environment: { DEALIVRA_RECOVERY_CONTROL_MODE: 'enforced' },
      request: async () => new Response(JSON.stringify({
        message: 'DEALIVRA_SENSITIVE_CHANGE_COOLDOWN',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    }),
    error => error?.code === 'recovery_cooldown_active' && error?.status === 423,
  );

  assert.throws(
    () => sensitiveChangeProtectionMode({
      DEALIVRA_RECOVERY_CONTROL_MODE: 'disabled',
    }),
    error => error?.code === 'recovery_protection_unavailable' && error?.status === 503,
  );
});

test('MFA and payout mutations are wired to the staged recovery cooldown boundary', () => {
  const mfa = readText('api/auth/mfa.mjs');
  const authClient = readText('src/services/supabaseRest.ts');
  const common = readText('supabase/functions/_shared/common.ts');
  const connect = readText('supabase/functions/stripe-connect/index.ts');
  const release = readText('supabase/functions/stripe-release-payment/index.ts');
  const dispute = readText('supabase/functions/stripe-resolve-dispute/index.ts');
  const environmentStandard = readText('docs/production-readiness/10_ENVIRONMENT_CONFIGURATION.md');
  const enforcementStandard = readText('docs/production-readiness/33_SENSITIVE_CHANGE_ENFORCEMENT.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(mfa, /action === 'enroll'[\s\S]*assertSensitiveChangeAllowed\(accessToken, 'mfa'\)/);
  assert.match(mfa, /purpose === 'enrollment'[\s\S]*assertSensitiveChangeAllowed\(accessToken, 'mfa'\)/);
  assert.match(mfa, /action === 'unenroll'[\s\S]*assertSensitiveChangeAllowed\(accessToken, 'mfa'\)[\s\S]*method: 'DELETE'/);
  assert.match(mfa, /expectedStatus = purpose === 'enrollment' \? 'unverified' : 'verified'/);
  assert.match(authClient, /purpose:'login'/);
  assert.match(authClient, /purpose:'enrollment'\|'step_up'/);
  assert.match(authClient, /verifyMfaFactor\(session,factorId,code,'enrollment'\)/);
  assert.match(authClient, /verifyMfaFactor\(session,factorId,code,'step_up'\)/);

  assert.match(common, /DEALIVRA_RECOVERY_CONTROL_MODE/);
  assert.match(common, /mode !== "staged" && mode !== "enforced"/);
  assert.match(common, /\.rpc\(\s*"is_sensitive_change_allowed_for_service"/);
  assert.match(common, /data !== true[\s\S]*"recovery_cooldown_active"[\s\S]*423/);
  assert.match(connect, /body\.action === "onboard"[\s\S]*requireSensitiveChangeAllowedForService\(user\.id, "payout"\)/);
  assert.match(release, /\.from\("deals"\)[\s\S]*requireSensitiveChangeAllowedForService\(payoutDeal\.seller_id, "payout"\)[\s\S]*"prepare_stripe_financial_command"/);
  assert.match(dispute, /if \(action === "transfer"\)[\s\S]*requireSensitiveChangeAllowedForService\(payoutDeal\.seller_id, "payout"\)/);

  assert.match(environmentStandard, /DEALIVRA_RECOVERY_CONTROL_MODE/);
  assert.match(enforcementStandard, /refund remains available/i);
  assert.match(enforcementStandard, /must not be set to `enforced`/i);
  assert.match(readinessIndex, /33_SENSITIVE_CHANGE_ENFORCEMENT\.md/);
});

test('security notification templates are bounded, non-secret, and case-specific', async () => {
  const { renderSecurityNotification } = await import(
    '../supabase/functions/_shared/security-notification.ts'
  );
  const caseReference = 'SEC-2026-0001';
  const templates = [
    'privileged_mfa_recovery_opened',
    'privileged_mfa_recovery_identity_verified',
    'privileged_mfa_recovery_approved',
    'privileged_mfa_recovery_rejected',
    'privileged_mfa_recovery_completed',
  ];

  for (const template of templates) {
    const content = renderSecurityNotification(template, {
      case_reference: caseReference,
      cooldown_until: '2026-08-01T12:00:00.000Z',
    });
    assert.match(content.subject, /^Security notice:/);
    assert.match(content.text, new RegExp(caseReference));
    assert.match(content.html, new RegExp(caseReference));
    assert.match(content.text, /never ask for your password/i);
    assert.equal(content.subject.length < 100, true);
    assert.equal(content.text.length < 1200, true);
    assert.equal(content.html.length < 5000, true);
  }

  assert.throws(
    () => renderSecurityNotification('unknown_template', {
      case_reference: caseReference,
    }),
    /security_notification_template_invalid/,
  );
  assert.throws(
    () => renderSecurityNotification('privileged_mfa_recovery_opened', {
      case_reference: '<script>alert(1)</script>',
    }),
    /security_notification_payload_invalid/,
  );
  assert.throws(
    () => renderSecurityNotification('privileged_mfa_recovery_completed', {
      case_reference: caseReference,
      cooldown_until: 'not-a-date',
    }),
    /security_notification_payload_invalid/,
  );
});

test('security notification worker is authenticated, idempotent, staged, and privacy-safe', () => {
  const worker = readText('supabase/functions/security-notifications/index.ts');
  const renderer = readText('supabase/functions/_shared/security-notification.ts');
  const config = readText('supabase/config.toml');
  const recoverySql = readText('supabase/privileged_mfa_recovery_control.sql');
  const rollbackProof = readText('supabase/tests/privileged_mfa_recovery_control_rollback.sql');
  const environmentStandard = readText('docs/production-readiness/10_ENVIRONMENT_CONFIGURATION.md');
  const operatingStandard = readText('docs/production-readiness/34_SECURITY_NOTIFICATION_DELIVERY.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(worker, /DEALIVRA_SECURITY_NOTIFICATION_WORKER_SECRET/);
  assert.match(worker, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(worker, /DEALIVRA_SECURITY_NOTIFICATION_MODE/);
  assert.match(worker, /notificationMode\(\) !== "enforced"[\s\S]*503/);
  assert.match(worker, /"claim_security_notification_delivery_batch"/);
  assert.match(worker, /admin\.auth\.admin\.getUserById\(job\.target_user_id\)/);
  assert.match(worker, /data\.user\.email_confirmed_at/);
  assert.match(worker, /https:\/\/api\.resend\.com\/emails/);
  assert.match(worker, /"Idempotency-Key": `dealivra_security_\$\{job\.notification_id\}`/);
  assert.match(worker, /AbortSignal\.timeout\(10_000\)/);
  assert.match(worker, /readBoundedJson\(response\)/);
  assert.match(worker, /"complete_security_notification_delivery"/);
  assert.match(worker, /"get_security_notification_delivery_health_for_service"/);
  assert.match(worker, /event: "queue_attention_required"/);
  assert.match(worker, /code: "dead_letter_present"/);
  assert.match(worker, /attention_required: attentionRequired/);
  assert.doesNotMatch(worker, /console\.(?:log|warn|error)\([^)]*(?:email|target_user_id|payload)/);
  assert.doesNotMatch(worker, /Access-Control-Allow-Origin/);

  assert.match(renderer, /supportedTemplates/);
  assert.match(renderer, /escapeHtml/);
  assert.match(renderer, /will never ask for your password/);
  assert.match(config, /\[functions\.security-notifications\][\s\S]*verify_jwt = false/);
  assert.match(environmentStandard, /RESEND_API_KEY/);
  assert.match(operatingStandard, /must remain `staged`/i);
  assert.match(operatingStandard, /SPF and DKIM[\s\S]*DMARC/i);
  assert.match(operatingStandard, /dead_letter_present/);
  assert.match(recoverySql, /get_security_notification_delivery_health_for_service/);
  assert.match(recoverySql, /delivery_attempts >= 5/);
  assert.match(rollbackProof, /delivery health privacy or dead-letter boundary changed/);
  assert.match(readinessIndex, /34_SECURITY_NOTIFICATION_DELIVERY\.md/);
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
    url: '/api/catalog?category=vehicle',
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
      url: `/api/catalog?category=${encodeURIComponent(category)}`,
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
    url: '/api/catalog?category=unreviewed',
    headers: {},
  }, unsupportedResponse);
  await catalog({
    method: 'POST',
    url: '/api/catalog',
    headers: {},
  }, writeResponse);

  assert.equal(unsupportedResponse.statusCode, 400);
  assert.equal(writeResponse.statusCode, 405);
  assert.equal(writeResponse.headers.get('allow'), 'GET');
});

test('catalog endpoint uses the WHATWG URL API instead of the deprecated request query parser', async () => {
  const { default: catalog } = await import('../api/catalog.mjs');
  const response = createResponse();
  const request = {
    method: 'GET',
    url: '/api/catalog?category=vehicle&category=phone',
    headers: {},
  };
  Object.defineProperty(request, 'query', {
    get() {
      throw new Error('The deprecated query compatibility layer must not be accessed.');
    },
  });

  await catalog(request, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.category, 'vehicle');
  assert.doesNotMatch(readText('api/catalog.mjs'), /request\.query/);
});

test('Node runtime is pinned to the reviewed Vercel major release', () => {
  const packageJson = readJson('package.json');
  const packageLock = readJson('package-lock.json');
  const nodeVersion = readText('.nvmrc').trim();

  assert.equal(packageJson.engines.node, '24.x');
  assert.equal(packageLock.packages[''].engines.node, '24.x');
  assert.equal(nodeVersion, '24');
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

  assert.match(enforcement, /security invoker/);
  assert.doesNotMatch(enforcement, /security definer/);
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

test('SECURITY DEFINER advisor exceptions are explicit, bounded, and regression-tested', () => {
  const migration = readText('supabase/security_definer_advisor_hardening.sql');
  const rollbackTests = readText('supabase/tests/security_definer_advisor_hardening_rollback.sql');
  const standard = readText('docs/production-readiness/19_SECURITY_DEFINER_GOVERNANCE.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(migration, /alter function public\.enforce_active_auth_session\(\)[\s\S]*security invoker/);
  assert.match(migration, /revoke all on function public\.enforce_active_auth_session\(\)[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.enforce_active_auth_session\(\)[\s\S]*to anon, authenticated, service_role/);
  assert.match(rollbackTests, /DAT-004 pre-request hook still uses SECURITY DEFINER/);
  assert.match(rollbackTests, /DAT-004 anonymous SECURITY DEFINER allowlist changed/);
  assert.match(rollbackTests, /verify_agreement_record\(text,text\)/);
  assert.match(rollbackTests, /pgrst\.db_pre_request=public\.enforce_active_auth_session/);
  assert.match(standard, /Any other anonymous elevated function is a release blocker/);
  assert.match(standard, /Auth leaked-password protection/);
  assert.match(readinessIndex, /19_SECURITY_DEFINER_GOVERNANCE\.md/);
});

test('signed-in SECURITY DEFINER functions have an exact cross-role matrix', () => {
  const rollbackTests = readText('supabase/tests/authenticated_rpc_cross_role_rollback.sql');
  const standard = readText('docs/production-readiness/21_AUTHENTICATED_RPC_MATRIX.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(rollbackTests, /DAT-004 signed-in SECURITY DEFINER inventory changed/);
  assert.match(rollbackTests, /has_function_privilege\('public'/);
  assert.match(rollbackTests, /has_function_privilege\('anon'/);
  assert.match(rollbackTests, /get_admin_revenue_summary\(\)/);
  assert.match(rollbackTests, /resolve_deal_dispute\(uuid,text,text\)/);
  assert.match(rollbackTests, /DAT-004 outsider read a participant-only deal record/);
  assert.match(rollbackTests, /DAT-004 seller positive access path failed/);
  assert.match(rollbackTests, /DAT-004 buyer positive access path failed/);
  assert.match(rollbackTests, /set local role authenticated/);
  assert.match(rollbackTests, /rollback;/);
  assert.match(standard, /full 63-signature signed-in elevated\s+inventory/);
  assert.match(standard, /ordinary member is denied by all five administrator readers/);
  assert.match(standard, /does not authorize public\s+launch/);
  assert.match(readinessIndex, /21_AUTHENTICATED_RPC_MATRIX\.md/);
});

test('participant RLS policies evaluate Auth once without changing role semantics', () => {
  const migration = readText('supabase/rls_auth_initplan_optimization.sql');
  const rollbackTests = readText('supabase/tests/rls_auth_initplan_optimization_rollback.sql');
  const standard = readText('docs/production-readiness/22_RLS_POLICY_PERFORMANCE.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.equal(
    [...migration.matchAll(/create policy "/g)].length,
    9,
    'DBP-001 must govern exactly nine RLS policies',
  );
  assert.doesNotMatch(migration, /= auth\.uid\(\)/);
  assert.match(migration, /= \(select auth\.uid\(\)\)/);
  assert.match(migration, /\(select public\.is_dealsafe_admin\(\)\)/);
  assert.match(rollbackTests, /DBP-001 governed RLS policy inventory changed/);
  assert.match(rollbackTests, /DBP-001 seller lost RLS read access/);
  assert.match(rollbackTests, /DBP-001 buyer lost RLS read access/);
  assert.match(rollbackTests, /DBP-001 outsider gained RLS read access/);
  assert.match(rollbackTests, /DBP-001 RPC-only message table gained direct SELECT access/);
  assert.match(rollbackTests, /DBP-001 outsider inserted a media record/);
  assert.match(rollbackTests, /DBP-001 browser evidence INSERT was restored/);
  assert.match(rollbackTests, /set local role authenticated/);
  assert.match(rollbackTests, /rollback;/);
  assert.match(standard, /performance remediation may never broaden visibility/i);
  assert.match(standard, /Foreign-key index recommendations are intentionally excluded/);
  assert.match(readinessIndex, /22_RLS_POLICY_PERFORMANCE\.md/);
});

test('measured foreign-key indexes cover only governed production hot paths', () => {
  const migration = readText('supabase/foreign_key_hot_path_indexes.sql');
  const rollbackTests = readText('supabase/tests/foreign_key_hot_path_indexes_rollback.sql');
  const standard = readText('docs/production-readiness/23_FOREIGN_KEY_INDEX_GOVERNANCE.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.equal(
    [...migration.matchAll(/create index if not exists/g)].length,
    6,
    'DBP-002 must create exactly six measured indexes',
  );
  assert.match(migration, /audit_events_deal_created_idx[\s\S]*\(deal_id, created_at desc\)/);
  assert.match(migration, /deal_activity_reads_deal_idx[\s\S]*\(deal_id\)/);
  assert.match(migration, /deal_media_deal_sort_idx[\s\S]*\(deal_id, sort_order\)/);
  assert.match(migration, /deal_messages_deal_created_idx[\s\S]*\(deal_id, created_at\)/);
  assert.match(migration, /deal_offers_deal_created_idx[\s\S]*\(deal_id, created_at desc\)/);
  assert.match(migration, /ratings_subject_created_idx[\s\S]*\(subject_id, created_at desc\)/);
  assert.doesNotMatch(migration, /\b(?:grant|revoke|policy|alter table|drop)\b/i);

  assert.match(rollbackTests, /DBP-002 hot-path index inventory changed/);
  assert.match(rollbackTests, /DBP-002 chat history query did not use its index/);
  assert.match(rollbackTests, /DBP-002 media lookup did not use its index/);
  assert.match(rollbackTests, /DBP-002 audit timeline query did not use its index/);
  assert.match(rollbackTests, /DBP-002 offer history query did not use its index/);
  assert.match(rollbackTests, /DBP-002 reputation history query did not use its index/);
  assert.match(rollbackTests, /set local enable_seqscan = off/);
  assert.match(rollbackTests, /rollback;/);

  assert.match(standard, /Foreign-key advisor notices are candidates/i);
  assert.match(standard, /remaining foreign-key notices stay visible/i);
  assert.match(standard, /changes only physical access paths/i);
  assert.match(readinessIndex, /23_FOREIGN_KEY_INDEX_GOVERNANCE\.md/);
});

test('material audit events are append-only and correlation-ready', () => {
  const migration = readText('supabase/immutable_material_audit_events.sql');
  const rollbackTests = readText('supabase/tests/immutable_material_audit_events_rollback.sql');
  const standard = readText('docs/production-readiness/24_IMMUTABLE_AUDIT_EVENTS.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(migration, /add column if not exists correlation_id uuid/);
  assert.match(migration, /alter column correlation_id set default gen_random_uuid\(\)/);
  assert.match(migration, /alter column correlation_id set not null/);
  assert.match(migration, /audit_events_correlation_idx[\s\S]*\(correlation_id\)/);
  assert.match(migration, /security invoker[\s\S]*set search_path = ''/);
  assert.match(migration, /before update or delete on public\.audit_events/);
  assert.match(migration, /before truncate on public\.audit_events/);
  assert.match(migration, /revoke insert, update, delete, truncate, trigger[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /revoke update, delete, truncate, trigger[\s\S]*from service_role/);
  assert.match(migration, /grant select, insert[\s\S]*to service_role/);

  assert.match(rollbackTests, /DAT-005 correlation column contract changed/);
  assert.match(rollbackTests, /DAT-005 append-only trigger inventory changed/);
  assert.match(rollbackTests, /DAT-005 ordinary roles gained direct audit mutation privileges/);
  assert.match(rollbackTests, /DAT-005 service-role append-only privileges changed/);
  assert.match(rollbackTests, /DAT-005 UPDATE unexpectedly succeeded/);
  assert.match(rollbackTests, /DAT-005 DELETE unexpectedly succeeded/);
  assert.match(rollbackTests, /DAT-005 TRUNCATE unexpectedly succeeded/);
  assert.match(rollbackTests, /rollback;/);

  assert.match(standard, /append-only for every application role/i);
  assert.match(standard, /not a cryptographic ledger/i);
  assert.match(standard, /does not authorize public launch/i);
  assert.match(readinessIndex, /24_IMMUTABLE_AUDIT_EVENTS\.md/);
});

test('protected Edge Functions validate the Auth session row after JWT verification', () => {
  const common = readText('supabase/functions/_shared/common.ts');
  const observability = readText('supabase/functions/_shared/payment-observability.ts');
  const config = readText('supabase/config.toml');

  assert.match(common, /admin\.auth\.getUser\(token\)/);
  assert.match(common, /claims\.session_id/);
  assert.match(common, /subject !== data\.user\.id/);
  assert.match(common, /role !== "authenticated"/);
  assert.match(common, /\.rpc\(\s*"is_auth_session_active_for_service"/);
  assert.match(common, /sessionActive !== true/);
  assert.match(common, /return \(await requireActiveUserSession\(request\)\)\.user/);
  assert.match(observability, /\^Your session is invalid or expired\$\/i\.test\(message\)/);
  assert.match(observability, /"session_expired"[\s\S]*401/);
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
  assert.match(webhook, /if \(event\.livemode\) return webhookError\(context, "live_mode_rejected", 400, event\.id\)/);
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

test('payment provider failures are customer-safe, correlated, and operator-actionable', () => {
  const common = readText('supabase/functions/_shared/common.ts');
  const observability = readText('supabase/functions/_shared/payment-observability.ts');
  const ledger = readText('supabase/functions/_shared/payment-ledger.ts');
  const migration = readText('supabase/payment_provider_observability.sql');
  const rollbackTests = readText('supabase/tests/payment_provider_observability_rollback.sql');
  const client = readText('src/services/supabaseRest.ts');
  const standard = readText('docs/production-readiness/18_PAYMENT_PROVIDER_OBSERVABILITY.md');
  const readinessIndex = readText('docs/production-readiness/README.md');
  const handlers = [
    readText('supabase/functions/stripe-connect/index.ts'),
    readText('supabase/functions/stripe-create-checkout/index.ts'),
    readText('supabase/functions/stripe-release-payment/index.ts'),
    readText('supabase/functions/stripe-resolve-dispute/index.ts'),
  ];
  const webhook = readText('supabase/functions/stripe-webhook/index.ts');

  assert.match(common, /throw stripeProviderError\(response, data\)/);
  assert.match(common, /throw stripeNetworkError\(\)/);
  assert.doesNotMatch(common, /data\?\.error\?\.message/);
  assert.doesNotMatch(observability, /provider\.message/);
  assert.match(observability, /dealivra\.payment\.operation\.v1/);
  assert.match(observability, /X-Dealivra-Correlation-Id/);
  assert.match(observability, /correlationId: context\.correlationId/);
  assert.match(observability, /payment_service_error/);
  assert.match(observability, /provider_request_id/);
  assert.doesNotMatch(observability, /console\.(?:error|warn|info)\([^s]/);

  for (const handler of handlers) {
    assert.match(handler, /startPaymentOperation\("stripe-/);
    assert.match(handler, /errorResponse\(error, context/);
    assert.match(handler, /handleBrowserRequest\(request, async \(\) =>/);
    assert.match(handler, /}, context\)/);
  }

  assert.match(webhook, /startPaymentOperation\("stripe-webhook"\)/);
  assert.match(webhook, /paymentJson\(context/);
  assert.match(webhook, /linkWebhookObservation\(context, event\.id, claimToken\)/);
  assert.doesNotMatch(webhook, /last_payment_error\?\.message/);

  assert.match(ledger, /\.from\("stripe_financial_commands"\)/);
  assert.match(ledger, /\.from\("stripe_webhook_events"\)/);
  assert.match(ledger, /correlation_id: context\.correlationId/);
  assert.match(ledger, /provider_request_id/);

  assert.match(migration, /add column if not exists correlation_id uuid/);
  assert.match(migration, /add column if not exists provider_request_id text/);
  assert.match(migration, /create or replace view public\.stripe_payment_operation_exceptions/);
  assert.match(migration, /with \(security_invoker = true\)/);
  assert.match(migration, /revoke all on table public\.stripe_payment_operation_exceptions[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant select on table public\.stripe_payment_operation_exceptions to service_role/);
  assert.doesNotMatch(migration, /raw_provider/);

  assert.match(rollbackTests, /PAY-004 financial ledgers are not protected by RLS/);
  assert.match(rollbackTests, /PAY-004 observability data is visible to a browser role/);
  assert.match(rollbackTests, /PAY-004 correlation columns are incomplete/);
  assert.match(rollbackTests, /PAY-004 correlation indexes are incomplete/);

  assert.match(client, /class SecurePaymentServiceError extends Error/);
  assert.match(client, /Support reference:/);
  assert.match(client, /X-Dealivra-Correlation-Id/);
  assert.match(standard, /never displays/);
  assert.match(standard, /No alert automatically releases, refunds, retries/);
  assert.match(readinessIndex, /18_PAYMENT_PROVIDER_OBSERVABILITY\.md/);
});

test('evidence file policy rejects mismatched, metadata-bearing, and oversized files', async () => {
  const {
    containsEicarTestPattern,
    detectEvidenceFile,
    evidenceImageMaxBytes,
    evidenceSignedUrlTtlSeconds,
    evidenceVideoMaxBytes,
    validateEvidenceBytes,
    validateEvidenceDeclaration,
  } = await import('../supabase/functions/_shared/evidence-policy.ts');

  const webp = Buffer.alloc(22);
  webp.write('RIFF', 0, 'ascii');
  webp.writeUInt32LE(14, 4);
  webp.write('WEBP', 8, 'ascii');
  webp.write('VP8L', 12, 'ascii');
  webp.writeUInt32LE(1, 16);
  webp[20] = 0x2f;

  const imageDeclaration = {
    claimedMimeType: 'image/webp',
    evidenceType: 'seller_item_photo',
    fileName: 'item.webp',
    fileSize: webp.length,
    role: 'seller',
  };
  assert.deepEqual(detectEvidenceFile(webp), {
    extension: 'webp',
    kind: 'image',
    mimeType: 'image/webp',
  });
  assert.equal(validateEvidenceBytes(webp, imageDeclaration).ok, true);
  assert.equal(validateEvidenceBytes(webp, {
    ...imageDeclaration,
    evidenceType: 'seller_packing_video',
  }).ok, false);

  const metadataWebp = Buffer.alloc(30);
  metadataWebp.write('RIFF', 0, 'ascii');
  metadataWebp.writeUInt32LE(22, 4);
  metadataWebp.write('WEBP', 8, 'ascii');
  metadataWebp.write('EXIF', 12, 'ascii');
  metadataWebp.writeUInt32LE(1, 16);
  metadataWebp[20] = 1;
  metadataWebp.write('VP8L', 22, 'ascii');
  assert.equal(detectEvidenceFile(metadataWebp), null);

  assert.equal(validateEvidenceDeclaration({
    ...imageDeclaration,
    fileSize: evidenceImageMaxBytes + 1,
  }).ok, false);
  assert.equal(validateEvidenceDeclaration({
    claimedMimeType: 'video/mp4',
    evidenceType: 'buyer_unboxing_video',
    fileName: 'unboxing.mp4',
    fileSize: evidenceVideoMaxBytes + 1,
    role: 'buyer',
  }).ok, false);
  assert.equal(evidenceSignedUrlTtlSeconds, 60);
  assert.equal(containsEicarTestPattern(Buffer.from(
    'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!',
  )), true);
});

test('evidence scanner accepts only bounded hash-matched provider verdicts', async () => {
  const { validateScannerVerdict } = await import(
    '../supabase/functions/_shared/evidence-scan.ts'
  );
  const sha256 = 'a'.repeat(64);
  assert.deepEqual(validateScannerVerdict({
    verdict: 'clean',
    sha256,
    scanId: 'scan-123',
    engine: 'clamav-gateway-v1',
  }, sha256), {
    verdict: 'clean',
    sha256,
    scanId: 'scan-123',
    engine: 'clamav-gateway-v1',
  });
  assert.throws(() => validateScannerVerdict({
    verdict: 'clean',
    sha256: 'b'.repeat(64),
    scanId: 'scan-123',
    engine: 'clamav-gateway-v1',
  }, sha256), /invalid response/i);
  assert.throws(() => validateScannerVerdict({
    verdict: 'unknown',
    sha256,
    scanId: 'scan-123',
    engine: 'clamav-gateway-v1',
  }, sha256), /invalid response/i);
});

test('private evidence uses quarantine, service-side scanning, and 60-second access', () => {
  const migration = readText('supabase/evidence_file_security.sql');
  const rollbackTests = readText('supabase/tests/evidence_file_security_rollback.sql');
  const edgeFunction = readText('supabase/functions/evidence-files/index.ts');
  const scanner = readText('supabase/functions/_shared/evidence-scan.ts');
  const client = readText('src/services/supabaseRest.ts');
  const standard = readText('docs/production-readiness/25_EVIDENCE_FILE_SECURITY.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(migration, /deal-evidence-quarantine/);
  assert.match(migration, /approved evidence quarantine upload/);
  assert.match(migration, /drop policy if exists "participants read deal evidence files"/);
  assert.match(migration, /deal_evidence_clean_scan_contract/);
  assert.match(migration, /evidence_file_access_events_reject_update_delete/);
  assert.match(migration, /with \(security_invoker = true, security_barrier = true\)/);
  assert.doesNotMatch(
    migration.match(/create view public\.deal_evidence_safe[\s\S]*?from public\.deal_evidence as evidence;/)?.[0] || '',
    /storage_path|uploaded_by|scan_provider|scan_reference|metadata/,
  );
  assert.match(migration, /evidence\.scan_status = 'clean'/);

  assert.match(edgeFunction, /validateEvidenceBytes\(bytes, declaration\)/);
  assert.match(edgeFunction, /scanEvidenceBytes\(bytes/);
  assert.match(edgeFunction, /\.from\("deal-evidence-quarantine"\)/);
  assert.match(edgeFunction, /createSignedUrl\(evidence\.storage_path, evidenceSignedUrlTtlSeconds\)/);
  assert.match(edgeFunction, /participant \? "participant" : "dispute_case"/);
  assert.match(edgeFunction, /profile\?\.app_role === "admin" && \(count \|\| 0\) > 0/);
  assert.match(scanner, /DEALIVRA_MALWARE_SCANNER_URL/);
  assert.match(scanner, /DEALIVRA_MALWARE_SCANNER_TOKEN/);
  assert.match(scanner, /X-Content-SHA256/);
  assert.match(scanner, /scanner_unavailable/);

  assert.match(client, /functions\/v1\/evidence-files/);
  assert.match(client, /deal_evidence_safe/);
  assert.doesNotMatch(client, /fetch\([^)]*object\/sign\/deal-evidence/);
  assert.doesNotMatch(client, /rest\/v1\/deal_evidence[^_]/);

  assert.match(rollbackTests, /EVD-001 bucket allowlist or privacy contract changed/);
  assert.match(rollbackTests, /EVD-003 outsider read another deal evidence record/);
  assert.match(rollbackTests, /EVD-003 administrator lost dispute-case metadata access/);
  assert.match(rollbackTests, /rollback;/);
  assert.match(standard, /scanner remains fail-closed/i);
  assert.match(standard, /does not authorize public launch/i);
  assert.match(readinessIndex, /25_EVIDENCE_FILE_SECURITY\.md/);
});

test('evidence viewer revalidates bytes and records append-only integrity before access', () => {
  const migration = readText('supabase/evidence_integrity_inventory.sql');
  const rollbackTests = readText('supabase/tests/evidence_integrity_inventory_rollback.sql');
  const edgeFunction = readText('supabase/functions/evidence-files/index.ts');
  const client = readText('src/services/supabaseRest.ts');
  const viewer = readText('src/EvidenceViewer.tsx');
  const styles = readText('src/evidence.css');
  const app = readText('src/app.tsx');
  const standard = readText('docs/production-readiness/26_EVIDENCE_INTEGRITY_VIEWER.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(migration, /create table if not exists public\.evidence_integrity_events/);
  assert.match(migration, /evidence_integrity_events_reject_update_delete/);
  assert.match(migration, /create or replace function public\.record_evidence_integrity_result/);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/);
  assert.match(migration, /grant execute on function public\.record_evidence_integrity_result[\s\S]*to service_role/);
  assert.match(migration, /revoke all on function public\.record_evidence_integrity_result[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /integrity_status[\s\S]*integrity_checked_at/);
  assert.doesNotMatch(
    migration.match(/create view public\.deal_evidence_safe[\s\S]*?from public\.deal_evidence as evidence;/)?.[0] || '',
    /storage_path|uploaded_by|scan_provider|scan_reference|metadata|observed_sha256/,
  );

  const downloadIndex = edgeFunction.indexOf('.from("deal-evidence")\n    .download(evidence.storage_path)');
  const hashIndex = edgeFunction.indexOf('evidenceSha256(bytes)');
  const integrityIndex = edgeFunction.indexOf('recordIntegrityResult(evidence.id, userId', hashIndex);
  const signedIndex = edgeFunction.indexOf('createSignedUrl(evidence.storage_path, evidenceSignedUrlTtlSeconds)');
  assert.ok(downloadIndex >= 0, 'Evidence viewer must download the private object for revalidation');
  assert.ok(hashIndex > downloadIndex, 'Evidence digest must be recomputed after private download');
  assert.ok(integrityIndex > hashIndex, 'Integrity result must be recorded after digest computation');
  assert.ok(signedIndex > integrityIndex, 'Signed URL must be created only after integrity recording');
  assert.match(edgeFunction, /integrity\.integrity_status !== "verified"/);
  assert.match(edgeFunction, /evidence_integrity_failed/);

  assert.match(client, /export async function loadDealEvidenceViewer/);
  assert.match(client, /credentials:'omit',referrerPolicy:'no-referrer'/);
  assert.match(client, /URL\.createObjectURL\(new Blob/);
  assert.match(client, /bytes\.byteLength!==data\.fileSizeBytes/);
  assert.match(client, /crypto\.subtle\.digest\('SHA-256',bytes\)/);
  assert.match(client, /evidenceViewerSha256\(bytes\)!==data\.sha256/);
  assert.match(client, /signedUrl\.origin!==expectedStorageOrigin/);
  assert.match(client, /storage\/v1\/object\/sign\/deal-evidence/);
  assert.doesNotMatch(app, /window\.open\('about:blank','_blank'\)/);
  assert.doesNotMatch(viewer, /<iframe|<object|<embed|dangerouslySetInnerHTML/);
  assert.match(viewer, /URL\.revokeObjectURL/);
  assert.match(viewer, /role="dialog"/);
  assert.match(viewer, /aria-modal="true"/);
  assert.match(viewer, /event\.key === 'Escape'/);
  assert.match(viewer, /event\.key !== 'Tab'/);
  assert.match(styles, /\.evidence-viewer-backdrop/);
  assert.match(styles, /@media \(max-width:700px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:reduce\)/);

  assert.match(rollbackTests, /EVD-004 matching bytes were not recorded as verified/);
  assert.match(rollbackTests, /EVD-004 digest mismatch did not fail closed/);
  assert.match(rollbackTests, /EVD-004 integrity history was mutable/);
  assert.match(rollbackTests, /rollback;/);
  assert.match(standard, /never uses an iframe, object, embed/i);
  assert.match(standard, /does not authorize public launch/i);
  assert.match(readinessIndex, /26_EVIDENCE_INTEGRITY_VIEWER\.md/);
});
