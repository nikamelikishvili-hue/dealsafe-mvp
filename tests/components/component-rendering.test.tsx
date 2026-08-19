import assert from 'node:assert/strict';
import test from 'node:test';
import { ShieldAlert } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    documentElement: {
      dir: '',
      lang: '',
    },
  },
});

const { AccountEntryPage, ForgotPasswordEntry, recoveryValidationErrors, signupValidationErrors } = await import(
  '../../src/AccountEntryPages'
);
const { AddressAutocomplete } = await import('../../src/AddressAutocomplete');
const { accountPasswordValidationErrors } = await import('../../src/AccountProfileWorkspace');
const { formatCsvCell } = await import('../../src/AdministrationWorkspace');
const { BrandLogo } = await import('../../src/BrandLogo');
const { FeedbackMessage } = await import('../../src/FeedbackMessage');
const { FieldError } = await import('../../src/FieldError');
const { AsyncStatePanel } = await import('../../src/AsyncStatePanel');
const { ValidationSummary } = await import('../../src/ValidationSummary');
const { MfaLoginVerification } = await import('../../src/MfaLoginVerification');
const { DEAL_ACTION_TARGET_IDS, resolveDealPrimaryAction } = await import('../../src/DealWorkspaceShell');
const { isUsPostalCode, normalizeUsState, parseGoogleUsAddress, parseStoredUsAddress, serializeUsAddress } =
  await import('../../src/usAddress');

const noop = () => {};

const baseDeal = {
  id: 'deal-1',
  publicId: 'PUBLIC01',
  title: 'Test item',
  description: 'Test description',
  priceCents: 10000,
  currency: 'USD' as const,
  condition: 'Good' as const,
  deliveryMethod: 'Ship to buyer' as const,
  status: 'accepted' as const,
  sellerName: 'Seller',
  sellerVerification: 'verified' as const,
  agreementVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  viewerRole: 'buyer' as const,
};

test('every primary deal action resolves to a governed workspace target', () => {
  const scenarios = [
    { deal: { ...baseDeal, status: 'draft' as const, viewerRole: 'seller' as const } },
    { deal: { ...baseDeal, status: 'published' as const, viewerRole: 'buyer' as const } },
    { deal: { ...baseDeal, status: 'published' as const, viewerRole: 'seller' as const } },
    { deal: { ...baseDeal, deliveryMethod: 'Meet in person' as const } },
    { deal: { ...baseDeal, status: 'completed' as const } },
    { deal: { ...baseDeal, status: 'disputed' as const } },
    { deal: { ...baseDeal, status: 'cancelled' as const } },
    { deal: { ...baseDeal, viewerRole: 'seller' as const }, paymentReady: false },
    {
      deal: { ...baseDeal, viewerRole: 'seller' as const },
      actionPlan: { delivery_address_ready: true, shipment_status: null, inspection_recorded: false },
      shippingReadiness: { status: 'ready' as const, ready: true },
    },
    {
      deal: { ...baseDeal, viewerRole: 'seller' as const },
      shippingReadiness: { status: 'error' as const, ready: false },
    },
  ];

  for (const scenario of scenarios) {
    const action = resolveDealPrimaryAction({
      deal: scenario.deal,
      demoCompleted: false,
      expired: false,
      agreementActionReady: false,
      signedIn: true,
      paymentReady: scenario.paymentReady ?? true,
      actionPlan: scenario.actionPlan,
      shippingReadiness: scenario.shippingReadiness,
    });
    assert.ok(DEAL_ACTION_TARGET_IDS.includes(action.targetId));
  }
});

test('address entry always renders a usable manual line-one fallback', () => {
  const markup = renderToStaticMarkup(
    <AddressAutocomplete value="15900 N Bay" onChange={noop} placeholder="Street address" streetAddressOnly />,
  );

  assert.match(markup, /autoComplete="address-line1"/);
  assert.match(markup, /maxLength="200"/);
  assert.match(markup, /placeholder="Street address"/);
  assert.match(markup, /value="15900 N Bay"/);
  assert.match(markup, /role="combobox"/);
  assert.match(markup, /aria-autocomplete="list"/);
  assert.match(markup, /aria-haspopup="listbox"/);
  assert.match(markup, /aria-describedby="[^"]+"/);
  assert.match(markup, /aria-busy="false"/);
  assert.match(markup, /aria-label="Clear street address"/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /Automatic suggestions are not configured\. Enter the complete address manually\./);
});

test('administrator CSV cells neutralize spreadsheet formulas and quote data', () => {
  assert.equal(formatCsvCell('=HYPERLINK("https://example.test")'), `"'=HYPERLINK(""https://example.test"")"`);
  assert.equal(formatCsvCell('  @SUM(1,2)'), `"'  @SUM(1,2)"`);
  assert.equal(formatCsvCell('Buyer "One"'), `"Buyer ""One"""`);
  assert.equal(formatCsvCell(null), '""');
});

test('Google address parts populate a complete US delivery address including unit and ZIP+4', () => {
  const parsed = parseGoogleUsAddress([
    { longText: '15900', shortText: '15900', types: ['street_number'] },
    { longText: 'North Bay Road', shortText: 'N Bay Rd', types: ['route'] },
    { longText: 'Apartment 7B', shortText: 'Apt 7B', types: ['subpremise'] },
    { longText: 'Miami Beach', shortText: 'Miami Beach', types: ['locality'] },
    {
      longText: 'Florida',
      shortText: 'FL',
      types: ['administrative_area_level_1'],
    },
    { longText: '33141', shortText: '33141', types: ['postal_code'] },
    { longText: '2140', shortText: '2140', types: ['postal_code_suffix'] },
    { longText: 'United States', shortText: 'US', types: ['country'] },
  ]);

  assert.deepEqual(parsed, {
    streetAddress: '15900 North Bay Road',
    addressLine2: 'Apartment 7B',
    city: 'Miami Beach',
    state: 'FL',
    postalCode: '33141-2140',
    country: 'US',
    hasStreetNumber: true,
    isComplete: true,
  });
});

test('US address helpers accept full state names and reject incomplete ZIP codes', () => {
  assert.equal(normalizeUsState('New York'), 'NY');
  assert.equal(normalizeUsState('ny'), 'NY');
  assert.equal(isUsPostalCode('10001'), true);
  assert.equal(isUsPostalCode('10001-1234'), true);
  assert.equal(isUsPostalCode('1000'), false);
});

test('stored delivery addresses preserve address line two, state, and ZIP+4', () => {
  const stored = serializeUsAddress({
    streetAddress: '15900 North Bay Road',
    addressLine2: 'Apartment 7B',
    city: 'Miami Beach',
    state: 'Florida',
    postalCode: '33141-2140',
  });

  assert.equal(stored, '15900 North Bay Road\nApartment 7B\nMiami Beach, FL 33141-2140');
  assert.deepEqual(parseStoredUsAddress(stored), {
    streetAddress: '15900 North Bay Road',
    addressLine2: 'Apartment 7B',
    city: 'Miami Beach',
    state: 'FL',
    postalCode: '33141-2140',
  });
});

test('sign-in form preserves password-manager semantics and explicit button behavior', () => {
  const markup = renderToStaticMarkup(
    <AccountEntryPage
      mode="signin"
      form={{ displayName: '', email: 'buyer@example.com', password: 'example-password' }}
      onFormChange={noop}
      onSubmit={noop}
      passwordVisible={false}
      onTogglePassword={noop}
      acceptedPolicies={false}
      onAcceptedPoliciesChange={noop}
      message=""
      pendingCreateAction={null}
      returnToCreate={false}
      onBack={noop}
      onOpenInfo={noop}
      onSwitchMode={noop}
    />,
  );

  assert.match(markup, /autoComplete="email"/);
  assert.match(markup, /autoComplete="current-password"/);
  assert.match(markup, /type="email"[^>]*name="email"/);
  assert.match(markup, /type="email"[^>]*maxLength="254"/);
  assert.match(markup, /autoCapitalize="none" spellCheck="false"/);
  assert.match(markup, /enterKeyHint="next"/);
  assert.match(markup, /type="password"[^>]*name="password"/);
  assert.match(markup, /maxLength="256" type="password"/);
  assert.match(markup, /aria-label="Show password"/);
  assert.match(markup, /<button type="submit" class="primary full">Sign in<\/button>/);
  assert.doesNotMatch(markup, /type="checkbox"/);
});

test('sign-up form keeps consent and policy links visible before submission', () => {
  const markup = renderToStaticMarkup(
    <AccountEntryPage
      mode="signup"
      form={{ displayName: 'Alex Morgan', email: 'seller@example.com', password: 'Example-password-1!' }}
      onFormChange={noop}
      onSubmit={noop}
      passwordVisible={false}
      onTogglePassword={noop}
      acceptedPolicies={false}
      onAcceptedPoliciesChange={noop}
      message=""
      pendingCreateAction={null}
      returnToCreate={false}
      onBack={noop}
      onOpenInfo={noop}
      onSwitchMode={noop}
    />,
  );

  assert.match(markup, /autoComplete="new-password"/);
  assert.match(markup, /type="email"[^>]*name="email"/);
  assert.match(markup, /type="email"[^>]*maxLength="254"/);
  assert.match(markup, /autoCapitalize="none" spellCheck="false"/);
  assert.match(markup, /enterKeyHint="next"/);
  assert.match(markup, /type="password"[^>]*name="password"/);
  assert.match(markup, /maxLength="256" type="password"/);
  assert.match(markup, /<input id="signup-policy" required="" type="checkbox"/);
  assert.match(markup, /href="\/terms"/);
  assert.match(markup, /href="\/privacy"/);
  assert.match(markup, /<button type="submit" class="primary full">Create account &amp; continue<\/button>/);
});

test('sign-up validation reports every incomplete account field in form order', () => {
  assert.deepEqual(
    signupValidationErrors({ displayName: ' ', email: 'not-an-email', password: 'short' }, false, false),
    [
      { fieldId: 'signup-display-name', message: 'Enter 2+ characters.' },
      { fieldId: 'signup-email', message: 'Enter a valid email.' },
      {
        fieldId: 'signup-password',
        message: 'Use 12+ characters with uppercase, lowercase, a number, and a symbol.',
      },
      {
        fieldId: 'signup-policy',
        message: 'Accept Terms and Privacy notice.',
      },
    ],
  );
});

test('password recovery reports strength and confirmation failures together', () => {
  assert.deepEqual(recoveryValidationErrors('short', 'different'), [
    {
      fieldId: 'recovery-password',
      message: 'Use 12+ characters with uppercase, lowercase, a number, and a symbol.',
    },
    { fieldId: 'recovery-confirm-password', message: 'Passwords differ.' },
  ]);
  assert.deepEqual(recoveryValidationErrors('Strong-password-123!', 'Strong-password-123!'), []);
});

test('account password changes report every incomplete field in form order', () => {
  assert.deepEqual(accountPasswordValidationErrors('', 'short', ''), [
    { fieldId: 'account-current-password', message: 'Enter your current password.' },
    {
      fieldId: 'account-new-password',
      message: 'Use 12+ characters with uppercase, lowercase, a number, and a symbol.',
    },
    { fieldId: 'account-confirm-password', message: 'Confirm your new password.' },
  ]);
  assert.deepEqual(
    accountPasswordValidationErrors('Current-password-123!', 'Strong-password-123!', 'Strong-password-123!'),
    [],
  );
});

test('critical secondary actions cannot accidentally submit an account form', () => {
  const markup = renderToStaticMarkup(<ForgotPasswordEntry onOpen={noop} />);
  assert.equal(markup, '<div class="forgot-entry"><button type="button">Forgot password?</button></div>');
});

test('MFA sign-in keeps the validation action available for an incomplete code', () => {
  const markup = renderToStaticMarkup(
    <MfaLoginVerification
      challenge={{
        mfaRequired: true,
        pendingAccessToken: 'pending-token',
        expiresAt: Date.now() + 60_000,
        factors: [
          {
            id: 'factor-1',
            factorType: 'totp',
            friendlyName: 'Primary authenticator',
            createdAt: null,
            updatedAt: null,
          },
        ],
      }}
      onVerified={noop}
      onCancel={noop}
    />,
  );

  assert.match(markup, /required=""/);
  assert.match(markup, /pattern="\[0-9\]\{6\}"/);
  assert.match(markup, /<button type="submit" class="primary full">/);
});

test('brand lockup exposes one stable accessible name', () => {
  const markup = renderToStaticMarkup(<BrandLogo />);
  assert.match(markup, /aria-label="Dealivra"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, />Dealivra<\/span>/);
});

test('shared feedback uses polite status semantics for non-destructive outcomes', () => {
  const markup = renderToStaticMarkup(<FeedbackMessage tone="success">Password updated.</FeedbackMessage>);

  assert.match(markup, /class="feedback-message success"/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /aria-atomic="true"/);
  assert.match(markup, /aria-hidden="true"/);
});

test('shared feedback announces blocking errors assertively without exposing the icon', () => {
  const markup = renderToStaticMarkup(
    <FeedbackMessage tone="error">The request could not be completed.</FeedbackMessage>,
  );

  assert.match(markup, /class="feedback-message error"/);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /aria-live="assertive"/);
  assert.match(markup, /The request could not be completed\./);
});

test('field errors are linked, assertive, and keep decorative icons hidden', () => {
  const markup = renderToStaticMarkup(<FieldError id="email-error">Enter a valid email.</FieldError>);
  assert.match(markup, /id="email-error"/);
  assert.match(markup, /class="field-error"/);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /Enter a valid email\./);
});

test('loading and retry states expose accurate live-region and button semantics', () => {
  const loading = renderToStaticMarkup(<AsyncStatePanel state="loading" title="Loading meeting details…" />);
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-live="polite"/);
  assert.match(loading, /aria-busy="true"/);
  assert.doesNotMatch(loading, /<button/);

  const error = renderToStaticMarkup(<AsyncStatePanel state="error" title="Meeting unavailable" onAction={noop} />);
  assert.match(error, /role="alert"/);
  assert.match(error, /aria-live="assertive"/);
  assert.match(error, /<button type="button"/);
  assert.match(error, />Try again</);
});

test('validation summaries announce errors and link each item to a focus action', () => {
  const markup = renderToStaticMarkup(
    <ValidationSummary
      id="shipping-validation-summary"
      title="Check the delivery address"
      errors={[
        { fieldId: 'shipping-state', message: 'Select a state.' },
        { fieldId: 'shipping-postal-code', message: 'Enter a valid ZIP code.' },
      ]}
    />,
  );

  assert.match(markup, /id="shipping-validation-summary"/);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /aria-live="assertive"/);
  assert.match(markup, /aria-atomic="true"/);
  assert.match(markup, /aria-labelledby="shipping-validation-summary-title"/);
  assert.match(markup, /tabindex="-1"/);
  assert.match(markup, /<button type="button">Select a state\.<\/button>/);
  assert.match(markup, /<button type="button">Enter a valid ZIP code\.<\/button>/);
});

test('prominent validation summaries keep decorative icons hidden', () => {
  const markup = renderToStaticMarkup(
    <ValidationSummary
      id="create-validation-summary"
      className="create-validation-summary"
      title="Check 1 detail before continuing"
      errors={[{ fieldId: 'item-title', message: 'Enter an item title.' }]}
      eyebrow="Needs attention"
      message="Choose an item below to jump directly to the field."
      headingLevel={2}
      icon={<ShieldAlert />}
    />,
  );

  assert.match(markup, /class="create-validation-icon" aria-hidden="true"/);
  assert.match(markup, /<h2 id="create-validation-summary-title"/);
  assert.match(markup, /Needs attention/);
  assert.match(markup, /Enter an item title\./);
});
