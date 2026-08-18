# Browser isolation headers

## Resource and process isolation

Every application response now declares:

- `Cross-Origin-Resource-Policy: same-origin`, preventing unrelated origins
  from loading Dealivra responses as cross-origin subresources; and
- `Origin-Agent-Cluster: ?1`, asking supporting browsers to isolate the origin
  in its own agent cluster.

The existing `Cross-Origin-Opener-Policy: same-origin-allow-popups` remains in
place because provider-hosted payment and authentication journeys may require
popup compatibility. Cross-origin embedder isolation is intentionally not
enabled until every required Stripe, Maps, font, media, and analytics response
is proven compatible in a protected Preview.

## Verification and rollback

Repository tests require exact values for all three isolation headers. Protected
Preview response-header checks and provider journey smoke tests remain required
before promotion. If an approved cross-origin resource journey is blocked,
rollback only the resource-policy header through a reviewed change; do not
weaken CSP or opener isolation as a shortcut.

## Activation boundary

The repository configuration changed for review only. No live Vercel alias,
Production deployment, public access, provider configuration, customer data,
or payment capability changed in this pass.
