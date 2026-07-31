import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildReleaseEvidence,
  requiredReleaseChecks,
} from '../server/releaseEvidencePolicy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = resolve(root, 'release-evidence');
const outputPath = resolve(outputDirectory, 'release-evidence.json');
const digestPath = resolve(outputDirectory, 'release-evidence.sha256');
const commitPattern = /^[0-9a-f]{40}$/;

function fail(message) {
  throw new Error(`Release evidence rejected: ${message}`);
}

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1_000_000,
  }).trim();
}

function resolveInside(relativePath) {
  const path = resolve(root, relativePath);
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (path !== root && !path.startsWith(prefix)) {
    fail('a requested file resolved outside the repository');
  }
  return path;
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(resolveInside(relativePath), 'utf8'));
  } catch {
    fail(`${relativePath} is not valid JSON`);
  }
}

function listFiles(relativeDirectory) {
  const directory = resolveInside(relativeDirectory);
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isSymbolicLink()) fail('symbolic links are not accepted');
    if (entry.isDirectory()) return listFiles(relativePath);
    if (!entry.isFile()) fail('only regular files are accepted');
    return [relativePath];
  });
}

function evidenceFile(relativePath) {
  const path = resolveInside(relativePath);
  if (!lstatSync(path).isFile()) fail(`${relativePath} is not a regular file`);
  const bytes = statSync(path).size;
  const sha256 = createHash('sha256').update(readFileSync(path)).digest('hex');
  return {
    path: relative(root, path).split(sep).join('/'),
    sha256,
    bytes,
  };
}

const requestedCommit = process.env.DEALIVRA_RELEASE_COMMIT?.trim() ?? '';
const workflowCommit = process.env.GITHUB_SHA?.trim() ?? '';
if (!commitPattern.test(requestedCommit)) {
  fail('DEALIVRA_RELEASE_COMMIT must be an exact lowercase commit SHA');
}
if (!commitPattern.test(workflowCommit) || workflowCommit !== requestedCommit) {
  fail('the GitHub workflow and requested commit do not match');
}
if (git(['rev-parse', 'HEAD']) !== requestedCommit) {
  fail('the checked-out source is not the requested commit');
}
if (git(['status', '--porcelain=v1', '--untracked-files=all']) !== '') {
  fail('the repository contains uncommitted or untracked source changes');
}

const packageJson = readJson('package.json');
const supportedNode = packageJson.engines?.node;
const nvmNode = readFileSync(resolveInside('.nvmrc'), 'utf8').trim();
const runningNode = process.versions.node.split('.')[0];
if (supportedNode !== `${runningNode}.x` || nvmNode !== runningNode) {
  fail('the running Node release does not match package.json and .nvmrc');
}

const activeCatalog = readJson('catalog/active-release.json');
if (
  activeCatalog.schemaVersion !== 1
  || typeof activeCatalog.catalogVersion !== 'string'
  || typeof activeCatalog.manifest !== 'string'
) {
  fail('the active catalog pointer is invalid');
}

const selectedFiles = [
  '.github/CODEOWNERS',
  '.github/workflows/ci.yml',
  '.github/workflows/codeql.yml',
  '.nvmrc',
  'catalog/active-release.json',
  activeCatalog.manifest,
  'docs/production-readiness/07_TEST_RELEASE_GATES.md',
  'docs/production-readiness/11_LEGACY_IDENTIFIER_REGISTER.md',
  'package-lock.json',
  'package.json',
  'release-evidence/dependency-sbom.cdx.json',
  'scripts/create-dependency-sbom.mjs',
  'scripts/create-release-evidence.mjs',
  'scripts/run-incident-control-drill.mjs',
  'scripts/scan-repository-secrets.mjs',
  'scripts/validate-catalog-release.mjs',
  'scripts/verify-browser-storage-policy.mjs',
  'scripts/verify-build-budgets.mjs',
  'scripts/verify-dependency-policy.mjs',
  'scripts/verify-outbound-transport-policy.mjs',
  'scripts/verify-runtime-configuration.mjs',
  'scripts/verify-legacy-identifiers.mjs',
  'server/dependencySbomPolicy.mjs',
  'server/legacyIdentifierPolicy.mjs',
  'server/releaseEvidencePolicy.mjs',
  'server/runtimeConfigurationPolicy.mjs',
  'src/catalog.v1.json',
  'vercel.json',
  'vite.config.ts',
  ...listFiles('dist'),
];

const files = [...new Set(selectedFiles)]
  .map(evidenceFile)
  .sort((left, right) => (
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  ));
const evidence = buildReleaseEvidence({
  schema: 'dealivra.release-evidence.v1',
  commit: requestedCommit,
  node: supportedNode,
  catalog_version: activeCatalog.catalogVersion,
  checks: [...requiredReleaseChecks],
  files,
});
if (!evidence) fail('the bounded evidence policy rejected the generated manifest');

const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
const digest = createHash('sha256').update(serialized).digest('hex');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, serialized, { encoding: 'utf8', mode: 0o600 });
writeFileSync(digestPath, `${digest}  release-evidence.json\n`, {
  encoding: 'utf8',
  mode: 0o600,
});
console.log(JSON.stringify({
  schema: 'dealivra.release-evidence-result.v1',
  status: 'created',
  commit: requestedCommit,
  files: evidence.files.length,
  manifest_sha256: digest,
}));
