import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { FeedbackMessage } from './FeedbackMessage';
import { FieldError } from './FieldError';
import { ValidationSummary, type ValidationSummaryItem } from './ValidationSummary';
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

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;
const passwordRequirement = 'Use 12+ characters with uppercase, lowercase, a number, and a symbol.';
const issue = (fieldId: string, message: string): ValidationSummaryItem => ({ fieldId, message });
const issues = (...items: (ValidationSummaryItem | false)[]) => items.filter(Boolean) as ValidationSummaryItem[];
const hasError = (errors: ValidationSummaryItem[], fieldId: string) => errors.some(error => error.fieldId === fieldId);
const focusSummary = (id: string) => window.requestAnimationFrame(() => document.getElementById(id)?.focus());

export function recoveryValidationErrors(password: string, confirmation: string) {
  return issues(
    !passwordPattern.test(password) && issue('recovery-password', passwordRequirement),
    password !== confirmation && issue('recovery-confirm-password', 'Passwords differ.'),
  );
}

export function signupValidationErrors(form: AuthFormState, emailValid: boolean, acceptedPolicies: boolean) {
  return issues(
    form.displayName.trim().length < 2 && issue('signup-display-name', 'Enter 2+ characters.'),
    !emailValid && issue('signup-email', 'Enter a valid email.'),
    !passwordPattern.test(form.password) && issue('signup-password', passwordRequirement),
    !acceptedPolicies && issue('signup-policy', 'Accept Terms and Privacy notice.'),
  );
}

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
  submitting: boolean;
  pendingCreateAction: PendingCreateAction;
  returnToCreate: boolean;
  onBack: () => void;
  onOpenInfo: (view: PublicInfoView) => void;
  onSwitchMode: () => void;
};

export function ForgotPasswordEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="forgot-entry">
      <button type="button" onClick={onOpen}>
        {t('Forgot password?')}
      </button>
    </div>
  );
}

export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendingRef.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    setEmailError('');
    if (!normalizedEmail) {
      setEmailError('Enter your account email.');
      window.requestAnimationFrame(() => emailRef.current?.focus());
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setMessage('');
    setFailed(false);
    try {
      await requestPasswordReset(normalizedEmail);
      setMessage('If an account exists for this email, a password reset link has been sent.');
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Could not send reset email');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <section className="recovery-page">
      <button type="button" className="back" onClick={onBack}>
        ← {t('Back to sign in')}
      </button>
      <p className="eyebrow">{t('Account recovery')}</p>
      <h1>{t('Reset your password')}</h1>
      <p>{t('Enter your account email. For privacy, the result will not reveal whether an account exists.')}</p>
      <form onSubmit={submit} aria-busy={sending}>
        <label>
          {t('Email')}
          <input
            ref={emailRef}
            required
            type="email"
            name="email"
            maxLength={254}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="send"
            disabled={sending}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? 'forgot-password-email-error' : undefined}
            value={email}
            onChange={event => {
              setEmail(event.target.value);
              if (emailError) setEmailError('');
            }}
            placeholder="you@example.com"
          />
          {emailError && <FieldError id="forgot-password-email-error">{emailError}</FieldError>}
        </label>
        {message && <FeedbackMessage tone={failed ? 'error' : 'info'}>{t(message)}</FeedbackMessage>}
        <button type="submit" className="primary full" disabled={sending}>
          {t(sending ? 'Sending…' : 'Send reset link')}
        </button>
      </form>
    </section>
  );
}

export function ResetPassword({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<ValidationSummaryItem[]>([]);
  const [updating, setUpdating] = useState(false);
  const updatingRef = useRef(false);
  const passwordError = hasError(errors, 'recovery-password');
  const confirmPasswordError = hasError(errors, 'recovery-confirm-password');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (updatingRef.current) return;
    setMessage('');
    const nextErrors = recoveryValidationErrors(password, confirmPassword);
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      focusSummary('recovery-validation-summary');
      return;
    }
    updatingRef.current = true;
    setUpdating(true);
    try {
      await updateRecoveredPassword(token, password);
      history.replaceState(null, '', location.pathname);
      setMessage('Password updated. You can now sign in.');
      setTimeout(onDone, 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update password');
    } finally {
      updatingRef.current = false;
      setUpdating(false);
    }
  };

  return (
    <section className="recovery-page">
      <p className="eyebrow">{t('Secure recovery')}</p>
      <h1>{t('Choose a new password')}</h1>
      <form onSubmit={submit} aria-busy={updating} noValidate>
        {errors.length > 0 ? (
          <ValidationSummary id="recovery-validation-summary" title="Review password" errors={errors} />
        ) : null}
        <label>
          {t('New password')}
          <input
            id="recovery-password"
            required
            name="new"
            minLength={12}
            maxLength={256}
            autoComplete="new-password"
            type="password"
            enterKeyHint="next"
            aria-invalid={passwordError}
            aria-describedby="recovery-password-requirements"
            disabled={updating}
            value={password}
            onChange={event => {
              setPassword(event.target.value);
              setErrors([]);
            }}
          />
        </label>
        <label>
          {t('Confirm password')}
          <input
            id="recovery-confirm-password"
            required
            name="confirm"
            minLength={12}
            maxLength={256}
            autoComplete="new-password"
            type="password"
            enterKeyHint="done"
            aria-invalid={confirmPasswordError}
            aria-describedby="recovery-password-requirements"
            disabled={updating}
            value={confirmPassword}
            onChange={event => {
              setConfirmPassword(event.target.value);
              setErrors([]);
            }}
          />
        </label>
        <small id="recovery-password-requirements">{t(passwordRequirement)}</small>
        {message && (
          <FeedbackMessage tone={message === 'Password updated. You can now sign in.' ? 'success' : 'error'}>
            {t(message)}
          </FeedbackMessage>
        )}
        <button type="submit" className="primary full" disabled={updating}>
          {t(updating ? 'Updating password…' : 'Update password')}
        </button>
      </form>
    </section>
  );
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
  submitting,
  pendingCreateAction,
  returnToCreate,
  onBack,
  onOpenInfo,
  onSwitchMode,
}: AccountEntryPageProps) {
  const pendingCreateLabel = pendingCreateAction === 'save' ? 'save this draft' : 'publish this deal';
  const pendingAuthTitle =
    mode === 'signup' ? `Create your account to ${pendingCreateLabel}.` : `Sign in to ${pendingCreateLabel}.`;
  const pendingAuthAction =
    mode === 'signup'
      ? pendingCreateAction === 'save'
        ? 'Create account & save'
        : 'Create account & publish'
      : pendingCreateAction === 'save'
        ? 'Sign in & save'
        : 'Sign in & publish';
  const isSignup = mode === 'signup';
  const [entryErrors, setEntryErrors] = useState<ValidationSummaryItem[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);
  const displayNameError = hasError(entryErrors, 'signup-display-name');
  const passwordError = hasError(entryErrors, 'signup-password');
  const emailError = hasError(entryErrors, 'signup-email');
  const policyError = hasError(entryErrors, 'signup-policy');

  useEffect(() => {
    setEntryErrors([]);
  }, [mode]);

  const submitEntry = (event: FormEvent<HTMLFormElement>) => {
    if (!isSignup) {
      onSubmit(event);
      return;
    }
    event.preventDefault();
    const normalizedDisplayName = form.displayName.trim();
    const nextErrors = signupValidationErrors(form, Boolean(emailRef.current?.validity.valid), acceptedPolicies);
    setEntryErrors(nextErrors);
    if (nextErrors.length > 0) {
      focusSummary('signup-validation-summary');
      return;
    }
    onFormChange({ ...form, displayName: normalizedDisplayName });
    onSubmit(event);
  };

  const openInfo = (event: MouseEvent<HTMLAnchorElement>, view: PublicInfoView) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenInfo(view);
  };

  return (
    <section className="form-wrap auth-wrap">
      <button type="button" className="back" disabled={submitting} onClick={onBack}>
        ← {t(returnToCreate ? 'Back to draft' : 'Back')}
      </button>
      <p className="eyebrow">
        {pendingCreateAction ? 'FINAL STEP · ACCOUNT' : isSignup ? 'START YOUR PRIVATE DEAL' : 'DEALIVRA ACCOUNT'}
      </p>
      <h1>
        {t(pendingCreateAction ? pendingAuthTitle : isSignup ? 'Create your account to start a deal.' : 'Welcome back')}
      </h1>
      <p className="auth-market-note">
        {pendingCreateAction
          ? 'Your draft is ready. Sign in or create an account to continue.'
          : isSignup
            ? 'Keep item, terms, and handoff details in one private record.'
            : 'Sign in to continue your active deals and saved records.'}
      </p>

      {isSignup && (
        <ol className="auth-journey" aria-label="Deal setup progress">
          <li className={pendingCreateAction ? 'is-complete' : 'is-current'}>
            <span>{pendingCreateAction ? <Check size={15} /> : 1}</span>
            <div>
              <strong>{pendingCreateAction ? 'Draft ready' : 'Account'}</strong>
              <small>{pendingCreateAction ? 'Draft complete' : 'Secure profile'}</small>
            </div>
          </li>
          <li className={pendingCreateAction ? 'is-current' : ''}>
            <span>2</span>
            <div>
              <strong>{pendingCreateAction ? 'Account' : 'Deal details'}</strong>
              <small>{pendingCreateAction ? 'Secure record' : 'Add item and terms'}</small>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Share link</strong>
              <small>Invite the other party</small>
            </div>
          </li>
        </ol>
      )}

      <form onSubmit={submitEntry} aria-busy={submitting} noValidate={isSignup}>
        {isSignup && entryErrors.length > 0 ? (
          <ValidationSummary id="signup-validation-summary" title="Check account details" errors={entryErrors} />
        ) : null}
        {isSignup && (
          <label>
            {t('Your name')}
            <input
              id="signup-display-name"
              required
              disabled={submitting}
              minLength={2}
              maxLength={80}
              autoComplete="name"
              aria-invalid={displayNameError}
              aria-describedby="signup-validation-summary"
              value={form.displayName}
              onChange={event => {
                onFormChange({ ...form, displayName: event.target.value });
                setEntryErrors([]);
              }}
            />
          </label>
        )}
        <label>
          {t('Email')}
          <input
            ref={emailRef}
            id={isSignup ? 'signup-email' : undefined}
            required
            disabled={submitting}
            type="email"
            name="email"
            maxLength={254}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            aria-invalid={isSignup && emailError}
            aria-describedby={isSignup ? 'signup-validation-summary' : undefined}
            value={form.email}
            onChange={event => {
              onFormChange({ ...form, email: event.target.value });
              setEntryErrors([]);
            }}
          />
        </label>
        <label>
          {t('Password')}
          <span className="password-field">
            <input
              id={isSignup ? 'signup-password' : undefined}
              required
              disabled={submitting}
              name="password"
              minLength={isSignup ? 12 : 1}
              maxLength={256}
              type={passwordVisible ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              enterKeyHint="done"
              aria-invalid={isSignup && passwordError}
              aria-describedby={isSignup ? 'signup-password-requirements signup-validation-summary' : undefined}
              placeholder={t(isSignup ? '12+ characters' : 'Your password')}
              value={form.password}
              onChange={event => {
                onFormChange({ ...form, password: event.target.value });
                setEntryErrors([]);
              }}
            />
            <button
              type="button"
              disabled={submitting}
              aria-label={t(passwordVisible ? 'Hide password' : 'Show password')}
              onClick={onTogglePassword}
            >
              {passwordVisible ? <EyeOff /> : <Eye />}
            </button>
          </span>
          {isSignup && <small id="signup-password-requirements">{t(passwordRequirement)}</small>}
        </label>
        {isSignup && (
          <label className="policy-consent">
            <input
              id="signup-policy"
              required
              disabled={submitting}
              type="checkbox"
              checked={acceptedPolicies}
              aria-invalid={policyError}
              aria-describedby="signup-validation-summary"
              onChange={event => {
                onAcceptedPoliciesChange(event.target.checked);
                setEntryErrors([]);
              }}
            />
            <span>
              I agree to the beta{' '}
              <a href={publicInfoPaths.terms} onClick={event => openInfo(event, 'terms')}>
                Terms
              </a>{' '}
              and acknowledge the{' '}
              <a href={publicInfoPaths.privacy} onClick={event => openInfo(event, 'privacy')}>
                Privacy notice
              </a>
              .
            </span>
          </label>
        )}
        {message && <FeedbackMessage tone="error">{t(message)}</FeedbackMessage>}
        <button type="submit" className="primary full" disabled={submitting}>
          {t(
            submitting
              ? isSignup
                ? 'Creating account…'
                : 'Signing in…'
              : pendingCreateAction
                ? pendingAuthAction
                : isSignup
                  ? 'Create account & continue'
                  : 'Sign in',
          )}
        </button>
        <button type="button" className="switch-auth" disabled={submitting} onClick={onSwitchMode}>
          {t(isSignup ? 'Already have an account? Sign in' : 'New to Dealivra? Create account')}
        </button>
      </form>
    </section>
  );
}
