import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
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
  type MfaEnrollment,
  type MfaStatus,
  type StoredSession,
} from './services/supabaseRest';

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
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [confirmRemove,setConfirmRemove]=useState<string|null>(null);

  const loadStatus=async(activeSession=session)=>{
    setLoading(true);
    setError('');
    try{
      setStatus(await getMfaStatus(activeSession));
    }catch(loadError){
      setError(loadError instanceof Error?loadError.message:'Could not load authenticator security.');
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    let active=true;
    setLoading(true);
    getMfaStatus(session)
      .then(result=>{if(active)setStatus(result)})
      .catch(loadError=>{if(active)setError(loadError instanceof Error?loadError.message:'Could not load authenticator security.')})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[session.user.id,session.accessToken]);

  const qrCodeUrl=useMemo(()=>enrollment
    ?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qrCodeSvg)}`
    :'',[enrollment]);

  const beginEnrollment=async()=>{
    setBusy('enroll');
    setMessage('');
    setError('');
    try{
      setEnrollment(await startMfaEnrollment(session,friendlyName));
      setCode('');
    }catch(actionError){
      setError(actionError instanceof Error?actionError.message:'Authenticator setup could not start.');
    }finally{
      setBusy('');
    }
  };

  const verifyEnrollment=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!enrollment)return;
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
      setBusy('');
    }
  };

  const cancelEnrollment=async()=>{
    if(!enrollment){setEnrollment(null);return}
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
      setBusy('');
    }
  };

  const removeFactor=async(factorId:string)=>{
    setBusy('remove');
    setMessage('');
    setError('');
    try{
      const updated=await unenrollMfaFactor(session,factorId);
      onSessionUpdated(updated);
      setConfirmRemove(null);
      setMessage('Authenticator method removed. Review the remaining protection before signing out.');
      await loadStatus(updated);
    }catch(actionError){
      setError(actionError instanceof Error?actionError.message:'Authenticator method could not be removed.');
    }finally{
      setBusy('');
    }
  };

  const copySecret=async()=>{
    if(!enrollment)return;
    try{
      await navigator.clipboard.writeText(enrollment.secret);
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

    {loading?<div className="mfa-loading" role="status"><RefreshCw className="is-spinning" aria-hidden="true"/>Checking authenticator protection…</div>:null}

    {!loading&&status?.unsupportedVerifiedFactor?<div className="mfa-feedback error" role="alert">
      This account has a verified sign-in method that Dealivra cannot manage here. Contact support without sharing any verification code or setup key.
    </div>:null}

    {!loading&&status?.factors.length?<ul className="mfa-factor-list">
      {status.factors.map(factor=><li key={factor.id}>
        <span className="mfa-factor-icon"><KeyRound aria-hidden="true"/></span>
        <span><strong>{factor.friendlyName}</strong><small>Authenticator app · Added {formatFactorDate(factor.createdAt)}</small></span>
        <b>{status.assuranceLevel==='aal2'?'Verified this session':'Verification required'}</b>
        <button
          type="button"
          onClick={()=>setConfirmRemove(factor.id)}
          disabled={Boolean(busy)||factorFloorReached}
          aria-label={`Remove ${factor.friendlyName}`}
          title={factorFloorReached?'Add and verify another authenticator before removing this one.':undefined}
        >
          <Trash2 aria-hidden="true"/>
        </button>
      </li>)}
    </ul>:null}

    {!loading&&factorFloorReached?<div className="mfa-feedback protected" role="status">
      This privileged account must keep at least {status?.minimumVerifiedFactors} verified authenticators. Add a replacement before removing one.
    </div>:null}

    {!loading&&!enrollment&&!status?.unsupportedVerifiedFactor?<div className="mfa-enroll-start">
      <div>
        <strong>{protectedByMfa?'Add a backup authenticator':'Protect this account'}</strong>
        <span>{protectedByMfa?'A second enrolled device reduces account-recovery risk.':'Use any standards-based TOTP authenticator app.'}</span>
      </div>
      <label>
        <span>Device name</span>
        <input value={friendlyName} minLength={2} maxLength={48} onChange={event=>setFriendlyName(event.target.value)} autoComplete="off"/>
      </label>
      <button type="button" className="mfa-primary" onClick={beginEnrollment} disabled={Boolean(busy)||friendlyName.trim().length<2}>
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
            <div className="mfa-secret"><code>{enrollment.secret}</code><button type="button" onClick={copySecret}><Copy/>Copy</button></div>
          </details>
          <form onSubmit={verifyEnrollment}>
            <label>Six-digit code
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))}
              />
            </label>
            <button className="mfa-primary" disabled={Boolean(busy)||code.length!==6}>
              <ShieldCheck aria-hidden="true"/>{busy==='verify'?'Verifying…':'Enable protection'}
            </button>
          </form>
        </div>
      </div>
    </div>:null}

    {message?<div className="mfa-feedback success" role="status">{message}</div>:null}
    {error?<div className="mfa-feedback error" role="alert">{error}</div>:null}

    <p className="mfa-recovery-note"><ShieldCheck aria-hidden="true"/>Losing every enrolled authenticator requires a controlled account-recovery review. Dealivra support will never ask for your current code or setup key.</p>

    {confirmRemove?<div className="mfa-remove-confirmation" role="alert" aria-labelledby="mfa-remove-title">
      <div><strong id="mfa-remove-title">Remove this authenticator?</strong><span>You will need a freshly verified session. Protected operator accounts must retain two independent authenticators.</span></div>
      <div>
        <button type="button" onClick={()=>setConfirmRemove(null)} disabled={Boolean(busy)}>Keep it</button>
        <button type="button" className="confirm-danger" onClick={()=>removeFactor(confirmRemove)} disabled={Boolean(busy)}>{busy==='remove'?'Removing…':'Remove authenticator'}</button>
      </div>
    </div>:null}
  </section>;
}
