import assert from 'node:assert/strict';
import test from 'node:test';
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

const { AccountEntryPage, ForgotPasswordEntry } = await import('../../src/AccountEntryPages');
const { AddressAutocomplete } = await import('../../src/AddressAutocomplete');
const { BrandLogo } = await import('../../src/BrandLogo');
const { FeedbackMessage } = await import('../../src/FeedbackMessage');
const { FieldError } = await import('../../src/FieldError');
const { AsyncStatePanel } = await import('../../src/AsyncStatePanel');
const { isUsPostalCode, normalizeUsState, parseGoogleUsAddress, parseStoredUsAddress, serializeUsAddress } =
  await import('../../src/usAddress');

const noop = () => {};

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
  assert.match(markup, /type="checkbox"/);
  assert.match(markup, /href="\/terms"/);
  assert.match(markup, /href="\/privacy"/);
  assert.match(
    markup,
    /<button type="submit" class="primary full" disabled="">Create account &amp; continue<\/button>/,
  );
});

test('critical secondary actions cannot accidentally submit an account form', () => {
  const markup = renderToStaticMarkup(<ForgotPasswordEntry onOpen={noop} />);
  assert.equal(markup, '<div class="forgot-entry"><button type="button">Forgot password?</button></div>');
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
