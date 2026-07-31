import {
  lstatSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateLegacyIdentifierInventory } from '../server/legacyIdentifierPolicy.mjs';

const governedDirectories = Object.freeze([
  'api',
  'public',
  'scripts',
  'server',
  'src',
  'supabase',
]);
const governedRootFiles = Object.freeze([
  '.env.example',
  'index.html',
  'package.json',
  'vercel.json',
  'vite.config.ts',
]);
const governedExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
]);
const excludedPolicyFiles = new Set([
  'scripts/verify-legacy-identifiers.mjs',
  'server/legacyIdentifierPolicy.mjs',
]);
const excludedDirectoryNames = new Set([
  '.temp',
  'node_modules',
]);

function extension(path) {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index);
}

function collect(directory, workspaceRoot, files) {
  const absoluteDirectory = resolve(workspaceRoot, directory);
  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = `${directory}/${entry.name}`.replaceAll('\\', '/');
    const absolutePath = resolve(workspaceRoot, relativePath);
    if (entry.isSymbolicLink() || lstatSync(absolutePath).isSymbolicLink()) {
      throw new Error(`Legacy identifier verification rejected a symbolic link: ${relativePath}`);
    }
    if (entry.isDirectory()) {
      if (!excludedDirectoryNames.has(entry.name)) {
        collect(relativePath, workspaceRoot, files);
      }
    } else if (
      entry.isFile()
      && governedExtensions.has(extension(relativePath))
      && !excludedPolicyFiles.has(relativePath)
    ) {
      files.push(relativePath);
    }
  }
}

export function verifyLegacyIdentifiers(workspaceRoot) {
  const files = [];
  for (const directory of governedDirectories) collect(directory, workspaceRoot, files);
  files.push(...governedRootFiles);

  const inventory = [...new Set(files)]
    .sort()
    .map(path => ({
      path: relative(workspaceRoot, resolve(workspaceRoot, path)).split(sep).join('/'),
      source: readFileSync(resolve(workspaceRoot, path), 'utf8'),
    }));
  return evaluateLegacyIdentifierInventory(inventory);
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (currentFile === invokedFile) {
  const workspaceRoot = resolve(currentFile, '..', '..');
  const result = verifyLegacyIdentifiers(workspaceRoot);
  console.log(JSON.stringify(result));
  if (result.status !== 'passed') process.exitCode = 1;
}
