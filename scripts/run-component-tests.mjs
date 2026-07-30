import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(workspaceRoot, 'tests', 'components', 'component-rendering.test.tsx');
const outputDirectory = join(workspaceRoot, 'tmp', 'component-tests');
const outputFile = join(outputDirectory, 'component-tests.mjs');

await build({
  root: workspaceRoot,
  configFile: false,
  logLevel: 'warn',
  build: {
    ssr: entry,
    outDir: outputDirectory,
    emptyOutDir: true,
    minify: false,
    rolldownOptions: {
      output: {
        entryFileNames: 'component-tests.mjs',
      },
    },
  },
});

if (!existsSync(outputFile)) {
  throw new Error('The component test bundle was not created.');
}

await import(`${pathToFileURL(outputFile).href}?run=${Date.now()}`);
