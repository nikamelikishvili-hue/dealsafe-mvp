import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationNamePattern = /^\d{14}_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;
const baselineNamePattern = /^\d{14}_dealivra_staging_baseline\.sql$/;
const forbiddenContent = [
  { pattern: /\binsert\s+into\s+(?:auth\.)?users\b/i, reason: 'Auth user data' },
  { pattern: /\b(?:postgres(?:ql)?):\/\/[^\s'\"]+/i, reason: 'a database connection URL' },
  { pattern: /\b(?:service_role|SUPABASE_SERVICE_ROLE_KEY)\s*[=:]\s*['\"][^'\"]+/i, reason: 'a privileged API credential' },
  { pattern: /\bcreate\s+extension\b[\s\S]{0,160}\bversion\s+['\"][^'\"]+['\"]/i, reason: 'a deprecated extension version pin' },
];

function reject(message) {
  throw new Error(`Database baseline rejected: ${message}`);
}

export function evaluateDatabaseBaseline(files) {
  if (!Array.isArray(files) || files.length < 1) {
    reject('no timestamped migration files were found.');
  }

  const ordered = [...files].sort((left, right) => left.name.localeCompare(right.name));
  if (!baselineNamePattern.test(ordered[0].name)) {
    reject('the first migration must be the CLI-generated Dealivra Staging baseline.');
  }

  const seenNames = new Set();
  const seenTimestamps = new Set();
  const manifest = [];
  for (const file of ordered) {
    if (!migrationNamePattern.test(file.name)) {
      reject(`${file.name} is not a canonical timestamped migration name.`);
    }
    const timestamp = file.name.slice(0, 14);
    if (seenNames.has(file.name) || seenTimestamps.has(timestamp)) {
      reject(`${file.name} has a duplicate name or timestamp.`);
    }
    seenNames.add(file.name);
    seenTimestamps.add(timestamp);

    const content = String(file.content ?? '');
    if (content.trim().length < 1) reject(`${file.name} is empty.`);
    for (const forbidden of forbiddenContent) {
      if (forbidden.pattern.test(content)) {
        reject(`${file.name} contains ${forbidden.reason}.`);
      }
    }
    manifest.push({
      name: file.name,
      bytes: Buffer.byteLength(content, 'utf8'),
      sha256: createHash('sha256').update(content, 'utf8').digest('hex'),
    });
  }

  return {
    schema: 'dealivra.database-baseline-manifest.v1',
    status: 'passed',
    migration_count: manifest.length,
    migrations: manifest,
  };
}

function loadMigrations(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => ({
      name: entry.name,
      content: readFileSync(resolve(directory, entry.name), 'utf8'),
    }));
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (currentFile === invokedFile) {
  try {
    const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
    const migrations = loadMigrations(resolve(root, 'supabase', 'migrations'));
    if (migrations.length === 0 && process.argv.includes('--allow-missing')) {
      console.log(JSON.stringify({
        schema: 'dealivra.database-baseline-manifest.v1',
        status: 'pending',
        reason: 'cli_generated_baseline_missing',
      }));
    } else {
      console.log(JSON.stringify(evaluateDatabaseBaseline(migrations)));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Database baseline rejected.');
    process.exitCode = 1;
  }
}
