const requiredExactHeaders = new Map([
  ['strict-transport-security', 'max-age=31536000; includeSubDomains'],
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['referrer-policy', 'no-referrer'],
  ['cross-origin-opener-policy', 'same-origin-allow-popups'],
  ['cross-origin-resource-policy', 'same-origin'],
  ['origin-agent-cluster', '?1'],
  ['x-permitted-cross-domain-policies', 'none'],
  ['cache-control', 'private, no-store, max-age=0'],
  ['pragma', 'no-cache'],
  ['x-robots-tag', 'noindex, nofollow'],
]);

const requiredCspDirectives = new Set([
  "default-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self'",
  "connect-src 'self'",
]);

export function validateArchitecturePocHeaders(headers) {
  if (!headers || typeof headers.get !== 'function') return null;

  for (const [name, expected] of requiredExactHeaders) {
    if (headers.get(name) !== expected) return null;
  }

  const permissions = (headers.get('permissions-policy') ?? '')
    .split(',')
    .map(value => value.trim());
  for (const permission of ['camera=()', 'microphone=()', 'geolocation=(self)', 'payment=(self)']) {
    if (!permissions.includes(permission)) return null;
  }

  const directives = (headers.get('content-security-policy') ?? '')
    .split(';')
    .map(value => value.trim())
    .filter(Boolean);
  const directiveNames = directives.map(value => value.split(/\s+/, 1)[0].toLowerCase());
  if (new Set(directiveNames).size !== directiveNames.length) return null;
  if (directives.length !== requiredCspDirectives.size + 1) return null;
  if ([...requiredCspDirectives].some(directive => !directives.includes(directive))) return null;

  const stylePolicy = directives.find(value => value.startsWith('style-src ')) ?? '';
  if (!/^style-src 'nonce-[A-Za-z0-9_-]{22,64}'$/.test(stylePolicy)) return null;
  if (directives.some(value => /(?:unsafe-inline|unsafe-eval|script-src)/i.test(value))) return null;

  return {
    policy: 'dealivra.architecture-poc-headers.v1',
    status: 'verified',
    checked_header_count: requiredExactHeaders.size + 2,
  };
}
