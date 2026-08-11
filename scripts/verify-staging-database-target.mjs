import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRefPattern = /^[a-z0-9]{20}$/;

function reject(message) {
  throw new Error(`Staging database target rejected: ${message}`);
}

function validatedProjectRef(value, label) {
  const normalized = String(value || '').trim();
  if (!projectRefPattern.test(normalized)) {
    reject(`${label} must be an exact Supabase project reference.`);
  }
  return normalized;
}

function validatedDatabaseUrl(value, stagingProjectRef) {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch {
    reject('the staging database URL is missing or malformed.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    reject('the staging database URL must use PostgreSQL.');
  }
  if (parsed.hostname !== `db.${stagingProjectRef}.supabase.co`) {
    reject('the database host does not match the declared staging project.');
  }
  if (parsed.pathname !== '/postgres') {
    reject('the database name must be postgres.');
  }
  if (!parsed.username || !parsed.password) {
    reject('the staging database URL must include its protected credentials.');
  }
  if (parsed.hash) {
    reject('the database URL must not contain a fragment.');
  }

  const allowedParameters = new Set(['sslmode']);
  for (const name of parsed.searchParams.keys()) {
    if (!allowedParameters.has(name)) {
      reject('the database URL contains an unreviewed connection parameter.');
    }
  }
  const sslMode = parsed.searchParams.get('sslmode');
  if (sslMode && !['require', 'verify-full'].includes(sslMode)) {
    reject('the database URL must use a reviewed TLS mode.');
  }

  return parsed;
}

export function verifyStagingDatabaseTarget(values = process.env) {
  if (values.DEALIVRA_DATABASE_ENVIRONMENT !== 'staging') {
    reject('DEALIVRA_DATABASE_ENVIRONMENT must be exactly staging.');
  }

  const stagingProjectRef = validatedProjectRef(
    values.DEALIVRA_STAGING_SUPABASE_PROJECT_REF,
    'DEALIVRA_STAGING_SUPABASE_PROJECT_REF',
  );
  const productionProjectRef = validatedProjectRef(
    values.DEALIVRA_PRODUCTION_SUPABASE_PROJECT_REF,
    'DEALIVRA_PRODUCTION_SUPABASE_PROJECT_REF',
  );
  if (stagingProjectRef === productionProjectRef) {
    reject('staging and Production must use different Supabase projects.');
  }

  validatedDatabaseUrl(values.DEALIVRA_STAGING_DATABASE_URL, stagingProjectRef);

  return {
    schema: 'dealivra.staging-database-target.v1',
    status: 'passed',
    environment: 'staging',
    project_separation: 'verified',
    direct_database_host: 'verified',
    tls: 'required',
  };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (currentFile === invokedFile) {
  try {
    console.log(JSON.stringify(verifyStagingDatabaseTarget()));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Staging database target rejected.');
    process.exitCode = 1;
  }
}
