# English launch bundle optimization

## Decision

Dealivra's first public product is English-only. Static calls to the launch
translator therefore have identity semantics and may be replaced with their
literal argument at build time. Source code retains the translation boundary
for a later reviewed localization release.

## Safety boundary

The pre-build transform uses the TypeScript parser rather than text matching.
It activates only in modules that import the named `t` helper from `i18n`, and
only replaces a bare `t()` call with exactly one string or no-substitution
template literal. Dynamic keys, member calls, comments, quoted examples, and
modules without the reviewed import remain unchanged.

## Verification

- Foundation tests cover static strings, static templates, dynamic calls,
  member calls, comments, quoted examples, and missing imports.
- TypeScript and lint run against the source and build configuration.
- The production build, asset manifest, performance budgets, and Preview smoke
  test remain mandatory release gates.
- Any localization launch must remove or explicitly re-authorize this build
  transform before another language is enabled.

## Activation boundary

This is a build-only optimization. It does not alter Production, public access,
hosted configuration, live Supabase resources, customer records, or payments.
