const maximumResponseBytes = 1_000_000;
const requestTimeoutMs = 8_000;
const allowedProductionHosts = new Set(['dealivra.com', 'www.dealivra.com']);

function configuredBaseUrl() {
  const value = String(process.env.DEALIVRA_SYNTHETIC_BASE_URL || '').trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Synthetic base URL is missing or invalid.');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
    || (
      !local
      && !url.hostname.endsWith('.vercel.app')
      && !allowedProductionHosts.has(url.hostname)
    )
  ) {
    throw new Error('Synthetic base URL is outside the reviewed host boundary.');
  }
  if (
    allowedProductionHosts.has(url.hostname)
    && process.env.DEALIVRA_SYNTHETIC_PRODUCTION_MODE !== 'read_only_confirmed'
  ) {
    throw new Error('Production synthetic reads require explicit read-only confirmation.');
  }
  return url;
}

function protectionHeaders() {
  const secret = String(
    process.env.DEALIVRA_SYNTHETIC_BYPASS_SECRET || '',
  ).trim();
  if (!secret) return {};
  if (secret.length < 16 || secret.length > 1_024 || /[\r\n]/.test(secret)) {
    throw new Error('Synthetic protection secret does not meet the safe boundary.');
  }
  return {
    'x-vercel-protection-bypass': secret,
    'x-vercel-set-bypass-cookie': 'true',
  };
}

async function readBoundedText(response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximumResponseBytes) {
    throw new Error('Synthetic response exceeded the reviewed size boundary.');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximumResponseBytes) {
    throw new Error('Synthetic response exceeded the reviewed size boundary.');
  }
  return new TextDecoder().decode(bytes);
}

async function fetchCheck(baseUrl, headers, check) {
  const url = new URL(check.path, baseUrl);
  if (url.origin !== baseUrl.origin) {
    throw new Error(`${check.name} left the reviewed origin.`);
  }
  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`${check.name} returned an unreviewed redirect.`);
  }
  if (!response.ok) {
    throw new Error(`${check.name} returned HTTP ${response.status}.`);
  }
  const text = await readBoundedText(response);
  check.validate(text, response.headers.get('content-type') || '');
}

const checks = [
  {
    name: 'process_liveness',
    path: '/api/health',
    validate(text, contentType) {
      if (!/application\/json/i.test(contentType)) {
        throw new Error('process_liveness returned the wrong content type.');
      }
      const value = JSON.parse(text);
      if (
        !value
        || Object.keys(value).length !== 2
        || value.schema !== 'dealivra.health.v1'
        || value.status !== 'alive'
      ) {
        throw new Error('process_liveness returned an invalid contract.');
      }
    },
  },
  ...[
    ['public_home', '/'],
    ['terms_route', '/terms'],
    ['sign_in_entry', '/signin'],
  ].map(([name, path]) => ({
    name,
    path,
    validate(text, contentType) {
      if (
        !/text\/html/i.test(contentType)
        || !text.includes('<div id="root"></div>')
        || !text.includes('Dealivra')
      ) {
        throw new Error(`${name} did not return the application shell.`);
      }
    },
  })),
  {
    name: 'phone_catalog_read',
    path: '/api/catalog?category=phone',
    validate(text, contentType) {
      if (!/application\/json/i.test(contentType)) {
        throw new Error('phone_catalog_read returned the wrong content type.');
      }
      const value = JSON.parse(text);
      if (
        !value
        || value.schemaVersion !== 1
        || value.market !== 'US'
        || value.category !== 'phone'
        || !Array.isArray(value.brands)
        || value.brands.length < 1
      ) {
        throw new Error('phone_catalog_read returned an invalid contract.');
      }
    },
  },
];

const baseUrl = configuredBaseUrl();
const headers = protectionHeaders();
let checksCompleted = 0;
try {
  for (const check of checks) {
    await fetchCheck(baseUrl, headers, check);
    checksCompleted += 1;
  }
  console.log(JSON.stringify({
    schema: 'dealivra.synthetic.result.v1',
    status: 'passed',
    checks_completed: checksCompleted,
  }));
} catch {
  console.error(JSON.stringify({
    schema: 'dealivra.synthetic.result.v1',
    status: 'failed',
    checks_completed: checksCompleted,
  }));
  process.exitCode = 1;
}
