const environments = Object.freeze(['local', 'preview', 'staging', 'production']);
const targets = Object.freeze(['application', 'edge', 'combined']);
const nonLocalEnvironments = Object.freeze(['preview', 'staging', 'production']);

const mode =
  (...values) =>
  value =>
    values.includes(value);

function isOrigin(value, environment, allowLocalHttp = true) {
  if (value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    const localHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const protocolAllowed =
      parsed.protocol === 'https:' ||
      (allowLocalHttp && environment === 'local' && localHost && parsed.protocol === 'http:');
    return (
      protocolAllowed &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash &&
      (parsed.pathname === '' || parsed.pathname === '/')
    );
  } catch {
    return false;
  }
}

function isPublishableKey(value) {
  return (
    value.length >= 20 &&
    value.length <= 2048 &&
    !/\s/.test(value) &&
    !/^sb_secret_/i.test(value) &&
    !/(?:service[_-]?role|sk_(?:live|test)_)/i.test(value)
  );
}

function isAuthSecretKey(value) {
  return value.startsWith('sb_secret_') && value.length >= 32 && value.length <= 512 && !/\s/.test(value);
}

function isServiceRoleKey(value) {
  return value.length >= 32 && value.length <= 4096 && !/\s/.test(value) && !/^sb_publishable_/i.test(value);
}

function isBoundedSecret(value) {
  return value.length >= 32 && value.length <= 4096 && !/\s/.test(value);
}

function isStripeTestSecret(value) {
  return /^sk_test_[A-Za-z0-9_]{16,512}$/.test(value);
}

function isStripeWebhookSecret(value) {
  return /^whsec_[A-Za-z0-9_]{16,512}$/.test(value);
}

function isSender(value) {
  return (
    value.length <= 254 &&
    /^(?:[^<>\r\n]{1,80}\s+<[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}>|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})$/i.test(value)
  );
}

function isCommaSeparatedOriginList(value, environment) {
  if (value.length > 4096) return false;
  const entries = value.split(',').map(entry => entry.trim());
  return (
    entries.length > 0 && entries.length <= 20 && entries.every(entry => entry && isOrigin(entry, environment, false))
  );
}

function isSlug(value) {
  return /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(value);
}

function isFeeBasisPoints(value) {
  return /^(?:0|[1-9]\d{0,3}|10000)$/.test(value);
}

function isCheckoutLimit(value) {
  return /^[1-9]\d{2,11}$/.test(value);
}

function isCommitSha(value) {
  return /^[a-f0-9]{7,64}$/i.test(value);
}

function descriptor(definition) {
  return Object.freeze({
    ...definition,
    requiredIn: Object.freeze(definition.requiredIn ?? []),
    targets: Object.freeze(definition.targets),
    sensitivity: definition.sensitivity ?? 'public',
    defaultValue: definition.defaultValue,
    requiredWhen: definition.requiredWhen,
    validate: definition.validate,
  });
}

export const runtimeConfigurationDescriptors = Object.freeze([
  descriptor({
    name: 'VITE_SUPABASE_URL',
    scope: 'browser',
    targets: ['application'],
    requiredIn: nonLocalEnvironments,
    validate: isOrigin,
  }),
  descriptor({
    name: 'VITE_SUPABASE_PUBLISHABLE_KEY',
    scope: 'browser',
    targets: ['application'],
    requiredIn: nonLocalEnvironments,
    validate: isPublishableKey,
  }),
  descriptor({
    name: 'SUPABASE_URL',
    scope: 'server',
    targets: ['application', 'edge'],
    requiredIn: nonLocalEnvironments,
    validate: isOrigin,
  }),
  descriptor({
    name: 'SUPABASE_PUBLISHABLE_KEY',
    scope: 'server',
    targets: ['application'],
    requiredIn: nonLocalEnvironments,
    validate: isPublishableKey,
  }),
  descriptor({
    name: 'DEALIVRA_AUTH_IP_FORWARDING_MODE',
    scope: 'server',
    targets: ['application'],
    defaultValue: 'disabled',
    validate: mode('disabled', 'enforced'),
  }),
  descriptor({
    name: 'SUPABASE_AUTH_SECRET_KEY',
    scope: 'server',
    targets: ['application'],
    sensitivity: 'secret',
    requiredWhen: values => values.DEALIVRA_AUTH_IP_FORWARDING_MODE === 'enforced',
    validate: isAuthSecretKey,
  }),
  descriptor({
    name: 'DEALIVRA_CURRENT_PASSWORD_MODE',
    scope: 'server',
    targets: ['application'],
    defaultValue: 'staged',
    validate: mode('staged', 'enforced'),
  }),
  descriptor({
    name: 'DEALIVRA_RECOVERY_CONTROL_MODE',
    scope: 'server-and-edge',
    targets: ['application', 'edge'],
    defaultValue: 'staged',
    validate: mode('staged', 'enforced'),
  }),
  descriptor({
    name: 'DEALIVRA_RUNTIME_REJECTION_MODE',
    scope: 'server',
    targets: ['application'],
    defaultValue: 'staged',
    validate: mode('staged', 'enforced'),
  }),
  descriptor({
    name: 'DEALIVRA_CLIENT_FAILURE_MODE',
    scope: 'server',
    targets: ['application'],
    defaultValue: 'staged',
    validate: mode('staged', 'enforced'),
  }),
  descriptor({
    name: 'DEALIVRA_WEB_VITAL_MODE',
    scope: 'server',
    targets: ['application'],
    defaultValue: 'staged',
    validate: mode('staged', 'enforced'),
  }),
  descriptor({
    name: 'VITE_SUPPORT_CASES_ENABLED',
    scope: 'browser',
    targets: ['application'],
    validate: mode('enabled'),
  }),
  descriptor({
    name: 'VITE_GOOGLE_MAPS_API_KEY',
    scope: 'browser',
    targets: ['application'],
    validate: value => value.length >= 20 && value.length <= 256 && !/\s/.test(value),
  }),
  descriptor({
    name: 'DEALIVRA_RUNTIME_ENVIRONMENT',
    scope: 'build',
    targets: ['application'],
    validate: mode('local', 'preview', 'staging', 'production'),
  }),
  descriptor({
    name: 'VERCEL_ENV',
    scope: 'platform',
    targets: ['application'],
    validate: mode('development', 'preview', 'staging', 'production'),
  }),
  descriptor({
    name: 'VERCEL_GIT_COMMIT_SHA',
    scope: 'platform',
    targets: ['application'],
    validate: isCommitSha,
  }),
  descriptor({
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    scope: 'edge',
    targets: ['edge'],
    sensitivity: 'secret',
    requiredIn: nonLocalEnvironments,
    validate: isServiceRoleKey,
  }),
  descriptor({
    name: 'SITE_URL',
    scope: 'edge',
    targets: ['edge'],
    requiredIn: nonLocalEnvironments,
    validate: (value, environment) => isOrigin(value, environment, false),
  }),
  descriptor({
    name: 'DEALIVRA_ALLOWED_ORIGINS',
    scope: 'edge',
    targets: ['edge'],
    validate: isCommaSeparatedOriginList,
  }),
  descriptor({
    name: 'DEALIVRA_VERCEL_PROJECT_SLUG',
    scope: 'edge',
    targets: ['edge'],
    validate: isSlug,
  }),
  descriptor({
    name: 'DEALIVRA_VERCEL_TEAM_SLUG',
    scope: 'edge',
    targets: ['edge'],
    validate: isSlug,
  }),
  descriptor({
    name: 'DEALIVRA_SELLER_ONBOARDING_MODE',
    scope: 'edge',
    targets: ['edge'],
    defaultValue: 'disabled',
    validate: mode('disabled', 'sandbox'),
  }),
  descriptor({
    name: 'DEALIVRA_CHECKOUT_MODE',
    scope: 'edge',
    targets: ['edge'],
    defaultValue: 'disabled',
    validate: mode('disabled', 'sandbox'),
  }),
  descriptor({
    name: 'DEALIVRA_PAYOUT_RELEASE_MODE',
    scope: 'edge',
    targets: ['edge'],
    defaultValue: 'disabled',
    validate: mode('disabled', 'sandbox'),
  }),
  descriptor({
    name: 'DEALIVRA_REFUND_MODE',
    scope: 'edge',
    targets: ['edge'],
    defaultValue: 'disabled',
    validate: mode('disabled', 'sandbox'),
  }),
  descriptor({
    name: 'STRIPE_SECRET_KEY',
    scope: 'edge',
    targets: ['edge'],
    sensitivity: 'secret',
    requiredWhen: values =>
      [
        'DEALIVRA_SELLER_ONBOARDING_MODE',
        'DEALIVRA_CHECKOUT_MODE',
        'DEALIVRA_PAYOUT_RELEASE_MODE',
        'DEALIVRA_REFUND_MODE',
      ].some(name => values[name] === 'sandbox'),
    validate: isStripeTestSecret,
  }),
  descriptor({
    name: 'STRIPE_WEBHOOK_SECRET',
    scope: 'edge',
    targets: ['edge'],
    sensitivity: 'secret',
    requiredWhen: values =>
      [
        'DEALIVRA_SELLER_ONBOARDING_MODE',
        'DEALIVRA_CHECKOUT_MODE',
        'DEALIVRA_PAYOUT_RELEASE_MODE',
        'DEALIVRA_REFUND_MODE',
      ].some(name => values[name] === 'sandbox'),
    validate: isStripeWebhookSecret,
  }),
  descriptor({
    name: 'DEALIVRA_PLATFORM_FEE_BPS',
    scope: 'edge',
    targets: ['edge'],
    validate: isFeeBasisPoints,
  }),
  descriptor({
    name: 'DEALIVRA_CHECKOUT_MAX_CENTS',
    scope: 'edge',
    targets: ['edge'],
    validate: isCheckoutLimit,
  }),
  descriptor({
    name: 'DEALIVRA_PLATFORM_FEE_VERSION',
    scope: 'edge',
    targets: ['edge'],
    validate: value => /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value),
  }),
  descriptor({
    name: 'DEALIVRA_SECURITY_NOTIFICATION_MODE',
    scope: 'edge',
    targets: ['edge'],
    defaultValue: 'staged',
    validate: mode('staged', 'enforced'),
  }),
  descriptor({
    name: 'DEALIVRA_SECURITY_NOTIFICATION_WORKER_SECRET',
    scope: 'edge',
    targets: ['edge'],
    sensitivity: 'secret',
    requiredWhen: values => values.DEALIVRA_SECURITY_NOTIFICATION_MODE === 'enforced',
    validate: isBoundedSecret,
  }),
  descriptor({
    name: 'DEALIVRA_SECURITY_NOTIFICATION_FROM',
    scope: 'edge',
    targets: ['edge'],
    requiredWhen: values => values.DEALIVRA_SECURITY_NOTIFICATION_MODE === 'enforced',
    validate: isSender,
  }),
  descriptor({
    name: 'RESEND_API_KEY',
    scope: 'edge',
    targets: ['edge'],
    sensitivity: 'secret',
    requiredWhen: values => values.DEALIVRA_SECURITY_NOTIFICATION_MODE === 'enforced',
    validate: isBoundedSecret,
  }),
  descriptor({
    name: 'DEALIVRA_MALWARE_SCANNER_URL',
    scope: 'edge',
    targets: ['edge'],
    validate: (value, environment) => isOrigin(value, environment, false),
  }),
  descriptor({
    name: 'DEALIVRA_MALWARE_SCANNER_TOKEN',
    scope: 'edge',
    targets: ['edge'],
    sensitivity: 'secret',
    requiredWhen: values => Boolean(values.DEALIVRA_MALWARE_SCANNER_URL),
    validate: isBoundedSecret,
  }),
]);

function safeValues(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return Object.create(null);
  const safe = Object.create(null);
  for (const descriptor of runtimeConfigurationDescriptors) {
    const value = values[descriptor.name];
    if (typeof value === 'string' && value.length <= 4096) {
      if (value.trim()) safe[descriptor.name] = value;
    } else if (value !== undefined && value !== null && value !== '') {
      safe[descriptor.name] = Symbol('invalid');
    }
  }
  return safe;
}

function appliesToTarget(descriptorValue, target) {
  return target === 'combined' || descriptorValue.targets.includes(target);
}

function alignmentCheck(name, scope, issue, valid) {
  return {
    name,
    scope,
    sensitivity: 'derived',
    required: true,
    status: valid ? 'configured' : 'invalid',
    ...(valid ? {} : { issue }),
  };
}

function providerAlignmentChecks(values, target) {
  if (target === 'edge') return [];
  const checks = [];
  if (values.VITE_SUPABASE_URL && values.SUPABASE_URL) {
    checks.push(
      alignmentCheck(
        'SUPABASE_PROJECT_ALIGNMENT',
        'browser-and-server',
        'provider_origins_differ',
        values.VITE_SUPABASE_URL.replace(/\/+$/, '') === values.SUPABASE_URL.replace(/\/+$/, ''),
      ),
    );
  }
  if (values.VITE_SUPABASE_PUBLISHABLE_KEY && values.SUPABASE_PUBLISHABLE_KEY) {
    checks.push(
      alignmentCheck(
        'SUPABASE_PUBLISHABLE_KEY_ALIGNMENT',
        'browser-and-server',
        'publishable_keys_differ',
        values.VITE_SUPABASE_PUBLISHABLE_KEY === values.SUPABASE_PUBLISHABLE_KEY,
      ),
    );
  }
  return checks;
}

function vercelAlignmentCheck(values, environment, target) {
  if (target === 'edge' || !values.VERCEL_ENV) return [];
  const allowed =
    environment === 'local' ? ['development'] : environment === 'staging' ? ['preview', 'staging'] : [environment];
  return [
    alignmentCheck(
      'VERCEL_ENVIRONMENT_ALIGNMENT',
      'platform',
      'deployment_environment_mismatch',
      allowed.includes(values.VERCEL_ENV),
    ),
  ];
}

export function evaluateRuntimeConfiguration({ environment, target = 'application', values = {} }) {
  if (!environments.includes(environment)) {
    throw new TypeError('Runtime configuration environment is invalid.');
  }
  if (!targets.includes(target)) {
    throw new TypeError('Runtime configuration target is invalid.');
  }

  const normalizedValues = safeValues(values);
  const checks = runtimeConfigurationDescriptors
    .filter(item => appliesToTarget(item, target))
    .map(item => {
      const value = normalizedValues[item.name];
      const required = item.requiredIn.includes(environment) || Boolean(item.requiredWhen?.(normalizedValues));

      if (value === undefined) {
        if (required) {
          return {
            name: item.name,
            scope: item.scope,
            sensitivity: item.sensitivity,
            required,
            status: 'missing',
            issue: 'required_configuration_missing',
          };
        }
        if (item.defaultValue !== undefined) {
          return {
            name: item.name,
            scope: item.scope,
            sensitivity: item.sensitivity,
            required,
            status: 'defaulted',
            issue: 'safe_default_applied',
          };
        }
        return {
          name: item.name,
          scope: item.scope,
          sensitivity: item.sensitivity,
          required,
          status: 'staged',
          issue: 'optional_configuration_absent',
        };
      }

      const valid = typeof value === 'string' && value === value.trim() && item.validate(value, environment);
      return {
        name: item.name,
        scope: item.scope,
        sensitivity: item.sensitivity,
        required,
        status: valid ? 'configured' : 'invalid',
        ...(valid ? {} : { issue: 'configuration_value_invalid' }),
      };
    });

  checks.push(...providerAlignmentChecks(normalizedValues, target));
  checks.push(...vercelAlignmentCheck(normalizedValues, environment, target));

  const summary = {
    configured: checks.filter(check => check.status === 'configured').length,
    defaulted: checks.filter(check => check.status === 'defaulted').length,
    staged: checks.filter(check => check.status === 'staged').length,
    missing: checks.filter(check => check.status === 'missing').length,
    invalid: checks.filter(check => check.status === 'invalid').length,
  };
  const status =
    summary.missing > 0 || summary.invalid > 0
      ? 'blocked'
      : summary.defaulted > 0 || summary.staged > 0
        ? 'degraded'
        : 'ready';

  return {
    schema: 'dealivra.runtime-configuration.v1',
    environment,
    target,
    status,
    summary,
    checks,
  };
}

export function inferRuntimeEnvironment(values = {}) {
  const explicit =
    typeof values.DEALIVRA_RUNTIME_ENVIRONMENT === 'string'
      ? values.DEALIVRA_RUNTIME_ENVIRONMENT.trim().toLowerCase()
      : '';
  if (explicit) {
    if (!environments.includes(explicit)) {
      throw new TypeError('Explicit runtime environment is invalid.');
    }
    return explicit;
  }
  const vercel = typeof values.VERCEL_ENV === 'string' ? values.VERCEL_ENV.trim().toLowerCase() : '';
  if (vercel === 'production') return 'production';
  if (vercel === 'preview' || vercel === 'staging') return vercel;
  return 'local';
}
