# Trust Passport route recovery

## Outcome

The public Trust Passport now has explicit loading and provider-failure states.
A failed read offers a bounded retry that reuses the existing route request
generation guard, so a delayed response cannot overwrite a newer navigation.

## Accessibility and trust

- The public profile heading is an explicit page landmark target.
- Decorative avatar and icon content is hidden from assistive technology.
- Every rating exposes a concise numeric accessible name instead of relying on
  repeated star glyphs.
- The back action is explicitly non-submitting.
- Loading is polite; provider failure is assertive and recoverable.
- Missing provider data never appears as an empty or trustworthy record.

## Activation boundary

This change does not alter Production, public access, hosted configuration,
live Supabase resources, customer records, or payment behavior.
