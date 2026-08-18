# Async state recovery

Dealivra now has a shared presentation contract for loading, error, and empty states.

## Contract

- Loading uses a polite status region and exposes `aria-busy`.
- Blocking read failures use an assertive alert without implying that data is safe or complete.
- Retry is a real `type="button"` action with a 44-pixel minimum target.
- Loading motion stops when reduced motion is requested.
- Mobile error actions expand to the panel width instead of compressing message text.
- Empty states are neutral status messages and never masquerade as successful provider checks.

## Initial rollout

The in-person meeting workspace now uses the shared component while preserving its stale-response guard and explicit reload version. The meeting form remains unavailable until the read succeeds, so an unavailable provider cannot be mistaken for an empty meeting record.
