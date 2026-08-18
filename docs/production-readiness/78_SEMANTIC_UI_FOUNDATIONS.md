# Semantic UI foundations

## Purpose

This control starts UX-001 and UX-002 without attempting a high-risk visual rewrite. It establishes one semantic color contract and one accessible feedback primitive that can be adopted incrementally across Dealivra.

## Implemented boundary

- `src/design-tokens.css` owns the reviewed brand, ink, surface, border, status, focus, radius, shadow, and touch-target tokens.
- Existing aliases remain temporarily available so current Deal screens do not change meaning during migration. New shared UI must use semantic tokens.
- `FeedbackMessage` provides a stable information, success, warning, and error contract. Blocking errors use `role="alert"` and assertive announcement; all other outcomes use a polite status announcement.
- Decorative feedback icons are hidden from assistive technology and text remains the complete source of meaning.
- Keyboard focus has a consistent visible ring, including a forced-colors fallback.
- Account creation, sign-in, password recovery, and password reset now distinguish safe information, success, and failure instead of styling every outcome identically.
- Connectivity feedback uses the same success and warning palette.

## Automated acceptance

- Component rendering tests cover names, roles, live-region priority, atomic announcements, and decorative icon behavior.
- Foundation tests ensure the token and feedback contracts stay wired into the application entry point.
- Each status foreground/background pair is checked against the WCAG AA 4.5:1 normal-text threshold.
- TypeScript, lint, the complete foundation suite, component suite, build budgets, and responsive browser checks remain release gates.

## Reviewed responsive evidence

The local built account and recovery routes were inspected at 390 by 844 pixels. They had no horizontal document overflow, password-manager purposes remained present, and visible primary/secondary account controls met the 44-pixel target baseline.

## Remaining migration

UX-001 and UX-002 remain open. Feature-owned CSS still contains uncontrolled literal colors and locally implemented status/loading/retry patterns. Migration must proceed in small, workflow-specific batches with visual and interaction proof; a bulk replacement is prohibited because identical legacy colors sometimes carry different product meaning.

## Activation boundary

This change does not alter Production, public access, hosted configuration, live Supabase resources, customer records, or payment capability.
