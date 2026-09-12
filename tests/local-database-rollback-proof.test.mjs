import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  approvedRollbackSuites,
  createLocalRollbackPlan,
  runLocalRollbackProof,
  safeLocalFailure,
} from '../scripts/run-local-database-rollback-proof.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratchParent = join(repositoryRoot, 'tmp');
const fixturePath = 'supabase/tests/fixtures/local-authorization-bootstrap.sql';
const expectedSuites = [
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
];
const expectedPgOptions =
  '-c statement_timeout=20000 -c lock_timeout=2000 -c dealivra.local_fixture_bootstrap=on -c application_name=dealivra-local-rollback-proof';
const privateSentinel = 'synthetic-private-diagnostic-sentinel';
const remoteSentinel = 'postgresql://private-user:synthetic-private-password@remote.example.invalid:5432/customer';

function fakeRepository(t) {
  mkdirSync(scratchParent, { recursive: true });
  const root = mkdtempSync(join(scratchParent, 'local-rollback-proof-'));
  t.after(() => {
    assert.equal(dirname(root), scratchParent);
    assert.ok(basename(root).startsWith('local-rollback-proof-'));
    rmSync(root, { recursive: true, force: true });
  });
  mkdirSync(join(root, 'supabase', 'tests', 'fixtures'), { recursive: true });
  for (const file of [fixturePath, ...expectedSuites.map(name => `supabase/tests/${name}`)]) {
    writeFileSync(join(root, file), '-- Synthetic runner test fixture; never executed.\n', 'utf8');
  }
  return root;
}
const options = (root, overrides = {}) => ({ argv: ['--local-disposable'], env: {}, root, ...overrides });
function assertSanitizedFailure(operation) {
  assert.throws(operation, error => {
    assert.ok(error instanceof Error);
    assert.ok(error.message.length > 0);
    for (const sentinel of [privateSentinel, remoteSentinel, 'synthetic-private-password']) {
      assert.ok(!error.message.includes(sentinel));
    }
    return true;
  });
}

test('local rollback proof pins and freezes its exact sorted 17-suite inventory', () => {
  assert.deepEqual(approvedRollbackSuites, expectedSuites);
  assert.equal(Object.isFrozen(approvedRollbackSuites), true);
  assert.deepEqual([...approvedRollbackSuites].sort(), expectedSuites);
  assert.throws(() => approvedRollbackSuites.push('injected_rollback.sql'), TypeError);
  assert.throws(() => {
    approvedRollbackSuites[0] = 'injected_rollback.sql';
  }, TypeError);
});

test('checked-in local fixture stays explicit, transactional and separate from migrations', () => {
  const plan = createLocalRollbackPlan(options(repositoryRoot));
  assert.equal(plan.files.length, 18);
  const sql = readFileSync(plan.files[0], 'utf8');
  assert.match(sql, /current_setting\('dealivra\.local_fixture_bootstrap', true\)/);
  assert.match(sql, /current_user <> 'postgres'/);
  assert.match(sql, /refuses existing Auth data/);
  assert.match(sql, /refuses existing application data/);
  assert.match(sql, /refuses existing configuration or Storage data/);
  assert.ok(sql.indexOf('$fresh_local_database_required$;') < sql.indexOf('insert into auth.users'));
  assert.equal((sql.match(/^begin;$/gm) || []).length, 1);
  assert.equal((sql.match(/^commit;$/gm) || []).length, 1);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /cron\.alter_job\(job_id := inventory_job_id, active := false\)/);
  assert.match(sql, /cron\.alter_job\(job_id := worker_job_id, active := false\)/);
  assert.doesNotMatch(sql, /update\s+cron\.job/i);
  assert.match(sql, /where active or command <> 'select 1'/);
  assert.match(sql, /@example\.invalid/);
  assert.doesNotMatch(sql, /\b(?:truncate|delete\s+from|grant|revoke|disable\s+trigger)\b/i);
  assert.doesNotMatch(sql, /\bnet\.(?:http_post|http_get)\s*\(/i);
  assert.doesNotMatch(sql, /\binsert\s+into\s+auth\.(?:sessions|mfa_factors|identities)\b/i);
});

test('local rollback proof requires exactly one explicit local flag before any subprocess', t => {
  const root = fakeRepository(t);
  for (const argv of [
    [],
    ['--local-disposable', '--local-disposable'],
    ['--local-disposable', '--host=remote.example.invalid'],
    ['--host=remote.example.invalid', '--local-disposable'],
    ['--local-disposable', '--port=5433'],
    ['--local-disposable', '--dbname=customer'],
    ['--local-disposable', '--linked'],
    ['--local-disposable', '--'],
    ['--local-disposable', remoteSentinel],
    ['--local-disposable=true'],
    [' --local-disposable'],
    ['--local-disposable '],
    ['--LOCAL-DISPOSABLE'],
    '--local-disposable',
    null,
    {},
  ]) {
    let calls = 0;
    assertSanitizedFailure(() =>
      runLocalRollbackProof(
        options(root, {
          argv,
          run: () => {
            calls++;
            return { status: 0 };
          },
        }),
      ),
    );
    assert.equal(calls, 0);
  }
});

test('local rollback plan is absolute and bootstrap-first without changing inputs', t => {
  const root = fakeRepository(t);
  const argv = Object.freeze(['--local-disposable']);
  const env = Object.freeze({ PATH: 'synthetic-tool-path', SUPABASE_ACCESS_TOKEN: privateSentinel });
  const plan = createLocalRollbackPlan({ argv, env, root });
  assert.deepEqual(plan.files, [
    join(root, fixturePath),
    ...expectedSuites.map(name => join(root, 'supabase', 'tests', name)),
  ]);
  assert.deepEqual(argv, ['--local-disposable']);
  assert.deepEqual(env, { PATH: 'synthetic-tool-path', SUPABASE_ACCESS_TOKEN: privateSentinel });
  assert.ok(!JSON.stringify(plan).includes(privateSentinel));
});

test('local rollback plan strips provider and libpq configuration and forces local settings', t => {
  const root = fakeRepository(t);
  const poisoned = {
    pAtH: 'synthetic-tool-path',
    systemroot: 'synthetic-system-root',
    windir: 'synthetic-windows-directory',
    temp: 'synthetic-temp',
    Tmp: 'synthetic-tmp',
  };
  for (const key of [
    'PGHOST',
    'PGHOSTADDR',
    'PGPORT',
    'PGDATABASE',
    'PGUSER',
    'PGPASSWORD',
    'PGOPTIONS',
    'PGCONNECT_TIMEOUT',
    'PGSERVICE',
    'PGSERVICEFILE',
    'PGPASSFILE',
    'PGSYSCONFDIR',
    'PGSSLMODE',
    'PGSSLROOTCERT',
    'PSQLRC',
    'HOME',
    'USERPROFILE',
    'DATABASE_URL',
    'DEALIVRA_STAGING_DATABASE_URL',
    'DEALIVRA_DATABASE_ENVIRONMENT',
    'SUPABASE_URL',
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_DB_PASSWORD',
    'NODE_OPTIONS',
    'LD_PRELOAD',
    'DYLD_INSERT_LIBRARIES',
  ]) {
    poisoned[key] = remoteSentinel;
    poisoned[key.toLowerCase()] = privateSentinel;
  }
  const snapshot = { ...poisoned };
  assert.deepEqual(createLocalRollbackPlan(options(root, { env: poisoned })).env, {
    PATH: 'synthetic-tool-path',
    SystemRoot: 'synthetic-system-root',
    WINDIR: 'synthetic-windows-directory',
    TEMP: 'synthetic-temp',
    TMP: 'synthetic-tmp',
    PGPASSWORD: 'postgres',
    PGCONNECT_TIMEOUT: '5',
    PGOPTIONS: expectedPgOptions,
  });
  assert.deepEqual(poisoned, snapshot);
});

test('local rollback plan rejects conflicting Windows PATH names and canonicalizes equal duplicates', t => {
  const root = fakeRepository(t);
  assert.throws(
    () => createLocalRollbackPlan(options(root, { env: { PATH: 'first-path', Path: 'other-path' } })),
    /Conflicting/,
  );
  const plan = createLocalRollbackPlan(
    options(root, { env: { PATH: 'same-path', Path: 'same-path', path: 'same-path' } }),
  );
  assert.deepEqual(
    Object.keys(plan.env).filter(key => key.toLowerCase() === 'path'),
    ['PATH'],
  );
  assert.equal(plan.env.PATH, 'same-path');
});

test('local rollback proof invokes only fixed bounded psql commands and returns status-only success', t => {
  const root = fakeRepository(t);
  const env = { PATH: 'synthetic-tool-path', SUPABASE_ACCESS_TOKEN: privateSentinel };
  const plan = createLocalRollbackPlan(options(root, { env }));
  const calls = [];
  const result = runLocalRollbackProof(
    options(root, {
      env,
      run(command, args, spawnOptions) {
        calls.push({ command, args, spawnOptions });
        return { status: 0, signal: null, stdout: privateSentinel, stderr: remoteSentinel };
      },
    }),
  );
  assert.equal(calls.length, 18);
  for (const [index, call] of calls.entries()) {
    assert.equal(call.command, 'psql');
    assert.deepEqual(call.args, [
      '--host=127.0.0.1',
      '--port=54322',
      '--username=postgres',
      '--dbname=postgres',
      '--no-password',
      '-X',
      '--set=ON_ERROR_STOP=1',
      '--set=VERBOSITY=verbose',
      '--quiet',
      `--file=${plan.files[index]}`,
    ]);
    assert.deepEqual(call.spawnOptions, {
      env: plan.env,
      cwd: root,
      shell: false,
      encoding: 'utf8',
      timeout: 90_000,
      maxBuffer: 1_048_576,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  assert.deepEqual(result, { fixture: 'passed', suites: expectedSuites, total: 17 });
  assert.ok(!JSON.stringify(result).includes(privateSentinel));
  assert.ok(!JSON.stringify(result).includes(remoteSentinel));
});

test('local rollback proof rejects missing, extra and replaced suites before bootstrap', t => {
  for (const alteration of ['missing-fixture', 'missing-suite', 'extra-suite', 'replaced-suite', 'suite-directory']) {
    const root = fakeRepository(t);
    const firstSuite = join(root, 'supabase', 'tests', expectedSuites[0]);
    if (alteration === 'missing-fixture') rmSync(join(root, fixturePath));
    if (['missing-suite', 'replaced-suite', 'suite-directory'].includes(alteration)) rmSync(firstSuite);
    if (['extra-suite', 'replaced-suite'].includes(alteration))
      writeFileSync(join(root, 'supabase', 'tests', 'unexpected_rollback.sql'), '-- Not approved.\n');
    if (alteration === 'suite-directory') mkdirSync(firstSuite);
    let calls = 0;
    assertSanitizedFailure(() =>
      runLocalRollbackProof(
        options(root, {
          run: () => {
            calls++;
            return { status: 0 };
          },
        }),
      ),
    );
    assert.equal(calls, 0, alteration);
  }
});

test('local rollback proof rejects a suite symlink outside its approved root', t => {
  const root = fakeRepository(t);
  const outside = fakeRepository(t);
  const suite = join(root, 'supabase', 'tests', expectedSuites[0]);
  rmSync(suite);
  try {
    symlinkSync(join(outside, 'supabase', 'tests', expectedSuites[0]), suite, 'file');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) {
      t.skip('Unprivileged symlinks are unavailable on this platform.');
      return;
    }
    throw error;
  }
  let calls = 0;
  assertSanitizedFailure(() =>
    runLocalRollbackProof(
      options(root, {
        run: () => {
          calls++;
          return { status: 0 };
        },
      }),
    ),
  );
  assert.equal(calls, 0);
});

test('local rollback proof aborts at every failed stage without retry or diagnostic leakage', t => {
  const root = fakeRepository(t);
  const failures = [
    { status: 1 },
    { status: 2 },
    { status: null },
    { status: null, signal: 'SIGTERM' },
    { status: null, error: Object.assign(new Error(privateSentinel), { code: 'ETIMEDOUT' }) },
    { status: null, error: Object.assign(new Error(remoteSentinel), { code: 'ENOENT' }) },
    { status: 0, signal: 'SIGTERM' },
    { status: 0, error: new Error(privateSentinel) },
    {},
    null,
    undefined,
  ];
  for (const failureIndex of [0, 1, 9, 17]) {
    for (const failure of failures) {
      let calls = 0;
      assertSanitizedFailure(() =>
        runLocalRollbackProof(
          options(root, {
            run() {
              if (calls++ !== failureIndex) return { status: 0 };
              return failure == null ? failure : { ...failure, stdout: privateSentinel, stderr: remoteSentinel };
            },
          }),
        ),
      );
      assert.equal(calls, failureIndex + 1);
    }
  }
});

test('local failure diagnostics expose only codes and fixed guard categories', () => {
  const result = safeLocalFailure({ stderr: `psql:/private/local.sql:213: ERROR:  P0001: Local fixture bootstrap requires the complete reviewed schema\nDETAIL: ${remoteSentinel}`, error: { code: 'ENOENT' } });
  assert.equal(result, 'SQLSTATE=P0001; line=213; process=ENOENT; guard=missing-schema');
  assert.equal(safeLocalFailure({ stderr: remoteSentinel, error: { code: privateSentinel } }), 'SQLSTATE=unknown; line=unknown; process=unclassified; guard=unclassified');
});

test('local rollback proof sanitizes thrown subprocess errors and stops immediately', t => {
  const root = fakeRepository(t);
  for (const failureIndex of [0, 1, 9, 17]) {
    let calls = 0;
    assertSanitizedFailure(() =>
      runLocalRollbackProof(
        options(root, {
          run() {
            if (calls++ === failureIndex) throw new Error(`${privateSentinel} ${remoteSentinel}`);
            return { status: 0 };
          },
        }),
      ),
    );
    assert.equal(calls, failureIndex + 1);
  }
});

test('local rollback proof never changes fixture files while planning or mocking execution', t => {
  const root = fakeRepository(t);
  const plan = createLocalRollbackPlan(options(root));
  const before = plan.files.map(file => readFileSync(file, 'utf8'));
  runLocalRollbackProof(options(root, { run: () => ({ status: 0 }) }));
  assert.deepEqual(
    plan.files.map(file => readFileSync(file, 'utf8')),
    before,
  );
});
