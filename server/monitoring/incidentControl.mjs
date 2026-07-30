const incidentIdPattern = /^INC-[A-Z0-9]{8}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const severities = new Set(['critical', 'high', 'medium', 'low']);
const categories = new Set([
  'account_security',
  'evidence_integrity',
  'payment_integrity',
  'privacy',
  'service_availability',
  'third_party_provider',
]);
const transitions = Object.freeze({
  declared: { triage: 'triaged' },
  triaged: { contain: 'contained' },
  contained: { monitor: 'monitoring' },
  monitoring: { resolve: 'resolved' },
  resolved: { reopen: 'triaged' },
});
const statuses = new Set(Object.keys(transitions));
const evidenceKinds = new Set([
  'deployment',
  'log_snapshot',
  'provider_status',
  'test_result',
  'timeline',
]);

function plainRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

function isoTime(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return new Date(value).toISOString();
}

export function declareIncident(value) {
  const source = plainRecord(value);
  const declaredAt = isoTime(source?.declared_at);
  if (
    !source
    || Object.keys(source).length !== 6
    || source.schema !== 'dealivra.incident-declaration.v1'
    || !incidentIdPattern.test(source.incident_id)
    || !severities.has(source.severity)
    || !categories.has(source.category)
    || typeof source.public_impact !== 'boolean'
    || !declaredAt
  ) {
    return null;
  }

  const requiresFreeze = source.severity === 'critical'
    || source.severity === 'high';
  return {
    schema: 'dealivra.incident-state.v1',
    incident_id: source.incident_id,
    severity: source.severity,
    category: source.category,
    status: 'declared',
    public_impact: source.public_impact,
    release_gate: requiresFreeze ? 'frozen' : 'review_required',
    financial_safety: source.category === 'payment_integrity'
      ? 'frozen'
      : 'unchanged',
    evidence_preservation: 'required',
    status_communication: source.public_impact
      ? 'draft_required'
      : 'not_required',
    declared_at: declaredAt,
    updated_at: declaredAt,
    transition_count: 0,
  };
}

function normalizeState(value) {
  const source = plainRecord(value);
  if (
    !source
    || Object.keys(source).length !== 13
    || source.schema !== 'dealivra.incident-state.v1'
    || !incidentIdPattern.test(source.incident_id)
    || !severities.has(source.severity)
    || !categories.has(source.category)
    || !statuses.has(source.status)
    || typeof source.public_impact !== 'boolean'
    || !['frozen', 'review_required'].includes(source.release_gate)
    || !['frozen', 'unchanged'].includes(source.financial_safety)
    || !['required', 'active'].includes(source.evidence_preservation)
    || ![
      'not_required',
      'draft_required',
      'approved_update_required',
      'monitoring_update_required',
      'final_update_required',
    ].includes(source.status_communication)
    || !isoTime(source.declared_at)
    || !isoTime(source.updated_at)
    || !Number.isSafeInteger(source.transition_count)
    || source.transition_count < 0
    || source.transition_count > 100
  ) {
    return null;
  }
  return source;
}

export function transitionIncident(current, value) {
  const state = normalizeState(current);
  const command = plainRecord(value);
  const occurredAt = isoTime(command?.occurred_at);
  if (
    !state
    || !command
    || Object.keys(command).length !== 3
    || command.schema !== 'dealivra.incident-transition.v1'
    || typeof command.action !== 'string'
    || !occurredAt
    || Date.parse(occurredAt) < Date.parse(state.updated_at)
  ) {
    return null;
  }

  const nextStatus = transitions[state.status]?.[command.action];
  if (!nextStatus) return null;

  const reopened = command.action === 'reopen';
  const publicCommunication = !state.public_impact
    ? 'not_required'
    : nextStatus === 'monitoring'
      ? 'monitoring_update_required'
      : nextStatus === 'resolved'
        ? 'final_update_required'
        : 'approved_update_required';

  return {
    ...state,
    status: nextStatus,
    release_gate: reopened ? 'frozen' : state.release_gate,
    financial_safety: state.financial_safety,
    evidence_preservation: 'active',
    status_communication: publicCommunication,
    updated_at: occurredAt,
    transition_count: state.transition_count + 1,
  };
}

export function incidentPublicTemplate(value) {
  const state = normalizeState(value);
  if (!state || !state.public_impact) return null;
  const message = {
    declared: 'We are investigating an issue affecting some Dealivra services.',
    triaged: 'We have identified the affected service and are working to contain the issue.',
    contained: 'The issue has been contained. We are validating service recovery.',
    monitoring: 'Service has recovered and we are monitoring stability.',
    resolved: 'This incident is resolved. We continue our internal review.',
  }[state.status];
  return {
    schema: 'dealivra.status-draft.v1',
    incident_id: state.incident_id,
    status: state.status,
    message,
    publication: 'requires_authorized_review',
  };
}

export function buildIncidentEvidenceManifest(incident, values) {
  const state = normalizeState(incident);
  if (!state || !Array.isArray(values) || values.length > 100) return null;
  const entries = [];
  for (const value of values) {
    const source = plainRecord(value);
    const collectedAt = isoTime(source?.collected_at);
    if (
      !source
      || Object.keys(source).length !== 4
      || source.schema !== 'dealivra.incident-evidence.v1'
      || !evidenceKinds.has(source.kind)
      || !hashPattern.test(source.sha256)
      || !collectedAt
    ) {
      return null;
    }
    entries.push({
      kind: source.kind,
      sha256: source.sha256,
      collected_at: collectedAt,
    });
  }
  return {
    schema: 'dealivra.incident-evidence-manifest.v1',
    incident_id: state.incident_id,
    entries,
    raw_content_included: false,
  };
}
