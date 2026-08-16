import QRCode from 'qrcode';

const DEAL_ID_PATTERN = /^[A-Z0-9]{6,24}$/;
const ALLOWED_HOST_PATTERN = /^(?:dealivra\.com|www\.dealivra\.com|[a-z0-9-]+\.vercel\.app)$/i;

function prepare(response) {
  response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

function resolvePublicHost(request) {
  const forwardedHost = firstHeader(request.headers?.['x-forwarded-host']);
  const host = String(request.headers?.host || forwardedHost || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (ALLOWED_HOST_PATTERN.test(host)) return { host, protocol: 'https' };
  if (/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host)) {
    return { host, protocol: 'http' };
  }
  return null;
}

export default async function handler(request, response) {
  prepare(response);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.status(405).end();
    return;
  }

  const deal = String(Array.isArray(request.query?.deal) ? request.query.deal[0] : request.query?.deal || '')
    .trim()
    .toUpperCase();
  const publicOrigin = resolvePublicHost(request);
  if (!publicOrigin || !DEAL_ID_PATTERN.test(deal)) {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.status(400).end();
    return;
  }

  if (request.method === 'HEAD') {
    response.status(200).end();
    return;
  }

  try {
    const svg = await QRCode.toString(
      `${publicOrigin.protocol}://${publicOrigin.host}/?deal=${encodeURIComponent(deal)}`,
      {
        type: 'svg',
        width: 360,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#15221d', light: '#ffffff' },
      },
    );
    response.status(200).send(svg);
  } catch {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.status(500).end();
  }
}
