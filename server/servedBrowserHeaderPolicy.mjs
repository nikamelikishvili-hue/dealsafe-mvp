const requiredExactHeaders = new Map([
  ['strict-transport-security', 'max-age=31536000; includeSubDomains'],
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
  ['cross-origin-opener-policy', 'same-origin-allow-popups'],
  ['cross-origin-resource-policy', 'same-origin'],
  ['origin-agent-cluster', '?1'],
  ['x-permitted-cross-domain-policies', 'none'],
]);

const requiredCspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "connect-src 'self'",
  'upgrade-insecure-requests',
  'report-uri /api/security/csp-report',
  'report-to csp-endpoint',
];

export function validateServedBrowserHeaders(headers) {
  if (!headers || typeof headers.get !== 'function') return null;

  for (const [name, expected] of requiredExactHeaders) {
    if (headers.get(name) !== expected) return null;
  }

  const permissionsPolicy = headers.get('permissions-policy') ?? '';
  const permissions = permissionsPolicy.split(',').map(value => value.trim());
  for (const permission of ['camera=()', 'microphone=()', 'geolocation=(self)', 'payment=(self)']) {
    if (!permissions.includes(permission)) return null;
  }

  const csp = headers.get('content-security-policy') ?? '';
  if (requiredCspDirectives.some(directive => !csp.includes(directive))) return null;
  const directives = csp
    .split(';')
    .map(value => value.trim())
    .filter(Boolean);
  const directiveNames = directives.map(value => value.split(/\s+/, 1)[0].toLowerCase());
  if (new Set(directiveNames).size !== directiveNames.length) return null;
  const scriptPolicy = directives.find(value => value.startsWith('script-src ')) ?? '';
  if (!scriptPolicy || scriptPolicy.includes("'unsafe-inline'")) return null;

  if (headers.get('reporting-endpoints') !== 'csp-endpoint="/api/security/csp-report"') {
    return null;
  }

  return {
    policy: 'dealivra.served-browser-headers.v1',
    status: 'verified',
    checked_header_count: requiredExactHeaders.size + 3,
  };
}
