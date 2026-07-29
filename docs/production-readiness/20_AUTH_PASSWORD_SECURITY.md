# Auth password security

## Current enforced baseline

Dealivra applies the same reviewed password rule in the application and the
managed Auth provider:

- minimum 12 characters;
- at least one lowercase letter;
- at least one uppercase letter;
- at least one digit;
- at least one supported symbol;
- maximum 256 characters at the server boundary;
- password values never enter application logs or browser-persisted profile
  data.

The server validates account creation, recovery completion, and signed-in
password changes before contacting the Auth provider. The browser also
validates for immediate feedback, while the server and Auth provider remain
the authoritative enforcement boundaries. Signed-in changes require a current
password field and remain staged until the matching managed provider control
is verified.
Existing users may continue signing in with an older password; the stronger
rule applies when a password is created or changed.

## Verified provider state

On 2026-07-27 the Supabase Email provider was saved and reopened with:

| Control | State |
|---|---|
| Minimum password length | `12` |
| Required character classes | Lowercase, uppercase, digits, and symbols |
| Secure email change | Enabled |
| Leaked-password protection | Unavailable on the current Free plan |

The Supabase security advisor continues to report leaked-password protection
as disabled. Official Supabase documentation states that this control requires
the Pro plan or above. Dealivra must not claim compromised-password screening
until the provider control is enabled and verified.

## Remaining launch gates

1. Upgrade the Supabase organization to a plan that supports leaked-password
   protection.
2. Enable the provider control, reopen the saved settings, and confirm the
   advisor warning is gone.
3. Add a controlled test proving a known compromised password is rejected
   without logging or retaining it.
4. Enable the supported provider current-password control in protected Preview,
   enforce the staged server switch, and pass the full positive/negative matrix
   in [37_PASSWORD_MUTATION_BOUNDARY.md](37_PASSWORD_MUTATION_BOUNDARY.md).
5. Add customer-facing password-change security notifications and suspected
   account-takeover recovery evidence.

Official reference:
[Supabase password security](https://supabase.com/docs/guides/auth/password-security).
