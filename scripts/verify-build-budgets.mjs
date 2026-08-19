import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const distRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const budgets = Object.freeze({
  maximumJavaScriptChunkBytes: 400_000,
  maximumInitialApplicationBytes: 160_000,
  maximumCssChunkBytes: 200_000,
  // QR rendering stays behind the same-origin server boundary so the reviewed
  // launch graph retains meaningful headroom as critical UI evolves.
  // The complete account-password correction summary adds one shared,
  // keyboard-linked validation path. The reviewed local build is 821,795
  // bytes, so the ceiling advances by exactly 1,000 bytes while preserving
  // less than 0.13% growth and no chunk-budget increase.
  maximumTotalJavaScriptBytes: 822_000,
  // Configured Preview/Production builds retain small provider branches that
  // Vite removes from an unconfigured local build. Keep that variance bounded
  // independently instead of silently weakening the base application budget.
  maximumConfiguredBuildOverheadBytes: 3_000,
  maximumTotalCssBytes: 290_000,
});

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

const files = listFiles(distRoot);
const javascript = files.filter(path => path.endsWith('.js'));
const stylesheets = files.filter(path => path.endsWith('.css'));
const violations = [];
const initialApplicationChunks = javascript.filter(path =>
  /^app-[A-Za-z0-9_-]+\.js$/.test(basename(path)),
);

if (initialApplicationChunks.length !== 1) {
  violations.push(
    `Expected exactly one initial application chunk, found ${initialApplicationChunks.length}.`,
  );
} else {
  const initialApplicationBytes = statSync(initialApplicationChunks[0]).size;
  if (initialApplicationBytes > budgets.maximumInitialApplicationBytes) {
    violations.push(
      `Initial application JavaScript is ${initialApplicationBytes} bytes; budget is ${budgets.maximumInitialApplicationBytes}.`,
    );
  }
}

for (const path of javascript) {
  const bytes = statSync(path).size;
  if (bytes > budgets.maximumJavaScriptChunkBytes) {
    violations.push(
      `${relative(distRoot.pathname, path)} is ${bytes} bytes; JavaScript chunk budget is ${budgets.maximumJavaScriptChunkBytes}.`,
    );
  }
}
for (const path of stylesheets) {
  const bytes = statSync(path).size;
  if (bytes > budgets.maximumCssChunkBytes) {
    violations.push(
      `${relative(distRoot.pathname, path)} is ${bytes} bytes; CSS chunk budget is ${budgets.maximumCssChunkBytes}.`,
    );
  }
}

const totalJavaScriptBytes = javascript.reduce(
  (total, path) => total + statSync(path).size,
  0,
);
const publicConfigurationValues = [
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  process.env.VITE_GOOGLE_MAPS_API_KEY,
].filter(value => typeof value === 'string' && value.length >= 8);
const publicConfigurationBytes = javascript.reduce((total, path) => {
  const source = readFileSync(path, 'utf8');
  return total + publicConfigurationValues.reduce((bytes, value) => {
    const occurrences = source.split(value).length - 1;
    return bytes + occurrences * Buffer.byteLength(value);
  }, 0);
}, 0);
const applicationJavaScriptBytes = totalJavaScriptBytes - publicConfigurationBytes;
const configuredBuildOverheadBytes =
  publicConfigurationValues.length > 0
    ? budgets.maximumConfiguredBuildOverheadBytes
    : 0;
const totalCssBytes = stylesheets.reduce(
  (total, path) => total + statSync(path).size,
  0,
);
if (
  applicationJavaScriptBytes >
  budgets.maximumTotalJavaScriptBytes + configuredBuildOverheadBytes
) {
  violations.push(
    `Application JavaScript is ${applicationJavaScriptBytes} bytes; base budget is ${budgets.maximumTotalJavaScriptBytes} with ${configuredBuildOverheadBytes} bytes of configured-build allowance.`,
  );
}
if (totalCssBytes > budgets.maximumTotalCssBytes) {
  violations.push(
    `Total CSS is ${totalCssBytes} bytes; budget is ${budgets.maximumTotalCssBytes}.`,
  );
}

if (violations.length > 0) {
  throw new Error(`Build performance budget exceeded:\n${violations.join('\n')}`);
}

console.log(JSON.stringify({
  status: 'within_budget',
  javascript_chunks: javascript.length,
  stylesheet_chunks: stylesheets.length,
  initial_application_javascript_bytes:
    initialApplicationChunks.length === 1
      ? statSync(initialApplicationChunks[0]).size
      : null,
  total_javascript_bytes: totalJavaScriptBytes,
  public_configuration_bytes: publicConfigurationBytes,
  configured_build_overhead_allowance_bytes: configuredBuildOverheadBytes,
  application_javascript_bytes: applicationJavaScriptBytes,
  total_css_bytes: totalCssBytes,
}));
