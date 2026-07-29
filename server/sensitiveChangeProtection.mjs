import { supabaseRestRpcRequest } from './authShared.mjs';

const supportedModes = new Set(['staged', 'enforced']);
const supportedScopes = new Set(['payout', 'email', 'mfa']);

export class SensitiveChangeProtectionError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'SensitiveChangeProtectionError';
    this.code = code;
    this.status = status;
  }
}

export function sensitiveChangeProtectionMode(environment = process.env) {
  const configured = (environment.DEALIVRA_RECOVERY_CONTROL_MODE || 'staged')
    .trim()
    .toLowerCase();
  if (!supportedModes.has(configured)) {
    throw new SensitiveChangeProtectionError(
      'recovery_protection_unavailable',
      'Account recovery protection is temporarily unavailable.',
      503,
    );
  }
  return configured;
}

export async function assertSensitiveChangeAllowed(
  accessToken,
  scope,
  options = {},
) {
  if (typeof accessToken !== 'string' || !accessToken || !supportedScopes.has(scope)) {
    throw new SensitiveChangeProtectionError(
      'sensitive_change_request_invalid',
      'The sensitive account change request is invalid.',
      400,
    );
  }

  const mode = sensitiveChangeProtectionMode(options.environment);
  if (mode === 'staged') return { enforced: false };

  const request = options.request || supabaseRestRpcRequest;
  let upstream;
  try {
    upstream = await request(
      accessToken,
      'assert_my_sensitive_change_allowed',
      { p_scope: scope },
    );
  } catch {
    throw new SensitiveChangeProtectionError(
      'recovery_protection_unavailable',
      'Account recovery protection is temporarily unavailable.',
      503,
    );
  }

  if (upstream.ok) return { enforced: true };

  const data = await upstream.json().catch(() => null);
  const providerCode = [
    data?.code,
    data?.message,
    data?.hint,
    data?.details,
  ].filter((value) => typeof value === 'string').join(' ');

  if (/DEALIVRA_SENSITIVE_CHANGE_COOLDOWN/.test(providerCode)) {
    throw new SensitiveChangeProtectionError(
      'recovery_cooldown_active',
      'This security change is temporarily locked after account recovery.',
      423,
    );
  }

  throw new SensitiveChangeProtectionError(
    'recovery_protection_unavailable',
    'Account recovery protection is temporarily unavailable.',
    503,
  );
}
