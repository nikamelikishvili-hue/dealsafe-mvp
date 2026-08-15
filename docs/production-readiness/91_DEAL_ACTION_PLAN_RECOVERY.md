# Deal action-plan recovery

## Product behavior

The live Deal progress card now communicates its initial load rather than
leaving an unexplained blank area. A failed first read presents a direct retry.
If a later refresh fails, the last successful milestones remain visible but are
explicitly labeled as previously loaded and must not be treated as current.

## Reliability boundary

- Request generations continue to reject obsolete responses.
- Polling and manual retries share the same authenticated provider boundary.
- A retry increments an explicit revision and cannot overlap an older result.
- Refresh failures preserve last-known information without describing it as
  fresh or silently changing the next milestone.

## Accessibility

Initial loading uses a polite busy state. Failures use the shared atomic alert
contract and a labeled, non-submitting retry action. Background refreshes are
announced to assistive technology without adding visible layout noise.

## Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability is changed by this work.
