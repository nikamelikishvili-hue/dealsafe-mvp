export const apiRoutePolicy = Object.freeze({
  'api/catalog.mjs': 'read-only',
  'api/health.mjs': 'read-only',
  'api/auth/login.mjs': 'shared-json-mutation',
  'api/auth/logout.mjs': 'shared-same-origin',
  'api/auth/mfa.mjs': 'shared-json-mutation',
  'api/auth/password.mjs': 'shared-json-mutation',
  'api/auth/recover.mjs': 'shared-json-mutation',
  'api/auth/refresh.mjs': 'shared-same-origin',
  'api/auth/signup.mjs': 'shared-json-mutation',
  'api/security/mfa-recovery.mjs': 'shared-json-mutation',
  'api/vehicles/vin.mjs': 'shared-json-mutation',
  'api/security/client-failure.mjs': 'shared-reporting-boundary',
  'api/security/runtime-rejection.mjs': 'shared-reporting-boundary',
  'api/security/web-vital.mjs': 'shared-reporting-boundary',
  'api/security/csp-report.mjs': 'browser-reporting',
});

const requiredTokens = Object.freeze({
  'read-only': ['request.method', "'GET'"],
  'shared-same-origin': ['requirePost', 'requireSameOrigin'],
  'shared-json-mutation': ['requirePost', 'requireSameOrigin', 'requireJsonContentType'],
  'shared-reporting-boundary': ['validateReportingRequest', 'readBoundedJson'],
  'browser-reporting': [
    "request.method !== 'POST'",
    'maxBodyBytes',
    'allowedContentTypes',
    'reportsFromPayload',
  ],
});

export function evaluateApiMutationOriginPolicy(routeSources) {
  const findings = [];
  const actualRoutes = Object.keys(routeSources).sort();
  const expectedRoutes = Object.keys(apiRoutePolicy).sort();

  for (const route of actualRoutes) {
    if (!apiRoutePolicy[route]) findings.push({ route, issue: 'unreviewed_route' });
  }
  for (const route of expectedRoutes) {
    const source = routeSources[route];
    if (typeof source !== 'string') {
      findings.push({ route, issue: 'missing_route' });
      continue;
    }
    const mode = apiRoutePolicy[route];
    for (const token of requiredTokens[mode]) {
      if (!source.includes(token)) findings.push({ route, issue: `missing_${mode}_control` });
    }
  }

  return {
    schema: 'dealivra.api-mutation-origin-policy.v1',
    status: findings.length ? 'failed' : 'passed',
    routesReviewed: expectedRoutes.length,
    findings,
  };
}
