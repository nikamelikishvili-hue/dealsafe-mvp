# Profile data recovery

## Customer behavior

The account route now presents one explicit loading state while the profile is
read. A failed or absent profile cannot reveal partially initialized identity,
session, MFA, support, or trust controls. Instead, the customer receives a
clear failure with a real retry action and a route back to the dashboard.

The request-generation guard remains authoritative, so a slower older response
cannot replace a newer retry. The loading flag is also finalized only by the
currently active request.

## Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.
