import assert from 'node:assert/strict';
import {
  buildIncidentEvidenceManifest,
  declareIncident,
  incidentPublicTemplate,
  transitionIncident,
} from '../server/monitoring/incidentControl.mjs';

let incident = declareIncident({
  schema: 'dealivra.incident-declaration.v1',
  incident_id: 'INC-DRILL001',
  severity: 'critical',
  category: 'service_availability',
  public_impact: true,
  declared_at: '2026-07-30T12:00:00Z',
});
assert.ok(incident);
assert.equal(incident.release_gate, 'frozen');
assert.equal(incident.evidence_preservation, 'required');
assert.equal(
  transitionIncident(incident, {
    schema: 'dealivra.incident-transition.v1',
    action: 'resolve',
    occurred_at: '2026-07-30T12:01:00Z',
  }),
  null,
);

const sequence = [
  ['triage', '2026-07-30T12:02:00Z'],
  ['contain', '2026-07-30T12:05:00Z'],
  ['monitor', '2026-07-30T12:10:00Z'],
  ['resolve', '2026-07-30T12:30:00Z'],
];
for (const [action, occurredAt] of sequence) {
  incident = transitionIncident(incident, {
    schema: 'dealivra.incident-transition.v1',
    action,
    occurred_at: occurredAt,
  });
  assert.ok(incident);
}

assert.equal(incident.status, 'resolved');
assert.equal(incident.release_gate, 'frozen');
assert.equal(incident.status_communication, 'final_update_required');
assert.equal(
  incidentPublicTemplate(incident)?.publication,
  'requires_authorized_review',
);

const manifest = buildIncidentEvidenceManifest(incident, [
  {
    schema: 'dealivra.incident-evidence.v1',
    kind: 'test_result',
    sha256: 'a'.repeat(64),
    collected_at: '2026-07-30T12:31:00Z',
  },
]);
assert.ok(manifest);
assert.equal(manifest.raw_content_included, false);

console.log(JSON.stringify({
  schema: 'dealivra.incident-drill-result.v1',
  status: 'passed',
  final_incident_status: incident.status,
  release_gate: incident.release_gate,
  transitions_verified: sequence.length,
  evidence_entries_verified: manifest.entries.length,
}));
