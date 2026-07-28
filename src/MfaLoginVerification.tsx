import { useState } from 'react';
import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import {
  verifyMfaLogin,
  type MfaLoginChallenge,
  type StoredSession,
} from './services/supabaseRest';

export function MfaLoginVerification({
  challenge,
  onVerified,
  onCancel,
}:{
  challenge:MfaLoginChallenge;
  onVerified:(session:StoredSession)=>Promise<void>|void;
  onCancel:()=>void;
}){
  const [factorId,setFactorId]=useState(challenge.factors[0]?.id||'');
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();
    setBusy(true);
    setError('');
    try{
      await onVerified(await verifyMfaLogin(challenge,factorId,code));
    }catch(actionError){
      setError(actionError instanceof Error?actionError.message:'The authenticator code was not accepted.');
    }finally{
      setBusy(false);
    }
  };

  return <section className="form-wrap auth-wrap mfa-login">
    <button className="back" type="button" onClick={onCancel}><ArrowLeft/>Use a different account</button>
    <span className="mfa-login-icon"><KeyRound aria-hidden="true"/></span>
    <p className="eyebrow">SECURE SIGN-IN · STEP 2 OF 2</p>
    <h1>Confirm it’s you.</h1>
    <p className="auth-market-note">Enter the rotating code from your authenticator app. No Dealivra employee will ask you to share it.</p>
    <form onSubmit={submit}>
      {challenge.factors.length>1?<fieldset className="mfa-factor-choice">
        <legend>Authenticator</legend>
        {challenge.factors.map(factor=><label key={factor.id}>
          <input type="radio" name="mfa-factor" value={factor.id} checked={factorId===factor.id} onChange={()=>setFactorId(factor.id)}/>
          <span><KeyRound/>{factor.friendlyName}</span>
        </label>)}
      </fieldset>:<div className="mfa-selected-factor"><KeyRound/><span><strong>{challenge.factors[0]?.friendlyName}</strong><small>Authenticator app</small></span></div>}
      <label>Six-digit code
        <input
          autoFocus
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
      {error?<div className="notice mfa-login-error" role="alert">{error}</div>:null}
      <button className="primary full" disabled={busy||code.length!==6}>
        <ShieldCheck/>{busy?'Verifying…':'Verify and continue'}
      </button>
    </form>
    <p className="mfa-login-trust"><LockKeyhole/>Your password was accepted. The app remains locked until this second step succeeds.</p>
  </section>;
}
