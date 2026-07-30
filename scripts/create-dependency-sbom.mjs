import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDependencySbom,
  serializeDependencySbom,
} from '../server/dependencySbomPolicy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputPath = resolve(root, 'release-evidence/dependency-sbom.cdx.json');
const digestPath = resolve(root, 'release-evidence/dependency-sbom.cdx.sha256');

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));
  } catch {
    throw new Error(`Dependency SBOM rejected: ${relativePath} is not valid JSON`);
  }
}

const packageJson = readJson('package.json');
const lockfile = readJson('package-lock.json');
const sbom = buildDependencySbom(packageJson, lockfile);
if (!sbom) {
  throw new Error('Dependency SBOM rejected: the lockfile inventory is invalid');
}
const serialized = serializeDependencySbom(sbom);
if (!serialized || Buffer.byteLength(serialized, 'utf8') > 2_000_000) {
  throw new Error('Dependency SBOM rejected: the canonical document is invalid or excessive');
}
const digest = createHash('sha256').update(serialized).digest('hex');

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, serialized, { encoding: 'utf8', mode: 0o600 });
writeFileSync(digestPath, `${digest}  dependency-sbom.cdx.json\n`, {
  encoding: 'utf8',
  mode: 0o600,
});
console.log(JSON.stringify({
  schema: 'dealivra.dependency-sbom-result.v1',
  status: 'created',
  format: 'CycloneDX',
  spec_version: sbom.specVersion,
  components: sbom.components.length,
  sha256: digest,
}));
