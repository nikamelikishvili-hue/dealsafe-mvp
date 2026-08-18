# English identity-transform headroom

## Decision

Dealivra's reviewed launch surface is English-only and `src/i18n.ts` currently
defines `t(text)` as an exact identity function. The production build may
therefore replace a reviewed call with its original argument without changing
the value or number of evaluations.

## Transform boundary

The transform uses the TypeScript parser and activates only when a module
imports the named `t` binding from `i18n`. It replaces only a bare call with
exactly one argument. Non-primary expressions are parenthesized, so operator
precedence remains intact. Member calls, modules without the reviewed import,
comments, and quoted examples remain unchanged.

## Release evidence

- Foundation tests cover literals, templates, conditional and dynamic
  expressions, member calls, comments, quoted examples, and missing imports.
- The production build reduced total JavaScript from 829,641 to 828,551 bytes.
- The governed total-JavaScript ceiling remains 830,000 bytes, leaving 1,449
  bytes of headroom after this change.
- TypeScript, lint, repository security gates, the complete test suite, asset
  manifest generation, build budgets, and Preview smoke verification remain
  mandatory.

## Localization activation gate

This optimization is valid only while the imported helper remains an exact
identity function and the supported launch language remains English. Any
localization release must remove the transform or obtain an explicit review
that replaces this identity contract before another language is enabled.

## Activation boundary

This is a build-time change only. It does not alter Production, public access,
hosted configuration, live Supabase resources, customer records, or payments.
