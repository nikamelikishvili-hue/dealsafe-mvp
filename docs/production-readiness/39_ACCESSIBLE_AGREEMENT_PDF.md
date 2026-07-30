# Accessible agreement PDF and receipt

## Status

Implemented locally for review. This work improves the document generated from
the immutable agreement record, but does not activate Production, create a
legal escrow certificate, or approve the agreement copy for launch.

## Document authority

- The preview and print layout render only the stored
  `dealivra.agreement.v1` record returned by the reviewed public projection.
- The document fails closed when the stored schema or SHA-256 value cannot be
  verified.
- Price, item terms, version, timestamps, declarations, and the integrity code
  come from one immutable agreement version.
- Current participant labels are clearly identified as presentation metadata
  outside the hashed terms.

## Accessible structure

- The agreement is exposed as a named document with one level-one heading.
- Every major region has an accessible name tied to its visible heading.
- The platform notice is identified as a note.
- Preview actions are grouped in a named toolbar and use explicit button types.
- Reading order follows the visible order: record header, agreement summary,
  metadata, participants, terms, declarations, verification, notice, footer.
- Verification codes and long user-provided values wrap instead of creating
  horizontal scrolling.

## Print and small-screen layout

- Letter-size output uses fixed print margins and a repeated page-number footer
  supplied by the browser print engine.
- Headers, metadata rows, participant cards, term groups, declaration items,
  integrity code, and legal notice avoid unsafe page breaks.
- Long paragraphs use print widow and orphan protection.
- The preview becomes a single-column layout on narrow screens, while the
  printed record remains optimized for U.S. Letter.
- Controls are excluded from the printed document.

## Verification completed

- The local document preview was inspected using a deterministic public-record
  fixture.
- The rendered document and toolbar had no horizontal page overflow.
- Every document section had an accessible label.
- TypeScript, automated foundation coverage, secret scanning, production build,
  and preview smoke checks must pass before review publication.

## Remaining activation evidence

AGR-003 is not complete until all of the following are retained as review
evidence:

1. PDF files produced by the supported Production browsers on U.S. Letter.
2. Screen-reader and keyboard verification on the protected Preview.
3. Long-title, long-description, archived-version, legacy-version, and
   multi-page fixtures.
4. Counsel-approved agreement and platform-notice language.
5. A retention decision for whether generated PDF bytes are archived or can be
   reproduced from the immutable canonical record.
6. A verified checksum comparison between the displayed version and the
   downloaded PDF content.

No real-money or public-launch gate is changed by this document.
