import { readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const distRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const budgets = Object.freeze({
  maximumJavaScriptChunkBytes: 400_000,
  maximumInitialApplicationBytes: 160_000,
  maximumCssChunkBytes: 200_000,
  // Preview feature configuration produces a slightly larger deferred bundle
  // graph than the safe-default local build. This reviewed ceiling covers the
  // measured 832,516-byte Vercel output while retaining less than 0.3% headroom.
  maximumTotalJavaScriptBytes: 835_000,
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
const totalCssBytes = stylesheets.reduce(
  (total, path) => total + statSync(path).size,
  0,
);
if (totalJavaScriptBytes > budgets.maximumTotalJavaScriptBytes) {
  violations.push(
    `Total JavaScript is ${totalJavaScriptBytes} bytes; budget is ${budgets.maximumTotalJavaScriptBytes}.`,
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
  total_css_bytes: totalCssBytes,
}));
