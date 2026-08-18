import { useEffect, useMemo, useRef, useState } from 'react';
import './mfa-step-up.css';
import { copyTextToClipboard } from './clipboard';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  cancelMfaEnrollment,
  getMfaStatus,
  startMfaEnrollment,
  unenrollMfaFactor,
  verifyMfaEnrollment,
  verifyMfaStepUp,
  type MfaEnrollment,
  type MfaStatus,
  type StoredSession,
} from './services/supabaseRest';
import { AsyncStatePanel } from './AsyncStatePanel';

function formatFactorDate(value:string|null){
  if(!value)return 'Enrollment date unavailable';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return 'Enrollment date unavailable';
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(date);
}

export function AccountMfaSecurity({
  session,
  onSessionUpdated,
}:{
  session:StoredSession;
  onSessionUpdated:(session:StoredSession)=>void;
}){
  const [status,setStatus]=useState<MfaStatus|null>(null);
  const [enrollment,setEnrollment]=useState<MfaEnrollment|null>(null);
  const [friendlyName,setFriendlyName]=useState('Primary authenticator');
  const [code,setCode]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<'enroll'|'verify'|'cancel'|'remove'|''>('');
  const busyRef=useRef(false);
  const deviceNameRef=useRef<HTMLInputElement>(null);
  const removalTriggerRef=useRef<HTMLButtonElement|null>(null);
  const loadRequestRef=useRef(0);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [loadError,setLoadError]=useState('');
  const [confirmRemove,setConfirmRemove]=useState<string|null>(null);
  const [removeVerificationFactorId,setRemoveVerificationFactorId]=useState('');
  const [removeCode,setRemoveCode]=useState('');

  const loadStatus=async(activeSession=session)=>{
    const request=++loadRequestRef.current;
    setLoading(true);
    setLoadError('');
    try{
      const result=await getMfaStatus(activeSession);
      if(request!==loadRequestRef.current)return;
      setStatus(result);
    }catch(loadError){
      if(request!==loadRequestRef.current)return;
      setLoadError(loadError instanceof Error?loadError.message:'Could not load authenticator security.');
    }finally{
      if(request===loadRequestRef.current)setLoading(false);
    }
  };

  useEffect(()=>{
    let active=true;
    const request=++loadRequestRef.current;
    setLoading(true);
    setLoadError('');
    getMfaStatus(session)
      .then(result=>{if(active&&request===loadRequestRef.current)setStatus(result)})
      .catch(loadError=>{if(active&&request===loadRequestRef.current)setLoadError(loadError instanceof Error?loadError.message:'Could not load authenticator security.')})
      .finally(()=>{if(active&&request===loadRequestRef.current)setLoading(false)});
    return()=>{active=false;loadRequestRef.current+=1};
  },[session.user.id,session.accessToken]);

  const qrCodeUrl=useMemo(()=>enrollment
    ?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qrCodeSvg)}`
    :'',[enrollment]);

  const beginEnrollment=async()=>{
    if(busyRef.current)return;
    if(friendlyName.trim().length<2){
      setError('Enter a device name.');
      deviceNameRef.current?.focus();
      return;
    }
    busyRef.current=true;
    setBusy('enroll');
    setMessage('');
    setError('');
    try{
      setEnrollment(await startMfaEnrollment(session,friendlyName));
      setCode('');
    }catch(actionError){
      setError(actionError instanceof Error?actionError.message:'Authenticator setup could not start.');
    }finally{
      busyRef.current=false;
      setBusy('');
    }
  };

  const verifyEnrollment=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!enrollment)return;
    if(busyRef.current)return;
    busyRef.current=true;
    setBusy('verify');
    setMessage('');
    setError('');
    try{
      const updated=await verifyMfaEnrollment(session,enrollment.factorId,code);
      onSessionUpdated(updated);
      setEnrollment(null);
      setCode('');
      setMessage('Authenticator protection is active. Other account sessions were signed out.');
      await loadStatus(updated);
    }catch(actionError){
      setError(actionError instanceof Error?actionError.message:'The authenticator code was not accepted.');
    }finally{
      busyRef.current=false;
      setBusy('');
    }
  };

  const cancelEnrollment=async()=>{
    if(!enrollment){setEnrollment(null);return}
    if(busyRef.current)return;
    busyRef.current=true;
    setBusy('cancel');
    setError('');
    try{
      const updated=await cancelMfaEnrollment(session,enrollment.factorId);
      onSessionUpdated(updated);
      setEnrollment(null);
      setCode('');
      await loadStatus(updated);
    }catch(actionError){
      setError(actionError instanceof Error?actionError.message:'The unfinished authenticator setup could not be removed.');
    }finally{
      busyRef.current=false;
      setBusy('');
    }
  };

  const beginFactorRemoval=(factorId:string,trigger:HTMLButtonElement)=>{
    const verificationFactor=status?.factors.find(factor=>factor.id!==factorId)
      ??status?.factors.find(factor=>factor.id===factorId);
    if(!verificationFactor){
      setError('A verified authenticator is required before a sign-in method can be removed.');
      return;
    }
    setMessage('');
    setError('');
    removalTriggerRef.current=trigger;
    setConfirmRemove(factorId);
    setRemoveVerificationFactorId(verificationFactor.id);
    setRemoveCode('');
  };

  const cancelFactorRemoval=()=>{
    if(busy)return;
    setConfirmRemove(null);
    setRemoveVerificationFactorId('');
    setRemoveCode('');
    window.requestAnimationFrame(()=>removalTriggerRef.current?.focus());
  };

  const removeFactor=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!confirmRemove||!removeVerificationFactorId||removeCode.length!==6)return;
    if(busyRef.current)return;
    busyRef.current=true;
    setBusy('remove');
    setMessage('');
    setError('');
    try{
      const verifiedSession=await verifyMfaStepUp(
        session,
        removeVerificationFactorId,
        removeCode,
      );
      onSessionUpdated(verifiedSession);
      const updated=await unenrollMfaFactor(verifiedSession,confirmRemove);
      onSessionUpdated(updated);
      setConfirmRemove(null);
      setRemoveVerificationFactorId('');
      setRemoveCode('');
      setMessage('Authenticator method removed. Review the remaining protection before signing out.');
      await loadStatus(updated);
    }catch(actionError){
      setError(actionError instanceof Error?actionError.message:'Authenticator method could not be removed.');
    }finally{
      busyRef.current=false;
      setBusy('');
    }
  };

  const copySecret=async()=>{
    if(!enrollment)return;
    try{
      await copyTextToClipboard(enrollment.secret);
      setMessage('Setup key copied. Keep it private and remove it from your clipboard after setup.');
    }catch{
      setError('Could not copy the setup key. Select and copy it manually.');
    }
  };

  const protectedByMfa=Boolean(status?.factors.length||status?.unsupportedVerifiedFactor);
  const factorFloorReached=Boolean(
    status
    && status.minimumVerifiedFactors > 0
    && status.factors.length <= status.minimumVerifiedFactors,
  );

  return <section className="account-mfa-security" aria-labelledby="account-mfa-title">
    <header className="mfa-security-heading">
      <span className="mfa-security-icon"><KeyRound aria-hidden="true"/></span>
      <div>
        <p className="eyebrow">MULTI-FACTOR SECURITY</p>
        <h2 id="account-mfa-title">Authenticator protection</h2>
        <p>Require a rotating code after your password. Dealivra never asks you to send this code to another person.</p>
      </div>
      <span className={`mfa-state ${protectedByMfa?'is-protected':''}`}>
        {protectedByMfa?<CheckCircle2 aria-hidden="true"/>:<ShieldCheck aria-hidden="true"/>}
        {protectedByMfa?'Protected':'Recommended'}
      </span>
    </header>

    {loading?<AsyncStatePanel state="loading" title="Checking authenticator protection…" message="Verifying your enrolled methods securely."/>:null}

    {!loading&&loadError?<AsyncStatePanel state="error" title="Authenticator status unavailable" message={loadError} actionLabel="Retry securely" onAction={()=>loadStatus()}/>:null}

    {!loading&&!loadError&&status?.unsupportedVerifiedFactor?<div className="mfa-feedback error" role="alert">
      This account has a verified sign-in method that Dealivra cannot manage here. Contact support without sharing any verification code or setup key.
    </div>:null}

    {!loading&&!loadError&&status?.factors.length?<ul className="mfa-factor-list">
      {status.factors.map(factor=><li key={factor.id}>
        <span className="mfa-factor-icon"><KeyRound aria-hidden="true"/></span>
        <span><strong>{factor.friendlyName}</strong><small>Authenticator app · Added {formatFactorDate(factor.createdAt)}</small></span>
        <b>{status.assuranceLevel==='aal2'?'Verified this session':'Verification required'}</b>
        <button
          type="button"
          onClick={event=>beginFactorRemoval(factor.id,event.currentTarget)}
          disabled={Boolean(busy)||factorFloorReached}
          aria-label={`Remove ${factor.friendlyName}`}
          title={factorFloorReached?'Add and verify another authenticator before removing this one.':undefined}
        >
          <Trash2 aria-hidden="true"/>
        </button>
      </li>)}
    </ul>:null}

    {!loading&&!loadError&&factorFloorReached?<div className="mfa-feedback protected" role="status">
      This privileged account must keep at least {status?.minimumVerifiedFactors} verified authenticators. Add a replacement before removing one.
    </div>:null}

    {!loading&&!loadError&&!enrollment&&!status?.unsupportedVerifiedFactor?<div className="mfa-enroll-start">
      <div>
        <strong>{protectedByMfa?'Add a backup authenticator':'Protect this account'}</strong>
        <span>{protectedByMfa?'A second enrolled device reduces account-recovery risk.':'Use any standards-based TOTP authenticator app.'}</span>
      </div>
      <label>
        <span>Device name</span>
        <input ref={deviceNameRef} value={friendlyName} minLength={2} maxLength={48} disabled={Boolean(busy)} onChange={event=>setFriendlyName(event.target.value)} autoComplete="off"/>
      </label>
      <button type="button" className="mfa-primary" onClick={beginEnrollment} disabled={Boolean(busy)}>
        <Plus aria-hidden="true"/>{busy==='enroll'?'Starting…':protectedByMfa?'Add authenticator':'Set up authenticator'}
      </button>
    </div>:null}

    {enrollment?<div className="mfa-enrollment" aria-labelledby="mfa-enrollment-title">
      <div className="mfa-enrollment-title">
        <div><p className="eyebrow">PRIVATE SETUP</p><h3 id="mfa-enrollment-title">Scan, then verify</h3></div>
        <button type="button" onClick={cancelEnrollment} disabled={Boolean(busy)} aria-label="Cancel authenticator setup"><X/></button>
      </div>
      <div className="mfa-enrollment-grid">
        <div className="mfa-qr"><img src={qrCodeUrl} alt="Dealivra authenticator enrollment QR code"/></div>
        <div className="mfa-setup-steps">
          <ol>
            <li>Open an authenticator app and scan the QR code.</li>
            <li>Enter the current six-digit code below.</li>
            <li>Keep a second authenticator enrolled before replacing your main device.</li>
          </ol>
          <details>
            <summary>Can’t scan the QR code?</summary>
            <p>Enter this setup key manually. Treat it like a password.</p>
            <div className="mfa-secret"><code>{enrollment.secret}</code><button type="button" onClick={copySecret} disabled={Boolean(busy)}><Copy/>Copy</button></div>
          </details>
          <form onSubmit={verifyEnrollment} aria-busy={busy==='verify'}>
            <label>Six-digit code
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                disabled={Boolean(busy)}
                onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))}
              />
            </label>
            <button type="submit" className="mfa-primary" disabled={Boolean(busy)}>
              <ShieldCheck aria-hidden="true"/>{busy==='verify'?'Verifying…':'Enable protection'}
            </button>
          </form>
        </div>
      </div>
    </div>:null}

    {message?<div className="mfa-feedback success" role="status">{message}</div>:null}
    {error?<div className="mfa-feedback error" role="alert">{error}</div>:null}

    <p className="mfa-recovery-note"><ShieldCheck aria-hidden="true"/>Losing every enrolled authenticator requires a controlled account-recovery review. Dealivra support will never ask for your current code or setup key.</p>

    {confirmRemove?<form
      className="mfa-remove-confirmation"
      role="region"
      aria-labelledby="mfa-remove-title"
      aria-describedby="mfa-remove-description"
      onSubmit={removeFactor}
      onKeyDown={event=>{
        if(event.key!=='Escape'||busy)return;
        event.preventDefault();
        cancelFactorRemoval();
      }}
      aria-busy={busy==='remove'}
    >
      <div className="mfa-remove-copy">
        <p className="eyebrow">SENSITIVE CHANGE</p>
        <strong id="mfa-remove-title">Confirm it’s you before removal</strong>
        <span id="mfa-remove-description">
          Enter a fresh code from an enrolled authenticator. Dealivra never asks you to send this code to support.
        </span>
      </div>
      <div className="mfa-remove-fields">
        <label>
          Verification authenticator
          <select
            value={removeVerificationFactorId}
            onChange={event=>setRemoveVerificationFactorId(event.target.value)}
            disabled={Boolean(busy)}
          >
            {status?.factors.map(factor=><option value={factor.id} key={factor.id}>
              {factor.friendlyName}{factor.id===confirmRemove?' (being removed)':''}
            </option>)}
          </select>
        </label>
        <label>
          Six-digit code
          <input
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={removeCode}
            onChange={event=>setRemoveCode(event.target.value.replace(/\D/g,'').slice(0,6))}
            disabled={Boolean(busy)}
          />
        </label>
      </div>
      <div className="mfa-remove-actions">
        <button type="button" onClick={cancelFactorRemoval} disabled={Boolean(busy)}>Keep authenticator</button>
        <button type="submit" className="confirm-danger" disabled={Boolean(busy)}>
          <ShieldCheck aria-hidden="true"/>{busy==='remove'?'Verifying and removing…':'Verify and remove'}
        </button>
      </div>
      <small>Protected operator accounts must retain two independent authenticators.</small>
    </form>:null}
  </section>;
}
