# Dashboard data recovery

## Outcome

Private Deal and Watchlist provider failures are no longer converted into valid
empty lists. The dashboard reports each source independently and offers a
bounded retry for the failed read.

## Integrity behavior

- The newest completed request remains authoritative for each source.
- Initial failures do not display “No deals” or “No saved deals.”
- A failed refresh preserves previously loaded records and labels them as
  previously loaded rather than current.
- Deal and Watchlist reads share one atomic workspace refresh, preventing a
  mixed successful/failed response from being presented as a current snapshot.
- Empty-state cards render only after a successful empty response.

## Accessibility

Initial loading is polite and busy. Provider failure is assertive, atomic, and
paired with a real retry button. The status group is labeled and responsive.

## Activation boundary

This change does not alter Production, public access, hosted configuration,
live Supabase resources, customer records, or payment behavior.
