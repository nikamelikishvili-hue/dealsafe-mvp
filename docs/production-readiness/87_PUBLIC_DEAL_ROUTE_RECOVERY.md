# Public Deal route recovery

## Customer behavior

Every public Deal navigation now writes the canonical Deal URL before loading,
shows the secure route-loading state, and transitions to a dedicated failure
page if the provider read fails. The failure page offers both a bounded retry of
the same deep link and a return-home action.

Notification-originated navigation uses the same behavior as a direct browser
link. The existing route request generation remains authoritative, preventing a
late response from an earlier URL from replacing the newest navigation.

## Accessibility and mobile

Both recovery actions are explicit non-submitting buttons with 44-pixel minimum
targets. They wrap on narrow layouts and become full-width on small phones.

## Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.
