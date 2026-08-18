# Account security recovery

## Outcome

The signed-in device and authenticator workspaces now distinguish provider-read
failures from action failures. A failed security-state read is presented as an
assertive, recoverable error with a bounded retry action.

## Fail-closed behavior

- Session revocation actions remain hidden until the newest device read succeeds.
- Authenticator enrollment and removal controls remain hidden until the newest
  factor read succeeds.
- Previously rendered security records are not presented as current after a
  failed refresh.
- Retry uses the existing request-generation guard, so a late response cannot
  replace the newest account state.

## Accessibility

Loading uses a polite live region and `aria-busy`. Provider failures use an
assertive alert, and the retry control is a real button with the shared minimum
touch target and responsive layout.

## Activation boundary

This change does not alter Production, public access, hosted configuration,
live Supabase resources, customer records, or payment behavior.
