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

The server validates account creation before contacting the Auth provider.
Account changes and recovery validate in the client for immediate feedback,
while the Auth provider remains the authoritative enforcement boundary.
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
4. Implement the supported reauthentication/current-password UX before
   enabling either provider password-change switch. Enabling those switches
   before the matching UX exists would break legitimate account recovery.
5. Add customer-facing password-change security notifications and suspected
   account-takeover recovery evidence.

Official reference:
[Supabase password security](https://supabase.com/docs/guides/auth/password-security).
