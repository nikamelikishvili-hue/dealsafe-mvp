import { useState, type FormEvent, type MouseEvent } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { t } from './i18n';
import { publicInfoPaths, type PublicInfoView } from './navigation';
import { requestPasswordReset, updateRecoveredPassword } from './services/supabaseRest';

export type AuthMode = 'signin' | 'signup';
export type PendingCreateAction = 'save' | 'publish' | null;
export type AuthFormState = {
  displayName: string;
  email: string;
  password: string;
};

type AccountEntryPageProps = {
  mode: AuthMode;
  form: AuthFormState;
  onFormChange: (next: AuthFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  passwordVisible: boolean;
  onTogglePassword: () => void;
  acceptedPolicies: boolean;
  onAcceptedPoliciesChange: (accepted: boolean) => void;
  message: string;
  pendingCreateAction: PendingCreateAction;
  returnToCreate: boolean;
  onBack: () => void;
  onOpenInfo: (view: PublicInfoView) => void;
  onSwitchMode: () => void;
};

export function ForgotPasswordEntry({ onOpen }: { onOpen: () => void }) {
  return <div className="forgot-entry">
    <button onClick={onOpen}>{t('Forgot password?')}</button>
  </div>;
}

export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setMessage('');
    try {
      await requestPasswordReset(email);
      setMessage('If an account exists for this email, a password reset link has been sent.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send reset email');
    } finally {
      setSending(false);
    }
  };

  return <section className="recovery-page">
    <button className="back" onClick={onBack}>← {t('Back to sign in')}</button>
    <p className="eyebrow">{t('Account recovery')}</p>
    <h1>{t('Reset your password')}</h1>
    <p>{t('Enter your account email. For privacy, the result will not reveal whether an account exists.')}</p>
    <form onSubmit={submit}>
      <label>
        {t('Email')}
        <input
          required
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </label>
      {message && <div className="notice">{t(message)}</div>}
      <button className="primary full" disabled={sending}>
        {t(sending ? 'Sending…' : 'Send reset link')}
      </button>
    </form>
  </section>;
}

export function ResetPassword({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    try {
      await updateRecoveredPassword(token, password);
      history.replaceState(null, '', location.pathname);
      setMessage('Password updated. You can now sign in.');
      setTimeout(onDone, 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update password');
    }
  };

  return <section className="recovery-page">
    <p className="eyebrow">{t('Secure recovery')}</p>
    <h1>{t('Choose a new password')}</h1>
    <form onSubmit={submit}>
      <label>
        {t('New password')}
        <input
          required
          minLength={12}
          autoComplete="new-password"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
      </label>
      <label>
        {t('Confirm password')}
        <input
          required
          minLength={12}
          autoComplete="new-password"
          type="password"
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
        />
      </label>
      <small>{t('Use 12+ characters with uppercase, lowercase, a number, and a symbol.')}</small>
      {message && <div className="notice">{t(message)}</div>}
      <button className="primary full">{t('Update password')}</button>
    </form>
  </section>;
}

export function AccountEntryPage({
  mode,
  form,
  onFormChange,
  onSubmit,
  passwordVisible,
  onTogglePassword,
  acceptedPolicies,
  onAcceptedPoliciesChange,
  message,
  pendingCreateAction,
  returnToCreate,
  onBack,
  onOpenInfo,
  onSwitchMode
}: AccountEntryPageProps) {
  const pendingCreateLabel = pendingCreateAction === 'save' ? 'save this draft' : 'publish this deal';
  const pendingAuthTitle = mode === 'signup'
    ? `Create your account to ${pendingCreateLabel}.`
    : `Sign in to ${pendingCreateLabel}.`;
  const pendingAuthAction = mode === 'signup'
    ? pendingCreateAction === 'save' ? 'Create account & save' : 'Create account & publish'
    : pendingCreateAction === 'save' ? 'Sign in & save' : 'Sign in & publish';
  const isSignup = mode === 'signup';

  const openInfo = (event: MouseEvent<HTMLAnchorElement>, view: PublicInfoView) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenInfo(view);
  };

  return <section className="form-wrap auth-wrap">
    <button className="back" onClick={onBack}>← {t(returnToCreate ? 'Back to draft' : 'Back')}</button>
    <p className="eyebrow">
      {pendingCreateAction ? 'FINAL STEP · ACCOUNT' : isSignup ? 'START YOUR PRIVATE DEAL' : 'DEALIVRA ACCOUNT'}
    </p>
    <h1>{t(pendingCreateAction ? pendingAuthTitle : isSignup ? 'Create your account to start a deal.' : 'Welcome back')}</h1>
    <p className="auth-market-note">
      {pendingCreateAction
        ? 'Your completed draft is ready. Sign in or create an account, and Dealivra will finish the action you selected.'
        : isSignup
          ? 'Save the item, terms, and handoff details in one private record. Setup takes about a minute.'
          : 'Sign in to continue your active deals and saved records.'}
    </p>

    {isSignup && <ol className="auth-journey" aria-label="Deal setup progress">
      <li className={pendingCreateAction ? 'is-complete' : 'is-current'}>
        <span>{pendingCreateAction ? <Check size={15} /> : 1}</span>
        <div>
          <strong>{pendingCreateAction ? 'Draft ready' : 'Account'}</strong>
          <small>{pendingCreateAction ? 'Item and terms completed' : 'Create your secure profile'}</small>
        </div>
      </li>
      <li className={pendingCreateAction ? 'is-current' : ''}>
        <span>2</span>
        <div>
          <strong>{pendingCreateAction ? 'Account' : 'Deal details'}</strong>
          <small>{pendingCreateAction ? 'Secure your private record' : 'Add item and terms'}</small>
        </div>
      </li>
      <li>
        <span>3</span>
        <div><strong>Share link</strong><small>Invite the other party</small></div>
      </li>
    </ol>}

    <form onSubmit={onSubmit}>
      {isSignup && <label>
        {t('Your name')}
        <input
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          placeholder="Alex Morgan"
          value={form.displayName}
          onChange={event => onFormChange({ ...form, displayName: event.target.value })}
        />
      </label>}
      <label>
        {t('Email')}
        <input
          required
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={event => onFormChange({ ...form, email: event.target.value })}
        />
      </label>
      <label>
        {t('Password')}
        <span className="password-field">
          <input
            required
            minLength={isSignup ? 12 : 1}
            type={passwordVisible ? 'text' : 'password'}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder={t(isSignup ? '12+ characters' : 'Your password')}
            value={form.password}
            onChange={event => onFormChange({ ...form, password: event.target.value })}
          />
          <button
            type="button"
            aria-label={t(passwordVisible ? 'Hide password' : 'Show password')}
            onClick={onTogglePassword}
          >
            {passwordVisible ? <EyeOff /> : <Eye />}
          </button>
        </span>
        {isSignup && <small>{t('Use 12+ characters with uppercase, lowercase, a number, and a symbol.')}</small>}
      </label>
      {isSignup && <label className="policy-consent">
        <input
          required
          type="checkbox"
          checked={acceptedPolicies}
          onChange={event => onAcceptedPoliciesChange(event.target.checked)}
        />
        <span>
          I agree to the beta{' '}
          <a href={publicInfoPaths.terms} onClick={event => openInfo(event, 'terms')}>Terms</a>
          {' '}and acknowledge the{' '}
          <a href={publicInfoPaths.privacy} onClick={event => openInfo(event, 'privacy')}>Privacy notice</a>.
        </span>
      </label>}
      {message && <div className="notice" role="status">{t(message)}</div>}
      <button className="primary full" disabled={isSignup && !acceptedPolicies}>
        {t(pendingCreateAction ? pendingAuthAction : isSignup ? 'Create account & continue' : 'Sign in')}
      </button>
      <button type="button" className="switch-auth" onClick={onSwitchMode}>
        {t(isSignup ? 'Already have an account? Sign in' : 'New to Dealivra? Create account')}
      </button>
    </form>
  </section>;
}
