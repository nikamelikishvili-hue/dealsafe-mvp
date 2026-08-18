# Global logout browser clear

## Successful global revocation

After the Auth provider confirms a `global` logout, the response now clears the
server-only refresh cookie and sends:

```http
Clear-Site-Data: "cache", "cookies", "storage"
```

This asks supporting secure-context browsers to remove residual cache, cookies,
and origin storage after every server session has been revoked. The short-lived
access token is still removed by the client as part of the normal sign-out flow.

## Fail-safe scope

The header is not sent for local logout, other-session logout, invalid scope, or
failed global provider revocation. This prevents a failed remote security action
from being presented as complete and avoids deleting guest drafts during an
ordinary local sign-out.

## Activation boundary

No live session was revoked. Production, public aliases, hosted configuration,
customer data, and payment capabilities remain unchanged until reviewed merge
and deployment.
