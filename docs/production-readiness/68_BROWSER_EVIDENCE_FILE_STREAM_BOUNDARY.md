# Browser evidence file stream boundary

## Objective

Evidence validation must not ask the browser to create an unchecked whole-file
copy before Dealivra has applied its byte-level file policy. This matters most
for lower-memory mobile devices and the reviewed video ceiling.

The browser now reads a prepared evidence `Blob` through one exact-size stream
boundary before file-signature and metadata validation.

## Boundary

- The declaration policy first validates the evidence role, type, file name,
  claimed media type, and size.
- The declared size must be a safe positive integer no larger than the
  canonical 50 MiB evidence ceiling.
- The immutable Blob size must exactly equal the approved declaration before
  a stream is opened.
- One exact-size byte buffer is allocated.
- Stream chunks are copied directly into that buffer rather than retained and
  recopied after the full file is read.
- An unreadable, short, or long stream fails with a fixed content-free error;
  an overrun is cancelled immediately.
- File-signature and prohibited-metadata validation still runs before an
  upload intake is requested.

This boundary does not make browser validation authoritative. The quarantine
function independently revalidates the database-owned size, bytes, hash, and
malware verdict before clean-only promotion.

## Verification

Automated coverage proves:

1. an exact multi-byte Blob is read without changing its bytes;
2. a Blob/declaration size mismatch fails before upload;
3. the evidence upload path uses the exact Blob stream reader;
4. the upload path contains no direct `preparedFile.arrayBuffer()` call;
5. signed evidence viewing still uses the same exact-size stream primitive;
6. all evidence, transport, type, build, and Preview-smoke gates pass.

Before promotion, exercise maximum-size image and video inputs on the minimum
supported mobile memory profile. Record completion, cancellation, validation
failure, and browser-memory evidence without storing customer file contents.

## Rollout and rollback

Rollout is repository-only and preserves the existing upload, quarantine,
scanner, Storage, authorization, and customer-message contracts.

If a supported browser cannot provide a readable Blob stream, fail safely and
retain the file locally so the customer can retry from a supported browser.
Do not restore unchecked whole-body allocation as a compatibility fallback.
Rollback must revert the upload wiring and exact-stream primitive together
after review.

No file was read from a customer, uploaded, downloaded, promoted, deleted, or
changed. No Supabase, Vercel, Preview, Production, public-access, payment,
payout, refund, dispute, or real-money state is changed by this local control.
