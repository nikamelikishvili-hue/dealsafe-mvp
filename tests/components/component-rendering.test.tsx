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

const noop = () => {};

test('address entry always renders a usable manual line-one fallback', () => {
  const markup = renderToStaticMarkup(
    <AddressAutocomplete value="15900 N Bay" onChange={noop} placeholder="Street address" streetAddressOnly />,
  );

  assert.match(markup, /autoComplete="address-line1"/);
  assert.match(markup, /placeholder="Street address"/);
  assert.match(markup, /value="15900 N Bay"/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /Address suggestions are unavailable\. Enter the address manually\./);
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
