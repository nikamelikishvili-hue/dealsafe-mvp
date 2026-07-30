import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const sourceRoots = ['api', 'server', 'src', 'supabase/functions'];
const directFetchPattern = /\bfetch\s*\(/g;
const directWholeBodyPattern = /\.(?:json|text|arrayBuffer)\s*\(\s*\)/;

const reviewedFetchSites = new Map([
  ['server/authShared.mjs', {
    count: 3,
    required: [
      'AbortSignal.timeout(authProviderTimeoutMs)',
      'validateAuthProviderRequest(',
      'readBoundedAuthProviderJson(upstream)',
    ],
  }],
  ['src/services/browserResponseBoundary.ts', {
    count: 1,
    required: [
      'AbortSignal.timeout(timeoutMs)',
      'AbortSignal.any([init.signal, timeoutSignal])',
    ],
  }],
  ['src/services/diagnosticTransport.ts', {
    count: 1,
    required: [
      'AbortSignal.timeout(diagnosticTimeoutMs)',
      "credentials: 'omit'",
      "referrerPolicy: 'no-referrer'",
      'keepalive: true',
      'maximumBytesByEndpoint',
    ],
  }],
  ['supabase/functions/_shared/common.ts', {
    count: 1,
    required: [
      'AbortSignal.timeout(stripeRequestTimeoutMs)',
      'readBoundedStripeJson(response)',
    ],
  }],
  ['supabase/functions/_shared/evidence-scan.ts', {
    count: 1,
    required: [
      'AbortSignal.timeout(30_000)',
      'readBoundedScannerJson(response)',
    ],
  }],
  ['supabase/functions/security-notifications/index.ts', {
    count: 1,
    required: [
      'AbortSignal.timeout(10_000)',
      'readSecurityNotificationProviderJson(response)',
    ],
  }],
]);

const boundedProviderFiles = [
  'server/authProviderResponse.mjs',
  'server/responseBodyBoundary.mjs',
  'server/vehicleVinShared.mjs',
  'supabase/functions/_shared/evidence-scan.ts',
  'supabase/functions/_shared/response-body-boundary.ts',
  'supabase/functions/_shared/security-notification-response.ts',
  'supabase/functions/_shared/stripe-response-boundary.ts',
  'supabase/functions/_shared/common.ts',
  'supabase/functions/security-notifications/index.ts',
];

const injectedProviderSites = new Map([
  ['server/vehicleVinShared.mjs', [
    "options.fetchImplementation === 'function'",
    'const controller = new AbortController()',
    'const timeout = setTimeout(() => controller.abort(), timeoutMs)',
    'readBoundedResponseText(upstream, maximumProviderBytes)',
    'clearTimeout(timeout)',
  ]],
]);

const delegatedDiagnosticSites = new Map([
  ['src/services/clientFailureReporter.ts', [
    "sendBoundedDiagnostic('/api/security/client-failure'",
    'maximumTransportsPerMinute = 10',
  ]],
  ['src/services/runtimeRejectionReporter.ts', [
    "sendBoundedDiagnostic('/api/security/runtime-rejection'",
    'maximumTransportsPerMinute = 20',
  ]],
  ['src/services/webVitalReporter.ts', [
    "sendBoundedDiagnostic('/api/security/web-vital'",
    'normalizeWebVital(value)',
  ]],
]);

function fail(message) {
  throw new Error(`Outbound transport policy rejected: ${message}`);
}

function collectSourceFiles(directory, workspaceRoot, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(absolutePath, workspaceRoot, files);
      continue;
    }
    if (!entry.isFile() || !sourceExtensions.has(extname(entry.name))) continue;
    files.push(relative(workspaceRoot, absolutePath).replaceAll('\\', '/'));
  }
  return files;
}

export function verifyOutboundTransportPolicy(workspaceRoot) {
  const observedFetchSites = new Map();
  for (const sourceRoot of sourceRoots) {
    const absoluteRoot = join(workspaceRoot, sourceRoot);
    for (const file of collectSourceFiles(absoluteRoot, workspaceRoot)) {
      const source = readFileSync(join(workspaceRoot, file), 'utf8');
      const count = [...source.matchAll(directFetchPattern)].length;
      if (count > 0) observedFetchSites.set(file, count);
    }
  }

  for (const [file, count] of observedFetchSites) {
    const review = reviewedFetchSites.get(file);
    if (!review) fail(`${file} contains an unreviewed direct fetch`);
    if (count !== review.count) {
      fail(`${file} contains ${count} direct fetch calls; expected ${review.count}`);
    }
  }
  for (const [file, review] of reviewedFetchSites) {
    if (observedFetchSites.get(file) !== review.count) {
      fail(`${file} is missing its exact reviewed fetch inventory`);
    }
    const source = readFileSync(join(workspaceRoot, file), 'utf8');
    for (const required of review.required) {
      if (!source.includes(required)) {
        fail(`${file} is missing a reviewed transport control`);
      }
    }
  }

  for (const [file, requiredControls] of injectedProviderSites) {
    const source = readFileSync(join(workspaceRoot, file), 'utf8');
    for (const required of requiredControls) {
      if (!source.includes(required)) {
        fail(`${file} is missing an injected-provider transport control`);
      }
    }
  }
  for (const [file, requiredControls] of delegatedDiagnosticSites) {
    const source = readFileSync(join(workspaceRoot, file), 'utf8');
    for (const required of requiredControls) {
      if (!source.includes(required)) {
        fail(`${file} is missing a delegated diagnostic transport control`);
      }
    }
  }

  for (const file of boundedProviderFiles) {
    const source = readFileSync(join(workspaceRoot, file), 'utf8');
    if (directWholeBodyPattern.test(source)) {
      fail(`${file} contains a direct whole-body response parser`);
    }
  }

  return {
    schema: 'dealivra.outbound-transport-policy-result.v1',
    status: 'passed',
    direct_fetch_sites: observedFetchSites.size,
    direct_fetch_calls: [...observedFetchSites.values()]
      .reduce((total, count) => total + count, 0),
    injected_provider_sites: injectedProviderSites.size,
    delegated_diagnostic_sites: delegatedDiagnosticSites.size,
    bounded_provider_files: boundedProviderFiles.length,
  };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (currentFile === invokedFile) {
  const workspaceRoot = resolve(currentFile, '..', '..');
  console.log(JSON.stringify(verifyOutboundTransportPolicy(workspaceRoot)));
}
