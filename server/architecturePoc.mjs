const previewEnvironment = 'preview';

export function architecturePocEnabled(environment = process.env.VERCEL_ENV) {
  return environment === previewEnvironment;
}

export function architecturePocNonce(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{22,64}$/.test(value)
    ? value
    : null;
}

export function escapeArchitecturePocHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function architecturePocCsp(nonce) {
  const safeNonce = architecturePocNonce(nonce);
  if (!safeNonce) throw new Error('Architecture proof nonce is invalid.');
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self'",
    `style-src 'nonce-${safeNonce}'`,
    "connect-src 'self'",
  ].join('; ');
}

export function renderArchitecturePocPage({ nonce, protectedRoute = false, displayName = '' }) {
  const safeNonce = architecturePocNonce(nonce);
  if (!safeNonce) throw new Error('Architecture proof nonce is invalid.');
  const name = displayName || 'Verified member';
  const eyebrow = protectedRoute ? 'SERVER-VERIFIED SESSION' : 'SERVER-RENDERED PUBLIC ROUTE';
  const title = protectedRoute ? `Welcome, ${name}` : 'Dealivra routed-app proof';
  const description = protectedRoute
    ? 'This response was rendered only after the server rotated and verified the HttpOnly refresh session. No access token is embedded in this page.'
    : 'This isolated Preview-only response proves an origin-rendered public route, an explicit CSP, and a migration path that does not expose the existing customer application.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeArchitecturePocHtml(title)}</title>
  <style nonce="${safeNonce}">
    :root{color-scheme:light;--ink:#102037;--muted:#52647b;--line:#d5dfeb;--brand:#176f72;--surface:#fff;--canvas:#f3f7fb}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--canvas);color:var(--ink);font:16px/1.55 system-ui,sans-serif;padding:24px}
    main{width:min(720px,100%);background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:clamp(28px,6vw,56px);box-shadow:0 20px 60px rgba(16,32,55,.09)}
    p{color:var(--muted);max-width:62ch}.eyebrow{color:var(--brand);font-size:.78rem;font-weight:800;letter-spacing:.14em}h1{font-size:clamp(2rem,6vw,3.5rem);line-height:1.05;margin:.35em 0}
    a{display:inline-flex;min-height:44px;align-items:center;color:var(--brand);font-weight:750;text-underline-offset:4px}
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">${eyebrow}</div>
    <h1>${escapeArchitecturePocHtml(title)}</h1>
    <p>${description}</p>
    <a href="/">Return to Dealivra</a>
  </main>
</body>
</html>`;
}

export function prepareArchitecturePocResponse(response, nonce) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Security-Policy', architecturePocCsp(nonce));
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
}
