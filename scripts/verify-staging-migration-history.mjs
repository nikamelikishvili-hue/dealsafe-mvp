import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const versionPattern = /^\d{14}$/;
const namePattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const shaPattern = /^[a-f0-9]{64}$/;

function reject(message) {
  throw new Error(`Staging migration history rejected: ${message}`);
}

export function evaluateStagingMigrationHistory(manifest) {
  if (manifest?.schema !== 'dealivra.staging-migration-history.v1') reject('unknown schema.');
  if (manifest?.source !== 'isolated-staging-migration-ledger') reject('untrusted source label.');
  if (!Array.isArray(manifest?.migrations) || manifest.migrations.length < 1) reject('migration list is empty.');
  if (manifest.migration_count !== manifest.migrations.length) reject('migration count does not match the list.');
  if (!shaPattern.test(String(manifest.project_ref_sha256 ?? ''))) reject('project reference must be hashed.');

  let previous = '';
  const seen = new Set();
  for (const entry of manifest.migrations) {
    if (!Array.isArray(entry) || entry.length !== 4) reject('every entry must contain version, name, bytes, and SHA-256.');
    const [version, name, bytes, sha256] = entry;
    if (!versionPattern.test(String(version))) reject(`invalid version ${version}.`);
    if (!namePattern.test(String(name))) reject(`invalid name ${name}.`);
    if (!Number.isSafeInteger(bytes) || bytes < 1) reject(`invalid byte count for ${version}.`);
    if (!shaPattern.test(String(sha256))) reject(`invalid SHA-256 for ${version}.`);
    if (previous && String(version) <= previous) reject('versions are not strictly increasing.');
    if (seen.has(version)) reject(`duplicate version ${version}.`);
    previous = String(version);
    seen.add(version);
  }

  const digest = createHash('sha256')
    .update(JSON.stringify(manifest.migrations), 'utf8')
    .digest('hex');
  return {
    schema: manifest.schema,
    status: 'passed',
    migration_count: manifest.migrations.length,
    history_sha256: digest,
  };
}

const currentFile = fileURLToPath(import.meta.url);
if (currentFile === resolve(process.argv[1] ?? '')) {
  try {
    const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
    const manifest = JSON.parse(readFileSync(resolve(root, 'docs/production-readiness/staging-migration-history-manifest.json'), 'utf8'));
    console.log(JSON.stringify(evaluateStagingMigrationHistory(manifest)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Staging migration history rejected.');
    process.exitCode = 1;
  }
}
