import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

export const approvedRollbackSuites = Object.freeze([
  'authenticated_rpc_cross_role_rollback.sql',
  'canonical_agreement_record_rollback.sql',
  'database_security_contract_rollback.sql',
  'evidence_file_security_rollback.sql',
  'evidence_integrity_inventory_rollback.sql',
  'evidence_lifecycle_governance_rollback.sql',
  'foreign_key_hot_path_indexes_rollback.sql',
  'immutable_material_audit_events_rollback.sql',
  'mfa_assurance_enforcement_rollback.sql',
  'mfa_password_only_negative_matrix_rollback.sql',
  'payment_provider_observability_rollback.sql',
  'private_evidence_maintenance_settings_rls_rollback.sql',
  'privileged_mfa_recovery_control_rollback.sql',
  'rls_auth_initplan_optimization_rollback.sql',
  'security_definer_advisor_hardening_rollback.sql',
  'stripe_trusted_payment_commands_rollback.sql',
  'support_case_authorization_rollback.sql',
]);

function checkedLocalFile(root, segments) {
  let current = root;
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || (index === segments.length - 1 ? !stat.isFile() : !stat.isDirectory())) {
      throw new Error('The local proof requires ordinary reviewed SQL files, not links or directories.');
    }
  }
  return current;
}

function localProcessEnvironment(source) {
  const env = {};
  for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) {
    const matches = Object.entries(source).filter(
      ([key, value]) => key.toLowerCase() === name.toLowerCase() && typeof value === 'string',
    );
    if (new Set(matches.map(([, value]) => value)).size > 1) {
      throw new Error('Conflicting operating-system environment names are not allowed.');
    }
    if (matches.length) env[name] = matches[0][1];
  }
  // Never forward hosted credentials, libpq service settings, or preload hooks.
  // This is the disposable Supabase CLI database's public local default, not a hosted secret.
  env.PGPASSWORD = 'postgres';
  env.PGCONNECT_TIMEOUT = '5';
  env.PGOPTIONS =
    '-c statement_timeout=20000 -c lock_timeout=2000 -c dealivra.local_fixture_bootstrap=on -c application_name=dealivra-local-rollback-proof';
  return env;
}

export function createLocalRollbackPlan({
  argv = process.argv.slice(2),
  env = process.env,
  root = repositoryRoot,
} = {}) {
  if (!Array.isArray(argv) || argv.length !== 1 || argv[0] !== '--local-disposable') {
    throw new Error('Explicit --local-disposable confirmation is required; target overrides are not supported.');
  }
  let files;
  try {
    const localRoot = realpathSync(root);
    const fixture = checkedLocalFile(localRoot, ['supabase', 'tests', 'fixtures', 'local-authorization-bootstrap.sql']);
    const suiteRoot = join(localRoot, 'supabase', 'tests');
    const names = readdirSync(suiteRoot)
      .filter(name => name.endsWith('_rollback.sql'))
      .sort();
    if (JSON.stringify(names) !== JSON.stringify(approvedRollbackSuites)) {
      throw new Error('Unexpected rollback inventory.');
    }
    files = [fixture, ...approvedRollbackSuites.map(name => checkedLocalFile(localRoot, ['supabase', 'tests', name]))];
  } catch {
    throw new Error(
      'The local proof requires its bootstrap and exactly the 17 reviewed rollback suites as ordinary files.',
    );
  }
  return { files, env: localProcessEnvironment(env) };
}

export function safeLocalFailure(result) {
  const stderr = typeof result?.stderr === 'string' ? result.stderr : '';
  const state = stderr.match(/\b(?:ERROR|FATAL):\s+([0-9A-Z]{5}):/);
  const line = stderr.match(/\.sql:(\d{1,6}):\s+(?:ERROR|FATAL):/);
  const processCode = ['ENOENT', 'EACCES', 'EPERM', 'ETIMEDOUT'].includes(result?.error?.code)
    ? result.error.code : 'unclassified';
  const rules = [
    ['DAT-004 signed-in SECURITY DEFINER inventory changed', 'rpc-inventory'],
    ['DAT-004 signed-in function grants or search paths are not exact', 'rpc-grants'],
    ['DAT-004 signed-in function lacks a reviewed identity boundary', 'rpc-identity'],
    ['requires the complete reviewed schema', 'missing-schema'],
    ['requires the reviewed helper dependencies', 'missing-helper'],
    ['refuses existing configuration or Storage data', 'existing-configuration'],
    ['refuses queued network requests', 'network-queue'],
    ['refuses existing Auth data', 'existing-auth'],
    ['refuses foreign application tables', 'foreign-table'],
    ['refuses existing application data', 'existing-data'],
    ['refuses unexpected mutation triggers', 'unexpected-trigger'],
    ['Local Cron must support inactive fixture registrations', 'cron-capability'],
    ['Local authenticator has an unexpected pre-request configuration', 'authenticator-setting'],
    ['Local initial-agreement trigger did not create both snapshots', 'agreement-trigger'],
    ['Local maintenance fixtures failed their isolated safety boundary', 'maintenance-boundary'],
    ['Local synthetic fixture inventory failed', 'fixture-inventory'],
    ['Local disposable fixture authorization is required', 'local-authorization'],
  ];
  const rule = rules.find(([message]) => stderr.includes(message))?.[1] ?? 'unclassified';
  return `SQLSTATE=${state?.[1] ?? 'unknown'}; line=${line?.[1] ?? 'unknown'}; process=${processCode}; guard=${rule}`;
}

export function runLocalRollbackProof({ argv, env, root = repositoryRoot, run = spawnSync } = {}) {
  const plan = createLocalRollbackPlan({ argv, env, root });
  for (const file of plan.files) {
    let result;
    try {
      result = run(
        'psql',
        [
          '--host=127.0.0.1',
          '--port=54322',
          '--username=postgres',
          '--dbname=postgres',
          '--no-password',
          '-X',
          '--set=ON_ERROR_STOP=1',
          '--set=VERBOSITY=verbose',
          '--quiet',
          `--file=${file}`,
        ],
        {
          cwd: resolve(root),
          env: { ...plan.env },
          shell: false,
          encoding: 'utf8',
          timeout: 90_000,
          maxBuffer: 1_048_576,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
    } catch {
      // Native errors can contain environment values or SQL data. Do not relay them.
      result = null;
    }
    if (!result || result.status !== 0 || result.error || result.signal) {
      throw new Error(
        `Local database proof failed at ${basename(file)}. ${safeLocalFailure(result)}. No later suite was run. Database output is withheld to protect fixture secrets.`,
      );
    }
  }
  return { fixture: 'passed', suites: [...approvedRollbackSuites], total: approvedRollbackSuites.length };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    console.log(JSON.stringify(runLocalRollbackProof(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
