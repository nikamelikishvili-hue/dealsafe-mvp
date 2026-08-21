import { apiRoutePolicy } from './apiMutationOriginPolicy.mjs';

const stages = new Set(['development', 'preview', 'production']);
const countKeys = new Set(['ip']);

const route = (method, windowSeconds, threshold, category) => Object.freeze({
  method,
  windowSeconds,
  threshold,
  category,
  countKey: 'ip',
  productionAction: 'log',
  previewAction: 'rate_limit',
  captcha: 'disabled_pending_evidence',
});

export const apiAbuseControlPolicy = Object.freeze({
  'api/auth/login.mjs': route('POST', 600, 200, 'authentication'),
  'api/auth/logout.mjs': route('POST', 600, 200, 'authenticated_session'),
  'api/auth/mfa.mjs': route('POST', 600, 200, 'authentication'),
  'api/auth/password.mjs': route('POST', 600, 80, 'credential_change'),
  'api/auth/recover.mjs': route('POST', 600, 50, 'authentication'),
  'api/auth/refresh.mjs': route('POST', 600, 300, 'authenticated_session'),
  'api/auth/signup.mjs': route('POST', 600, 50, 'authentication'),
  'api/catalog.mjs': route('GET', 60, 600, 'public_read'),
  'api/deal-qr.mjs': route('GET', 60, 300, 'bounded_document'),
  'api/health.mjs': route('GET', 60, 600, 'liveness'),
  'api/security/client-failure.mjs': route('POST', 60, 300, 'bounded_telemetry'),
  'api/security/csp-report.mjs': route('POST', 60, 300, 'bounded_telemetry'),
  'api/security/mfa-recovery.mjs': route('POST', 600, 40, 'privileged_recovery'),
  'api/security/runtime-rejection.mjs': route('POST', 60, 300, 'bounded_telemetry'),
  'api/security/web-vital.mjs': route('POST', 60, 300, 'bounded_telemetry'),
  'api/vehicles/vin.mjs': route('POST', 600, 200, 'provider_lookup'),
});

function ownRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export function validateApiAbuseControlPolicy() {
  const findings = [];
  const expectedRoutes = Object.keys(apiRoutePolicy).sort();
  const actualRoutes = Object.keys(apiAbuseControlPolicy).sort();

  for (const name of actualRoutes) {
    if (!apiRoutePolicy[name]) findings.push({ route: name, issue: 'unreviewed_route' });
  }
  for (const name of expectedRoutes) {
    const control = ownRecord(apiAbuseControlPolicy[name]);
    if (!control) {
      findings.push({ route: name, issue: 'missing_control' });
      continue;
    }
    const expectedMethod = apiRoutePolicy[name] === 'read-only' ? 'GET' : 'POST';
    if (control.method !== expectedMethod) findings.push({ route: name, issue: 'method_mismatch' });
    if (
      !Number.isSafeInteger(control.windowSeconds)
      || control.windowSeconds < 1
      || control.windowSeconds > 900
    ) findings.push({ route: name, issue: 'invalid_window' });
    if (
      !Number.isSafeInteger(control.threshold)
      || control.threshold < 1
      || control.threshold > 10_000
    ) findings.push({ route: name, issue: 'invalid_threshold' });
    if (!countKeys.has(control.countKey)) findings.push({ route: name, issue: 'invalid_count_key' });
    if (control.productionAction !== 'log') {
      findings.push({ route: name, issue: 'production_must_remain_log_only' });
    }
    if (control.previewAction !== 'rate_limit') {
      findings.push({ route: name, issue: 'preview_must_enforce' });
    }
    if (control.captcha !== 'disabled_pending_evidence') {
      findings.push({ route: name, issue: 'captcha_requires_evidence' });
    }
  }

  return {
    schema: 'dealivra.api-abuse-control-policy.v1',
    status: findings.length ? 'failed' : 'passed',
    routesReviewed: expectedRoutes.length,
    productionActivation: 'log_only',
    captchaActivation: 'disabled_pending_evidence',
    findings,
  };
}

export function evaluateApiAbuseWindow(input) {
  const source = ownRecord(input);
  if (!source) return { status: 'rejected', reason: 'invalid_observation' };
  const control = apiAbuseControlPolicy[source.route];
  if (!control) return { status: 'rejected', reason: 'unreviewed_route' };
  if (!stages.has(source.environment)) {
    return { status: 'rejected', reason: 'invalid_environment' };
  }
  if (source.method !== control.method) {
    return { status: 'rejected', reason: 'method_mismatch' };
  }
  if (
    !Number.isSafeInteger(source.count)
    || source.count < 0
    || source.count > 1_000_000
  ) return { status: 'rejected', reason: 'invalid_count' };

  const exceeded = source.count > control.threshold;
  const action = !exceeded
    ? 'allow'
    : source.environment === 'preview'
      ? 'block'
      : source.environment === 'production'
        ? 'observe'
        : 'allow';
  return {
    status: 'accepted',
    schema: 'dealivra.api-abuse-window-result.v1',
    route: source.route,
    environment: source.environment,
    category: control.category,
    windowSeconds: control.windowSeconds,
    threshold: control.threshold,
    observed: source.count,
    exceeded,
    action,
    alert: exceeded,
    captcha: 'disabled_pending_evidence',
  };
}
