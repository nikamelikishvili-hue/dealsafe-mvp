# Design system and UX standard

## 1. Experience objective

Dealivra must feel calm, precise, trustworthy, and internationally credible without implying a guarantee. The design should reduce uncertainty and guide action, not decorate complexity.

The authenticated product and public site use the same visual language:

- Deep navy for structure and trust.
- Dealivra teal as a controlled brand accent.
- Blue for primary interactive actions and informational state.
- Green only for confirmed success.
- Amber only for attention/review.
- Red only for destructive, failed, blocked, or serious risk state.

Color never communicates state by itself.

## 2. One-primary-action rule

Each workflow state has exactly one visually dominant action.

- The action is available near the page/workspace header on desktop.
- The action is available in a safe sticky action dock on mobile.
- It scrolls or navigates to the exact required panel and receives focus.
- If blocked, the interface states why and offers the next resolvable prerequisite.
- Duplicate “next step” cards are removed unless one is a compact progress summary without a second competing button.

Users must not scroll to the bottom of a long deal page to discover the action required to continue.

## 3. Information hierarchy

### Deal workspace

1. Compact identity: back link, status, deal code, title, amount.
2. Four-stage progress: Terms, Pay, Delivery, Done.
3. Current next action and any blocker.
4. Item/agreement summary.
5. Current-stage workspace.
6. Collapsible records: participants, payment history, evidence, agreement, safety, support.

Completed and future sections stay compact. The current task receives detail.

### Page density

- Normal body text: 15–16 px desktop and at least 15 px mobile.
- Supporting text: not below 12 px except nonessential labels.
- Page titles: restrained; they do not consume an entire mobile viewport.
- Cards use 16–24 px internal spacing depending on viewport.
- Repeated large icons and decorative empty space are avoided.
- Tables become labeled stacked rows on narrow screens.

## 4. Component governance

Required primitives:

- Button and icon button.
- Link.
- Text, select, date/time, phone, currency, and address fields.
- Checkbox/radio/switch.
- Status badge.
- Alert and inline validation.
- Modal/dialog/drawer.
- Tabs and accordion.
- Card and list row.
- Stepper and action dock.
- Toast/live announcement.
- Empty, loading, error, offline, and permission-denied states.

Each component documents:

- Variants and allowed semantic meaning.
- Keyboard behavior.
- Focus treatment.
- Screen-reader name/description.
- Loading and disabled behavior.
- Touch target.
- Responsive behavior.
- Visual regression stories/tests.

Feature CSS may compose these components but may not silently redefine their semantic colors, typography, focus, or spacing.

## 5. Token target

Use semantic tokens instead of feature-specific hard-coded colors.

```text
color.surface.canvas
color.surface.raised
color.surface.subtle
color.text.primary
color.text.secondary
color.text.inverse
color.border.default
color.action.primary
color.action.primaryHover
color.status.success
color.status.warning
color.status.danger
color.status.info
space.1 ... space.10
radius.sm / md / lg / pill
shadow.low / medium / overlay
type.display / heading / body / label / caption
motion.fast / normal / slow
```

The token contrast pairs are tested automatically.

## 6. Form and error behavior

- Labels remain visible; placeholders are examples, not labels.
- Required/optional status is explicit.
- US addresses use separate street, apartment/suite/unit, city, state, and ZIP fields after autocomplete selection.
- Values are not erased after a validation or server error.
- Summary errors link/focus the exact field.
- Error messages say what happened and how to fix it.
- Submit buttons show progress and prevent duplicate submissions.
- Users can safely resume drafts.
- Destructive actions require clear consequences and confirmation proportional to risk.

## 7. Trust and protected-payment communication

Every payment state answers:

- Where is the transaction in the workflow?
- Who must act next?
- What has the provider confirmed?
- What must not happen yet?
- What fees and amounts apply?
- Where can the user get help or report a problem?

Use:

- “Payment processing”
- “Payment confirmed by Stripe”
- “Eligible for review/release”
- “Seller transfer confirmed”

Avoid:

- “Funds safe”
- “Guaranteed”
- “Escrow” unless a separately licensed escrow product is integrated and approved
- “Verified seller” when only email was verified

## 8. Responsive and mobile behavior

Test widths include at least 320, 360, 390, 768, 1024, 1280, and 1440 px.

- No horizontal page scrolling.
- Sticky bars never hide focused fields, validation messages, or target headings.
- Touch targets meet WCAG 2.2 minimum requirements and preferably reach 44×44 px.
- Dialogs become full-height sheets when necessary.
- Critical actions remain reachable with browser zoom at 200%.
- Long names, amounts, addresses, and translated strings wrap or truncate with an accessible full value.
- The on-screen keyboard does not obscure the active action or field.

## 9. Accessibility acceptance

- WCAG 2.2 AA is the release target.
- All behavior is operable by keyboard.
- Focus is visible and not obscured.
- Heading and landmark order is meaningful.
- Status changes are announced without stealing focus.
- Icons have a label unless purely decorative.
- Form errors are programmatically connected.
- Authentication does not rely solely on a cognitive-function test.
- Motion respects reduced-motion preference.
- Automated checks are supplemented by manual screen-reader and keyboard testing.

## 10. Content standard

- Initial production copy is US English.
- Sentences are short and action-oriented.
- Avoid financial/legal jargon where plain language is accurate.
- Risk language is neutral and non-accusatory.
- Dates include time zone where ambiguity matters.
- Amounts always include currency.
- Support and policy wording has an owner and version.
- No untranslated hard-coded customer text in production components.

## 11. Usability evidence

A major flow is not approved from internal review alone.

For each release:

- Observe at least five target users for the changed critical flow.
- Record completion, hesitation, backtracking, misinterpretation, time, and support need.
- Fix any repeated critical misunderstanding before release.
- Verify the flow with a keyboard-only user and an accessibility specialist before paid beta.

