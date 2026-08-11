const safePathPattern = /^[A-Za-z0-9._@+()[\]/-]{1,240}$/;
const legacyMarkerPattern = /dealsafe(?=$|[^a-z])/gi;

const exactPath = (...paths) => path => paths.includes(path);
const supabaseSql = path => path.startsWith('supabase/') && path.endsWith('.sql');

function rule(definition) {
  return Object.freeze({
    ...definition,
    allowedPath: definition.allowedPath,
    linePattern: definition.linePattern,
  });
}

export const approvedLegacyIdentifierRules = Object.freeze([
  rule({
    id: 'browser-session-cleanup',
    expectedOccurrences: 3,
    allowedPath: exactPath(
      'scripts/verify-browser-storage-policy.mjs',
      'src/main.tsx',
      'src/services/supabaseRest.ts',
    ),
    linePattern: /\bdealsafe_session\b/i,
  }),
  rule({
    id: 'language-preference-migration',
    expectedOccurrences: 1,
    allowedPath: exactPath('src/i18nFull.ts'),
    linePattern: /\bdealsafe_language\b/i,
  }),
  rule({
    id: 'database-admin-rpc-compatibility',
    expectedOccurrences: 23,
    allowedPath: path => (
      supabaseSql(path)
      || path === 'src/services/supabaseRest.ts'
    ),
    linePattern: /\bis_dealsafe_admin\b/i,
  }),
  rule({
    id: 'database-private-schema-compatibility',
    expectedOccurrences: 139,
    allowedPath: supabaseSql,
    linePattern: /\bdealsafe_private\b/i,
  }),
  rule({
    id: 'platform-fee-config-migration',
    expectedOccurrences: 1,
    allowedPath: exactPath('supabase/functions/stripe-create-checkout/index.ts'),
    linePattern: /\bDEALSAFE_PLATFORM_FEE_BPS\b/,
  }),
  rule({
    id: 'stripe-connect-metadata-compatibility',
    expectedOccurrences: 1,
    allowedPath: exactPath('supabase/functions/stripe-connect/index.ts'),
    linePattern: /\bdealsafe_user_id\b/i,
  }),
  rule({
    id: 'stripe-connect-idempotency-compatibility',
    expectedOccurrences: 1,
    allowedPath: exactPath('supabase/functions/stripe-connect/index.ts'),
    linePattern: /dealsafe-connect-/i,
  }),
  rule({
    id: 'retired-browser-cache-cleanup',
    expectedOccurrences: 2,
    allowedPath: exactPath('public/sw.js'),
    linePattern: /dealsafe-(?:shell-v1|['"])/i,
  }),
  rule({
    id: 'vercel-deployment-alias-migration',
    expectedOccurrences: 2,
    allowedPath: exactPath('vercel.json'),
    linePattern: /dealsafe-mvp(?:-nika13)?\.vercel\.app/i,
  }),
]);

function normalizePath(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replaceAll('\\', '/');
  if (
    !safePathPattern.test(normalized)
    || normalized.startsWith('/')
    || normalized.split('/').includes('..')
  ) {
    return null;
  }
  return normalized;
}

export function classifyLegacyIdentifierLine(pathValue, line) {
  const path = normalizePath(pathValue);
  if (!path || typeof line !== 'string' || line.length > 20_000) return null;
  const matches = approvedLegacyIdentifierRules.filter(candidate => (
    candidate.allowedPath(path) && candidate.linePattern.test(line)
  ));
  return matches.length === 1 ? matches[0].id : null;
}

export function evaluateLegacyIdentifierInventory(files) {
  if (!Array.isArray(files) || files.length > 2_000) {
    throw new TypeError('Legacy identifier inventory is invalid.');
  }

  const counts = new Map(
    approvedLegacyIdentifierRules.map(candidate => [candidate.id, 0]),
  );
  const issues = [];
  let occurrences = 0;

  for (const file of files) {
    const path = normalizePath(file?.path);
    const source = file?.source;
    if (!path || typeof source !== 'string' || source.length > 2_000_000) {
      throw new TypeError('Legacy identifier inventory entry is invalid.');
    }

    const lines = source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      legacyMarkerPattern.lastIndex = 0;
      for (const _match of line.matchAll(legacyMarkerPattern)) {
        occurrences += 1;
        const ruleId = classifyLegacyIdentifierLine(path, line);
        if (!ruleId) {
          issues.push({
            issue: 'unapproved_legacy_identifier',
            path,
            line: index + 1,
          });
          continue;
        }
        counts.set(ruleId, (counts.get(ruleId) ?? 0) + 1);
      }
    }
  }

  const aliases = approvedLegacyIdentifierRules.map(candidate => {
    const observed = counts.get(candidate.id) ?? 0;
    const status = observed === candidate.expectedOccurrences ? 'approved' : 'drifted';
    if (status === 'drifted') {
      issues.push({
        issue: 'approved_alias_inventory_drift',
        alias: candidate.id,
      });
    }
    return {
      id: candidate.id,
      status,
      observed,
      expected: candidate.expectedOccurrences,
    };
  });

  return {
    schema: 'dealivra.legacy-identifier-policy.v1',
    status: issues.length === 0 ? 'passed' : 'blocked',
    files_scanned: files.length,
    legacy_occurrences: occurrences,
    approved_aliases: aliases.length,
    issues,
    aliases,
  };
}
