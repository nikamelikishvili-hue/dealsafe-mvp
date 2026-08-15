export const apiRoutePolicy = Object.freeze({
  'api/catalog.mjs': 'read-only',
  'api/health.mjs': 'read-only',
  'api/auth/login.mjs': 'shared-same-origin',
  'api/auth/logout.mjs': 'shared-same-origin',
  'api/auth/mfa.mjs': 'shared-same-origin',
  'api/auth/password.mjs': 'shared-same-origin',
  'api/auth/recover.mjs': 'shared-same-origin',
  'api/auth/refresh.mjs': 'shared-same-origin',
  'api/auth/signup.mjs': 'shared-same-origin',
  'api/security/mfa-recovery.mjs': 'shared-same-origin',
  'api/vehicles/vin.mjs': 'shared-same-origin',
  'api/security/client-failure.mjs': 'local-same-origin',
  'api/security/runtime-rejection.mjs': 'local-same-origin',
  'api/security/web-vital.mjs': 'local-same-origin',
  'api/security/csp-report.mjs': 'browser-reporting',
});

const requiredTokens = Object.freeze({
  'read-only': ['request.method', "'GET'"],
  'shared-same-origin': ['requirePost', 'requireSameOrigin'],
  'local-same-origin': ["request.method !== 'POST'", 'sameOrigin(request)'],
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
