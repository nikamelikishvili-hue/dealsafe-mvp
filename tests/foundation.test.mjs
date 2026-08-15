import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import { inlineEnglishTranslationCalls } from '../server/launchLocaleTransform.mjs';
import clientFailureHandler from '../api/security/client-failure.mjs';
import cspReportHandler from '../api/security/csp-report.mjs';
import runtimeRejectionHandler from '../api/security/runtime-rejection.mjs';
import webVitalHandler from '../api/security/web-vital.mjs';
import healthHandler from '../api/health.mjs';
import loginHandler from '../api/auth/login.mjs';
import logoutHandler from '../api/auth/logout.mjs';
import mfaHandler from '../api/auth/mfa.mjs';
import passwordHandler from '../api/auth/password.mjs';
import recoverHandler from '../api/auth/recover.mjs';
import refreshHandler from '../api/auth/refresh.mjs';
import signupHandler from '../api/auth/signup.mjs';
import {
  readBoundedJson as readBoundedReportingJson,
  validateReportingRequest,
} from '../server/reportingRequestBoundary.mjs';
import {
  buildOperationalSnapshot,
  classifyOperationalRecord,
} from '../server/monitoring/operationalAlertPolicy.mjs';
import {
  buildIncidentEvidenceManifest,
  declareIncident,
  incidentPublicTemplate,
  transitionIncident,
} from '../server/monitoring/incidentControl.mjs';
import {
  buildReleaseEvidence,
  requiredReleaseChecks,
} from '../server/releaseEvidencePolicy.mjs';
import {
  buildServedAssetManifest,
  compareServedAsset,
  normalizeDeploymentOrigin,
  parseAllowedDeploymentHosts,
  servedAssetUrl,
  validateServedAssetManifest,
} from '../server/servedAssetIntegrityPolicy.mjs';
import {
  buildDependencySbom,
  serializeDependencySbom,
} from '../server/dependencySbomPolicy.mjs';
import {
  classifyLegacyIdentifierLine,
  evaluateLegacyIdentifierInventory,
} from '../server/legacyIdentifierPolicy.mjs';
import { evaluateDatabaseBaseline } from '../scripts/verify-database-baseline.mjs';
import { validateDatabaseOwnershipInventory } from '../scripts/validate-database-ownership-inventory.mjs';
import { apiRoutePolicy, evaluateApiMutationOriginPolicy } from '../server/apiMutationOriginPolicy.mjs';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const readJson = relativePath => JSON.parse(readFileSync(new URL(relativePath, root), 'utf8'));
const readText = relativePath => readFileSync(new URL(relativePath, root), 'utf8');
const authRequest = (body = {}, headers = {}) => ({
  method: 'POST',
  headers: {
    origin: 'https://dealivra.test',
    host: 'dealivra.test',
    'content-type': 'application/json',
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
    'cross-origin-opener-policy',
    'cross-origin-resource-policy',
    'origin-agent-cluster',
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
  assert.equal(values.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
  assert.equal(values.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(values.get('origin-agent-cluster'), '?1');
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

test('CSP report streams stop at the byte boundary before full allocation', async () => {
  let declaredPulls = 0;
  const declaredResponse = createResponse();
  await cspReportHandler({
    method: 'POST',
    headers: {
      'content-type': 'application/csp-report',
      'content-length': '16385',
    },
    async *[Symbol.asyncIterator]() {
      declaredPulls += 1;
      yield '{}';
    },
  }, declaredResponse);
  assert.equal(declaredResponse.statusCode, 413);
  assert.equal(declaredPulls, 0);

  let streamedPulls = 0;
  const streamedResponse = createResponse();
  await cspReportHandler({
    method: 'POST',
    headers: { 'content-type': 'application/reports+json' },
    async *[Symbol.asyncIterator]() {
      streamedPulls += 1;
      yield Buffer.alloc(16_384, 0x20);
      streamedPulls += 1;
      yield 'x';
      streamedPulls += 1;
      yield 'must-not-be-read';
    },
  }, streamedResponse);
  assert.equal(streamedResponse.statusCode, 413);
  assert.equal(streamedPulls, 2);

  const exactPayload = {
    'csp-report': {
      'effective-directive': 'script-src',
      padding: '',
    },
  };
  const emptyLength = Buffer.byteLength(JSON.stringify(exactPayload));
  exactPayload['csp-report'].padding = 'a'.repeat(16_384 - emptyLength);
  const exactBody = JSON.stringify(exactPayload);
  assert.equal(Buffer.byteLength(exactBody), 16_384);

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = value => warnings.push(String(value));
  try {
    const exactResponse = createResponse();
    await cspReportHandler({
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(exactBody.slice(0, 8_192));
        yield Buffer.from(exactBody.slice(8_192));
      },
    }, exactResponse);
    assert.equal(exactResponse.statusCode, 204);
    assert.equal(exactResponse.ended, true);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(warnings[0], /padding|a{20}/);
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
  assert.equal(legacyLog.document_url, 'https://dealivra.com/:page');
  assert.equal(legacyLog.blocked_url, 'https://evil.example/:page');
  assert.equal(legacyLog.source_url, 'https://dealivra.com/assets/:asset');
  assert.equal(legacyLog.effective_directive, 'script-src-elem');

  const modernLog = JSON.parse(warnings[1]);
  assert.equal(modernLog.document_url, 'https://dealivra.com/:page');
  assert.equal(modernLog.blocked_url, 'inline');

  const shortSecretWarnings = [];
  console.warn = value => shortSecretWarnings.push(String(value));
  try {
    const response = createResponse();
    await cspReportHandler(cspRequest({
      'csp-report': {
        'document-uri': 'https://dealivra.com/recover/abc123?token=private',
        'blocked-uri': 'https://cdn.example/customer/nika/photo.png',
        'source-file': 'https://dealivra.com/api/private-case-id',
        'effective-directive': 'script-src',
      },
    }), response);
    assert.equal(response.statusCode, 204);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(shortSecretWarnings.length, 1);
  const shortSecretLog = JSON.parse(shortSecretWarnings[0]);
  assert.equal(shortSecretLog.document_url, 'https://dealivra.com/:page');
  assert.equal(shortSecretLog.blocked_url, 'https://cdn.example/:page');
  assert.equal(shortSecretLog.source_url, 'https://dealivra.com/api/:endpoint');
  assert.doesNotMatch(shortSecretWarnings[0], /recover|abc123|customer|nika|private-case-id|photo/);
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
  assert.match(authService, /fetchWithDeadline\('\/api\/auth\/login'/);
  assert.match(authService, /fetchWithDeadline\('\/api\/auth\/refresh'/);
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

test('every authentication handler applies the runtime no-store response contract', async () => {
  for (const handler of [
    loginHandler,
    logoutHandler,
    mfaHandler,
    passwordHandler,
    recoverHandler,
    refreshHandler,
    signupHandler,
  ]) {
    const response = createResponse();
    await handler({ method: 'GET', headers: {} }, response);
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.get('allow'), 'POST');
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
});

test('every authentication handler rejects cross-origin POSTs before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not be called for a rejected origin.');
  };

  try {
    for (const handler of [
      loginHandler,
      logoutHandler,
      mfaHandler,
      passwordHandler,
      recoverHandler,
      refreshHandler,
      signupHandler,
    ]) {
      const response = createResponse();
      await handler({
        method: 'POST',
        headers: {
          origin: 'https://attacker.test',
          host: 'dealivra.test',
          'content-type': 'application/json',
        },
        body: {},
      }, response);
      assert.equal(response.statusCode, 403);
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('authentication handlers reject missing or ambiguous origin metadata before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not be called for unverifiable origin metadata.');
  };
  const unsafeHeaders = [
    { host: 'dealivra.test', 'content-type': 'application/json' },
    { origin: 'https://dealivra.test', 'content-type': 'application/json' },
    {
      origin: 'https://dealivra.test',
      host: 'dealivra.test',
      'x-forwarded-host': 'dealivra.test, attacker.test',
      'content-type': 'application/json',
    },
    { origin: 'null', host: 'dealivra.test', 'content-type': 'application/json' },
    { origin: 'not a URL', host: 'dealivra.test', 'content-type': 'application/json' },
    {
      origin: ['https://dealivra.test', 'https://attacker.test'],
      host: 'dealivra.test',
      'content-type': 'application/json',
    },
  ];

  try {
    for (const handler of [
      loginHandler,
      logoutHandler,
      mfaHandler,
      passwordHandler,
      recoverHandler,
      refreshHandler,
      signupHandler,
    ]) {
      for (const headers of unsafeHeaders) {
        const response = createResponse();
        await handler({ method: 'POST', headers, body: {} }, response);
        assert.equal(response.statusCode, 403);
        assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('JSON authentication mutations reject unsupported media before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not be called for an unsupported media type.');
  };

  try {
    for (const handler of [
      loginHandler,
      logoutHandler,
      mfaHandler,
      passwordHandler,
      recoverHandler,
      signupHandler,
    ]) {
      const response = createResponse();
      await handler({
        method: 'POST',
        headers: {
          origin: 'https://dealivra.test',
          host: 'dealivra.test',
          'content-type': 'text/plain',
        },
        body: '{}',
      }, response);
      assert.equal(response.statusCode, 415);
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('JSON authentication mutations reject ambiguous Content-Type arrays before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not receive an ambiguous media type.');
  };

  try {
    for (const handler of [
      loginHandler,
      logoutHandler,
      mfaHandler,
      passwordHandler,
      recoverHandler,
      signupHandler,
    ]) {
      const response = createResponse();
      await handler({
        method: 'POST',
        headers: {
          origin: 'https://dealivra.test',
          host: 'dealivra.test',
          'content-type': ['application/json', 'text/plain'],
        },
        body: {},
      }, response);
      assert.equal(response.statusCode, 415);
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('JSON authentication mutations reject oversized bodies before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not be called for an oversized request body.');
  };

  try {
    for (const [route, handler] of [
      ['login', loginHandler],
      ['logout', logoutHandler],
      ['mfa', mfaHandler],
      ['password', passwordHandler],
      ['recover', recoverHandler],
      ['signup', signupHandler],
    ]) {
      const response = createResponse();
      await handler({
        method: 'POST',
        headers: {
          origin: 'https://dealivra.test',
          host: 'dealivra.test',
          'content-type': 'application/json',
          'content-length': '16385',
        },
        body: JSON.stringify({ padding: 'x'.repeat(16_385) }),
      }, response);
      assert.ok(
        response.statusCode >= 400 && response.statusCode < 500,
        `${route} must reject an oversized request before provider access`,
      );
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('JSON authentication body limits cannot be bypassed with a false Content-Length', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not be called for a falsely declared oversized body.');
  };
  const oversizedBodies = [
    JSON.stringify({ padding: 'x'.repeat(16_385) }),
    { padding: 'x'.repeat(16_385) },
  ];

  try {
    for (const [route, handler] of [
      ['login', loginHandler],
      ['logout', logoutHandler],
      ['mfa', mfaHandler],
      ['password', passwordHandler],
      ['recover', recoverHandler],
      ['signup', signupHandler],
    ]) {
      for (const body of oversizedBodies) {
        const response = createResponse();
        await handler({
          method: 'POST',
          headers: {
            origin: 'https://dealivra.test',
            host: 'dealivra.test',
            'content-type': 'application/json',
            'content-length': '1',
          },
          body,
        }, response);
        assert.ok(
          response.statusCode >= 400 && response.statusCode < 500,
          `${route} must measure the actual request body instead of trusting Content-Length`,
        );
        assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('JSON authentication mutations reject malformed bodies before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not be called for malformed JSON.');
  };

  try {
    for (const [route, handler] of [
      ['login', loginHandler],
      ['logout', logoutHandler],
      ['mfa', mfaHandler],
      ['password', passwordHandler],
      ['recover', recoverHandler],
      ['signup', signupHandler],
    ]) {
      const response = createResponse();
      await handler({
        method: 'POST',
        headers: {
          origin: 'https://dealivra.test',
          host: 'dealivra.test',
          'content-type': 'application/json',
        },
        body: '{"incomplete":',
      }, response);
      assert.ok(
        response.statusCode >= 400 && response.statusCode < 500,
        `${route} must reject malformed JSON before provider access`,
      );
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('authenticated security mutations reject oversized bearer credentials before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not receive an oversized bearer credential.');
  };
  const authorization = `Bearer ${'x'.repeat(8_193)}`;
  const requests = [
    [logoutHandler, { scope: 'global' }],
    [mfaHandler, { action: 'list' }],
    [passwordHandler, { action: 'recovery', newPassword: 'Valid-password-123!' }],
  ];

  try {
    for (const [handler, body] of requests) {
      const response = createResponse();
      await handler({
        method: 'POST',
        headers: {
          origin: 'https://dealivra.test',
          host: 'dealivra.test',
          'content-type': 'application/json',
          authorization,
        },
        body,
      }, response);
      assert.ok(response.statusCode >= 400 && response.statusCode < 500);
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('authenticated security mutations reject ambiguous authorization arrays before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not receive an ambiguous authorization header.');
  };

  try {
    for (const [handler, body] of [
      [logoutHandler, { scope: 'global' }],
      [mfaHandler, { action: 'list' }],
      [passwordHandler, { action: 'recovery', newPassword: 'Valid-password-123!' }],
    ]) {
      const response = createResponse();
      await handler({
        method: 'POST',
        headers: {
          origin: 'https://dealivra.test',
          host: 'dealivra.test',
          'content-type': 'application/json',
          authorization: ['Bearer first', 'Bearer second'],
        },
        body,
      }, response);
      assert.ok(response.statusCode >= 400 && response.statusCode < 500);
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('authenticated security mutations reject control characters inside bearer credentials', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not receive a bearer credential containing control characters.');
  };

  try {
    for (const authorization of ['Bearer token\r\ninjected', 'Bearer token\tfragment', 'Bearer token fragment']) {
      for (const [handler, body] of [
        [logoutHandler, { scope: 'global' }],
        [mfaHandler, { action: 'list' }],
        [passwordHandler, { action: 'recovery', newPassword: 'Valid-password-123!' }],
      ]) {
        const response = createResponse();
        await handler({
          method: 'POST',
          headers: {
            origin: 'https://dealivra.test',
            host: 'dealivra.test',
            'content-type': 'application/json',
            authorization,
          },
          body,
        }, response);
        assert.ok(response.statusCode >= 400 && response.statusCode < 500);
        assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('authenticated security mutations reject padded or non-ASCII bearer credentials', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not receive a non-canonical bearer credential.');
  };

  try {
    for (const authorization of [
      `Bearer ${' '.repeat(8_200)}token`,
      `Bearer token${' '.repeat(8_200)}`,
      'Bearer töken',
    ]) {
      for (const [handler, body] of [
        [logoutHandler, { scope: 'global' }],
        [mfaHandler, { action: 'list' }],
        [passwordHandler, { action: 'recovery', newPassword: 'Valid-password-123!' }],
      ]) {
        const response = createResponse();
        await handler({
          method: 'POST',
          headers: {
            origin: 'https://dealivra.test',
            host: 'dealivra.test',
            'content-type': 'application/json',
            authorization,
          },
          body,
        }, response);
        assert.ok(response.statusCode >= 400 && response.statusCode < 500);
        assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('session refresh rejects oversized cookie credentials before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not receive an oversized refresh credential.');
  };

  try {
    for (const token of ['x'.repeat(8_193), `%41`.repeat(8_193)]) {
      const response = createResponse();
      await refreshHandler({
        method: 'POST',
        headers: {
          origin: 'https://dealivra.test',
          host: 'dealivra.test',
          cookie: `__Host-dealivra-refresh=${token}`,
        },
      }, response);
      assert.equal(response.statusCode, 401);
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('session refresh rejects non-ASCII or control characters before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not receive a malformed refresh credential.');
  };

  try {
    for (const token of ['token%0D%0Ainjected', 'token%09fragment', 't%C3%B6ken']) {
      const response = createResponse();
      await refreshHandler({
        method: 'POST',
        headers: {
          origin: 'https://dealivra.test',
          host: 'dealivra.test',
          cookie: `__Host-dealivra-refresh=${token}`,
        },
      }, response);
      assert.equal(response.statusCode, 401);
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('session refresh rejects ambiguous duplicate cookie credentials before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not receive ambiguous refresh credentials.');
  };

  try {
    const response = createResponse();
    await refreshHandler({
      method: 'POST',
      headers: {
        origin: 'https://dealivra.test',
        host: 'dealivra.test',
        cookie: '__Host-dealivra-refresh=first; theme=light; __Host-dealivra-refresh=second',
      },
    }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('session refresh rejects oversized cookie headers before parsing or provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not receive credentials from an oversized Cookie header.');
  };

  try {
    const response = createResponse();
    await refreshHandler({
      method: 'POST',
      headers: {
        origin: 'https://dealivra.test',
        host: 'dealivra.test',
        cookie: `noise=${'x'.repeat(16_384)}; __Host-dealivra-refresh=otherwise-valid`,
      },
    }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
});

test('session refresh rejects ambiguous Cookie header arrays before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('Auth provider must not receive a credential from ambiguous Cookie headers.');
  };

  try {
    const response = createResponse();
    await refreshHandler({
      method: 'POST',
      headers: {
        origin: 'https://dealivra.test',
        host: 'dealivra.test',
        cookie: [
          '__Host-dealivra-refresh=first',
          '__Host-dealivra-refresh=second',
        ],
      },
    }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerCalls, 0);
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

test('password login never writes a malformed provider credential or exceeds the cookie budget', async () => {
  for (const refreshToken of ['x'.repeat(3_801), 'é', 'token\r\ninjected']) {
    const response = createResponse();
    await withAuthProvider(async () => new Response(JSON.stringify(
      authProviderSession(refreshToken),
    ), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }), () => loginHandler(authRequest({
      email: 'user@example.com',
      password: 'ExamplePass123!',
    }), response));

    assert.equal(response.statusCode, 503);
    assert.equal(response.headers.has('set-cookie'), false);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  }
});

test('password login accepts the reviewed refresh cookie boundary without exceeding 4096 bytes', async () => {
  const response = createResponse();
  await withAuthProvider(async () => new Response(JSON.stringify(
    authProviderSession('x'.repeat(3_800)),
  ), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }), () => loginHandler(authRequest({
    email: 'user@example.com',
    password: 'ExamplePass123!',
  }), response));

  const cookie = response.headers.get('set-cookie');
  assert.equal(response.statusCode, 200);
  assert.ok(cookie);
  assert.ok(Buffer.byteLength(cookie, 'utf8') <= 4096);
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

test('Auth provider responses are byte-bounded JSON values with a controlled empty exception', async () => {
  const {
    AuthProviderResponseBoundaryError,
    readBoundedAuthProviderJson,
  } = await import('../server/authProviderResponse.mjs');

  assert.deepEqual(
    await readBoundedAuthProviderJson(new Response('{"access_token":"safe"}', {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })),
    { access_token: 'safe' },
  );
  assert.equal(
    await readBoundedAuthProviderJson(new Response('"admin"', {
      headers: { 'Content-Type': 'application/json' },
    })),
    'admin',
  );
  assert.equal(
    await readBoundedAuthProviderJson(new Response(null, { status: 204 }), {
      allowEmpty: true,
    }),
    null,
  );

  const rejected = [
    new Response('{}', { headers: { 'Content-Type': 'text/html' } }),
    new Response('{', { headers: { 'Content-Type': 'application/json' } }),
    new Response('', { headers: { 'Content-Type': 'application/json' } }),
    new Response('{}', {
      headers: {
        'Content-Length': '262145',
        'Content-Type': 'application/json',
      },
    }),
    new Response(`"${'é'.repeat(131_073)}"`, {
      headers: { 'Content-Type': 'application/json' },
    }),
  ];
  for (const response of rejected) {
    await assert.rejects(
      () => readBoundedAuthProviderJson(response),
      error => (
        error instanceof AuthProviderResponseBoundaryError
        && error.message === 'Authentication provider response was rejected.'
        && !error.message.includes('{')
      ),
    );
  }
});

test('Node provider response streams stop at the byte boundary before buffering the full body', async () => {
  const {
    readBoundedResponseText,
    ResponseBodyBoundaryError,
  } = await import('../server/responseBodyBoundary.mjs');
  let cancelled = false;
  const oversizedStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(180));
      controller.enqueue(new Uint8Array(180));
    },
    cancel() {
      cancelled = true;
    },
  });

  await assert.rejects(
    () => readBoundedResponseText(new Response(oversizedStream), 256),
    error => (
      error instanceof ResponseBodyBoundaryError
      && error.code === 'response_too_large'
      && error.message === 'Remote response body was rejected.'
    ),
  );
  assert.equal(cancelled, true);

  await assert.rejects(
    () => readBoundedResponseText(new Response('{}', {
      headers: { 'Content-Length': 'not-a-number' },
    }), 256),
    error => (
      error instanceof ResponseBodyBoundaryError
      && error.code === 'content_length_invalid'
    ),
  );
});

test('Auth provider transport uses one timeout and bounded parsing across Auth and RPC calls', async () => {
  const auth = await import('../server/authShared.mjs');
  const source = readText('server/authShared.mjs');
  const providerResponse = readText('server/authProviderResponse.mjs');
  const recovery = readText('api/security/mfa-recovery.mjs');
  let providerSignal;

  await withAuthProvider(async (_input, init) => {
    providerSignal = init?.signal;
    return new Response('{"access_token":"safe"}', {
      headers: { 'Content-Type': 'application/json' },
    });
  }, async () => {
    const upstream = await auth.supabaseAuthRequest('token?grant_type=password', {
      method: 'POST',
      body: '{}',
    }, authRequest());
    assert.deepEqual(await auth.authPayload(upstream), { access_token: 'safe' });
  });

  assert.ok(providerSignal instanceof AbortSignal);
  assert.equal(
    [...source.matchAll(/signal: AbortSignal\.timeout\(authProviderTimeoutMs\)/g)].length,
    3,
  );
  assert.match(source, /readBoundedAuthProviderJson\(upstream/);
  assert.doesNotMatch(source, /upstream\.json\(\)/);
  assert.match(providerResponse, /readBoundedResponseText\(response, maximumBytes\)/);
  assert.doesNotMatch(providerResponse, /response\.text\(\)/);
  assert.match(recovery, /authProviderPayload\(upstream\)/);
  assert.doesNotMatch(recovery, /upstream\.json\(\)/);
});

test('Auth provider requests use only reviewed routes, methods, headers, and bounded JSON', async () => {
  const {
    AuthProviderRequestBoundaryError,
    serializeBoundedAuthProviderJson,
    validateAuthProviderRequest,
  } = await import('../server/authProviderRequest.mjs');
  const origin = 'https://dealivra.test';
  const bearer = { Authorization: 'Bearer current-session-token' };
  const factorId = '11111111-1111-4111-8111-111111111111';

  for (const [path, init] of [
    ['signup', { method: 'POST', body: '{"email":"user@example.test"}' }],
    ['token?grant_type=password', { method: 'POST', body: '{}' }],
    ['token?grant_type=refresh_token', { method: 'POST', body: '{}' }],
    [`recover?redirect_to=${encodeURIComponent(origin)}`, {
      method: 'POST',
      body: '{"email":"user@example.test"}',
    }],
    ['user', { method: 'GET', headers: bearer }],
    ['user', { method: 'PUT', headers: bearer, body: '{"password":"safe"}' }],
    ['factors', { method: 'POST', headers: bearer, body: '{}' }],
    [`factors/${factorId}/challenge`, { method: 'POST', headers: bearer, body: '{}' }],
    [`factors/${factorId}/verify`, { method: 'POST', headers: bearer, body: '{}' }],
    [`factors/${factorId}`, { method: 'DELETE', headers: bearer }],
    ['logout?scope=global', { method: 'POST', headers: bearer, body: '{}' }],
  ]) {
    assert.doesNotThrow(() => validateAuthProviderRequest(path, init, origin));
  }
  assert.equal(serializeBoundedAuthProviderJson({ safe: true }), '{"safe":true}');

  const invalid = [
    ['admin/users', { method: 'GET', headers: bearer }],
    ['../rest/v1/profiles', { method: 'POST', body: '{}' }],
    ['token?grant_type=password&redirect_to=https://attacker.test', {
      method: 'POST',
      body: '{}',
    }],
    ['signup', { method: 'GET' }],
    ['signup', { method: 'POST', headers: bearer, body: '{}' }],
    ['user', { method: 'GET' }],
    ['user', { method: 'GET', headers: bearer, body: '{}' }],
    ['logout?scope=everything', { method: 'POST', headers: bearer, body: '{}' }],
    ['factors/not-a-uuid', { method: 'DELETE', headers: bearer }],
    ['signup', { method: 'POST', body: '[]' }],
    ['signup', { method: 'POST', body: '{' }],
    ['signup', { method: 'POST', body: `{"value":"${'é'.repeat(8_193)}"}` }],
    ['signup', { method: 'POST', body: '{}', redirect: 'follow' }],
  ];
  for (const [path, init] of invalid) {
    assert.throws(
      () => validateAuthProviderRequest(path, init, origin),
      error => (
        error instanceof AuthProviderRequestBoundaryError
        && error.message === 'Authentication provider request was rejected.'
        && !error.message.includes(path)
      ),
    );
  }
});

test('invalid Auth provider destinations fail before configuration or network access', async () => {
  const {
    supabaseAuthRequest,
    supabaseRestRpcRequest,
  } = await import('../server/authShared.mjs');
  let providerCalled = false;
  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  }, async () => {
    await assert.rejects(
      () => supabaseAuthRequest('../rest/v1/private', {
        method: 'POST',
        body: '{}',
      }, authRequest()),
      /Authentication provider request was rejected/,
    );
    await assert.rejects(
      () => supabaseRestRpcRequest(
        'current-session-token',
        'get_my_sensitive_change_holds',
        { value: 'é'.repeat(8_193) },
      ),
      /Authentication provider request was rejected/,
    );
  });
  assert.equal(providerCalled, false);
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
  const accountEntry = readText('src/AccountEntryPages.tsx');
  const recovery = readText('api/auth/recover.mjs');
  const forwarding = readText('docs/production-readiness/36_AUTH_PROXY_CLIENT_IP_BOUNDARY.md');
  const passwordBoundary = readText('docs/production-readiness/37_PASSWORD_MUTATION_BOUNDARY.md');
  const standard = readText('docs/production-readiness/35_AUTH_ABUSE_AND_RATE_LIMIT_ROLLOUT.md');
  const readinessIndex = readText('docs/production-readiness/README.md');
  const rejectionLogger = shared.replace(/\r\n/g, '\n').match(
    /export function logAuthRejection[\s\S]*?\n}\n/,
  )?.[0] ?? '';

  assert.match(shared, /schema: 'dealivra\.auth\.rejection\.v1'/);
  assert.match(shared, /Math\.min\(Math\.max\(parsedRetryAfter, 1\), 300\)/);
  assert.match(shared, /response\.setHeader\('Retry-After'/);
  assert.ok(rejectionLogger);
  assert.doesNotMatch(rejectionLogger, /email|password|token|cookie|x-forwarded-for/i);
  assert.match(client, /fetchWithDeadline\('\/api\/auth\/recover'/);
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
  assert.match(recoveredPassword, /fetchWithDeadline\('\/api\/auth\/password'/);
  assert.doesNotMatch(recoveredPassword, /auth\/v1\/user|supabaseUrl/);
  assert.match(accountPassword, /currentPassword/);
  assert.match(accountPassword, /fetchWithDeadline\('\/api\/auth\/password'/);
  assert.doesNotMatch(accountPassword, /auth\/v1\/user|supabaseUrl/);
  assert.match(accountEntry, /autoComplete=\{isSignup \? 'new-password' : 'current-password'\}/);
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
  const clientBoundary = readText('src/services/authBoundarySchemas.ts');
  const accountEntry = readText('src/AccountEntryPages.tsx');
  const profileWorkspace = readText('src/AccountProfileWorkspace.tsx');
  const standard = readText('docs/production-readiness/20_AUTH_PASSWORD_SECURITY.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(signup, /number, and a symbol/);
  assert.match(clientBoundary, /number, and a symbol/);
  assert.match(profileWorkspace, /12 characters with uppercase, lowercase, a number, and a symbol/);
  assert.match(accountEntry, /12\+ characters with uppercase, lowercase, a number, and a symbol/);
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
  const profileWorkspace = readText('src/AccountProfileWorkspace.tsx');
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
  assert.match(profileWorkspace, /<AccountMfaSecurity session=\{session\}/);
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

  for (const providerResponse of [
    new Response('<html>private provider error</html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    }),
    new Response(`{"message":"${'é'.repeat(131_073)}"}`, {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }),
  ]) {
    await assert.rejects(
      () => assertSensitiveChangeAllowed('access-token', 'email', {
        environment: { DEALIVRA_RECOVERY_CONTROL_MODE: 'enforced' },
        request: async () => providerResponse,
      }),
      error => (
        error?.code === 'recovery_protection_unavailable'
        && error?.status === 503
        && !error.message.includes('private')
      ),
    );
  }

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
  assert.doesNotMatch(
    readText('server/sensitiveChangeProtection.mjs'),
    /upstream\.json\(\)/,
  );
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
  assert.match(worker, /readSecurityNotificationProviderJson\(response\)/);
  assert.doesNotMatch(worker, /response\.body\?\.getReader\(\)/);
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

test('security notification provider responses use the shared bounded JSON stream', async () => {
  const { readSecurityNotificationProviderJson } = await import(
    '../supabase/functions/_shared/security-notification-response.ts'
  );
  const response = (body, headers = {}) => new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });

  assert.deepEqual(
    await readSecurityNotificationProviderJson(response(
      '{"id":"11111111-1111-4111-8111-111111111111"}',
    )),
    { id: '11111111-1111-4111-8111-111111111111' },
  );
  assert.equal(
    await readSecurityNotificationProviderJson(new Response('{}', {
      headers: { 'content-type': 'text/html' },
    })),
    null,
  );
  assert.equal(
    await readSecurityNotificationProviderJson(response('[]')),
    null,
  );
  assert.equal(
    await readSecurityNotificationProviderJson(response('{}', {
      'content-length': '999999',
    })),
    null,
  );

  const parser = readText(
    'supabase/functions/_shared/security-notification-response.ts',
  );
  assert.match(parser, /readBoundedResponseText\(response, maximumProviderBytes\)/);
  assert.doesNotMatch(parser, /response\.(?:json|text|arrayBuffer)\(\)/);
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
  assert.equal(response.headers.has('clear-site-data'), false);
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
  assert.equal(response.headers.has('clear-site-data'), false);
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
  assert.equal(response.headers.get('clear-site-data'), '"cache", "cookies", "storage"');
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
  assert.equal(response.headers.has('clear-site-data'), false);
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
  assert.equal(response.headers.has('clear-site-data'), false);
});

test('failed global revocation preserves browser data and the current cookie', async () => {
  const { default: logout } = await import('../api/auth/logout.mjs');
  const response = createResponse();

  await withAuthProvider(async () => new Response(
    JSON.stringify({ error_code: 'provider_failure' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  ), () => logout(authRequest({ scope: 'global' }, {
    authorization: 'Bearer current-session-token',
  }), response));

  assert.equal(response.statusCode, 502);
  assert.equal(response.headers.has('set-cookie'), false);
  assert.equal(response.headers.has('clear-site-data'), false);
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

test('runtime configuration contract blocks unsafe deployments without exposing values', async () => {
  const {
    evaluateRuntimeConfiguration,
    inferRuntimeEnvironment,
  } = await import('../server/runtimeConfigurationPolicy.mjs');
  const {
    verifyRuntimeConfigurationContract,
  } = await import('../scripts/verify-runtime-configuration.mjs');
  const packageJson = readJson('package.json');
  const fixtureUrl = 'https://fixture.supabase.co';
  const fixtureKey = 'sb_publishable_fixture_value_123456789';
  const secretSentinel = `sb_secret_${'s'.repeat(64)}`;

  assert.deepEqual(verifyRuntimeConfigurationContract(), {
    schema: 'dealivra.runtime-configuration-contract-result.v1',
    status: 'passed',
    environments: 4,
    targets: 3,
    descriptors: 36,
    deterministic_fixtures: 6,
  });
  assert.equal(inferRuntimeEnvironment({}), 'local');
  assert.equal(inferRuntimeEnvironment({ VERCEL_ENV: 'preview' }), 'preview');
  assert.equal(inferRuntimeEnvironment({ VERCEL_ENV: 'production' }), 'production');
  assert.equal(inferRuntimeEnvironment({
    VERCEL_ENV: 'preview',
    DEALIVRA_RUNTIME_ENVIRONMENT: 'staging',
  }), 'staging');
  assert.throws(
    () => inferRuntimeEnvironment({ DEALIVRA_RUNTIME_ENVIRONMENT: 'prod' }),
    /Explicit runtime environment is invalid/,
  );

  const blocked = evaluateRuntimeConfiguration({
    environment: 'production',
    values: { VERCEL_ENV: 'production' },
  });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.summary.missing, 4);
  assert.deepEqual(
    blocked.checks.filter(check => check.status === 'missing').map(check => check.name),
    [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_URL',
      'SUPABASE_PUBLISHABLE_KEY',
    ],
  );

  const configured = evaluateRuntimeConfiguration({
    environment: 'production',
    values: {
      VITE_SUPABASE_URL: fixtureUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: fixtureKey,
      SUPABASE_URL: fixtureUrl,
      SUPABASE_PUBLISHABLE_KEY: fixtureKey,
      SUPABASE_AUTH_SECRET_KEY: secretSentinel,
      VERCEL_ENV: 'production',
    },
  });
  assert.equal(configured.summary.missing, 0);
  assert.notEqual(configured.status, 'blocked');
  const serialized = JSON.stringify(configured);
  assert.ok(configured.checks.every(check => !Object.hasOwn(check, 'value')));
  assert.equal(serialized.includes(fixtureKey), false);
  assert.equal(serialized.includes(secretSentinel), false);

  const misaligned = evaluateRuntimeConfiguration({
    environment: 'preview',
    values: {
      VITE_SUPABASE_URL: fixtureUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: fixtureKey,
      SUPABASE_URL: 'https://other.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: fixtureKey,
      VERCEL_ENV: 'production',
    },
  });
  assert.equal(misaligned.status, 'blocked');
  assert.ok(misaligned.checks.some(check => (
    check.name === 'SUPABASE_PROJECT_ALIGNMENT'
    && check.issue === 'provider_origins_differ'
  )));
  assert.ok(misaligned.checks.some(check => (
    check.name === 'VERCEL_ENVIRONMENT_ALIGNMENT'
    && check.issue === 'deployment_environment_mismatch'
  )));

  const forwarding = evaluateRuntimeConfiguration({
    environment: 'local',
    values: { DEALIVRA_AUTH_IP_FORWARDING_MODE: 'enforced' },
  });
  assert.equal(forwarding.status, 'blocked');
  assert.ok(forwarding.checks.some(check => (
    check.name === 'SUPABASE_AUTH_SECRET_KEY'
    && check.status === 'missing'
  )));

  const stripe = evaluateRuntimeConfiguration({
    environment: 'local',
    target: 'edge',
    values: { DEALIVRA_CHECKOUT_MODE: 'sandbox' },
  });
  assert.equal(stripe.status, 'blocked');
  assert.deepEqual(
    stripe.checks.filter(check => check.status === 'missing').map(check => check.name),
    ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  );

  assert.equal(
    packageJson.scripts['config:verify'],
    'node scripts/verify-runtime-configuration.mjs --contract',
  );
  assert.equal(packageJson.scripts['config:check'], 'node scripts/verify-runtime-configuration.mjs');
  assert.match(packageJson.scripts.verify, /npm run config:verify/);
  assert.match(packageJson.scripts.build, /^npm run config:check/);
});

test('public health remains liveness-only and never exposes configuration readiness', () => {
  const source = readText('api/health.mjs');
  assert.doesNotMatch(source, /runtimeConfiguration|process\.env|missing|invalid|degraded/);

  const response = createResponse();
  healthHandler({ method: 'GET', headers: {} }, response);
  assert.deepEqual(response.payload, {
    schema: 'dealivra.health.v1',
    status: 'alive',
  });
});

test('legacy runtime identifiers are machine-governed migration aliases', async () => {
  const packageJson = readJson('package.json');
  const addressAutocomplete = readText('src/AddressAutocomplete.tsx');
  const authService = readText('src/services/supabaseRest.ts');
  const i18n = readText('src/i18nFull.ts');
  const checkoutFunction = readText('supabase/functions/stripe-create-checkout/index.ts');
  const edgeCommon = readText('supabase/functions/_shared/common.ts');
  const legacyRegister = readText('docs/production-readiness/11_LEGACY_IDENTIFIER_REGISTER.md');

  assert.doesNotMatch(addressAutocomplete, /dealsafe/i);
  assert.match(addressAutocomplete, /__dealivraGoogleMapsReady/);
  assert.match(authService, /dealivra-session-updated/);
  assert.match(authService, /dealivra-session-expired/);
  assert.match(i18n, /const languageKey='dealivra_language'/);
  assert.match(i18n, /localStorage\.removeItem\(legacyLanguageKey\)/);
  assert.match(checkoutFunction, /DEALIVRA_PLATFORM_FEE_BPS/);
  assert.match(checkoutFunction, /DEALSAFE_PLATFORM_FEE_BPS/);
  assert.doesNotMatch(edgeCommon, /VERCEL_PROJECT_SLUG"\) \|\| "dealsafe"/);
  assert.match(edgeCommon, /if \(!project \|\| !team\) return false/);
  assert.match(legacyRegister, /Approved migration aliases/);
  assert.match(legacyRegister, /must not be reused for a new feature/);
  assert.match(legacyRegister, /npm run brand:verify/);

  assert.equal(
    classifyLegacyIdentifierLine(
      'supabase/functions/stripe-connect/index.ts',
      'const key = `dealsafe-connect-${user.id}`;',
    ),
    'stripe-connect-idempotency-compatibility',
  );
  assert.equal(
    classifyLegacyIdentifierLine(
      'src/analytics.ts',
      "const event = 'dealsafe_checkout_started';",
    ),
    null,
  );

  const blocked = evaluateLegacyIdentifierInventory([
    {
      path: 'src/analytics.ts',
      source: "const event = 'dealsafe_checkout_started';",
    },
  ]);
  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.issues.some(issue => issue.issue === 'unapproved_legacy_identifier'));

  const { verifyLegacyIdentifiers } = await import('../scripts/verify-legacy-identifiers.mjs');
  const current = verifyLegacyIdentifiers(rootPath);
  assert.equal(current.status, 'passed');
  assert.equal(current.legacy_occurrences, 173);
  assert.equal(current.approved_aliases, 9);
  assert.equal(packageJson.scripts['brand:verify'], 'node scripts/verify-legacy-identifiers.mjs');
  assert.match(packageJson.scripts.verify, /npm run brand:verify/);
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

test('VIN provider response streams are bounded before JSON parsing', async () => {
  const {
    decodeVehicleVin,
    resetVehicleVinCacheForTests,
  } = await import('../server/vehicleVinShared.mjs');
  const source = readText('server/vehicleVinShared.mjs');
  resetVehicleVinCacheForTests();

  await assert.rejects(
    () => decodeVehicleVin('1M8GDM9AXKP042788', '1989', {
      fetchImplementation: async () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(200_000));
          controller.enqueue(new Uint8Array(60_001));
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    }),
    error => (
      error?.code === 'VIN_PROVIDER_INVALID_RESPONSE'
      && error.message === 'The VIN provider returned an invalid response.'
    ),
  );
  assert.match(source, /readBoundedResponseText\(upstream, maximumProviderBytes\)/);
  assert.doesNotMatch(source, /upstream\.text\(\)/);
  resetVehicleVinCacheForTests();
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
  const publicRoutes = readText('src/PublicRoutePages.tsx');

  assert.match(app, /<CatalogSearchPanel deals=\{availableDeals\}/);
  assert.match(app, /<SavedDealsPanel items=\{filteredSavedDeals\}/);
  assert.match(app, /<EnhancedDashboard deals=\{filteredDeals\} allDeals=\{deals\}/);
  assert.match(publicRoutes, /view === 'home' && isAuthenticated/);
  assert.match(publicRoutes, /indexable: false/);
  assert.match(panel, /Filters stay in this URL/);
  assert.match(panel, /Choose category first/);
  assert.match(styles, /@media\(max-width:480px\)/);
});

test('active catalog release has verified ownership, evidence, source, metrics, and rollback controls', async () => {
  const pointer = readJson('catalog/active-release.json');
  const manifest = readJson(pointer.manifest);
  const {
    catalogDatasetDigest,
    validateCatalogRelease,
  } = await import('../scripts/validate-catalog-release.mjs');
  const report = validateCatalogRelease(rootPath);

  assert.equal(
    catalogDatasetDigest('{"catalog":"portable"}\n'),
    catalogDatasetDigest('{"catalog":"portable"}\r\n'),
  );
  assert.throws(
    () => catalogDatasetDigest('{"catalog":"invalid"}\r'),
    /unsupported carriage-return line ending/,
  );
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
  const administration = readText('src/AdministrationWorkspace.tsx');

  assert.match(migration, /if not public\.is_dealsafe_admin\(\)/);
  assert.match(migration, /p_days not in \(7, 30, 90\)/);
  assert.match(migration, /group by deal\.catalog_version, deal\.category_id/);
  assert.match(migration, /revoke all on function public\.get_admin_catalog_adoption\(integer\) from public, anon/);
  assert.match(migration, /grant execute on function public\.get_admin_catalog_adoption\(integer\) to authenticated/);
  assert.doesNotMatch(migration, /returns table\([\s\S]*\bdeal_id\b/);
  assert.doesNotMatch(migration, /returns table\([\s\S]*\buser_id\b/);
  assert.doesNotMatch(migration, /returns table\([\s\S]*\bemail\b/);
  assert.match(client, /getAdminCatalogAdoption/);
  assert.match(
    administration,
    /<AdminCatalogCenter session=\{session\}\s*\/>/,
  );
  assert.match(administration, /Only aggregate version and category counts are returned/);
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
  const profileWorkspace = readText('src/AccountProfileWorkspace.tsx');
  const sessionStandard = readText('docs/production-readiness/13_SESSION_SECURITY.md');

  assert.match(client, /scope:SignOutScope='local'/);
  assert.match(client, /sessionForRemoteRevocation\(session\)/);
  assert.match(client, /revokeServerSession\(current\.accessToken,'others'\)/);
  assert.match(client, /revokeServerSession\(current\.accessToken,'global'\)/);
  assert.match(component, /Sign out other devices/);
  assert.match(component, /Sign out everywhere/);
  assert.match(component, /You will need to sign in again everywhere/);
  assert.match(component, /Review your account sessions without exposing location or IP information/);
  assert.match(profileWorkspace, /<AccountSessionSecurity session=\{session\}/);
  assert.match(app, /<AccountProfileWorkspace/);
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
  assert.match(
    migration,
    /\(select public\.can_admin_read_deal_evidence\(deal_evidence\.deal_id\)\)/,
  );
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
  assert.match(webhook, /readBoundedRequestText\(request, maxWebhookBytes\)/);
  assert.match(webhook, /error instanceof RequestBodyBoundaryError/);
  assert.doesNotMatch(webhook, /request\.text\(\)/);
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
  assert.match(webhook, /tooLarge \? 413 : 400/);
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
  const paymentWorkspace = readText('src/DealPaymentWorkspace.tsx');
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
  assert.match(paymentWorkspace, /waiting for Dealivra operations review/);
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
  const {
    EvidenceScanError,
    readBoundedScannerJson,
    validateScannerVerdict,
  } = await import(
    '../supabase/functions/_shared/evidence-scan.ts'
  );
  const sha256 = 'a'.repeat(64);
  assert.deepEqual(
    await readBoundedScannerJson(new Response(JSON.stringify({
      verdict: 'clean',
      sha256,
      scanId: 'scan-123',
      engine: 'clamav-gateway-v1',
    }), {
      headers: { 'content-type': 'application/json' },
    })),
    {
      verdict: 'clean',
      sha256,
      scanId: 'scan-123',
      engine: 'clamav-gateway-v1',
    },
  );
  await assert.rejects(
    () => readBoundedScannerJson(new Response('{}', {
      headers: { 'content-type': 'text/html' },
    })),
    error => (
      error instanceof EvidenceScanError
      && error.code === 'scanner_response_invalid'
      && !error.message.includes('{}')
    ),
  );
  await assert.rejects(
    () => readBoundedScannerJson(new Response(
      `{"value":"${'😀'.repeat(4_100)}"}`,
      { headers: { 'content-type': 'application/json' } },
    )),
    error => (
      error instanceof EvidenceScanError
      && error.code === 'scanner_response_invalid'
    ),
  );
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
  assert.match(scanner, /readBoundedResponseText\(response, 16_384\)/);
  assert.doesNotMatch(scanner, /response\.arrayBuffer\(\)/);

  assert.match(client, /functions\/v1\/evidence-files/);
  assert.match(client, /deal_evidence_safe/);
  assert.match(
    client,
    /readExactBlobArrayBuffer\(preparedFile,preparedFile\.size\)/,
  );
  assert.doesNotMatch(client, /preparedFile\.arrayBuffer\(\)/);
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
  const normalizedEdgeFunction = edgeFunction.replace(/\r\n/g, '\n');

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

  const downloadIndex = normalizedEdgeFunction.indexOf('.from("deal-evidence")\n    .download(evidence.storage_path)');
  const hashIndex = normalizedEdgeFunction.indexOf('evidenceSha256(bytes)');
  const integrityIndex = normalizedEdgeFunction.indexOf('recordIntegrityResult(evidence.id, userId', hashIndex);
  const signedIndex = normalizedEdgeFunction.indexOf('createSignedUrl(evidence.storage_path, evidenceSignedUrlTtlSeconds)');
  assert.ok(downloadIndex >= 0, 'Evidence viewer must download the private object for revalidation');
  assert.ok(hashIndex > downloadIndex, 'Evidence digest must be recomputed after private download');
  assert.ok(integrityIndex > hashIndex, 'Integrity result must be recorded after digest computation');
  assert.ok(signedIndex > integrityIndex, 'Signed URL must be created only after integrity recording');
  assert.match(edgeFunction, /integrity\.integrity_status !== "verified"/);
  assert.match(edgeFunction, /evidence_integrity_failed/);

  assert.match(client, /export async function loadDealEvidenceViewer/);
  assert.match(client, /credentials:'omit',referrerPolicy:'no-referrer'/);
  assert.match(client, /URL\.createObjectURL\(new Blob/);
  assert.match(client, /readExactArrayBuffer\(response,data\.fileSizeBytes\)/);
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

test('agreement UI and PDF render one immutable server-authoritative version', () => {
  const migration = readText('supabase/canonical_agreement_record.sql');
  const rollback = readText('supabase/canonical_agreement_record_rollback.sql');
  const history = readText('supabase/agreement_history_setup.sql');
  const verifier = readText('supabase/agreement_verification_setup.sql');
  const hardening = readText('supabase/production_auth_rbac_hardening.sql');
  const client = readText('src/services/supabaseRest.ts');
  const agreementRuntime = readText(
    'src/services/agreementRuntimeSchemas.ts',
  );
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealWorkspace.tsx');
  const printDocument = readText('src/AgreementPrintDocument.tsx');

  assert.match(migration, /add column if not exists canonical_payload jsonb/);
  assert.match(migration, /add column if not exists canonical_hash text/);
  assert.match(migration, /'schema', 'dealivra\.agreement\.v1'/);
  assert.match(migration, /'identifier', nullif\(trim\(coalesce\(p_identifier, ''\)\), ''\)/);
  assert.match(migration, /'catalog_identity', p_terms_json->'catalog_identity'/);
  assert.match(migration, /'seller_declarations', p_terms_json->'seller_declarations'/);
  assert.match(migration, /extensions\.digest\([\s\S]*convert_to\(snapshot\.payload::text, 'UTF8'\)/);
  assert.doesNotMatch(
    migration.match(/with agreement_snapshots[\s\S]*?where agreement\.id = snapshot\.id;/)?.[0] || '',
    /content_hash\s*=/,
    'Legacy hashes must survive canonical backfill',
  );
  assert.match(migration, /before insert on public\.agreement_versions/);
  assert.match(migration, /Published agreement versions are immutable/);
  assert.match(migration, /create or replace function public\.get_public_agreement_document/);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/);
  assert.match(migration, /revoke all on function public\.get_public_agreement_document[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_public_agreement_document[\s\S]*to anon, authenticated/);
  assert.match(migration, /agreement\.canonical_hash[\s\S]*or lower\(agreement\.content_hash\)/);
  assert.match(rollback, /Intentionally retain/);
  assert.doesNotMatch(rollback, /drop column/);

  assert.match(history, /coalesce\(agreement\.canonical_hash,agreement\.content_hash\)/);
  assert.match(verifier, /agreement\.canonical_hash/);
  assert.match(hardening, /'get_public_agreement_document'/);
  const rollbackProof = readText(
    'supabase/tests/canonical_agreement_record_rollback.sql',
  );
  assert.match(rollbackProof, /AGR-001 canonical backfill or SHA-256 integrity failed/);
  assert.match(rollbackProof, /AGR-001 agreement mutation unexpectedly succeeded/);
  assert.match(rollbackProof, /AGR-001 public agreement privacy boundary changed/);
  assert.match(client, /export interface AgreementDocumentSnapshot/);
  assert.match(client, /getPublicAgreementDocument/);
  assert.match(client, /agreementDocumentRequests=new Map/);
  assert.match(client, /parseAgreementDocumentRows/);
  assert.match(
    agreementRuntime,
    /source\.schema_version !== 'dealivra\.agreement\.v1'/,
  );
  assert.match(agreementRuntime, /const hashPattern = \/\^\[a-f0-9\]\{64\}\$\//);
  assert.match(workspace, /<AgreementPrintDocument deal=\{deal\}/);
  assert.match(printDocument, /useStoredAgreementDocument/);
  assert.match(printDocument, /SERVER-RECORDED SHA-256 AGREEMENT CODE/);
  assert.match(printDocument, /record\.content_hash\.toUpperCase\(\)/);
  assert.match(printDocument, /record\.title/);
  assert.match(printDocument, /record\.price_cents/);
  assert.match(printDocument, /record\.seller_declarations/);
  assert.match(printDocument, /record\.catalog_identity/);
  assert.doesNotMatch(app, /createAgreementFingerprint/);
  assert.equal(
    existsSync(join(rootPath, 'src', 'agreementFingerprint.ts')),
    false,
    'The obsolete browser-generated agreement hash helper must be removed',
  );
});

test('agreement PDF has accessible structure and print-safe layout rules', () => {
  const printDocument = readText('src/AgreementPrintDocument.tsx');
  const styles = readText('src/agreement-export.css');
  const standard = readText(
    'docs/production-readiness/39_ACCESSIBLE_AGREEMENT_PDF.md',
  );
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(
    printDocument,
    /className="agreement-print-document"[\s\S]*role="document"[\s\S]*aria-labelledby="agreement-document-title"[\s\S]*aria-describedby="agreement-document-summary"/,
  );
  assert.match(
    printDocument,
    /role="toolbar"[\s\S]*aria-label=\{t\('Agreement document actions'\)\}/,
  );
  assert.match(printDocument, /id="agreement-participants-title"/);
  assert.match(printDocument, /id="agreement-terms-title"/);
  assert.match(printDocument, /id="agreement-declarations-title"/);
  assert.match(printDocument, /id="agreement-verification-title"/);
  assert.match(
    printDocument,
    /role="note"[\s\S]*aria-label="Important platform notice"/,
  );
  assert.match(
    printDocument,
    /onClick=\{\(\) => window\.print\(\)\}/,
  );

  assert.match(styles, /@page\{\s*size:Letter;/);
  assert.match(styles, /overflow-wrap:anywhere/);
  assert.match(styles, /orphans:3;widows:3/);
  assert.match(styles, /break-inside:avoid-page/);
  assert.match(styles, /page-break-inside:avoid/);
  assert.match(styles, /\.agreement-print-hero h1\{[^}]*overflow-wrap:anywhere/);
  assert.doesNotMatch(styles, /\.agreement-print-section\{[^}]*break-inside:avoid/);
  assert.match(standard, /does not activate Production/i);
  assert.match(standard, /Remaining activation evidence/);
  assert.match(readinessIndex, /39_ACCESSIBLE_AGREEMENT_PDF\.md/);
});

test('browser route resolver preserves deep links and rejects unknown paths', async () => {
  const { resolveBrowserRoute } = await import('../src/navigation.ts');

  assert.deepEqual(resolveBrowserRoute('https://dealivra.com/'), { view: 'home' });
  assert.deepEqual(resolveBrowserRoute('https://dealivra.com/#protection'), { view: 'home' });
  assert.deepEqual(resolveBrowserRoute('https://dealivra.com/fees/'), { view: 'fees' });
  assert.deepEqual(resolveBrowserRoute('https://dealivra.com/verify'), { view: 'verify' });
  assert.deepEqual(resolveBrowserRoute('https://dealivra.com/?start=create'), { view: 'create' });
  assert.deepEqual(resolveBrowserRoute('https://dealivra.com/?start=signin'), {
    view: 'auth',
    authMode: 'signin',
  });
  assert.deepEqual(resolveBrowserRoute('https://dealivra.com/?start=signup'), {
    view: 'auth',
    authMode: 'signup',
  });
  assert.deepEqual(resolveBrowserRoute('https://dealivra.com/?trust=TP-123'), {
    view: 'passport',
    trustId: 'TP-123',
  });
  assert.deepEqual(resolveBrowserRoute('https://dealivra.com/?deal=DV-123&document=1'), {
    view: 'deal',
    publicDealId: 'DV-123',
    documentMode: true,
  });
  assert.deepEqual(
    resolveBrowserRoute('https://dealivra.com/?start=create#type=recovery&access_token=secret'),
    { view: 'reset', recoveryToken: 'secret' },
  );
  assert.deepEqual(resolveBrowserRoute('https://dealivra.com/missing?deal=DV-123'), {
    view: 'not-found',
  });

  const app = readText('src/app.tsx');
  const main = readText('src/main.tsx');
  const errorBoundary = readText('src/AppErrorBoundary.tsx');
  assert.match(app, /const onPopState=\(\)=>setRouteRevision/);
  assert.match(app, /setView\('route-loading'\)/);
  assert.match(app, /view==='not-found'&&<NotFoundPage/);
  assert.doesNotMatch(app, /const viewFromPath=/);
  assert.match(main, /<AppErrorBoundary><App \/><\/AppErrorBoundary>/);
  assert.match(main, /<AppErrorBoundary><PublicLanding/);
  assert.match(errorBoundary, /static getDerivedStateFromError/);
  assert.match(errorBoundary, /componentDidCatch/);
  assert.match(errorBoundary, /No transaction action was completed on this screen/);
  assert.doesNotMatch(errorBoundary, /\{error\.message\}/);
});

test('authentication origin checks reject malformed and insecure public origins', async () => {
  const { default: login } = await import('../api/auth/login.mjs');
  let providerCalled = false;

  for (const headers of [
    { origin: 'https://dealivra.test/embedded-path' },
    { origin: 'http://dealivra.test' },
    { origin: 'https://dealivra.test', 'x-forwarded-host': 'dealivra.test,attacker.example' },
    { origin: 'https://dealivra.test', 'x-forwarded-host': 'dealivra.test/path' },
    { origin: 'https://dealivra.test', 'x-forwarded-host': ' user@dealivra.test' },
  ]) {
    const response = createResponse();
    await withAuthProvider(async () => {
      providerCalled = true;
      throw new Error('The provider must not be called.');
    }, () => login(authRequest({
      email: 'user@example.com',
      password: 'ExamplePass123!',
    }, headers), response));

    assert.equal(response.statusCode, 403);
  }

  assert.equal(providerCalled, false);
});

test('JSON mutation endpoints reject unsupported media before provider contact', async () => {
  const { default: login } = await import('../api/auth/login.mjs');
  const response = createResponse();
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  }, () => login(authRequest({
    email: 'user@example.com',
    password: 'ExamplePass123!',
  }, {
    'content-type': 'text/plain',
  }), response));

  assert.equal(response.statusCode, 415);
  assert.equal(response.payload.error, 'Content-Type must be application/json.');
  assert.equal(providerCalled, false);
});

test('logout requires JSON media before session revocation', async () => {
  const { default: logout } = await import('../api/auth/logout.mjs');
  const response = createResponse();
  let providerCalled = false;

  await withAuthProvider(async () => {
    providerCalled = true;
    throw new Error('The provider must not be called.');
  }, () => logout(authRequest({ scope: 'global' }, {
    authorization: 'Bearer access-token',
    'content-type': 'text/plain',
  }), response));

  assert.equal(response.statusCode, 415);
  assert.equal(response.payload.error, 'Content-Type must be application/json.');
  assert.equal(providerCalled, false);
});

test('diagnostic request boundary rejects noncanonical origins and media consistently', () => {
  const validHeaders = {
    origin: 'https://dealivra.test',
    host: 'dealivra.test',
    'content-type': 'application/json; charset=utf-8',
  };
  const valid = createResponse();
  assert.equal(validateReportingRequest({ method: 'POST', headers: validHeaders }, valid), true);

  for (const [headers, expectedStatus] of [
    [{ ...validHeaders, origin: 'http://dealivra.test' }, 403],
    [{ ...validHeaders, origin: 'https://user@dealivra.test' }, 403],
    [{ ...validHeaders, origin: 'https://dealivra.test/path' }, 403],
    [{ ...validHeaders, host: 'dealivra.test, attacker.test' }, 403],
    [{ ...validHeaders, 'content-type': 'text/plain' }, 415],
  ]) {
    const response = createResponse();
    assert.equal(validateReportingRequest({ method: 'POST', headers }, response), false);
    assert.equal(response.statusCode, expectedStatus);
  }
});

test('diagnostic request body reader enforces byte limits before and during streaming', async () => {
  let consumedChunks = 0;
  const declaredOversize = {
    headers: { 'content-length': '9' },
    async *[Symbol.asyncIterator]() {
      consumedChunks += 1;
      yield Buffer.from('{}');
    },
  };
  assert.equal(await readBoundedReportingJson(declaredOversize, 8), null);
  assert.equal(consumedChunks, 0);

  const streamedOversize = {
    headers: {},
    async *[Symbol.asyncIterator]() {
      for (const chunk of ['{"a":', '"1234"', ',"ignored":true}']) {
        consumedChunks += 1;
        yield Buffer.from(chunk);
      }
    },
  };
  consumedChunks = 0;
  assert.equal(await readBoundedReportingJson(streamedOversize, 8), null);
  assert.equal(consumedChunks, 2);

  const exactJson = '{"ok":1}';
  assert.deepEqual(
    await readBoundedReportingJson({ body: exactJson, headers: {} }, Buffer.byteLength(exactJson)),
    { ok: 1 },
  );
  assert.deepEqual(
    await readBoundedReportingJson({ body: Buffer.from(exactJson), headers: {} }, Buffer.byteLength(exactJson)),
    { ok: 1 },
  );
});

test('diagnostic request body reader rejects malformed, empty, cyclic, and multibyte overflow payloads', async () => {
  const cyclic = {};
  cyclic.self = cyclic;

  for (const request of [
    { headers: {} },
    { body: '', headers: {} },
    { body: '{', headers: {} },
    { body: cyclic, headers: {} },
    { body: { value: '😀' }, headers: {} },
  ]) {
    assert.equal(await readBoundedReportingJson(request, 8), null);
  }
});

test('API mutation origin inventory fails closed for new and weakened routes', () => {
  const repositorySources = {};
  for (const route of Object.keys(apiRoutePolicy)) repositorySources[route] = readText(route);

  assert.equal(evaluateApiMutationOriginPolicy(repositorySources).status, 'passed');
  const unreviewed = evaluateApiMutationOriginPolicy({
    ...repositorySources,
    'api/new-mutation.mjs': "request.method !== 'POST'",
  });
  assert.deepEqual(unreviewed.findings, [
    { route: 'api/new-mutation.mjs', issue: 'unreviewed_route' },
  ]);
  const weakened = evaluateApiMutationOriginPolicy({
    ...repositorySources,
    'api/auth/login.mjs': repositorySources['api/auth/login.mjs'].replaceAll('requireSameOrigin', 'removedOriginGuard'),
  });
  assert.ok(weakened.findings.some((finding) => finding.route === 'api/auth/login.mjs'));

  const decoy = evaluateApiMutationOriginPolicy({
    ...repositorySources,
    'api/auth/login.mjs': repositorySources['api/auth/login.mjs']
      .replace('requireSameOrigin(request, response)', 'removedOriginGuard(request, response)')
      .replace(
        'export default async function handler',
        "// requireSameOrigin(request, response)\nconst decoy = 'requireSameOrigin';\nexport default async function handler",
      ),
  });
  assert.ok(
    decoy.findings.some((finding) => finding.route === 'api/auth/login.mjs'),
    'comments and string literals must not satisfy a request-boundary control',
  );

  const topLevelDecoy = evaluateApiMutationOriginPolicy({
    ...repositorySources,
    'api/auth/login.mjs': repositorySources['api/auth/login.mjs']
      .replace('requireSameOrigin(request, response)', 'removedOriginGuard(request, response)')
      .replace(
        'export default async function handler',
        'requireSameOrigin({}, {});\nexport default async function handler',
      ),
  });
  assert.ok(
    topLevelDecoy.findings.some((finding) => finding.route === 'api/auth/login.mjs'),
    'a control outside the exported handler must not satisfy the route policy',
  );
});

test('public and authenticated mobile navigation can close without pointer input', () => {
  const app = readText('src/app.tsx');
  const landing = readText('src/PublicLanding.tsx');

  for (const source of [app, landing]) {
    assert.match(source, /mobileMenuButtonRef/);
    assert.match(source, /event\.key\s*!==\s*'Escape'/);
    assert.match(source, /mobileMenuButtonRef\.current\?\.focus\(\)/);
    assert.match(source, /window\.innerWidth\s*>\s*860/);
    assert.match(source, /aria-expanded=\{mobileMenuOpen\}/);
    assert.match(source, /aria-controls=/);
  }
  assert.match(app, /id="application-mobile-navigation"/);
  assert.match(landing, /id="mobile-navigation"/);
  assert.match(landing, /Make every private deal <br \/><span>clear from the start\.<\/span>/);
});

test('public route presentation and metadata are isolated from application state', () => {
  const app = readText('src/app.tsx');
  const publicRoutes = readText('src/PublicRoutePages.tsx');

  assert.match(
    app,
    /import \{ applyPageMetadata, DealLinkError, getPageMetadata, NotFoundPage, PublicInfoPage, RouteLoading \} from '\.\/PublicRoutePages'/,
  );
  assert.match(app, /getPageMetadata\(view,active\?\.title,Boolean\(user\)\)/);
  assert.match(app, /isPublicInfoView\(view\)&&<PublicInfoPage/);
  assert.doesNotMatch(app, /const publicInfoContent/);
  assert.doesNotMatch(app, /function PublicInfoPage/);
  assert.doesNotMatch(app, /function RouteLoading/);
  assert.doesNotMatch(app, /function NotFoundPage/);
  assert.doesNotMatch(app, /function DealLinkError/);

  assert.match(publicRoutes, /const publicInfoContent: Record<PublicInfoView, PublicInfoContent>/);
  assert.match(publicRoutes, /export const getPageMetadata/);
  assert.match(publicRoutes, /export const applyPageMetadata/);
  assert.match(publicRoutes, /export function PublicInfoPage/);
  assert.match(publicRoutes, /export function RouteLoading/);
  assert.match(publicRoutes, /export function NotFoundPage/);
  assert.match(publicRoutes, /export function DealLinkError/);
  assert.match(publicRoutes, /noindex,nofollow,noarchive/);
  assert.match(publicRoutes, /link\[rel="canonical"\]/);
  assert.match(publicRoutes, /https:\/\/dealivra\.com/);
});

test('account entry and recovery pages are isolated without moving authentication state', () => {
  const app = readText('src/app.tsx');
  const accountEntry = readText('src/AccountEntryPages.tsx');

  assert.match(
    app,
    /import \{ AccountEntryPage, ForgotPassword, ForgotPasswordEntry, ResetPassword, type AuthFormState, type AuthMode \} from '\.\/AccountEntryPages'/,
  );
  assert.match(app, /const submitAuth=async\(e:React\.FormEvent\)=>/);
  assert.match(app, /await signUp\(authForm\.email,authForm\.password,authForm\.displayName\)/);
  assert.match(app, /await signIn\(authForm\.email,authForm\.password\)/);
  assert.match(app, /view==='auth'&&!mfaLogin&&<AccountEntryPage/);
  assert.doesNotMatch(app, /function ForgotPassword/);
  assert.doesNotMatch(app, /function ResetPassword/);
  assert.doesNotMatch(app, /className="form-wrap auth-wrap"/);
  assert.doesNotMatch(app, /className="policy-consent"/);

  assert.match(accountEntry, /export function AccountEntryPage/);
  assert.match(accountEntry, /export function ForgotPasswordEntry/);
  assert.match(accountEntry, /export function ForgotPassword/);
  assert.match(accountEntry, /export function ResetPassword/);
  assert.match(accountEntry, /await requestPasswordReset\(email\)/);
  assert.match(accountEntry, /await updateRecoveredPassword\(token, password\)/);
  assert.match(accountEntry, /autoComplete=\{isSignup \? 'new-password' : 'current-password'\}/);
  assert.match(accountEntry, /publicInfoPaths\.terms/);
  assert.match(accountEntry, /publicInfoPaths\.privacy/);
  assert.match(accountEntry, /minLength=\{12\}/);
});

test('account profile and security workspace is isolated without moving session ownership', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/AccountProfileWorkspace.tsx');
  const sessionSecurity = readText('src/AccountSessionSecurity.tsx');

  assert.match(
    app,
    /import\('\.\/AccountProfileWorkspace'\)/,
  );
  assert.match(
    app,
    /view==='profile'&&session&&<React\.Suspense[\s\S]*<AccountProfileWorkspace/,
  );
  assert.match(app, /onSessionUpdated=\{setSession\}/);
  assert.match(app, /onSignedOut=\{finishSignedOutSession\}/);
  assert.match(app, /onRequestVerification=\{requestVerification\}/);
  assert.doesNotMatch(app, /function SecurityCenter/);
  assert.doesNotMatch(app, /function AccountSettings/);
  assert.doesNotMatch(app, /function TrustPassportControls/);
  assert.doesNotMatch(app, /className="profile-page"/);
  assert.doesNotMatch(app, /updateAccountName|updateAccountPassword/);
  assert.doesNotMatch(app, /getTrustPassportSettings|setTrustPassportEnabled/);

  assert.match(workspace, /export function AccountProfileWorkspace/);
  assert.match(workspace, /function SecurityCenter/);
  assert.match(workspace, /function AccountSettings/);
  assert.match(workspace, /function TrustPassportControls/);
  assert.match(workspace, /function ProfileOverview/);
  assert.match(workspace, /<AccountMfaSecurity session=\{session\}/);
  assert.match(workspace, /<AccountSessionSecurity session=\{session\}/);
  assert.match(workspace, /updateAccountName\(session, name\)/);
  assert.match(workspace, /updateAccountPassword\(session, currentPassword, password\)/);
  assert.match(workspace, /getTrustPassportSettings\(session\)/);
  assert.match(workspace, /setTrustPassportEnabled\(session, enabled\)/);
  assert.match(sessionSecurity, /\[session\.user\.id,session\.accessToken\]/);
});

test('deal creation presentation is isolated without moving draft persistence ownership', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealCreationWorkspace.tsx');
  const dealFeatures = readText('src/DealWorkspaceFeatures.tsx');

  assert.match(app, /DealCreationWorkspace/);
  assert.match(app, /view==='create'&&<DealCreationWorkspace/);
  assert.match(app, /const \[draft,setDraft\]=useState<DealDraft>/);
  assert.match(app, /const publishDraft=async\(activeSession:StoredSession\)=>/);
  assert.match(app, /createUserDeal\(activeSession,draftForPersistence\(\)\)/);
  assert.match(app, /saveUserDealDraft\(activeSession,draftForPersistence\(\)\)/);
  assert.match(app, /uploadDealPhotos\(activeSession,deal\.id,photos\)/);
  assert.match(dealFeatures, /URL\.revokeObjectURL\(nextSource\)/);
  assert.doesNotMatch(app, /id="create-step-1"/);
  assert.doesNotMatch(app, /function DealTemplatePicker/);
  assert.doesNotMatch(app, /function CreateDealProgress/);
  assert.doesNotMatch(app, /function CreateValidationSummary/);
  assert.doesNotMatch(app, /function DealPhotoGuide/);
  assert.doesNotMatch(app, /const dealTemplates/);

  assert.match(workspace, /export function DealCreationWorkspace/);
  assert.match(workspace, /export const dealTemplates/);
  assert.match(workspace, /function DealTemplatePicker/);
  assert.match(workspace, /function CreateDealProgress/);
  assert.match(workspace, /function CreateValidationSummary/);
  assert.match(workspace, /function DealPhotoGuide/);
  assert.match(workspace, /<SmartCatalogFields/);
  assert.match(workspace, /id="create-step-1"/);
  assert.match(workspace, /id="create-step-2"/);
  assert.match(workspace, /id="create-step-3"/);
  assert.match(workspace, /URL\.revokeObjectURL\(nextSource\)/);
  assert.doesNotMatch(workspace, /createUserDeal|saveUserDealDraft|uploadDealPhotos/);
});

test('deal workspace shell is isolated without moving transaction orchestration', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealWorkspace.tsx');
  const shell = readText('src/DealWorkspaceShell.tsx');

  assert.match(app, /from '\.\/DealWorkspaceShell'/);
  assert.match(app, /import\('\.\/DealWorkspace'\)/);
  assert.match(app, /<DealWorkspace/);
  assert.match(app, /resolveDealPrimaryAction\(\{/);
  assert.match(workspace, /<DealWorkspaceNavigation/);
  assert.match(workspace, /<DealPrimaryActionDock/);
  assert.match(app, /const runDealPrimaryAction=\(\)=>/);
  assert.match(app, /if\(dealPrimaryAction\.kind==='accept'\)\{void accept\(\);return\}/);
  assert.match(app, /openAuthRoute\('signin','deal'\)/);
  assert.match(app, /scrollToDealSection\(dealPrimaryAction\.targetId\)/);
  assert.doesNotMatch(app, /function getShippingPrimaryAction/);
  assert.doesNotMatch(app, /function DealWorkspaceGroup/);
  assert.doesNotMatch(app, /<DealWorkspaceNavigation|<DealPrimaryActionDock|<DealWorkspaceGroup/);

  assert.match(shell, /export function resolveDealPrimaryAction/);
  assert.match(shell, /export function DealWorkspaceGroup/);
  assert.match(shell, /export function DealWorkspaceNavigation/);
  assert.match(shell, /export function DealPrimaryActionDock/);
  assert.match(shell, /targetId: 'deal-evidence-vault'/);
  assert.match(shell, /targetId: 'payment-status-panel'/);
  assert.match(shell, /targetId: 'shipping-panel'/);
  assert.match(shell, /aria-label=\{t\('Deal page navigation'\)\}/);
  assert.match(shell, /aria-label=\{t\('Primary deal action'\)\}/);
  assert.doesNotMatch(
    shell,
    /acceptPublicDeal|createProtectedCheckout|getDealActionPlan|createDealShipment|confirmShipmentDelivery|signIn|signUp/,
  );
});

test('public agreement verification is isolated from central application state', () => {
  const app = readText('src/app.tsx');
  const verification = readText('src/AgreementVerificationPage.tsx');

  assert.match(
    app,
    /import \{ AgreementVerificationPage \} from '\.\/AgreementVerificationPage'/,
  );
  assert.match(app, /view==='verify'&&<AgreementVerificationPage/);
  assert.doesNotMatch(app, /function AgreementVerifier/);
  assert.doesNotMatch(app, /verifyAgreementRecord|AgreementVerificationResult/);
  assert.doesNotMatch(app, /className="agreement-verifier-page"/);

  assert.match(verification, /export function AgreementVerificationPage/);
  assert.match(verification, /function AgreementVerifier/);
  assert.match(verification, /await verifyAgreementRecord\(cleanId, cleanCode\)/);
  assert.match(verification, /\/\^\[a-f0-9\]\{64\}\$\/i/);
  assert.match(verification, /aria-invalid=\{dealIdInvalid\}/);
  assert.match(verification, /aria-invalid=\{codeInvalid\}/);
  assert.match(verification, /role="status"/);
  assert.match(verification, /aria-live="polite"/);
  assert.match(
    verification,
    /A match confirms only the stored agreement record, not the item or payment\./,
  );
  assert.doesNotMatch(
    verification,
    /acceptPublicDeal|createProtectedCheckout|createDealShipment|uploadDealEvidence|signIn|signUp/,
  );
});

test('agreement record summary, history, and PDF rendering are isolated', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealWorkspace.tsx');
  const records = readText('src/AgreementRecordSummary.tsx');
  const printDocument = readText('src/AgreementPrintDocument.tsx');

  assert.match(workspace, /from '\.\/AgreementRecordSummary'/);
  assert.match(workspace, /<AgreementExport deal=\{deal\}/);
  assert.match(workspace, /<AgreementFingerprint deal=\{deal\}/);
  assert.match(workspace, /<AgreementHistory deal=\{deal\}/);
  assert.match(workspace, /from '\.\/AgreementPrintDocument'/);
  assert.match(workspace, /<AgreementPrintDocument deal=\{deal\}/);
  assert.doesNotMatch(app, /function AgreementPrintDocument/);
  assert.doesNotMatch(app, /useStoredAgreementDocument\(deal\)/);
  assert.doesNotMatch(app, /function AgreementExport/);
  assert.doesNotMatch(app, /function AgreementFingerprint/);
  assert.doesNotMatch(app, /function AgreementHistory/);
  assert.doesNotMatch(
    app,
    /AgreementExport|AgreementFingerprint|AgreementHistory|AgreementPrintDocument|getPublicAgreementDocument|getPublicAgreementHistory|AgreementDocumentSnapshot|AgreementHistoryVersion/,
  );

  assert.match(records, /export function useStoredAgreementDocument/);
  assert.match(records, /export function AgreementExport/);
  assert.match(records, /export function AgreementFingerprint/);
  assert.match(records, /export function AgreementHistory/);
  assert.match(
    records,
    /getPublicAgreementDocument\(deal\.publicId, deal\.agreementVersion\)/,
  );
  assert.match(records, /getPublicAgreementHistory\(deal\.publicId\)/);
  assert.match(records, /if \(current\) setRecord\(value\)/);
  assert.match(records, /\[deal\.publicId, deal\.agreementVersion\]/);
  assert.match(records, /role="status"/);
  assert.match(records, /aria-live="polite"/);
  assert.match(printDocument, /export function AgreementPrintDocument/);
  assert.match(printDocument, /useStoredAgreementDocument\(deal\)/);
  assert.match(printDocument, /record\.content_hash\.toUpperCase\(\)/);
  assert.match(printDocument, /record\.seller_declarations/);
  assert.match(printDocument, /record\.catalog_identity/);
  assert.match(printDocument, /role="document"/);
  assert.match(printDocument, /role=\{loading \? 'status' : 'alert'\}/);
  assert.doesNotMatch(
    `${records}\n${printDocument}`,
    /acceptPublicDeal|createProtectedCheckout|createDealShipment|uploadDealEvidence|signIn|signUp/,
  );
});

test('seller declaration presentation is isolated without moving publication', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealWorkspace.tsx');
  const declarations = readText('src/SellerDeclarations.tsx');

  assert.match(app, /from '\.\/SellerDeclarations'/);
  assert.match(app, /<SellerDeclarationChecklist/);
  assert.match(workspace, /<PublicSellerDeclaration deal=\{deal\}/);
  assert.match(app, /createUserDeal\(activeSession,draftForPersistence\(\)\)/);
  assert.doesNotMatch(app, /function SellerDeclarationChecklist/);
  assert.doesNotMatch(app, /function PublicSellerDeclaration/);
  assert.doesNotMatch(
    app,
    /getPublicSellerDeclaration|SellerDeclarationRecord/,
  );

  assert.match(declarations, /export interface SellerDeclarations/);
  assert.match(declarations, /export const emptySellerDeclarations/);
  assert.match(declarations, /export function SellerDeclarationChecklist/);
  assert.match(declarations, /export function PublicSellerDeclaration/);
  assert.match(
    declarations,
    /getPublicSellerDeclaration\(deal\.publicId\)/,
  );
  assert.match(declarations, /if \(current\)/);
  assert.match(declarations, /\[deal\.publicId, loadVersion\]/);
  assert.match(
    declarations,
    /These confirmations are recorded when the Deal Link is published\./,
  );
  assert.match(
    declarations,
    /It does not verify ownership or authenticity\./,
  );
  assert.doesNotMatch(
    declarations,
    /publishUserDealDraft|updateUserDealDraft|acceptPublicDeal|createProtectedCheckout|createDealShipment|uploadDealEvidence|signIn|signUp/,
  );
});

test('participant evidence workspace is isolated with security controls intact', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealWorkspace.tsx');
  const evidence = readText('src/DealEvidenceWorkspace.tsx');

  assert.match(workspace, /from '\.\/DealEvidenceWorkspace'/);
  assert.match(workspace, /<DealEvidenceWorkspace/);
  assert.doesNotMatch(app, /evidenceLabels/);
  assert.doesNotMatch(app, /function EvidencePanel/);
  assert.doesNotMatch(
    app,
    /uploadDealEvidence|evidenceInputAccept|\bEvidenceType\b/,
  );

  assert.match(evidence, /export const evidenceLabels/);
  assert.match(evidence, /export function DealEvidenceWorkspace/);
  assert.match(evidence, /evidenceInputAccept\(role, evidenceType\)/);
  assert.match(evidence, /listDealEvidence\(session, deal\.id\)/);
  assert.match(evidence, /uploadDealEvidence\(/);
  assert.match(evidence, /for \(const file of files\)/);
  assert.match(evidence, /if \(request === loadSequenceRef\.current\) setItems\(next\)/);
  assert.match(evidence, /\[deal\.id, session\.accessToken, role\]/);
  assert.match(evidence, /<EvidenceViewer/);
  assert.match(
    evidence,
    /Files enter an isolated quarantine and are available only after type, size, and malware checks pass\./,
  );
  assert.match(
    evidence,
    /Evidence is append-only, access is logged, and each viewing link expires after 60 seconds\./,
  );
  assert.doesNotMatch(
    evidence,
    /acceptPublicDeal|createProtectedCheckout|createDealShipment|confirmShipmentDelivery|signIn|signUp|publishUserDealDraft|updateUserDealDraft/,
  );
});

test('payment and seller payout workspace is isolated with guarded polling', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealWorkspace.tsx');
  const payment = readText('src/DealPaymentWorkspace.tsx');

  assert.match(workspace, /from '\.\/DealPaymentWorkspace'/);
  assert.match(workspace, /<DealPaymentWorkspace/);
  assert.match(workspace, /<ProtectedPaymentReceipt deal=\{deal\}/);
  assert.doesNotMatch(app, /function ProtectedPaymentPanel/);
  assert.doesNotMatch(app, /function ProtectedPaymentReceipt/);
  assert.doesNotMatch(app, /startStripeConnectOnboarding|createProtectedCheckout/);
  assert.doesNotMatch(app, /\bProtectedPaymentStatus\b|\bStripeConnectStatus\b/);

  assert.match(payment, /export function DealPaymentWorkspace/);
  assert.match(payment, /export function ProtectedPaymentReceipt/);
  assert.match(payment, /getProtectedPaymentStatus\(session, deal\.id\)/);
  assert.match(payment, /getStripeConnectStatus\(session\)/);
  assert.match(payment, /getDealActionPlan\(session, deal\.id\)/);
  assert.match(payment, /startStripeConnectOnboarding\(session, deal\.publicId\)/);
  assert.match(payment, /createProtectedCheckout\(session, deal\.id\)/);
  assert.match(payment, /let current = true/);
  assert.match(payment, /if \(!current \|\| request !== loadRequest\.current\) return/);
  assert.match(payment, /window\.clearInterval\(timer\)/);
  assert.match(payment, /popup\.opener = null/);
  assert.match(payment, /id="payment-status-panel"/);
  assert.match(
    payment,
    /Payments are processed in Stripe Sandbox\. Dealivra never stores card or bank details\. This beta is not legal escrow\./,
  );
  assert.match(
    payment,
    /This receipt records the Dealivra payment status\. It is not a bank statement or legal escrow certificate\./,
  );
  assert.doesNotMatch(
    payment,
    /resolveAdminDisputeFinancial|createDealShipment|confirmShipmentDelivery|uploadDealEvidence|acceptPublicDeal|publishUserDealDraft|signIn|signUp/,
  );
});

test('delivery, shipping, handoff, and inspection are isolated together', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealWorkspace.tsx');
  const fulfillment = readText('src/DealFulfillmentWorkspace.tsx');

  assert.match(workspace, /from '\.\/DealFulfillmentWorkspace'/);
  assert.match(workspace, /<ShippingPanel/);
  assert.match(workspace, /<MeetingPanel deal=\{deal\}/);
  assert.match(workspace, /<HandoffPanel/);
  assert.doesNotMatch(app, /function ShippingPanel/);
  assert.doesNotMatch(app, /function MeetingPanel/);
  assert.doesNotMatch(app, /function InspectionRecorder/);
  assert.doesNotMatch(app, /function HandoffPanel/);
  assert.doesNotMatch(
    app,
    /createDealShipment|confirmShipmentDelivery|saveDealDeliveryDetails|proposeMeeting|confirmMeeting|recordDealInspection|markArrived|generateHandoffPin|completeHandoff/,
  );

  assert.match(fulfillment, /export function ShippingPanel/);
  assert.match(fulfillment, /export function MeetingPanel/);
  assert.match(fulfillment, /export function InspectionRecorder/);
  assert.match(fulfillment, /export function HandoffPanel/);
  assert.match(fulfillment, /getDealDeliveryDetails\(session, deal\.id\)/);
  assert.match(fulfillment, /saveDealDeliveryDetails\(/);
  assert.match(fulfillment, /getSellerShippingEvidenceReadiness\(session, deal\.id\)/);
  assert.match(fulfillment, /createDealShipment\(session, deal\.id, carrier, tracking\)/);
  assert.match(fulfillment, /confirmShipmentDelivery\(session, deal\.id\)/);
  assert.match(fulfillment, /proposeMeeting\(/);
  assert.match(fulfillment, /confirmMeeting\(session, deal\.id\)/);
  assert.match(fulfillment, /recordDealInspection\(session, deal\.id\)/);
  assert.match(fulfillment, /generateHandoffPin\(session, deal\.id\)/);
  assert.match(fulfillment, /completeHandoff\(session, deal\.id, pin\)/);
  assert.match(fulfillment, /let current = true/);
  assert.match(fulfillment, /if \(!current\) return/);
  assert.match(fulfillment, /Address line 2 \(optional\)/);
  assert.match(fulfillment, /Apartment, suite, unit, building, or floor/);
  assert.match(
    fulfillment,
    /form\.addressLine2\.trim\(\)[\s\S]*?\.join\('\\n'\)/,
  );
  assert.match(fulfillment, /meeting-field meeting-field-line-two/);
  const addressAutocomplete = readText('src/AddressAutocomplete.tsx');
  const usAddress = readText('src/usAddress.ts');
  assert.match(
    addressAutocomplete,
    /AutocompleteSuggestion\.fetchAutocompleteSuggestions/,
  );
  assert.match(addressAutocomplete, /AutocompleteSessionToken/);
  assert.match(addressAutocomplete, /role="combobox"/);
  assert.match(addressAutocomplete, /role="listbox"/);
  assert.match(addressAutocomplete, /aria-describedby=\{statusId\}/);
  assert.match(addressAutocomplete, /aria-busy=\{queryState === 'loading'\}/);
  assert.match(addressAutocomplete, /const selectionMutationRef = useRef\(false\)/);
  assert.match(addressAutocomplete, /if \(!library \|\| selectionMutationRef\.current\) return/);
  assert.match(addressAutocomplete, /const selectionRequest = \+\+requestSequence\.current/);
  assert.ok((addressAutocomplete.match(/selectionRequest !== requestSequence\.current/g) ?? []).length >= 2);
  assert.ok((addressAutocomplete.match(/requestSequence\.current \+= 1/g) ?? []).length >= 3);
  assert.match(addressAutocomplete, /Google Maps/);
  assert.match(
    addressAutocomplete,
    /Automatic suggestions are temporarily unavailable\. Enter the complete address manually\./,
  );
  assert.match(usAddress, /\^\\d\{5\}\(\?:-\\d\{4\}\)\?\$/);
  assert.match(usAddress, /subpremise/);
  assert.match(fulfillment, /parts\.addressLine2 \|\| current\.addressLine2/);
  assert.match(fulfillment, /copyTextToClipboard\(/);
  assert.match(
    fulfillment,
    /Address could not be copied\. Select and copy it manually\./,
  );
  assert.doesNotMatch(fulfillment, /catch\s*\{\s*\}/);
  const fulfillmentActionButtons = [
    ...fulfillment.matchAll(/<button\b[^>]*\bonClick=\{[^>]*>/gs),
  ];
  assert.ok(fulfillmentActionButtons.length > 0);
  for (const [button] of fulfillmentActionButtons) {
    assert.match(button, /\btype="button"/);
  }
  assert.match(fulfillment, /getElementById\('deal-evidence-vault'\)/);
  assert.match(
    fulfillment,
    /This address is used only for this deal and is never shown on the public Deal Link\./,
  );
  assert.doesNotMatch(
    fulfillment,
    /createProtectedCheckout|startStripeConnectOnboarding|uploadDealEvidence|acceptPublicDeal|publishUserDealDraft|resolveAdminDisputeFinancial|signIn|signUp/,
  );
});

test('every button inside a form declares its submission behavior', () => {
  const files = [
    'src/AccountEntryPages.tsx',
    'src/AccountMfaSecurity.tsx',
    'src/AccountProfileWorkspace.tsx',
    'src/DealCreationWorkspace.tsx',
    'src/DealEvidenceWorkspace.tsx',
    'src/DealFulfillmentWorkspace.tsx',
    'src/DealPaymentWorkspace.tsx',
    'src/DealResolutionWorkspace.tsx',
    'src/DealWorkspaceFeatures.tsx',
    'src/MfaLoginVerification.tsx',
    'src/SupportCaseCenter.tsx',
  ];
  const missing = [];

  for (const file of files) {
    const source = readText(file);
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node, formDepth = 0) => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      const tagName = opening?.tagName.getText(sourceFile);
      const nextFormDepth = formDepth + (tagName === 'form' ? 1 : 0);
      if (tagName === 'button' && nextFormDepth > 0) {
        const hasType = opening.attributes.properties.some(
          attribute =>
            ts.isJsxAttribute(attribute)
            && attribute.name.getText(sourceFile) === 'type',
        );
        if (!hasType) {
          const location = sourceFile.getLineAndCharacterOfPosition(
            opening.getStart(sourceFile),
          );
          missing.push(`${file}:${location.line + 1}`);
        }
      }
      ts.forEachChild(node, child => visit(child, nextFormDepth));
    };
    visit(sourceFile);
  }

  assert.deepEqual(missing, []);
});

test('every button outside a form declares an interactive behavior', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const missing = [];

  for (const file of files) {
    const source = readText(file);
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node, formDepth = 0) => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      const tagName = opening?.tagName.getText(sourceFile);
      const nextFormDepth = formDepth + (tagName === 'form' ? 1 : 0);
      if (tagName === 'button' && nextFormDepth === 0) {
        const attributes = new Set(
          opening.attributes.properties
            .filter(ts.isJsxAttribute)
            .map(attribute => attribute.name.getText(sourceFile)),
        );
        if (!attributes.has('onClick') && !attributes.has('disabled')) {
          const location = sourceFile.getLineAndCharacterOfPosition(
            opening.getStart(sourceFile),
          );
          missing.push(`${file}:${location.line + 1}`);
        }
      }
      ts.forEachChild(node, child => visit(child, nextFormDepth));
    };
    visit(sourceFile);
  }

  assert.deepEqual(missing, []);
});

test('every button exposes an accessible name', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const unnamed = [];

  const hasReadableChild = node => {
    if (ts.isJsxText(node)) return node.getText().trim().length > 0;
    if (ts.isJsxExpression(node)) return Boolean(node.expression);
    if (ts.isJsxElement(node)) return node.children.some(hasReadableChild);
    return false;
  };

  for (const file of files) {
    const source = readText(file);
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = node => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sourceFile) === 'button') {
        const attributes = new Set(
          node.openingElement.attributes.properties
            .filter(ts.isJsxAttribute)
            .map(attribute => attribute.name.getText(sourceFile)),
        );
        if (
          !attributes.has('aria-label') &&
          !attributes.has('aria-labelledby') &&
          !attributes.has('title') &&
          !node.children.some(hasReadableChild)
        ) {
          const location = sourceFile.getLineAndCharacterOfPosition(
            node.openingElement.getStart(sourceFile),
          );
          unnamed.push(`${file}:${location.line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  assert.deepEqual(unnamed, []);
});

test('every form control has an accessible name', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const unnamed = [];

  for (const file of files) {
    const source = readText(file);
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node, labelDepth = 0) => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      const tagName = opening?.tagName.getText(sourceFile);
      const nextLabelDepth = labelDepth + (tagName === 'label' ? 1 : 0);
      if (['input', 'select', 'textarea'].includes(tagName) && nextLabelDepth === 0) {
        const attributes = new Map(
          opening.attributes.properties
            .filter(ts.isJsxAttribute)
            .map(attribute => [attribute.name.getText(sourceFile), attribute]),
        );
        const type = attributes.get('type')?.initializer?.getText(sourceFile);
        const id = attributes.get('id')?.initializer?.getText(sourceFile);
        const hasExplicitLabel =
          typeof id === 'string' && source.includes(`htmlFor=${id}`);
        const hasAccessibleName =
          attributes.has('aria-label')
          || attributes.has('aria-labelledby')
          || hasExplicitLabel;
        if (type !== '"hidden"' && !hasAccessibleName) {
          const location = sourceFile.getLineAndCharacterOfPosition(
            opening.getStart(sourceFile),
          );
          unnamed.push(`${file}:${location.line + 1}`);
        }
      }
      ts.forEachChild(node, child => visit(child, nextLabelDepth));
    };
    visit(sourceFile);
  }

  assert.deepEqual(unnamed, []);
});

test('browser copy actions use the governed clipboard fallback', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(
      entry =>
        entry.isFile()
        && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
        && entry.name !== 'clipboard.ts',
    )
    .map(entry => `src/${entry.name}`);
  const bypasses = files.filter(file => /navigator\.clipboard/.test(readText(file)));
  const clipboard = readText('src/clipboard.ts');

  assert.deepEqual(bypasses, []);
  assert.match(clipboard, /navigator\.clipboard\?\.writeText/);
  assert.match(clipboard, /document\.execCommand\('copy'\)/);
  assert.match(readText('src/DealWorkspaceFeatures.tsx'), /copyTextToClipboard/);
  assert.match(readText('src/AgreementRecordSummary.tsx'), /copyTextToClipboard/);
});

test('critical confirmations use one keyboard-safe application dialog', () => {
  const dialog = readText('src/ConfirmActionDialog.tsx');
  const criticalFiles = [
    'src/AdministrationWorkspace.tsx',
    'src/DealFulfillmentWorkspace.tsx',
    'src/DealResolutionWorkspace.tsx',
    'src/DealWorkspaceFeatures.tsx',
  ];

  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === 'Escape'/);
  assert.match(dialog, /previousFocusRef\.current\?\.focus\(\)/);
  assert.match(dialog, /event\.key !== 'Tab'/);
  for (const file of criticalFiles) {
    const source = readText(file);
    assert.doesNotMatch(source, /(?:window\.)?confirm\s*\(/);
    assert.match(source, /useConfirmAction/);
  }
});

test('application connectivity state is visible and privacy safe', () => {
  const app = readText('src/app.tsx');
  const banner = readText('src/NetworkStatusBanner.tsx');

  assert.match(app, /<NetworkStatusBanner \/>/);
  assert.match(banner, /window\.addEventListener\('offline', offline\)/);
  assert.match(banner, /window\.addEventListener\('online', online\)/);
  assert.match(banner, /role="status"/);
  assert.match(banner, /aria-live="assertive"/);
  assert.match(banner, /window\.clearTimeout\(clearTimer\.current\)/);
  assert.doesNotMatch(banner, /fetch\(|sendBeacon|localStorage|sessionStorage/);
});

test('heavy authenticated workspaces load only when requested', () => {
  const app = readText('src/app.tsx');

  for (const moduleName of [
    'AccountProfileWorkspace',
    'AdministrationWorkspace',
    'DealWorkspace',
  ]) {
    assert.doesNotMatch(
      app,
      new RegExp(`import \\{ ${moduleName} \\} from`),
      `${moduleName} returned to the initial application bundle`,
    );
    assert.match(app, new RegExp(`React\\.lazy\\(\\(\\) =>[\\s\\S]*import\\('\\./${moduleName}'\\)`));
  }
  assert.ok((app.match(/<React\.Suspense fallback=\{<RouteLoading\/>\}>/g) || []).length >= 3);
});

test('account entry prevents duplicate authentication requests', () => {
  const app = readText('src/app.tsx');
  const entry = readText('src/AccountEntryPages.tsx');

  assert.match(app, /const \[authSubmitting,setAuthSubmitting\]=useState\(false\)/);
  assert.match(app, /const authSubmittingRef=useRef\(false\)/);
  assert.match(app, /if\(authSubmittingRef\.current\)return/);
  assert.match(app, /authSubmittingRef\.current=true/);
  assert.match(app, /setAuthSubmitting\(true\)/);
  assert.match(app, /finally\{authSubmittingRef\.current=false;setAuthSubmitting\(false\)\}/);
  assert.match(app, /submitting=\{authSubmitting\}/);
  assert.match(entry, /aria-busy=\{submitting\}/);
  assert.match(
    entry,
    /disabled=\{submitting \|\| \(isSignup && !acceptedPolicies\)\}/,
  );
  assert.match(entry, /'Creating account…'/);
  assert.match(entry, /'Signing in…'/);
});

test('password recovery and MFA verification are single-flight actions', () => {
  const entry = readText('src/AccountEntryPages.tsx');
  const mfa = readText('src/MfaLoginVerification.tsx');

  assert.match(entry, /const sendingRef = useRef\(false\)/);
  assert.match(entry, /if \(sendingRef\.current\) return/);
  assert.match(entry, /sendingRef\.current = true/);
  assert.match(entry, /sendingRef\.current = false/);
  assert.match(entry, /const updatingRef = useRef\(false\)/);
  assert.match(entry, /if \(updatingRef\.current\) return/);
  assert.match(entry, /aria-busy=\{updating\}/);
  assert.match(entry, /disabled=\{updating\}/);
  assert.match(mfa, /const busyRef=useRef\(false\)/);
  assert.match(mfa, /if\(busyRef\.current\)return/);
  assert.match(mfa, /busyRef\.current=true/);
  assert.match(mfa, /busyRef\.current=false/);
  assert.match(mfa, /aria-busy=\{busy\}/);
});

test('privileged account mutations reject same-tick duplicate actions', () => {
  const profile = readText('src/AccountProfileWorkspace.tsx');
  const factors = readText('src/AccountMfaSecurity.tsx');
  const sessions = readText('src/AccountSessionSecurity.tsx');

  assert.match(profile, /const savingNameRef = useRef\(false\)/);
  assert.match(profile, /if \(savingNameRef\.current\) return/);
  assert.match(profile, /const savingPasswordRef = useRef\(false\)/);
  assert.match(profile, /if \(savingPasswordRef\.current\) return/);
  assert.match(profile, /aria-busy=\{savingPassword\}/);
  assert.match(factors, /const busyRef=useRef\(false\)/);
  assert.ok((factors.match(/if\(busyRef\.current\)return/g) || []).length >= 4);
  assert.ok((factors.match(/busyRef\.current=false/g) || []).length >= 4);
  assert.match(sessions, /const busyRef=useRef\(false\)/);
  assert.ok((sessions.match(/if\(busyRef\.current\)return/g) || []).length >= 2);
  assert.ok((sessions.match(/busyRef\.current=false/g) || []).length >= 2);
});

test('install-app prompt reports its real outcome and cannot run twice', () => {
  const app = readText('src/app.tsx');

  assert.match(app, /const \[installPrompt,setInstallPrompt\]=useState/);
  assert.match(app, /const installingRef=useRef\(false\)/);
  assert.match(app, /if\(installingRef\.current\)return/);
  assert.match(app, /await installPrompt\.userChoice/);
  assert.match(app, /setInstallPrompt\(null\)/);
  assert.match(app, /disabled=\{installing\}/);
  assert.match(app, /role="status" aria-live="polite"/);
  assert.match(app, /Your browser could not start installation/);
});

test('compact mobile navigation and demo actions retain full touch targets', () => {
  const globalStyles = readText('src/global-redesign.css');
  const workspaceStyles = readText('src/workspace-redesign.css');

  assert.match(
    globalStyles,
    /\.site-header \.mobile-menu-toggle\{width:44px;height:44px/,
  );
  assert.match(
    globalStyles,
    /\.mobile-menu a,\.mobile-menu button\{min-height:44px/,
  );
  assert.match(
    workspaceStyles,
    /\.preview-next button\{min-width:44px;min-height:44px/,
  );
});

test('secondary account and recovery actions retain full touch targets', () => {
  const globalStyles = readText('src/global-redesign.css');
  const workspaceStyles = readText('src/workspace-redesign.css');
  const recoveryStyles = readText('src/recovery.css');
  const baseStyles = readText('src/styles.css');
  const reviewStyles = readText('src/create-review.css');

  assert.match(globalStyles, /\.app>footer nav a\{min-height:44px/);
  assert.match(globalStyles, /\.site-nav a,\.site-nav button,\.site-header \.account button\{\s*min-height:44px/);
  assert.match(globalStyles, /\.password-field button\{[^}]*width:44px;height:44px/);
  assert.match(workspaceStyles, /\.create-draft-recovery button\{[^}]*min-height:44px/);
  assert.match(recoveryStyles, /\.forgot-entry button\{min-height:44px/);
  assert.match(baseStyles, /\.switch-auth\{width:100%;min-height:44px/);
  assert.match(reviewStyles, /\.draft-review-save button\{min-height:44px/);
});

test('dense workspace controls retain full touch targets', () => {
  const catalogSearch = readText('src/catalog-search.css');
  const smartCatalog = readText('src/smart-catalog.css');
  const agreementExport = readText('src/agreement-export.css');
  const workspace = readText('src/workspace-redesign.css');
  const support = readText('src/support-case.css');
  const sessions = readText('src/session-security.css');

  assert.match(catalogSearch, /\.catalog-clear-filters\{\s*min-height:44px/);
  assert.match(smartCatalog, /\.catalog-category-toggle\{\s*width:100%;\s*min-height:44px/);
  assert.match(agreementExport, /\.agreement-export-actions button\{min-height:44px/);
  assert.match(agreementExport, /\.agreement-document-toolbar button\{min-height:44px/);
  assert.match(workspace, /\.deal-workspace-bar \.back\{min-height:44px/);
  assert.match(workspace, /\.deal-workspace-bar nav button\{min-height:44px/);
  assert.match(workspace, /\.create-validation-summary li button\{width:100%;min-height:44px/);
  assert.match(support, /\.icon-button\{width:44px;height:44px/);
  assert.match(sessions, /\.session-confirmation button\{min-height:44px/);
});

test('account recovery progress and guidance are announced accessibly', () => {
  const accountEntry = readText('src/AccountEntryPages.tsx');
  const feedback = readText('src/FeedbackMessage.tsx');

  assert.match(accountEntry, /autoComplete="email"/);
  assert.ok((accountEntry.match(/<FeedbackMessage/g) || []).length >= 3);
  assert.match(feedback, /role=\{urgent \? 'alert' : 'status'\}/);
  assert.match(feedback, /aria-live=\{urgent \? 'assertive' : 'polite'\}/);
  assert.ok((accountEntry.match(/aria-describedby=\{[^\n]*recovery-password-requirements/g) || []).length >= 2);
  assert.match(accountEntry, /id="recovery-password-requirements"/);
});

test('dynamic account and deal feedback is announced without stealing focus', () => {
  const account = readText('src/AccountProfileWorkspace.tsx');
  const payment = readText('src/DealPaymentWorkspace.tsx');
  const fulfillment = readText('src/DealFulfillmentWorkspace.tsx');
  const features = readText('src/DealWorkspaceFeatures.tsx');
  const publicRoutes = readText('src/PublicRoutePages.tsx');

  assert.doesNotMatch(account, /message \? <div className="notice">/);
  assert.match(account, /role="status" aria-live="polite"/);
  assert.match(payment, /payment\?\.failure_message[\s\S]*role="alert"/);
  assert.match(fulfillment, /shipping-readiness-status" role="status" aria-live="polite"/);
  assert.match(fulfillment, /readinessError[\s\S]*className="notice" role="alert"/);
  assert.doesNotMatch(features, /\{message && <div className="notice">/);
  assert.doesNotMatch(features, /\{error && <div className="notice">/);
  assert.match(publicRoutes, /DealLinkError[\s\S]*className="notice" role="alert"/);
});

test('payment redirects reject same-tick duplicate financial actions', () => {
  const payment = readText('src/DealPaymentWorkspace.tsx');

  assert.match(payment, /const actionInFlight = useRef\(false\)/);
  assert.ok(
    (payment.match(/if \(actionInFlight\.current\) return;/g) || []).length >= 2,
  );
  assert.ok(
    (payment.match(/actionInFlight\.current = true;/g) || []).length >= 2,
  );
  assert.ok(
    (payment.match(/actionInFlight\.current = false;/g) || []).length >= 2,
  );
});

test('fulfillment mutations reject same-tick duplicate submissions', () => {
  const fulfillment = readText('src/DealFulfillmentWorkspace.tsx');

  assert.match(fulfillment, /const saveInFlight = useRef\(false\)/);
  assert.match(fulfillment, /const mutationInFlight = useRef\(false\)/);
  assert.ok(
    (fulfillment.match(/const actionInFlight = useRef\(false\)/g) || [])
      .length >= 2,
  );
  assert.ok(
    (fulfillment.match(/if \(actionInFlight\.current\) return;/g) || [])
      .length >= 4,
  );
  assert.ok(
    (fulfillment.match(/mutationInFlight\.current = true;/g) || []).length >=
      3,
  );
  assert.match(fulfillment, /disabled=\{!inspectionRecorded \|\| shipmentBusy\}/);
  assert.ok((fulfillment.match(/aria-busy=/g) || []).length >= 8);
  assert.match(fulfillment, /shipmentBusy \? 'Saving shipment…'/);
  assert.match(fulfillment, /shipmentBusy \? 'Confirming delivery…'/);
});

test('deal communications, offers, and publication are single-flight', () => {
  const features = readText('src/DealWorkspaceFeatures.tsx');

  assert.ok(
    (features.match(/const requestInFlight = useRef\(false\)/g) || []).length >=
      2,
  );
  assert.match(features, /const mutationInFlight = useRef\(false\)/);
  assert.ok(
    (features.match(/requestInFlight\.current = true;/g) || []).length >= 4,
  );
  assert.ok(
    (features.match(/requestInFlight\.current = false;/g) || []).length >= 4,
  );
  assert.match(features, /if \(busy \|\| mutationInFlight\.current\) return/);
});

test('form-adjacent workspace actions declare their button behavior', () => {
  const actionSurfaces = [
    'src/AccountProfileWorkspace.tsx',
    'src/DealCreationWorkspace.tsx',
    'src/DealPaymentWorkspace.tsx',
    'src/EvidenceLifecycleCenter.tsx',
    'src/PublicRoutePages.tsx',
  ];

  for (const file of actionSurfaces) {
    assert.doesNotMatch(
      readText(file),
      /<button(?![^>]*\btype=)[^>]*>/,
      `${file} contains a button with implicit submit behavior`,
    );
  }
});

test('participant resolution and private deal chat are isolated safely', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealWorkspace.tsx');
  const resolution = readText('src/DealResolutionWorkspace.tsx');
  const chatStyles = readText('src/chat.css');

  assert.match(workspace, /from '\.\/DealResolutionWorkspace'/);
  assert.match(workspace, /<RatingPanel deal=\{deal\}/);
  assert.match(workspace, /<DealSafetyActions/);
  assert.match(workspace, /<ReportDealPanel/);
  assert.match(workspace, /<DealChat deal=\{deal\}/);
  assert.doesNotMatch(app, /function RatingPanel/);
  assert.doesNotMatch(app, /function DealSafetyActions/);
  assert.doesNotMatch(app, /function ReportDealPanel/);
  assert.doesNotMatch(app, /function DealChat/);
  assert.doesNotMatch(
    app,
    /submitRating|cancelDeal|openDealDispute|reportPublicDeal|getDealMessages|sendDealMessage/,
  );

  assert.match(resolution, /export function RatingPanel/);
  assert.match(resolution, /export function DealSafetyActions/);
  assert.match(resolution, /export function ReportDealPanel/);
  assert.match(resolution, /export function DealChat/);
  assert.match(resolution, /submitRating\(session, deal\.id, stars, comment\)/);
  assert.match(resolution, /cancelDeal\(session, deal\.id, reason\)/);
  assert.match(resolution, /openDealDispute\(session, deal\.id, reason\)/);
  assert.match(
    resolution,
    /reportPublicDeal\(session, deal\.publicId, category, details\)/,
  );
  assert.match(resolution, /getDealMessages\(session, deal\.id\)/);
  assert.match(resolution, /sendDealMessage\(session, deal\.id, body\)/);
  assert.match(resolution, /let current = true/);
  assert.match(resolution, /request !== requestRef\.current/);
  assert.match(resolution, /window\.clearInterval\(timer\)/);
  assert.match(resolution, /aria-controls="deal-chat-panel"/);
  assert.match(resolution, /aria-live="polite"/);
  assert.match(resolution, /<X aria-hidden="true" size=\{19\} \/>/);
  assert.match(resolution, /if \(event\.key === 'Escape'\)/);
  assert.match(resolution, /launcherRef\.current\?\.focus\(\)/);
  assert.match(chatStyles, /\.view-deal \.deal-chat-float/);
  assert.match(
    chatStyles,
    /bottom:calc\(92px \+ env\(safe-area-inset-bottom\)\)/,
  );
  assert.match(chatStyles, /max-height:calc\(100dvh - 174px/);
  assert.match(chatStyles, /overscroll-behavior:contain/);
  assert.doesNotMatch(
    resolution,
    /resolveAdminDisputeFinancial|resolveAdminDispute|setAdminDealVisibility|createProtectedCheckout|createDealShipment|confirmShipmentDelivery|uploadDealEvidence|acceptPublicDeal|publishUserDealDraft|signIn|signUp/,
  );
});

test('administration operations are isolated behind the central access gate', () => {
  const app = readText('src/app.tsx');
  const administration = readText('src/AdministrationWorkspace.tsx');

  assert.match(app, /getAdminAccess\(session\)/);
  assert.match(
    app,
    /view==='admin'&&session&&isAdmin&&<React\.Suspense[\s\S]*<AdministrationWorkspace session=\{session\}/,
  );
  assert.match(app, /import\('\.\/AdministrationWorkspace'\)/);
  assert.doesNotMatch(
    app,
    /function AdminCatalogCenter|function AdminEvidenceReview|function AdminRevenueCenter|function AdminDisputeCenter|function AdminReportCenter/,
  );
  assert.doesNotMatch(
    app,
    /getAdminCatalogAdoption|getAdminRevenueSummary|getAdminRevenueTransactions|getAdminDisputes|getAdminReports|resolveAdminDisputeFinancial|resolveAdminDispute|resolveAdminReport|setAdminDealVisibility|listDealEvidence/,
  );

  assert.match(administration, /export function AdministrationWorkspace/);
  assert.match(administration, /<EvidenceLifecycleCenter session=\{session\}/);
  assert.match(administration, /getAdminCatalogAdoption\(session, activeDays\)/);
  assert.match(administration, /getAdminRevenueSummary\(session\)/);
  assert.match(administration, /getAdminRevenueTransactions\(session, 100\)/);
  assert.match(administration, /getAdminDisputes\(session, filter\)/);
  assert.match(administration, /getAdminReports\(session, filter\)/);
  assert.match(administration, /resolveAdminDisputeFinancial\(/);
  assert.match(administration, /resolveAdminDispute\(/);
  assert.match(administration, /resolveAdminReport\(/);
  assert.match(administration, /setAdminDealVisibility\(/);
  assert.match(administration, /listDealEvidence\(session, dispute\.deal_id\)/);
  assert.match(administration, /Promise\.allSettled/);
  assert.match(administration, /request !== requestRef\.current/);
  assert.match(administration, /<th className="action-heading">/);
  assert.doesNotMatch(administration, /document\.querySelector/);
  assert.match(
    administration,
    /Buyer and seller resolutions perform the confirmed Stripe refund or release\. Closing a dispute moves no funds\./,
  );
  assert.match(administration, /await confirmAction\(\{/);
  assert.match(administration, /title: t\('Confirm dispute decision'\)/);
  assert.doesNotMatch(
    administration,
    /getAdminAccess|signIn|signUp|acceptPublicDeal|publishUserDealDraft|createProtectedCheckout|createDealShipment|uploadDealEvidence/,
  );
});

test('deal workspace composition is isolated while central transaction ownership remains explicit', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealWorkspace.tsx');
  const features = readText('src/DealWorkspaceFeatures.tsx');

  assert.match(
    app,
    /const DealWorkspace = React\.lazy\(\(\) =>[\s\S]*import\('\.\/DealWorkspace'\)/,
  );
  assert.equal(
    (app.match(/<DealWorkspace\b/g) || []).length,
    1,
    'The central application should render exactly one Deal Workspace boundary',
  );
  assert.doesNotMatch(
    app,
    /<DealWorkspaceGroup|<DealWorkspaceNavigation|<DealPrimaryActionDock|<DealEvidenceWorkspace|<DealPaymentWorkspace|<ShippingPanel|<DealChat/,
  );
  assert.doesNotMatch(
    app,
    /function BuyerAccessCodeManager|function DealRiskCheck|function DealParticipantsCard|function DealActionPlanCard|function DealEditor|function DealProgressStrip/,
  );
  assert.match(app, /await acceptPublicDeal\(session,active\.publicId/);
  assert.match(app, /await getDealActionPlan\(session,dealId\)/);

  assert.match(workspace, /export function DealWorkspace/);
  assert.match(workspace, /<DealWorkspaceGroup/);
  assert.match(workspace, /<DealWorkspaceNavigation/);
  assert.match(workspace, /<DealPrimaryActionDock/);
  assert.match(workspace, /<DealEvidenceWorkspace/);
  assert.match(workspace, /<DealPaymentWorkspace/);
  assert.match(workspace, /<ShippingPanel/);
  assert.match(workspace, /<DealChat deal=\{deal\}/);
  assert.match(workspace, /<AgreementPrintDocument deal=\{deal\}/);

  assert.match(features, /export function BuyerAccessCodeManager/);
  assert.match(features, /export function DealRiskCheck/);
  assert.match(features, /export function DealParticipantsCard/);
  assert.match(features, /export function DealActionPlanCard/);
  assert.match(features, /export function DealEditor/);
  assert.match(features, /export function DealProgressStrip/);
  assert.doesNotMatch(
    `${workspace}\n${features}`,
    /signIn\(|signUp\(|acceptPublicDeal\(|resolveAdminDisputeFinancial\(|setAdminDealVisibility\(|createProtectedCheckout\(/,
  );
});

test('core Deal service responses are validated and normalized at runtime', async () => {
  const schemas = await import('../src/services/runtimeSchemas.ts');
  const { currencyCodes } = await import('../src/currency.ts');
  const baseDealRow = {
    id: '00000000-0000-0000-0000-000000000001',
    public_id: 'DV-VALID-001',
    title: 'Verified test phone',
    description: 'A bounded service response used by the release gate.',
    price_cents: 12500,
    currency: 'USD',
    condition: 'Good',
    serial_last_four: null,
    delivery_method: 'Ship to buyer',
    category_id: 'phone',
    catalog_version: '2026-07-29.1',
    catalog_brand_id: 'apple',
    catalog_brand_label: 'Apple',
    catalog_model_id: 'iphone-16',
    catalog_model_label: 'iPhone 16',
    model_year: 2025,
    catalog_variant_id: null,
    catalog_variant_label: null,
    status: 'published',
    current_agreement_version: 2,
    created_at: '2026-07-29T12:00:00.000Z',
    expires_at: null,
    deal_media: [{
      storage_path: 'seller/deal/item.webp',
      sort_order: 0,
    }],
    seller_id: '00000000-0000-0000-0000-000000000002',
    buyer_id: null,
  };

  const parsedDeal = schemas.parseUserDealRows([baseDealRow])[0];
  assert.equal(parsedDeal.currency, 'USD');
  assert.equal(parsedDeal.category_id, 'phone');
  assert.equal(parsedDeal.deal_media[0].sort_order, 0);
  assert.equal(parsedDeal.buyer_id, undefined);

  const publicRow = schemas.parsePublicDealRows([{
    ...baseDealRow,
    current_agreement_version: undefined,
    agreement_version: 3,
    seller_name: 'Verified Seller',
    seller_contact_verified: true,
    seller_verification: 'failed',
    media_paths: ['seller/deal/item.webp'],
  }])[0];
  assert.equal(publicRow.current_agreement_version, 3);
  assert.equal(publicRow.agreement_version, 3);
  assert.equal(publicRow.seller_verification, 'failed');

  const savedRow = schemas.parseSavedDealRows([{
    ...baseDealRow,
    seller_name: 'Verified Seller',
    seller_contact_verified: true,
    seller_verification: 'verified',
    media_paths: ['seller/deal/item.webp'],
    saved_at: '2026-07-29T13:00:00.000Z',
  }])[0];
  assert.equal(savedRow.saved_at, '2026-07-29T13:00:00.000Z');

  const actionPlan = schemas.parseDealActionPlanRows([{
    viewer_role: 'buyer',
    deal_status: 'accepted',
    meeting_status: null,
    seller_arrived: false,
    buyer_arrived: false,
    handoff_code_ready: false,
    shipment_status: 'shipped',
    inspection_recorded: false,
    rating_submitted: false,
    delivery_address_ready: true,
    payment_method_recorded: true,
    payment_method_confirmed: true,
    payment_marked_sent: true,
    payment_received: false,
  }])[0];
  assert.equal(actionPlan.viewer_role, 'buyer');
  assert.equal(actionPlan.shipment_status, 'shipped');

  const readiness = schemas.parseShippingEvidenceReadinessRows([{
    item_photo_ready: true,
    packing_video_ready: true,
    package_weight_ready: true,
    serial_required: false,
    serial_photo_ready: false,
    distinct_files_ready: true,
    ready: true,
  }])[0];
  assert.equal(readiness.ready, true);

  assert.deepEqual(
    [...new Set(schemas.runtimeCurrencyCodes)].sort(),
    [...new Set(currencyCodes)].sort(),
  );
});

test('invalid Deal service responses fail closed without logging payload data', async () => {
  const schemas = await import('../src/services/runtimeSchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);

  try {
    assert.throws(
      () => schemas.parseUserDealRows([{
        id: 'deal-id',
        public_id: 'DV-INVALID',
        title: { secret: 'private-value-must-not-be-logged' },
        description: '',
        price_cents: 100,
        currency: 'USD',
        condition: 'Good',
        serial_last_four: null,
        delivery_method: 'Meet in person',
        status: 'draft',
        current_agreement_version: 0,
        created_at: '2026-07-29T12:00:00.000Z',
        expires_at: null,
        deal_media: [],
      }]),
      error => (
        error instanceof schemas.ServiceResponseValidationError
        && error.boundary === 'user_deals'
        && error.issue === 'row_0_invalid_title'
      ),
    );
    assert.throws(
      () => schemas.parseUserDealRows('not-an-array'),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parsePublicDealRows([{}, {}]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseDealActionPlanRows([{
        viewer_role: 'buyer',
        deal_status: 'accepted',
        meeting_status: null,
        seller_arrived: 'yes',
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseShippingEvidenceReadinessRows([{
        item_photo_ready: true,
        packing_video_ready: true,
        package_weight_ready: true,
        serial_required: false,
        serial_photo_ready: false,
        distinct_files_ready: true,
        ready: 'yes',
      }]),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.service\.response-rejection\.v1/);
  assert.match(serializedLogs, /user_deals/);
  assert.doesNotMatch(serializedLogs, /private-value-must-not-be-logged/);
  assert.doesNotMatch(serializedLogs, /DV-INVALID/);
});

test('the first ARC-004 boundary is wired and documented without weakening authorization', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/runtimeSchemas.ts');
  const standard = readText('docs/production-readiness/42_RUNTIME_SERVICE_VALIDATION.md');
  const readinessIndex = readText('docs/production-readiness/README.md');

  assert.match(service, /parseUserDealRows/);
  assert.match(service, /parsePublicDealRows/);
  assert.match(service, /parseSavedDealRows/);
  assert.match(service, /parseDealActionPlanRows/);
  assert.match(service, /parseShippingEvidenceReadinessRows/);
  assert.doesNotMatch(service, /as DealRow\[\]/);
  assert.doesNotMatch(service, /as PublicDealRow\[\]/);
  assert.doesNotMatch(service, /as SavedDealRow\[\]/);

  assert.match(schemas, /dealivra\.service\.response-rejection\.v1/);
  assert.match(schemas, /ServiceResponseValidationError/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
  assert.match(standard, /RLS and grants remain authoritative/);
  assert.match(standard, /No Supabase resource, schema, policy, migration/);
  assert.match(readinessIndex, /42_RUNTIME_SERVICE_VALIDATION\.md/);
});

test('Auth session, signup, login, and MFA success envelopes are runtime validated', async () => {
  const schemas = await import('../src/services/authRuntimeSchemas.ts');
  const accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhbWwiOiJhYWwxIn0.signature';
  const user = {
    id: '00000000-0000-4000-8000-000000000042',
    email: 'member@example.com',
    email_confirmed_at: '2026-07-29T12:00:00.000Z',
    user_metadata: { display_name: 'Dealivra Member' },
  };
  const session = {
    access_token: accessToken,
    expires_in: 3600,
    user,
  };
  const factor = {
    id: '00000000-0000-4000-8000-000000000043',
    factorType: 'totp',
    friendlyName: 'Primary authenticator',
    createdAt: '2026-07-29T12:00:00.000Z',
    updatedAt: null,
  };

  assert.equal(
    schemas.parseAuthSession(session, 'auth_refresh').user.email,
    'member@example.com',
  );
  assert.deepEqual(
    schemas.parseSignupResponse({
      session,
      needsEmailConfirmation: false,
    }).session.user.user_metadata,
    { display_name: 'Dealivra Member' },
  );
  assert.deepEqual(
    schemas.parseSignupResponse({
      session: null,
      needsEmailConfirmation: true,
    }),
    { session: null, needsEmailConfirmation: true },
  );
  assert.equal(
    schemas.parseLoginResponse(session).access_token,
    accessToken,
  );
  assert.equal(
    schemas.parseLoginResponse({
      mfa_required: true,
      pending_access_token: accessToken,
      expires_in: 300,
      factors: [factor],
    }).factors[0].factorType,
    'totp',
  );
  assert.equal(
    schemas.parseMfaStatusResponse({
      assuranceLevel: 'aal2',
      factors: [factor],
      minimumVerifiedFactors: 0,
      canRemoveVerifiedFactor: true,
      unsupportedVerifiedFactor: false,
    }).assuranceLevel,
    'aal2',
  );
  assert.equal(
    schemas.parseMfaEnrollmentResponse({
      factorId: factor.id,
      friendlyName: 'Primary authenticator',
      qrCodeSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
      secret: 'JBSWY3DPEHPK3PXP',
      uri: 'otpauth://totp/Dealivra:member%40example.com?secret=JBSWY3DPEHPK3PXP',
    }).factorId,
    factor.id,
  );
});

test('invalid Auth and MFA responses fail closed without exposing secrets or identity data', async () => {
  const schemas = await import('../src/services/authRuntimeSchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);

  const accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhbWwiOiJhYWwxIn0.private-signature';
  const session = {
    access_token: accessToken,
    expires_in: 3600,
    user: {
      id: '00000000-0000-4000-8000-000000000042',
      email: 'private-member@example.com',
      email_confirmed_at: null,
      user_metadata: { display_name: null },
    },
  };

  try {
    assert.throws(
      () => schemas.parseAuthSession({
        ...session,
        refresh_token: 'provider-refresh-secret',
      }, 'auth_refresh'),
      error => (
        error instanceof schemas.AuthResponseValidationError
        && error.boundary === 'auth_refresh'
        && error.issue === 'refresh_token_exposed'
      ),
    );
    assert.throws(
      () => schemas.parseAuthSession({
        ...session,
        access_token: 'not-a-jwt',
      }, 'auth_login'),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseSignupResponse({
        session: null,
        needsEmailConfirmation: false,
      }),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseLoginResponse({
        mfa_required: true,
        pending_access_token: accessToken,
        expires_in: 300,
        factors: [],
      }),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseMfaStatusResponse({
        assuranceLevel: 'aal2',
        factors: [],
        minimumVerifiedFactors: 0,
        canRemoveVerifiedFactor: true,
        unsupportedVerifiedFactor: false,
      }),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseMfaEnrollmentResponse({
        factorId: '00000000-0000-4000-8000-000000000043',
        friendlyName: 'Primary authenticator',
        qrCodeSvg: '<svg><script>steal()</script></svg>',
        secret: 'PRIVATESECRET234',
        uri: 'https://attacker.invalid/totp',
      }),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.auth\.response-rejection\.v1/);
  assert.match(serializedLogs, /auth_refresh/);
  assert.doesNotMatch(serializedLogs, /provider-refresh-secret/);
  assert.doesNotMatch(serializedLogs, /private-signature/);
  assert.doesNotMatch(serializedLogs, /private-member@example\.com/);
  assert.doesNotMatch(serializedLogs, /PRIVATESECRET234/);
});

test('the second ARC-004 boundary validates every browser Auth and MFA success response', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/authRuntimeSchemas.ts');

  assert.match(service, /parseSignupResponse\(responseBody\)/);
  assert.match(service, /parseLoginResponse\(responseBody\)/);
  assert.match(service, /parseAuthSession\(responseBody,'auth_refresh'\)/);
  assert.match(service, /parseMfaStatusResponse\(await mfaRequest/);
  assert.match(service, /parseMfaEnrollmentResponse\(await mfaRequest/);
  assert.match(service, /'mfa_session'/);
  assert.doesNotMatch(service, /interface AuthResponse/);
  assert.doesNotMatch(service, /mfaRequest<T>/);
  assert.doesNotMatch(service, /response\.json\(\) as AuthResponse/);

  assert.match(schemas, /dealivra\.auth\.response-rejection\.v1/);
  assert.match(schemas, /refresh_token_exposed/);
  assert.match(schemas, /AuthResponseValidationError/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
});

test('browser Auth mutation requests and reviewed error envelopes are runtime validated', async () => {
  const schemas = await import('../src/services/authBoundarySchemas.ts');
  const accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhbWwiOiJhYWwyIn0.signature';
  const factorId = '00000000-0000-4000-8000-000000000043';

  assert.deepEqual(
    schemas.parseAuthSignupRequest({
      email: '  Member@Example.com ',
      password: 'Correct-Horse9!',
      displayName: ' Dealivra Member ',
    }),
    {
      email: 'member@example.com',
      password: 'Correct-Horse9!',
      displayName: 'Dealivra Member',
    },
  );
  assert.deepEqual(
    schemas.parseAuthLoginRequest({
      email: 'MEMBER@example.com',
      password: 'legacy-password',
    }),
    {
      email: 'member@example.com',
      password: 'legacy-password',
    },
  );
  assert.deepEqual(schemas.parseAuthRefreshRequest({}), {});
  assert.deepEqual(
    schemas.parseAuthRecoverRequest({ email: 'Member@example.com' }),
    { email: 'member@example.com' },
  );
  assert.deepEqual(
    schemas.parseAuthPasswordRequest({
      action: 'recovery',
      newPassword: 'Replacement9!Pass',
    }),
    {
      action: 'recovery',
      newPassword: 'Replacement9!Pass',
    },
  );
  assert.deepEqual(
    schemas.parseAuthPasswordRequest({
      action: 'change',
      currentPassword: 'legacy-password',
      newPassword: 'Replacement9!Pass',
    }),
    {
      action: 'change',
      currentPassword: 'legacy-password',
      newPassword: 'Replacement9!Pass',
    },
  );
  assert.deepEqual(
    schemas.parseAuthLogoutRequest({ scope: 'others' }),
    { scope: 'others' },
  );
  assert.deepEqual(
    schemas.parseAuthMfaRequest({
      action: 'challenge_and_verify',
      purpose: 'step_up',
      factorId,
      code: '123456',
    }),
    {
      action: 'challenge_and_verify',
      purpose: 'step_up',
      factorId,
      code: '123456',
    },
  );
  assert.equal(
    schemas.parseAuthBearerToken(accessToken, 'auth_mfa_request'),
    accessToken,
  );

  assert.deepEqual(
    schemas.parseAuthErrorEnvelope(
      {
        error: 'Too many attempts.',
        retryAfter: 60,
      },
      429,
      '60',
      'auth_login_error',
    ),
    {
      error: 'Too many attempts.',
      code: null,
      retryAfter: 60,
    },
  );
  assert.deepEqual(
    schemas.parseAuthErrorEnvelope(
      {
        error: 'This security change is temporarily locked after account recovery.',
        code: 'recovery_cooldown_active',
      },
      423,
      null,
      'auth_mfa_error',
    ),
    {
      error: 'This security change is temporarily locked after account recovery.',
      code: 'recovery_cooldown_active',
      retryAfter: null,
    },
  );
});

test('invalid Auth mutation boundaries fail closed without logging credentials or provider data', async () => {
  const schemas = await import('../src/services/authBoundarySchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);

  try {
    assert.throws(
      () => schemas.parseAuthSignupRequest({
        email: 'private-member@example.com',
        password: 'Private-Password9!',
        displayName: 'Private Member',
        refresh_token: 'provider-refresh-secret',
      }),
      error => (
        error instanceof schemas.AuthBoundaryValidationError
        && error.boundary === 'auth_signup_request'
        && error.issue === 'request_shape_invalid'
      ),
    );
    assert.throws(
      () => schemas.parseAuthPasswordRequest({
        action: 'recovery',
        currentPassword: 'Private-Old9!',
        newPassword: 'Private-New9!',
      }),
      /processed safely/i,
    );
    assert.throws(
      () => schemas.parseAuthMfaRequest({
        action: 'challenge_and_verify',
        purpose: 'login',
        factorId: '00000000-0000-4000-8000-000000000043',
        code: '12AB56',
      }),
      /6-digit authenticator code/i,
    );
    assert.throws(
      () => schemas.parseAuthBearerToken(
        'private-provider-token',
        'auth_password_request',
      ),
      /session expired/i,
    );
    assert.throws(
      () => schemas.parseAuthErrorEnvelope(
        {
          error: 'Private provider diagnostic',
          provider_token: 'provider-secret-value',
        },
        503,
        null,
        'auth_refresh_error',
      ),
      /processed safely/i,
    );
    assert.throws(
      () => schemas.parseAuthErrorEnvelope(
        {
          error: 'Too many attempts.',
          retryAfter: 30,
        },
        429,
        '60',
        'auth_login_error',
      ),
      /processed safely/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.auth\.boundary-rejection\.v1/);
  assert.match(serializedLogs, /auth_signup_request/);
  assert.match(serializedLogs, /auth_refresh_error/);
  assert.doesNotMatch(serializedLogs, /private-member@example\.com/);
  assert.doesNotMatch(serializedLogs, /Private-Password9/);
  assert.doesNotMatch(serializedLogs, /Private-Old9/);
  assert.doesNotMatch(serializedLogs, /Private-New9/);
  assert.doesNotMatch(serializedLogs, /12AB56/);
  assert.doesNotMatch(serializedLogs, /private-provider-token/);
  assert.doesNotMatch(serializedLogs, /Private provider diagnostic/);
  assert.doesNotMatch(serializedLogs, /provider-secret-value/);
});

test('the eighth ARC-004 boundary validates every browser Auth mutation request and error', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/authBoundarySchemas.ts');

  for (const parser of [
    'parseAuthSignupRequest',
    'parseAuthLoginRequest',
    'parseAuthRefreshRequest',
    'parseAuthRecoverRequest',
    'parseAuthPasswordRequest',
    'parseAuthLogoutRequest',
    'parseAuthMfaRequest',
    'parseAuthBearerToken',
    'parseAuthErrorEnvelope',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
    assert.match(schemas, new RegExp(`function ${parser}\\(`));
  }
  for (const boundary of [
    'auth_signup_error',
    'auth_login_error',
    'auth_refresh_error',
    'auth_recover_error',
    'auth_password_error',
    'auth_logout_error',
    'auth_mfa_error',
  ]) {
    assert.match(service, new RegExp(`'${boundary}'`));
  }
  assert.doesNotMatch(service, /function boundedRetryAfter/);
  assert.doesNotMatch(service, /providerMessage/);
  assert.doesNotMatch(service, /function validatePassword/);
  assert.match(schemas, /dealivra\.auth\.boundary-rejection\.v1/);
  assert.match(schemas, /request_shape_invalid/);
  assert.match(schemas, /retry_after_conflict/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
});

test('protected payment and Stripe success responses are runtime validated', async () => {
  const schemas = await import('../src/services/paymentRuntimeSchemas.ts');
  const { currencyCodes } = await import('../src/currency.ts');
  const now = Date.now();
  const paidAt = new Date(now - 5 * 60_000).toISOString();
  const checkoutExpiresAt = new Date(now + 60 * 60_000).toISOString();

  const payment = schemas.parseProtectedPaymentStatusRows([{
    status: 'funds_secured',
    item_amount_cents: 12500,
    platform_fee_cents: 500,
    seller_amount_cents: 12000,
    currency: 'USD',
    checkout_expires_at: checkoutExpiresAt,
    paid_at: paidAt,
    released_at: null,
    refunded_at: null,
    disputed_at: null,
    failure_message: null,
    seller_connected: true,
    seller_payouts_ready: true,
    viewer_role: 'buyer',
  }]);
  assert.equal(payment.status, 'funds_secured');
  assert.equal(
    payment.platform_fee_cents + payment.seller_amount_cents,
    payment.item_amount_cents,
  );

  assert.deepEqual(
    schemas.parseStripeConnectStatusResponse({
      connected: true,
      detailsSubmitted: true,
      payoutsEnabled: true,
      transfersActive: true,
      ready: true,
    }),
    {
      connected: true,
      detailsSubmitted: true,
      payoutsEnabled: true,
      transfersActive: true,
      ready: true,
    },
  );

  const onboarding = schemas.parseStripeConnectOnboardingResponse({
    url: 'https://connect.stripe.com/setup/s/test_account_link',
    expiresAt: Math.floor((now + 10 * 60_000) / 1000),
  });
  assert.equal(onboarding.url, 'https://connect.stripe.com/setup/s/test_account_link');

  const checkout = schemas.parseStripeCheckoutResponse({
    url: 'https://checkout.stripe.com/c/pay/cs_test_safe_session#fidkdWxOYHwnPyd1blpx',
    expiresAt: checkoutExpiresAt,
    reused: true,
  });
  assert.equal(checkout.reused, true);

  assert.deepEqual(
    schemas.parseStripeDisputeResolutionResponse({
      resolved: true,
      action: 'refund',
      refundId: 're_12345678',
      idempotent: true,
    }),
    {
      resolved: true,
      action: 'refund',
      refundId: 're_12345678',
      idempotent: true,
    },
  );
  assert.deepEqual(
    schemas.parseStripeDisputeResolutionResponse({
      resolved: true,
      action: 'transfer',
      transferId: 'tr_12345678',
    }),
    {
      resolved: true,
      action: 'transfer',
      transferId: 'tr_12345678',
      idempotent: false,
    },
  );

  assert.deepEqual(
    [...new Set(schemas.paymentCurrencyCodes)].sort(),
    [...new Set(currencyCodes)].sort(),
  );
});

test('invalid payment responses fail closed without logging financial or provider data', async () => {
  const schemas = await import('../src/services/paymentRuntimeSchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const now = Date.now();
  const privateCheckoutUrl =
    'https://attacker.invalid/c/pay/private-checkout-session-token';

  try {
    assert.throws(
      () => schemas.parseProtectedPaymentStatusRows([{
        status: 'funds_secured',
        item_amount_cents: 12500,
        platform_fee_cents: 500,
        seller_amount_cents: 11999,
        currency: 'USD',
        checkout_expires_at: null,
        paid_at: new Date(now - 60_000).toISOString(),
        released_at: null,
        refunded_at: null,
        disputed_at: null,
        failure_message: 'private-provider-message',
        seller_connected: true,
        seller_payouts_ready: true,
        viewer_role: 'buyer',
      }]),
      error => (
        error instanceof schemas.PaymentResponseValidationError
        && error.boundary === 'protected_payment_status'
        && error.issue === 'amounts_do_not_balance'
      ),
    );
    assert.throws(
      () => schemas.parseProtectedPaymentStatusRows([]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseProtectedPaymentStatusRows([{
        status: 'released',
        item_amount_cents: 12500,
        platform_fee_cents: 500,
        seller_amount_cents: 12000,
        currency: 'USD',
        checkout_expires_at: null,
        paid_at: new Date(now - 60_000).toISOString(),
        released_at: new Date(now - 120_000).toISOString(),
        refunded_at: null,
        disputed_at: null,
        failure_message: null,
        seller_connected: true,
        seller_payouts_ready: true,
        viewer_role: 'seller',
      }]),
      error => (
        error instanceof schemas.PaymentResponseValidationError
        && error.boundary === 'protected_payment_status'
        && error.issue === 'event_timestamp_order_invalid'
      ),
    );
    assert.throws(
      () => schemas.parseStripeConnectStatusResponse({
        connected: false,
        detailsSubmitted: true,
        payoutsEnabled: false,
        transfersActive: false,
        ready: false,
      }),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseStripeConnectOnboardingResponse({
        url: privateCheckoutUrl,
        expiresAt: Math.floor((now + 10 * 60_000) / 1000),
      }),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseStripeCheckoutResponse({
        url: privateCheckoutUrl,
        expiresAt: new Date(now + 60 * 60_000).toISOString(),
      }),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseStripeDisputeResolutionResponse({
        resolved: true,
        action: 'refund',
        refundId: 're_private-provider-id',
        transferId: 'tr_private-provider-id',
      }),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.payment\.response-rejection\.v1/);
  assert.match(serializedLogs, /protected_payment_status/);
  assert.doesNotMatch(serializedLogs, /private-provider-message/);
  assert.doesNotMatch(serializedLogs, /private-checkout-session-token/);
  assert.doesNotMatch(serializedLogs, /private-provider-id/);
  assert.doesNotMatch(serializedLogs, /12500/);
});

test('the third ARC-004 boundary validates every browser payment success response', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/paymentRuntimeSchemas.ts');

  assert.match(service, /parseProtectedPaymentStatusRows\(data\)/);
  assert.match(service, /parseStripeConnectStatusResponse\(await invokeEdgeFunction/);
  assert.match(service, /parseStripeConnectOnboardingResponse\(await invokeEdgeFunction/);
  assert.match(service, /parseStripeCheckoutResponse\(await invokeEdgeFunction/);
  assert.match(service, /parseStripeDisputeResolutionResponse\(await invokeEdgeFunction/);
  assert.doesNotMatch(service, /invokeEdgeFunction<T>/);
  assert.doesNotMatch(service, /as ProtectedPaymentStatus\[\]/);
  assert.doesNotMatch(service, /invokeEdgeFunction<StripeConnectStatus>/);

  assert.match(schemas, /dealivra\.payment\.response-rejection\.v1/);
  assert.match(schemas, /amounts_do_not_balance/);
  assert.match(schemas, /event_timestamp_order_invalid/);
  assert.match(schemas, /https:\/\/checkout\.stripe\.com/);
  assert.match(schemas, /https:\/\/connect\.stripe\.com/);
  assert.match(schemas, /PaymentResponseValidationError/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
});

test('browser protected-payment requests and reviewed errors are runtime validated', async () => {
  const schemas = await import('../src/services/paymentBoundarySchemas.ts');
  const dealId = '11111111-1111-4111-8111-111111111111';
  const correlationId = '22222222-2222-4222-8222-222222222222';

  assert.deepEqual(
    schemas.parseStripeConnectRequest({ action: 'status' }),
    { action: 'status' },
  );
  assert.deepEqual(
    schemas.parseStripeConnectRequest({
      action: 'onboard',
      dealPublicId: '  ab12cd34  ',
    }),
    {
      action: 'onboard',
      dealPublicId: 'AB12CD34',
    },
  );
  assert.deepEqual(
    schemas.parseStripeCheckoutRequest({ dealId }),
    { dealId },
  );
  assert.deepEqual(
    schemas.parseProtectedPaymentStatusRequest({ p_deal_id: dealId }),
    { p_deal_id: dealId },
  );
  assert.deepEqual(
    schemas.parsePaymentErrorEnvelope(
      {
        error: 'The payment provider is temporarily unavailable.',
        code: 'provider_unavailable',
        correlationId,
        retryable: true,
      },
      503,
      correlationId,
      'stripe_checkout_error',
    ),
    {
      error: 'The payment provider is temporarily unavailable.',
      code: 'provider_unavailable',
      correlationId,
      retryable: true,
    },
  );
  assert.deepEqual(
    schemas.parsePaymentPostgrestErrorEnvelope(
      {
        code: 'P0001',
        details: null,
        hint: null,
        message: 'Only deal participants can view protected payment status',
      },
      400,
    ),
    {
      message: 'Only deal participants can view protected payment status',
      code: 'P0001',
    },
  );
});

test('invalid payment request and error boundaries fail closed without logging financial data', async () => {
  const schemas = await import('../src/services/paymentBoundarySchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const dealId = '11111111-1111-4111-8111-111111111111';
  const correlationId = '22222222-2222-4222-8222-222222222222';
  const otherCorrelationId = '33333333-3333-4333-8333-333333333333';
  const privateProviderMessage = 'private-provider-payment-diagnostic';

  try {
    assert.throws(
      () => schemas.parseStripeConnectRequest({
        action: 'status',
        dealPublicId: 'PRIVATE99',
      }),
      error => (
        error instanceof schemas.PaymentBoundaryValidationError
        && error.boundary === 'stripe_connect_request'
        && error.issue === 'request_shape_invalid'
      ),
    );
    assert.throws(
      () => schemas.parseStripeCheckoutRequest({
        dealId,
        priceCents: 125_00,
      }),
      /processed safely/i,
    );
    assert.throws(
      () => schemas.parsePaymentErrorEnvelope(
        {
          error: privateProviderMessage,
          code: 'provider_unavailable',
          correlationId,
          retryable: true,
        },
        503,
        otherCorrelationId,
        'stripe_checkout_error',
      ),
      /processed safely/i,
    );
    assert.throws(
      () => schemas.parsePaymentErrorEnvelope(
        {
          error: privateProviderMessage,
          code: 'provider_unavailable',
          correlationId,
          retryable: true,
          providerRequestId: 'req_private-provider-request',
        },
        503,
        correlationId,
        'stripe_connect_error',
      ),
      /processed safely/i,
    );
    assert.throws(
      () => schemas.parsePaymentPostgrestErrorEnvelope(
        {
          message: privateProviderMessage,
          code: 'P0001',
          payment_intent: 'pi_private-provider-object',
        },
        400,
      ),
      /processed safely/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.payment\.boundary-rejection\.v1/);
  assert.match(serializedLogs, /stripe_connect_request/);
  assert.match(serializedLogs, /stripe_checkout_request/);
  assert.match(serializedLogs, /stripe_checkout_error/);
  assert.match(serializedLogs, /stripe_connect_error/);
  assert.match(serializedLogs, /protected_payment_status_error/);
  assert.doesNotMatch(serializedLogs, /PRIVATE99/);
  assert.doesNotMatch(serializedLogs, /12500/);
  assert.doesNotMatch(serializedLogs, /private-provider-payment-diagnostic/);
  assert.doesNotMatch(serializedLogs, /req_private-provider-request/);
  assert.doesNotMatch(serializedLogs, /pi_private-provider-object/);
  assert.doesNotMatch(serializedLogs, new RegExp(correlationId));
  assert.doesNotMatch(serializedLogs, new RegExp(otherCorrelationId));
});

test('the tenth ARC-004 boundary validates protected-payment requests and errors', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/paymentBoundarySchemas.ts');

  for (const parser of [
    'parseStripeConnectRequest',
    'parseStripeCheckoutRequest',
    'parseProtectedPaymentStatusRequest',
    'parsePaymentErrorEnvelope',
    'parsePaymentPostgrestErrorEnvelope',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
    assert.match(schemas, new RegExp(`function ${parser}\\(`));
  }
  for (const boundary of [
    'stripe_connect_error',
    'stripe_checkout_error',
    'stripe_dispute_resolution_error',
  ]) {
    assert.match(service, new RegExp(`'${boundary}'`));
  }
  assert.match(schemas, /'protected_payment_status_error'/);
  assert.doesNotMatch(service, /typeof data\?\.error==='string'/);
  assert.doesNotMatch(service, /typeof data\?\.correlationId==='string'/);
  assert.doesNotMatch(service, /data\?\.retryable===true/);
  assert.match(schemas, /dealivra\.payment\.boundary-rejection\.v1/);
  assert.match(schemas, /correlation_id_conflict/);
  assert.match(schemas, /request_shape_invalid/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
});

test('evidence, lifecycle, and administrator dispute success responses are runtime validated', async () => {
  const schemas = await import('../src/services/evidenceRuntimeSchemas.ts');
  const { currencyCodes } = await import('../src/currency.ts');
  const now = Date.now();
  const userId = '11111111-1111-4111-8111-111111111111';
  const dealId = '22222222-2222-4222-8222-222222222222';
  const intakeId = '33333333-3333-4333-8333-333333333333';
  const evidenceId = '44444444-4444-4444-8444-444444444444';
  const disputeId = '55555555-5555-4555-8555-555555555555';
  const jobId = '66666666-6666-4666-8666-666666666666';
  const holdKey = '77777777-7777-4777-8777-777777777777';
  const alertId = '88888888-8888-4888-8888-888888888888';
  const createdAt = new Date(now - 5 * 60_000).toISOString();
  const scannedAt = new Date(now - 4 * 60_000).toISOString();
  const integrityCheckedAt = new Date(now - 3 * 60_000).toISOString();
  const retentionUntil = new Date(now + 365 * 24 * 60 * 60_000).toISOString();
  const digest = 'a'.repeat(64);
  const evidence = {
    id: evidenceId,
    deal_id: dealId,
    dispute_id: disputeId,
    uploader_role: 'seller',
    evidence_type: 'seller_item_photo',
    file_name: 'package-photo.webp',
    mime_type: 'image/webp',
    detected_mime_type: 'image/webp',
    file_size_bytes: 2_048,
    sha256: digest,
    scan_status: 'clean',
    scanned_at: scannedAt,
    integrity_status: 'verified',
    integrity_checked_at: integrityCheckedAt,
    retention_class: 'dispute_evidence',
    retention_until: retentionUntil,
    lifecycle_status: 'retained',
    deleted_at: null,
    created_at: createdAt,
  };

  const intake = schemas.parseEvidenceUploadIntakeResponse({
    intakeId,
    path: `${userId}/${dealId}/${intakeId}.webp`,
    bucket: 'deal-evidence-quarantine',
    expiresAt: new Date(now + 15 * 60_000).toISOString(),
  }, userId, dealId);
  assert.equal(intake.bucket, 'deal-evidence-quarantine');

  const finalized = schemas.parseFinalizeEvidenceResponse(
    { evidence },
    dealId,
    'seller',
  );
  assert.equal(finalized.evidence.sha256, digest);
  const deletedEvidence = {
    ...evidence,
    id: '99999999-9999-4999-8999-999999999999',
    dispute_id: null,
    file_name: null,
    mime_type: null,
    detected_mime_type: null,
    file_size_bytes: null,
    sha256: null,
    scan_status: 'deleted',
    scanned_at: null,
    integrity_status: 'deleted',
    integrity_checked_at: new Date(now - 60_000).toISOString(),
    lifecycle_status: 'deleted',
    deleted_at: new Date(now - 60_000).toISOString(),
  };
  const evidenceRows = schemas.parseDealEvidenceRows(
    [evidence, deletedEvidence],
    dealId,
  );
  assert.deepEqual(evidenceRows[0], finalized.evidence);
  assert.equal(evidenceRows[1].lifecycle_status, 'deleted');

  const viewer = schemas.parseEvidenceSignedViewerResponse({
    url:
      'https://project.supabase.co/storage/v1/object/sign/deal-evidence/private/package-photo.webp?token=safe-test-token',
    expiresAt: new Date(now + 60_000).toISOString(),
    mimeType: 'image/webp',
    fileName: 'package-photo.webp',
    fileSizeBytes: 2_048,
    sha256: digest,
    scanStatus: 'clean',
    scannedAt,
    integrityStatus: 'verified',
    integrityCheckedAt,
  }, 'https://project.supabase.co');
  assert.equal(viewer.integrityStatus, 'verified');

  const snapshot = schemas.parseEvidenceLifecycleSnapshotResponse({
    generatedAt: new Date(now).toISOString(),
    counts: {
      openAlerts: 1,
      integrityQueued: 0,
      quarantineQueued: 0,
      deletionReviews: 1,
      activeLegalHolds: 1,
    },
    jobs: [{
      jobId,
      jobType: 'evidence_delete',
      status: 'pending_review',
      evidenceId,
      publicId: 'AB12CD34',
      title: 'Verified phone',
      retentionClass: 'dispute_evidence',
      retentionUntil,
      lifecycleStatus: 'deletion_review',
      reasonCode: 'retention_period_elapsed',
      attempts: 0,
      lastErrorCode: null,
      createdAt,
      updatedAt: integrityCheckedAt,
      activeHold: true,
      holdKey,
    }],
    alerts: [{
      alertId,
      alertType: 'deletion_review_required',
      severity: 'warning',
      ownerRole: 'compliance',
      status: 'open',
      summary: 'Evidence reached its retention date and requires review.',
      evidenceId,
      jobId,
      createdAt,
    }],
  });
  assert.equal(snapshot.jobs[0].holdKey, holdKey);

  assert.equal(
    schemas.parseEvidenceInventoryResponse({
      inventory: {
        expiredIntakes: 1,
        queuedQuarantineCleanup: 1,
        queuedIntegrityChecks: 2,
        classifiedEvidence: 3,
        queuedDeletionReviews: 1,
        refreshedAt: new Date(now).toISOString(),
      },
    }).inventory.queuedIntegrityChecks,
    2,
  );
  assert.equal(schemas.parseEvidenceJobIdResponse({ jobId }).jobId, jobId);
  assert.equal(
    schemas.parseEvidenceHoldKeyResponse({ holdKey }, holdKey).holdKey,
    holdKey,
  );
  assert.deepEqual(
    schemas.parseEvidenceAlertAcknowledgementResponse({ acknowledged: true }),
    { acknowledged: true },
  );

  const disputes = schemas.parseAdminDisputeRows([{
    dispute_id: disputeId,
    deal_id: dealId,
    public_id: 'AB12CD34',
    title: 'Verified phone',
    reason: 'The delivered item does not match the agreement.',
    dispute_status: 'open',
    response_deadline: new Date(now + 48 * 60 * 60_000).toISOString(),
    opened_at: createdAt,
    opened_by_name: 'Buyer',
    seller_name: 'Seller',
    buyer_name: 'Buyer',
    payment_status: 'funds_secured',
    item_amount_cents: 125_00,
    currency: 'USD',
    resolution_note: null,
  }]);
  assert.equal(disputes[0].payment_status, 'funds_secured');
  assert.deepEqual(
    [...new Set(schemas.evidenceCurrencyCodes)].sort(),
    [...new Set(currencyCodes)].sort(),
  );
});

test('invalid evidence and dispute responses fail closed without logging case data', async () => {
  const schemas = await import('../src/services/evidenceRuntimeSchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const now = Date.now();
  const userId = '11111111-1111-4111-8111-111111111111';
  const dealId = '22222222-2222-4222-8222-222222222222';
  const intakeId = '33333333-3333-4333-8333-333333333333';
  const evidenceId = '44444444-4444-4444-8444-444444444444';
  const disputeId = '55555555-5555-4555-8555-555555555555';
  const privateFileName = 'private-customer-evidence-name.webp';
  const privateCaseReason = 'private-customer-dispute-reason';
  const privateSignedToken = 'private-signed-storage-token';

  try {
    assert.throws(
      () => schemas.parseEvidenceUploadIntakeResponse({
        intakeId,
        path: `${userId}/${dealId}/../${privateFileName}`,
        bucket: 'deal-evidence-quarantine',
        expiresAt: new Date(now + 15 * 60_000).toISOString(),
      }, userId, dealId),
      error => (
        error instanceof schemas.EvidenceResponseValidationError
        && error.boundary === 'evidence_upload_intake'
        && error.issue === 'path_invalid'
      ),
    );
    assert.throws(
      () => schemas.parseEvidenceSignedViewerResponse({
        url:
          `https://attacker.invalid/storage/v1/object/sign/deal-evidence/file?token=${privateSignedToken}`,
        expiresAt: new Date(now + 60_000).toISOString(),
        mimeType: 'image/webp',
        fileName: privateFileName,
        fileSizeBytes: 2_048,
        sha256: 'a'.repeat(64),
        scanStatus: 'clean',
        scannedAt: new Date(now - 120_000).toISOString(),
        integrityStatus: 'verified',
        integrityCheckedAt: new Date(now - 60_000).toISOString(),
      }, 'https://project.supabase.co'),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseEvidenceLifecycleSnapshotResponse({
        generatedAt: new Date(now).toISOString(),
        counts: {
          openAlerts: 0,
          integrityQueued: 0,
          quarantineQueued: 0,
          deletionReviews: 1,
          activeLegalHolds: 1,
        },
        jobs: [{
          jobId: '66666666-6666-4666-8666-666666666666',
          jobType: 'evidence_delete',
          status: 'pending_review',
          evidenceId,
          publicId: 'AB12CD34',
          title: privateFileName,
          retentionClass: 'dispute_evidence',
          retentionUntil: new Date(now + 60_000).toISOString(),
          lifecycleStatus: 'deletion_review',
          reasonCode: 'retention_period_elapsed',
          attempts: 0,
          lastErrorCode: null,
          createdAt: new Date(now - 120_000).toISOString(),
          updatedAt: new Date(now - 60_000).toISOString(),
          activeHold: true,
          holdKey: null,
        }],
        alerts: [],
      }),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseAdminDisputeRows([{
        dispute_id: disputeId,
        deal_id: dealId,
        public_id: 'AB12CD34',
        title: privateFileName,
        reason: privateCaseReason,
        dispute_status: 'open',
        response_deadline: new Date(now + 60_000).toISOString(),
        opened_at: new Date(now - 60_000).toISOString(),
        opened_by_name: 'Private Buyer',
        seller_name: 'Private Seller',
        buyer_name: 'Private Buyer',
        payment_status: 'funds_secured',
        item_amount_cents: -125_00,
        currency: 'USD',
        resolution_note: null,
      }]),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.evidence\.response-rejection\.v1/);
  assert.match(serializedLogs, /evidence_upload_intake/);
  assert.match(serializedLogs, /evidence_signed_viewer/);
  assert.match(serializedLogs, /evidence_lifecycle_snapshot/);
  assert.match(serializedLogs, /admin_dispute_list/);
  assert.doesNotMatch(serializedLogs, /private-customer-evidence-name/);
  assert.doesNotMatch(serializedLogs, /private-customer-dispute-reason/);
  assert.doesNotMatch(serializedLogs, /private-signed-storage-token/);
  assert.doesNotMatch(serializedLogs, /12500/);
});

test('the fourth ARC-004 boundary validates every evidence and dispute success response', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/evidenceRuntimeSchemas.ts');

  assert.match(service, /parseEvidenceUploadIntakeResponse\(await invokeEvidenceFiles/);
  assert.match(service, /parseFinalizeEvidenceResponse\(await invokeEvidenceFiles/);
  assert.match(service, /parseDealEvidenceRows\(await readBoundedJson\(response\)/);
  assert.match(service, /parseEvidenceSignedViewerResponse\(await invokeEvidenceFiles/);
  assert.match(service, /parseEvidenceLifecycleSnapshotResponse\(await invokeEvidenceMaintenance/);
  assert.match(service, /parseEvidenceInventoryResponse\(await invokeEvidenceMaintenance/);
  assert.match(service, /parseEvidenceJobIdResponse\(await invokeEvidenceMaintenance/);
  assert.match(service, /parseEvidenceHoldKeyResponse\(await invokeEvidenceMaintenance/);
  assert.match(service, /parseEvidenceAlertAcknowledgementResponse\(await invokeEvidenceMaintenance/);
  assert.match(service, /parseAdminDisputeRows\(await readBoundedJson\(response\)/);
  assert.doesNotMatch(service, /invokeEvidenceFiles<T>/);
  assert.doesNotMatch(service, /invokeEvidenceMaintenance<T>/);
  assert.doesNotMatch(service, /as DealEvidence\[\]/);
  assert.doesNotMatch(service, /as AdminDispute\[\]/);
  assert.doesNotMatch(service, /as DealEvidenceViewer/);

  assert.match(schemas, /dealivra\.evidence\.response-rejection\.v1/);
  assert.match(schemas, /deleted_evidence_contract_invalid/);
  assert.match(schemas, /snapshot_collection_contract_invalid/);
  assert.match(schemas, /resolution_status_contract_invalid/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
});

test('browser evidence and dispute mutation requests and reviewed errors are runtime validated', async () => {
  const schemas = await import('../src/services/evidenceBoundarySchemas.ts');
  const dealId = '11111111-1111-4111-8111-111111111111';
  const intakeId = '22222222-2222-4222-8222-222222222222';
  const evidenceId = '33333333-3333-4333-8333-333333333333';
  const holdKey = '44444444-4444-4444-8444-444444444444';
  const alertId = '55555555-5555-4555-8555-555555555555';
  const disputeId = '66666666-6666-4666-8666-666666666666';

  assert.deepEqual(
    schemas.parseEvidenceFilesRequest({
      action: 'request-upload',
      dealId,
      uploaderRole: 'seller',
      evidenceType: 'seller_item_photo',
      fileName: '  packed-item.webp  ',
      claimedMimeType: 'image/webp',
      fileSize: 2_048,
    }),
    {
      action: 'request-upload',
      dealId,
      uploaderRole: 'seller',
      evidenceType: 'seller_item_photo',
      fileName: 'packed-item.webp',
      claimedMimeType: 'image/webp',
      fileSize: 2_048,
    },
  );
  assert.deepEqual(
    schemas.parseEvidenceFilesRequest({
      action: 'finalize-upload',
      intakeId,
    }),
    { action: 'finalize-upload', intakeId },
  );
  assert.deepEqual(
    schemas.parseEvidenceFilesRequest({
      action: 'signed-url',
      evidenceId,
    }),
    { action: 'signed-url', evidenceId },
  );
  assert.deepEqual(
    schemas.parseEvidenceMaintenanceRequest({
      action: 'release-legal-hold',
      evidenceId,
      holdKey,
      reason: '  The approved legal hold can now be released.  ',
    }),
    {
      action: 'release-legal-hold',
      evidenceId,
      holdKey,
      reason: 'The approved legal hold can now be released.',
    },
  );
  assert.deepEqual(
    schemas.parseEvidenceMaintenanceRequest({
      action: 'acknowledge-alert',
      alertId,
    }),
    { action: 'acknowledge-alert', alertId },
  );
  assert.deepEqual(
    schemas.parseOpenDisputeRequest({
      p_deal_id: dealId,
      p_reason: '  The delivered item does not match the shared agreement.  ',
    }),
    {
      p_deal_id: dealId,
      p_reason: 'The delivered item does not match the shared agreement.',
    },
  );
  assert.deepEqual(
    schemas.parseResolveDisputeRequest({
      p_dispute_id: disputeId,
      p_decision: 'cancelled',
      p_resolution_note: '  Both parties withdrew the case.  ',
    }),
    {
      p_dispute_id: disputeId,
      p_decision: 'cancelled',
      p_resolution_note: 'Both parties withdrew the case.',
    },
  );
  assert.deepEqual(
    schemas.parseFinancialDisputeRequest({
      disputeId,
      decision: 'resolved_buyer',
      note: '  Evidence supports a full refund.  ',
    }),
    {
      disputeId,
      decision: 'resolved_buyer',
      note: 'Evidence supports a full refund.',
    },
  );

  assert.deepEqual(
    schemas.parseEvidenceEdgeErrorEnvelope(
      {
        error: 'Verify your authenticator before continuing.',
        code: 'mfa_required',
      },
      403,
      'evidence_files_error',
    ),
    {
      message: 'Verify your authenticator before continuing.',
      code: 'mfa_required',
    },
  );
  assert.deepEqual(
    schemas.parsePostgrestErrorEnvelope(
      {
        code: 'P0001',
        details: null,
        hint: null,
        message: 'This deal already has an open dispute',
      },
      400,
      'dispute_open_error',
    ),
    {
      message: 'This deal already has an open dispute',
      code: 'P0001',
    },
  );
  assert.deepEqual(
    schemas.parseStorageErrorEnvelope(
      {
        statusCode: '409',
        error: 'Duplicate',
        message: 'The object already exists.',
      },
      409,
    ),
    {
      message: 'The object already exists.',
      code: null,
    },
  );
});

test('invalid evidence and dispute mutation boundaries fail closed without logging case data', async () => {
  const schemas = await import('../src/services/evidenceBoundarySchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const dealId = '11111111-1111-4111-8111-111111111111';
  const evidenceId = '33333333-3333-4333-8333-333333333333';
  const privateReason = 'private-customer-dispute-reason';
  const privateFileName = 'private-customer-file.webp';
  const privateProviderDiagnostic = 'private-provider-diagnostic';

  try {
    assert.throws(
      () => schemas.parseEvidenceFilesRequest({
        action: 'request-upload',
        dealId,
        uploaderRole: 'seller',
        evidenceType: 'buyer_damage_photo',
        fileName: privateFileName,
        claimedMimeType: 'image/webp',
        fileSize: 2_048,
      }),
      error => (
        error instanceof schemas.EvidenceBoundaryValidationError
        && error.boundary === 'evidence_files_request'
        && error.issue === 'evidence_type_invalid'
      ),
    );
    assert.throws(
      () => schemas.parseEvidenceMaintenanceRequest({
        action: 'approve-deletion',
        evidenceId,
        reason: 'short',
      }),
      /10 to 1,000/i,
    );
    assert.throws(
      () => schemas.parseOpenDisputeRequest({
        p_deal_id: dealId,
        p_reason: privateReason.repeat(100),
      }),
      /10 to 2,000/i,
    );
    assert.throws(
      () => schemas.parseEvidenceEdgeErrorEnvelope(
        {
          error: privateProviderDiagnostic,
          code: 'evidence_service_error',
          provider_token: 'private-provider-token',
        },
        503,
        'evidence_files_error',
      ),
      /processed safely/i,
    );
    assert.throws(
      () => schemas.parsePostgrestErrorEnvelope(
        {
          message: privateProviderDiagnostic,
          code: 'P0001',
          private_case_reason: privateReason,
        },
        400,
        'dispute_open_error',
      ),
      /processed safely/i,
    );
    assert.throws(
      () => schemas.parseStorageErrorEnvelope(
        {
          statusCode: '500',
          error: 'StorageError',
          message: privateProviderDiagnostic,
        },
        409,
      ),
      /processed safely/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.evidence\.boundary-rejection\.v1/);
  assert.match(serializedLogs, /evidence_files_request/);
  assert.match(serializedLogs, /evidence_maintenance_request/);
  assert.match(serializedLogs, /dispute_open_request/);
  assert.match(serializedLogs, /evidence_files_error/);
  assert.match(serializedLogs, /evidence_storage_error/);
  assert.doesNotMatch(serializedLogs, /private-customer-file/);
  assert.doesNotMatch(serializedLogs, /private-customer-dispute-reason/);
  assert.doesNotMatch(serializedLogs, /private-provider-diagnostic/);
  assert.doesNotMatch(serializedLogs, /private-provider-token/);
});

test('the ninth ARC-004 boundary validates evidence and dispute mutation requests and errors', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/evidenceBoundarySchemas.ts');

  for (const parser of [
    'parseEvidenceFilesRequest',
    'parseEvidenceMaintenanceRequest',
    'parseOpenDisputeRequest',
    'parseResolveDisputeRequest',
    'parseFinancialDisputeRequest',
    'parseEvidenceEdgeErrorEnvelope',
    'parsePostgrestErrorEnvelope',
    'parseStorageErrorEnvelope',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
    assert.match(schemas, new RegExp(`function ${parser}\\(`));
  }
  for (const boundary of [
    'evidence_files_error',
    'evidence_maintenance_error',
    'evidence_list_error',
    'dispute_open_error',
    'dispute_queue_error',
    'dispute_resolve_error',
  ]) {
    assert.match(service, new RegExp(`'${boundary}'`));
  }
  assert.doesNotMatch(service, /function safeEvidenceServiceError/);
  assert.doesNotMatch(
    service,
    /data\?\.message\|\|data\?\.error\|\|'Could not upload evidence file'/,
  );
  assert.match(schemas, /dealivra\.evidence\.boundary-rejection\.v1/);
  assert.match(schemas, /request_shape_invalid/);
  assert.match(schemas, /status_code_invalid/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
});

test('communication and safety-report response schemas accept governed service contracts', async () => {
  const schemas = await import('../src/services/interactionRuntimeSchemas.ts');
  const dealId = '11111111-1111-4111-8111-111111111111';
  const senderId = '22222222-2222-4222-8222-222222222222';
  const inquiryId = '33333333-3333-4333-8333-333333333333';
  const offerId = '44444444-4444-4444-8444-444444444444';
  const reportId = '55555555-5555-4555-8555-555555555555';
  const closedReportId = '66666666-6666-4666-8666-666666666666';
  const older = '2025-01-01T10:00:00.000Z';
  const newer = '2025-01-01T11:00:00.000Z';

  const notifications = schemas.parseDealNotificationRows([
    {
      id: `inquiry-reply-${inquiryId}`,
      deal_id: dealId,
      public_id: 'AB12CD34',
      title: 'Seller replied to your question',
      event_type: 'inquiry_replied',
      created_at: newer,
      is_mine: false,
      is_read: false,
    },
    {
      id: '42',
      deal_id: dealId,
      public_id: 'AB12CD34',
      title: 'You accepted the shared terms',
      event_type: 'terms_accepted',
      created_at: older,
      is_mine: true,
      is_read: true,
    },
  ]);
  assert.equal(notifications.length, 2);

  const messages = schemas.parseDealMessageRows([
    {
      id: 1,
      sender_id: senderId,
      sender_name: 'Buyer',
      body: 'Is the original receipt included?',
      created_at: older,
      is_mine: false,
    },
    {
      id: 2,
      sender_id: dealId,
      sender_name: 'Seller',
      body: 'Yes, the original receipt is included.',
      created_at: newer,
      is_mine: true,
    },
  ]);
  assert.equal(messages[1].id, 2);

  const offers = schemas.parseDealOfferRows([
    {
      id: offerId,
      amount_cents: 125_00,
      status: 'pending',
      buyer_name: 'Buyer',
      created_at: newer,
      is_mine: true,
    },
  ]);
  assert.equal(offers[0].amount_cents, 125_00);

  const inquiries = schemas.parseDealInquiryRows([
    {
      id: inquiryId,
      buyer_name: 'Buyer',
      body: 'Does the item include its original receipt?',
      seller_reply: 'Yes, it is included.',
      created_at: older,
      replied_at: newer,
      is_mine: true,
    },
  ]);
  assert.equal(inquiries[0].seller_reply, 'Yes, it is included.');

  assert.equal(schemas.parseInquiryIdResponse(inquiryId), inquiryId);
  assert.equal(schemas.parseCurrentUserDealSellerResponse(true), true);
  assert.equal(schemas.parseSafetyReportIdResponse(reportId), reportId);

  const reports = schemas.parseAdminReportRows([
    {
      report_id: reportId,
      deal_id: dealId,
      public_id: 'AB12CD34',
      title: 'Verified phone',
      reason: 'The public listing contains suspicious payment instructions.',
      report_status: 'open',
      moderation_status: 'visible',
      created_at: newer,
      reporter_name: 'Reporter',
      seller_name: 'Seller',
      resolution_note: null,
    },
    {
      report_id: closedReportId,
      deal_id: senderId,
      public_id: 'ZX98YU76',
      title: 'Reviewed laptop',
      reason: 'The listing required a manual safety review.',
      report_status: 'reviewed',
      moderation_status: 'hidden',
      created_at: older,
      reporter_name: 'Second Reporter',
      seller_name: 'Second Seller',
      resolution_note: 'Hidden while the seller supplies ownership evidence.',
    },
  ]);
  assert.equal(reports[1].moderation_status, 'hidden');
});

test('invalid communication responses fail closed without logging private conversation or report data', async () => {
  const schemas = await import('../src/services/interactionRuntimeSchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const dealId = '11111111-1111-4111-8111-111111111111';
  const senderId = '22222222-2222-4222-8222-222222222222';
  const inquiryId = '33333333-3333-4333-8333-333333333333';
  const reportId = '55555555-5555-4555-8555-555555555555';
  const privateMessage = 'private-message-with-bank-details';
  const privateQuestion = 'private-question-about-delivery-address';
  const privateReport = 'private-report-with-customer-contact-details';

  try {
    assert.throws(
      () => schemas.parseDealNotificationRows([{
        id: '42',
        deal_id: dealId,
        public_id: 'AB12CD34',
        title: 'Private notification title',
        event_type: 'terms_accepted',
        created_at: '2025-01-01T10:00:00.000Z',
        is_mine: true,
        is_read: false,
      }]),
      error => (
        error instanceof schemas.InteractionResponseValidationError
        && error.boundary === 'notification_list'
        && error.issue === 'notification_read_state_invalid'
      ),
    );
    assert.throws(
      () => schemas.parseDealMessageRows([{
        id: 1,
        sender_id: senderId,
        sender_name: 'Private Buyer',
        body: ` ${privateMessage}`,
        created_at: '2025-01-01T10:00:00.000Z',
        is_mine: false,
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseDealOfferRows([{
        id: '44444444-4444-4444-8444-444444444444',
        amount_cents: -125_00,
        status: 'pending',
        buyer_name: 'Private Buyer',
        created_at: '2025-01-01T10:00:00.000Z',
        is_mine: true,
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseDealInquiryRows([{
        id: inquiryId,
        buyer_name: 'Private Buyer',
        body: privateQuestion,
        seller_reply: 'Private seller reply',
        created_at: '2025-01-01T10:00:00.000Z',
        replied_at: null,
        is_mine: true,
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseCurrentUserDealSellerResponse('true'),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseAdminReportRows([{
        report_id: reportId,
        deal_id: dealId,
        public_id: 'AB12CD34',
        title: 'Private listing title',
        reason: privateReport,
        report_status: 'reviewed',
        moderation_status: 'hidden',
        created_at: '2025-01-01T10:00:00.000Z',
        reporter_name: 'Private Reporter',
        seller_name: 'Private Seller',
        resolution_note: null,
      }]),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(
    serializedLogs,
    /dealivra\.interaction\.response-rejection\.v1/,
  );
  assert.match(serializedLogs, /notification_list/);
  assert.match(serializedLogs, /message_list/);
  assert.match(serializedLogs, /offer_list/);
  assert.match(serializedLogs, /inquiry_list/);
  assert.match(serializedLogs, /current_user_deal_seller/);
  assert.match(serializedLogs, /admin_report_list/);
  assert.doesNotMatch(serializedLogs, /private-message-with-bank-details/);
  assert.doesNotMatch(serializedLogs, /private-question-about-delivery-address/);
  assert.doesNotMatch(serializedLogs, /private-report-with-customer-contact-details/);
  assert.doesNotMatch(serializedLogs, /12500/);
});

test('the fifth ARC-004 boundary validates communication and safety-report success responses', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/interactionRuntimeSchemas.ts');

  assert.match(service, /parseDealNotificationRows\(await readBoundedJson\(response\)/);
  assert.match(service, /parseDealMessageRows\(await readBoundedJson\(response\)/);
  assert.match(service, /parseDealOfferRows\(await readBoundedJson\(response\)/);
  assert.match(service, /parseDealInquiryRows\(await readBoundedJson\(response\)/);
  assert.match(service, /parseInquiryIdResponse\(await readBoundedJson\(response\)/);
  assert.match(service, /parseCurrentUserDealSellerResponse\(await readBoundedJson\(response\)/);
  assert.match(service, /parseSafetyReportIdResponse\(await readBoundedJson\(response\)/);
  assert.match(service, /parseAdminReportRows\(await readBoundedJson\(response\)/);
  assert.doesNotMatch(service, /as DealNotification\[\]/);
  assert.doesNotMatch(service, /as DealMessage\[\]/);
  assert.doesNotMatch(service, /as DealOffer\[\]/);
  assert.doesNotMatch(service, /as DealInquiry\[\]/);
  assert.doesNotMatch(service, /as AdminReport\[\]/);

  assert.match(
    schemas,
    /dealivra\.interaction\.response-rejection\.v1/,
  );
  assert.match(schemas, /notification_read_state_invalid/);
  assert.match(schemas, /inquiry_reply_state_invalid/);
  assert.match(schemas, /report_resolution_state_invalid/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
});

test('browser communication, offer, inquiry, and safety-report requests and errors are runtime validated', async () => {
  const schemas = await import('../src/services/interactionBoundarySchemas.ts');
  const dealId = '11111111-1111-4111-8111-111111111111';
  const offerId = '22222222-2222-4222-8222-222222222222';
  const inquiryId = '33333333-3333-4333-8333-333333333333';
  const reportId = '44444444-4444-4444-8444-444444444444';

  assert.deepEqual(schemas.parseNotificationListRequest({ p_limit: 12 }), {
    p_limit: 12,
  });
  assert.deepEqual(schemas.parseNotificationDealReadRequest({
    p_deal_id: dealId,
  }), { p_deal_id: dealId });
  assert.deepEqual(schemas.parseNotificationAllReadRequest({}), {});
  assert.deepEqual(schemas.parseMessageListRequest({ p_deal_id: dealId }), {
    p_deal_id: dealId,
  });
  assert.deepEqual(schemas.parseSendDealMessageRequest({
    p_deal_id: dealId,
    p_body: '  The receipt is inside the package.  ',
  }), {
    p_deal_id: dealId,
    p_body: 'The receipt is inside the package.',
  });
  assert.deepEqual(schemas.parseCreateOfferRequest({
    p_public_id: ' ab12cd34 ',
    p_amount_cents: 125_00,
    p_typed_name: '  Buyer Name  ',
  }), {
    p_public_id: 'AB12CD34',
    p_amount_cents: 125_00,
    p_typed_name: 'Buyer Name',
  });
  assert.deepEqual(schemas.parseOfferListRequest({ p_deal_id: dealId }), {
    p_deal_id: dealId,
  });
  assert.deepEqual(schemas.parseRespondOfferRequest({
    p_offer_id: offerId,
    p_accept: true,
  }), {
    p_offer_id: offerId,
    p_accept: true,
  });
  assert.deepEqual(schemas.parseCreateInquiryRequest({
    p_public_id: 'AB12CD34',
    p_body: '  Does this include the original receipt?  ',
  }), {
    p_public_id: 'AB12CD34',
    p_body: 'Does this include the original receipt?',
  });
  assert.deepEqual(schemas.parseInquiryListRequest({ p_deal_id: dealId }), {
    p_deal_id: dealId,
  });
  assert.deepEqual(schemas.parseReplyInquiryRequest({
    p_inquiry_id: inquiryId,
    p_reply: '  Yes, it is included.  ',
  }), {
    p_inquiry_id: inquiryId,
    p_reply: 'Yes, it is included.',
  });
  assert.deepEqual(schemas.parseCurrentUserDealSellerRequest({
    p_deal_id: dealId,
  }), { p_deal_id: dealId });
  assert.deepEqual(schemas.parseSafetyReportRequest({
    p_public_id: 'AB12CD34',
    p_category: 'Misleading information',
    p_details: '  The public description conflicts with the item photo.  ',
  }), {
    p_public_id: 'AB12CD34',
    p_category: 'Misleading information',
    p_details: 'The public description conflicts with the item photo.',
  });
  assert.deepEqual(schemas.parseAdminReportListRequest({
    p_status: 'open',
  }), { p_status: 'open' });
  assert.deepEqual(schemas.parseAdminReportResolutionRequest({
    p_report_id: reportId,
    p_decision: 'reviewed',
    p_resolution_note: '  Evidence reviewed and the listing was restricted.  ',
  }), {
    p_report_id: reportId,
    p_decision: 'reviewed',
    p_resolution_note: 'Evidence reviewed and the listing was restricted.',
  });
  assert.deepEqual(schemas.parseDealModerationRequest({
    p_deal_id: dealId,
    p_status: 'hidden',
    p_note: '  Hidden pending ownership evidence.  ',
  }), {
    p_deal_id: dealId,
    p_status: 'hidden',
    p_note: 'Hidden pending ownership evidence.',
  });
  assert.deepEqual(schemas.parseInteractionPostgrestErrorEnvelope({
    code: 'P0001',
    details: null,
    hint: null,
    message: 'Only the seller can respond',
  }, 400, 'offer_response_error'), {
    message: 'Only the seller can respond',
    code: 'P0001',
  });
});

test('invalid interaction request and error boundaries fail closed without logging private content', async () => {
  const schemas = await import('../src/services/interactionBoundarySchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const dealId = '11111111-1111-4111-8111-111111111111';
  const privateMessage = 'private-message-with-bank-account';
  const privateQuestion = 'private-question-with-home-address';
  const privateReport = 'private-report-with-customer-phone-number';
  const privateProvider = 'private-postgrest-database-diagnostic';

  try {
    assert.throws(
      () => schemas.parseSendDealMessageRequest({
        p_deal_id: dealId,
        p_body: privateMessage,
        sender_id: 'private-sender-id',
      }),
      error => (
        error instanceof schemas.InteractionBoundaryValidationError
        && error.boundary === 'message_send_request'
        && error.issue === 'request_shape_invalid'
      ),
    );
    assert.throws(
      () => schemas.parseCreateOfferRequest({
        p_public_id: 'AB12CD34',
        p_amount_cents: 99,
        p_typed_name: 'Private Buyer',
      }),
      /valid offer amount/i,
    );
    assert.throws(
      () => schemas.parseCreateInquiryRequest({
        p_public_id: 'AB12CD34',
        p_body: `${privateQuestion}\u0000`,
      }),
      /Question must contain/i,
    );
    assert.throws(
      () => schemas.parseSafetyReportRequest({
        p_public_id: 'AB12CD34',
        p_category: 'Send money now',
        p_details: privateReport,
      }),
      /valid report category/i,
    );
    assert.throws(
      () => schemas.parseAdminReportResolutionRequest({
        p_report_id: 'not-a-report-id',
        p_decision: 'reviewed',
        p_resolution_note: privateReport,
      }),
      /selected report is invalid/i,
    );
    assert.throws(
      () => schemas.parseInteractionPostgrestErrorEnvelope({
        code: 'P0001',
        details: privateProvider,
        hint: null,
        message: 'Could not send message',
        internal_query: privateProvider,
      }, 400, 'message_send_error'),
      /processed safely/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.interaction\.boundary-rejection\.v1/);
  assert.match(serializedLogs, /message_send_request/);
  assert.match(serializedLogs, /offer_create_request/);
  assert.match(serializedLogs, /inquiry_create_request/);
  assert.match(serializedLogs, /safety_report_create_request/);
  assert.match(serializedLogs, /admin_report_resolve_request/);
  assert.match(serializedLogs, /message_send_error/);
  assert.doesNotMatch(serializedLogs, /private-message-with-bank-account/);
  assert.doesNotMatch(serializedLogs, /private-question-with-home-address/);
  assert.doesNotMatch(serializedLogs, /private-report-with-customer-phone-number/);
  assert.doesNotMatch(serializedLogs, /private-postgrest-database-diagnostic/);
  assert.doesNotMatch(serializedLogs, /private-sender-id/);
});

test('the eleventh ARC-004 boundary validates every browser communication request and reviewed error', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/interactionBoundarySchemas.ts');

  for (const parser of [
    'parseNotificationListRequest',
    'parseNotificationDealReadRequest',
    'parseNotificationAllReadRequest',
    'parseMessageListRequest',
    'parseSendDealMessageRequest',
    'parseCreateOfferRequest',
    'parseOfferListRequest',
    'parseRespondOfferRequest',
    'parseCreateInquiryRequest',
    'parseInquiryListRequest',
    'parseReplyInquiryRequest',
    'parseCurrentUserDealSellerRequest',
    'parseSafetyReportRequest',
    'parseAdminReportListRequest',
    'parseAdminReportResolutionRequest',
    'parseDealModerationRequest',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
  }
  for (const boundary of [
    'notification_list_error',
    'notification_read_error',
    'message_list_error',
    'message_send_error',
    'offer_create_error',
    'offer_list_error',
    'offer_response_error',
    'inquiry_create_error',
    'inquiry_list_error',
    'inquiry_reply_error',
    'safety_report_create_error',
    'admin_report_list_error',
    'admin_report_resolve_error',
    'deal_moderation_error',
  ]) {
    assert.match(service, new RegExp(`'${boundary}'`));
  }
  assert.match(
    schemas,
    /dealivra\.interaction\.boundary-rejection\.v1/,
  );
  assert.match(schemas, /maximumAmountCents = 100_000_000_000/);
  assert.match(schemas, /Duplicate or stolen photos/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(
    service,
    /d\?\.message\|\|'Could not (?:submit report|load report queue|send message|send offer|load offers|respond to offer)'/,
  );
});

test('administrator finance and catalog response schemas accept governed projections', async () => {
  const schemas = await import('../src/services/adminRuntimeSchemas.ts');
  const { currencyCodes } = await import('../src/currency.ts');
  const transactionId = '11111111-1111-4111-8111-111111111111';
  const secondTransactionId = '22222222-2222-4222-8222-222222222222';
  const dealId = '33333333-3333-4333-8333-333333333333';
  const secondDealId = '44444444-4444-4444-8444-444444444444';
  const older = '2026-07-29T10:00:00.000Z';
  const newer = '2026-07-29T11:00:00.000Z';

  assert.equal(schemas.parseAdminAccessResponse(true), true);
  assert.equal(schemas.parseAdminAccessResponse(false), false);

  const summary = schemas.parseAdminRevenueSummaryRows([{
    currency: 'USD',
    total_payment_volume_cents: 50_000,
    total_commission_earned_cents: 1_000,
    total_released_to_sellers_cents: 19_000,
    total_protected_cents: 20_000,
    total_refunded_cents: 5_000,
    payment_count: 5,
    released_count: 2,
    refunded_count: 1,
    disputed_count: 1,
  }]);
  assert.equal(summary.total_payment_volume_cents, 50_000);
  assert.equal(summary.currency, 'USD');

  const transactions = schemas.parseAdminRevenueTransactionRows([
    {
      transaction_id: transactionId,
      deal_id: dealId,
      public_id: 'AB12CD34',
      title: 'Verified phone',
      status: 'funds_secured',
      currency: 'USD',
      item_amount_cents: 12_500,
      platform_fee_cents: 625,
      seller_amount_cents: 11_875,
      seller_name: 'Verified Seller',
      buyer_name: 'Verified Buyer',
      created_at: newer,
      updated_at: newer,
    },
    {
      transaction_id: secondTransactionId,
      deal_id: secondDealId,
      public_id: 'EF56GH78',
      title: 'Verified laptop',
      status: 'released',
      currency: 'USD',
      item_amount_cents: 20_000,
      platform_fee_cents: 1_000,
      seller_amount_cents: 19_000,
      seller_name: 'Second Seller',
      buyer_name: 'Second Buyer',
      created_at: older,
      updated_at: newer,
    },
  ]);
  assert.equal(transactions.length, 2);
  assert.equal(transactions[1].seller_amount_cents, 19_000);

  const catalog = schemas.parseAdminCatalogAdoptionRows([
    {
      window_days: 30,
      catalog_version: '2026-07-29.1',
      category_id: 'phone',
      deal_count: 12,
      structured_brand_count: 10,
      structured_model_count: 9,
      manual_fallback_count: 2,
      draft_count: 3,
      published_count: 4,
      accepted_count: 3,
      completed_count: 2,
      latest_deal_at: newer,
    },
    {
      window_days: 30,
      catalog_version: 'legacy',
      category_id: 'general',
      deal_count: 3,
      structured_brand_count: 0,
      structured_model_count: 0,
      manual_fallback_count: 3,
      draft_count: 1,
      published_count: 1,
      accepted_count: 1,
      completed_count: 0,
      latest_deal_at: older,
    },
  ], 30);
  assert.equal(catalog[0].category_id, 'phone');
  assert.equal(catalog[1].catalog_version, 'legacy');
  assert.deepEqual(
    [...new Set(schemas.adminCurrencyCodes)].sort(),
    [...new Set(currencyCodes)].sort(),
  );
});

test('invalid administrator projections fail closed without logging finance or customer data', async () => {
  const schemas = await import('../src/services/adminRuntimeSchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const privateTitle = 'private-customer-listing-title';
  const privateSeller = 'private-seller-name';
  const privateBuyer = 'private-buyer-name';
  const transactionId = '11111111-1111-4111-8111-111111111111';
  const dealId = '33333333-3333-4333-8333-333333333333';
  const createdAt = '2026-07-29T10:00:00.000Z';

  try {
    assert.throws(
      () => schemas.parseAdminAccessResponse('true'),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseAdminRevenueSummaryRows([{
        currency: 'USD',
        total_payment_volume_cents: 100,
        total_commission_earned_cents: 10,
        total_released_to_sellers_cents: 90,
        total_protected_cents: 50,
        total_refunded_cents: 0,
        payment_count: 1,
        released_count: 1,
        refunded_count: 0,
        disputed_count: 0,
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseAdminRevenueTransactionRows([{
        transaction_id: transactionId,
        deal_id: dealId,
        public_id: 'AB12CD34',
        title: privateTitle,
        status: 'funds_secured',
        currency: 'USD',
        item_amount_cents: 12_500,
        platform_fee_cents: 625,
        seller_amount_cents: 11_000,
        seller_name: privateSeller,
        buyer_name: privateBuyer,
        created_at: createdAt,
        updated_at: createdAt,
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseAdminCatalogAdoptionRows([{
        window_days: 7,
        catalog_version: 'private-catalog-version',
        category_id: 'private-category',
        deal_count: 2,
        structured_brand_count: 1,
        structured_model_count: 2,
        manual_fallback_count: 0,
        draft_count: 2,
        published_count: 0,
        accepted_count: 0,
        completed_count: 0,
        latest_deal_at: createdAt,
      }], 30),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.admin\.response-rejection\.v1/);
  assert.match(serializedLogs, /admin_revenue_transactions/);
  assert.doesNotMatch(serializedLogs, /private-customer-listing-title/);
  assert.doesNotMatch(serializedLogs, /private-seller-name/);
  assert.doesNotMatch(serializedLogs, /private-buyer-name/);
  assert.doesNotMatch(serializedLogs, /private-catalog-version/);
  assert.doesNotMatch(serializedLogs, /12500/);
});

test('the sixth ARC-004 boundary validates administrator finance and catalog success responses', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/adminRuntimeSchemas.ts');

  assert.match(service, /parseAdminAccessResponse\(await readBoundedJson\(response\)/);
  assert.match(service, /parseAdminRevenueSummaryRows\(await readBoundedJson\(response\)/);
  assert.match(service, /parseAdminRevenueTransactionRows\(await readBoundedJson\(response\)/);
  assert.match(service, /parseAdminCatalogAdoptionRows\(await readBoundedJson\(response\)/);
  assert.doesNotMatch(service, /as AdminRevenueSummary\[\]/);
  assert.doesNotMatch(service, /as AdminRevenueTransaction\[\]/);
  assert.doesNotMatch(service, /as AdminCatalogAdoption\[\]/);

  assert.match(schemas, /dealivra\.admin\.response-rejection\.v1/);
  assert.match(schemas, /summary_amount_contract_invalid/);
  assert.match(schemas, /transaction_amounts_do_not_balance/);
  assert.match(schemas, /catalog_window_contract_invalid/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
});

test('browser administrator finance and catalog requests and errors are runtime validated', async () => {
  const schemas = await import('../src/services/adminBoundarySchemas.ts');

  assert.deepEqual(schemas.parseAdminAccessRequest({}), {});
  assert.deepEqual(schemas.parseAdminRevenueSummaryRequest({}), {});
  assert.deepEqual(schemas.parseAdminRevenueTransactionsRequest({
    p_limit: 100,
  }), { p_limit: 100 });
  assert.deepEqual(schemas.parseAdminCatalogAdoptionRequest({
    p_days: 30,
  }), { p_days: 30 });
  assert.deepEqual(schemas.parseAdminPostgrestErrorEnvelope({
    code: 'P0001',
    details: null,
    hint: null,
    message: 'Admin access required',
  }, 403, 'admin_revenue_summary_error'), {
    message: 'Admin access required',
    code: 'P0001',
  });
});

test('invalid administrator request and error boundaries fail closed without logging finance data', async () => {
  const schemas = await import('../src/services/adminBoundarySchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const privateFinance = 'private-finance-ledger-diagnostic';
  const privateCatalog = 'private-catalog-adoption-diagnostic';

  try {
    assert.throws(
      () => schemas.parseAdminAccessRequest({
        role: 'admin',
      }),
      error => (
        error instanceof schemas.AdminBoundaryValidationError
        && error.boundary === 'admin_access_request'
        && error.issue === 'request_shape_invalid'
      ),
    );
    assert.throws(
      () => schemas.parseAdminRevenueTransactionsRequest({
        p_limit: 201,
      }),
      /limit from 1 to 200/i,
    );
    assert.throws(
      () => schemas.parseAdminCatalogAdoptionRequest({
        p_days: 365,
      }),
      /7, 30, or 90 day/i,
    );
    assert.throws(
      () => schemas.parseAdminPostgrestErrorEnvelope({
        code: 'P0001',
        details: privateFinance,
        hint: privateCatalog,
        message: 'Admin access required',
        query: privateFinance,
      }, 403, 'admin_revenue_transactions_error'),
      /processed safely/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.admin\.boundary-rejection\.v1/);
  assert.match(serializedLogs, /admin_access_request/);
  assert.match(serializedLogs, /admin_revenue_transactions_request/);
  assert.match(serializedLogs, /admin_catalog_adoption_request/);
  assert.match(serializedLogs, /admin_revenue_transactions_error/);
  assert.doesNotMatch(serializedLogs, /private-finance-ledger-diagnostic/);
  assert.doesNotMatch(serializedLogs, /private-catalog-adoption-diagnostic/);
  assert.doesNotMatch(serializedLogs, /"role":"admin"/);
  assert.doesNotMatch(serializedLogs, /201|365/);
});

test('the twelfth ARC-004 boundary validates every browser administrator finance and catalog request and reviewed error', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/adminBoundarySchemas.ts');

  for (const parser of [
    'parseAdminAccessRequest',
    'parseAdminRevenueSummaryRequest',
    'parseAdminRevenueTransactionsRequest',
    'parseAdminCatalogAdoptionRequest',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
  }
  for (const boundary of [
    'admin_revenue_summary_error',
    'admin_revenue_transactions_error',
    'admin_catalog_adoption_error',
  ]) {
    assert.match(service, new RegExp(`'${boundary}'`));
  }
  assert.match(schemas, /dealivra\.admin\.boundary-rejection\.v1/);
  assert.match(schemas, /source\.p_limit > 200/);
  assert.match(schemas, /source\.p_days !== 90/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(
    service,
    /d\?\.message\|\|'Could not load (?:revenue summary|revenue transactions|catalog adoption)'/,
  );
});

test('public trust and risk schemas accept reviewed RPC projections', async () => {
  const schemas = await import('../src/services/trustRuntimeSchemas.ts');
  const memberSince = '2025-07-29T10:00:00.000Z';
  const newestRating = '2026-07-29T11:00:00.000Z';
  const olderRating = '2026-07-28T11:00:00.000Z';

  assert.deepEqual(schemas.parseDealRiskAssessmentRows([{
    risk_score: 73,
    risk_level: 'high',
    signals: [
      'unverified_seller',
      'new_account',
      'no_photos',
      'community_reports',
    ],
  }]), {
    risk_score: 73,
    risk_level: 'high',
    signals: [
      'unverified_seller',
      'new_account',
      'no_photos',
      'community_reports',
    ],
  });
  assert.deepEqual(schemas.parseDealRiskAssessmentRows([{
    risk_score: 0,
    risk_level: 'low',
    signals: ['no_flags'],
  }]), {
    risk_score: 0,
    risk_level: 'low',
    signals: ['no_flags'],
  });
  assert.equal(schemas.parseDealRiskAssessmentRows([]), null);

  const seller = schemas.parsePublicSellerTrustProfileRows([{
    display_name: 'Verified Seller',
    verification_status: 'verified',
    member_since: memberSince,
    completed_sales: 12,
    rating_count: 8,
    average_rating: 4.5,
  }]);
  assert.equal(seller.display_name, 'Verified Seller');
  assert.equal(seller.average_rating, 4.5);
  assert.equal(schemas.parsePublicSellerTrustProfileRows([]), null);

  assert.deepEqual(schemas.parseTrustPassportSettingsRows([{
    public_id: 'A1B2C3D4E5F6',
    enabled: true,
  }]), {
    public_id: 'A1B2C3D4E5F6',
    enabled: true,
  });
  assert.equal(
    schemas.parseTrustPassportToggleResponse('A1B2C3D4E5F6'),
    'A1B2C3D4E5F6',
  );

  const passport = schemas.parsePublicTrustPassportRows([{
    display_name: 'Verified Seller',
    verification_status: 'verified',
    member_since: memberSince,
    completed_deals: 15,
    completed_sales: 12,
    completed_purchases: 3,
    rating_count: 8,
    average_rating: 4.5,
    recent_ratings: [
      { stars: 5, created_at: newestRating },
      { stars: 4, created_at: olderRating },
    ],
  }]);
  assert.equal(passport.completed_deals, 15);
  assert.equal(passport.recent_ratings.length, 2);
  assert.equal(schemas.parsePublicTrustPassportRows([]), null);
});

test('invalid public trust and risk projections fail closed without logging profile data', async () => {
  const schemas = await import('../src/services/trustRuntimeSchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const privateName = 'private-passport-display-name';
  const privatePublicId = 'A1B2C3D4E5F6';
  const privateRatingTimestamp = '2026-07-29T11:23:45.000Z';

  try {
    assert.throws(
      () => schemas.parseDealRiskAssessmentRows([{
        risk_score: 18,
        risk_level: 'high',
        signals: ['unverified_seller'],
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseDealRiskAssessmentRows([{
        risk_score: 18,
        risk_level: 'low',
        signals: ['no_flags', 'unverified_seller'],
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parsePublicSellerTrustProfileRows([{
        display_name: privateName,
        verification_status: 'verified',
        member_since: '2025-07-29T10:00:00.000Z',
        completed_sales: 12,
        rating_count: 0,
        average_rating: 5,
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseTrustPassportSettingsRows([{
        public_id: privatePublicId.toLowerCase(),
        enabled: true,
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parsePublicTrustPassportRows([{
        display_name: privateName,
        verification_status: 'verified',
        member_since: '2025-07-29T10:00:00.000Z',
        completed_deals: 14,
        completed_sales: 12,
        completed_purchases: 3,
        rating_count: 2,
        average_rating: 4.5,
        recent_ratings: [
          { stars: 4, created_at: '2026-07-28T11:00:00.000Z' },
          { stars: 5, created_at: privateRatingTimestamp },
        ],
      }]),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.trust\.response-rejection\.v1/);
  assert.match(serializedLogs, /deal_risk_assessment/);
  assert.match(serializedLogs, /public_seller_trust_profile/);
  assert.match(serializedLogs, /trust_passport_settings/);
  assert.match(serializedLogs, /public_trust_passport/);
  assert.doesNotMatch(serializedLogs, /private-passport-display-name/);
  assert.doesNotMatch(serializedLogs, /A1B2C3D4E5F6/);
  assert.doesNotMatch(serializedLogs, /2026-07-29T11:23:45/);
  assert.doesNotMatch(serializedLogs, /4\.5/);
});

test('the seventh ARC-004 boundary validates public trust and risk success responses', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/trustRuntimeSchemas.ts');

  assert.match(service, /parseDealRiskAssessmentRows\(await readBoundedJson\(response\)/);
  assert.match(service, /parsePublicSellerTrustProfileRows\(await readBoundedJson\(response\)/);
  assert.match(service, /parseTrustPassportSettingsRows\(await readBoundedJson\(response\)/);
  assert.match(service, /parseTrustPassportToggleResponse\(await readBoundedJson\(response\)/);
  assert.match(service, /parsePublicTrustPassportRows\(await readBoundedJson\(response\)/);
  assert.doesNotMatch(service, /as RiskAssessment\[\]/);
  assert.doesNotMatch(service, /as PublicTrustProfile\[\]/);
  assert.doesNotMatch(service, /as TrustPassportSettings\[\]/);
  assert.doesNotMatch(service, /as TrustPassport\[\]/);

  assert.match(schemas, /dealivra\.trust\.response-rejection\.v1/);
  assert.match(schemas, /risk_score_contract_invalid/);
  assert.match(schemas, /average_rating_without_ratings/);
  assert.match(schemas, /completed_deal_counts_invalid/);
  assert.match(schemas, /recent_rating_order_invalid/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
});

test('browser trust, passport, and risk requests and errors are runtime validated', async () => {
  const schemas = await import('../src/services/trustBoundarySchemas.ts');

  assert.deepEqual(schemas.parseDealRiskRequest({
    p_public_id: ' ab12cd34 ',
  }), { p_public_id: 'AB12CD34' });
  assert.deepEqual(schemas.parsePublicSellerTrustRequest({
    p_public_id: 'ZX98YU76',
  }), { p_public_id: 'ZX98YU76' });
  assert.deepEqual(schemas.parseTrustPassportSettingsRequest({}), {});
  assert.deepEqual(schemas.parseTrustPassportToggleRequest({
    p_enabled: true,
  }), { p_enabled: true });
  assert.deepEqual(schemas.parsePublicTrustPassportRequest({
    p_public_id: ' a1b2c3d4e5f6 ',
  }), { p_public_id: 'A1B2C3D4E5F6' });
  assert.deepEqual(schemas.parseTrustPostgrestErrorEnvelope({
    code: 'P0001',
    details: null,
    hint: null,
    message: 'Trust profile is unavailable',
  }, 404, 'public_seller_trust_error'), {
    code: 'P0001',
  });
});

test('invalid trust request and error boundaries fail closed without logging profile or provider data', async () => {
  const schemas = await import('../src/services/trustBoundarySchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const privatePublicId = 'A1B2C3D4E5F6';
  const privateProvider = 'private-trust-provider-diagnostic';

  try {
    assert.throws(
      () => schemas.parseDealRiskRequest({
        p_public_id: 'AB12CD34',
        seller_id: 'private-seller-id',
      }),
      error => (
        error instanceof schemas.TrustBoundaryValidationError
        && error.boundary === 'deal_risk_request'
        && error.issue === 'request_shape_invalid'
      ),
    );
    assert.throws(
      () => schemas.parseTrustPassportSettingsRequest({
        user_id: 'private-user-id',
      }),
      /processed safely/i,
    );
    assert.throws(
      () => schemas.parseTrustPassportToggleRequest({
        p_enabled: 'true',
      }),
      /processed safely/i,
    );
    assert.throws(
      () => schemas.parsePublicTrustPassportRequest({
        p_public_id: `${privatePublicId}ZZ`,
      }),
      /passport link is invalid/i,
    );
    assert.throws(
      () => schemas.parseTrustPostgrestErrorEnvelope({
        code: 'P0001',
        details: privateProvider,
        hint: null,
        message: 'Trust profile is unavailable',
        profile: privateProvider,
      }, 404, 'public_trust_passport_error'),
      /processed safely/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.trust\.boundary-rejection\.v1/);
  assert.match(serializedLogs, /deal_risk_request/);
  assert.match(serializedLogs, /trust_passport_settings_request/);
  assert.match(serializedLogs, /trust_passport_toggle_request/);
  assert.match(serializedLogs, /public_trust_passport_request/);
  assert.match(serializedLogs, /public_trust_passport_error/);
  assert.doesNotMatch(serializedLogs, /private-seller-id/);
  assert.doesNotMatch(serializedLogs, /private-user-id/);
  assert.doesNotMatch(serializedLogs, /private-trust-provider-diagnostic/);
  assert.doesNotMatch(serializedLogs, /A1B2C3D4E5F6/);
});

test('the thirteenth ARC-004 boundary validates every browser trust request and reviewed error', () => {
  const service = readText('src/services/supabaseRest.ts');
  const schemas = readText('src/services/trustBoundarySchemas.ts');

  for (const parser of [
    'parseDealRiskRequest',
    'parsePublicSellerTrustRequest',
    'parseTrustPassportSettingsRequest',
    'parseTrustPassportToggleRequest',
    'parsePublicTrustPassportRequest',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
  }
  for (const boundary of [
    'deal_risk_error',
    'public_seller_trust_error',
    'trust_passport_settings_error',
    'trust_passport_toggle_error',
    'public_trust_passport_error',
  ]) {
    assert.match(service, new RegExp(`'${boundary}'`));
  }
  assert.match(schemas, /dealivra\.trust\.boundary-rejection\.v1/);
  assert.match(schemas, /trustPublicIdPattern = \/\^\[A-F0-9\]\{12\}\$\//);
  assert.deepEqual(
    [...schemas.matchAll(/return \{ code \};/g)].length,
    1,
  );
  assert.doesNotMatch(schemas, /return \{ message/);
  assert.doesNotMatch(schemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(
    service,
    /d\?\.message\|\|'Could not (?:load|update) passport settings'/,
  );
});

test('delivery, meeting, handoff, and inspection schemas accept reviewed responses', async () => {
  const schemas = await import('../src/services/deliveryRuntimeSchemas.ts');
  const dealId = '11111111-1111-4111-8111-111111111111';
  const recordId = '22222222-2222-4222-8222-222222222222';
  const actorId = '33333333-3333-4333-8333-333333333333';
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60 * 60_000).toISOString();

  assert.deepEqual(schemas.parseDealMeetingRows([{
    id: recordId,
    deal_id: dealId,
    proposed_by: actorId,
    location_name: 'Central police exchange zone',
    address: '100 Main Street, Austin, TX 78701',
    scheduled_at: future,
    status: 'confirmed',
    seller_arrived: true,
    buyer_arrived: false,
  }]), [{
    id: recordId,
    deal_id: dealId,
    proposed_by: actorId,
    location_name: 'Central police exchange zone',
    address: '100 Main Street, Austin, TX 78701',
    scheduled_at: future,
    status: 'confirmed',
    seller_arrived: true,
    buyer_arrived: false,
  }]);
  assert.equal(schemas.parseHandoffPinResponse('004219'), '004219');
  assert.deepEqual(schemas.parseDealInspectionRows([{
    agreement_version: 2,
    item_reviewed: true,
    price_confirmed: true,
    handoff_confirmed: true,
    reference_checked: true,
    inspected_at: past,
    buyer_name: 'Buyer Name',
  }])[0].agreement_version, 2);
  assert.deepEqual(schemas.parseDealShipmentRows([{
    id: recordId,
    deal_id: dealId,
    carrier: 'UPS',
    tracking_number: '1Z999AA10123456784',
    status: 'shipped',
    shipped_at: past,
    delivered_at: null,
  }])[0].status, 'shipped');
  assert.deepEqual(schemas.parseDealDeliveryDetailsRows([{
    recipient_name: 'Buyer Name',
    full_address: '100 Main Street, Apt 5B, Austin, TX 78701',
    country: 'United States',
    instructions: 'Leave with the staffed front desk.',
    updated_at: past,
    locked: false,
  }])[0].locked, false);
  assert.deepEqual(schemas.parseDealMeetingRows([]), []);
  assert.deepEqual(schemas.parseDealInspectionRows([]), []);
  assert.deepEqual(schemas.parseDealShipmentRows([]), []);
  assert.deepEqual(schemas.parseDealDeliveryDetailsRows([]), []);
});

test('invalid delivery responses fail closed without logging addresses, tracking, or PIN data', async () => {
  const schemas = await import('../src/services/deliveryRuntimeSchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const privateAddress = '987 Private Lane, Unit 42, Austin, TX 78701';
  const privateTracking = '1ZPRIVATE123456789';
  const privatePin = '903117';
  const dealId = '11111111-1111-4111-8111-111111111111';
  const recordId = '22222222-2222-4222-8222-222222222222';
  const actorId = '33333333-3333-4333-8333-333333333333';
  const past = new Date(Date.now() - 60_000).toISOString();

  try {
    assert.throws(
      () => schemas.parseDealMeetingRows([{
        id: recordId,
        deal_id: dealId,
        proposed_by: actorId,
        location_name: 'Safe exchange',
        address: privateAddress,
        scheduled_at: new Date(Date.now() + 60_000).toISOString(),
        status: 'confirmed',
        seller_arrived: true,
        buyer_arrived: true,
        handoff_pin_hash: 'private-hash',
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseHandoffPinResponse(privatePin.slice(0, 5)),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseDealShipmentRows([{
        id: recordId,
        deal_id: dealId,
        carrier: 'UPS',
        tracking_number: privateTracking,
        status: 'delivered',
        shipped_at: past,
        delivered_at: null,
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseDealDeliveryDetailsRows([{
        recipient_name: 'Buyer Name',
        full_address: privateAddress,
        country: 'United States',
        instructions: null,
        updated_at: past,
        locked: 'false',
      }]),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.delivery\.response-rejection\.v1/);
  assert.match(serializedLogs, /deal_meeting/);
  assert.match(serializedLogs, /handoff_pin/);
  assert.match(serializedLogs, /deal_shipment/);
  assert.match(serializedLogs, /delivery_details/);
  assert.doesNotMatch(serializedLogs, /987 Private Lane/);
  assert.doesNotMatch(serializedLogs, /1ZPRIVATE/);
  assert.doesNotMatch(serializedLogs, /903117/);
  assert.doesNotMatch(serializedLogs, /private-hash/);
});

test('browser delivery and handoff requests and errors are runtime validated', async () => {
  const schemas = await import('../src/services/deliveryBoundarySchemas.ts');
  const dealId = '11111111-1111-4111-8111-111111111111';
  const nowMs = 1_700_000_000_000;
  const meetingAt = new Date(nowMs + 60 * 60_000).toISOString();
  const dealRequest = { p_deal_id: dealId };

  for (const parser of [
    schemas.parseDealMeetingReadRequest,
    schemas.parseMeetingConfirmationRequest,
    schemas.parseMeetingArrivalRequest,
    schemas.parseHandoffPinGenerateRequest,
    schemas.parseDealInspectionReadRequest,
    schemas.parseDealShipmentReadRequest,
    schemas.parseShippingEvidenceReadinessRequest,
    schemas.parseDeliveryDetailsReadRequest,
    schemas.parseDealActionPlanRequest,
    schemas.parseShipmentDeliveryConfirmationRequest,
  ]) {
    assert.deepEqual(parser(dealRequest), dealRequest);
  }
  assert.deepEqual(schemas.parseMeetingProposalRequest({
    p_deal_id: dealId,
    p_location_name: '  Central police exchange zone  ',
    p_address: '  100 Main Street, Austin, TX 78701  ',
    p_scheduled_at: meetingAt,
  }, nowMs), {
    p_deal_id: dealId,
    p_location_name: 'Central police exchange zone',
    p_address: '100 Main Street, Austin, TX 78701',
    p_scheduled_at: meetingAt,
  });
  assert.deepEqual(schemas.parseHandoffCompleteRequest({
    p_deal_id: dealId,
    p_pin: '004219',
  }), { p_deal_id: dealId, p_pin: '004219' });
  assert.equal(
    schemas.parseDealInspectionRecordRequest({
      p_deal_id: dealId,
      p_item_reviewed: true,
      p_price_confirmed: true,
      p_handoff_confirmed: true,
      p_reference_checked: true,
    }).p_reference_checked,
    true,
  );
  assert.deepEqual(schemas.parseDeliveryDetailsSaveRequest({
    p_deal_id: dealId,
    p_recipient_name: ' Buyer Name ',
    p_full_address: ' 100 Main Street, Apt 5B, Austin, TX 78701 ',
    p_country: ' United States ',
    p_instructions: ' Leave with the staffed front desk. ',
  }), {
    p_deal_id: dealId,
    p_recipient_name: 'Buyer Name',
    p_full_address: '100 Main Street, Apt 5B, Austin, TX 78701',
    p_country: 'United States',
    p_instructions: 'Leave with the staffed front desk.',
  });
  assert.deepEqual(schemas.parseShipmentCreateRequest({
    p_deal_id: dealId,
    p_carrier: ' UPS ',
    p_tracking_number: ' 1z999aa10123456784 ',
  }), {
    p_deal_id: dealId,
    p_carrier: 'UPS',
    p_tracking_number: '1Z999AA10123456784',
  });
  assert.deepEqual(schemas.parseDeliveryPostgrestErrorEnvelope({
    code: 'P0001',
    details: null,
    hint: null,
    message: 'Shipment is unavailable for this deal',
  }, 409, 'shipment_create_error'), { code: 'P0001' });
});

test('invalid delivery request and error boundaries fail closed without logging private logistics data', async () => {
  const schemas = await import('../src/services/deliveryBoundarySchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const dealId = '11111111-1111-4111-8111-111111111111';
  const privateAddress = '987 Private Lane, Unit 42, Austin, TX 78701';
  const privateTracking = '1ZPRIVATE123456789';
  const privateProvider = 'private-postgrest-logistics-detail';

  try {
    assert.throws(
      () => schemas.parseMeetingProposalRequest({
        p_deal_id: dealId,
        p_location_name: 'Safe exchange',
        p_address: privateAddress,
        p_scheduled_at: 'not-a-time',
      }),
      /valid meeting time/i,
    );
    assert.throws(
      () => schemas.parseHandoffCompleteRequest({
        p_deal_id: dealId,
        p_pin: '12345A',
      }),
      /six-digit/i,
    );
    assert.throws(
      () => schemas.parseDealInspectionRecordRequest({
        p_deal_id: dealId,
        p_item_reviewed: true,
        p_price_confirmed: true,
        p_handoff_confirmed: false,
        p_reference_checked: true,
      }),
      /processed safely/i,
    );
    assert.throws(
      () => schemas.parseShipmentCreateRequest({
        p_deal_id: dealId,
        p_carrier: 'UPS',
        p_tracking_number: `${privateTracking}<script>`,
      }),
      /valid tracking number/i,
    );
    assert.throws(
      () => schemas.parseDeliveryPostgrestErrorEnvelope({
        code: 'P0001',
        details: privateProvider,
        hint: null,
        message: 'Shipment rejected',
        address: privateAddress,
      }, 409, 'shipment_create_error'),
      /processed safely/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /dealivra\.delivery\.boundary-rejection\.v1/);
  assert.match(serializedLogs, /meeting_proposal_request/);
  assert.match(serializedLogs, /handoff_complete_request/);
  assert.match(serializedLogs, /deal_inspection_record_request/);
  assert.match(serializedLogs, /shipment_create_request/);
  assert.match(serializedLogs, /shipment_create_error/);
  assert.doesNotMatch(serializedLogs, /987 Private Lane/);
  assert.doesNotMatch(serializedLogs, /1ZPRIVATE/);
  assert.doesNotMatch(serializedLogs, /private-postgrest-logistics-detail/);
});

test('the fourteenth ARC-004 boundary validates delivery success, request, and error contracts', () => {
  const service = readText('src/services/supabaseRest.ts');
  const requestSchemas = readText('src/services/deliveryBoundarySchemas.ts');
  const responseSchemas = readText('src/services/deliveryRuntimeSchemas.ts');

  for (const parser of [
    'parseDealMeetingReadRequest',
    'parseMeetingProposalRequest',
    'parseMeetingConfirmationRequest',
    'parseMeetingArrivalRequest',
    'parseHandoffPinGenerateRequest',
    'parseHandoffCompleteRequest',
    'parseDealInspectionReadRequest',
    'parseDealInspectionRecordRequest',
    'parseDealShipmentReadRequest',
    'parseShippingEvidenceReadinessRequest',
    'parseDeliveryDetailsReadRequest',
    'parseDeliveryDetailsSaveRequest',
    'parseDealActionPlanRequest',
    'parseShipmentCreateRequest',
    'parseShipmentDeliveryConfirmationRequest',
    'parseDealMeetingRows',
    'parseHandoffPinResponse',
    'parseDealInspectionRows',
    'parseDealShipmentRows',
    'parseDealDeliveryDetailsRows',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
  }
  assert.match(
    service,
    /select=id,deal_id,proposed_by,location_name,address,scheduled_at,status,seller_arrived,buyer_arrived/,
  );
  assert.match(
    service,
    /select=id,deal_id,carrier,tracking_number,status,shipped_at,delivered_at/,
  );
  assert.doesNotMatch(service, /deal_(?:meetings|shipments)\?[^`]*select=\*/);
  assert.match(requestSchemas, /dealivra\.delivery\.boundary-rejection\.v1/);
  assert.match(responseSchemas, /dealivra\.delivery\.response-rejection\.v1/);
  assert.match(requestSchemas, /handoff_pin_invalid/);
  assert.match(responseSchemas, /delivery_state_invalid/);
  assert.doesNotMatch(requestSchemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(responseSchemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(
    service,
    /d\?\.message\|\|'Could not (?:load meeting|generate PIN|complete deal|load inspection receipt|save inspection receipt|check shipping evidence|save delivery address|save shipment|confirm delivery)'/,
  );
});

test('profile, session, rating, timeline, and participant schemas accept reviewed contracts', async () => {
  const schemas = await import('../src/services/accountActivityRuntimeSchemas.ts');
  const now = Date.now();
  const recent = new Date(now - 60_000).toISOString();
  const older = new Date(now - 120_000).toISOString();
  const oldest = new Date(now - 180_000).toISOString();
  const expiry = new Date(now + 60 * 60_000).toISOString();
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const otherSessionId = '22222222-2222-4222-8222-222222222222';
  const eventId = '33333333-3333-4333-8333-333333333333';
  const dealId = '44444444-4444-4444-8444-444444444444';

  const profile = schemas.parseProfileSummaryRows([{
    display_name: 'Account Owner',
    verification_status: 'verified',
    member_since: oldest,
    completed_deals: 7,
    rating_count: 2,
    average_rating: 4.5,
    recent_ratings: [
      { stars: 5, comment: 'Clear communication', created_at: recent },
      { stars: 4, comment: null, created_at: older },
    ],
  }])[0];
  assert.equal(profile.completed_deals, 7);
  assert.equal(profile.recent_ratings.length, 2);

  const sessions = schemas.parseAccountSessionRows([
    {
      session_id: sessionId,
      created_at: oldest,
      last_active_at: recent,
      expires_at: expiry,
      user_agent: 'Chrome on Windows',
      current_session: true,
    },
    {
      session_id: otherSessionId,
      created_at: oldest,
      last_active_at: older,
      expires_at: null,
      user_agent: 'Safari on iPhone',
      current_session: false,
    },
  ]);
  assert.equal(sessions[0].current_session, true);
  assert.equal(sessions[1].current_session, false);
  assert.equal(
    schemas.parseIdentityVerificationResponse('pending'),
    'pending',
  );

  const timeline = schemas.parseTimelineEventRows([
    {
      id: eventId,
      event_type: 'meeting_confirmed',
      created_at: recent,
      is_mine: false,
    },
    {
      id: `created-${dealId}`,
      event_type: 'deal_published',
      created_at: oldest,
      is_mine: true,
    },
  ]);
  assert.equal(timeline[0].event_type, 'meeting_confirmed');
  assert.equal(timeline[1].id, `created-${dealId}`);

  const participants = schemas.parseDealParticipantsRows([{
    seller_name: 'Seller Name',
    seller_verification: 'verified',
    buyer_name: 'Buyer Name',
    buyer_verification: 'pending',
    accepted_at: older,
    viewer_role: 'buyer',
  }]);
  assert.equal(participants[0].viewer_role, 'buyer');
  assert.deepEqual(schemas.parseProfileSummaryRows([]), []);
  assert.deepEqual(schemas.parseAccountSessionRows([]), []);
  assert.deepEqual(schemas.parseTimelineEventRows([]), []);
  assert.deepEqual(schemas.parseDealParticipantsRows([]), []);
});

test('invalid account activity responses fail closed without logging identity or device data', async () => {
  const schemas = await import('../src/services/accountActivityRuntimeSchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const privateName = 'Private Account Name';
  const privateDevice = 'Private Browser Fingerprint';
  const privateComment = 'Private rating narrative';
  const now = Date.now();
  const recent = new Date(now - 60_000).toISOString();
  const older = new Date(now - 120_000).toISOString();

  try {
    assert.throws(
      () => schemas.parseProfileSummaryRows([{
        display_name: privateName,
        verification_status: 'verified',
        member_since: older,
        completed_deals: 1,
        rating_count: 0,
        average_rating: 5,
        recent_ratings: [{
          stars: 5,
          comment: privateComment,
          created_at: recent,
        }],
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseAccountSessionRows([
        {
          session_id: '11111111-1111-4111-8111-111111111111',
          created_at: older,
          last_active_at: recent,
          expires_at: null,
          user_agent: privateDevice,
          current_session: false,
        },
        {
          session_id: '22222222-2222-4222-8222-222222222222',
          created_at: older,
          last_active_at: older,
          expires_at: null,
          user_agent: privateDevice,
          current_session: true,
        },
      ]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseTimelineEventRows([{
        id: '33333333-3333-4333-8333-333333333333',
        event_type: 'Private Event',
        created_at: recent,
        is_mine: true,
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseDealParticipantsRows([{
        seller_name: privateName,
        seller_verification: 'verified',
        buyer_name: 'Buyer Name',
        buyer_verification: 'pending',
        accepted_at: older,
        viewer_role: 'observer',
      }]),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(
    serializedLogs,
    /dealivra\.account-activity\.response-rejection\.v1/,
  );
  assert.match(serializedLogs, /profile_summary/);
  assert.match(serializedLogs, /account_sessions/);
  assert.match(serializedLogs, /deal_timeline/);
  assert.match(serializedLogs, /deal_participants/);
  assert.doesNotMatch(serializedLogs, /Private Account Name/);
  assert.doesNotMatch(serializedLogs, /Private Browser Fingerprint/);
  assert.doesNotMatch(serializedLogs, /Private rating narrative/);
});

test('browser account activity requests and errors are runtime validated', async () => {
  const schemas = await import('../src/services/accountActivityBoundarySchemas.ts');
  const dealId = '11111111-1111-4111-8111-111111111111';

  assert.deepEqual(schemas.parseProfileSummaryRequest({}), {});
  assert.deepEqual(schemas.parseAccountSessionsRequest({}), {});
  assert.deepEqual(schemas.parseIdentityVerificationRequest({}), {});
  assert.deepEqual(schemas.parseRatingSubmitRequest({
    p_deal_id: dealId,
    p_stars: 5,
    p_comment: '  Clear communication and careful packaging.  ',
  }), {
    p_deal_id: dealId,
    p_stars: 5,
    p_comment: 'Clear communication and careful packaging.',
  });
  assert.deepEqual(schemas.parseDealTimelineRequest({
    p_deal_id: dealId,
  }), { p_deal_id: dealId });
  assert.deepEqual(schemas.parseDealParticipantsRequest({
    p_deal_id: dealId,
  }), { p_deal_id: dealId });
  assert.deepEqual(schemas.parseAccountActivityPostgrestErrorEnvelope({
    code: 'P0001',
    details: null,
    hint: null,
    message: 'Profile is unavailable',
  }, 404, 'profile_summary_error'), { code: 'P0001' });
});

test('invalid account activity boundaries fail closed without logging ratings or provider data', async () => {
  const schemas = await import('../src/services/accountActivityBoundarySchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const dealId = '11111111-1111-4111-8111-111111111111';
  const privateComment = 'Private rating account narrative';
  const privateProvider = 'private-account-provider-detail';

  try {
    assert.throws(
      () => schemas.parseProfileSummaryRequest({
        user_id: 'private-user-id',
      }),
      /processed safely/i,
    );
    assert.throws(
      () => schemas.parseRatingSubmitRequest({
        p_deal_id: dealId,
        p_stars: 6,
        p_comment: privateComment,
      }),
      /1 to 5/i,
    );
    assert.throws(
      () => schemas.parseDealTimelineRequest({
        p_deal_id: 'not-a-uuid',
      }),
      /selected deal is invalid/i,
    );
    assert.throws(
      () => schemas.parseAccountActivityPostgrestErrorEnvelope({
        code: 'P0001',
        details: privateProvider,
        hint: null,
        message: 'Profile is unavailable',
        email: 'private@example.test',
      }, 404, 'profile_summary_error'),
      /processed safely/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(
    serializedLogs,
    /dealivra\.account-activity\.boundary-rejection\.v1/,
  );
  assert.match(serializedLogs, /profile_summary_request/);
  assert.match(serializedLogs, /rating_submit_request/);
  assert.match(serializedLogs, /deal_timeline_request/);
  assert.match(serializedLogs, /profile_summary_error/);
  assert.doesNotMatch(serializedLogs, /private-user-id/);
  assert.doesNotMatch(serializedLogs, /Private rating account narrative/);
  assert.doesNotMatch(serializedLogs, /private-account-provider-detail/);
  assert.doesNotMatch(serializedLogs, /private@example\.test/);
});

test('the fifteenth ARC-004 boundary validates account activity success, request, and error contracts', () => {
  const service = readText('src/services/supabaseRest.ts');
  const requestSchemas = readText(
    'src/services/accountActivityBoundarySchemas.ts',
  );
  const responseSchemas = readText(
    'src/services/accountActivityRuntimeSchemas.ts',
  );

  for (const parser of [
    'parseProfileSummaryRequest',
    'parseAccountSessionsRequest',
    'parseIdentityVerificationRequest',
    'parseRatingSubmitRequest',
    'parseDealTimelineRequest',
    'parseDealParticipantsRequest',
    'parseProfileSummaryRows',
    'parseAccountSessionRows',
    'parseIdentityVerificationResponse',
    'parseTimelineEventRows',
    'parseDealParticipantsRows',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
  }
  for (const boundary of [
    'profile_summary_error',
    'account_sessions_error',
    'identity_verification_error',
    'rating_submit_error',
    'deal_timeline_error',
    'deal_participants_error',
  ]) {
    assert.match(service, new RegExp(`'${boundary}'`));
  }
  assert.match(
    requestSchemas,
    /dealivra\.account-activity\.boundary-rejection\.v1/,
  );
  assert.match(
    responseSchemas,
    /dealivra\.account-activity\.response-rejection\.v1/,
  );
  assert.match(responseSchemas, /current_session_order_invalid/);
  assert.match(responseSchemas, /recent_rating_order_invalid/);
  assert.doesNotMatch(requestSchemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(responseSchemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(service, /as ProfileSummary\[\]/);
  assert.doesNotMatch(service, /as AccountSession\[\]/);
  assert.doesNotMatch(service, /as TimelineEvent\[\]/);
  assert.doesNotMatch(service, /as DealParticipants\[\]/);
  assert.doesNotMatch(
    service,
    /d\?\.message\|\|'Could not (?:submit rating|load profile|load signed-in devices|request verification|load timeline)'/,
  );
});

test('agreement, declaration, renewal, access-code, and watchlist schemas accept reviewed contracts', async () => {
  const schemas = await import('../src/services/agreementRuntimeSchemas.ts');
  const now = Date.now();
  const recent = new Date(now - 60_000).toISOString();
  const expiry = new Date(now + 7 * 24 * 60 * 60_000).toISOString();
  const currentHash = 'a'.repeat(64);
  const legacyHash = 'b'.repeat(64);

  assert.deepEqual(schemas.parseSellerDeclarationRows([{
    attested: true,
    attested_at: recent,
  }])[0].attested, true);

  const document = schemas.parseAgreementDocumentRows([{
    schema_version: 'dealivra.agreement.v1',
    public_id: 'DEAL1234',
    version: 2,
    title: 'Reviewed laptop',
    description: 'A carefully documented laptop with disclosed wear.',
    identifier: '1234',
    catalog_identity: {
      category_id: 'phone',
      catalog_version: '2026-07-29.1',
      brand_id: 'apple',
      brand_label: 'Apple',
      model_id: 'iphone-16',
      model_label: 'iPhone 16',
      variant_id: 'pro-256gb',
      variant_label: 'Pro 256 GB',
    },
    seller_declarations: {
      has_authority_to_sell: true,
      not_stolen_counterfeit_or_prohibited: true,
      known_defects_and_material_facts_disclosed: true,
      attested_at: recent,
    },
    price_cents: 125000,
    currency: 'USD',
    condition: 'Good',
    delivery_method: 'Ship to buyer',
    expires_at: expiry,
    content_hash: currentHash,
    legacy_content_hash: legacyHash,
    created_at: recent,
    acceptance_count: 0,
    is_current: true,
  }])[0];
  assert.equal(document.public_id, 'DEAL1234');
  assert.equal(document.catalog_identity.variant_id, 'pro-256gb');

  const history = schemas.parseAgreementHistoryRows([
    {
      version: 2,
      price_cents: 125000,
      currency: 'USD',
      condition: 'Good',
      delivery_method: 'Ship to buyer',
      content_hash: currentHash,
      created_at: recent,
      acceptance_count: 0,
      is_current: true,
    },
    {
      version: 1,
      price_cents: 130000,
      currency: 'USD',
      condition: 'Good',
      delivery_method: 'Ship to buyer',
      content_hash: legacyHash,
      created_at: new Date(now - 120_000).toISOString(),
      acceptance_count: 0,
      is_current: false,
    },
  ]);
  assert.deepEqual(history.map(row => row.version), [2, 1]);

  assert.equal(schemas.parseAgreementVerificationRows([{
    matched: true,
    public_id: 'DEAL1234',
    version: 2,
    is_current: true,
    created_at: recent,
  }])[0].matched, true);
  assert.equal(schemas.parseDealRenewalRows([{
    agreement_version: 3,
    expires_at: expiry,
  }])[0].agreement_version, 3);
  assert.equal(schemas.parseAcceptanceProtectionResponse(true), true);
  assert.equal(schemas.parseBuyerAccessCodeResponse('004271'), '004271');
  assert.equal(schemas.parseBuyerAccessCodeResponse(null), null);
  assert.equal(schemas.parseWatchlistStateResponse(false), false);
});

test('invalid agreement responses fail closed without logging terms, access codes, or hashes', async () => {
  const schemas = await import('../src/services/agreementRuntimeSchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const privateDescription = 'Private unreleased agreement narrative';
  const privateHash = 'c'.repeat(64);
  const privateCode = '917204';
  const recent = new Date(Date.now() - 60_000).toISOString();

  try {
    assert.throws(
      () => schemas.parseAgreementDocumentRows([{
        schema_version: 'dealivra.agreement.v1',
        public_id: 'DEAL1234',
        version: 1,
        title: 'Reviewed item',
        description: privateDescription,
        identifier: null,
        catalog_identity: null,
        seller_declarations: null,
        price_cents: 10000,
        currency: 'USD',
        condition: 'Good',
        delivery_method: 'Ship to buyer',
        expires_at: null,
        content_hash: privateHash,
        legacy_content_hash: privateHash,
        created_at: recent,
        acceptance_count: 0,
        is_current: true,
        unreviewed_private_field: 'private',
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseAgreementHistoryRows([
        {
          version: 1,
          price_cents: 10000,
          currency: 'USD',
          condition: 'Good',
          delivery_method: 'Ship to buyer',
          content_hash: privateHash,
          created_at: recent,
          acceptance_count: 0,
          is_current: false,
        },
      ]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseAgreementVerificationRows([{
        matched: false,
        public_id: 'DEAL1234',
        version: 1,
        is_current: true,
        created_at: recent,
      }]),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseBuyerAccessCodeResponse(privateCode + '9'),
      /invalid response/i,
    );
    assert.throws(
      () => schemas.parseWatchlistStateResponse('false'),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(
    serializedLogs,
    /dealivra\.agreement\.response-rejection\.v1/,
  );
  assert.match(serializedLogs, /agreement_document/);
  assert.match(serializedLogs, /agreement_history/);
  assert.match(serializedLogs, /agreement_verification/);
  assert.match(serializedLogs, /buyer_access_code/);
  assert.match(serializedLogs, /watchlist_state/);
  assert.doesNotMatch(serializedLogs, /Private unreleased agreement narrative/);
  assert.doesNotMatch(serializedLogs, new RegExp(privateHash));
  assert.doesNotMatch(serializedLogs, new RegExp(privateCode));
});

test('browser agreement and Deal Link requests and errors are runtime validated', async () => {
  const schemas = await import('../src/services/agreementBoundarySchemas.ts');
  const dealId = '11111111-1111-4111-8111-111111111111';
  const contentHash = 'A'.repeat(64);

  assert.deepEqual(schemas.parseSellerDeclarationRequest({
    p_public_id: ' deal1234 ',
  }), { p_public_id: 'DEAL1234' });
  assert.deepEqual(schemas.parseAgreementDocumentRequest({
    p_public_id: 'deal1234',
    p_version: null,
  }), { p_public_id: 'DEAL1234', p_version: null });
  assert.deepEqual(schemas.parseAgreementHistoryRequest({
    p_public_id: 'deal1234',
  }), { p_public_id: 'DEAL1234' });
  assert.deepEqual(schemas.parseAgreementVerificationRequest({
    p_public_id: 'deal1234',
    p_content_hash: contentHash,
  }), {
    p_public_id: 'DEAL1234',
    p_content_hash: contentHash.toLowerCase(),
  });
  assert.deepEqual(schemas.parseDealLinkRenewalRequest({
    p_deal_id: dealId.toUpperCase(),
    p_days: 14,
  }), { p_deal_id: dealId, p_days: 14 });
  assert.deepEqual(schemas.parseAcceptanceProtectionRequest({
    p_public_id: 'deal1234',
  }), { p_public_id: 'DEAL1234' });
  assert.deepEqual(schemas.parseBuyerAccessCodeRequest({
    p_deal_id: dealId,
    p_enabled: true,
  }), { p_deal_id: dealId, p_enabled: true });
  assert.deepEqual(schemas.parseWatchlistReadRequest({
    p_public_id: 'deal1234',
  }), { p_public_id: 'DEAL1234' });
  assert.deepEqual(schemas.parseWatchlistWriteRequest({
    p_public_id: 'deal1234',
    p_saved: true,
  }), { p_public_id: 'DEAL1234', p_saved: true });
  assert.deepEqual(schemas.parseAgreementPostgrestErrorEnvelope({
    code: 'P0001',
    details: null,
    hint: null,
    message: 'Agreement unavailable',
  }, 404, 'agreement_document_error'), { code: 'P0001' });
});

test('invalid agreement request boundaries fail closed without logging identifiers or provider data', async () => {
  const schemas = await import('../src/services/agreementBoundarySchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const privateHash = 'private-agreement-hash';
  const privateProvider = 'private-provider-agreement-detail';

  try {
    assert.throws(
      () => schemas.parseAgreementDocumentRequest({
        p_public_id: 'not valid',
        p_version: 1,
      }),
      /valid Deal Link/i,
    );
    assert.throws(
      () => schemas.parseAgreementVerificationRequest({
        p_public_id: 'DEAL1234',
        p_content_hash: privateHash,
      }),
      /64-character/i,
    );
    assert.throws(
      () => schemas.parseDealLinkRenewalRequest({
        p_deal_id: '11111111-1111-4111-8111-111111111111',
        p_days: 365,
      }),
      /renewal period/i,
    );
    assert.throws(
      () => schemas.parseBuyerAccessCodeRequest({
        p_deal_id: '11111111-1111-4111-8111-111111111111',
        p_enabled: 'true',
      }),
      /buyer access protection/i,
    );
    assert.throws(
      () => schemas.parseAgreementPostgrestErrorEnvelope({
        code: 'P0001',
        details: privateProvider,
        hint: null,
        message: 'Agreement unavailable',
        private_email: 'private@example.test',
      }, 404, 'agreement_document_error'),
      /processed safely/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(
    serializedLogs,
    /dealivra\.agreement\.boundary-rejection\.v1/,
  );
  assert.match(serializedLogs, /agreement_document_request/);
  assert.match(serializedLogs, /agreement_verification_request/);
  assert.match(serializedLogs, /deal_link_renewal_request/);
  assert.match(serializedLogs, /buyer_access_code_request/);
  assert.match(serializedLogs, /agreement_document_error/);
  assert.doesNotMatch(serializedLogs, /private-agreement-hash/);
  assert.doesNotMatch(serializedLogs, /private-provider-agreement-detail/);
  assert.doesNotMatch(serializedLogs, /private@example\.test/);
});

test('the sixteenth ARC-004 boundary validates agreement, link, access-code, and watchlist contracts', () => {
  const service = readText('src/services/supabaseRest.ts');
  const requestSchemas = readText(
    'src/services/agreementBoundarySchemas.ts',
  );
  const responseSchemas = readText(
    'src/services/agreementRuntimeSchemas.ts',
  );

  for (const parser of [
    'parseSellerDeclarationRequest',
    'parseAgreementDocumentRequest',
    'parseAgreementHistoryRequest',
    'parseAgreementVerificationRequest',
    'parseDealLinkRenewalRequest',
    'parseAcceptanceProtectionRequest',
    'parseBuyerAccessCodeRequest',
    'parseWatchlistReadRequest',
    'parseWatchlistWriteRequest',
    'parseSellerDeclarationRows',
    'parseAgreementDocumentRows',
    'parseAgreementHistoryRows',
    'parseAgreementVerificationRows',
    'parseDealRenewalRows',
    'parseAcceptanceProtectionResponse',
    'parseBuyerAccessCodeResponse',
    'parseWatchlistStateResponse',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
  }
  for (const boundary of [
    'seller_declaration_error',
    'agreement_document_error',
    'agreement_history_error',
    'agreement_verification_error',
    'deal_link_renewal_error',
    'acceptance_protection_error',
    'buyer_access_code_error',
    'watchlist_read_error',
    'watchlist_write_error',
  ]) {
    assert.match(service, new RegExp(`'${boundary}'`));
  }
  assert.match(
    requestSchemas,
    /dealivra\.agreement\.boundary-rejection\.v1/,
  );
  assert.match(
    responseSchemas,
    /dealivra\.agreement\.response-rejection\.v1/,
  );
  assert.match(responseSchemas, /version_order_invalid/);
  assert.match(responseSchemas, /current_version_order_invalid/);
  assert.match(responseSchemas, /seller_declaration_invalid/);
  assert.doesNotMatch(requestSchemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(responseSchemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(service, /as AgreementDocumentSnapshot\[\]/);
  assert.doesNotMatch(service, /as AgreementHistoryVersion\[\]/);
  assert.doesNotMatch(service, /as AgreementVerificationResult\[\]/);
  assert.doesNotMatch(service, /as DealRenewalResult\[\]/);
  assert.doesNotMatch(
    service,
    /Boolean\(await response\.json\(\)\)/,
  );
  assert.doesNotMatch(
    service,
    /data\?\.message\|\|'Could not update buyer access'/,
  );
  assert.doesNotMatch(
    service,
    /d\?\.message\|\|'Could not (?:check|update) saved deal'/,
  );
});

test('browser deal mutation requests and responses are runtime validated', async () => {
  const requests = await import('../src/services/dealMutationBoundarySchemas.ts');
  const responses = await import('../src/services/dealMutationRuntimeSchemas.ts');
  const dealId = '11111111-1111-4111-8111-111111111111';
  const ownerId = '22222222-2222-4222-8222-222222222222';
  const mediaId = '33333333-3333-4333-8333-333333333333';
  const timestamp = '2026-07-30T12:00:00.000Z';
  const catalog = {
    category_id: 'phone',
    catalog_version: '2026-07-29.1',
    catalog_brand_id: 'apple',
    catalog_brand_label: 'Apple',
    catalog_model_id: 'iphone-16',
    catalog_model_label: 'iPhone 16',
    model_year: null,
    catalog_variant_id: '128-gb',
    catalog_variant_label: '128 GB',
  };

  assert.deepEqual(requests.parseDealDraftCreateRequest({
    seller_id: ownerId.toUpperCase(),
    title: '  iPhone 16  ',
    description: '  ',
    price_cents: 125000,
    currency: 'usd',
    condition: 'Good',
    serial_last_four: ' A1B2 ',
    delivery_method: 'Ship to buyer',
    status: 'draft',
    current_agreement_version: 0,
    published_at: null,
    expires_at: timestamp,
    ...catalog,
  }), {
    seller_id: ownerId,
    title: 'iPhone 16',
    description: '',
    price_cents: 125000,
    currency: 'USD',
    condition: 'Good',
    serial_last_four: 'A1B2',
    delivery_method: 'Ship to buyer',
    status: 'draft',
    current_agreement_version: 0,
    published_at: null,
    expires_at: timestamp,
    ...catalog,
  });
  assert.deepEqual(requests.parseDealPublishRequest({
    p_deal_id: dealId.toUpperCase(),
    p_title: ' iPhone 16 ',
    p_description: ' Includes all known wear and a small frame scratch. ',
    p_price_cents: 125000,
    p_currency: 'usd',
    p_condition: 'Good',
    p_serial_last_four: 'A1B2',
    p_delivery_method: 'Ship to buyer',
    p_expires_in_days: 7,
  }), {
    p_deal_id: dealId,
    p_title: 'iPhone 16',
    p_description: 'Includes all known wear and a small frame scratch.',
    p_price_cents: 125000,
    p_currency: 'USD',
    p_condition: 'Good',
    p_serial_last_four: 'A1B2',
    p_delivery_method: 'Ship to buyer',
    p_expires_in_days: 7,
  });
  assert.deepEqual(requests.parseDealCancelRequest({
    p_deal_id: dealId,
    p_reason: '  Buyer and seller agreed to cancel.  ',
  }), {
    p_deal_id: dealId,
    p_reason: 'Buyer and seller agreed to cancel.',
  });
  assert.deepEqual(requests.parsePublicDealRequest({
    p_public_id: ' deal1234 ',
  }), { p_public_id: 'DEAL1234' });
  assert.deepEqual(requests.parsePublicDealAcceptRequest({
    p_public_id: 'deal1234',
    p_typed_name: '  Taylor Morgan  ',
    p_access_code: '123456',
  }), {
    p_public_id: 'DEAL1234',
    p_typed_name: 'Taylor Morgan',
    p_access_code: '123456',
  });

  const publicUrl =
    `https://project.supabase.co/storage/v1/object/public/deal-media/${ownerId}/${dealId}/${mediaId}.webp`;
  assert.deepEqual(requests.parseMediaDeleteRequest({
    dealId,
    ownerId,
    publicUrl,
    supabaseUrl: 'https://project.supabase.co',
  }), {
    dealId,
    storagePath: `${ownerId}/${dealId}/${mediaId}.webp`,
  });
  assert.deepEqual(requests.parseMediaReorderRequest({
    dealId,
    ownerId,
    publicUrls: [publicUrl],
    supabaseUrl: 'https://project.supabase.co',
  }), {
    p_deal_id: dealId,
    p_paths: [`${ownerId}/${dealId}/${mediaId}.webp`],
  });
  assert.deepEqual(requests.parseMediaUploadBatchRequest({
    dealId,
    ownerId,
    startIndex: 2,
    fileCount: 3,
  }), {
    dealId,
    ownerId,
    startIndex: 2,
    fileCount: 3,
  });
  assert.deepEqual(requests.parseDealMutationPostgrestErrorEnvelope({
    code: 'P0001',
    details: null,
    hint: null,
    message: 'Provider detail',
  }, 409, 'deal_publish_error'), { code: 'P0001' });
  assert.equal(responses.parsePublishedDealVersionResponse(2), 2);
  assert.equal(
    responses.parsePublicDealAcceptanceResponse('accepted'),
    'accepted',
  );
});

test('invalid deal mutation boundaries fail closed without logging deal, media, or provider data', async () => {
  const requests = await import('../src/services/dealMutationBoundarySchemas.ts');
  const responses = await import('../src/services/dealMutationRuntimeSchemas.ts');
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const dealId = '11111111-1111-4111-8111-111111111111';
  const ownerId = '22222222-2222-4222-8222-222222222222';
  const privateMediaUrl =
    `https://attacker.example/storage/v1/object/public/deal-media/${ownerId}/${dealId}/33333333-3333-4333-8333-333333333333.webp`;
  const privateProvider = 'private-provider-deal-detail';

  try {
    assert.throws(
      () => requests.parseDealDraftCreateRequest({
        seller_id: ownerId,
        title: 'Valid title',
        description: '',
        price_cents: Number.NaN,
        currency: 'USD',
        condition: 'Good',
        serial_last_four: null,
        delivery_method: 'Ship to buyer',
        status: 'draft',
        current_agreement_version: 0,
        published_at: null,
        expires_at: '2026-07-30T12:00:00.000Z',
        category_id: 'general',
        catalog_version: 'legacy',
        catalog_brand_id: null,
        catalog_brand_label: null,
        catalog_model_id: null,
        catalog_model_label: null,
        model_year: null,
        catalog_variant_id: null,
        catalog_variant_label: null,
      }),
      /valid price/i,
    );
    assert.throws(
      () => requests.parseDealPublishRequest({
        p_deal_id: dealId,
        p_title: 'Valid title',
        p_description: 'Too short',
        p_price_cents: 5000,
        p_currency: 'USD',
        p_condition: 'Good',
        p_serial_last_four: null,
        p_delivery_method: 'Ship to buyer',
        p_expires_in_days: 365,
      }),
      /description|processed safely/i,
    );
    assert.throws(
      () => requests.parseMediaDeleteRequest({
        dealId,
        ownerId,
        publicUrl: privateMediaUrl,
        supabaseUrl: 'https://project.supabase.co',
      }),
      /not trusted/i,
    );
    assert.throws(
      () => requests.parseMediaReorderRequest({
        dealId,
        ownerId,
        publicUrls: [
          `https://project.supabase.co/storage/v1/object/public/deal-media/${ownerId}/${dealId}/33333333-3333-4333-8333-333333333333.webp`,
          `https://project.supabase.co/storage/v1/object/public/deal-media/${ownerId}/${dealId}/33333333-3333-4333-8333-333333333333.webp`,
        ],
        supabaseUrl: 'https://project.supabase.co',
      }),
      /media order/i,
    );
    assert.throws(
      () => requests.parseDealMutationPostgrestErrorEnvelope({
        code: 'P0001',
        details: privateProvider,
        hint: null,
        message: 'Could not publish',
        buyer_email: 'private@example.test',
      }, 409, 'deal_publish_error'),
      /processed safely/i,
    );
    assert.throws(
      () => responses.parsePublicDealAcceptanceResponse(
        'accepted:private@example.test',
      ),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(
    serializedLogs,
    /dealivra\.deal-mutation\.boundary-rejection\.v1/,
  );
  assert.match(
    serializedLogs,
    /dealivra\.deal-mutation\.response-rejection\.v1/,
  );
  assert.match(serializedLogs, /deal_draft_create_request/);
  assert.match(serializedLogs, /deal_publish_request/);
  assert.match(serializedLogs, /media_delete_request/);
  assert.match(serializedLogs, /media_reorder_request/);
  assert.match(serializedLogs, /deal_publish_error/);
  assert.doesNotMatch(serializedLogs, /attacker\.example/);
  assert.doesNotMatch(serializedLogs, /private-provider-deal-detail/);
  assert.doesNotMatch(serializedLogs, /private@example\.test/);
});

test('the seventeenth ARC-004 boundary validates all Deal mutation contracts', () => {
  const service = readText('src/services/supabaseRest.ts');
  const requestSchemas = readText(
    'src/services/dealMutationBoundarySchemas.ts',
  );
  const responseSchemas = readText(
    'src/services/dealMutationRuntimeSchemas.ts',
  );

  for (const parser of [
    'parseDealDraftCreateRequest',
    'parseDealDraftUpdateRequest',
    'parseDealExpirationDays',
    'parseDealIdRequest',
    'parseDealOwnerContext',
    'parseDealPublishRequest',
    'parsePublishedDealUpdateRequest',
    'parseDealCancelRequest',
    'parseSavedDealsRequest',
    'parsePublicDealRequest',
    'parsePublicDealAcceptRequest',
    'parseMediaUploadBatchRequest',
    'parseMediaRecordInsertRequest',
    'parseMediaDeleteRequest',
    'parseMediaReorderRequest',
    'parsePublishedDealVersionResponse',
    'parsePublicDealAcceptanceResponse',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
  }
  for (const boundary of [
    'deal_draft_create_error',
    'deal_draft_update_error',
    'deal_publish_error',
    'deal_update_published_error',
    'deal_cancel_error',
    'saved_deals_error',
    'public_deal_error',
    'public_deal_accept_error',
    'media_record_insert_error',
    'media_delete_error',
    'media_reorder_error',
  ]) {
    assert.match(service, new RegExp(`'${boundary}'`));
  }
  assert.match(
    requestSchemas,
    /dealivra\.deal-mutation\.boundary-rejection\.v1/,
  );
  assert.match(
    responseSchemas,
    /dealivra\.deal-mutation\.response-rejection\.v1/,
  );
  assert.match(requestSchemas, /candidate\.origin !== expected\.origin/);
  assert.match(requestSchemas, /new Set\(paths\)\.size !== paths\.length/);
  assert.match(requestSchemas, /maximumPriceCents/);
  assert.doesNotMatch(requestSchemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(responseSchemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(
    service,
    /data\?\.message \|\| 'Could not accept this deal'/,
  );
  assert.doesNotMatch(
    service,
    /d\?\.message\|\|'Could not (?:load saved deals|cancel deal)'/,
  );
  assert.doesNotMatch(
    service,
    /const marker='\/storage\/v1\/object\/public\/deal-media\/'/,
  );
  assert.doesNotMatch(
    service,
    /return await response\.json\(\) as number/,
  );
});

test('account-name mutation requests and provider errors fail closed', async () => {
  const schemas = await import(
    '../src/services/accountMutationBoundarySchemas.ts'
  );
  const userId = '11111111-1111-4111-8111-111111111111';

  assert.deepEqual(
    schemas.parseAccountNameUpdateRequest({
      userId: userId.toUpperCase(),
      displayName: '  Nika Melikishvili  ',
    }),
    {
      userId,
      displayName: 'Nika Melikishvili',
      authBody: {
        data: {
          display_name: 'Nika Melikishvili',
        },
      },
      profileBody: {
        display_name: 'Nika Melikishvili',
      },
    },
  );
  assert.deepEqual(
    schemas.parseAccountAuthErrorEnvelope({
      error_code: 'user_not_found',
      msg: 'User not found',
    }, 404),
    { code: 'user_not_found' },
  );
  assert.deepEqual(
    schemas.parseAccountProfileErrorEnvelope({
      code: '23505',
      details: null,
      hint: null,
      message: 'duplicate key',
    }, 409),
    { code: '23505' },
  );

  assert.throws(
    () => schemas.parseAccountNameUpdateRequest({
      userId,
      displayName: 'A',
    }),
    /2 to 80 characters/i,
  );
  assert.throws(
    () => schemas.parseAccountNameUpdateRequest({
      userId,
      displayName: 'Nika\nMelikishvili',
    }),
    /2 to 80 characters/i,
  );
  assert.throws(
    () => schemas.parseAccountNameUpdateRequest({
      userId,
      displayName: 'Valid Name',
      isAdmin: true,
    }),
    /processed safely/i,
  );
  assert.throws(
    () => schemas.parseAccountAuthErrorEnvelope({
      message: 'provider failure',
      email: 'private@example.test',
    }, 400),
    /processed safely/i,
  );
  assert.throws(
    () => schemas.parseAccountProfileErrorEnvelope({
      message: 'provider failure',
      details: { private: true },
    }, 500),
    /processed safely/i,
  );
});

test('historical payment records are exact, bounded, and state-consistent', async () => {
  const requests = await import(
    '../src/services/legacyPaymentBoundarySchemas.ts'
  );
  const responses = await import(
    '../src/services/legacyPaymentRuntimeSchemas.ts'
  );
  const dealId = '22222222-2222-4222-8222-222222222222';

  assert.deepEqual(
    requests.parseLegacyPaymentRecordRequest({
      p_deal_id: dealId.toUpperCase(),
    }),
    { p_deal_id: dealId },
  );
  assert.deepEqual(
    requests.parseLegacyPaymentPostgrestErrorEnvelope({
      code: 'P0001',
      details: null,
      hint: null,
      message: 'record unavailable',
    }, 403),
    { code: 'P0001' },
  );
  assert.deepEqual(responses.parseLegacyPaymentRecordRows([]), []);
  assert.deepEqual(
    responses.parseLegacyPaymentRecordRows([{
      method: 'card_invoice',
      buyer_confirmed_at: '2026-07-20T10:00:00.000Z',
      buyer_marked_sent_at: '2026-07-20T10:01:00.000Z',
      seller_marked_received_at: '2026-07-20T10:02:00.000Z',
      updated_at: '2026-07-20T10:03:00.000Z',
      viewer_role: 'buyer',
    }]),
    [{
      method: 'card_invoice',
      buyer_confirmed_at: '2026-07-20T10:00:00.000Z',
      buyer_marked_sent_at: '2026-07-20T10:01:00.000Z',
      seller_marked_received_at: '2026-07-20T10:02:00.000Z',
      updated_at: '2026-07-20T10:03:00.000Z',
      viewer_role: 'buyer',
    }],
  );

  assert.throws(
    () => requests.parseLegacyPaymentRecordRequest({
      p_deal_id: dealId,
      participant_id: 'private',
    }),
    /could not be loaded safely/i,
  );
  assert.throws(
    () => responses.parseLegacyPaymentRecordRows([{
      method: 'cash_at_handoff',
      buyer_confirmed_at: null,
      buyer_marked_sent_at: '2026-07-20T10:01:00.000Z',
      seller_marked_received_at: null,
      updated_at: '2026-07-20T10:03:00.000Z',
      viewer_role: 'seller',
    }]),
    /invalid response/i,
  );
  assert.throws(
    () => responses.parseLegacyPaymentRecordRows([{
      method: 'bank_transfer',
      buyer_confirmed_at: '2026-07-20T10:02:00.000Z',
      buyer_marked_sent_at: '2026-07-20T10:01:00.000Z',
      seller_marked_received_at: null,
      updated_at: '2026-07-20T10:03:00.000Z',
      viewer_role: 'buyer',
    }]),
    /invalid response/i,
  );
  assert.throws(
    () => responses.parseLegacyPaymentRecordRows([{
      method: 'cash_at_handoff',
      buyer_confirmed_at: null,
      buyer_marked_sent_at: null,
      seller_marked_received_at: null,
      updated_at: '2999-07-20T10:03:00.000Z',
      viewer_role: 'seller',
    }]),
    /invalid response/i,
  );
});

test('account and historical-payment rejection logs remain privacy safe', async () => {
  const account = await import(
    '../src/services/accountMutationBoundarySchemas.ts'
  );
  const paymentRequests = await import(
    '../src/services/legacyPaymentBoundarySchemas.ts'
  );
  const paymentResponses = await import(
    '../src/services/legacyPaymentRuntimeSchemas.ts'
  );
  const logs = [];
  const originalConsoleError = console.error;
  console.error = (...values) => logs.push(values);

  try {
    assert.throws(
      () => account.parseAccountNameUpdateRequest({
        userId: 'private-user-id',
        displayName: 'private@example.test',
      }),
      /verified|processed safely/i,
    );
    assert.throws(
      () => account.parseAccountAuthErrorEnvelope({
        message: 'private-provider-account-detail',
        email: 'private@example.test',
      }, 400),
      /processed safely/i,
    );
    assert.throws(
      () => paymentRequests.parseLegacyPaymentPostgrestErrorEnvelope({
        message: 'private-provider-payment-detail',
        buyer_email: 'private@example.test',
      }, 500),
      /could not be loaded safely/i,
    );
    assert.throws(
      () => paymentResponses.parseLegacyPaymentRecordRows([{
        method: 'other',
        buyer_confirmed_at: null,
        buyer_marked_sent_at: null,
        seller_marked_received_at: null,
        updated_at: '2026-07-20T10:03:00.000Z',
        viewer_role: 'buyer',
        customer_email: 'private@example.test',
      }]),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(
    serializedLogs,
    /dealivra\.account-mutation\.boundary-rejection\.v1/,
  );
  assert.match(
    serializedLogs,
    /dealivra\.legacy-payment\.boundary-rejection\.v1/,
  );
  assert.match(
    serializedLogs,
    /dealivra\.legacy-payment\.response-rejection\.v1/,
  );
  assert.doesNotMatch(serializedLogs, /private-user-id/);
  assert.doesNotMatch(serializedLogs, /private-provider-account-detail/);
  assert.doesNotMatch(serializedLogs, /private-provider-payment-detail/);
  assert.doesNotMatch(serializedLogs, /private@example\.test/);
});

test('the eighteenth ARC-004 boundary retires legacy payment mutations', () => {
  const service = readText('src/services/supabaseRest.ts');
  const accountSchemas = readText(
    'src/services/accountMutationBoundarySchemas.ts',
  );
  const paymentRequestSchemas = readText(
    'src/services/legacyPaymentBoundarySchemas.ts',
  );
  const paymentResponseSchemas = readText(
    'src/services/legacyPaymentRuntimeSchemas.ts',
  );
  const stripeSetup = readText(
    'supabase/stripe_protected_payments_setup.sql',
  );
  const productionHardening = readText(
    'supabase/production_auth_rbac_hardening.sql',
  );
  const roleMatrix = readText(
    'supabase/tests/authenticated_rpc_cross_role_rollback.sql',
  );
  const retiredFunctions = [
    'set_deal_payment_method',
    'confirm_deal_payment_method',
    'mark_deal_payment_sent',
    'mark_deal_payment_received',
  ];

  for (const parser of [
    'parseAccountNameUpdateRequest',
    'parseAccountAuthErrorEnvelope',
    'parseAccountProfileErrorEnvelope',
    'parseLegacyPaymentRecordRequest',
    'parseLegacyPaymentPostgrestErrorEnvelope',
    'parseLegacyPaymentRecordRows',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
  }
  for (const functionName of retiredFunctions) {
    assert.match(
      stripeSetup,
      new RegExp(
        `revoke execute on function public\\.${functionName}\\(`,
      ),
    );
    assert.doesNotMatch(
      productionHardening,
      new RegExp(`'${functionName}'`),
    );
    assert.doesNotMatch(
      roleMatrix,
      new RegExp(`'${functionName}\\(`),
    );
    assert.doesNotMatch(
      service,
      new RegExp(`export async function ${functionName}`),
    );
    assert.doesNotMatch(
      service,
      new RegExp(`/rpc/${functionName}`),
    );
  }
  assert.match(service, /\/rpc\/get_deal_payment_record/);
  assert.match(productionHardening, /'get_deal_payment_record'/);
  assert.match(roleMatrix, /'get_deal_payment_record\(uuid\)'/);
  assert.match(
    accountSchemas,
    /dealivra\.account-mutation\.boundary-rejection\.v1/,
  );
  assert.match(
    paymentRequestSchemas,
    /dealivra\.legacy-payment\.boundary-rejection\.v1/,
  );
  assert.match(
    paymentResponseSchemas,
    /dealivra\.legacy-payment\.response-rejection\.v1/,
  );
  assert.match(service, /let authRollbackSucceeded=false/);
  assert.doesNotMatch(
    service,
    /data\?\.msg\|\|data\?\.error_description/,
  );
  assert.doesNotMatch(accountSchemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(paymentRequestSchemas, /console\.error\([^)]*value/);
  assert.doesNotMatch(paymentResponseSchemas, /console\.error\([^)]*value/);
});

test('support-case requests are exact, bounded, and normalized', async () => {
  const schemas = await import('../src/services/supportBoundarySchemas.ts');
  const dealId = '33333333-3333-4333-8333-333333333333';

  assert.deepEqual(
    schemas.parseCreateSupportCaseRequest({
      p_deal_id: dealId.toUpperCase(),
      p_category: 'delivery_issue',
      p_subject: '  Package did not arrive  ',
      p_message: '  Tracking has not changed for three days.  ',
    }),
    {
      p_deal_id: dealId,
      p_category: 'delivery_issue',
      p_subject: 'Package did not arrive',
      p_message: 'Tracking has not changed for three days.',
    },
  );
  assert.deepEqual(schemas.parseMySupportCasesRequest({}), {});
  assert.deepEqual(
    schemas.parseSupportCaseReadRequest({
      p_public_reference: ' sc-a1b2c3d4e5f6 ',
    }),
    { p_public_reference: 'SC-A1B2C3D4E5F6' },
  );
  assert.deepEqual(
    schemas.parseReplySupportCaseRequest({
      p_public_reference: 'SC-A1B2C3D4E5F6',
      p_message: 'Here is the requested tracking update.',
    }),
    {
      p_public_reference: 'SC-A1B2C3D4E5F6',
      p_message: 'Here is the requested tracking update.',
    },
  );
  assert.deepEqual(
    schemas.parseSupportQueueRequest({ p_scope: 'mine' }),
    { p_scope: 'mine' },
  );
  assert.deepEqual(
    schemas.parseSupportCaseClaimRequest({
      p_public_reference: 'SC-A1B2C3D4E5F6',
    }),
    { p_public_reference: 'SC-A1B2C3D4E5F6' },
  );
  assert.deepEqual(
    schemas.parseResolveSupportCaseRequest({
      p_public_reference: 'SC-A1B2C3D4E5F6',
      p_resolution_message: 'The carrier confirmed delivery and receipt.',
    }),
    {
      p_public_reference: 'SC-A1B2C3D4E5F6',
      p_resolution_message: 'The carrier confirmed delivery and receipt.',
    },
  );
  assert.deepEqual(
    schemas.parseSupportPostgrestErrorEnvelope({
      code: 'P0001',
      details: null,
      hint: null,
      message: 'support case unavailable',
    }, 403),
    { code: 'P0001' },
  );

  for (const operation of [
    () => schemas.parseCreateSupportCaseRequest({
      p_deal_id: null,
      p_category: 'delivery_issue',
      p_subject: 'Valid subject',
      p_message: 'Valid support message.',
      requester_id: 'private-user',
    }),
    () => schemas.parseCreateSupportCaseRequest({
      p_deal_id: null,
      p_category: 'billing_admin',
      p_subject: 'Valid subject',
      p_message: 'Valid support message.',
    }),
    () => schemas.parseCreateSupportCaseRequest({
      p_deal_id: null,
      p_category: 'other',
      p_subject: 'Private\nsubject',
      p_message: 'Valid support message.',
    }),
    () => schemas.parseSupportCaseReadRequest({
      p_public_reference: '../private',
    }),
    () => schemas.parseSupportQueueRequest({ p_scope: 'all' }),
    () => schemas.parseSupportPostgrestErrorEnvelope({
      message: 'provider detail',
      requester_email: 'private@example.test',
    }, 500),
  ]) {
    assert.throws(operation, /valid|characters|processed safely/i);
  }
});

test('support-case responses reject excess data and inconsistent state', async () => {
  const schemas = await import('../src/services/supportRuntimeSchemas.ts');
  const summary = {
    public_reference: 'SC-A1B2C3D4E5F6',
    deal_public_id: 'AB12CD34',
    category: 'delivery_issue',
    subject: 'Package did not arrive',
    status: 'waiting_support',
    priority: 'normal',
    first_response_due_at: '2026-07-21T10:00:00.000Z',
    resolution_due_at: '2026-07-23T10:00:00.000Z',
    created_at: '2026-07-20T10:00:00.000Z',
    updated_at: '2026-07-20T10:01:00.000Z',
  };

  assert.equal(
    schemas.parseSupportReferenceResponse('SC-A1B2C3D4E5F6'),
    'SC-A1B2C3D4E5F6',
  );
  assert.equal(schemas.parseSupportMutationResponse(null), undefined);
  assert.deepEqual(schemas.parseSupportCaseSummaryRows([summary]), [summary]);
  assert.deepEqual(
    schemas.parseSupportCaseDetailRows([{
      ...summary,
      message_id: '44444444-4444-4444-8444-444444444444',
      message_body: 'Tracking has not changed for three days.',
      message_author: 'requester',
      message_is_mine: true,
      message_created_at: '2026-07-20T10:00:05.000Z',
    }]),
    {
      ...summary,
      messages: [{
        id: '44444444-4444-4444-8444-444444444444',
        body: 'Tracking has not changed for three days.',
        author: 'requester',
        is_mine: true,
        created_at: '2026-07-20T10:00:05.000Z',
      }],
    },
  );
  assert.deepEqual(
    schemas.parseSupportQueueRows([{
      public_reference: 'SC-A1B2C3D4E5F6',
      category: 'safety_concern',
      priority: 'urgent',
      status: 'open',
      assignment_state: 'unassigned',
      first_response_due_at: '2026-07-20T11:00:00.000Z',
      resolution_due_at: '2026-07-21T10:00:00.000Z',
      created_at: '2026-07-20T10:00:00.000Z',
      updated_at: '2026-07-20T10:00:00.000Z',
    }]),
    [{
      public_reference: 'SC-A1B2C3D4E5F6',
      category: 'safety_concern',
      priority: 'urgent',
      status: 'open',
      assignment_state: 'unassigned',
      first_response_due_at: '2026-07-20T11:00:00.000Z',
      resolution_due_at: '2026-07-21T10:00:00.000Z',
      created_at: '2026-07-20T10:00:00.000Z',
      updated_at: '2026-07-20T10:00:00.000Z',
    }],
  );

  for (const operation of [
    () => schemas.parseSupportReferenceResponse('SC-private'),
    () => schemas.parseSupportMutationResponse({ ok: true }),
    () => schemas.parseSupportCaseSummaryRows([{
      ...summary,
      requester_email: 'private@example.test',
    }]),
    () => schemas.parseSupportCaseDetailRows([{
      ...summary,
      message_id: '44444444-4444-4444-8444-444444444444',
      message_body: 'Tracking has not changed for three days.',
      message_author: 'admin',
      message_is_mine: false,
      message_created_at: '2026-07-20T10:00:05.000Z',
    }]),
    () => schemas.parseSupportQueueRows([{
      public_reference: 'SC-A1B2C3D4E5F6',
      category: 'delivery_issue',
      priority: 'normal',
      status: 'resolved',
      assignment_state: 'mine',
      first_response_due_at: '2026-07-21T10:00:00.000Z',
      resolution_due_at: '2026-07-23T10:00:00.000Z',
      created_at: '2026-07-20T10:00:00.000Z',
      updated_at: '2026-07-20T10:01:00.000Z',
    }]),
  ]) {
    assert.throws(operation, /invalid response/i);
  }
});

test('support-case rejection diagnostics never include customer content', async () => {
  const requests = await import('../src/services/supportBoundarySchemas.ts');
  const responses = await import('../src/services/supportRuntimeSchemas.ts');
  const logs = [];
  const originalConsoleError = console.error;
  console.error = (...values) => logs.push(values);

  try {
    assert.throws(
      () => requests.parseCreateSupportCaseRequest({
        p_deal_id: null,
        p_category: 'other',
        p_subject: 'private@example.test',
        p_message: 'private-message-content',
        requester_id: 'private-user-id',
      }),
      /processed safely/i,
    );
    assert.throws(
      () => responses.parseSupportCaseSummaryRows([{
        public_reference: 'SC-A1B2C3D4E5F6',
        customer_message: 'private-message-content',
      }]),
      /invalid response/i,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(
    serializedLogs,
    /dealivra\.support\.boundary-rejection\.v1/,
  );
  assert.match(
    serializedLogs,
    /dealivra\.support\.response-rejection\.v1/,
  );
  assert.doesNotMatch(serializedLogs, /private@example\.test/);
  assert.doesNotMatch(serializedLogs, /private-message-content/);
  assert.doesNotMatch(serializedLogs, /private-user-id/);
});

test('support cases are staged behind exact assignment and privacy boundaries', () => {
  const setup = readText('supabase/support_case_setup.sql');
  const rollback = readText(
    'supabase/tests/support_case_authorization_rollback.sql',
  );
  const hardening = readText('supabase/production_auth_rbac_hardening.sql');
  const roleMatrix = readText(
    'supabase/tests/authenticated_rpc_cross_role_rollback.sql',
  );
  const requests = readText('src/services/supportBoundarySchemas.ts');
  const responses = readText('src/services/supportRuntimeSchemas.ts');
  const service = readText('src/services/supabaseRest.ts');
  const flags = readText('src/featureFlags.ts');
  const profile = readText('src/AccountProfileWorkspace.tsx');
  const center = readText('src/SupportCaseCenter.tsx');
  const functions = [
    'create_support_case',
    'get_my_support_cases',
    'get_support_case',
    'reply_support_case',
    'get_support_queue',
    'claim_support_case',
    'resolve_support_case',
  ];

  assert.match(setup, /alter table public\.support_cases enable row level security/);
  assert.match(
    setup,
    /revoke all on table public\.support_cases\s+from public, anon, authenticated/,
  );
  assert.match(
    setup,
    /revoke all on table public\.support_case_messages\s+from public, anon, authenticated/,
  );
  assert.match(setup, /support_case_messages_reject_update_delete/);
  assert.match(setup, /support_case_messages_reject_truncate/);
  assert.match(setup, /pg_advisory_xact_lock/);
  assert.match(setup, /active_case_count >= 5/);
  assert.match(setup, /assigned_to = viewer/);
  assert.match(setup, /assigned_to = operator_id/);
  assert.match(setup, /auth\.jwt\(\) ->> 'aal'/);
  assert.match(setup, /support_case_opened/);
  assert.match(setup, /support_case_claimed/);
  assert.match(setup, /support_case_replied/);
  assert.match(setup, /support_case_resolved/);

  for (const functionName of functions) {
    assert.match(setup, new RegExp(`function public\\.${functionName}\\(`));
    assert.match(hardening, new RegExp(`'${functionName}'`));
    assert.match(roleMatrix, new RegExp(`'${functionName}\\(`));
    assert.match(service, new RegExp(`/rpc/${functionName}`));
  }
  for (const parser of [
    'parseCreateSupportCaseRequest',
    'parseMySupportCasesRequest',
    'parseSupportCaseReadRequest',
    'parseReplySupportCaseRequest',
    'parseSupportQueueRequest',
    'parseSupportCaseClaimRequest',
    'parseResolveSupportCaseRequest',
    'parseSupportPostgrestErrorEnvelope',
    'parseSupportReferenceResponse',
    'parseSupportMutationResponse',
    'parseSupportCaseSummaryRows',
    'parseSupportCaseDetailRows',
    'parseSupportQueueRows',
  ]) {
    assert.match(service, new RegExp(`${parser}\\(`));
  }
  assert.match(flags, /VITE_SUPPORT_CASES_ENABLED/);
  assert.match(flags, /=== 'enabled'/);
  assert.match(profile, /supportCasesEnabled \? <SupportCaseCenter/);
  assert.match(center, /Never include passwords/);
  assert.match(center, /Do not use support chat for an immediate emergency/);
  assert.match(rollback, /Support tables are not deny-by-default/);
  assert.match(rollback, /Support queue privacy or AAL2 boundary changed/);
  assert.match(requests, /dealivra\.support\.boundary-rejection\.v1/);
  assert.match(responses, /dealivra\.support\.response-rejection\.v1/);
  assert.doesNotMatch(requests, /console\.error\([^)]*value/);
  assert.doesNotMatch(responses, /console\.error\([^)]*value/);
});

test('runtime rejection reporter accepts only three bounded dimensions', async () => {
  const reporter = await import(
    '../src/services/runtimeRejectionReporter.ts'
  );
  const event = {
    schema: 'dealivra.support.response-rejection.v1',
    boundary: 'support_case_detail',
    issue: 'record_shape_invalid',
  };

  assert.deepEqual(reporter.normalizeRuntimeRejection(event), event);
  for (const invalid of [
    null,
    [],
    { ...event, customer_email: 'private@example.test' },
    { ...event, schema: 'dealivra.unknown.event.v1' },
    { ...event, boundary: 'support/case' },
    { ...event, issue: 'x'.repeat(97) },
  ]) {
    assert.equal(reporter.normalizeRuntimeRejection(invalid), null);
  }
});

test('runtime rejection intake is same-origin, staged, and privacy safe', async () => {
  const originalMode = process.env.DEALIVRA_RUNTIME_REJECTION_MODE;
  const originalEnvironment = process.env.VERCEL_ENV;
  const originalCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = value => warnings.push(String(value));

  const request = (
    body,
    {
      method = 'POST',
      origin = 'https://dealivra.test',
      host = 'dealivra.test',
      contentType = 'application/json',
    } = {},
  ) => ({
    method,
    headers: {
      origin,
      host,
      'content-type': contentType,
    },
    body,
  });
  const valid = {
    schema: 'dealivra.support.response-rejection.v1',
    boundary: 'support_case_detail',
    issue: 'record_shape_invalid',
    occurrence_count: 1,
  };

  try {
    process.env.DEALIVRA_RUNTIME_REJECTION_MODE = 'staged';
    const staged = createResponse();
    await runtimeRejectionHandler(request(valid), staged);
    assert.equal(staged.statusCode, 204);
    assert.equal(staged.ended, true);
    assert.equal(warnings.length, 0);

    process.env.DEALIVRA_RUNTIME_REJECTION_MODE = 'enforced';
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_SHA = 'a'.repeat(40);

    const missingOrigin = createResponse();
    await runtimeRejectionHandler(
      request(valid, { origin: null }),
      missingOrigin,
    );
    assert.equal(missingOrigin.statusCode, 403);

    const method = createResponse();
    await runtimeRejectionHandler(
      request(valid, { method: 'GET' }),
      method,
    );
    assert.equal(method.statusCode, 405);
    assert.equal(method.headers.get('allow'), 'POST');

    const crossOrigin = createResponse();
    await runtimeRejectionHandler(
      request(valid, { origin: 'https://attacker.test' }),
      crossOrigin,
    );
    assert.equal(crossOrigin.statusCode, 403);

    const contentType = createResponse();
    await runtimeRejectionHandler(
      request(valid, { contentType: 'text/plain' }),
      contentType,
    );
    assert.equal(contentType.statusCode, 415);

    const excess = createResponse();
    await runtimeRejectionHandler(request({
      ...valid,
      rejected_payload: 'private-message-content',
    }), excess);
    assert.equal(excess.statusCode, 400);
    assert.equal(warnings.length, 0);

    const oversized = createResponse();
    await runtimeRejectionHandler(request('x'.repeat(1_025)), oversized);
    assert.equal(oversized.statusCode, 400);

    process.env.DEALIVRA_RUNTIME_REJECTION_MODE = 'unexpected';
    const disabled = createResponse();
    await runtimeRejectionHandler(request(valid), disabled);
    assert.equal(disabled.statusCode, 503);
    assert.equal(warnings.length, 0);

    process.env.DEALIVRA_RUNTIME_REJECTION_MODE = 'enforced';
    const accepted = createResponse();
    await runtimeRejectionHandler(request(valid), accepted);
    assert.equal(accepted.statusCode, 204);
    assert.equal(accepted.ended, true);
    assert.equal(warnings.length, 1);

    const logged = JSON.parse(warnings[0]);
    assert.deepEqual(
      {
        schema: logged.schema,
        environment: logged.environment,
        release: logged.release,
        event_schema: logged.event_schema,
        boundary: logged.boundary,
        issue: logged.issue,
        occurrence_count: logged.occurrence_count,
      },
      {
        schema: 'dealivra.runtime-rejection-monitor.v1',
        environment: 'preview',
        release: 'a'.repeat(40),
        event_schema: valid.schema,
        boundary: valid.boundary,
        issue: valid.issue,
        occurrence_count: 1,
      },
    );
    assert.match(logged.event_id, /^[0-9a-f-]{36}$/);
    assert.ok(Number.isFinite(Date.parse(logged.received_at)));
    assert.doesNotMatch(warnings[0], /private-message-content/);
    assert.doesNotMatch(warnings[0], /dealivra\.test/);
  } finally {
    console.warn = originalWarn;
    if (originalMode === undefined) {
      delete process.env.DEALIVRA_RUNTIME_REJECTION_MODE;
    } else {
      process.env.DEALIVRA_RUNTIME_REJECTION_MODE = originalMode;
    }
    if (originalEnvironment === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalEnvironment;
    }
    if (originalCommit === undefined) {
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    } else {
      process.env.VERCEL_GIT_COMMIT_SHA = originalCommit;
    }
  }
});

test('every runtime schema uses the governed rejection transport', () => {
  const reporter = readText('src/services/runtimeRejectionReporter.ts');
  const endpoint = readText('api/security/runtime-rejection.mjs');
  const requestBoundary = readText('server/reportingRequestBoundary.mjs');
  const schemaFiles = [
    'accountActivityBoundarySchemas.ts',
    'accountActivityRuntimeSchemas.ts',
    'accountMutationBoundarySchemas.ts',
    'adminBoundarySchemas.ts',
    'adminRuntimeSchemas.ts',
    'agreementBoundarySchemas.ts',
    'agreementRuntimeSchemas.ts',
    'authBoundarySchemas.ts',
    'authRuntimeSchemas.ts',
    'dealMutationBoundarySchemas.ts',
    'dealMutationRuntimeSchemas.ts',
    'deliveryBoundarySchemas.ts',
    'deliveryRuntimeSchemas.ts',
    'evidenceBoundarySchemas.ts',
    'evidenceRuntimeSchemas.ts',
    'interactionBoundarySchemas.ts',
    'interactionRuntimeSchemas.ts',
    'legacyPaymentBoundarySchemas.ts',
    'legacyPaymentRuntimeSchemas.ts',
    'paymentBoundarySchemas.ts',
    'paymentRuntimeSchemas.ts',
    'runtimeSchemas.ts',
    'supportBoundarySchemas.ts',
    'supportRuntimeSchemas.ts',
    'trustBoundarySchemas.ts',
    'trustRuntimeSchemas.ts',
  ];

  for (const file of schemaFiles) {
    const source = readText(`src/services/${file}`);
    assert.match(source, /reportRuntimeRejection\(\{/);
    assert.match(
      source,
      /from '\.\/runtimeRejectionReporter\.ts'/,
    );
    assert.doesNotMatch(
      source,
      /console\.error\('\[dealivra-.*rejection\]'/,
    );
  }
  assert.match(reporter, /maximumTransportsPerMinute = 20/);
  assert.match(reporter, /signatureCooldownMs = 30_000/);
  assert.match(reporter, /sendBoundedDiagnostic\(/);
  assert.match(reporter, /\/api\/security\/runtime-rejection/);
  assert.doesNotMatch(reporter, /location\.(?:href|pathname|search|hash)/);
  assert.match(endpoint, /DEALIVRA_RUNTIME_REJECTION_MODE/);
  assert.match(endpoint, /mode === 'staged'/);
  assert.match(endpoint, /mode !== 'enforced'/);
  assert.match(endpoint, /maximumBodyBytes = 1_024/);
  assert.match(endpoint, /validateReportingRequest/);
  assert.match(requestBoundary, /readBoundedJson/);
  assert.match(endpoint, /Object\.keys\(value\)\.length !== 4/);
  assert.match(endpoint, /dealivra\.runtime-rejection-monitor\.v1/);
  assert.doesNotMatch(endpoint, /x-forwarded-for/i);
  assert.doesNotMatch(endpoint, /user-agent/i);
  assert.doesNotMatch(endpoint, /\breferer\b/i);
  assert.doesNotMatch(endpoint, /headers?\[['"]cookie/i);
});

test('client failure reporter accepts only fixed non-sensitive categories', async () => {
  const reporter = await import('../src/services/clientFailureReporter.ts');
  const renderFailure = {
    schema: 'dealivra.client-failure.v1',
    boundary: 'application_render',
    issue: 'react_render_failed',
  };

  assert.deepEqual(reporter.normalizeClientFailure(renderFailure), renderFailure);
  assert.deepEqual(
    reporter.normalizeClientFailure({
      schema: 'dealivra.client-failure.v1',
      boundary: 'browser_runtime',
      issue: 'unhandled_promise_rejection',
    }),
    {
      schema: 'dealivra.client-failure.v1',
      boundary: 'browser_runtime',
      issue: 'unhandled_promise_rejection',
    },
  );
  assert.deepEqual(
    reporter.normalizeClientFailure({
      schema: 'dealivra.client-failure.v1',
      boundary: 'address_autocomplete',
      issue: 'suggestion_request_failed',
    }),
    {
      schema: 'dealivra.client-failure.v1',
      boundary: 'address_autocomplete',
      issue: 'suggestion_request_failed',
    },
  );
  for (const invalid of [
    null,
    [],
    { ...renderFailure, componentStack: 'at PrivateDeal' },
    { ...renderFailure, error: 'token=private' },
    { ...renderFailure, boundary: 'browser_runtime' },
    { ...renderFailure, issue: 'arbitrary_failure' },
    {
      schema: 'dealivra.client-failure.v1',
      boundary: 'application_bootstrap',
      issue: 'react_render_failed',
    },
  ]) {
    assert.equal(reporter.normalizeClientFailure(invalid), null);
  }
});

test('client failure intake is default-off, exact, and privacy safe', async () => {
  const originalMode = process.env.DEALIVRA_CLIENT_FAILURE_MODE;
  const originalEnvironment = process.env.VERCEL_ENV;
  const originalCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = value => warnings.push(String(value));

  const request = (
    body,
    {
      method = 'POST',
      origin = 'https://dealivra.test',
      host = 'dealivra.test',
      contentType = 'application/json',
    } = {},
  ) => ({
    method,
    headers: {
      origin,
      host,
      'content-type': contentType,
    },
    body,
  });
  const valid = {
    schema: 'dealivra.client-failure.v1',
    boundary: 'application_render',
    issue: 'react_render_failed',
    occurrence_count: 1,
  };

  try {
    delete process.env.DEALIVRA_CLIENT_FAILURE_MODE;
    const staged = createResponse();
    await clientFailureHandler(request(valid), staged);
    assert.equal(staged.statusCode, 204);
    assert.equal(staged.ended, true);
    assert.equal(warnings.length, 0);

    process.env.DEALIVRA_CLIENT_FAILURE_MODE = 'enforced';
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_SHA = 'b'.repeat(40);

    const method = createResponse();
    await clientFailureHandler(request(valid, { method: 'GET' }), method);
    assert.equal(method.statusCode, 405);
    assert.equal(method.headers.get('allow'), 'POST');

    const crossOrigin = createResponse();
    await clientFailureHandler(
      request(valid, { origin: 'https://attacker.test' }),
      crossOrigin,
    );
    assert.equal(crossOrigin.statusCode, 403);

    const contentType = createResponse();
    await clientFailureHandler(
      request(valid, { contentType: 'text/plain' }),
      contentType,
    );
    assert.equal(contentType.statusCode, 415);

    for (const body of [
      { ...valid, stack: 'at PrivateDeal' },
      { ...valid, issue: 'arbitrary_failure' },
      {
        ...valid,
        boundary: 'application_bootstrap',
        issue: 'react_render_failed',
      },
      'x'.repeat(513),
    ]) {
      const rejected = createResponse();
      await clientFailureHandler(request(body), rejected);
      assert.equal(rejected.statusCode, 400);
    }
    assert.equal(warnings.length, 0);

    process.env.DEALIVRA_CLIENT_FAILURE_MODE = 'invalid';
    const unavailable = createResponse();
    await clientFailureHandler(request(valid), unavailable);
    assert.equal(unavailable.statusCode, 503);

    process.env.DEALIVRA_CLIENT_FAILURE_MODE = 'enforced';
    const accepted = createResponse();
    await clientFailureHandler(request(valid), accepted);
    assert.equal(accepted.statusCode, 204);
    assert.equal(accepted.ended, true);
    assert.equal(warnings.length, 1);

    const logged = JSON.parse(warnings[0]);
    assert.deepEqual(
      {
        schema: logged.schema,
        environment: logged.environment,
        release: logged.release,
        event_schema: logged.event_schema,
        boundary: logged.boundary,
        issue: logged.issue,
        occurrence_count: logged.occurrence_count,
      },
      {
        schema: 'dealivra.client-failure-monitor.v1',
        environment: 'preview',
        release: 'b'.repeat(40),
        event_schema: valid.schema,
        boundary: valid.boundary,
        issue: valid.issue,
        occurrence_count: 1,
      },
    );
    assert.match(logged.event_id, /^[0-9a-f-]{36}$/);
    assert.ok(Number.isFinite(Date.parse(logged.received_at)));
    assert.doesNotMatch(warnings[0], /PrivateDeal|token|dealivra\.test/);
  } finally {
    console.warn = originalWarn;
    if (originalMode === undefined) {
      delete process.env.DEALIVRA_CLIENT_FAILURE_MODE;
    } else {
      process.env.DEALIVRA_CLIENT_FAILURE_MODE = originalMode;
    }
    if (originalEnvironment === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalEnvironment;
    }
    if (originalCommit === undefined) {
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    } else {
      process.env.VERCEL_GIT_COMMIT_SHA = originalCommit;
    }
  }
});

test('render and bootstrap failures use the governed recovery boundary', () => {
  const boundary = readText('src/AppErrorBoundary.tsx');
  const main = readText('src/main.tsx');
  const reporter = readText('src/services/clientFailureReporter.ts');
  const endpoint = readText('api/security/client-failure.mjs');
  const requestBoundary = readText('server/reportingRequestBoundary.mjs');

  assert.match(boundary, /reportClientFailure\(\{/);
  assert.match(boundary, /boundary: 'application_render'/);
  assert.match(boundary, /issue: 'react_render_failed'/);
  assert.match(boundary, /return <ApplicationFailurePage \/>/);
  assert.doesNotMatch(boundary, /error\.name/);
  assert.doesNotMatch(boundary, /errorInfo\.componentStack/);

  assert.match(main, /catch \{/);
  assert.match(main, /issue: 'bundle_load_failed'/);
  assert.match(main, /<ApplicationFailurePage \/>/);
  assert.match(main, /addEventListener\('error'/);
  assert.match(main, /issue: 'window_error'/);
  assert.match(main, /addEventListener\('unhandledrejection'/);
  assert.match(main, /issue: 'unhandled_promise_rejection'/);
  assert.match(main, /issue: 'localization_initialization_failed'/);

  assert.match(reporter, /maximumTransportsPerMinute = 10/);
  assert.match(reporter, /signatureCooldownMs = 30_000/);
  assert.match(reporter, /sendBoundedDiagnostic\(/);
  assert.doesNotMatch(reporter, /location\.(?:href|pathname|search|hash)/);
  assert.match(endpoint, /DEALIVRA_CLIENT_FAILURE_MODE/);
  assert.match(endpoint, /maximumBodyBytes = 512/);
  assert.match(endpoint, /validateReportingRequest/);
  assert.match(requestBoundary, /hasCanonicalSameOrigin/);
  assert.match(endpoint, /Object\.keys\(value\)\.length !== 4/);
  assert.match(endpoint, /dealivra\.client-failure-monitor\.v1/);
  assert.doesNotMatch(endpoint, /x-forwarded-for|user-agent|\breferer\b/i);
  assert.doesNotMatch(endpoint, /headers?\[['"]cookie/i);
});

test('server failures are fixed-category, correlated, and privacy safe', async () => {
  const reporter = await import('../server/serverFailureReporter.mjs');
  const auth = await import('../server/authShared.mjs');
  const originalError = console.error;
  const originalEnvironment = process.env.VERCEL_ENV;
  const originalCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  const errors = [];
  console.error = value => errors.push(String(value));

  try {
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_SHA = 'c'.repeat(40);
    const event = {
      schema: 'dealivra.server-failure.v1',
      boundary: 'catalog_read',
      issue: 'catalog_unavailable',
    };

    assert.deepEqual(reporter.normalizeServerFailure(event), {
      event_schema: event.schema,
      boundary: event.boundary,
      issue: event.issue,
    });
    assert.equal(reporter.recordServerFailure(event), true);
    for (const invalid of [
      null,
      [],
      { ...event, error: 'private provider message' },
      { ...event, boundary: 'catalog/read' },
      { ...event, issue: 'database_row_private' },
    ]) {
      assert.equal(reporter.normalizeServerFailure(invalid), null);
      assert.equal(reporter.recordServerFailure(invalid), false);
    }

    auth.logAuthFailure(
      'login',
      new Error('fetch failed token=private customer@example.test'),
    );
    auth.logAuthFailure(
      'signup',
      new Error('Authentication service is not configured.'),
    );
    auth.logAuthFailure(
      'refresh',
      new Error('Service URL is invalid: https://secret.example.test'),
    );
    auth.logAuthFailure(
      'password:change',
      new Error('customer@example.test failed with private profile data'),
    );

    assert.equal(errors.length, 5);
    const records = errors.map(value => JSON.parse(value));
    for (const record of records) {
      assert.equal(record.schema, 'dealivra.server-failure-monitor.v1');
      assert.equal(record.event_schema, 'dealivra.server-failure.v1');
      assert.equal(record.environment, 'preview');
      assert.equal(record.release, 'c'.repeat(40));
      assert.match(record.event_id, /^[0-9a-f-]{36}$/);
      assert.ok(Number.isFinite(Date.parse(record.occurred_at)));
      assert.match(record.boundary, /^[a-z][a-z0-9_]{1,95}$/);
    }
    assert.deepEqual(
      records.slice(1).map(({ boundary, issue }) => ({ boundary, issue })),
      [
        { boundary: 'auth_login', issue: 'provider_unavailable' },
        { boundary: 'auth_signup', issue: 'configuration_missing' },
        { boundary: 'auth_refresh', issue: 'configuration_invalid' },
        { boundary: 'auth_password_change', issue: 'unexpected_failure' },
      ],
    );
    assert.doesNotMatch(
      errors.join('\n'),
      /private|customer@example|secret\.example|token=/i,
    );
  } finally {
    console.error = originalError;
    if (originalEnvironment === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalEnvironment;
    }
    if (originalCommit === undefined) {
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    } else {
      process.env.VERCEL_GIT_COMMIT_SHA = originalCommit;
    }
  }
});

test('current Vercel service failures use the governed server reporter', () => {
  const reporter = readText('server/serverFailureReporter.mjs');
  const auth = readText('server/authShared.mjs');
  const catalog = readText('api/catalog.mjs');
  const vin = readText('api/vehicles/vin.mjs');

  assert.match(reporter, /Object\.keys\(value\)\.length !== 3/);
  assert.match(reporter, /dealivra\.server-failure-monitor\.v1/);
  assert.match(reporter, /event_id: randomUUID\(\)/);
  assert.doesNotMatch(
    reporter,
    /error\.(?:message|name|stack)|request\.headers|x-forwarded-for|user-agent/i,
  );

  assert.match(auth, /recordServerFailure\(\{/);
  assert.match(auth, /boundary,/);
  assert.match(auth, /issue,/);
  assert.doesNotMatch(auth, /diagnosticTokens/);
  assert.doesNotMatch(auth, /current\[(?:property|['"]message['"])\]/);

  assert.match(catalog, /boundary: 'catalog_read'/);
  assert.match(catalog, /issue: 'catalog_unavailable'/);
  assert.match(vin, /boundary: 'vehicle_vin_decode'/);
  assert.match(vin, /'provider_timeout'/);
  assert.match(vin, /'provider_response_invalid'/);
  assert.match(vin, /'provider_unavailable'/);
});

test('privacy-safe Web Vitals use fixed quality buckets only', async () => {
  const reporter = readText('src/services/webVitalReporter.ts');
  const endpoint = readText('api/security/web-vital.mjs');
  const requestBoundary = readText('server/reportingRequestBoundary.mjs');
  const main = readText('src/main.tsx');
  const warnings = [];
  const originalInfo = console.info;
  const originalMode = process.env.DEALIVRA_WEB_VITAL_MODE;
  const originalEnvironment = process.env.VERCEL_ENV;
  const originalCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  console.info = value => warnings.push(String(value));

  const request = (
    body,
    {
      method = 'POST',
      origin = 'https://dealivra.test',
      host = 'dealivra.test',
      contentType = 'application/json',
    } = {},
  ) => ({
    method,
    headers: {
      origin,
      host,
      'content-type': contentType,
    },
    body,
  });
  const valid = {
    schema: 'dealivra.web-vital.v1',
    metric: 'lcp',
    rating: 'needs_improvement',
    bucket: '2500_4000',
    occurrence_count: 1,
  };

  try {
    delete process.env.DEALIVRA_WEB_VITAL_MODE;
    const staged = createResponse();
    await webVitalHandler(request(valid), staged);
    assert.equal(staged.statusCode, 204);
    assert.equal(warnings.length, 0);

    process.env.DEALIVRA_WEB_VITAL_MODE = 'enforced';
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_SHA = 'd'.repeat(40);

    for (const [body, options, expectedStatus] of [
      [valid, { method: 'GET' }, 405],
      [valid, { origin: 'https://attacker.test' }, 403],
      [valid, { contentType: 'text/plain' }, 415],
      [{ ...valid, exact_value: 3123.2 }, {}, 400],
      [{ ...valid, bucket: 'over_4000' }, {}, 400],
      [{ ...valid, metric: 'navigation' }, {}, 400],
      ['x'.repeat(513), {}, 400],
    ]) {
      const rejected = createResponse();
      await webVitalHandler(request(body, options), rejected);
      assert.equal(rejected.statusCode, expectedStatus);
    }
    assert.equal(warnings.length, 0);

    const accepted = createResponse();
    await webVitalHandler(request(valid), accepted);
    assert.equal(accepted.statusCode, 204);
    assert.equal(warnings.length, 1);
    const record = JSON.parse(warnings[0]);
    assert.deepEqual(
      {
        schema: record.schema,
        environment: record.environment,
        release: record.release,
        event_schema: record.event_schema,
        metric: record.metric,
        rating: record.rating,
        bucket: record.bucket,
        occurrence_count: record.occurrence_count,
      },
      {
        schema: 'dealivra.web-vital-monitor.v1',
        environment: 'preview',
        release: 'd'.repeat(40),
        event_schema: valid.schema,
        metric: valid.metric,
        rating: valid.rating,
        bucket: valid.bucket,
        occurrence_count: 1,
      },
    );
    assert.match(record.event_id, /^[0-9a-f-]{36}$/);
    assert.ok(Number.isFinite(Date.parse(record.received_at)));
    assert.doesNotMatch(warnings[0], /dealivra\.test|customer|route|device/i);
  } finally {
    console.info = originalInfo;
    if (originalMode === undefined) {
      delete process.env.DEALIVRA_WEB_VITAL_MODE;
    } else {
      process.env.DEALIVRA_WEB_VITAL_MODE = originalMode;
    }
    if (originalEnvironment === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalEnvironment;
    }
    if (originalCommit === undefined) {
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    } else {
      process.env.VERCEL_GIT_COMMIT_SHA = originalCommit;
    }
  }

  assert.match(reporter, /classifyWebVital/);
  assert.match(reporter, /'under_2500'/);
  assert.match(reporter, /'0_1_0_25'/);
  assert.match(reporter, /'200_500'/);
  assert.match(reporter, /sendBoundedDiagnostic\(/);
  assert.doesNotMatch(
    reporter,
    /location\.(?:href|pathname|search|hash)|navigator\.userAgent/,
  );
  assert.match(endpoint, /DEALIVRA_WEB_VITAL_MODE/);
  assert.match(endpoint, /maximumBodyBytes = 512/);
  assert.match(endpoint, /readBoundedJson/);
  assert.match(requestBoundary, /contentType !== 'application\/json'/);
  assert.match(endpoint, /Object\.keys\(value\)\.length !== 5/);
  assert.doesNotMatch(endpoint, /x-forwarded-for|user-agent|\breferer\b/i);
  assert.match(main, /startWebVitalMonitoring\(\)/);
});

test('health and browser reporting responses always carry the no-store security contract', async () => {
  const assertHardened = response => {
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  };
  const reportingRequest = {
    method: 'GET',
    headers: {
      origin: 'https://dealivra.test',
      host: 'dealivra.test',
      'content-type': 'application/json',
    },
    body: {},
  };

  for (const handler of [
    runtimeRejectionHandler,
    clientFailureHandler,
    webVitalHandler,
  ]) {
    const response = createResponse();
    await handler(reportingRequest, response);
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.get('allow'), 'POST');
    assertHardened(response);
  }

  const cspResponse = createResponse();
  await cspReportHandler({
    method: 'GET',
    headers: { 'content-type': 'application/csp-report' },
    body: {},
  }, cspResponse);
  assert.equal(cspResponse.statusCode, 405);
  assert.equal(cspResponse.headers.get('allow'), 'POST');
  assertHardened(cspResponse);

  for (const method of ['GET', 'HEAD', 'POST']) {
    const response = createResponse();
    healthHandler({ method, headers: {} }, response);
    assert.equal(response.statusCode, method === 'POST' ? 405 : 200);
    assertHardened(response);
  }
});

test('production builds enforce explicit JavaScript and CSS budgets', () => {
  const packageJson = readJson('package.json');
  const budget = readText('scripts/verify-build-budgets.mjs');

  assert.equal(
    packageJson.scripts['performance:budgets'],
    'node scripts/verify-build-budgets.mjs',
  );
  assert.match(packageJson.scripts.build, /npm run performance:budgets$/);
  assert.match(budget, /maximumJavaScriptChunkBytes: 400_000/);
  assert.match(budget, /maximumInitialApplicationBytes: 160_000/);
  assert.match(budget, /\^app-\[A-Za-z0-9_-\]\+\\\.js\$/);
  assert.match(budget, /Expected exactly one initial application chunk/);
  assert.match(budget, /maximumCssChunkBytes: 200_000/);
  assert.match(budget, /maximumTotalJavaScriptBytes: 830_000/);
  assert.match(budget, /maximumTotalCssBytes: 290_000/);
  assert.match(budget, /throw new Error\(`Build performance budget exceeded:/);
});

test('health endpoint is minimal, uncached, and read-only', () => {
  const getResponse = createResponse();
  healthHandler({ method: 'GET', headers: {} }, getResponse);
  assert.equal(getResponse.statusCode, 200);
  assert.deepEqual(getResponse.payload, {
    schema: 'dealivra.health.v1',
    status: 'alive',
  });
  assert.equal(getResponse.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(getResponse.headers.get('x-content-type-options'), 'nosniff');

  const headResponse = createResponse();
  healthHandler({ method: 'HEAD', headers: {} }, headResponse);
  assert.equal(headResponse.statusCode, 200);
  assert.equal(headResponse.ended, true);
  assert.equal(headResponse.payload, undefined);

  const postResponse = createResponse();
  healthHandler({ method: 'POST', headers: {} }, postResponse);
  assert.equal(postResponse.statusCode, 405);
  assert.equal(postResponse.headers.get('allow'), 'GET, HEAD');

  const source = readText('api/health.mjs');
  assert.doesNotMatch(
    source,
    /process\.env|commit|release|database|supabase|stripe|hostname|request\.headers/i,
  );
});

test('protected synthetic checks are read-only, bounded, and secret safe', () => {
  const packageJson = readJson('package.json');
  const source = readText('scripts/run-protected-synthetic.mjs');

  assert.equal(
    packageJson.scripts['smoke:protected'],
    'node scripts/run-protected-synthetic.mjs',
  );
  assert.match(source, /method: 'GET'/);
  assert.match(source, /redirect: 'manual'/);
  assert.match(source, /AbortSignal\.timeout\(requestTimeoutMs\)/);
  assert.match(source, /maximumResponseBytes = 1_000_000/);
  assert.match(source, /DEALIVRA_SYNTHETIC_BYPASS_SECRET/);
  assert.match(source, /'x-vercel-protection-bypass': secret/);
  assert.match(source, /DEALIVRA_SYNTHETIC_PRODUCTION_MODE/);
  assert.match(source, /read_only_confirmed/);
  assert.match(source, /'\/api\/health'/);
  assert.match(source, /'\/terms'/);
  assert.match(source, /'\/\?start=signin'/);
  assert.match(source, /'\/api\/catalog\?category=phone'/);
  assert.match(source, /dealivra\.synthetic\.result\.v1/);
  assert.match(source, /status: 'failed'/);
  assert.doesNotMatch(
    source,
    /method:\s*'(?:POST|PUT|PATCH|DELETE)'|path:\s*'\/api\/(?:auth|payments?)|authorization|body:/i,
  );
  assert.doesNotMatch(source, /console\.(?:log|error)\([^)]*secret/i);
});

test('operational records collapse to fixed non-identifying counters', () => {
  assert.deepEqual(
    classifyOperationalRecord({
      schema: 'dealivra.payment.operation.v1',
      outcome: 'failed',
      severity: 'error',
      error_code: 'payment_intent_mismatch',
      correlation_id: 'private-correlation',
      deal_id: 'private-deal',
      customer_email: 'customer@example.test',
    }),
    ['payment_failures', 'payment_integrity_events'],
  );
  assert.deepEqual(
    classifyOperationalRecord({
      schema: 'dealivra.auth.rejection.v1',
      status: 429,
      code: 'over_request_rate_limit',
      submitted_email: 'customer@example.test',
    }),
    ['auth_abuse_events'],
  );
  assert.deepEqual(
    classifyOperationalRecord({
      schema: 'dealivra.web-vital-monitor.v1',
      metric: 'lcp',
      rating: 'good',
      exact_value: 1_500,
    }),
    [],
  );
  assert.deepEqual(classifyOperationalRecord(null), []);
  assert.deepEqual(classifyOperationalRecord({ schema: 'unknown' }), []);

  const records = [
    {
      schema: 'dealivra.synthetic.result.v1',
      status: 'failed',
      target_url: 'https://private-preview.example.test',
    },
    {
      schema: 'dealivra.payment.operation.v1',
      outcome: 'failed',
      severity: 'error',
      error_code: 'provider_configuration_error',
      provider_request_id: 'private-provider-request',
    },
    {
      schema: 'dealivra.payment.operation.v1',
      outcome: 'failed',
      error_code: 'release_reconciliation_required',
      deal_id: 'private-deal',
    },
    {
      schema: 'dealivra.security.notification.v1',
      event: 'worker_failed',
      secret: 'private-worker-secret',
    },
    ...Array.from({ length: 5 }, () => ({
      schema: 'dealivra.server-failure-monitor.v1',
      message: 'private database error',
    })),
    ...Array.from({ length: 20 }, () => ({
      schema: 'dealivra.web-vital-monitor.v1',
      metric: 'inp',
      rating: 'poor',
      route: '/private-deal',
    })),
    ...Array.from({ length: 50 }, () => ({
      schema: 'dealivra.auth.rejection.v1',
      status: 429,
      email: 'customer@example.test',
    })),
  ];
  const snapshot = buildOperationalSnapshot({
    schema: 'dealivra.monitoring-window.v1',
    environment: 'preview',
    release: 'e'.repeat(40),
    window_started_at: '2026-07-30T12:00:00Z',
    window_minutes: 5,
  }, records);

  assert.ok(snapshot);
  assert.equal(snapshot.counters.synthetic_failures, 1);
  assert.equal(snapshot.counters.payment_failures, 2);
  assert.equal(snapshot.counters.payment_configuration_events, 1);
  assert.equal(snapshot.counters.payment_integrity_events, 1);
  assert.equal(snapshot.counters.security_notification_failures, 1);
  assert.equal(snapshot.counters.server_failures, 5);
  assert.equal(snapshot.counters.poor_web_vitals, 20);
  assert.equal(snapshot.counters.auth_abuse_events, 50);
  assert.deepEqual(
    snapshot.alerts.map(({ code, severity }) => ({ code, severity })),
    [
      { code: 'critical_journey_failed', severity: 'critical' },
      { code: 'payment_integrity_event', severity: 'critical' },
      { code: 'payment_configuration_failure', severity: 'critical' },
      { code: 'security_notification_failure', severity: 'high' },
      { code: 'server_failure_cluster', severity: 'high' },
      { code: 'auth_abuse_cluster', severity: 'high' },
      { code: 'poor_web_vital_cluster', severity: 'warning' },
    ],
  );
  assert.doesNotMatch(
    JSON.stringify(snapshot),
    /private|customer@example|deal_id|provider_request|target_url|message|secret/i,
  );
});

test('operational alert windows reject invalid or unbounded input', () => {
  const metadata = {
    schema: 'dealivra.monitoring-window.v1',
    environment: 'preview',
    release: 'unknown',
    window_started_at: '2026-07-30T12:00:00Z',
    window_minutes: 5,
  };
  assert.equal(
    buildOperationalSnapshot({ ...metadata, extra: true }, []),
    null,
  );
  assert.equal(
    buildOperationalSnapshot({ ...metadata, environment: 'customer' }, []),
    null,
  );
  assert.equal(
    buildOperationalSnapshot({ ...metadata, window_minutes: 60 }, []),
    null,
  );
  assert.equal(
    buildOperationalSnapshot(metadata, Array(10_001).fill(null)),
    null,
  );

  const source = readText('server/monitoring/operationalAlertPolicy.mjs');
  assert.match(source, /maximumRecordsPerWindow = 10_000/);
  assert.match(source, /dealivra\.operational-alert\.v1/);
  assert.match(source, /freeze_financial_action_and_page_payment_owner/);
  assert.doesNotMatch(
    source,
    /console\.|fetch\(|releasePayment|refundPayment|retryPayment|request\.headers/i,
  );
});

test('incident control freezes critical releases and enforces ordered recovery', () => {
  const declaration = {
    schema: 'dealivra.incident-declaration.v1',
    incident_id: 'INC-TEST0001',
    severity: 'critical',
    category: 'payment_integrity',
    public_impact: true,
    declared_at: '2026-07-30T12:00:00Z',
  };
  let incident = declareIncident(declaration);
  assert.ok(incident);
  assert.equal(incident.status, 'declared');
  assert.equal(incident.release_gate, 'frozen');
  assert.equal(incident.financial_safety, 'frozen');
  assert.equal(incident.evidence_preservation, 'required');
  assert.equal(incident.status_communication, 'draft_required');

  assert.equal(
    transitionIncident(incident, {
      schema: 'dealivra.incident-transition.v1',
      action: 'resolve',
      occurred_at: '2026-07-30T12:01:00Z',
    }),
    null,
  );
  assert.equal(
    transitionIncident(incident, {
      schema: 'dealivra.incident-transition.v1',
      action: 'triage',
      occurred_at: '2026-07-30T11:59:00Z',
    }),
    null,
  );

  for (const [action, occurredAt, status] of [
    ['triage', '2026-07-30T12:02:00Z', 'triaged'],
    ['contain', '2026-07-30T12:05:00Z', 'contained'],
    ['monitor', '2026-07-30T12:10:00Z', 'monitoring'],
    ['resolve', '2026-07-30T12:30:00Z', 'resolved'],
  ]) {
    incident = transitionIncident(incident, {
      schema: 'dealivra.incident-transition.v1',
      action,
      occurred_at: occurredAt,
    });
    assert.ok(incident);
    assert.equal(incident.status, status);
  }

  assert.equal(incident.release_gate, 'frozen');
  assert.equal(incident.financial_safety, 'frozen');
  assert.equal(incident.evidence_preservation, 'active');
  assert.equal(incident.status_communication, 'final_update_required');
  const publicDraft = incidentPublicTemplate(incident);
  assert.deepEqual(publicDraft, {
    schema: 'dealivra.status-draft.v1',
    incident_id: declaration.incident_id,
    status: 'resolved',
    message: 'This incident is resolved. We continue our internal review.',
    publication: 'requires_authorized_review',
  });
  assert.doesNotMatch(
    JSON.stringify(publicDraft),
    /payment|provider|customer|account|evidence|cause/i,
  );
});

test('incident evidence keeps hashes and excludes raw material', () => {
  const incident = declareIncident({
    schema: 'dealivra.incident-declaration.v1',
    incident_id: 'INC-TEST0002',
    severity: 'high',
    category: 'privacy',
    public_impact: false,
    declared_at: '2026-07-30T13:00:00Z',
  });
  assert.ok(incident);
  assert.equal(incidentPublicTemplate(incident), null);

  const manifest = buildIncidentEvidenceManifest(incident, [
    {
      schema: 'dealivra.incident-evidence.v1',
      kind: 'log_snapshot',
      sha256: 'b'.repeat(64),
      collected_at: '2026-07-30T13:01:00Z',
    },
    {
      schema: 'dealivra.incident-evidence.v1',
      kind: 'deployment',
      sha256: 'c'.repeat(64),
      collected_at: '2026-07-30T13:02:00Z',
    },
  ]);
  assert.ok(manifest);
  assert.equal(manifest.raw_content_included, false);
  assert.equal(manifest.entries.length, 2);
  assert.equal(
    buildIncidentEvidenceManifest(incident, [{
      schema: 'dealivra.incident-evidence.v1',
      kind: 'log_snapshot',
      sha256: 'b'.repeat(64),
      collected_at: '2026-07-30T13:01:00Z',
      raw_log: 'customer@example.test private error',
    }]),
    null,
  );
  assert.equal(
    buildIncidentEvidenceManifest(incident, Array(101).fill({})),
    null,
  );
});

test('incident drill is a local no-network release gate', () => {
  const packageJson = readJson('package.json');
  const policy = readText('server/monitoring/incidentControl.mjs');
  const drill = readText('scripts/run-incident-control-drill.mjs');

  assert.equal(
    packageJson.scripts['incident:drill'],
    'node scripts/run-incident-control-drill.mjs',
  );
  assert.match(packageJson.scripts.verify, /npm run incident:drill/);
  assert.match(policy, /publication: 'requires_authorized_review'/);
  assert.match(policy, /raw_content_included: false/);
  assert.match(drill, /release_gate, 'frozen'/);
  assert.match(drill, /dealivra\.incident-drill-result\.v1/);
  assert.doesNotMatch(
    `${policy}\n${drill}`,
    /fetch\(|https?:\/\/|console\.(?:warn|error)|writeFile|unlink|supabase|stripe/i,
  );
});

test('application services are split into a cycle-safe bounded chunk', () => {
  const packageJson = readJson('package.json');
  const viteConfig = readText('vite.config.ts');
  const budgetGate = readText('scripts/verify-build-budgets.mjs');

  assert.match(packageJson.scripts.dev, /--configLoader native/);
  assert.match(packageJson.scripts.build, /vite build --configLoader native/);
  assert.match(packageJson.scripts.preview, /--configLoader native/);
  assert.match(readText('scripts/smoke-preview.mjs'), /configLoader: 'native'/);
  assert.match(viteConfig, /name: 'deal-services'/);
  assert.match(viteConfig, /test: \/src\[\\\\\/\]services\[\\\\\/\]\//);
  assert.match(viteConfig, /includeDependenciesRecursively: true/);
  assert.doesNotMatch(viteConfig, /includeDependenciesRecursively: false/);
  assert.match(viteConfig, /maxSize: 400_000/);
  assert.match(budgetGate, /maximumJavaScriptChunkBytes: 400_000/);
  assert.doesNotMatch(
    `${viteConfig}\n${packageJson.scripts.build}`,
    /chunkSizeWarningLimit|manualChunks|--logLevel silent/,
  );
});

test('sample and local fallback deal identifiers satisfy every public boundary', () => {
  const main = readText('src/main.tsx');
  const demoRepository = readText('src/services/demoRepository.ts');

  assert.match(main, /const demoDealPath = '\/\?deal=DV7K4M2Q'/);
  assert.match(demoRepository, /DEMO_DEAL_PUBLIC_ID = 'DV7K4M2Q'/);
  assert.match(demoRepository, /publicId: `DV\$\{Math\.random\(\)/);
  assert.doesNotMatch(`${main}\n${demoRepository}`, /DV-/);
});

test('served asset manifest is deterministic, bounded, and hash-only', () => {
  const contents = new Map([
    ['assets/app.css', Buffer.from('body{}')],
    ['assets/app.js', Buffer.from('console.log("app")')],
    ['index.html', Buffer.from('<div id="root"></div>')],
    ['sw.js', Buffer.from('self.addEventListener("fetch",()=>{})')],
  ]);
  const files = [...contents.entries()].map(([path, bytes]) => ({
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
  }));
  const manifest = buildServedAssetManifest({
    schema: 'dealivra.served-asset-manifest.v1',
    source_commit: 'a'.repeat(40),
    files,
  });

  assert.ok(manifest);
  assert.deepEqual(validateServedAssetManifest(manifest), manifest);
  assert.equal(manifest.asset_count, files.length);
  assert.equal(
    manifest.total_bytes,
    files.reduce((total, file) => total + file.bytes, 0),
  );
  assert.equal(manifest.content_exposure, 'hashes_only');
  assert.doesNotMatch(JSON.stringify(manifest), /console\.log|<div|fetch|token/i);
  assert.equal(
    compareServedAsset(files[0], new Uint8Array(contents.get(files[0].path))).matches,
    true,
  );
  assert.equal(
    compareServedAsset(files[0], new Uint8Array(Buffer.from('changed'))).matches,
    false,
  );
  assert.equal(
    buildServedAssetManifest({
      schema: 'dealivra.served-asset-manifest.v1',
      source_commit: 'a'.repeat(40),
      files: [...files].reverse(),
    }),
    null,
  );
  assert.equal(
    buildServedAssetManifest({
      schema: 'dealivra.served-asset-manifest.v1',
      source_commit: 'a'.repeat(40),
      files: files.map(file => (
        file.path === 'index.html'
          ? { ...file, path: '../index.html' }
          : file
      )),
    }),
    null,
  );
  assert.equal(
    validateServedAssetManifest({ ...manifest, environment: 'Production' }),
    null,
  );
});

test('served asset verification keeps redirects and protection secrets on exact approved hosts', () => {
  const allowedHosts = parseAllowedDeploymentHosts(
    'preview.example.com,production.example.com',
  );
  assert.deepEqual(
    allowedHosts,
    ['preview.example.com', 'production.example.com'],
  );
  assert.equal(
    normalizeDeploymentOrigin('https://preview.example.com', allowedHosts),
    'https://preview.example.com',
  );
  assert.equal(
    normalizeDeploymentOrigin('https://untrusted.example.com', allowedHosts),
    null,
  );
  assert.equal(
    normalizeDeploymentOrigin('https://preview.example.com/path', allowedHosts),
    null,
  );
  assert.equal(
    normalizeDeploymentOrigin('http://preview.example.com', allowedHosts),
    null,
  );
  assert.equal(
    normalizeDeploymentOrigin(
      'http://127.0.0.1:4175',
      [],
      { allowLocalPreview: true },
    ),
    'http://127.0.0.1:4175',
  );
  assert.equal(
    servedAssetUrl('https://preview.example.com', 'assets/app.js'),
    'https://preview.example.com/assets/app.js',
  );
  assert.equal(
    servedAssetUrl('https://preview.example.com', '../private'),
    null,
  );

  const packageJson = readJson('package.json');
  const workflow = readText('.github/workflows/served-asset-integrity.yml');
  const generator = readText('scripts/create-served-asset-manifest.mjs');
  const verifier = readText('scripts/verify-served-assets.mjs');
  const smoke = readText('scripts/smoke-preview.mjs');
  const vercel = readText('vercel.json');

  assert.equal(
    packageJson.scripts['release:served-manifest'],
    'node scripts/create-served-asset-manifest.mjs',
  );
  assert.equal(
    packageJson.scripts['release:served-verify'],
    'node scripts/verify-served-assets.mjs',
  );
  assert.match(
    packageJson.scripts.build,
    /vite build --configLoader native && npm run release:served-manifest && npm run performance:budgets$/,
  );
  assert.match(generator, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(generator, /GITHUB_SHA/);
  assert.match(generator, /relative\(distRoot, path\)/);
  assert.match(verifier, /redirect: 'manual'/);
  assert.match(verifier, /DEALIVRA_ALLOWED_DEPLOYMENT_HOSTS/);
  assert.match(verifier, /x-vercel-protection-bypass/);
  assert.match(verifier, /manifest\.source_commit !== expectedCommit/);
  assert.match(verifier, /comparison\?\.matches/);
  assert.match(smoke, /validateServedAssetManifest/);
  assert.match(smoke, /compareServedAsset/);
  assert.match(workflow, /vars\.DEALIVRA_SERVED_ASSET_VERIFICATION_ENABLED == 'enabled'/);
  assert.match(workflow, /ref: main/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{/);
  assert.match(vercel, /\/dealivra-asset-manifest\.json/);
  assert.doesNotMatch(
    `${generator}\n${verifier}`,
    /console\.log\([^)]*(?:BYPASS|TOKEN)|process\.env\[[^\]]+\]|shell:\s*true/i,
  );
});

test('release evidence binds a clean exact commit to bounded file hashes', () => {
  const requiredPaths = [
    '.github/CODEOWNERS',
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/served-asset-integrity.yml',
    '.nvmrc',
    'catalog/active-release.json',
    'docs/production-readiness/11_LEGACY_IDENTIFIER_REGISTER.md',
    'docs/production-readiness/73_SERVED_ASSET_INTEGRITY.md',
    'dist/assets/app.css',
    'dist/assets/app.js',
    'dist/dealivra-asset-manifest.json',
    'dist/index.html',
    'package-lock.json',
    'package.json',
    'release-evidence/dependency-sbom.cdx.json',
    'scripts/create-dependency-sbom.mjs',
    'scripts/create-release-evidence.mjs',
    'scripts/create-served-asset-manifest.mjs',
    'scripts/scan-repository-secrets.mjs',
    'scripts/verify-browser-storage-policy.mjs',
    'scripts/verify-build-budgets.mjs',
    'scripts/verify-dependency-policy.mjs',
    'scripts/verify-outbound-transport-policy.mjs',
    'scripts/verify-runtime-configuration.mjs',
    'scripts/verify-served-assets.mjs',
    'scripts/verify-legacy-identifiers.mjs',
    'server/dependencySbomPolicy.mjs',
    'server/legacyIdentifierPolicy.mjs',
    'server/releaseEvidencePolicy.mjs',
    'server/runtimeConfigurationPolicy.mjs',
    'server/servedAssetIntegrityPolicy.mjs',
    'src/catalog.v1.json',
    'vercel.json',
    'vite.config.ts',
  ];
  const files = requiredPaths
    .map((path, index) => ({
      path,
      sha256: (index % 10).toString().repeat(64),
      bytes: index + 1,
    }))
    .sort((left, right) => (
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    ));
  const input = {
    schema: 'dealivra.release-evidence.v1',
    commit: 'a'.repeat(40),
    node: '24.x',
    catalog_version: '2026-07-29.1',
    checks: [...requiredReleaseChecks],
    files,
  };
  const evidence = buildReleaseEvidence(input);

  assert.ok(evidence);
  assert.equal(evidence.commit, input.commit);
  assert.equal(evidence.source_tree, 'clean');
  assert.equal(evidence.network_access, 'not_required');
  assert.equal(evidence.production_authorization, 'not_granted');
  assert.equal(
    evidence.total_bytes,
    files.reduce((total, file) => total + file.bytes, 0),
  );
  assert.doesNotMatch(
    JSON.stringify(evidence),
    /customer@example|bearer\s|sk_(?:live|test)|token_value|[A-Z]:\\|absolute_path|environment_variable/i,
  );

  assert.equal(
    buildReleaseEvidence({ ...input, checks: input.checks.slice(1) }),
    null,
  );
  assert.equal(
    buildReleaseEvidence({ ...input, files: [...files].reverse() }),
    null,
  );
  assert.equal(
    buildReleaseEvidence({
      ...input,
      files: files.map(file => (
        file.path === 'package.json'
          ? { ...file, path: '../package.json' }
          : file
      )).sort((left, right) => (
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0
      )),
    }),
    null,
  );
  assert.equal(
    buildReleaseEvidence({
      ...input,
      files: files.map(file => (
        file.path === 'package.json'
          ? { ...file, content: 'private' }
          : file
      )),
    }),
    null,
  );
});

test('CI release evidence is exact-commit, clean-tree, and retained', () => {
  const packageJson = readJson('package.json');
  const workflow = readText('.github/workflows/ci.yml');
  const script = readText('scripts/create-release-evidence.mjs');
  const policy = readText('server/releaseEvidencePolicy.mjs');
  const ignore = readText('.gitignore');

  assert.equal(
    packageJson.scripts['release:evidence'],
    'node scripts/create-release-evidence.mjs',
  );
  assert.equal(
    packageJson.scripts['release:sbom'],
    'node scripts/create-dependency-sbom.mjs',
  );
  assert.match(
    workflow,
    /npm audit --audit-level=high[\s\S]+npm run release:sbom[\s\S]+npm run release:evidence/,
  );
  assert.match(workflow, /DEALIVRA_RELEASE_COMMIT: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.match(workflow, /retention-days: 30/);
  assert.match(script, /git\(\['rev-parse', 'HEAD'\]\)/);
  assert.match(script, /git\(\['status', '--porcelain=v1', '--untracked-files=all'\]\)/);
  assert.match(script, /workflowCommit !== requestedCommit/);
  assert.match(script, /createHash\('sha256'\)/);
  assert.match(policy, /production_authorization: 'not_granted'/);
  assert.match(policy, /'browser_storage_policy_passed'/);
  assert.match(policy, /'outbound_transport_policy_passed'/);
  assert.match(policy, /'legacy_identifier_policy_passed'/);
  assert.match(policy, /'runtime_configuration_contract_passed'/);
  assert.match(policy, /'dependency_sbom_created'/);
  assert.match(policy, /'served_asset_manifest_created'/);
  assert.match(script, /'release-evidence\/dependency-sbom\.cdx\.json'/);
  assert.match(script, /'scripts\/create-dependency-sbom\.mjs'/);
  assert.match(script, /'server\/dependencySbomPolicy\.mjs'/);
  assert.match(script, /'scripts\/verify-browser-storage-policy\.mjs'/);
  assert.match(script, /'scripts\/verify-outbound-transport-policy\.mjs'/);
  assert.match(script, /'scripts\/verify-runtime-configuration\.mjs'/);
  assert.match(script, /'server\/runtimeConfigurationPolicy\.mjs'/);
  assert.match(script, /'scripts\/create-served-asset-manifest\.mjs'/);
  assert.match(script, /'scripts\/verify-served-assets\.mjs'/);
  assert.match(script, /'server\/servedAssetIntegrityPolicy\.mjs'/);
  assert.match(ignore, /^release-evidence\/$/m);
  assert.doesNotMatch(
    `${script}\n${policy}`,
    /fetch\(|https?:\/\/|process\.env\[[^\]]+\]|console\.(?:warn|error)|shell:\s*true/i,
  );
});

test('locked dependencies follow the reviewed offline supply-chain policy', () => {
  const packageJson = readJson('package.json');
  const policy = readText('scripts/verify-dependency-policy.mjs');
  const evidencePolicy = readText('server/releaseEvidencePolicy.mjs');

  assert.equal(
    packageJson.scripts['dependency:policy'],
    'node scripts/verify-dependency-policy.mjs',
  );
  assert.match(
    packageJson.scripts.verify,
    /catalog:verify && npm run dependency:policy && npm run release:sbom && npm run security:browser-storage && npm run security:transport && npm run security:mutation-origins && npm run brand:verify && npm run config:verify && npm run format:check && npm run lint && npm run typecheck/,
  );
  assert.match(policy, /lockfile\.lockfileVersion !== 3/);
  assert.match(policy, /url\.protocol === 'https:'/);
  assert.match(policy, /url\.hostname === 'registry\.npmjs\.org'/);
  assert.match(policy, /Buffer\.from\(encoded, 'base64'\)\.length === 64/);
  assert.match(policy, /maximumLockedPackages = 150/);
  assert.match(policy, /'MPL-2\.0'/);
  assert.match(policy, /\['node_modules\/fsevents', '2\.3\.3'\]/);
  assert.match(policy, /record\.dev !== true/);
  assert.match(policy, /record\.optional !== true/);
  assert.match(evidencePolicy, /'dependency_policy_passed'/);
  assert.doesNotMatch(
    policy,
    /fetch\(|https?:\/\/(?!registry\.npmjs\.org)|node:child_process|writeFile|shell:\s*true/i,
  );
});

test('CycloneDX dependency inventory is deterministic, bounded, and private', () => {
  const packageJson = readJson('package.json');
  const lockfile = readJson('package-lock.json');
  const sbom = buildDependencySbom(packageJson, lockfile);
  const reversedLockfile = {
    ...lockfile,
    packages: Object.fromEntries(Object.entries(lockfile.packages).reverse()),
  };
  const reversedSbom = buildDependencySbom(packageJson, reversedLockfile);
  const serialized = serializeDependencySbom(sbom);

  assert.ok(sbom);
  assert.ok(serialized);
  assert.equal(sbom.bomFormat, 'CycloneDX');
  assert.equal(sbom.specVersion, '1.5');
  assert.match(
    sbom.serialNumber,
    /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.equal(sbom.metadata.component.name, packageJson.name);
  assert.equal(Object.hasOwn(sbom.metadata, 'timestamp'), false);
  assert.equal(
    sbom.components.length,
    Object.keys(lockfile.packages).length - 1,
  );
  assert.equal(sbom.dependencies.length, sbom.components.length + 1);
  assert.equal(serialized, serializeDependencySbom(reversedSbom));
  assert.equal(
    createHash('sha256').update(serialized).digest('hex'),
    createHash('sha256')
      .update(serializeDependencySbom(buildDependencySbom(packageJson, lockfile)))
      .digest('hex'),
  );
  assert.ok(sbom.components.every(component => (
    component.hashes[0].alg === 'SHA-512'
    && /^[0-9a-f]{128}$/.test(component.hashes[0].content)
    && component.externalReferences[0].url.startsWith('https://registry.npmjs.org/')
  )));
  assert.deepEqual(
    sbom.components.find(component => component.name === '@biomejs/biome')?.licenses,
    [{ expression: 'MIT OR Apache-2.0' }],
  );
  assert.doesNotMatch(
    serialized,
    /customer@example|bearer\s|sk_(?:live|test)|token_value|[A-Z]:\\|absolute_path|environment_variable/i,
  );

  const tamperedIntegrity = structuredClone(lockfile);
  const firstPackagePath = Object.keys(tamperedIntegrity.packages)
    .find(path => path !== '');
  tamperedIntegrity.packages[firstPackagePath].integrity = 'sha512-invalid';
  assert.equal(buildDependencySbom(packageJson, tamperedIntegrity), null);

  const duplicateComponent = structuredClone(lockfile);
  duplicateComponent.packages['node_modules/react/node_modules/lucide-react'] = {
    ...duplicateComponent.packages['node_modules/lucide-react'],
  };
  assert.equal(buildDependencySbom(packageJson, duplicateComponent), null);
  assert.equal(serializeDependencySbom({ ...sbom, extra: true }), null);
});

test('CodeQL findings and dependency controls have scoped ownership and SLAs', () => {
  const workflow = readText('.github/workflows/codeql.yml');
  const owners = readText('.github/CODEOWNERS');
  const governance = readText(
    'docs/production-readiness/72_STATIC_ANALYSIS_AND_SBOM_GOVERNANCE.md',
  );

  assert.match(workflow, /pull_request:[\s\S]+branches:[\s\S]+- main/);
  assert.match(workflow, /schedule:[\s\S]+cron:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /packages: read/);
  assert.match(workflow, /security-events: write/);
  assert.match(workflow, /github\/codeql-action\/init@v4/);
  assert.match(workflow, /languages: javascript-typescript/);
  assert.match(workflow, /build-mode: none/);
  assert.match(workflow, /queries: security-extended/);
  assert.match(workflow, /github\/codeql-action\/analyze@v4/);
  assert.doesNotMatch(workflow, /pull_request_target|secrets\.|permissions:\s*write-all/);

  for (const path of [
    '/.github/workflows/codeql.yml',
    '/package-lock.json',
    '/scripts/create-dependency-sbom.mjs',
    '/server/dependencySbomPolicy.mjs',
  ]) {
    assert.match(owners, new RegExp(
      `${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} @nikamelikishvili-hue`,
    ));
  }
  assert.match(governance, /Critical SAST\/dependency finding[\s\S]+3 calendar days/);
  assert.match(governance, /High SAST\/dependency finding[\s\S]+7 calendar days/);
  assert.match(governance, /Before a paid beta, a second independent security reviewer/);
  assert.match(governance, /expiry no later than 30 days/);
  assert.match(
    governance,
    /does not falsely claim that a\s+parallel CodeQL run passed/,
  );
});

test('service worker caches only immutable public build assets', () => {
  const serviceWorker = readText('public/sw.js');
  const main = readText('src/main.tsx');
  const vercel = readJson('vercel.json');
  const rootHeaders = vercel.headers.find(entry => entry.source === '/')?.headers ?? [];
  const indexHeaders = vercel.headers.find(entry => entry.source === '/index.html')?.headers ?? [];
  const serviceWorkerHeaders = vercel.headers.find(entry => entry.source === '/sw.js')?.headers ?? [];

  assert.match(serviceWorker, /IMMUTABLE_ASSET_PATH/);
  assert.match(serviceWorker, /request\.method !== 'GET'/);
  assert.match(serviceWorker, /url\.origin === self\.location\.origin/);
  assert.match(serviceWorker, /url\.search === ''/);
  assert.match(serviceWorker, /response\.type !== 'basic'/);
  assert.match(serviceWorker, /name\.startsWith\('dealivra-'\)/);
  assert.match(serviceWorker, /name\.startsWith\('dealsafe-'\)/);
  assert.doesNotMatch(serviceWorker, /cache\.addAll|cache\.put\(\s*['"`]\/['"`]/);
  assert.doesNotMatch(serviceWorker, /mode\s*===\s*['"]navigate|caches\.match\(\s*['"`]\/['"`]/);
  assert.match(main, /register\('\/sw\.js', \{ updateViaCache: 'none' \}\)/);
  assert.match(main, /registration => registration\.update\(\)/);
  for (const headers of [rootHeaders, indexHeaders, serviceWorkerHeaders]) {
    assert.ok(headers.some(header => (
      header.key === 'Cache-Control'
      && header.value === 'no-cache, no-store, must-revalidate'
    )));
  }
});

test('payment provider mutations have independent default-off Sandbox gates', async () => {
  const {
    paymentCapabilityDecision,
    paymentCapabilityEnvironment,
  } = await import('../supabase/functions/_shared/payment-mode.ts');
  const values = new Map();
  const readEnvironment = name => values.get(name);
  const capabilities = [
    'seller_onboarding',
    'checkout',
    'payout_release',
    'refund',
  ];

  assert.deepEqual(Object.keys(paymentCapabilityEnvironment), capabilities);
  for (const capability of capabilities) {
    assert.deepEqual(paymentCapabilityDecision(capability, readEnvironment), {
      allowed: false,
      capability,
      mode: 'disabled',
      code: 'payment_capability_disabled',
    });

    const variable = paymentCapabilityEnvironment[capability];
    values.set(variable, 'sandbox');
    assert.deepEqual(paymentCapabilityDecision(capability, readEnvironment), {
      allowed: true,
      capability,
      mode: 'sandbox',
      code: null,
    });

    for (const invalid of ['SANDBOX', 'production', 'live', 'enabled', 'true']) {
      values.set(variable, invalid);
      assert.deepEqual(paymentCapabilityDecision(capability, readEnvironment), {
        allowed: false,
        capability,
        mode: 'invalid',
        code: 'payment_configuration_invalid',
      });
    }
    values.delete(variable);
  }

  const common = readText('supabase/functions/_shared/common.ts');
  const connect = readText('supabase/functions/stripe-connect/index.ts');
  const checkout = readText('supabase/functions/stripe-create-checkout/index.ts');
  const release = readText('supabase/functions/stripe-release-payment/index.ts');
  const dispute = readText('supabase/functions/stripe-resolve-dispute/index.ts');
  const webhook = readText('supabase/functions/stripe-webhook/index.ts');
  const environment = readText('.env.example');

  assert.match(common, /paymentCapabilityDecision\(\s*capability/);
  assert.match(common, /decision\.mode === "disabled"/);
  assert.match(common, /decision\.code \|\| "payment_configuration_invalid"/);
  assert.match(connect, /body\.action === "onboard"[\s\S]*requireSandboxPaymentCapability\("seller_onboarding"\)/);
  assert.match(connect, /account\.id !== accountId[\s\S]*account\.livemode === true/);
  assert.match(connect, /!stripeAccountPattern\.test\(account\.id\) \|\| account\.livemode === true/);
  assert.match(checkout, /requireSandboxPaymentCapability\("checkout"\)[\s\S]*DEALIVRA_PLATFORM_FEE_BPS/);
  assert.match(release, /requireSandboxPaymentCapability\("payout_release"\)[\s\S]*prepare_stripe_financial_command/);
  assert.match(dispute, /requireSandboxPaymentCapability\(\s*action === "refund" \? "refund" : "payout_release"/);
  assert.doesNotMatch(webhook, /requireSandboxPaymentCapability/);
  for (const variable of Object.values(paymentCapabilityEnvironment)) {
    assert.match(environment, new RegExp(`^${variable}=disabled$`, 'm'));
  }
});

test('payment request bodies are bounded before database or provider work', async () => {
  const {
    PaymentJsonBoundaryError,
    readBoundedPaymentJson,
  } = await import('../supabase/functions/_shared/payment-json-boundary.ts');
  const makeRequest = (
    body,
    headers = { 'content-type': 'application/json' },
  ) => new Request('https://dealivra.test/payment', {
    method: 'POST',
    headers,
    body,
  });
  const expectBoundaryCode = code => error => (
    error instanceof PaymentJsonBoundaryError
    && error.code === code
    && error.message === 'Payment request body was rejected'
  );

  assert.deepEqual(
    await readBoundedPaymentJson(
      makeRequest('{"dealId":"deal-id"}'),
      ['dealId'],
    ),
    { dealId: 'deal-id' },
  );
  assert.deepEqual(
    await readBoundedPaymentJson(
      makeRequest(
        '{"action":"status"}',
        { 'content-type': 'application/json; charset=UTF-8' },
      ),
      ['action', 'dealPublicId'],
    ),
    { action: 'status' },
  );
  await assert.rejects(
    () => readBoundedPaymentJson(
      makeRequest('{}', { 'content-type': 'text/plain' }),
      ['dealId'],
    ),
    expectBoundaryCode('content_type_invalid'),
  );
  await assert.rejects(
    () => readBoundedPaymentJson(
      makeRequest('{}', {
        'content-type': 'application/json',
        'content-length': '999999',
      }),
      ['dealId'],
    ),
    expectBoundaryCode('body_too_large'),
  );
  await assert.rejects(
    () => readBoundedPaymentJson(
      makeRequest(`{"note":"${'😀'.repeat(2_100)}"}`),
      ['note'],
    ),
    expectBoundaryCode('body_too_large'),
  );
  for (const [body, code] of [
    ['', 'body_empty'],
    ['{', 'json_invalid'],
    ['null', 'shape_invalid'],
    ['[]', 'shape_invalid'],
    ['"deal-id"', 'shape_invalid'],
    ['{"dealId":"deal-id","unexpected":true}', 'shape_invalid'],
    ['{"__proto__":{"polluted":true}}', 'shape_invalid'],
  ]) {
    await assert.rejects(
      () => readBoundedPaymentJson(makeRequest(body), ['dealId']),
      error => (
        error instanceof PaymentJsonBoundaryError
        && [
          code,
          'content_type_invalid',
          'content_length_invalid',
          'body_too_large',
          'body_empty',
          'json_invalid',
          'shape_invalid',
        ].includes(error.code)
        && error.message === 'Payment request body was rejected'
      ),
    );
  }
  await assert.rejects(
    () => readBoundedPaymentJson(makeRequest('{}'), ['dealId', 'dealId']),
    /Payment JSON boundary configuration is invalid/,
  );

  const common = readText('supabase/functions/_shared/common.ts');
  const handlers = [
    readText('supabase/functions/stripe-connect/index.ts'),
    readText('supabase/functions/stripe-create-checkout/index.ts'),
    readText('supabase/functions/stripe-release-payment/index.ts'),
    readText('supabase/functions/stripe-resolve-dispute/index.ts'),
  ];
  const webhook = readText('supabase/functions/stripe-webhook/index.ts');

  assert.match(common, /readBoundedPaymentJson\(request, allowedKeys\)/);
  assert.match(common, /error instanceof PaymentJsonBoundaryError/);
  assert.match(common, /error\.code === "body_too_large" \? 413 : 400/);
  for (const handler of handlers) {
    assert.match(handler, /requireUser\(request\)[\s\S]*readPaymentJson/);
    assert.doesNotMatch(handler, /request\.json\(\)/);
  }
  assert.match(handlers[0], /readPaymentJson<[\s\S]*\["action", "dealPublicId"\]/);
  assert.match(handlers[1], /readPaymentJson<\{ dealId\?: string \}>\([\s\S]*\["dealId"\]/);
  assert.match(handlers[2], /readPaymentJson<\{ dealId\?: string \}>\([\s\S]*\["dealId"\]/);
  assert.match(handlers[3], /readPaymentJson<\{[\s\S]*\["disputeId", "decision", "note"\]/);
  assert.doesNotMatch(webhook, /readPaymentJson|readBoundedPaymentJson/);
  assert.match(webhook, /readBoundedRequestText\(request, maxWebhookBytes\)/);
  assert.doesNotMatch(webhook, /request\.text\(\)/);
});

test('payment and evidence request streams stop before unbounded body allocation', async () => {
  const {
    RequestBodyBoundaryError,
    readBoundedRequestText,
  } = await import('../supabase/functions/_shared/request-body-boundary.ts');
  const {
    EvidenceJsonBoundaryError,
    readBoundedEvidenceJson,
  } = await import('../supabase/functions/_shared/evidence-json-boundary.ts');
  const request = (body, headers = { 'content-type': 'application/json' }) =>
    new Request('https://dealivra.test/evidence', {
      method: 'POST',
      headers,
      body,
    });
  const evidenceActions = {
    'signed-url': ['action', 'evidenceId'],
    'request-upload': [
      'action',
      'claimedMimeType',
      'dealId',
      'evidenceType',
      'fileName',
      'fileSize',
      'uploaderRole',
    ],
  };
  const expectEvidenceCode = code => error => (
    error instanceof EvidenceJsonBoundaryError
    && error.code === code
    && error.message === 'Evidence request body was rejected'
  );

  assert.deepEqual(
    await readBoundedEvidenceJson(
      request('{"action":"signed-url","evidenceId":"record-id"}'),
      evidenceActions,
    ),
    { action: 'signed-url', evidenceId: 'record-id' },
  );
  await assert.rejects(
    () => readBoundedEvidenceJson(
      request('{"action":"signed-url","evidenceId":"record-id","extra":true}'),
      evidenceActions,
    ),
    expectEvidenceCode('shape_invalid'),
  );
  await assert.rejects(
    () => readBoundedEvidenceJson(
      request('{"action":"unreviewed"}'),
      evidenceActions,
    ),
    expectEvidenceCode('action_invalid'),
  );
  await assert.rejects(
    () => readBoundedEvidenceJson(
      request('{}', { 'content-type': 'text/plain' }),
      evidenceActions,
    ),
    expectEvidenceCode('content_type_invalid'),
  );
  await assert.rejects(
    () => readBoundedEvidenceJson(
      request(`{"action":"signed-url","evidenceId":"${'😀'.repeat(4_100)}"}`),
      evidenceActions,
    ),
    expectEvidenceCode('body_too_large'),
  );

  const oversizedStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(200));
      controller.enqueue(new Uint8Array(200));
      controller.close();
    },
  });
  const streamedRequest = new Request('https://dealivra.test/evidence', {
    method: 'POST',
    body: oversizedStream,
    duplex: 'half',
  });
  await assert.rejects(
    () => readBoundedRequestText(streamedRequest, 256),
    error => (
      error instanceof RequestBodyBoundaryError
      && error.code === 'body_too_large'
      && error.message === 'Request body was rejected'
    ),
  );

  const paymentBoundary = readText('supabase/functions/_shared/payment-json-boundary.ts');
  const evidenceFiles = readText('supabase/functions/evidence-files/index.ts');
  const evidenceMaintenance = readText('supabase/functions/evidence-maintenance/index.ts');
  assert.match(paymentBoundary, /readBoundedRequestText\(request, maximumBytes\)/);
  assert.doesNotMatch(paymentBoundary, /request\.text\(\)/);
  for (const handler of [evidenceFiles, evidenceMaintenance]) {
    assert.match(handler, /readBoundedEvidenceJson\(/);
    assert.doesNotMatch(handler, /request\.json\(\)/);
  }
  assert.match(
    evidenceFiles,
    /const body = await readEvidenceAction\(request\);[\s\S]*const user = await requireUser\(request\)/,
  );
  assert.match(
    evidenceMaintenance,
    /const body = await readMaintenanceAction<AdminAction>[\s\S]*const user = await requireUser\(request\)/,
  );
  assert.match(evidenceMaintenance, /scheduledActionKeys/);
});

test('evidence Storage downloads are exact-length streams before byte validation', async () => {
  const {
    BinaryBodyBoundaryError,
    readExactBinaryBody,
  } = await import('../supabase/functions/_shared/binary-body-boundary.ts');
  const exactBody = {
    size: 3,
    stream: () => new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    }),
  };
  assert.deepEqual(
    await readExactBinaryBody(exactBody, 3, 10),
    new Uint8Array([1, 2, 3]),
  );

  let cancelled = false;
  const dishonestBody = {
    size: 3,
    stream: () => new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4]));
      },
      cancel() {
        cancelled = true;
      },
    }),
  };
  await assert.rejects(
    () => readExactBinaryBody(dishonestBody, 3, 10),
    error => (
      error instanceof BinaryBodyBoundaryError
      && error.code === 'size_mismatch'
      && error.message === 'Binary body was rejected'
    ),
  );
  assert.equal(cancelled, true);
  await assert.rejects(
    () => readExactBinaryBody(new Blob([new Uint8Array([1, 2])]), 3, 10),
    error => error instanceof BinaryBodyBoundaryError && error.code === 'size_mismatch',
  );

  const evidenceFiles = readText('supabase/functions/evidence-files/index.ts');
  const evidenceMaintenance = readText('supabase/functions/evidence-maintenance/index.ts');
  for (const handler of [evidenceFiles, evidenceMaintenance]) {
    assert.match(handler, /readExactBinaryBody\(/);
    assert.doesNotMatch(handler, /file\.arrayBuffer\(\)/);
  }
  assert.match(
    evidenceFiles,
    /rejectIntake\(claimedIntake, "rejected", "file_size_mismatch"\)/,
  );
  assert.match(
    evidenceMaintenance,
    /observedSizeBytes = Number\.isSafeInteger\(file\.size\) \? file\.size : null/,
  );
});

test('Stripe transport responses are timed out and bounded before semantic use', async () => {
  const {
    StripeResponseBoundaryError,
    readBoundedStripeJson,
  } = await import('../supabase/functions/_shared/stripe-response-boundary.ts');
  const jsonResponse = (body, headers = {}) => new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
  const expectBoundaryCode = code => error => (
    error instanceof StripeResponseBoundaryError
    && error.code === code
    && error.message === 'Stripe response was rejected'
  );

  assert.deepEqual(
    await readBoundedStripeJson(jsonResponse('{"id":"acct_test"}')),
    { id: 'acct_test' },
  );
  assert.deepEqual(
    await readBoundedStripeJson(new Response('{"id":"pi_test"}', {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })),
    { id: 'pi_test' },
  );
  await assert.rejects(
    () => readBoundedStripeJson(new Response('{}', {
      headers: {
        'content-type': 'text/html',
      },
    })),
    expectBoundaryCode('content_type_invalid'),
  );
  await assert.rejects(
    () => readBoundedStripeJson(jsonResponse('{}', {
      'content-length': '999999',
    })),
    expectBoundaryCode('response_too_large'),
  );
  await assert.rejects(
    () => readBoundedStripeJson(jsonResponse(
      `{"value":"${'😀'.repeat(66_000)}"}`,
    )),
    expectBoundaryCode('response_too_large'),
  );
  for (const [body, code] of [
    ['', 'response_empty'],
    ['{', 'json_invalid'],
    ['null', 'shape_invalid'],
    ['[]', 'shape_invalid'],
    ['"provider-value"', 'shape_invalid'],
  ]) {
    await assert.rejects(
      () => readBoundedStripeJson(jsonResponse(body)),
      error => (
        error instanceof StripeResponseBoundaryError
        && [
          code,
          'content_type_invalid',
          'content_length_invalid',
          'response_too_large',
          'response_empty',
          'json_invalid',
          'shape_invalid',
        ].includes(error.code)
        && error.message === 'Stripe response was rejected'
      ),
    );
  }
  await assert.rejects(
    () => readBoundedStripeJson(jsonResponse('{}'), 263_000),
    /Stripe response boundary configuration is invalid/,
  );

  const common = readText('supabase/functions/_shared/common.ts');
  const observability = readText('supabase/functions/_shared/payment-observability.ts');
  const responseBoundary = readText('supabase/functions/_shared/stripe-response-boundary.ts');

  assert.match(common, /const stripeRequestTimeoutMs = 10_000/);
  assert.match(common, /signal: AbortSignal\.timeout\(stripeRequestTimeoutMs\)/);
  assert.match(common, /data = await readBoundedStripeJson\(response\)/);
  assert.match(common, /error\.name === "AbortError" \|\| error\.name === "TimeoutError"/);
  assert.match(common, /"provider_response_invalid"/);
  assert.doesNotMatch(common, /const data = await response\.json/);
  assert.doesNotMatch(observability, /provider\.message/);
  assert.match(responseBoundary, /readBoundedResponseText\(response, maximumBytes\)/);
  assert.doesNotMatch(responseBoundary, /response\.text\(\)/);
});

test('browser data responses are bounded before runtime-schema validation', async () => {
  const {
    BrowserResponseBoundaryError,
    fetchWithDeadline,
    readBoundedJson,
    readBoundedText,
    readExactArrayBuffer,
    readExactBlobArrayBuffer,
  } = await import('../src/services/browserResponseBoundary.ts');
  const jsonResponse = (body, headers = {}) => new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
  const expectBoundaryCode = code => error => (
    error instanceof BrowserResponseBoundaryError
    && error.code === code
    && error.message === 'Remote response was rejected'
  );

  assert.deepEqual(
    await readBoundedJson(jsonResponse('{"records":[{"id":"safe"}]}')),
    { records: [{ id: 'safe' }] },
  );
  assert.deepEqual(
    await readBoundedJson(new Response('[1,2]', {
      headers: { 'content-type': 'application/vnd.pgrst.array+json' },
    })),
    [1, 2],
  );
  assert.equal(await readBoundedJson(new Response(null, { status: 204 })), null);
  assert.equal(
    await readBoundedText(new Response('DEALIVRA_MFA_REQUIRED'), 64),
    'DEALIVRA_MFA_REQUIRED',
  );
  assert.deepEqual(
    new Uint8Array(await readExactArrayBuffer(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-length': '3' },
      }),
      3,
    )),
    new Uint8Array([1, 2, 3]),
  );
  assert.deepEqual(
    new Uint8Array(await readExactBlobArrayBuffer(
      new Blob([new Uint8Array([4, 5, 6])]),
      3,
    )),
    new Uint8Array([4, 5, 6]),
  );

  await assert.rejects(
    () => readBoundedJson(new Response('{}', {
      headers: { 'content-type': 'text/html' },
    })),
    expectBoundaryCode('content_type_invalid'),
  );
  await assert.rejects(
    () => readBoundedJson(jsonResponse('{}', {
      'content-length': 'not-a-number',
    })),
    expectBoundaryCode('content_length_invalid'),
  );
  await assert.rejects(
    () => readBoundedJson(jsonResponse('{}', {
      'content-length': '1048577',
    })),
    expectBoundaryCode('response_too_large'),
  );
  await assert.rejects(
    () => readBoundedJson(jsonResponse(`{"value":"${'😀'.repeat(300_000)}"}`)),
    expectBoundaryCode('response_too_large'),
  );
  await assert.rejects(
    () => readBoundedJson(jsonResponse('{')),
    expectBoundaryCode('json_invalid'),
  );
  await assert.rejects(
    () => readExactArrayBuffer(
      new Response(new Uint8Array([1, 2, 3, 4])),
      3,
    ),
    expectBoundaryCode('response_size_mismatch'),
  );
  await assert.rejects(
    () => readExactArrayBuffer(
      new Response(new Uint8Array([1, 2]), {
        headers: { 'content-length': '2' },
      }),
      3,
    ),
    expectBoundaryCode('response_size_mismatch'),
  );
  await assert.rejects(
    () => readExactArrayBuffer(new Response(new Uint8Array([1])), 52_428_801),
    /Browser binary boundary configuration is invalid/,
  );
  await assert.rejects(
    () => readExactBlobArrayBuffer(
      new Blob([new Uint8Array([1, 2, 3])]),
      2,
    ),
    expectBoundaryCode('response_size_mismatch'),
  );
  await assert.rejects(
    () => readBoundedJson(jsonResponse('{}'), 4_194_305),
    /Browser response boundary configuration is invalid/,
  );
  await assert.rejects(
    () => fetchWithDeadline('data:application/json,{}', {}, 120_001),
    /Browser request deadline configuration is invalid/,
  );

  const response = await fetchWithDeadline('data:application/json,%7B%22ok%22%3Atrue%7D');
  assert.deepEqual(await readBoundedJson(response), { ok: true });

  const client = readText('src/services/supabaseRest.ts');
  assert.match(client, /fetchWithDeadline\(/);
  assert.match(client, /readBoundedJson\(/);
  assert.match(client, /readBoundedText\(response\.clone\(\),16_384\)/);
  assert.match(client, /readExactArrayBuffer\(response,data\.fileSizeBytes\)/);
  assert.match(client, /readExactBlobArrayBuffer\(preparedFile,preparedFile\.size\)/);
  assert.doesNotMatch(client, /preparedFile\.arrayBuffer\(\)/);
  assert.doesNotMatch(client, /\.json\(\)/);
  assert.doesNotMatch(client, /clone\(\)\.text\(\)/);
  assert.doesNotMatch(client, /response\.arrayBuffer\(\)/);
  assert.doesNotMatch(
    client.replaceAll('fetchWithDeadline(', ''),
    /\bfetch\(/,
  );

  const catalogClient = readText('src/services/catalogService.ts');
  assert.match(catalogClient, /fetchWithDeadline\(`\/api\/catalog/);
  assert.match(catalogClient, /fetchWithDeadline\('\/api\/vehicles\/vin'/);
  assert.match(catalogClient, /validateCatalogResponse\(await readBoundedJson\(response\)/);
  assert.match(catalogClient, /await readBoundedJson\(response\) as Record<string, unknown>/);
  assert.match(catalogClient, /error\.name === 'AbortError' \|\| error\.name === 'TimeoutError'/);
  assert.doesNotMatch(catalogClient, /\.json\(\)/);
  assert.doesNotMatch(catalogClient, /\bnew AbortController\(/);
  assert.doesNotMatch(
    catalogClient.replaceAll('fetchWithDeadline(', ''),
    /\bfetch\(/,
  );
});

test('outbound transport inventory is deny-by-default and release-gated', async () => {
  const { verifyOutboundTransportPolicy } = await import(
    '../scripts/verify-outbound-transport-policy.mjs'
  );
  const result = verifyOutboundTransportPolicy(rootPath);
  const packageJson = readJson('package.json');
  const policy = readText('scripts/verify-outbound-transport-policy.mjs');

  assert.deepEqual(result, {
    schema: 'dealivra.outbound-transport-policy-result.v1',
    status: 'passed',
    direct_fetch_sites: 6,
    direct_fetch_calls: 8,
    injected_provider_sites: 1,
    delegated_diagnostic_sites: 3,
    bounded_provider_files: 9,
  });
  assert.equal(
    packageJson.scripts['security:transport'],
    'node scripts/verify-outbound-transport-policy.mjs',
  );
  assert.match(packageJson.scripts.verify, /npm run security:transport/);
  assert.match(policy, /unreviewed direct fetch/);
  assert.match(policy, /direct whole-body response parser/);
  assert.match(policy, /server\/vehicleVinShared\.mjs/);
  assert.match(policy, /supabase\/functions\/security-notifications\/index\.ts/);
});

test('browser diagnostics use one exact bounded best-effort transport', async () => {
  const {
    prepareDiagnosticRequest,
    sendBoundedDiagnostic,
  } = await import('../src/services/diagnosticTransport.ts');
  const transport = readText('src/services/diagnosticTransport.ts');
  const exactEvent = {
    schema: 'dealivra.client-failure.v1',
    boundary: 'application_render',
    issue: 'react_render_failed',
    occurrence_count: 1,
  };

  assert.deepEqual(
    prepareDiagnosticRequest('/api/security/client-failure', exactEvent),
    {
      endpoint: '/api/security/client-failure',
      body: JSON.stringify(exactEvent),
    },
  );
  const autocompleteFailure = {
    schema: 'dealivra.client-failure.v1',
    boundary: 'address_autocomplete',
    issue: 'provider_load_failed',
    occurrence_count: 1,
  };
  assert.deepEqual(
    prepareDiagnosticRequest(
      '/api/security/client-failure',
      autocompleteFailure,
    ),
    {
      endpoint: '/api/security/client-failure',
      body: JSON.stringify(autocompleteFailure),
    },
  );
  assert.equal(
    prepareDiagnosticRequest(
      '/api/security/client-failure',
      { value: 'x'.repeat(513) },
    ),
    null,
  );
  assert.equal(
    prepareDiagnosticRequest('/api/security/client-failure', {
      ...exactEvent,
      email: 'must-not-leave-browser@example.com',
    }),
    null,
  );
  assert.equal(
    prepareDiagnosticRequest('/api/security/client-failure', {
      ...exactEvent,
      boundary: 'browser_runtime',
    }),
    null,
  );
  assert.deepEqual(
    prepareDiagnosticRequest('/api/security/runtime-rejection', {
      schema: 'dealivra.auth.response-rejection.v1',
      boundary: 'provider_response',
      issue: 'invalid_shape',
      occurrence_count: 1,
    }),
    {
      endpoint: '/api/security/runtime-rejection',
      body: JSON.stringify({
        schema: 'dealivra.auth.response-rejection.v1',
        boundary: 'provider_response',
        issue: 'invalid_shape',
        occurrence_count: 1,
      }),
    },
  );
  assert.equal(
    prepareDiagnosticRequest('/api/security/web-vital', {
      schema: 'dealivra.web-vital.v1',
      metric: 'lcp',
      rating: 'good',
      bucket: 'over_4000',
      occurrence_count: 1,
    }),
    null,
  );
  assert.equal(
    prepareDiagnosticRequest('/api/security/not-reviewed', exactEvent),
    null,
  );
  assert.equal(
    sendBoundedDiagnostic('/api/security/client-failure', exactEvent),
    false,
  );
  assert.match(transport, /diagnosticTimeoutMs = 5_000/);
  assert.match(transport, /AbortSignal\.timeout\(diagnosticTimeoutMs\)/);
  assert.match(transport, /credentials: 'omit'/);
  assert.match(transport, /referrerPolicy: 'no-referrer'/);
  assert.match(transport, /keepalive: true/);
  assert.doesNotMatch(transport, /location\.|navigator\.|document\./);
});

test('guest deal drafts have a short exact browser-storage boundary', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealCreationWorkspace.tsx');

  assert.match(app, /guest-create-draft:v2/);
  assert.match(app, /legacyGuestCreateDraftKey='dealivra:guest-create-draft:v1'/);
  assert.match(app, /guestCreateDraftLifetime=24\*60\*60\*1000/);
  assert.match(app, /guestCreateDraftMaximumBytes=16\*1024/);
  assert.match(app, /new TextEncoder\(\)\.encode\(raw\)\.byteLength>guestCreateDraftMaximumBytes/);
  assert.match(app, /new TextEncoder\(\)\.encode\(serialized\)\.byteLength>guestCreateDraftMaximumBytes/);
  assert.match(app, /description:recovery\.draft\.description\.slice\(0,10_000\)/);
  assert.match(app, /serialNumber:''/);
  assert.doesNotMatch(app, /draft:\{\.\.\.draft,serialNumber:''\}/);
  assert.match(workspace, /id="create-item-description"[\s\S]{0,160}maxLength=\{10000\}/);
});

test('browser storage inventory is deny-by-default and release-gated', async () => {
  const { verifyBrowserStoragePolicy } = await import(
    '../scripts/verify-browser-storage-policy.mjs'
  );
  const packageJson = readJson('package.json');
  const result = verifyBrowserStoragePolicy(rootPath);

  assert.deepEqual(result, {
    schema: 'dealivra.browser-storage-policy-result.v1',
    status: 'passed',
    reviewed_files: 4,
    local_storage_calls: 14,
    session_storage_calls: 6,
  });
  assert.equal(
    packageJson.scripts['security:browser-storage'],
    'node scripts/verify-browser-storage-policy.mjs',
  );
  assert.match(packageJson.scripts.verify, /npm run security:browser-storage/);
});

test('staging database target guard rejects Production and mixed projects', async () => {
  const { verifyStagingDatabaseTarget } = await import(
    '../scripts/verify-staging-database-target.mjs'
  );
  const valid = {
    DEALIVRA_DATABASE_ENVIRONMENT: 'staging',
    DEALIVRA_STAGING_SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
    DEALIVRA_PRODUCTION_SUPABASE_PROJECT_REF: 'zyxwvutsrqponmlkjihg',
    DEALIVRA_STAGING_DATABASE_URL:
      'postgresql://postgres:secret@db.abcdefghijklmnopqrst.supabase.co/postgres?sslmode=require',
  };

  assert.deepEqual(verifyStagingDatabaseTarget(valid), {
    schema: 'dealivra.staging-database-target.v1',
    status: 'passed',
    environment: 'staging',
    project_separation: 'verified',
    direct_database_host: 'verified',
    tls: 'required',
  });
  assert.throws(
    () =>
      verifyStagingDatabaseTarget({
        ...valid,
        DEALIVRA_DATABASE_ENVIRONMENT: 'production',
      }),
    /must be exactly staging/,
  );
  assert.throws(
    () =>
      verifyStagingDatabaseTarget({
        ...valid,
        DEALIVRA_PRODUCTION_SUPABASE_PROJECT_REF:
          valid.DEALIVRA_STAGING_SUPABASE_PROJECT_REF,
      }),
    /must use different Supabase projects/,
  );
});

test('database authorization gate is manual-only and covers role isolation', () => {
  const packageJson = readJson('package.json');
  const workflow = readText('.github/workflows/staging-database-gate.yml');
  const migration = readText(
    'supabase/private_evidence_maintenance_settings_rls.sql',
  );
  const privateRegression = readText(
    'supabase/tests/private_evidence_maintenance_settings_rls_rollback.sql',
  );
  const databaseContract = readText(
    'supabase/tests/database_security_contract_rollback.sql',
  );
  const runbook = readText(
    'docs/production-readiness/74_STAGING_DATABASE_AUTHORIZATION_GATE.md',
  );

  assert.equal(
    packageJson.scripts['staging:database-target'],
    'node scripts/verify-staging-database-target.mjs',
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+push:/);
  assert.doesNotMatch(workflow, /\n\s+pull_request:/);
  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /DEALIVRA_PRODUCTION_SUPABASE_PROJECT_REF/);
  assert.match(workflow, /-name '\*_rollback\.sql'/);
  assert.match(workflow, /test "\$\{#tests\[@\]\}" -eq 17/);
  assert.match(workflow, /psql "\$DEALIVRA_STAGING_DATABASE_URL"/);
  assert.match(workflow, /-X[\s\S]*-v ON_ERROR_STOP=1/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table[\s\S]*service_role/i);
  assert.match(privateRegression, /relforcerowsecurity/);
  assert.match(privateRegression, /function_record\.prosecdef/);
  assert.match(
    databaseContract,
    /namespace\.nspname = 'public'[\s\S]*not class\.relrowsecurity/,
  );
  assert.match(
    databaseContract,
    /grant_row\.grantee in \('PUBLIC', 'anon', 'authenticated', 'service_role'\)/,
  );
  assert.match(runbook, /separate Supabase project for Staging/);
  assert.match(runbook, /Production, public access, live Supabase resources/);
});

test('database baseline inventory is timestamped, data-free, and hash-bound', () => {
  const valid = evaluateDatabaseBaseline([
    {
      name: '20260811000000_dealivra_staging_baseline.sql',
      content: 'create table public.example (id uuid primary key);\n',
    },
    {
      name: '20260811000001_enable_example_rls.sql',
      content: 'alter table public.example enable row level security;\n',
    },
  ]);
  assert.equal(valid.status, 'passed');
  assert.equal(valid.migration_count, 2);
  assert.match(valid.migrations[0].sha256, /^[a-f0-9]{64}$/);
  assert.throws(
    () => evaluateDatabaseBaseline([
      {
        name: '20260811000000_dealivra_staging_baseline.sql',
        content: "insert into auth.users (email) values ('person@example.com');",
      },
    ]),
    /Auth user data/,
  );
  assert.throws(
    () => evaluateDatabaseBaseline([
      {
        name: '20260811000000_wrong_baseline.sql',
        content: 'select 1;',
      },
    ]),
    /first migration must be the CLI-generated/,
  );
});

test('database baseline proof is manual, Staging-only, and rebuilds locally', () => {
  const packageJson = readJson('package.json');
  const workflow = readText('.github/workflows/staging-database-baseline-proof.yml');
  const runbook = readText(
    'docs/production-readiness/75_DATABASE_BASELINE_MIGRATION_PLAN.md',
  );

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+push:/);
  assert.doesNotMatch(workflow, /\n\s+pull_request:/);
  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /npm run staging:database-target/);
  assert.match(workflow, /version: 2\.101\.0/);
  assert.match(workflow, /supabase db pull dealivra_staging_baseline/);
  assert.match(workflow, /npm run database:baseline:verify/);
  assert.match(workflow, /supabase db reset --local/);
  assert.match(workflow, /test "\$\{#tests\[@\]\}" -eq 17/);
  assert.match(workflow, /supabase db advisors --local/);
  assert.match(workflow, /retention-days: 7/);
  assert.equal(
    packageJson.scripts['database:baseline:verify'],
    'node scripts/verify-database-baseline.mjs',
  );
  assert.match(runbook, /Production is not a baseline source or a test target/);
  assert.match(runbook, /Never dump Production\s+data/);
});

test('Staging HTTP matrix is status-only, cross-user, and cleans synthetic Storage', () => {
  const packageJson = readJson('package.json');
  const matrix = readText('scripts/run-staging-http-authorization-matrix.mjs');
  assert.equal(
    packageJson.scripts['staging:http-authorization'],
    'node scripts/run-staging-http-authorization-matrix.mjs',
  );
  assert.match(matrix, /get_deal_action_plan/);
  assert.match(matrix, /Data API outsider/);
  assert.match(matrix, /Data API expired/);
  assert.match(matrix, /Storage outsider cross-user upload/);
  assert.match(matrix, /Storage seller own upload/);
  assert.match(matrix, /Storage buyer own upload/);
  assert.match(matrix, /method: 'DELETE'/);
  assert.doesNotMatch(matrix, /results:[\s\S]{0,200}(?:token|subject|dealId|path)/i);
});

test('database ownership inventory covers every governed object class', () => {
  const inventorySql = readText('supabase/database_ownership_inventory.sql');
  const workflow = readText('.github/workflows/staging-database-gate.yml');
  const records = ['table', 'view', 'function', 'bucket', 'policy', 'grant'].map((kind, index) => ({
    schema: 'dealivra.database-ownership-object.v1',
    kind,
    identity: `public.synthetic_${index}`,
    owner_role: 'postgres',
    exposure: kind === 'bucket' ? 'private_object' : 'data_api_candidate',
    steward: kind === 'grant' || kind === 'policy' ? 'database_security' : 'platform_engineering',
  }));
  const result = validateDatabaseOwnershipInventory(records);
  assert.equal(result.status, 'passed');
  assert.equal(result.object_count, 6);
  assert.throws(
    () => validateDatabaseOwnershipInventory(records.map(record => ({ ...record, owner_role: 'authenticated' }))),
    /unsafe owner role/,
  );
  assert.match(inventorySql, /information_schema\.table_privileges/);
  assert.match(inventorySql, /information_schema\.routine_privileges/);
  assert.match(inventorySql, /from storage\.buckets/);
  assert.match(inventorySql, /from pg_catalog\.pg_policies/);
  assert.match(workflow, /database_ownership_inventory\.sql/);
  assert.match(workflow, /database:ownership:validate/);
});

test('media preview is keyboard-contained and respects dynamic mobile viewports', () => {
  const workspace = readText('src/DealWorkspaceFeatures.tsx');
  const styles = readText('src/media-zoom.css');

  assert.match(workspace, /role="dialog"/);
  assert.match(workspace, /aria-modal="true"/);
  assert.match(workspace, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(workspace, /event\.key === 'Escape'/);
  assert.match(workspace, /event\.key !== 'Tab'/);
  assert.match(workspace, /previouslyFocused\?\.focus\(\)/);
  assert.match(workspace, /ref=\{closeButtonRef\}/);
  assert.match(workspace, /<X aria-hidden="true" size=\{20\} \/>/);
  assert.match(workspace, /className="media-lightbox-content"/);
  assert.match(styles, /max-height:\s*90dvh/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /env\(safe-area-inset-right\)/);
});

test('deal comparison is keyboard-contained and uses the dynamic viewport', () => {
  const app = readText('src/app.tsx');
  const styles = readText('src/watchlist.css');

  assert.match(app, /ref=\{dialogRef\} className="compare-dialog"/);
  assert.match(app, /ref=\{closeButtonRef\}/);
  assert.match(app, /document\.body\.style\.overflow='hidden'/);
  assert.match(app, /event\.key==='Escape'/);
  assert.match(app, /event\.key!=='Tab'/);
  assert.match(app, /previouslyFocused\?\.focus\(\)/);
  assert.match(styles, /max-height:calc\(100dvh - 48px\)/);
  assert.match(styles, /overscroll-behavior:contain/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test('service worker runtime never intercepts private or mutable requests', async () => {
  const listeners = new Map();
  const cacheEntries = new Map();
  const openedCaches = [];
  const deletedCaches = [];
  const fetchedRequests = [];
  const workerOrigin = 'https://dealivra.example';
  const cache = {
    async match(request) {
      return cacheEntries.get(request.url);
    },
    async put(request, response) {
      cacheEntries.set(request.url, response);
    },
  };
  const context = {
    URL,
    Set,
    Promise,
    caches: {
      async open(name) {
        openedCaches.push(name);
        return cache;
      },
      async keys() {
        return ['dealivra-static-assets-v3', 'dealivra-shell-v2', 'unrelated-cache'];
      },
      async delete(name) {
        deletedCaches.push(name);
        return true;
      },
    },
    async fetch(request) {
      fetchedRequests.push(request.url);
      return {
        ok: true,
        status: 200,
        type: 'basic',
        headers: new Headers({ 'content-type': 'text/javascript' }),
        clone() {
          return this;
        },
      };
    },
    self: {
      location: { origin: workerOrigin },
      clients: { async claim() {} },
      async skipWaiting() {},
      addEventListener(type, handler) {
        listeners.set(type, handler);
      },
    },
  };
  vm.runInNewContext(readText('public/sw.js'), context, { filename: 'public/sw.js' });

  assert.deepEqual([...listeners.keys()].sort(), ['activate', 'fetch', 'install']);

  const privateRequests = [
    { method: 'GET', url: `${workerOrigin}/` },
    { method: 'GET', url: `${workerOrigin}/?deal=DV7K4M2Q` },
    { method: 'GET', url: `${workerOrigin}/api/auth/session` },
    { method: 'GET', url: `${workerOrigin}/assets/app.js?private=1` },
    { method: 'POST', url: `${workerOrigin}/assets/app.js` },
    { method: 'GET', url: 'https://cdn.example/assets/app.js' },
    { method: 'GET', url: `${workerOrigin}/uploads/evidence.jpg` },
  ];
  for (const request of privateRequests) {
    let responsePromise;
    listeners.get('fetch')({
      request,
      respondWith(value) {
        responsePromise = value;
      },
    });
    assert.equal(responsePromise, undefined, `unexpected interception: ${request.url}`);
  }
  assert.deepEqual(openedCaches, []);
  assert.deepEqual(fetchedRequests, []);

  const assetRequest = { method: 'GET', url: `${workerOrigin}/assets/app.A1b2.js` };
  let firstAssetResponse;
  listeners.get('fetch')({
    request: assetRequest,
    respondWith(value) {
      firstAssetResponse = value;
    },
  });
  await firstAssetResponse;
  assert.deepEqual(fetchedRequests, [assetRequest.url]);
  assert.equal(cacheEntries.has(assetRequest.url), true);

  let secondAssetResponse;
  listeners.get('fetch')({
    request: assetRequest,
    respondWith(value) {
      secondAssetResponse = value;
    },
  });
  await secondAssetResponse;
  assert.deepEqual(fetchedRequests, [assetRequest.url]);

  let activatePromise;
  listeners.get('activate')({
    waitUntil(value) {
      activatePromise = value;
    },
  });
  await activatePromise;
  assert.deepEqual(deletedCaches, ['dealivra-shell-v2']);
});

test('global motion preferences suppress nonessential animation and smooth scrolling', () => {
  const styles = readText('src/global-redesign.css');

  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /\*,\*::before,\*::after\{[^}]*animation-duration:\.01ms!important/);
  assert.match(styles, /\*,\*::before,\*::after\{[^}]*animation-iteration-count:1!important/);
  assert.match(styles, /\*,\*::before,\*::after\{[^}]*transition-duration:\.01ms!important/);
  assert.match(styles, /html\{scroll-behavior:auto\}/);
});

test('resolution mutations use same-tick single-flight guards', () => {
  const workspace = readText('src/DealResolutionWorkspace.tsx');

  assert.match(workspace, /const savingRef = useRef\(false\)/);
  assert.match(workspace, /if \(savingRef\.current\) return;[\s\S]*savingRef\.current = true/);
  assert.match(workspace, /if \(!mode \|\| savingRef\.current\) return;[\s\S]*savingRef\.current = true/);
  assert.match(workspace, /if \(!session \|\| sendingRef\.current \|\| details\.trim\(\)\.length < 10\) return/);
  assert.match(workspace, /if \(!body\.trim\(\) \|\| sendingRef\.current\) return/);
  assert.match(workspace, /aria-busy=\{sending\}/);
});

test('support case mutations use same-tick single-flight guards', () => {
  const workspace = readText('src/SupportCaseCenter.tsx');

  assert.match(workspace, /const savingRef = useRef\(false\)/);
  assert.match(workspace, /if \(savingRef\.current\) return;[\s\S]*savingRef\.current = true/);
  assert.match(workspace, /if \(!selected \|\| savingRef\.current\) return;[\s\S]*savingRef\.current = true/);
  assert.equal((workspace.match(/aria-busy=\{saving\}/g) ?? []).length, 2);
  assert.match(workspace, /const lifecycleRef = useRef\(0\)/);
  assert.ok((workspace.match(/lifecycle !== lifecycleRef\.current/g) ?? []).length >= 5);
  assert.ok((workspace.match(/lifecycle === lifecycleRef\.current/g) ?? []).length >= 2);
});

test('trust passport visibility is protected against duplicate mutations', () => {
  const workspace = readText('src/AccountProfileWorkspace.tsx');

  assert.match(workspace, /function TrustPassportControls/);
  assert.match(workspace, /const savingRef = useRef\(false\)/);
  assert.match(workspace, /if \(!settings \|\| savingRef\.current\) return;[\s\S]*savingRef\.current = true/);
  assert.match(workspace, /finally \{[\s\S]*savingRef\.current = false;[\s\S]*setSaving\(false\)/);
  assert.match(workspace, /aria-busy=\{saving\}/);
});

test('agreement verification and evidence uploads are single-flight', () => {
  const verification = readText('src/AgreementVerificationPage.tsx');
  const evidence = readText('src/DealEvidenceWorkspace.tsx');

  assert.match(verification, /const checkingRef = useRef\(false\)/);
  assert.match(verification, /if \(checkingRef\.current\) return/);
  assert.match(verification, /checkingRef\.current = true/);
  assert.match(evidence, /const busyRef = useRef\(false\)/);
  assert.match(evidence, /if \(!files\.length \|\| busyRef\.current\) return/);
  assert.match(evidence, /busyRef\.current = true/);
  assert.match(evidence, /aria-busy=\{busy\}/);
});

test('deal media and editor mutations use same-tick guards', () => {
  const workspace = readText('src/DealWorkspaceFeatures.tsx');

  assert.match(workspace, /const uploadingRef = useRef\(false\)/);
  assert.match(workspace, /if \(!files\.length \|\| uploadingRef\.current\) return/);
  assert.match(workspace, /const removingRef = useRef\(false\)/);
  assert.match(workspace, /if \(removingRef\.current\) return/);
  assert.match(workspace, /export function CoverSelector[\s\S]*const savingRef = useRef\(false\)/);
  assert.match(workspace, /export function DealEditor[\s\S]*if \(savingRef\.current\) return/);
});

test('administrative dispute and moderation decisions are single-flight', () => {
  const workspace = readText('src/AdministrationWorkspace.tsx');

  assert.match(workspace, /function AdminDisputeCenter[\s\S]*const savingRef = useRef\(false\)/);
  assert.match(workspace, /if \(note\.length < 3 \|\| savingRef\.current\) return/);
  assert.match(workspace, /function AdminReportCenter[\s\S]*const openingDealRef = useRef\(false\)/);
  assert.match(workspace, /if \(openingDealRef\.current\) return/);
  assert.ok((workspace.match(/savingRef\.current = true/g) ?? []).length >= 3);
});

test('watchlist, access-code, and renewal mutations are single-flight', () => {
  const workspace = readText('src/DealWorkspaceFeatures.tsx');

  assert.match(workspace, /export function SaveDealButton[\s\S]*const mutationRef = useRef\(false\)/);
  assert.match(workspace, /if \(mutationRef\.current\) return/);
  assert.match(workspace, /export function BuyerAccessCodeManager[\s\S]*const busyRef = useRef\(false\)/);
  assert.match(workspace, /if \(busyRef\.current\) return;[\s\S]*busyRef\.current = true/);
  assert.match(workspace, /export function DealRenewalPanel[\s\S]*const savingRef = useRef\(false\)/);
});

test('restricted evidence lifecycle actions are mutually single-flight', () => {
  const workspace = readText('src/EvidenceLifecycleCenter.tsx');

  assert.match(workspace, /const busyRef=useRef\(false\)/);
  assert.ok((workspace.match(/if\(busyRef\.current\)return/g) ?? []).length >= 2);
  assert.ok((workspace.match(/busyRef\.current=true/g) ?? []).length >= 2);
  assert.match(workspace, /aria-busy=\{Boolean\(busy\)\}/);
  assert.match(workspace, /const loadSequenceRef=useRef\(0\)/);
  assert.ok((workspace.match(/request===loadSequenceRef\.current/g) ?? []).length >= 3);
});

test('deal evidence list ignores stale deal and session responses', () => {
  const workspace = readText('src/DealEvidenceWorkspace.tsx');
  assert.match(workspace, /const loadSequenceRef = useRef\(0\)/);
  assert.match(workspace, /const request = \+\+loadSequenceRef\.current/);
  assert.ok((workspace.match(/request === loadSequenceRef\.current/g) ?? []).length >= 2);
  assert.match(workspace, /loadSequenceRef\.current \+= 1/);
});

test('TypeScript UI sources do not contain common UTF-8 mojibake sequences', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map(entry => `src/${entry.name}`);
  for (const file of files) {
    assert.doesNotMatch(readText(file), /â€¦|â€”|Â·|â€™|Ã|ðŸ/, file);
  }
});

test('buttons rendered directly inside forms declare an explicit type', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const source = readText(file);
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const tagName = node => node.tagName?.getText(sourceFile);
    const inspect = (node, insideForm = false) => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      const currentTag = opening ? tagName(opening) : null;
      if (insideForm && currentTag === 'button') {
        const hasType = opening.attributes.properties.some(property => (
          ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'type'
        ));
        if (!hasType) {
          const position = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
          violations.push(`${file}:${position.line + 1}`);
        }
      }
      const childInsideForm = insideForm || currentTag === 'form';
      ts.forEachChild(node, child => inspect(child, childInsideForm));
    };
    inspect(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('rendered media and new-tab links preserve accessible safe defaults', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const inspect = node => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (opening) {
        const tag = opening.tagName.getText(sourceFile);
        const attributes = new Map(opening.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => [attribute.name.getText(sourceFile), attribute]));
        const position = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
        const location = `${file}:${position.line + 1}`;
        if (tag === 'img' && !attributes.has('alt')) {
          violations.push(`${location} image has no alt attribute`);
        }
        if (tag === 'video') {
          if (!attributes.has('controls')) {
            violations.push(`${location} video has no controls`);
          }
          if (!attributes.has('aria-label') && !attributes.has('aria-labelledby')) {
            violations.push(`${location} video has no accessible name`);
          }
        }
        if (tag === 'a') {
          const target = attributes.get('target')?.initializer?.getText(sourceFile);
          const rel = attributes.get('rel')?.initializer?.getText(sourceFile) ?? '';
          if (target === '"_blank"' && !/noopener|noreferrer/.test(rel)) {
            violations.push(`${location} new-tab link has no opener isolation`);
          }
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('native form controls preserve a programmatic accessible name', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const labelTargets = new Set();
    const controls = [];
    const attributeMap = opening => new Map(opening.attributes.properties
      .filter(ts.isJsxAttribute)
      .map(attribute => [attribute.name.getText(sourceFile), attribute]));
    const attributeValue = attribute => attribute?.initializer?.getText(sourceFile) ?? '';

    const inspect = (node, insideLabel = false) => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      const tag = opening?.tagName.getText(sourceFile);
      const attributes = opening ? attributeMap(opening) : new Map();
      if (tag === 'label' && attributes.has('htmlFor')) {
        labelTargets.add(attributeValue(attributes.get('htmlFor')));
      }
      if (['input', 'select', 'textarea'].includes(tag)) {
        controls.push({ opening, attributes, insideLabel });
      }
      const childInsideLabel = insideLabel || tag === 'label';
      ts.forEachChild(node, child => inspect(child, childInsideLabel));
    };
    inspect(sourceFile);

    for (const { opening, attributes, insideLabel } of controls) {
      const type = attributeValue(attributes.get('type'));
      const id = attributeValue(attributes.get('id'));
      const named = insideLabel
        || type === '"hidden"'
        || attributes.has('aria-label')
        || attributes.has('aria-labelledby')
        || (id && labelTargets.has(id));
      if (!named) {
        const position = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
        violations.push(`${file}:${position.line + 1}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('invalid native controls expose linked validation guidance', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const inspect = node => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (opening && ['input', 'select', 'textarea'].includes(opening.tagName.getText(sourceFile))) {
        const attributes = new Set(opening.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => attribute.name.getText(sourceFile)));
        if (attributes.has('aria-invalid') && !attributes.has('aria-describedby')) {
          const position = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
          violations.push(`${file}:${position.line + 1}`);
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('credential fields expose password-manager autocomplete semantics', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const inspect = node => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (opening?.tagName.getText(sourceFile) === 'input') {
        const attributes = new Map(opening.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => [attribute.name.getText(sourceFile), attribute]));
        const type = attributes.get('type')?.initializer?.getText(sourceFile);
        if (type === '"email"' || type === '"password"') {
          const autocomplete = attributes.get('autoComplete')?.initializer?.getText(sourceFile);
          if (!autocomplete) {
            const position = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
            violations.push(`${file}:${position.line + 1}`);
          }
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('email fields preserve mobile-safe text entry semantics', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const inspect = node => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (opening?.tagName.getText(sourceFile) === 'input') {
        const attributes = new Map(opening.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => [attribute.name.getText(sourceFile), attribute]));
        const value = name => attributes.get(name)?.initializer?.getText(sourceFile) ?? '';
        if (value('type') === '"email"') {
          const valid = value('autoComplete') === '"email"'
            && value('autoCapitalize') === '"none"'
            && value('spellCheck') === '{false}'
            && value('maxLength') === '{254}';
          if (!valid) {
            const position = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
            violations.push(`${file}:${position.line + 1}`);
          }
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('credential fields enforce bounded input and explicit mobile keyboard actions', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const inspect = node => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (opening?.tagName.getText(sourceFile) === 'input') {
        const attributes = new Map(opening.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => [attribute.name.getText(sourceFile), attribute]));
        const autocomplete = attributes.get('autoComplete')?.initializer?.getText(sourceFile) ?? '';
        if (/email|current-password|new-password/.test(autocomplete)
          && (!attributes.has('name') || !attributes.has('maxLength') || !attributes.has('enterKeyHint'))) {
          const position = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
          violations.push(`${file}:${position.line + 1}`);
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('one-time-code fields preserve six-digit mobile input semantics', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const inspect = node => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (opening?.tagName.getText(sourceFile) === 'input') {
        const attributes = new Map(opening.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => [attribute.name.getText(sourceFile), attribute]));
        const attributeText = name => attributes.get(name)?.initializer?.getText(sourceFile) ?? '';
        if (attributeText('autoComplete') === '"one-time-code"') {
          const valid = attributeText('inputMode') === '"numeric"'
            && attributeText('pattern') === '"[0-9]{6}"'
            && attributeText('maxLength') === '{6}';
          if (!valid) {
            const position = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
            violations.push(`${file}:${position.line + 1}`);
          }
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('US postal-code fields preserve ZIP and ZIP+4 mobile input semantics', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const inspect = node => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (opening?.tagName.getText(sourceFile) === 'input') {
        const attributes = new Map(opening.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => [attribute.name.getText(sourceFile), attribute]));
        const attributeText = name => attributes.get(name)?.initializer?.getText(sourceFile) ?? '';
        if (attributeText('autoComplete') === '"postal-code"') {
          const valid = attributeText('inputMode') === '"numeric"'
            && attributeText('pattern') === '"[0-9]{5}(-[0-9]{4})?"'
            && attributeText('maxLength') === '{10}'
            && attributes.has('aria-describedby');
          if (!valid) {
            const position = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
            violations.push(`${file}:${position.line + 1}`);
          }
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('rendered buttons preserve a programmatic accessible name', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const hasTextAlternative = node => {
      if (ts.isJsxText(node)) return Boolean(node.getText(sourceFile).trim());
      if (ts.isJsxExpression(node)) {
        const expression = node.expression;
        return Boolean(expression)
          && !ts.isJsxElement(expression)
          && !ts.isJsxSelfClosingElement(expression);
      }
      if (ts.isJsxElement(node)) return node.children.some(hasTextAlternative);
      return false;
    };
    const inspect = node => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sourceFile) === 'button') {
        const attributes = new Set(node.openingElement.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => attribute.name.getText(sourceFile)));
        const named = attributes.has('aria-label')
          || attributes.has('aria-labelledby')
          || node.children.some(hasTextAlternative);
        if (!named) {
          const position = sourceFile.getLineAndCharacterOfPosition(
            node.openingElement.getStart(sourceFile),
          );
          violations.push(`${file}:${position.line + 1}`);
        }
      }
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(sourceFile) === 'button') {
        const attributes = new Set(node.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => attribute.name.getText(sourceFile)));
        if (!attributes.has('aria-label') && !attributes.has('aria-labelledby')) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          violations.push(`${file}:${position.line + 1}`);
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('rendered links preserve a programmatic accessible name', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const hasTextAlternative = node => {
      if (ts.isJsxText(node)) return Boolean(node.getText(sourceFile).trim());
      if (ts.isJsxExpression(node)) {
        const expression = node.expression;
        return Boolean(expression)
          && !ts.isJsxElement(expression)
          && !ts.isJsxSelfClosingElement(expression);
      }
      if (ts.isJsxElement(node)) return node.children.some(hasTextAlternative);
      return false;
    };
    const inspect = node => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sourceFile) === 'a') {
        const attributes = new Set(node.openingElement.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => attribute.name.getText(sourceFile)));
        const named = attributes.has('aria-label')
          || attributes.has('aria-labelledby')
          || node.children.some(hasTextAlternative);
        if (!named) {
          const position = sourceFile.getLineAndCharacterOfPosition(
            node.openingElement.getStart(sourceFile),
          );
          violations.push(`${file}:${position.line + 1}`);
        }
      }
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(sourceFile) === 'a') {
        const attributes = new Set(node.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => attribute.name.getText(sourceFile)));
        if (!attributes.has('aria-label') && !attributes.has('aria-labelledby')) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          violations.push(`${file}:${position.line + 1}`);
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('ARIA dialogs preserve modal and naming semantics', () => {
  const files = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => `src/${entry.name}`);
  const violations = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const inspect = node => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (opening) {
        const attributes = new Map(opening.attributes.properties
          .filter(ts.isJsxAttribute)
          .map(attribute => [attribute.name.getText(sourceFile), attribute]));
        const value = name => attributes.get(name)?.initializer?.getText(sourceFile) ?? '';
        if (value('role') === '"dialog"') {
          const modal = value('aria-modal') === '"true"';
          const named = attributes.has('aria-label') || attributes.has('aria-labelledby');
          if (!modal || !named) {
            const position = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
            violations.push(`${file}:${position.line + 1}`);
          }
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('application-level deal and verification mutations are same-tick guarded', () => {
  const app = readText('src/app.tsx');

  assert.match(app, /const createMutationRef=useRef\(false\)/);
  assert.ok((app.match(/if\(createMutationRef\.current\)return/g) ?? []).length >= 2);
  assert.match(app, /const acceptMutationRef=useRef\(false\)/);
  assert.match(app, /acceptMutationRef\.current=true[\s\S]*finally\{acceptMutationRef\.current=false;setAccepting\(false\)\}/);
  assert.match(app, /const protectionRequired=await getDealAcceptanceProtection\(active\.publicId\)/);
  assert.match(app, /setAcceptanceProtected\(protectionRequired\);if\(protectionRequired&&!\/\^\[0-9\]\{6\}\$\/\.test\(buyerAccessCode\)\)/);
  assert.match(app, /protectionRequired[\s\S]*await acceptPublicDeal\(session,active\.publicId,buyer\.trim\(\),buyerAccessCode\)/);
  assert.match(app, /const verificationMutationRef=useRef\(false\)/);
  assert.match(app, /verificationMutationRef\.current=true[\s\S]*finally\{verificationMutationRef\.current=false;setVerificationRequesting\(false\)\}/);
  assert.match(app, /setVerificationRequesting\(true\)/);
  assert.match(app, /verificationRequesting=\{verificationRequesting\}/);
  assert.match(app, /accepting=\{accepting\}/);
  const workspace = readText('src/DealWorkspace.tsx');
  assert.match(workspace, /disabled=\{!agreementActionReady \|\| accepting\}/);
  assert.match(workspace, /aria-busy=\{accepting\}/);
  assert.match(workspace, /accepting \? 'Accepting…' : 'Accept these terms'/);
  const profile = readText('src/AccountProfileWorkspace.tsx');
  assert.match(profile, /disabled=\{requesting\}/);
  assert.match(profile, /aria-busy=\{requesting\}/);
  assert.match(profile, /requesting \? 'Requesting…' : 'Request verification'/);
});

test('VIN decoding cannot overwrite a newer identifier selection', () => {
  const app = readText('src/app.tsx');
  assert.match(app, /const vehicleVinRequestRef=useRef\(0\)/);
  assert.match(app, /const vehicleVinActiveRef=useRef\(false\)/);
  assert.match(app, /const request=\+\+vehicleVinRequestRef\.current/);
  assert.ok((app.match(/request!==vehicleVinRequestRef\.current/g) ?? []).length >= 2);
  assert.match(app, /if\(request===vehicleVinRequestRef\.current\)vehicleVinActiveRef\.current=false/);
  assert.match(app, /onClearVinLookup=\{\(\)=>\{vehicleVinRequestRef\.current\+=1;vehicleVinActiveRef\.current=false/);
});

test('session-scoped background responses cannot repopulate signed-out state', () => {
  const app = readText('src/app.tsx');
  assert.match(app, /let current=true;let renewing=false;const renew=\(\)=>\{if\(renewing\)return/);
  assert.match(app, /renewing=true;refreshSession\(session\)/);
  assert.match(app, /\.finally\(\(\)=>\{renewing=false\}\)/);
  assert.match(app, /refreshSession\(session\)\.then\(next=>\{if\(current\)setSession\(next\)\}\)/);
  assert.match(app, /const notificationRequestRef=useRef\(0\)/);
  assert.match(app, /getMyNotifications\(session\)\.then\(items=>\{if\(current&&request===notificationRequestRef\.current\)setNotifications\(items\)\}\)/);
  assert.match(app, /markAllNotificationsRead\(session\)\.catch\(error=>\{if\(request===notificationRequestRef\.current\)\{setNotifications\(previous\)/);
  assert.match(app, /getAdminAccess\(session\)\.then\(access=>\{if\(current\)setIsAdmin\(access\)\}\)/);
  assert.ok((app.match(/return\(\)=>\{current=false/g) ?? []).length >= 3);
  assert.match(app, /const dealListRequestRef=useRef\(0\)/);
  assert.match(app, /const savedDealsRequestRef=useRef\(0\)/);
  assert.ok((app.match(/request===dealListRequestRef\.current/g) ?? []).length >= 3);
  assert.ok((app.match(/(?:request|savedRequest)===savedDealsRequestRef\.current/g) ?? []).length >= 4);
});

test('offer loading ignores responses from a previous deal or session', () => {
  const features = readText('src/DealWorkspaceFeatures.tsx');
  assert.match(features, /const loadSequenceRef = useRef\(0\)/);
  assert.match(features, /const request = \+\+loadSequenceRef\.current/);
  assert.match(features, /request === loadSequenceRef\.current\) setOffers\(next\)/);
  assert.match(features, /loadSequenceRef\.current \+= 1/);
});

test('profile and notification deal navigation ignore stale responses', () => {
  const app = readText('src/app.tsx');
  assert.match(app, /const publicDealRequestRef=useRef\(0\)/);
  assert.match(app, /const profileRequestRef=useRef\(0\)/);
  assert.match(app, /const request=\+\+publicDealRequestRef\.current/);
  assert.match(app, /request!==publicDealRequestRef\.current/);
  assert.match(app, /request===publicDealRequestRef\.current/);
  assert.match(app, /const openProfile=async\(\)=>\{if\(!session\)return;const request=\+\+profileRequestRef\.current/);
  assert.ok((app.match(/request===profileRequestRef\.current/g) ?? []).length >= 2);
  assert.match(app, /onOpenPublic=\{publicId=>void openPublicDeal\(publicId\)\}/);
});

test('payment and account security refreshes ignore stale responses', () => {
  const payment = readText('src/DealPaymentWorkspace.tsx');
  const sessions = readText('src/AccountSessionSecurity.tsx');
  const mfa = readText('src/AccountMfaSecurity.tsx');

  assert.match(payment, /const loadRequest = useRef\(0\)/);
  assert.match(payment, /const request = \+\+loadRequest\.current/);
  assert.ok((payment.match(/request !== loadRequest\.current/g) ?? []).length >= 2);
  assert.match(payment, /loadRequest\.current \+= 1/);

  for (const source of [sessions, mfa]) {
    assert.match(source, /const loadRequestRef=useRef\(0\)/);
    assert.ok((source.match(/\+\+loadRequestRef\.current/g) ?? []).length >= 2);
    assert.ok((source.match(/request===loadRequestRef\.current/g) ?? []).length >= 2);
    assert.match(source, /loadRequestRef\.current\+=1/);
  }
});

test('transaction polling renders only the newest completed request', () => {
  const payment = readText('src/DealPaymentWorkspace.tsx');
  const features = readText('src/DealWorkspaceFeatures.tsx');

  assert.ok((payment.match(/const loadRequest = useRef\(0\)/g) ?? []).length >= 2);
  assert.ok((payment.match(/request === loadRequest\.current/g) ?? []).length >= 2);
  assert.ok((payment.match(/loadRequest\.current \+= 1/g) ?? []).length >= 2);

  assert.ok((features.match(/const loadRequestRef = useRef\(0\)/g) ?? []).length >= 3);
  assert.ok((features.match(/request === loadRequestRef\.current/g) ?? []).length >= 4);
  assert.ok((features.match(/loadRequestRef\.current \+= 1/g) ?? []).length >= 3);
  assert.match(features, /request !== loadRequestRef\.current \|\| !record/);
  assert.match(payment, /Payment receipt is temporarily unavailable\. Retrying automatically\./);
  assert.match(payment, /setLoadError\(''\)/);
  assert.match(payment, /role="status" aria-live="polite"/);
});

test('meeting and watchlist reads fail visibly without exposing false state', () => {
  const fulfillment = readText('src/DealFulfillmentWorkspace.tsx');
  const features = readText('src/DealWorkspaceFeatures.tsx');

  assert.match(fulfillment, /const \[loaded, setLoaded\] = useState\(false\)/);
  assert.match(fulfillment, /setLoaded\(false\);[\s\S]*getDealMeeting\(session, deal\.id\)/);
  assert.match(fulfillment, /Could not load meeting details/);
  assert.match(fulfillment, /!loaded \? \([\s\S]*Loading meeting details/);
  assert.match(fulfillment, /loadFailed \? \([\s\S]*<AsyncStatePanel[\s\S]*state="error"/);
  assert.match(fulfillment, /setLoadVersion\(\(version\) => version \+ 1\)/);
  assert.match(fulfillment, /Could not load handoff status/);
  assert.match(fulfillment, /if \(loadError\) \{[\s\S]*role="alert"[\s\S]*Try again/);
  assert.match(features, /Could not check whether this deal is saved\. Try again\./);
  assert.match(features, /Could not load the private participant record\./);
  assert.match(features, /Could not refresh the deal action plan\./);
  assert.ok((features.match(/compact-record-error/g) ?? []).length >= 2);
});

test('agreement history failures remain visible and recoverable', () => {
  const agreement = readText('src/AgreementRecordSummary.tsx');
  assert.ok((agreement.match(/const \[loadError, setLoadError\] = useState\(''\)/g) ?? []).length >= 2);
  assert.match(agreement, /Agreement fingerprint is temporarily unavailable\./);
  assert.match(agreement, /Agreement history is temporarily unavailable\./);
  assert.match(agreement, /role="alert"/);
  assert.ok((agreement.match(/setLoadVersion\(version => version \+ 1\)/g) ?? []).length >= 2);
});

test('completed-deal dispute eligibility fails visibly and can be retried', () => {
  const resolution = readText('src/DealResolutionWorkspace.tsx');
  assert.match(resolution, /const \[paymentStateError, setPaymentStateError\] = useState\(''\)/);
  assert.match(resolution, /Dispute eligibility is temporarily unavailable\./);
  assert.match(resolution, /setPaymentStateVersion\(version => version \+ 1\)/);
});

test('public trust checks never turn provider failures into silent approval', () => {
  const declarations = readText('src/SellerDeclarations.tsx');
  const features = readText('src/DealWorkspaceFeatures.tsx');
  assert.match(declarations, /Seller declaration status is temporarily unavailable\./);
  assert.match(declarations, /setLoadVersion\(version => version \+ 1\)/);
  assert.match(features, /Safety check temporarily unavailable/);
  assert.match(features, /Do not treat a missing risk result as approval\./);
  assert.match(features, /setLoadVersion\(version => version \+ 1\)/);
});

test('shared UI foundations expose semantic tokens and accessible feedback states', () => {
  const tokens = readText('src/design-tokens.css');
  const feedback = readText('src/FeedbackMessage.tsx');
  const feedbackStyles = readText('src/feedback-message.css');
  const fieldErrorStyles = readText('src/field-error.css');
  const asyncStateStyles = readText('src/async-state-panel.css');
  const entry = readText('src/main.tsx');

  for (const token of [
    '--color-brand-700',
    '--color-success-700',
    '--color-warning-800',
    '--color-danger-800',
    '--color-info-800',
    '--focus-ring',
    '--touch-target',
  ]) {
    assert.match(tokens, new RegExp(`${token}:`));
  }
  assert.match(entry, /import '\.\/design-tokens\.css';[\s\S]*import '\.\/styles\.css';/);
  assert.match(feedback, /role=\{urgent \? 'alert' : 'status'\}/);
  assert.match(feedback, /aria-live=\{urgent \? 'assertive' : 'polite'\}/);
  assert.match(feedback, /aria-atomic="true"/);
  assert.match(feedbackStyles, /var\(--color-danger-800\)/);
  assert.match(feedbackStyles, /var\(--color-success-700\)/);
  assert.match(fieldErrorStyles, /var\(--color-danger-800\)/);
  assert.match(fieldErrorStyles, /var\(--color-danger-border\)/);
  assert.match(asyncStateStyles, /var\(--color-info-800\)/);
  assert.match(asyncStateStyles, /var\(--color-danger-100\)/);
  assert.doesNotMatch(`${fieldErrorStyles}\n${asyncStateStyles}`, /var\(--ds-(?:error|info|border|ink-muted|surface-subtle)/);
  assert.match(tokens, /:focus-visible/);
  assert.match(tokens, /@media \(forced-colors: active\)/);
});

test('every stylesheet custom-property reference has a governed definition', () => {
  const cssFiles = readdirSync(join(rootPath, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.css'))
    .map(entry => `src/${entry.name}`);
  const definitions = new Set();
  const usages = new Map();

  for (const file of cssFiles) {
    const source = readText(file);
    for (const match of source.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) {
      definitions.add(match[1]);
    }
    for (const match of source.matchAll(/var\((--[A-Za-z0-9_-]+)/g)) {
      const files = usages.get(match[1]) ?? new Set();
      files.add(file);
      usages.set(match[1], files);
    }
  }

  const undefinedReferences = [...usages]
    .filter(([token]) => !definitions.has(token))
    .map(([token, files]) => `${token}: ${[...files].join(', ')}`)
    .sort();
  assert.deepEqual(undefinedReferences, []);
});

test('semantic feedback color pairs meet WCAG AA normal-text contrast', () => {
  const luminance = hex => {
    const channels = hex.match(/[a-f\d]{2}/gi).map(value => Number.parseInt(value, 16) / 255);
    const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  const pairs = [
    ['2855a5', 'eef5ff'],
    ['155948', 'e7f8f1'],
    ['6c4700', 'fff4cf'],
    ['8f2430', 'fff0f1'],
  ];

  for (const [foreground, background] of pairs) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
  }
});

test('password recovery exposes field-specific errors and deterministic focus recovery', () => {
  const source = readText('src/AccountEntryPages.tsx');
  const fieldError = readText('src/FieldError.tsx');
  const fieldErrorStyles = readText('src/field-error.css');
  assert.match(source, /aria-invalid=\{Boolean\(passwordError\)\}/);
  assert.match(source, /recovery-password-error/);
  assert.match(source, /aria-invalid=\{Boolean\(confirmPasswordError\)\}/);
  assert.match(source, /recovery-confirm-password-error/);
  assert.match(source, /passwordRef\.current\?\.focus\(\)/);
  assert.match(source, /confirmPasswordRef\.current\?\.focus\(\)/);
  assert.match(fieldError, /role="alert"/);
  assert.match(fieldError, /aria-hidden="true"/);
  assert.match(fieldErrorStyles, /\[aria-invalid='true'\]/);
});

test('shared async state exposes accurate loading and retry semantics', () => {
  const panel = readText('src/AsyncStatePanel.tsx');
  const styles = readText('src/async-state-panel.css');
  const fulfillment = readText('src/DealFulfillmentWorkspace.tsx');
  assert.match(panel, /role=\{urgent \? 'alert' : 'status'\}/);
  assert.match(panel, /aria-busy=\{state === 'loading'/);
  assert.match(panel, /type="button"/);
  assert.match(styles, /min-height: var\(--touch-target\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.ok((fulfillment.match(/<AsyncStatePanel/g) || []).length >= 2);
  assert.match(fulfillment, /setLoadVersion\(\(version\) => version \+ 1\)/);
});

test('account security reads fail closed with an explicit retry path', () => {
  const sessions = readText('src/AccountSessionSecurity.tsx');
  const mfa = readText('src/AccountMfaSecurity.tsx');

  for (const source of [sessions, mfa]) {
    assert.match(source, /const \[loadError,setLoadError\]=useState\(''\)/);
    assert.match(source, /<AsyncStatePanel state="error"/);
    assert.match(source, /actionLabel="Retry securely"/);
  }
  assert.match(sessions, /\{!loadError&&<div className="session-security-actions">/);
  assert.match(mfa, /!loading&&!loadError&&!enrollment/);
});

test('public trust passport exposes recoverable routing and accessible reputation data', () => {
  const source = readText('src/app.tsx');

  assert.match(source, /function PublicTrustPassportPage\(\{/);
  assert.match(source, /state=\{message\?'error':'loading'\}/);
  assert.match(source, /onRetry=\{\(\)=>setRouteRevision\(revision=>revision\+1\)\}/);
  assert.match(source, /aria-label=\{`\$\{rating\.stars\} out of 5 stars`\}/);
  assert.match(source, /className="passport-avatar" aria-hidden="true"/);
  assert.match(source, /type="button" onClick=\{onBack\}/);
});

test('dashboard data failures stay distinct from valid empty states', () => {
  const source = readText('src/app.tsx');
  const styles = readText('src/dashboard.css');

  assert.match(source, /const \[dashboardError,setDashboardError\]=useState\(''\)/);
  assert.match(source, /title="Refresh failed"/);
  assert.match(source, /Showing saved data\./);
  assert.match(source, /setDashboardRevision\(revision=>revision\+1\)/);
  assert.match(source, /Promise\.all\(\[listUserDeals\(session\),getMySavedDeals\(session\)\]\)/);
  assert.doesNotMatch(source, /listUserDeals\(session\)[\s\S]{0,240}catch\(\(\)=>\{if\(request===dealListRequestRef\.current\)setDeals\(\[\]\)\}\)/);
  assert.match(styles, /\.dashboard-data-states/);
});

test('English launch locale inlining is AST-scoped and preserves dynamic behavior', () => {
  const source = `
    import { t } from './i18n';
    const staticCopy = t('Static copy');
    const templateCopy = t(\`Template copy\`);
    const conditionalCopy = t(enabled ? 'Enabled copy' : 'Disabled copy');
    const mixedConditional = t(enabled ? 'Safe copy' : dynamicKey);
    const dynamicCopy = t(dynamicKey);
    const memberCopy = translator.t('Member copy');
    const quotedExample = "t('Inside a string')";
    // t('Inside a comment')
  `;
  const transformed = inlineEnglishTranslationCalls(source, 'sample.ts');

  assert.match(transformed, /const staticCopy = 'Static copy';/);
  assert.match(transformed, /const templateCopy = `Template copy`;/);
  assert.match(transformed, /const conditionalCopy = \(enabled \? 'Enabled copy' : 'Disabled copy'\);/);
  assert.match(transformed, /const mixedConditional = \(enabled \? 'Safe copy' : dynamicKey\);/);
  assert.match(transformed, /const dynamicCopy = \(dynamicKey\);/);
  assert.match(transformed, /translator\.t\('Member copy'\)/);
  assert.match(transformed, /"t\('Inside a string'\)"/);
  assert.match(transformed, /\/\/ t\('Inside a comment'\)/);
  assert.equal(
    inlineEnglishTranslationCalls("const copy = t('No import');", 'sample.ts'),
    "const copy = t('No import');",
  );
});

test('shipping navigation readiness exposes loading, failure, and bounded retry states', () => {
  const app = readText('src/app.tsx');
  const shell = readText('src/DealWorkspaceShell.tsx');

  assert.match(shell, /status: 'loading' \| 'ready' \| 'error'/);
  assert.match(shell, /label: 'Retry shipping check'/);
  assert.match(shell, /kind: 'retry-shipping'/);
  assert.match(app, /\{status:'loading',ready:items\[dealId\]\?\.ready\?\?false\}/);
  assert.match(app, /\{status:'error',ready:items\[dealId\]\?\.ready\?\?false\}/);
  assert.match(app, /dealPrimaryAction\.kind==='retry-shipping'/);
  assert.match(app, /setEvidenceRevision\(revision=>revision\+1\)/);
  assert.doesNotMatch(app, /catch\(\(\)=>\{if\(current\)setShippingReadinessByDeal\(items=>\(\{\.\.\.items,\[dealId\]:\{loaded:true,ready:false\}\}\)\)\}\)/);
});

test('deal action plan exposes initial loading, stale failure, and manual retry states', () => {
  const source = readText('src/DealWorkspaceFeatures.tsx');

  assert.match(source, /import \{ AsyncStatePanel \} from '\.\/AsyncStatePanel'/);
  assert.match(source, /const \[loading, setLoading\] = useState\(true\)/);
  assert.match(source, /const \[loadRevision, setLoadRevision\] = useState\(0\)/);
  assert.match(source, /title=\{loadError \? 'Deal progress unavailable' : 'Loading deal progress'\}/);
  assert.match(source, /Showing the previously loaded milestones\. Retry before relying on the next step\./);
  assert.match(source, /setLoadRevision\(\(revision\) => revision \+ 1\)/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.doesNotMatch(source, /if \(!plan\) \{[\s\S]{0,400}return loadError \?/);
});

test('notification reads preserve stale activity and expose retryable failures', () => {
  const source = readText('src/app.tsx');

  assert.match(source, /const \[notificationsError,setNotificationsError\]=useState\(''\)/);
  assert.match(source, /title="Activity unavailable"/);
  assert.match(source, /Showing previously loaded activity\./);
  assert.match(source, /onRetry=\{\(\)=>setNotificationsRevision\(revision=>revision\+1\)\}/);
  assert.match(source, /setNotifications\(previous\)/);
  assert.doesNotMatch(source, /getMyNotifications\(session\)[\s\S]{0,240}catch\(\(\)=>\{if\(current&&request===notificationRequestRef\.current\)setNotifications\(\[\]\)\}\)/);
  assert.match(source, /aria-expanded=\{expanded\} aria-controls="notification-menu"/);
});

test('profile loading fails closed before account security controls render', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/AccountProfileWorkspace.tsx');

  assert.match(app, /const \[profileLoading,setProfileLoading\]=useState\(false\)/);
  assert.match(app, /setProfileLoading\(true\);setAuthMessage\(''\);setView\('profile'\)/);
  assert.match(app, /finally\{if\(request===profileRequestRef\.current\)setProfileLoading\(false\)\}/);
  assert.match(app, /onRetryProfile=\{\(\)=>void openProfile\(\)\}/);
  assert.match(workspace, /if \(!profile\) \{/);
  assert.match(workspace, /title=\{loading \? 'Loading profile…' : 'Profile unavailable'\}/);
  assert.match(workspace, /onAction=\{loading \? undefined : onRetry\}/);
});

test('public Deal Link failures preserve the route and expose a bounded retry', () => {
  const app = readText('src/app.tsx');
  const pages = readText('src/PublicRoutePages.tsx');
  const styles = readText('src/styles.css');

  assert.match(app, /updateBrowserAddress\(`\/\?deal=\$\{encodeURIComponent\(publicId\)\}`\)/);
  assert.match(app, /setAuthMessage\(''\);\s*setView\('route-loading'\)/);
  assert.match(app, /setAuthMessage\(error instanceof Error\?error\.message:'Deal Link unavailable'\);setView\('link-error'\)/);
  assert.match(app, /onRetry=\{\(\)=>setRouteRevision\(revision=>revision\+1\)\}/);
  assert.match(pages, /className="deal-link-error-actions"/);
  assert.match(pages, /onClick=\{onRetry\}>\{t\('Try again'\)\}/);
  assert.match(styles, /\.deal-link-error-actions button\{min-height:44px\}/);
});

test('buyer-code protection reads fail closed across seller and buyer flows', () => {
  const app = readText('src/app.tsx');
  const workspace = readText('src/DealWorkspace.tsx');

  assert.match(app, /const \[acceptanceProtectionState,setAcceptanceProtectionState\]=useState<'idle'\|'loading'\|'ready'\|'error'>\('idle'\)/);
  assert.match(app, /setAcceptanceProtectionState\('loading'\);getDealAcceptanceProtection/);
  assert.match(app, /setAcceptanceProtectionState\('error'\)/);
  assert.match(app, /isDemoActive\|\|acceptanceProtectionState==='ready'/);
  assert.match(app, /Checking acceptance security before you share this link\./);
  assert.match(app, /onRetryProtection=\{\(\)=>setAcceptanceProtectionRevision\(revision=>revision\+1\)\}/);
  assert.match(workspace, /title=\{acceptanceProtectionState === 'error' \? 'Acceptance protection unavailable'/);
  assert.match(workspace, /acceptanceProtectionState === 'ready' &&\s+acceptanceProtected/);
});
