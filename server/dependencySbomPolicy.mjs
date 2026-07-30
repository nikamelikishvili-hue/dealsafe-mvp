import { createHash } from 'node:crypto';

const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const packagePathPattern = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/;
const sha512IntegrityPattern = /^sha512-([A-Za-z0-9+/]+={0,2})$/;
const safePackageNamePattern = /^(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i;
const reviewedLicenses = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-3-Clause',
  'ISC',
  'MIT',
  'MIT OR Apache-2.0',
  'MPL-2.0',
]);
const maximumLockedPackages = 150;
const maximumDependencyNames = 80;

function hasExactKeys(value, expected) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length === expected.length
    && expected.every(key => Object.hasOwn(value, key));
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalSource(packageJson, lockfile) {
  return `${JSON.stringify(canonicalize({
    package: {
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private === true,
      dependencies: packageJson.dependencies ?? {},
      devDependencies: packageJson.devDependencies ?? {},
    },
    lockfile,
  }))}\n`;
}

function deterministicUuid(hexDigest) {
  const characters = hexDigest.slice(0, 32).split('');
  characters[12] = '5';
  characters[16] = ['8', '9', 'a', 'b'][Number.parseInt(characters[16], 16) % 4];
  const value = characters.join('');
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20, 32),
  ].join('-');
}

function packagePurl(name, version) {
  const encodedName = name.startsWith('@')
    ? `%40${name.slice(1).split('/').map(encodeURIComponent).join('/')}`
    : encodeURIComponent(name);
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}

function dependencyNames(record) {
  const names = new Set([
    ...Object.keys(record.dependencies ?? {}),
    ...Object.keys(record.optionalDependencies ?? {}),
    ...Object.keys(record.peerDependencies ?? {}),
  ]);
  return [...names].sort();
}

function resolveDependencyPath(packages, packagePath, dependencyName) {
  let cursor = packagePath;
  while (true) {
    const candidate = cursor === ''
      ? `node_modules/${dependencyName}`
      : `${cursor}/node_modules/${dependencyName}`;
    if (Object.hasOwn(packages, candidate)) return candidate;
    const parentIndex = cursor.lastIndexOf('/node_modules/');
    if (parentIndex >= 0) {
      cursor = cursor.slice(0, parentIndex);
      continue;
    }
    if (cursor !== '') {
      cursor = '';
      continue;
    }
    return null;
  }
}

function packageIdentity(path, record) {
  const match = packagePathPattern.exec(path);
  if (!match || !safePackageNamePattern.test(match[1])) return null;
  if (!exactVersionPattern.test(record.version ?? '')) return null;
  return {
    name: match[1],
    version: record.version,
    ref: `${match[1]}@${record.version}`,
  };
}

function sha512Hex(integrity) {
  const match = sha512IntegrityPattern.exec(integrity ?? '');
  if (!match) return null;
  try {
    const bytes = Buffer.from(match[1], 'base64');
    return bytes.length === 64 ? bytes.toString('hex') : null;
  } catch {
    return null;
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

export function buildDependencySbom(packageJson, lockfile) {
  if (
    packageJson === null
    || typeof packageJson !== 'object'
    || Array.isArray(packageJson)
    || typeof packageJson.name !== 'string'
    || !safePackageNamePattern.test(packageJson.name)
    || !exactVersionPattern.test(packageJson.version ?? '')
    || packageJson.private !== true
  ) {
    return null;
  }
  if (
    lockfile === null
    || typeof lockfile !== 'object'
    || Array.isArray(lockfile)
    || lockfile.lockfileVersion !== 3
    || lockfile.packages === null
    || typeof lockfile.packages !== 'object'
    || Array.isArray(lockfile.packages)
  ) {
    return null;
  }

  const rootPackage = lockfile.packages[''];
  if (
    rootPackage?.name !== packageJson.name
    || rootPackage?.version !== packageJson.version
    || JSON.stringify(rootPackage.dependencies ?? {})
      !== JSON.stringify(packageJson.dependencies ?? {})
    || JSON.stringify(rootPackage.devDependencies ?? {})
      !== JSON.stringify(packageJson.devDependencies ?? {})
  ) {
    return null;
  }

  const packageEntries = Object.entries(lockfile.packages)
    .filter(([path]) => path !== '')
    .sort(([left], [right]) => (
      left < right ? -1 : left > right ? 1 : 0
    ));
  if (
    packageEntries.length < 1
    || packageEntries.length > maximumLockedPackages
  ) {
    return null;
  }

  const identities = new Map();
  const refs = new Set();
  for (const [path, record] of packageEntries) {
    if (
      record === null
      || typeof record !== 'object'
      || Array.isArray(record)
      || record.link === true
      || !isReviewedRegistryTarball(record.resolved)
      || !reviewedLicenses.has(record.license)
    ) {
      return null;
    }
    const identity = packageIdentity(path, record);
    const integrity = sha512Hex(record.integrity);
    if (!identity || !integrity || refs.has(identity.ref)) return null;
    if (dependencyNames(record).length > maximumDependencyNames) return null;
    identities.set(path, { ...identity, integrity });
    refs.add(identity.ref);
  }

  const components = packageEntries
    .map(([path, record]) => {
      const identity = identities.get(path);
      return {
        'bom-ref': identity.ref,
        type: 'library',
        name: identity.name,
        version: identity.version,
        scope: record.optional === true ? 'optional' : 'required',
        purl: packagePurl(identity.name, identity.version),
        hashes: [{
          alg: 'SHA-512',
          content: identity.integrity,
        }],
        licenses: record.license.includes(' OR ')
          ? [{ expression: record.license }]
          : [{ license: { id: record.license } }],
        properties: [{
          name: 'cdx:npm:package:development',
          value: record.dev === true ? 'true' : 'false',
        }],
        externalReferences: [{
          type: 'distribution',
          url: record.resolved,
        }],
      };
    })
    .sort((left, right) => (
      left['bom-ref'] < right['bom-ref']
        ? -1
        : left['bom-ref'] > right['bom-ref'] ? 1 : 0
    ));

  const rootRef = `${packageJson.name}@${packageJson.version}`;
  if (refs.has(rootRef)) return null;
  const rootDependencies = Object.keys({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  })
    .sort()
    .map(name => resolveDependencyPath(lockfile.packages, '', name))
    .map(path => path && identities.get(path)?.ref)
    .filter(Boolean);
  if (
    rootDependencies.length
    !== Object.keys({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    }).length
  ) {
    return null;
  }

  const dependencies = [
    {
      ref: rootRef,
      dependsOn: rootDependencies,
    },
    ...packageEntries.map(([path, record]) => {
      const dependsOn = dependencyNames(record)
        .map(name => resolveDependencyPath(lockfile.packages, path, name))
        .map(dependencyPath => (
          dependencyPath ? identities.get(dependencyPath)?.ref : null
        ))
        .filter(Boolean);
      return {
        ref: identities.get(path).ref,
        dependsOn: [...new Set(dependsOn)].sort(),
      };
    }),
  ].sort((left, right) => (
    left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0
  ));

  const sourceSha256 = createHash('sha256')
    .update(canonicalSource(packageJson, lockfile))
    .digest('hex');
  return {
    $schema: 'http://cyclonedx.org/schema/bom-1.5.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${deterministicUuid(sourceSha256)}`,
    version: 1,
    metadata: {
      lifecycles: [{
        phase: 'pre-build',
      }],
      tools: [{
        vendor: 'Dealivra',
        name: 'deterministic-lockfile-sbom',
        version: '1',
      }],
      component: {
        'bom-ref': rootRef,
        type: 'application',
        name: packageJson.name,
        version: packageJson.version,
        scope: 'required',
        purl: packagePurl(packageJson.name, packageJson.version),
        properties: [{
          name: 'dealivra:sbom:source-sha256',
          value: sourceSha256,
        }],
      },
    },
    components,
    dependencies,
  };
}

export function serializeDependencySbom(sbom) {
  if (!hasExactKeys(sbom, [
    '$schema',
    'bomFormat',
    'specVersion',
    'serialNumber',
    'version',
    'metadata',
    'components',
    'dependencies',
  ])) {
    return null;
  }
  return `${JSON.stringify(sbom, null, 2)}\n`;
}
