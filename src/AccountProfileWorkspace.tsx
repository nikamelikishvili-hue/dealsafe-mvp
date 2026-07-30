import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Check,
  Copy,
  LockKeyhole,
  Pencil,
  Share2,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { AccountMfaSecurity } from './AccountMfaSecurity';
import { AccountSessionSecurity } from './AccountSessionSecurity';
import { supportCasesEnabled } from './featureFlags';
import { getAppLanguage, t } from './i18n';
import { SupportCaseCenter } from './SupportCaseCenter';
import {
  getTrustPassportSettings,
  setTrustPassportEnabled,
  updateAccountName,
  updateAccountPassword,
  type ProfileSummary,
  type StoredSession,
  type TrustPassportSettings,
} from './services/supabaseRest';

function SecurityCenter({
  email,
  status,
  message,
  onRequest,
}: {
  email: string;
  status: ProfileSummary['verification_status'];
  message: string;
  onRequest: () => void;
}) {
  return (
    <section className="security-center">
      <div className="security-heading">
        <ShieldCheck aria-hidden="true" />
        <div>
          <p className="eyebrow">{t('Account protection')}</p>
          <h2>{t('Verification & Security Center')}</h2>
        </div>
      </div>
      <div className="security-checks">
        <article>
          <Check aria-hidden="true" />
          <div>
            <b>{t('Email account active')}</b>
            <span>{email}</span>
          </div>
        </article>
        <article className={status === 'verified' ? 'verified' : ''}>
          <BadgeCheck aria-hidden="true" />
          <div>
            <b>{t('Identity verification')}</b>
            <span>{t(status.replace('_', ' '))}</span>
          </div>
          {status === 'not_started' ? (
            <button className="secondary" onClick={onRequest}>
              {t('Request verification')}
            </button>
          ) : null}
        </article>
        <article>
          <LockKeyhole aria-hidden="true" />
          <div>
            <b>{t('Secure handoff enabled')}</b>
            <span>{t('Meeting confirmation and one-time PIN protect in-person deals.')}</span>
          </div>
        </article>
      </div>
      {status === 'pending' ? (
        <div className="notice">
          {t(
            'Identity verification is pending. Approval requires a licensed verification provider, which is not connected in this beta.',
          )}
        </div>
      ) : null}
      {message ? <div className="notice">{t(message)}</div> : null}
      <p className="security-warning">
        <LockKeyhole aria-hidden="true" />{' '}
        {t(
          'Dealivra does not hold or insure payments in this beta. Never send deposits outside the agreed process.',
        )}
      </p>
    </section>
  );
}

function AccountSettings({
  session,
  displayName,
  onNameUpdated,
  onPasswordUpdated,
}: {
  session: StoredSession;
  displayName: string;
  onNameUpdated: (name: string) => void;
  onPasswordUpdated: () => void;
}) {
  const [name, setName] = useState(displayName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameMessage, setNameMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => setName(displayName), [displayName]);

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    setNameMessage('');
    setSavingName(true);
    try {
      await updateAccountName(session, name);
      onNameUpdated(name.trim());
      setNameMessage('Your display name was updated.');
    } catch (error) {
      setNameMessage(error instanceof Error ? error.message : 'Could not update name');
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage('');
    if (password !== confirmPassword) {
      setPasswordMessage('Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await updateAccountPassword(session, currentPassword, password);
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
      onPasswordUpdated();
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : 'Could not update password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="account-settings no-print">
      <div className="settings-heading">
        <Pencil aria-hidden="true" />
        <div>
          <p className="eyebrow">{t('Account settings')}</p>
          <h2>{t('Manage your account')}</h2>
        </div>
      </div>
      <div className="settings-grid">
        <form onSubmit={saveName}>
          <h3>{t('Public display name')}</h3>
          <p>{t('This name appears on your profile and Deal Links.')}</p>
          <label>
            {t('Your name')}
            <input
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              value={name}
              onChange={event => setName(event.target.value)}
            />
          </label>
          {nameMessage ? (
            <div className="notice" role="status">
              {t(nameMessage)}
            </div>
          ) : null}
          <button className="primary" disabled={savingName || name.trim() === displayName}>
            {t(savingName ? 'Saving…' : 'Save name')}
          </button>
        </form>
        <form onSubmit={savePassword}>
          <h3>{t('Change password')}</h3>
          <p>
            {t(
              'Confirm your current password. Use at least 12 characters with uppercase, lowercase, a number, and a symbol.',
            )}
          </p>
          <label>
            {t('Current password')}
            <input
              required
              maxLength={256}
              autoComplete="current-password"
              type="password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            {t('New password')}
            <input
              required
              minLength={12}
              maxLength={256}
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
              maxLength={256}
              autoComplete="new-password"
              type="password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
            />
          </label>
          {passwordMessage ? (
            <div className="notice" role="alert">
              {t(passwordMessage)}
            </div>
          ) : null}
          <button
            className="primary"
            disabled={savingPassword || !currentPassword || !password || !confirmPassword}
          >
            {t(savingPassword ? 'Updating…' : 'Update password')}
          </button>
        </form>
      </div>
    </section>
  );
}

function TrustPassportControls({ session }: { session: StoredSession }) {
  const [settings, setSettings] = useState<TrustPassportSettings | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setMessage('');
    getTrustPassportSettings(session)
      .then(result => {
        if (active) setSettings(result);
      })
      .catch(error => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'Could not load passport settings');
        }
      });
    return () => {
      active = false;
    };
  }, [session.user.id, session.accessToken]);

  const publicUrl = settings ? `${location.origin}/?trust=${settings.public_id}` : '';

  const toggle = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage('');
    try {
      const enabled = !settings.enabled;
      const publicId = await setTrustPassportEnabled(session, enabled);
      setSettings({ public_id: publicId, enabled });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update passport settings');
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setMessage('Passport link copied.');
    } catch {
      setMessage('Could not copy the passport link. Copy it from the address shown above.');
    }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Dealivra Digital Trust Passport', url: publicUrl });
      } else {
        await copy();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage('Could not share the passport link. Copy it instead.');
    }
  };

  return (
    <section className="trust-passport-controls no-print">
      <div className="passport-heading">
        <ShieldCheck aria-hidden="true" />
        <div>
          <p className="eyebrow">{t('Public reputation')}</p>
          <h2>{t('Digital Trust Passport')}</h2>
          <p>{t('Share your verified Dealivra reputation with one link.')}</p>
        </div>
      </div>
      {settings ? (
        <>
          <div className="passport-status">
            <span>
              <b>{t(settings.enabled ? 'Public passport is active' : 'Public passport is off')}</b>
              <small>
                {settings.enabled
                  ? publicUrl
                  : t('Enable it only when you want to share your reputation.')}
              </small>
            </span>
            <button
              className={settings.enabled ? 'secondary' : 'primary'}
              disabled={saving}
              onClick={toggle}
            >
              {t(settings.enabled ? 'Disable public passport' : 'Enable public passport')}
            </button>
          </div>
          {settings.enabled ? (
            <div className="passport-actions">
              <button className="secondary" onClick={copy}>
                <Copy size={17} aria-hidden="true" />
                {t('Copy passport link')}
              </button>
              <button className="primary" onClick={share}>
                <Share2 size={17} aria-hidden="true" />
                {t('Share passport')}
              </button>
            </div>
          ) : null}
        </>
      ) : !message ? (
        <div className="notice">{t('Loading passport…')}</div>
      ) : null}
      {message ? <div className="notice">{t(message)}</div> : null}
      <p className="passport-private">
        <LockKeyhole size={17} aria-hidden="true" />
        {t('Your email, phone, addresses, and identity documents are never shown.')}
      </p>
    </section>
  );
}

function ProfileOverview({
  profile,
  displayName,
  message,
  onBack,
}: {
  profile: ProfileSummary | null;
  displayName: string;
  message: string;
  onBack: () => void;
}) {
  return (
    <section className="profile-page">
      <button className="back" onClick={onBack}>
        ← {t('Dashboard')}
      </button>
      <p className="eyebrow">{t('Trust profile')}</p>
      <h1>{profile?.display_name || displayName}</h1>
      {message ? <div className="notice">{t(message)}</div> : null}
      {profile ? (
        <>
          <div className="profile-stats">
            <article>
              <span>{t('Average rating')}</span>
              <strong>
                {profile.average_rating ?? '—'} <Star size={22} aria-hidden="true" />
              </strong>
              <small>
                {profile.rating_count} {t('received')}
              </small>
            </article>
            <article>
              <span>{t('Completed deals')}</span>
              <strong>{profile.completed_deals}</strong>
              <small>{t('Successful handoffs')}</small>
            </article>
            <article>
              <span>{t('Verification')}</span>
              <strong className="verification-value">
                <BadgeCheck size={22} aria-hidden="true" />
                {t(profile.verification_status.replace('_', ' '))}
              </strong>
              <small>{t('Identity verification comes next')}</small>
            </article>
          </div>
          <div className="profile-details">
            <h2>{t('Reputation history')}</h2>
            <p>
              {t('Member since')}{' '}
              {new Date(profile.member_since).toLocaleDateString(getAppLanguage())}
            </p>
            {profile.recent_ratings.length ? (
              <div className="review-list">
                {profile.recent_ratings.map((rating, index) => (
                  <article key={`${rating.created_at}-${index}`}>
                    <div>
                      {'★'.repeat(rating.stars)}
                      {'☆'.repeat(5 - rating.stars)}
                    </div>
                    <p>{rating.comment || t('No written comment.')}</p>
                    <small>
                      {new Date(rating.created_at).toLocaleDateString(getAppLanguage())}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Star aria-hidden="true" />
                <b>{t('No ratings yet')}</b>
                <span>{t('Ratings received after completed deals will appear here.')}</span>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function AccountProfileWorkspace({
  session,
  profile,
  email,
  displayName,
  message,
  verificationMessage,
  onRequestVerification,
  onSessionUpdated,
  onSignedOut,
  onNameUpdated,
  onPasswordUpdated,
  onBack,
}: {
  session: StoredSession;
  profile: ProfileSummary | null;
  email: string;
  displayName: string;
  message: string;
  verificationMessage: string;
  onRequestVerification: () => void;
  onSessionUpdated: (session: StoredSession) => void;
  onSignedOut: () => void;
  onNameUpdated: (name: string) => void;
  onPasswordUpdated: () => void;
  onBack: () => void;
}) {
  return (
    <>
      {profile ? (
        <SecurityCenter
          email={email}
          status={profile.verification_status}
          message={verificationMessage}
          onRequest={onRequestVerification}
        />
      ) : null}
      <AccountMfaSecurity session={session} onSessionUpdated={onSessionUpdated} />
      <AccountSessionSecurity session={session} onSignedOut={onSignedOut} />
      {supportCasesEnabled ? <SupportCaseCenter session={session} /> : null}
      <TrustPassportControls session={session} />
      {profile ? (
        <AccountSettings
          session={session}
          displayName={profile.display_name}
          onNameUpdated={onNameUpdated}
          onPasswordUpdated={onPasswordUpdated}
        />
      ) : null}
      <ProfileOverview
        profile={profile}
        displayName={displayName}
        message={message}
        onBack={onBack}
      />
    </>
  );
}
