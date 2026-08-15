import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateApiMutationOriginPolicy } from '../server/apiMutationOriginPolicy.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const apiRoot = resolve(root, 'api');

function collect(directory) {
  const sources = {};
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) Object.assign(sources, collect(path));
    if (entry.isFile() && entry.name.endsWith('.mjs')) {
      sources[relative(root, path).replaceAll('\\', '/')] = readFileSync(path, 'utf8');
    }
  }
  return sources;
}

const result = evaluateApiMutationOriginPolicy(collect(apiRoot));
process.stdout.write(`${JSON.stringify(result)}\n`);
if (result.status !== 'passed') process.exitCode = 1;
