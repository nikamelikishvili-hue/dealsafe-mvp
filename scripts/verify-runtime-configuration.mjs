import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateRuntimeConfiguration,
  inferRuntimeEnvironment,
  runtimeConfigurationDescriptors,
} from '../server/runtimeConfigurationPolicy.mjs';

const fixtureKey = 'sb_publishable_fixture_value_123456789';
const fixtureUrl = 'https://fixture.supabase.co';

function assertContract(condition, message) {
  if (!condition) throw new Error(`Runtime configuration contract rejected: ${message}`);
}

export function verifyRuntimeConfigurationContract() {
  const names = runtimeConfigurationDescriptors.map(item => item.name);
  assertContract(names.length === new Set(names).size, 'configuration names must be unique');
  assertContract(
    runtimeConfigurationDescriptors.every(
      item =>
        /^[A-Z][A-Z0-9_]{1,95}$/.test(item.name) && item.targets.length > 0 && typeof item.validate === 'function',
    ),
    'every descriptor must have a bounded name, target, and validator',
  );

  const local = evaluateRuntimeConfiguration({
    environment: 'local',
    target: 'application',
    values: {},
  });
  assertContract(local.status === 'degraded', 'empty local development must retain safe fallbacks');
  assertContract(local.summary.missing === 0, 'local demo must not require external providers');

  const emptyProduction = evaluateRuntimeConfiguration({
    environment: 'production',
    target: 'application',
    values: { VERCEL_ENV: 'production' },
  });
  assertContract(emptyProduction.status === 'blocked', 'incomplete production must fail closed');
  assertContract(emptyProduction.summary.missing === 4, 'production core provider report changed');

  const configuredProduction = evaluateRuntimeConfiguration({
    environment: 'production',
    target: 'application',
    values: {
      VITE_SUPABASE_URL: fixtureUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: fixtureKey,
      SUPABASE_URL: fixtureUrl,
      SUPABASE_PUBLISHABLE_KEY: fixtureKey,
      VERCEL_ENV: 'production',
    },
  });
  assertContract(
    configuredProduction.status === 'degraded' && configuredProduction.summary.missing === 0,
    'valid production core must pass with optional capabilities staged',
  );

  const invalidMode = evaluateRuntimeConfiguration({
    environment: 'local',
    values: { DEALIVRA_CURRENT_PASSWORD_MODE: 'ENFORCED' },
  });
  assertContract(invalidMode.status === 'blocked', 'ambiguous mode values must fail closed');

  const secretSentinel = `sb_secret_${'x'.repeat(64)}`;
  const missingForwardingSecret = evaluateRuntimeConfiguration({
    environment: 'local',
    values: { DEALIVRA_AUTH_IP_FORWARDING_MODE: 'enforced' },
  });
  assertContract(
    missingForwardingSecret.checks.some(
      check => check.name === 'SUPABASE_AUTH_SECRET_KEY' && check.status === 'missing',
    ),
    'enforced IP forwarding must require its server secret',
  );

  const withSecret = evaluateRuntimeConfiguration({
    environment: 'local',
    values: {
      DEALIVRA_AUTH_IP_FORWARDING_MODE: 'enforced',
      SUPABASE_AUTH_SECRET_KEY: secretSentinel,
    },
  });
  assertContract(
    !JSON.stringify(withSecret).includes(secretSentinel),
    'reports must never contain configuration values',
  );

  return {
    schema: 'dealivra.runtime-configuration-contract-result.v1',
    status: 'passed',
    environments: 4,
    targets: 3,
    descriptors: runtimeConfigurationDescriptors.length,
    deterministic_fixtures: 6,
  };
}

export function checkCurrentRuntimeConfiguration(values = process.env) {
  const environment = inferRuntimeEnvironment(values);
  return evaluateRuntimeConfiguration({
    environment,
    target: 'application',
    values,
  });
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (currentFile === invokedFile) {
  const verifyContractOnly = process.argv.includes('--contract');
  const result = verifyContractOnly ? verifyRuntimeConfigurationContract() : checkCurrentRuntimeConfiguration();
  console.log(JSON.stringify(result));
  if (result.status === 'blocked') process.exitCode = 1;
}
