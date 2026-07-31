import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildServedAssetManifest,
  servedAssetManifestFile,
  servedAssetManifestSchema,
} from '../server/servedAssetIntegrityPolicy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const distRoot = resolve(root, 'dist');
const outputPath = resolve(distRoot, servedAssetManifestFile);
const commitPattern = /^[0-9a-f]{40}$/;

function fail(message) {
  throw new Error(`Served asset manifest rejected: ${message}`);
}

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1_000_000,
  }).trim();
}

function resolveInsideDist(relativePath) {
  const path = resolve(distRoot, relativePath);
  const prefix = distRoot.endsWith(sep) ? distRoot : `${distRoot}${sep}`;
  if (path !== distRoot && !path.startsWith(prefix)) {
    fail('a requested file resolved outside the build output');
  }
  return path;
}

function listFiles(relativeDirectory = '') {
  const directory = resolveInsideDist(relativeDirectory);
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    if (relativePath === servedAssetManifestFile) return [];
    if (entry.isSymbolicLink()) fail('symbolic links are not accepted');
    if (entry.isDirectory()) return listFiles(relativePath);
    if (!entry.isFile()) fail('only regular files are accepted');
    return [relativePath];
  });
}

function assetRecord(relativePath) {
  const path = resolveInsideDist(relativePath);
  if (!lstatSync(path).isFile()) fail(`${relativePath} is not a regular file`);
  const contents = readFileSync(path);
  return {
    path: relative(distRoot, path).split(sep).join('/'),
    sha256: createHash('sha256').update(contents).digest('hex'),
    bytes: statSync(path).size,
  };
}

const declaredCommits = [
  process.env.VERCEL_GIT_COMMIT_SHA?.trim(),
  process.env.GITHUB_SHA?.trim(),
  process.env.DEALIVRA_BUILD_COMMIT?.trim(),
].filter(Boolean);
if (declaredCommits.some(commit => !commitPattern.test(commit))) {
  fail('the declared source commit must be an exact lowercase commit SHA');
}
if (new Set(declaredCommits).size > 1) {
  fail('the build environment declares conflicting source commits');
}

const sourceCommit = declaredCommits[0] ?? git(['rev-parse', 'HEAD']);
if (!commitPattern.test(sourceCommit)) {
  fail('the source commit could not be resolved');
}

const files = listFiles()
  .map(assetRecord)
  .sort((left, right) => (
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  ));
const manifest = buildServedAssetManifest({
  schema: servedAssetManifestSchema,
  source_commit: sourceCommit,
  files,
});
if (!manifest) fail('the bounded served-asset policy rejected the build output');

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, {
  encoding: 'utf8',
  mode: 0o644,
});
console.log(JSON.stringify({
  schema: 'dealivra.served-asset-manifest-result.v1',
  status: 'created',
  source_commit: sourceCommit,
  asset_count: manifest.asset_count,
  total_bytes: manifest.total_bytes,
}));
