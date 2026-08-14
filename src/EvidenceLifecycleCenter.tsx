import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  Check,
  Clock3,
  FileClock,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  acknowledgeEvidenceLifecycleAlert,
  approveEvidenceDeletion,
  getEvidenceLifecycleSnapshot,
  placeEvidenceLegalHold,
  refreshEvidenceLifecycleInventory,
  releaseEvidenceLegalHold,
  type EvidenceLifecycleJob,
  type EvidenceLifecycleSnapshot,
  type StoredSession,
} from './services/supabaseRest';
import './evidence-lifecycle.css';

function displayTime(value:string|null){
  if(!value)return 'Not scheduled';
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?value:new Intl.DateTimeFormat('en-US',{
    dateStyle:'medium',
    timeStyle:'short',
  }).format(parsed);
}

function jobLabel(job:EvidenceLifecycleJob){
  if(job.jobType==='integrity_check')return 'Integrity verification';
  if(job.jobType==='quarantine_cleanup')return 'Quarantine cleanup';
  return 'Retention deletion review';
}

function statusLabel(status:EvidenceLifecycleJob['status']){
  return status.replaceAll('_',' ').replace(/^\w/,letter=>letter.toUpperCase());
}

export function EvidenceLifecycleCenter({session}:{session:StoredSession}){
  const [snapshot,setSnapshot]=useState<EvidenceLifecycleSnapshot|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const busyRef=useRef(false);
  const loadSequenceRef=useRef(0);
  const [message,setMessage]=useState('');
  const [reasons,setReasons]=useState<Record<string,string>>({});

  const load=async()=>{
    const request=++loadSequenceRef.current;
    setLoading(true);
    setMessage('');
    try{
      const next=await getEvidenceLifecycleSnapshot(session);
      if(request===loadSequenceRef.current)setSnapshot(next);
    }
    catch(error){if(request===loadSequenceRef.current)setMessage(error instanceof Error?error.message:'Could not load evidence lifecycle controls.')}
    finally{if(request===loadSequenceRef.current)setLoading(false)}
  };

  useEffect(()=>{
    void load();
    return()=>{loadSequenceRef.current+=1};
  },[session.accessToken]);

  const orderedJobs=useMemo(()=>snapshot?.jobs||[],[snapshot]);

  const refresh=async()=>{
    if(busyRef.current)return;
    busyRef.current=true;
    setBusy('refresh');
    setMessage('');
    try{
      await refreshEvidenceLifecycleInventory(session);
      await load();
      setMessage('Lifecycle inventory refreshed. No retained evidence was deleted by this review.')
    }catch(error){setMessage(error instanceof Error?error.message:'Inventory refresh failed.')}
    finally{busyRef.current=false;setBusy('')}
  };

  const runAction=async(key:string,action:()=>Promise<unknown>,success:string)=>{
    if(busyRef.current)return;
    busyRef.current=true;
    setBusy(key);
    setMessage('');
    try{
      await action();
      await load();
      setMessage(success);
    }catch(error){setMessage(error instanceof Error?error.message:'Lifecycle action failed safely.')}
    finally{busyRef.current=false;setBusy('')}
  };

  const reasonFor=(job:EvidenceLifecycleJob)=>reasons[job.jobId]?.trim()||'';
  const changeReason=(jobId:string,value:string)=>setReasons(current=>({...current,[jobId]:value.slice(0,1000)}));

  return <section className="evidence-lifecycle-center" aria-labelledby="evidence-lifecycle-title" aria-busy={Boolean(busy)}>
    <div className="evidence-lifecycle-heading">
      <div className="evidence-lifecycle-title">
        <ShieldCheck/>
        <div>
          <p className="eyebrow">RESTRICTED OPERATIONS</p>
          <h2 id="evidence-lifecycle-title">Evidence lifecycle center</h2>
          <span>Retention review, legal holds, verified deletion, quarantine cleanup, and integrity ownership.</span>
        </div>
      </div>
      <button type="button" className="secondary" onClick={refresh} disabled={Boolean(busy)||loading}>
        <RefreshCw className={busy==='refresh'?'is-spinning':''}/>
        {busy==='refresh'?'Refreshing…':'Refresh inventory'}
      </button>
    </div>

    {message&&<div className="notice" role="status">{message}</div>}

    <div className="evidence-lifecycle-metrics" aria-label="Evidence lifecycle summary">
      <article><ShieldAlert/><span>Open alerts</span><strong>{snapshot?.counts.openAlerts??'—'}</strong></article>
      <article><FileClock/><span>Integrity queue</span><strong>{snapshot?.counts.integrityQueued??'—'}</strong></article>
      <article><ArchiveRestore/><span>Quarantine queue</span><strong>{snapshot?.counts.quarantineQueued??'—'}</strong></article>
      <article><Trash2/><span>Deletion reviews</span><strong>{snapshot?.counts.deletionReviews??'—'}</strong></article>
      <article><LockKeyhole/><span>Active legal holds</span><strong>{snapshot?.counts.activeLegalHolds??'—'}</strong></article>
    </div>

    <div className="evidence-lifecycle-principle">
      <LockKeyhole/>
      <div>
        <b>Deletion is review-gated and verified.</b>
        <span>Expiry only opens a review. Storage removal requires operator approval, a fresh dispute/hold check, and proof that the object is gone before metadata is redacted.</span>
      </div>
    </div>

    <section className="evidence-lifecycle-alerts" aria-labelledby="evidence-alerts-title">
      <div className="evidence-lifecycle-section-title">
        <div><AlertTriangle/><h3 id="evidence-alerts-title">Operator alerts</h3></div>
        <span>{snapshot?.alerts.length||0} active</span>
      </div>
      {loading?<div className="admin-empty">Loading lifecycle alerts…</div>:snapshot?.alerts.length?snapshot.alerts.map(alert=>
        <article className={`evidence-lifecycle-alert is-${alert.severity}`} key={alert.alertId}>
          <div>
            <b>{alert.summary}</b>
            <span>{alert.ownerRole} owner · {displayTime(alert.createdAt)}</span>
          </div>
          {alert.status==='open'&&<button type="button" className="secondary" disabled={Boolean(busy)} onClick={()=>void runAction(
            `alert:${alert.alertId}`,
            ()=>acknowledgeEvidenceLifecycleAlert(session,alert.alertId),
            'Alert acknowledged and preserved in the audit history.',
          )}>{busy===`alert:${alert.alertId}`?'Saving…':'Acknowledge'}</button>}
        </article>
      ):<div className="admin-empty"><Check/><b>No lifecycle alerts need attention.</b></div>}
    </section>

    <section className="evidence-lifecycle-jobs" aria-labelledby="evidence-jobs-title">
      <div className="evidence-lifecycle-section-title">
        <div><Clock3/><h3 id="evidence-jobs-title">Controlled work queue</h3></div>
        <span>{orderedJobs.length} active</span>
      </div>
      {loading?<div className="admin-empty">Loading controlled work queue…</div>:orderedJobs.length?orderedJobs.map(job=>
        <article className="evidence-lifecycle-job" key={job.jobId}>
          <div className="evidence-lifecycle-job-top">
            <div>
              <p className="eyebrow">{jobLabel(job)}</p>
              <h4>{job.title||'Private evidence maintenance'}</h4>
              <span>{job.publicId?`Deal ${job.publicId} · `:''}{displayTime(job.retentionUntil||job.createdAt)}</span>
            </div>
            <span className={`status ${job.status}`}>{statusLabel(job.status)}</span>
          </div>
          <dl>
            <div><dt>Reason</dt><dd>{job.reasonCode.replaceAll('_',' ')}</dd></div>
            <div><dt>Attempts</dt><dd>{job.attempts}</dd></div>
            <div><dt>Legal hold</dt><dd>{job.activeHold?'Active':'None'}</dd></div>
            <div><dt>Last update</dt><dd>{displayTime(job.updatedAt)}</dd></div>
          </dl>
          {job.lastErrorCode&&<div className="evidence-lifecycle-job-error"><ShieldAlert/>Safe stop: {job.lastErrorCode.replaceAll('_',' ')}</div>}
          {job.evidenceId&&<div className="evidence-lifecycle-controls">
            <label>
              Operator reason
              <textarea minLength={10} maxLength={1000} value={reasons[job.jobId]||''} onChange={event=>changeReason(job.jobId,event.target.value)} placeholder="Record the case, policy basis, and review performed."/>
              <small>{(reasons[job.jobId]||'').length}/1000</small>
            </label>
            <div>
              {job.jobType==='evidence_delete'&&job.status==='pending_review'&&!job.activeHold&&<button type="button" className="danger" disabled={Boolean(busy)||reasonFor(job).length<10} onClick={()=>void runAction(
                `approve:${job.jobId}`,
                ()=>approveEvidenceDeletion(session,job.evidenceId!,reasonFor(job)),
                'Deletion approved. The scheduled worker will verify every guard again before acting.',
              )}><Trash2/>{busy===`approve:${job.jobId}`?'Approving…':'Approve verified deletion'}</button>}
              {!job.activeHold?<button type="button" className="secondary" disabled={Boolean(busy)||reasonFor(job).length<10} onClick={()=>void runAction(
                `hold:${job.jobId}`,
                ()=>placeEvidenceLegalHold(session,job.evidenceId!,reasonFor(job)),
                'Legal hold placed. Deletion is blocked and the action is audited.',
              )}><LockKeyhole/>{busy===`hold:${job.jobId}`?'Placing hold…':'Place legal hold'}</button>:job.holdKey&&<button type="button" className="secondary" disabled={Boolean(busy)||reasonFor(job).length<10} onClick={()=>void runAction(
                `release:${job.jobId}`,
                ()=>releaseEvidenceLegalHold(session,job.evidenceId!,job.holdKey!,reasonFor(job)),
                'Legal hold released. Any elapsed retention deletion returned to fresh review.',
              )}><ArchiveRestore/>{busy===`release:${job.jobId}`?'Releasing…':'Release legal hold'}</button>}
            </div>
          </div>}
        </article>
      ):<div className="admin-empty"><Check/><b>No evidence lifecycle jobs need operator action.</b></div>}
    </section>
  </section>;
}
