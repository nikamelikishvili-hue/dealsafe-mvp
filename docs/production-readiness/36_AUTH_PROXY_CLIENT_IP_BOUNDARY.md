# Auth proxy client-IP boundary

Dealivra sends browser authentication through same-origin Vercel Functions so
the long-lived refresh token can remain in a Secure, HttpOnly cookie. That
proxy boundary must not cause every customer to share one Supabase Auth
rate-limit identity.

Supabase Auth normally applies rate limits by client IP. For a server-side
proxy, Supabase supports `Sb-Forwarded-For`, but only with a new-format secret
API key and an explicitly enabled project setting. Dealivra therefore treats
client-IP forwarding as a privileged, staged configuration change rather than
trusting an arbitrary browser header.

## Implemented boundary

- `DEALIVRA_AUTH_IP_FORWARDING_MODE` defaults to `disabled`.
- Disabled mode continues to use `SUPABASE_PUBLISHABLE_KEY` and sends no
  forwarded client-IP header.
- Enforced mode requires a server-only `SUPABASE_AUTH_SECRET_KEY` beginning
  with `sb_secret_`.
- The secret key is used only as the Auth request `apikey`; it is never used as
  a user bearer token, returned to the browser, or placed in a `VITE_`
  variable.
- Enforced mode accepts only one syntactically valid IPv4 or IPv6 address from
  Vercel's `x-vercel-forwarded-for` system header. Missing, comma-separated,
  malformed, whitespace-padded, or oversized values fail closed before the
  provider is contacted.
- The address is forwarded to Supabase only as `Sb-Forwarded-For`.
- IP addresses, API keys, cookies, tokens, emails, passwords, request bodies,
  and raw provider messages are excluded from Dealivra authentication logs.
- Provider throttling for signup, login, recovery, refresh, MFA, and
  non-local session revocation remains HTTP 429 with a bounded
  `Retry-After`. A throttled refresh does not destroy the current refresh
  cookie.
- The browser converts bounded retry metadata into exact retry guidance and
  distinguishes temporary 429/5xx failures from a confirmed 401 session
  expiry. A temporary provider failure therefore does not sign the customer
  out or erase the browser's short-lived access session.
- Local logout remains available even if provider revocation is temporarily
  unavailable.

## Activation gate

This implementation is **not active**. Preview activation requires all of the
following:

1. Create or select a dedicated non-production Supabase secret API key.
2. Store it only as `SUPABASE_AUTH_SECRET_KEY` in the matching Vercel Preview
   environment. Never copy it into source, screenshots, issue text, browser
   variables, or Production.
3. Enable client-IP forwarding in the matching Supabase project's Auth rate
   limit settings.
4. Set `DEALIVRA_AUTH_IP_FORWARDING_MODE=enforced` only in that Preview.
5. Redeploy from a reviewed commit.
6. Verify signup, password login, password recovery, refresh, MFA challenge,
   MFA verification, local logout, other-session logout, and global logout.
7. Run controlled requests from two external client networks and confirm
   rate-limit behavior is independent without recording raw IPs in release
   evidence.
8. Prove missing/invalid secret and missing/ambiguous Vercel client-IP headers
   return a generic safe failure.
9. Confirm the browser bundle and logs contain neither the secret key nor raw
   forwarded IPs.
10. Record an owner, alert threshold, false-positive review, rollback decision,
    and exact environment.

Production must repeat this evidence with a separate Production secret key and
an approved change window. Preview and Production keys must never be shared.

## Rollback

1. Set `DEALIVRA_AUTH_IP_FORWARDING_MODE=disabled`.
2. Redeploy the last reviewed commit.
3. Verify Auth requests use the publishable key and no
   `Sb-Forwarded-For` header.
4. Revoke or rotate the unused secret key after confirming rollback.
5. Disable the Supabase forwarding setting if the project no longer has a
   trusted server proxy.

Rollback restores the previous provider bucketing behavior. It must therefore
be accompanied by monitoring and conservative upstream/firewall limits rather
than treated as the final abuse-control state.

## Source references

- Supabase Auth rate limits:
  <https://supabase.com/docs/guides/auth/rate-limits>
- Supabase Auth error codes:
  <https://supabase.com/docs/guides/auth/debugging/error-codes>
- Supabase session behavior:
  <https://supabase.com/docs/guides/auth/sessions>
- Vercel request headers:
  <https://vercel.com/docs/headers/request-headers>
