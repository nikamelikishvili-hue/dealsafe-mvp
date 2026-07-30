# Application decomposition

Status: **ARC-003 slices 1–15 implemented locally for review; ARC-003 complete**

## Objective

Reduce the risk and review cost of changing Dealivra by moving cohesive
presentation and policy responsibilities out of the central `app.tsx` module
without changing customer-visible behavior.

## Slice 1: public route presentation

`src/PublicRoutePages.tsx` now owns:

- buyer protection, seller protection, fees, disputes, terms, and privacy
  page content;
- the public loading, invalid Deal Link, and page-not-found screens;
- page labels, canonical URLs, description tags, social metadata, and
  index/no-index policy.

`src/app.tsx` remains the routing and application-state consumer for this
slice. It passes only the current view, optional active deal title, signed-in
state, and navigation callbacks into the extracted boundary. The new module
does not import transaction services, session storage, Supabase access, or
mutable deal state.

## Slice 2: account entry and recovery pages

`src/AccountEntryPages.tsx` now owns:

- the controlled sign-in and sign-up form;
- the draft-to-account progress explanation;
- password visibility and policy-consent presentation;
- the forgot-password entry and request form;
- the recovery-token password update form.

The central application continues to own Auth mode, account form state,
pending draft intent, session completion, MFA challenge state, route
transitions, and the `signUp`/`signIn` calls. Password reset requests and
recovery completion still use the existing same-origin service methods and
server boundary.

## Slice 3: account profile and security workspace

`src/AccountProfileWorkspace.tsx` now owns:

- the private reputation and rating overview;
- the identity-verification status presentation;
- display-name and password-change forms;
- Authenticator and signed-in-device component composition;
- public Trust Passport controls and their clipboard/share feedback.

The central application continues to own the active session, loaded profile
record, verification request, MFA login handoff, password-change sign-out
transition, and route navigation. Supabase session, MFA, profile, and Trust
Passport calls continue to use the existing service and same-origin server
boundaries.

## Slice 4: deal creation presentation workspace

`src/DealCreationWorkspace.tsx` now owns:

- the four-step creation progress navigation;
- category/template and Smart Catalog presentation;
- item, price, condition, identifier, and handoff form controls;
- VIN lookup status presentation and safety copy;
- optional media selection, previews, photo guidance, and validation summary;
- the persistent next-action dock and guest draft-recovery notice.

The central application continues to own the draft, selected catalog identity,
guest recovery persistence, validation policy, VIN request, authentication
handoff, draft/publish intent, media upload, and the
`createUserDeal`/`saveUserDealDraft` transaction calls. The extracted workspace
does not import deal-persistence, upload, Auth, Supabase, or payment services.

## Slice 5: Deal Workspace shell and action policy

`src/DealWorkspaceShell.tsx` now owns:

- the expandable workspace-group presentation;
- the top-level Deal page navigation and protection/records shortcuts;
- the persistent primary-action dock;
- the pure primary-action policy for draft, agreement, payment, shipping,
  handoff, completion, dispute, cancellation, and demo states.

The central application continues to own the active deal and session, loaded
payment/action-plan/evidence readiness, route transitions, agreement
acceptance, sign-in handoff, create flow, DOM focus/scroll orchestration, and
all transaction service calls. The extracted shell receives callbacks and
read-only state; it does not call Auth, Supabase, payment, delivery, evidence,
or agreement mutation services.

## Slice 6: public agreement verification

`src/AgreementVerificationPage.tsx` now owns:

- the public verification page and return action;
- Deal ID and SHA-256 input state and validation;
- the read-only agreement verification request;
- accessible current-version, archived-version, no-match, and error results.

The central application continues to own browser route resolution and the
return-to-Home transition. The extracted page receives only that navigation
callback. It does not receive the active deal, session, account state, payment
state, or any transaction mutation callback.

## Slice 7: agreement record summary and history

`src/AgreementRecordSummary.tsx` now owns:

- immutable agreement-record loading with stale-response fencing;
- PDF download/preview/share controls and stored-record status;
- the server-recorded SHA-256 fingerprint and copy feedback;
- privacy-safe published-version history and acceptance counts.

The central application continues to own Deal page composition and the
professional PDF renderer. The PDF renderer consumes the same extracted,
read-only stored-document hook, so record loading has one policy boundary
without moving print layout in the same review slice. No session, transaction
mutation, evidence upload, payment, shipping, or Auth callback enters the
summary/history module.

## Slice 8: agreement PDF and print document

`src/AgreementPrintDocument.tsx` now owns:

- the verified/unavailable agreement preview states;
- the professional print toolbar and browser PDF action;
- transaction, participant, catalog, declaration, and acceptance presentation;
- the immutable SHA-256 verification block, platform notice, and print footer.

The renderer consumes the Slice 7 read-only stored-document hook. It receives
only the selected Deal record and does not receive session, transaction,
payment, shipping, evidence-upload, Auth, or agreement-mutation callbacks.
The central application continues to decide when the document is mounted.

## Slice 9: seller declaration presentation

`src/SellerDeclarations.tsx` now owns:

- the controlled three-item seller declaration checklist and empty value;
- the read-only public declaration loader with stale-response fencing;
- recorded, legacy/missing, and disclosure-boundary presentation.

Deal creation and saved-draft flows still own declaration state, completeness,
publication, persistence, errors, and navigation. The extracted module receives
only controlled checklist values/callbacks or the selected Deal record. It
cannot publish, edit, accept, pay, ship, upload evidence, or authenticate.

## Slice 10: participant evidence workspace

`src/DealEvidenceWorkspace.tsx` now owns:

- seller/buyer evidence types and the reviewed file-input policy;
- participant evidence loading with stale-response fencing;
- sequential quarantine uploads through the existing evidence service;
- scan and integrity status presentation;
- verified evidence viewing through the existing expiring viewer boundary.

The Deal Workspace still decides when evidence is available and owns the
shipping-readiness refresh signal. Admin evidence review remains separate.
The extracted workspace receives only the selected Deal, current session, and
an optional change notification. It cannot accept a deal, create payment,
change shipping state, publish/edit a deal, or authenticate.

## Slice 11: payment and seller payout workspace

`src/DealPaymentWorkspace.tsx` now owns:

- protected payment, seller Stripe readiness, and deal action-plan polling;
- seller payout onboarding and buyer checkout redirects;
- payment milestone, detailed event, fee, and terminal-state presentation;
- the read-only payment receipt and isolated print-window renderer.

The Deal Workspace still decides when payment is visible and owns only the
boolean shipping-readiness signal returned by the payment boundary. Existing
server-side payment, Stripe onboarding, and checkout functions remain
authoritative. The extracted module cannot release or refund funds, resolve a
dispute, change delivery state, upload evidence, accept/publish a deal, or
authenticate.

## Slice 12: delivery, shipping, handoff, and inspection

`src/DealFulfillmentWorkspace.tsx` now owns:

- safe public-location meeting proposals and participant confirmation;
- buyer inspection receipts, arrival, one-time handoff PIN, and completion;
- private delivery address entry with line-two and U.S. state/ZIP validation;
- shipping evidence readiness, carrier/tracking, and delivery confirmation.

The Deal Workspace still decides which fulfillment route is visible and owns
only payment/evidence readiness inputs plus progress/completion callbacks.
Existing service and database authorization remains authoritative. The module
cannot create or release payment, upload evidence, accept/publish a deal,
resolve an administrative dispute, or authenticate.

## Slice 13: participant resolution, reporting, ratings, and private chat

`src/DealResolutionWorkspace.tsx` now owns:

- completed-deal ratings and duplicate-submit protection;
- seller cancellation and participant dispute opening;
- public Deal Link trust-and-safety reports with signed-in abuse protection;
- private participant chat loading, unread state, sending, and polling.

The Deal Workspace still decides when each customer protection control is
visible, owns the signed-out report-to-Auth handoff, and applies successful
deal-status changes to central state. Administrative evidence review,
moderation, financial dispute resolution, and deal-visibility control remain
separate. Chat loads and polling are fenced so a previous deal or session
cannot overwrite the active conversation. The module cannot resolve an
administrative dispute, release/refund payment, change delivery, upload
evidence, accept/publish a deal, or authenticate.

## Slice 14: administration, reports, revenue, and catalog governance

`src/AdministrationWorkspace.tsx` now owns:

- evidence-lifecycle review and deal-level evidence inspection;
- aggregate Smart Catalog adoption metrics;
- revenue summary, transaction filtering, CSV export, and Deal Link access;
- administrative dispute review, confirmed financial resolution, and closure;
- abuse-report moderation and public Deal Link visibility control.

The central application still verifies `getAdminAccess`, applies the
`session && isAdmin` route gate, and owns navigation into customer deal
records. Administrative requests are fenced so a previous filter or session
cannot overwrite the active view. Revenue summary and transaction requests
load concurrently. Financial outcomes retain explicit operator confirmation,
and report/deal actions reject duplicate submissions. Server-side
authorization, Stripe financial controls, audit logs, and database policies
remain authoritative.

## Slice 15: Deal Workspace composition and feature presentation

`src/DealWorkspace.tsx` now owns:

- the complete Deal page composition across actions, protection, records, and
  seller-management groups;
- workspace navigation, private participant chat, agreement overview,
  immutable agreement document, and persistent primary-action dock;
- the presentation-level assembly of payment, evidence, fulfillment,
  resolution, agreement-record, and seller-declaration boundaries.

`src/DealWorkspaceFeatures.tsx` now owns the remaining Deal-specific
presentation and local interaction modules, including readiness, invitations,
access-code controls, expiry/renewal, risk, participants, offers, media,
timeline, draft editing, and progress. The central application now renders one
`DealWorkspace` boundary and retains active deal/session ownership, agreement
acceptance, route and authentication handoff, action-plan loading, shared
state updates, and primary-action policy inputs. Those central transaction
callbacks continue to use the existing service boundaries.

## Preserved behavior

- Public paths, labels, copy, calls to action, canonical URLs, and robots
  policy are unchanged.
- Private screens and signed-in Home continue to receive `noindex`.
- Unknown paths continue to render the customer-safe 404 screen.
- Deal Link loading and invalid-link states retain their accessible status
  and recovery actions.
- No account, payment, delivery, dispute, or administrator workflow changed.
- Sign-in, sign-up, MFA handoff, account-existence privacy, recovery-token
  handling, password requirements, and Terms/Privacy consent behavior are
  unchanged.
- Session and MFA enforcement, password-change sign-out, identity
  verification, profile updates, Trust Passport visibility, and private
  reputation content are unchanged.
- Creation validation, guest draft recovery, Smart Catalog identity,
  authentication handoff, save/publish behavior, and photo upload behavior
  are unchanged.
- Deal page navigation labels, primary-action ordering, shipping-readiness
  prerequisites, focus targets, agreement acceptance, and sign-in/create
  handoffs are unchanged.
- Public agreement verification keeps the same Deal ID normalization,
  64-character SHA-256 validation, current/archived result meaning, Deal Link
  recovery action, and privacy-safe explanatory boundary.
- Agreement export, preview, share, fingerprint, and version-history order,
  current/archive meaning, safe unavailable state, and privacy copy are
  unchanged.
- Agreement PDF sections, labels, immutable-record fields, current/archive
  status, unavailable state, print action, legal boundary, and accessible
  document structure are unchanged.
- Seller declaration labels, controlled checkbox behavior, required-completion
  meaning, recorded timestamp, legacy/missing state, and non-verification
  warning are unchanged.
- Evidence role/type options, file policy, sequential upload order, quarantine
  and scan copy, integrity states, participant privacy, viewer recheck, and
  60-second access warning are unchanged.
- Protected payment refresh cadence, seller readiness, buyer checkout,
  milestones, fee amounts, receipt fields, print behavior, Sandbox disclosure,
  non-escrow boundary, and shipping-readiness signal are unchanged.
- Meeting, address, state/ZIP and address-line-two validation, private-address
  copy, shipping prerequisites, carrier/tracking, inspection gates, arrival,
  handoff PIN, delivery confirmation, and completion callbacks are unchanged.
- Rating values and comments, cancellation/dispute reasons, completed-payment
  dispute eligibility, report categories and sign-in handoff, private chat
  visibility, unread behavior, refresh cadence, and safety copy are unchanged.
- Administrative access gating, evidence review, catalog aggregates, revenue
  filters and CSV export, dispute outcomes and confirmations, report
  moderation, deal visibility, and server-authoritative permissions are
  unchanged.
- Deal Workspace section order, visibility rules, action targets, agreement
  acceptance, participant state synchronization, seller editing, media
  controls, chat placement, and print-document behavior are unchanged.

## Regression controls

The foundation suite verifies that:

- `app.tsx` imports the public route boundary instead of declaring it inline;
- metadata receives only the active deal title rather than the complete deal
  object;
- the extracted module still owns the public content, canonical URL,
  no-index policy, and all four route-status/page components;
- the central module cannot silently reintroduce those declarations without
  failing review.
- account entry and recovery forms cannot silently return to the central
  module while the sign-in/sign-up state and MFA handoff remain centrally
  orchestrated.
- profile and account-security presentation cannot silently return to the
  central module while session ownership, MFA login handoff, verification,
  and navigation remain centrally orchestrated.
- deal creation forms, progress, validation presentation, VIN feedback, and
  media selection cannot silently return to the central module while draft
  persistence, authentication handoff, upload, and publish operations remain
  centrally orchestrated.
- Deal Workspace navigation, group chrome, action policy, and persistent dock
  cannot silently return to the central module while agreement acceptance,
  Auth/create handoff, focus movement, and transaction services remain
  centrally orchestrated.
- public agreement verification presentation, validation, and its single
  read-only service request cannot silently return to the central module or
  acquire account, payment, shipping, evidence-upload, or Auth mutations.
- agreement record loading, export controls, fingerprint, and published
  history cannot silently return to the central module, while the PDF renderer
  consumes the same read-only loading boundary.
- agreement PDF rendering cannot silently return to the central module or
  acquire session, transaction, payment, shipping, evidence-upload, Auth, or
  agreement-mutation callbacks.
- seller declaration presentation cannot silently return to the central module
  or acquire deal-publication, persistence, payment, shipping, evidence-upload,
  acceptance, or Auth behavior.
- participant evidence loading, upload, status, and viewing cannot silently
  return to the central module or acquire deal acceptance, payment, shipping
  mutation, publication, editing, or Auth behavior.
- protected payment polling, Stripe onboarding/checkout redirects, seller
  readiness, milestones, and receipts cannot silently return to the central
  module or acquire release/refund, dispute-resolution, delivery, evidence,
  acceptance, publication, or Auth behavior.
- meeting, inspection, arrival, handoff PIN, private address, shipping
  readiness, carrier/tracking, and delivery confirmation cannot silently
  return to the central module or acquire payment creation/release, evidence
  upload, acceptance/publication, administrative dispute resolution, or Auth.
- ratings, cancellation/dispute opening, public safety reporting, and private
  participant chat cannot silently return to the central module or acquire
  administrative/financial dispute resolution, delivery, evidence upload,
  acceptance/publication, or Auth behavior.
- evidence review, catalog governance, revenue reporting, administrative
  dispute resolution, report moderation, and deal visibility cannot silently
  return to the central module or bypass its explicit administrator route
  gate; the extracted workspace cannot acquire customer authentication,
  agreement publication, payment creation, shipping, or evidence-upload
  mutations.
- Deal Workspace groups, navigation, dock, feature composition, and leaf
  presentation cannot silently return to `app.tsx`; central agreement
  acceptance and action-plan orchestration remain explicitly regression
  tested.

Type checking, the complete foundation suite, secret scan, production build,
and preview smoke test remain mandatory after each decomposition slice.

## ARC-003 completion

All fifteen reviewable decomposition slices are implemented. Ordinary public,
account, creation, Deal Workspace, agreement, payment, fulfillment,
resolution, and administration presentation changes now have focused module
boundaries. `app.tsx` remains the explicit application-state, routing,
authentication-handoff, and cross-feature transaction coordinator.

Future work under ARC-004 may further type and validate service payloads, but
it is not required to complete ARC-003.

## Activation boundary

This change is review-branch source organization only. It does not activate a
Supabase migration, alter data, change Preview or Production, enable public
access, or enable real-money behavior.
