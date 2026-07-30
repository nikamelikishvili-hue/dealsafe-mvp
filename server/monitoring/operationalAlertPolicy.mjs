const maximumRecordsPerWindow = 10_000;
const environments = new Set(['production', 'preview', 'development']);
const paymentIntegrityCodes = new Set([
  'charge_mismatch',
  'charge_refund_mismatch',
  'checkout_confirmation_mismatch',
  'checkout_reconciliation_required',
  'dispute_release_confirmation_mismatch',
  'dispute_release_reconciliation_required',
  'financial_command_mismatch',
  'payment_intent_mismatch',
  'refund_confirmation_mismatch',
  'refund_reconciliation_required',
  'release_confirmation_mismatch',
  'release_reconciliation_required',
  'seller_account_mismatch',
]);

const emptyCounters = () => ({
  runtime_rejections: 0,
  client_failures: 0,
  server_failures: 0,
  poor_web_vitals: 0,
  synthetic_failures: 0,
  auth_abuse_events: 0,
  csp_violations: 0,
  payment_failures: 0,
  payment_integrity_events: 0,
  payment_configuration_events: 0,
  payment_signature_events: 0,
  security_notification_failures: 0,
});

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

function text(value) {
  return typeof value === 'string' && value.length <= 128 ? value : '';
}

export function classifyOperationalRecord(value) {
  const source = record(value);
  if (!source) return [];

  try {
    const schema = text(source.schema);
    if (schema === 'dealivra.runtime-rejection-monitor.v1') {
      return ['runtime_rejections'];
    }
    if (schema === 'dealivra.client-failure-monitor.v1') {
      return ['client_failures'];
    }
    if (schema === 'dealivra.server-failure-monitor.v1') {
      return ['server_failures'];
    }
    if (
      schema === 'dealivra.web-vital-monitor.v1'
      && source.rating === 'poor'
      && ['lcp', 'cls', 'inp'].includes(source.metric)
    ) {
      return ['poor_web_vitals'];
    }
    if (
      schema === 'dealivra.synthetic.result.v1'
      && source.status === 'failed'
    ) {
      return ['synthetic_failures'];
    }
    if (
      schema === 'dealivra.auth.rejection.v1'
      && (
        source.status === 429
        || source.code === 'invalid_credentials'
      )
    ) {
      return ['auth_abuse_events'];
    }
    if (schema === 'dealivra.csp-violation.v1') {
      return ['csp_violations'];
    }
    if (schema === 'dealivra.security.notification.v1') {
      return ['security_notification_failures'];
    }
    if (schema !== 'dealivra.payment.operation.v1') return [];

    const signals = [];
    const errorCode = text(source.error_code);
    const event = text(source.event);
    if (source.outcome === 'failed' || source.severity === 'error') {
      signals.push('payment_failures');
    }
    if (paymentIntegrityCodes.has(errorCode)) {
      signals.push('payment_integrity_events');
    }
    if (errorCode === 'provider_configuration_error') {
      signals.push('payment_configuration_events');
    }
    if (event === 'invalid_signature') {
      signals.push('payment_signature_events');
    }
    return signals;
  } catch {
    return [];
  }
}

function alert(code, severity, observed, threshold, action) {
  return {
    schema: 'dealivra.operational-alert.v1',
    code,
    severity,
    observed,
    threshold,
    action,
  };
}

export function evaluateOperationalCounters(counters) {
  const alerts = [];
  if (counters.synthetic_failures >= 1) {
    alerts.push(alert(
      'critical_journey_failed',
      'critical',
      counters.synthetic_failures,
      1,
      'freeze_release_and_page_application_owner',
    ));
  }
  if (counters.payment_integrity_events >= 1) {
    alerts.push(alert(
      'payment_integrity_event',
      'critical',
      counters.payment_integrity_events,
      1,
      'freeze_financial_action_and_page_payment_owner',
    ));
  }
  if (counters.payment_configuration_events >= 1) {
    alerts.push(alert(
      'payment_configuration_failure',
      'critical',
      counters.payment_configuration_events,
      1,
      'disable_affected_action_and_page_payment_owner',
    ));
  }
  if (counters.security_notification_failures >= 1) {
    alerts.push(alert(
      'security_notification_failure',
      'high',
      counters.security_notification_failures,
      1,
      'page_security_owner_and_preserve_queue',
    ));
  }
  if (counters.payment_signature_events >= 10) {
    alerts.push(alert(
      'payment_signature_rejections',
      'high',
      counters.payment_signature_events,
      10,
      'notify_security_owner_and_preserve_verification',
    ));
  }
  if (counters.payment_failures >= 3) {
    alerts.push(alert(
      'payment_provider_failures',
      'high',
      counters.payment_failures,
      3,
      'notify_payment_owner_and_pause_promotion',
    ));
  }
  if (counters.server_failures >= 5) {
    alerts.push(alert(
      'server_failure_cluster',
      'high',
      counters.server_failures,
      5,
      'page_application_owner_and_freeze_release',
    ));
  }
  if (counters.client_failures >= 5) {
    alerts.push(alert(
      'client_failure_cluster',
      counters.client_failures >= 20 ? 'high' : 'warning',
      counters.client_failures,
      counters.client_failures >= 20 ? 20 : 5,
      counters.client_failures >= 20
        ? 'page_application_owner_and_freeze_release'
        : 'notify_application_owner',
    ));
  }
  if (counters.runtime_rejections >= 10) {
    alerts.push(alert(
      'runtime_contract_rejections',
      counters.runtime_rejections >= 50 ? 'high' : 'warning',
      counters.runtime_rejections,
      counters.runtime_rejections >= 50 ? 50 : 10,
      counters.runtime_rejections >= 50
        ? 'page_application_owner_and_freeze_release'
        : 'investigate_release_contract_drift',
    ));
  }
  if (counters.auth_abuse_events >= 20) {
    alerts.push(alert(
      'auth_abuse_cluster',
      counters.auth_abuse_events >= 50 ? 'high' : 'warning',
      counters.auth_abuse_events,
      counters.auth_abuse_events >= 50 ? 50 : 20,
      counters.auth_abuse_events >= 50
        ? 'page_security_owner_and_review_firewall'
        : 'notify_security_owner',
    ));
  }
  if (counters.csp_violations >= 20) {
    alerts.push(alert(
      'csp_violation_cluster',
      'warning',
      counters.csp_violations,
      20,
      'investigate_policy_or_injection_change',
    ));
  }
  if (counters.poor_web_vitals >= 20) {
    alerts.push(alert(
      'poor_web_vital_cluster',
      'warning',
      counters.poor_web_vitals,
      20,
      'review_release_performance',
    ));
  }
  return alerts;
}

function normalizeMetadata(value) {
  const source = record(value);
  if (
    !source
    || Object.keys(source).length !== 5
    || source.schema !== 'dealivra.monitoring-window.v1'
    || !environments.has(source.environment)
    || (
      source.release !== 'unknown'
      && !/^[a-f0-9]{40}$/i.test(text(source.release))
    )
    || !Number.isFinite(Date.parse(source.window_started_at))
    || !Number.isSafeInteger(source.window_minutes)
    || source.window_minutes < 1
    || source.window_minutes > 15
  ) {
    return null;
  }
  return {
    schema: source.schema,
    environment: source.environment,
    release: source.release === 'unknown'
      ? 'unknown'
      : source.release.toLowerCase(),
    window_started_at: new Date(source.window_started_at).toISOString(),
    window_minutes: source.window_minutes,
  };
}

export function buildOperationalSnapshot(metadata, records) {
  const normalizedMetadata = normalizeMetadata(metadata);
  if (
    !normalizedMetadata
    || !Array.isArray(records)
    || records.length > maximumRecordsPerWindow
  ) {
    return null;
  }

  const counters = emptyCounters();
  for (const source of records) {
    for (const signal of classifyOperationalRecord(source)) {
      counters[signal] += 1;
    }
  }
  return {
    ...normalizedMetadata,
    counters,
    alerts: evaluateOperationalCounters(counters),
  };
}
