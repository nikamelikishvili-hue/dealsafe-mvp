import { useEffect, useState } from 'react';
import {
  Clock3,
  Laptop,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
} from 'lucide-react';
import {
  getMyAccountSessions,
  signOutEverywhere,
  signOutOtherSessions,
  type AccountSession,
  type StoredSession,
} from './services/supabaseRest';

function describeDevice(userAgent:string){
  const ua=userAgent.toLowerCase();
  const device=/(ipad|tablet)/.test(ua)?'Tablet':/(iphone|android.*mobile)/.test(ua)?'Phone':'Computer';
  const browser=ua.includes('edg/')?'Microsoft Edge':ua.includes('firefox/')?'Firefox':ua.includes('chrome/')||ua.includes('crios/')?'Chrome':ua.includes('safari/')?'Safari':'Web browser';
  const platform=ua.includes('windows')?'Windows':ua.includes('iphone')||ua.includes('ipad')?'iOS':ua.includes('android')?'Android':ua.includes('mac os')||ua.includes('macintosh')?'macOS':ua.includes('linux')?'Linux':'device';
  return {device,label:`${browser} on ${platform}`};
}

function DeviceIcon({device}:{device:string}){
  if(device==='Phone')return <Smartphone aria-hidden="true"/>;
  if(device==='Tablet')return <Tablet aria-hidden="true"/>;
  return <Laptop aria-hidden="true"/>;
}

function formatSessionDate(value:string){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return 'Activity time unavailable';
  return new Intl.DateTimeFormat('en-US',{
    month:'short',
    day:'numeric',
    year:date.getFullYear()===new Date().getFullYear()?undefined:'numeric',
    hour:'numeric',
    minute:'2-digit',
  }).format(date);
}

export function AccountSessionSecurity({
  session,
  onSignedOut,
}:{
  session:StoredSession;
  onSignedOut:()=>void;
}){
  const [sessions,setSessions]=useState<AccountSession[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<'others'|'global'|''>('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [confirmEverywhere,setConfirmEverywhere]=useState(false);

  const loadSessions=async()=>{
    setLoading(true);
    setError('');
    try{
      setSessions(await getMyAccountSessions(session));
    }catch(loadError){
      setError(loadError instanceof Error?loadError.message:'Could not load signed-in devices.');
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    let active=true;
    setLoading(true);
    setError('');
    getMyAccountSessions(session)
      .then(items=>{if(active)setSessions(items)})
      .catch(loadError=>{if(active)setError(loadError instanceof Error?loadError.message:'Could not load signed-in devices.')})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[session.user.id,session.accessToken]);

  const signOutOthers=async()=>{
    setBusy('others');
    setMessage('');
    setError('');
    try{
      await signOutOtherSessions(session);
      setMessage('Other devices have been signed out.');
      await loadSessions();
    }catch(actionError){
      setError(actionError instanceof Error?actionError.message:'Could not sign out other devices.');
    }finally{
      setBusy('');
    }
  };

  const signOutAll=async()=>{
    setBusy('global');
    setMessage('');
    setError('');
    try{
      await signOutEverywhere(session);
      onSignedOut();
    }catch(actionError){
      setError(actionError instanceof Error?actionError.message:'Could not sign out all devices.');
      setBusy('');
      setConfirmEverywhere(false);
    }
  };

  const otherSessionCount=sessions.filter(item=>!item.current_session).length;

  return <section className="account-session-security" aria-labelledby="signed-in-devices-title">
    <header className="session-security-heading">
      <span className="session-security-icon"><ShieldCheck aria-hidden="true"/></span>
      <div>
        <p className="eyebrow">SESSION SECURITY</p>
        <h2 id="signed-in-devices-title">Signed-in devices</h2>
        <p>Review your account sessions without exposing location or IP information.</p>
      </div>
      <button className="session-refresh" type="button" onClick={loadSessions} disabled={loading||Boolean(busy)} aria-label="Refresh signed-in devices">
        <RefreshCw aria-hidden="true"/>
        <span>Refresh</span>
      </button>
    </header>

    {loading?<div className="session-loading" role="status"><RefreshCw className="is-spinning" aria-hidden="true"/>Checking signed-in devices…</div>:
      sessions.length>0?<ul className="session-device-list">
        {sessions.map(item=>{
          const description=describeDevice(item.user_agent);
          return <li key={item.session_id} className={item.current_session?'is-current':''}>
            <span className="session-device-icon"><DeviceIcon device={description.device}/></span>
            <div>
              <strong>{item.current_session?'This device':description.label}</strong>
              <span>{item.current_session?description.label:description.device}</span>
            </div>
            <span className="session-last-active"><Clock3 aria-hidden="true"/>{item.current_session?'Active now':`Last active ${formatSessionDate(item.last_active_at)}`}</span>
            {item.current_session?<b className="session-current-badge">Current</b>:null}
          </li>;
        })}
      </ul>:<div className="session-empty">No active sessions were returned for this account.</div>}

    {message?<div className="session-feedback success" role="status">{message}</div>:null}
    {error?<div className="session-feedback error" role="alert">{error}</div>:null}

    <div className="session-security-actions">
      <button type="button" className="session-signout-others" onClick={signOutOthers} disabled={loading||Boolean(busy)||otherSessionCount===0}>
        <LogOut aria-hidden="true"/>
        <span><strong>{busy==='others'?'Signing out…':'Sign out other devices'}</strong><small>Keep this device signed in</small></span>
      </button>
      <button type="button" className="session-signout-all" onClick={()=>setConfirmEverywhere(true)} disabled={Boolean(busy)}>
        <LogOut aria-hidden="true"/>
        <span><strong>Sign out everywhere</strong><small>Includes this device</small></span>
      </button>
    </div>

    {confirmEverywhere?<div className="session-confirmation" role="alert" aria-labelledby="session-confirmation-title">
      <div>
        <strong id="session-confirmation-title">Sign out on every device?</strong>
        <span>You will need to sign in again everywhere, including on this device.</span>
      </div>
      <div>
        <button type="button" onClick={()=>setConfirmEverywhere(false)} disabled={Boolean(busy)}>Cancel</button>
        <button type="button" className="confirm-danger" onClick={signOutAll} disabled={Boolean(busy)}>{busy==='global'?'Signing out…':'Yes, sign out everywhere'}</button>
      </div>
    </div>:null}
  </section>;
}
