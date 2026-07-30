import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const lockfile = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'));
const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const packagePathPattern = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/;
const allowedLicenses = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-3-Clause',
  'ISC',
  'MIT',
  'MIT OR Apache-2.0',
  'MPL-2.0',
]);
const allowedInstallScripts = new Map([
  ['node_modules/fsevents', '2.3.3'],
]);
const maximumLockedPackages = 150;

function fail(message) {
  throw new Error(`Dependency policy rejected: ${message}`);
}

function isValidSha512Integrity(value) {
  if (typeof value !== 'string' || !value.startsWith('sha512-')) return false;
  const encoded = value.slice('sha512-'.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;
  try {
    return Buffer.from(encoded, 'base64').length === 64;
  } catch {
    return false;
  }
}

function isReviewedRegistryTarball(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'registry.npmjs.org'
      && url.username === ''
      && url.password === ''
      && url.search === ''
      && url.hash === ''
      && url.pathname.endsWith('.tgz');
  } catch {
    return false;
  }
}

if (lockfile.lockfileVersion !== 3 || lockfile.packages === null) {
  fail('package-lock.json must use npm lockfile version 3');
}
const rootPackage = lockfile.packages[''];
if (
  rootPackage?.name !== packageJson.name
  || rootPackage?.version !== packageJson.version
  || JSON.stringify(rootPackage.dependencies ?? {}) !== JSON.stringify(packageJson.dependencies ?? {})
  || JSON.stringify(rootPackage.devDependencies ?? {}) !== JSON.stringify(packageJson.devDependencies ?? {})
) {
  fail('package.json and the lockfile root dependency declarations differ');
}

const lockedPackages = Object.entries(lockfile.packages)
  .filter(([path]) => path !== '');
if (lockedPackages.length < 1 || lockedPackages.length > maximumLockedPackages) {
  fail(`the lockfile package count must be between 1 and ${maximumLockedPackages}`);
}

const licenseCounts = new Map();
const observedInstallScripts = new Map();
for (const [path, record] of lockedPackages) {
  const packageMatch = packagePathPattern.exec(path);
  if (!packageMatch) fail(`${path} is not a canonical node_modules path`);
  if (record.link === true) fail(`${path} uses an unreviewed local link`);
  if (!exactVersionPattern.test(record.version ?? '')) {
    fail(`${path} does not resolve to an exact package version`);
  }
  if (!isReviewedRegistryTarball(record.resolved)) {
    fail(`${path} is not resolved from the reviewed HTTPS npm registry`);
  }
  if (!isValidSha512Integrity(record.integrity)) {
    fail(`${path} does not have a valid SHA-512 lockfile integrity`);
  }
  if (!allowedLicenses.has(record.license)) {
    fail(`${path} uses an unreviewed or missing license`);
  }
  licenseCounts.set(record.license, (licenseCounts.get(record.license) ?? 0) + 1);

  if (record.hasInstallScript === true) {
    if (
      allowedInstallScripts.get(path) !== record.version
      || record.dev !== true
      || record.optional !== true
      || !Array.isArray(record.os)
      || record.os.length !== 1
      || record.os[0] !== 'darwin'
    ) {
      fail(`${path} has an unreviewed install script`);
    }
    observedInstallScripts.set(path, record.version);
  }
}

for (const [path, version] of allowedInstallScripts) {
  if (observedInstallScripts.get(path) !== version) {
    fail(`reviewed install-script package ${path}@${version} is not the observed package`);
  }
}

for (const [name, version] of Object.entries({
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
})) {
  if (!exactVersionPattern.test(version)) {
    fail(`direct dependency ${name} is not pinned exactly`);
  }
  if (lockfile.packages[`node_modules/${name}`]?.version !== version) {
    fail(`direct dependency ${name} does not match its top-level locked package`);
  }
}

console.log(JSON.stringify({
  schema: 'dealivra.dependency-policy-result.v1',
  status: 'passed',
  locked_packages: lockedPackages.length,
  install_script_packages: observedInstallScripts.size,
  licenses: Object.fromEntries([...licenseCounts].sort(([left], [right]) => (
    left < right ? -1 : left > right ? 1 : 0
  ))),
}));
