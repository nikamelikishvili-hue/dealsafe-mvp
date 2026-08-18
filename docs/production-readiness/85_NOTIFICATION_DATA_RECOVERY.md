# Notification data recovery

## Customer behavior

- Initial activity loading is announced without presenting a false empty inbox.
- Provider failures remain distinct from a valid account with no activity.
- A failed background refresh keeps the previously loaded activity visible and
  labels it as stale.
- Retry starts a new request generation; older responses cannot replace it.
- A failed optimistic mark-all mutation restores the previous unread state and
  explains the failure.

## Accessibility

The Activity disclosure exposes its expanded state and controlled region. The
shared async component provides live loading/error semantics, and retry and
mark-all targets meet the minimum interactive size.

## Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.
