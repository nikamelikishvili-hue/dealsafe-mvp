const transientErrorCodes = new Set([
  'E408',
  'E429',
  'E500',
  'E502',
  'E503',
  'E504',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ESOCKETTIMEDOUT',
  'ETIMEDOUT',
]);
const transientHttpStatusPattern =
  /\b(?:http(?:\s+status)?|status(?:\s+code)?)\s*[:=]?\s*(?:408|429|500|502|503|504)\b/i;
const transientHttpPhrasePattern =
  /\b(?:408 request timeout|429 too many requests|500 internal server error|502 bad gateway|503 service unavailable|504 gateway timeout)\b/i;
const maximumDiagnosticLength = 320;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseAuditPayload(stdout) {
  if (typeof stdout !== 'string' || stdout.trim() === '') return null;
  try {
    const payload = JSON.parse(stdout);
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

function severityCount(payload, severity) {
  const metadataCount = payload?.metadata?.vulnerabilities?.[severity];
  const normalizedMetadataCount = Number.isSafeInteger(metadataCount) && metadataCount >= 0 ? metadataCount : 0;
  const vulnerabilityCount = isRecord(payload?.vulnerabilities)
    ? Object.values(payload.vulnerabilities).filter(value => isRecord(value) && value.severity === severity).length
    : 0;
  return Math.max(normalizedMetadataCount, vulnerabilityCount);
}

function isAuditReport(payload) {
  return (
    isRecord(payload) &&
    Number.isSafeInteger(payload.auditReportVersion) &&
    isRecord(payload.vulnerabilities) &&
    isRecord(payload.metadata) &&
    isRecord(payload.metadata.vulnerabilities)
  );
}

function collectErrorText(payload, attempt) {
  const parts = [
    attempt.spawnErrorCode,
    attempt.stderr,
    payload === null ? attempt.stdout : '',
    isRecord(payload?.error) ? payload.error.code : '',
    isRecord(payload?.error) ? payload.error.summary : '',
    isRecord(payload?.error) ? payload.error.detail : '',
  ];
  return parts.filter(value => typeof value === 'string').join('\n');
}

function containsTransientFailure(text) {
  if (transientHttpStatusPattern.test(text) || transientHttpPhrasePattern.test(text)) return true;
  const observedCodes = text.match(/\bE[A-Z0-9_]+\b/g) ?? [];
  return observedCodes.some(code => transientErrorCodes.has(code));
}

function boundedDiagnostic(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/(?:_authToken|authorization)\s*[=:]\s*\S+/gi, '[credential removed]')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumDiagnosticLength);
}

export function classifyDependencyAuditAttempt(attempt) {
  if (!isRecord(attempt)) {
    return { kind: 'failed', reason: 'invalid audit attempt result' };
  }
  const payload = parseAuditPayload(attempt.stdout);
  const high = severityCount(payload, 'high');
  const critical = severityCount(payload, 'critical');

  // A real finding always wins over transport-like text in an advisory.
  if (high > 0 || critical > 0) {
    return { kind: 'vulnerable', high, critical };
  }
  if (attempt.outputLimitExceeded === true) {
    return { kind: 'failed', reason: 'audit output exceeded the bounded capture limit' };
  }
  if (attempt.timedOut === true) {
    return { kind: 'transient', reason: 'audit request timed out' };
  }
  const errorText = collectErrorText(payload, attempt);
  if (containsTransientFailure(errorText)) {
    return { kind: 'transient', reason: 'temporary registry or network failure' };
  }
  if (attempt.exitCode === 0 && isAuditReport(payload)) {
    return { kind: 'passed', high: 0, critical: 0 };
  }
  return {
    kind: 'failed',
    reason: boundedDiagnostic(errorText) || 'audit returned an invalid or unrecognized result',
  };
}

export async function runDependencyAuditWithRetry({
  executeAttempt,
  sleep = delay => new Promise(resolve => setTimeout(resolve, delay)),
  maximumAttempts = 3,
  retryDelaysMs = [1_000, 2_000],
} = {}) {
  if (typeof executeAttempt !== 'function') {
    throw new TypeError('A dependency audit attempt function is required.');
  }
  if (!Number.isSafeInteger(maximumAttempts) || maximumAttempts < 1 || maximumAttempts > 3) {
    throw new TypeError('Dependency audit attempts must be between one and three.');
  }

  for (let attemptNumber = 1; attemptNumber <= maximumAttempts; attemptNumber += 1) {
    const outcome = classifyDependencyAuditAttempt(await executeAttempt(attemptNumber));
    if (outcome.kind === 'passed') {
      return Object.freeze({
        schema: 'dealivra.dependency-audit-result.v1',
        status: 'passed',
        attempts: attemptNumber,
        maximum_attempts: maximumAttempts,
        high: 0,
        critical: 0,
      });
    }
    if (outcome.kind === 'vulnerable') {
      throw new Error(
        `Dependency audit blocked the release: ${outcome.high} high and ${outcome.critical} critical findings.`,
      );
    }
    if (outcome.kind === 'failed') {
      throw new Error(`Dependency audit failed closed: ${outcome.reason}.`);
    }
    if (attemptNumber === maximumAttempts) {
      throw new Error(`Dependency audit failed closed after ${attemptNumber} temporary registry or network failures.`);
    }
    const retryDelay = retryDelaysMs[attemptNumber - 1];
    if (!Number.isSafeInteger(retryDelay) || retryDelay < 0 || retryDelay > 5_000) {
      throw new TypeError('Dependency audit retry delays must be bounded to five seconds.');
    }
    await sleep(retryDelay);
  }

  throw new Error('Dependency audit failed closed without a result.');
}
