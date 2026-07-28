import type { Deal, DealDraft } from '../domain';
import { toMinorUnits, type CurrencyCode } from '../currency';
import { isVideoUpload, prepareMediaUpload } from '../mediaPrivacy';
import {
  validateEvidenceBytes,
  validateEvidenceDeclaration,
  type EvidenceUploadType,
} from '../../supabase/functions/_shared/evidence-policy';

// Vercel can preserve pasted line breaks in environment variables. Keep only
// the first non-empty line so an accidental multi-line key never becomes an
// invalid HTTP header value in the browser.
function readPublicEnv(name: string) {
  const raw = import.meta.env[name] as string | undefined;
  return raw?.split(/\r?\n/).map(value => value.trim()).find(Boolean);
}

function normalizePublicServiceUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value.replace(/\/+$/, ''));
    const isLocalDevelopment = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(isLocalDevelopment && parsed.protocol === 'http:')) {
      return undefined;
    }
    if (
      parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
      || (parsed.pathname !== '' && parsed.pathname !== '/')
    ) {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

const supabaseUrl = normalizePublicServiceUrl(readPublicEnv('VITE_SUPABASE_URL'));
const publishableKey = readPublicEnv('VITE_SUPABASE_PUBLISHABLE_KEY');
const browserKeyIsSafe = Boolean(publishableKey && !/^sb_secret_/i.test(publishableKey));

export const isSupabaseConfigured = Boolean(supabaseUrl && browserKeyIsSafe);
const configurationUnavailableMessage = 'Account service is temporarily unavailable. Please try again later.';

function requireSupabaseConfiguration() {
  if (!isSupabaseConfigured) throw new Error(configurationUnavailableMessage);
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  emailConfirmed: boolean;
}

export interface StoredSession {
  accessToken:string;
  expiresAt:number;
  createdAt:number;
  lastActivityAt:number;
  user:AuthUser;
}
export interface MfaFactor {
  id:string;
  factorType:'totp';
  friendlyName:string;
  createdAt:string|null;
  updatedAt:string|null;
}
export interface MfaLoginChallenge {
  mfaRequired:true;
  pendingAccessToken:string;
  expiresAt:number;
  factors:MfaFactor[];
}
export interface MfaStatus {
  assuranceLevel:'aal1'|'aal2';
  factors:MfaFactor[];
  unsupportedVerifiedFactor:boolean;
}
export interface MfaEnrollment {
  factorId:string;
  friendlyName:string;
  qrCodeSvg:string;
  secret:string;
  uri:string|null;
}
export interface ProfileSummary { display_name:string; verification_status:'not_started'|'pending'|'verified'|'failed'; member_since:string; completed_deals:number; rating_count:number; average_rating:number|null; recent_ratings:{stars:number;comment:string|null;created_at:string}[] }
export interface TimelineEvent { id:string; event_type:string; created_at:string; is_mine:boolean }
export interface DealNotification extends TimelineEvent { deal_id:string; public_id:string; title:string; is_read:boolean }
export interface DealMessage { id:number; sender_id:string; sender_name:string; body:string; created_at:string; is_mine:boolean }
export interface DealOffer { id:string;amount_cents:number;status:'pending'|'accepted'|'declined'|'withdrawn';buyer_name:string;created_at:string;is_mine:boolean }
export interface DealInquiry { id:string;buyer_name:string;body:string;seller_reply:string|null;created_at:string;replied_at:string|null;is_mine:boolean }
export interface DealShipment { id:string;deal_id:string;carrier:string;tracking_number:string;status:'shipped'|'delivered';shipped_at:string;delivered_at:string|null }
export interface SellerShippingEvidenceReadiness {
  item_photo_ready:boolean;
  packing_video_ready:boolean;
  package_weight_ready:boolean;
  serial_required:boolean;
  serial_photo_ready:boolean;
  distinct_files_ready:boolean;
  ready:boolean;
}
export interface DealDeliveryDetails { recipient_name:string;full_address:string;country:string;instructions:string|null;updated_at:string;locked:boolean }
export type DealPaymentMethod='cash_at_handoff'|'bank_transfer'|'payment_app'|'card_invoice'|'other';
export interface DealPaymentRecord { method:DealPaymentMethod;buyer_confirmed_at:string|null;buyer_marked_sent_at:string|null;seller_marked_received_at:string|null;updated_at:string;viewer_role:'seller'|'buyer' }
export type ProtectedPaymentState='not_started'|'checkout_created'|'processing'|'funds_secured'|'release_pending'|'released'|'failed'|'expired'|'cancelled'|'refund_pending'|'refunded'|'disputed'|'release_failed';
export interface ProtectedPaymentStatus { status:ProtectedPaymentState;item_amount_cents:number;platform_fee_cents:number;seller_amount_cents:number;currency:CurrencyCode;checkout_expires_at:string|null;paid_at:string|null;released_at:string|null;refunded_at:string|null;disputed_at:string|null;failure_message:string|null;seller_connected:boolean;seller_payouts_ready:boolean;viewer_role:'seller'|'buyer' }
export interface StripeConnectStatus { connected:boolean;detailsSubmitted:boolean;payoutsEnabled:boolean;transfersActive:boolean;ready:boolean }
export interface AdminReport { report_id:string;deal_id:string;public_id:string;title:string;reason:string;report_status:'open'|'reviewed'|'dismissed';moderation_status:'visible'|'hidden';created_at:string;reporter_name:string;seller_name:string;resolution_note:string|null }
export interface AdminRevenueSummary { currency:CurrencyCode; total_payment_volume_cents:number; total_commission_earned_cents:number; total_released_to_sellers_cents:number; total_protected_cents:number; total_refunded_cents:number; payment_count:number; released_count:number; refunded_count:number; disputed_count:number }
export interface AdminRevenueTransaction { transaction_id:string; deal_id:string; public_id:string; title:string; status:ProtectedPaymentState; currency:CurrencyCode; item_amount_cents:number; platform_fee_cents:number; seller_amount_cents:number; seller_name:string; buyer_name:string; created_at:string; updated_at:string }
export interface AdminCatalogAdoption {
  window_days:number;
  catalog_version:string;
  category_id:string;
  deal_count:number;
  structured_brand_count:number;
  structured_model_count:number;
  manual_fallback_count:number;
  draft_count:number;
  published_count:number;
  accepted_count:number;
  completed_count:number;
  latest_deal_at:string;
}
export interface AccountSession {
  session_id:string;
  created_at:string;
  last_active_at:string;
  expires_at:string|null;
  user_agent:string;
  current_session:boolean;
}
export interface RiskAssessment { risk_score:number;risk_level:'low'|'medium'|'high';signals:string[] }
export interface PublicTrustProfile { display_name:string;verification_status:'not_started'|'pending'|'verified'|'failed';member_since:string;completed_sales:number;rating_count:number;average_rating:number|null }
export interface TrustPassportSettings { public_id:string;enabled:boolean }
export interface TrustPassport { display_name:string;verification_status:'not_started'|'pending'|'verified'|'failed';member_since:string;completed_deals:number;completed_sales:number;completed_purchases:number;rating_count:number;average_rating:number|null;recent_ratings:{stars:number;created_at:string}[] }
export interface DealInspection { agreement_version:number;item_reviewed:boolean;price_confirmed:boolean;handoff_confirmed:boolean;reference_checked:boolean;inspected_at:string;buyer_name:string }
export type EvidenceType=EvidenceUploadType;
export type EvidenceIntegrityStatus='unverified'|'verified'|'missing'|'mismatch'|'invalid'|'deleted';
export type EvidenceLifecycleStatus='retained'|'deletion_review'|'deletion_approved'|'deletion_processing'|'deleted';
export interface DealEvidence { id:string;deal_id:string;dispute_id:string|null;uploader_role:'seller'|'buyer'|'admin';evidence_type:EvidenceType|string;file_name:string|null;mime_type:string|null;detected_mime_type:string|null;file_size_bytes:number|null;sha256:string|null;scan_status:'clean'|'legacy_unscanned'|'deleted';scanned_at:string|null;integrity_status:EvidenceIntegrityStatus;integrity_checked_at:string|null;retention_class:'routine_evidence'|'dispute_evidence';retention_until:string|null;lifecycle_status:EvidenceLifecycleStatus;deleted_at:string|null;created_at:string }
export interface DealEvidenceViewer { objectUrl:string;expiresAt:string;mimeType:'image/webp'|'video/mp4'|'video/webm'|'video/quicktime';fileName:string;fileSizeBytes:number;sha256:string;scanStatus:'clean';scannedAt:string;integrityStatus:'verified';integrityCheckedAt:string }
export interface EvidenceLifecycleJob {
  jobId:string;
  jobType:'integrity_check'|'quarantine_cleanup'|'evidence_delete';
  status:'pending'|'pending_review'|'approved'|'processing'|'blocked'|'failed';
  evidenceId:string|null;
  publicId:string|null;
  title:string|null;
  retentionClass:'routine_evidence'|'dispute_evidence'|null;
  retentionUntil:string|null;
  lifecycleStatus:EvidenceLifecycleStatus|null;
  reasonCode:string;
  attempts:number;
  lastErrorCode:string|null;
  createdAt:string;
  updatedAt:string;
  activeHold:boolean;
  holdKey:string|null;
}
export interface EvidenceLifecycleAlert {
  alertId:string;
  alertType:'deletion_review_required'|'integrity_failure'|'maintenance_failure'|'legal_hold_block';
  severity:'info'|'warning'|'critical';
  ownerRole:'admin'|'compliance';
  status:'open'|'acknowledged';
  summary:string;
  evidenceId:string|null;
  jobId:string|null;
  createdAt:string;
}
export interface EvidenceLifecycleSnapshot {
  generatedAt:string;
  counts:{
    openAlerts:number;
    integrityQueued:number;
    quarantineQueued:number;
    deletionReviews:number;
    activeLegalHolds:number;
  };
  jobs:EvidenceLifecycleJob[];
  alerts:EvidenceLifecycleAlert[];
}
export interface AdminDispute { dispute_id:string;deal_id:string;public_id:string;title:string;reason:string;dispute_status:'open'|'evidence_requested'|'under_review'|'resolved_buyer'|'resolved_seller'|'refunded'|'cancelled';response_deadline:string;opened_at:string;opened_by_name:string;seller_name:string;buyer_name:string;payment_status:string;item_amount_cents:number;currency:CurrencyCode;resolution_note:string|null }
export interface SellerDeclarationRecord { attested:boolean;attested_at:string|null }
export interface AgreementHistoryVersion { version:number;price_cents:number;currency:CurrencyCode;condition:'Like new'|'Good'|'Fair';delivery_method:'Meet in person'|'Ship to buyer';content_hash:string;created_at:string;acceptance_count:number;is_current:boolean }
export interface AgreementVerificationResult { matched:boolean;public_id:string;version:number;is_current:boolean;created_at:string }
export interface DealRenewalResult { agreement_version:number;expires_at:string }
export interface DealParticipants { seller_name:string;seller_verification:'not_started'|'pending'|'verified'|'failed';buyer_name:string;buyer_verification:'not_started'|'pending'|'verified'|'failed';accepted_at:string|null;viewer_role:'seller'|'buyer' }
export interface DealActionPlan { viewer_role:'seller'|'buyer';deal_status:'accepted'|'completed'|'disputed'|'cancelled';meeting_status:'proposed'|'confirmed'|'cancelled'|null;seller_arrived:boolean;buyer_arrived:boolean;handoff_code_ready:boolean;shipment_status:'shipped'|'delivered'|null;inspection_recorded:boolean;rating_submitted:boolean;delivery_address_ready:boolean;payment_method_recorded:boolean;payment_method_confirmed:boolean;payment_marked_sent:boolean;payment_received:boolean }

interface DealRow {
  id: string; public_id: string; title: string; description: string;
  price_cents: number; currency: CurrencyCode; condition: 'Like new' | 'Good' | 'Fair';
  serial_last_four: string | null; delivery_method: 'Meet in person' | 'Ship to buyer';
  category_id?: NonNullable<Deal['catalog']>['categoryId'];
  catalog_version?: string;
  catalog_brand_id?: string | null; catalog_brand_label?: string | null;
  catalog_model_id?: string | null; catalog_model_label?: string | null;
  model_year?: number | null;
  catalog_variant_id?: string | null; catalog_variant_label?: string | null;
  status: 'draft' | 'published' | 'accepted' | 'completed' | 'cancelled' | 'disputed';
  current_agreement_version: number; created_at: string;
  expires_at: string | null;
  deal_media?: { storage_path: string; sort_order: number }[];
  seller_id?: string; buyer_id?: string | null;
}

interface AuthResponse {
  access_token?: string;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
    email_confirmed_at?: string | null;
    user_metadata?: { display_name?: string };
  };
  msg?: string;
  error_description?: string;
}

export const sessionStorageKey = 'dealivra_session_v2';
export const legacySessionStorageKey = 'dealsafe_session';
export const sessionUpdatedEvent = 'dealivra-session-updated';
export const sessionExpiredEvent = 'dealivra-session-expired';
export const mfaRequiredEvent = 'dealivra-mfa-required';
export const sessionIdleTimeoutMs = 30 * 60 * 1000;
export const sessionAbsoluteTimeoutMs = 8 * 60 * 60 * 1000;
const activityWriteIntervalMs = 60 * 1000;
let refreshPromise: Promise<StoredSession> | null = null;

function decodeJwtPayload(token:string){
  try{
    const encoded=token.split('.')[1];
    if(!encoded)return null;
    const normalized=encoded.replace(/-/g,'+').replace(/_/g,'/');
    const payload=JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'='))) as Record<string,unknown>;
    return payload&&typeof payload==='object'?payload:null;
  }catch{return null}
}

function decodeJwtExpiry(token:string){
  const payload=decodeJwtPayload(token);
  return typeof payload?.exp==='number'?payload.exp*1000:null;
}

function clearStoredSession(){
  sessionStorage.removeItem(sessionStorageKey);
  // Remove the legacy browser-readable refresh token if an older release left
  // it behind. Legacy sessions are not migrated into the new architecture.
  localStorage.removeItem(legacySessionStorageKey);
}

type SignOutScope='local'|'others'|'global';

async function revokeServerSession(accessToken?:string,scope:SignOutScope='local'){
  const response=await fetch('/api/auth/logout',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      ...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})
    },
    credentials:'same-origin',
    body:JSON.stringify({scope}),
    keepalive:true,
  });
  if(!response.ok){
    const data=await response.json().catch(()=>null) as {error?:string}|null;
    throw new Error(data?.error||'Could not update your signed-in devices.');
  }
}

function normalizeSession(value:unknown):StoredSession|null{
  if(!value||typeof value!=='object')return null;
  const candidate=value as Partial<StoredSession>;
  if(
    typeof candidate.accessToken!=='string'
    ||!candidate.user
    ||typeof candidate.user.id!=='string'
    ||typeof candidate.user.email!=='string'
  )return null;
  const now=Date.now();
  const createdAt=typeof candidate.createdAt==='number'?candidate.createdAt:now;
  const lastActivityAt=typeof candidate.lastActivityAt==='number'?candidate.lastActivityAt:now;
  const tokenExpiry=decodeJwtExpiry(candidate.accessToken);
  const expiresAt=tokenExpiry??(typeof candidate.expiresAt==='number'?candidate.expiresAt:now);
  return {
    accessToken:candidate.accessToken,
    expiresAt,
    createdAt,
    lastActivityAt,
    user:{
      id:candidate.user.id,
      email:candidate.user.email,
      displayName:candidate.user.displayName||candidate.user.email.split('@')[0],
      emailConfirmed:Boolean(candidate.user.emailConfirmed),
    },
  };
}

function readStoredSession(){
  try{
    const current=normalizeSession(JSON.parse(sessionStorage.getItem(sessionStorageKey)||'null'));
    localStorage.removeItem(legacySessionStorageKey);
    return current;
  }catch{
    clearStoredSession();
    return null;
  }
}

function storeSession(data:AuthResponse,user:AuthUser,previous?:StoredSession){
  const now=Date.now();
  const session:StoredSession={
    accessToken:data.access_token!,
    expiresAt:decodeJwtExpiry(data.access_token!)??now+(data.expires_in||3600)*1000,
    createdAt:previous?.createdAt||now,
    lastActivityAt:previous?.lastActivityAt||now,
    user,
  };
  sessionStorage.setItem(sessionStorageKey,JSON.stringify(session));
  localStorage.removeItem(legacySessionStorageKey);
  window.dispatchEvent(new CustomEvent<StoredSession>(sessionUpdatedEvent,{detail:session}));
  return session;
}

function headers(token?: string) {
  return {
    apikey: publishableKey ?? '',
    Authorization: `Bearer ${token ?? publishableKey ?? ''}`,
    'Content-Type': 'application/json',
  };
}

function toUser(data: AuthResponse): AuthUser | null {
  if (!data.user?.id || !data.user.email) return null;
  return {
    id: data.user.id,
    email: data.user.email,
    // Display metadata is presentation-only. Authorization is always decided
    // by database roles and RLS, never by user-editable metadata.
    displayName: data.user.user_metadata?.display_name || data.user.email.split('@')[0],
    emailConfirmed: Boolean(data.user.email_confirmed_at),
  };
}

export function getStoredSession(): StoredSession | null {
  const session=readStoredSession();
  if(!session)return null;
  const now=Date.now();
  if(
    now-session.lastActivityAt>sessionIdleTimeoutMs
    ||now-session.createdAt>sessionAbsoluteTimeoutMs
  ){
    clearStoredSession();
    void revokeServerSession(session.accessToken).catch(()=>{});
    return null;
  }
  return session;
}

export function markSessionActivity(){
  const session=getStoredSession();
  if(!session||Date.now()-session.lastActivityAt<activityWriteIntervalMs)return;
  const updated={...session,lastActivityAt:Date.now()};
  sessionStorage.setItem(sessionStorageKey,JSON.stringify(updated));
}

export async function signUp(email: string, password: string, displayName: string) {
  requireSupabaseConfiguration();
  validatePassword(password);
  const name=displayName.trim();
  if(name.length<2||name.length>80)throw new Error('Name must contain 2 to 80 characters.');
  const response = await fetch('/api/auth/signup', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    credentials:'same-origin',
    body: JSON.stringify({ email:email.trim().toLowerCase(), password, displayName:name }),
  });
  const result = await response.json() as {
    session?:AuthResponse|null;
    needsEmailConfirmation?:boolean;
    error?:string;
  };
  if (!response.ok) throw new Error(result.error || 'Sign up failed');
  if (result.session) {
    const user=toUser(result.session);
    if(!user)throw new Error('Account session could not be verified.');
    const session = storeSession(result.session,user);
    return { session, needsEmailConfirmation: false };
  }
  return { session: null, needsEmailConfirmation: result.needsEmailConfirmation!==false };
}

export async function signIn(email: string, password: string) {
  requireSupabaseConfiguration();
  const response = await fetch('/api/auth/login', {
    method: 'POST', headers: {'Content-Type':'application/json'}, credentials:'same-origin',
    body: JSON.stringify({ email:email.trim().toLowerCase(), password }),
  });
  const data = await response.json() as AuthResponse&{
    error?:string;
    mfa_required?:boolean;
    pending_access_token?:string;
    factors?:MfaFactor[];
  };
  if (!response.ok) throw new Error(data.error || 'Invalid email or password.');
  if(data.mfa_required){
    if(
      typeof data.pending_access_token!=='string'
      ||!Array.isArray(data.factors)
      ||data.factors.length===0
    )throw new Error('Multi-factor sign-in could not be started.');
    return {
      mfaRequired:true,
      pendingAccessToken:data.pending_access_token,
      expiresAt:decodeJwtExpiry(data.pending_access_token)??Date.now()+(data.expires_in||300)*1000,
      factors:data.factors,
    } satisfies MfaLoginChallenge;
  }
  const user = toUser(data);
  if (!data.access_token || !user) throw new Error('No session returned');
  return storeSession(data,user);
}

async function mfaRequest<T>(accessToken:string,body:Record<string,unknown>){
  const response=await fetch('/api/auth/mfa',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      Authorization:`Bearer ${accessToken}`,
    },
    credentials:'same-origin',
    body:JSON.stringify(body),
  });
  const data=await response.json().catch(()=>null) as (T&{error?:string})|null;
  if(!response.ok)throw new Error(data?.error||'Authenticator security could not be updated.');
  if(!data)throw new Error('Authenticator security returned an invalid response.');
  return data;
}

function storeVerifiedMfaSession(data:AuthResponse,previous?:StoredSession){
  const user=toUser(data)||previous?.user;
  if(!data.access_token||!user)throw new Error('The verified session could not be created.');
  const claims=decodeJwtPayload(data.access_token);
  if(claims?.aal!=='aal2')throw new Error('Multi-factor verification did not reach the required security level.');
  return storeSession(data,user,previous);
}

export async function verifyMfaLogin(challenge:MfaLoginChallenge,factorId:string,code:string){
  if(Date.now()>=challenge.expiresAt)throw new Error('This sign-in attempt expired. Enter your password again.');
  const data=await mfaRequest<AuthResponse>(challenge.pendingAccessToken,{
    action:'challenge_and_verify',
    factorId,
    code:code.trim(),
  });
  return storeVerifiedMfaSession(data);
}

export async function getMfaStatus(session:StoredSession){
  const current=await sessionForRemoteRevocation(session);
  return mfaRequest<MfaStatus>(current.accessToken,{action:'list'});
}

export async function startMfaEnrollment(session:StoredSession,friendlyName:string){
  const current=await sessionForRemoteRevocation(session);
  return mfaRequest<MfaEnrollment>(current.accessToken,{
    action:'enroll',
    friendlyName:friendlyName.trim(),
  });
}

export async function verifyMfaEnrollment(session:StoredSession,factorId:string,code:string){
  const current=await sessionForRemoteRevocation(session);
  const data=await mfaRequest<AuthResponse>(current.accessToken,{
    action:'challenge_and_verify',
    factorId,
    code:code.trim(),
  });
  return storeVerifiedMfaSession(data,current);
}

export async function unenrollMfaFactor(session:StoredSession,factorId:string){
  const current=await sessionForRemoteRevocation(session);
  const data=await mfaRequest<AuthResponse>(current.accessToken,{action:'unenroll',factorId});
  const user=toUser(data)||current.user;
  if(!data.access_token)throw new Error('The updated session could not be created.');
  return storeSession(data,user,current);
}

export async function refreshSession(session:StoredSession){
  const current=getStoredSession();
  if(!current||current.user.id!==session.user.id)throw new Error('Your session expired. Please sign in again.');
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async()=>{
    const response=await fetch('/api/auth/refresh',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      body:'{}',
    });
    const data=await response.json() as AuthResponse&{error?:string};
    if(!response.ok||!data.access_token)throw new Error(data.error||data.error_description||data.msg||'Your session expired. Please sign in again.');
    return storeSession(data,toUser(data)||current.user,current);
  })();
  try{return await refreshPromise}finally{refreshPromise=null}
}

function expireSession(){
  const session=readStoredSession();
  clearStoredSession();
  void revokeServerSession(session?.accessToken).catch(()=>{});
  window.dispatchEvent(new Event(sessionExpiredEvent));
}

async function authenticatedFetch(session:StoredSession,input:RequestInfo|URL,init:RequestInit={}){
  let current=getStoredSession();
  if(!current||current.user.id!==session.user.id){
    expireSession();
    throw new Error('Your session expired. Please sign in again.');
  }
  const renew=async()=>{
    try{return await refreshSession(current!)}catch(error){
      expireSession();
      throw error instanceof Error?error:new Error('Your session expired. Please sign in again.');
    }
  };
  if(!current.expiresAt||current.expiresAt-Date.now()<60_000)current=await renew();
  const send=(token:string)=>{
    const requestHeaders=new Headers(init.headers);
    requestHeaders.set('apikey',publishableKey??'');
    requestHeaders.set('Authorization',`Bearer ${token}`);
    return fetch(input,{...init,headers:requestHeaders});
  };
  let response=await send(current.accessToken);
  if(response.status===401){
    current=await renew();
    response=await send(current.accessToken);
  }
  if(response.status===403){
    const body=await response.clone().text().catch(()=>'');
    if(/DEALIVRA_MFA_REQUIRED|mfa_required|multi-factor verification is required/i.test(body)){
      window.dispatchEvent(new Event(mfaRequiredEvent));
    }
  }
  return response;
}

export async function requestPasswordReset(email:string,redirectTo:string){const response=await fetch(`${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,{method:'POST',headers:headers(),body:JSON.stringify({email:email.trim().toLowerCase()})});if(!response.ok){const data=await response.json();throw new Error(data?.msg||data?.error_description||'Could not send reset email')}}
export async function updateRecoveredPassword(accessToken:string,password:string){validatePassword(password);const response=await fetch(`${supabaseUrl}/auth/v1/user`,{method:'PUT',headers:headers(accessToken),body:JSON.stringify({password})});if(!response.ok){const data=await response.json();throw new Error(data?.msg||data?.error_description||'Could not update password')}}

export async function updateAccountName(session:StoredSession,displayName:string){
  const name=displayName.trim();
  if(name.length<2)throw new Error('Name must contain at least 2 characters.');
  const authResponse=await authenticatedFetch(session,`${supabaseUrl}/auth/v1/user`,{method:'PUT',headers:headers(session.accessToken),body:JSON.stringify({data:{display_name:name}})});
  if(!authResponse.ok){const data=await authResponse.json();throw new Error(data?.msg||data?.error_description||'Could not update account name')}
  const profileResponse=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}`,{method:'PATCH',headers:{...headers(session.accessToken),Prefer:'return=minimal'},body:JSON.stringify({display_name:name})});
  if(!profileResponse.ok){const data=await profileResponse.json();throw new Error(data?.message||'Could not update profile name')}
  const current=getStoredSession()||session;
  const updated:StoredSession={...current,user:{...current.user,displayName:name}};
  sessionStorage.setItem(sessionStorageKey,JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent<StoredSession>(sessionUpdatedEvent,{detail:updated}));
  return updated;
}

export async function updateAccountPassword(session:StoredSession,password:string){
  validatePassword(password);
  const response=await authenticatedFetch(session,`${supabaseUrl}/auth/v1/user`,{method:'PUT',headers:headers(session.accessToken),body:JSON.stringify({password})});
  if(!response.ok){const data=await response.json();throw new Error(data?.msg||data?.error_description||'Could not update password')}
}

function validatePassword(password:string){
  if(password.length<12)throw new Error('Password must contain at least 12 characters.');
  if(
    !/[a-z]/.test(password)
    || !/[A-Z]/.test(password)
    || !/\d/.test(password)
    || !/[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,.\/`~]/.test(password)
  ){
    throw new Error('Password must include uppercase, lowercase, a number, and a symbol.');
  }
}

export async function signOut(session:StoredSession|null=getStoredSession()){
  clearStoredSession();
  await revokeServerSession(session?.accessToken,'local').catch(()=>{});
}

async function sessionForRemoteRevocation(session:StoredSession){
  const current=getStoredSession();
  if(!current||current.user.id!==session.user.id){
    throw new Error('Your session expired. Please sign in again.');
  }
  return !current.expiresAt||current.expiresAt-Date.now()<60_000
    ?refreshSession(current)
    :current;
}

export async function signOutOtherSessions(session:StoredSession){
  const current=await sessionForRemoteRevocation(session);
  await revokeServerSession(current.accessToken,'others');
}

export async function signOutEverywhere(session:StoredSession){
  const current=await sessionForRemoteRevocation(session);
  await revokeServerSession(current.accessToken,'global');
  clearStoredSession();
}

async function accountEmailConfirmed(session:StoredSession){
  const response=await authenticatedFetch(session,`${supabaseUrl}/auth/v1/user`,{headers:headers(session.accessToken)});
  if(!response.ok)return false;
  const account=await response.json() as {email_confirmed_at?:string|null};
  return Boolean(account.email_confirmed_at);
}

function mapDeal(row: DealRow, sellerName: string, viewerId?: string, sellerContactVerified=false) {
  const viewerRole: Deal['viewerRole'] = viewerId ? (row.seller_id===viewerId?'seller':row.buyer_id===viewerId?'buyer':'visitor') : 'visitor';
  const catalog: Deal['catalog'] = {
    categoryId: row.category_id || 'general',
    catalogVersion: row.catalog_version || 'legacy',
    brandId: row.catalog_brand_id || undefined,
    brandLabel: row.catalog_brand_label || undefined,
    modelId: row.catalog_model_id || undefined,
    modelLabel: row.catalog_model_label || undefined,
    modelYear: row.model_year || undefined,
    variantId: row.catalog_variant_id || undefined,
    variantLabel: row.catalog_variant_label || undefined,
  };
  return {
    id: row.id, publicId: row.public_id, title: row.title, description: row.description,
    priceCents: row.price_cents, currency: row.currency, condition: row.condition,
    serialNumber: row.serial_last_four ? `•••• ${row.serial_last_four}` : undefined,
    deliveryMethod: row.delivery_method, status: row.status, sellerName,
    sellerContactVerified,
    sellerVerification: 'not_started' as const,
    agreementVersion: row.current_agreement_version, createdAt: row.created_at,
    expiresAt: row.expires_at || undefined,
    mediaUrls: (row.deal_media || []).sort((a,b)=>a.sort_order-b.sort_order).map(item=>publicMediaUrl(item.storage_path)),
    catalog,
    viewerRole,
  };
}

function catalogWriteColumns(draft: DealDraft) {
  const catalog=draft.catalog;
  return {
    category_id:catalog?.categoryId||'general',
    catalog_version:catalog?.catalogVersion||'legacy',
    catalog_brand_id:catalog?.brandId||null,
    catalog_brand_label:catalog?.brandLabel||null,
    catalog_model_id:catalog?.modelId||null,
    catalog_model_label:catalog?.modelLabel||null,
    model_year:catalog?.modelYear||null,
    catalog_variant_id:catalog?.variantId||null,
    catalog_variant_label:catalog?.variantLabel||null,
  };
}

export async function listUserDeals(session: StoredSession) {
  const [response,sellerContactVerified] = await Promise.all([
    authenticatedFetch(session,`${supabaseUrl}/rest/v1/deals?select=*,deal_media(storage_path,sort_order)&order=created_at.desc`, {headers: headers(session.accessToken)}),
    accountEmailConfirmed(session)
  ]);
  if (!response.ok) throw new Error('Could not load your deals');
  const rows = await response.json() as DealRow[];
  return rows.map(row => mapDeal(row, session.user.displayName, session.user.id, sellerContactVerified));
}

function publicMediaUrl(path: string) {
  return `${supabaseUrl}/storage/v1/object/public/deal-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export async function uploadDealPhotos(session: StoredSession, dealId: string, files: File[], startIndex=0) {
  const urls: string[] = [];
  for (let index=0; index<files.length; index++) {
    const file=await prepareMediaUpload(files[index]);
    const isVideo=isVideoUpload(file);
    if(file.size>(isVideo?25:6)*1024*1024)throw new Error(`${isVideo?'Video':'Photo'} ${index+1} is too large`);
    if(!['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/webm'].includes(file.type)&&!/^.+\.(jpe?g|png|webp|heic|mp4|webm)$/i.test(file.name))throw new Error(`File ${index+1} has an unsupported format`);
    const extension=file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path=`${session.user.id}/${dealId}/${crypto.randomUUID()}.${extension}`;
    const upload=await authenticatedFetch(session,`${supabaseUrl}/storage/v1/object/deal-media/${path}`,{method:'POST',headers:{apikey:publishableKey??'',Authorization:`Bearer ${session.accessToken}`,'Content-Type':file.type||(isVideo?'video/mp4':'image/jpeg'),'x-upsert':'false'},body:file});
    if(!upload.ok) throw new Error(`Photo ${index+1} could not be uploaded`);
    const record=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deal_media`,{method:'POST',headers:{...headers(session.accessToken),Prefer:'return=minimal'},body:JSON.stringify({deal_id:dealId,storage_path:path,sort_order:startIndex+index})});
    if(!record.ok) throw new Error(`Photo ${index+1} could not be linked to the deal`);
    urls.push(publicMediaUrl(path));
  }
  return urls;
}

async function invokeEvidenceFiles<T>(session:StoredSession,body:Record<string,unknown>){
  const response=await authenticatedFetch(session,`${supabaseUrl}/functions/v1/evidence-files`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(body)});
  const data=await response.json().catch(()=>null) as ({error?:unknown;code?:unknown}&T)|null;
  if(!response.ok){
    const message=typeof data?.error==='string'&&data.error.length<=240?data.error:'The secure file service is temporarily unavailable.';
    throw new Error(message);
  }
  if(!data)throw new Error('The secure file service returned an invalid response.');
  return data as T;
}
async function invokeEvidenceMaintenance<T>(session:StoredSession,body:Record<string,unknown>){
  const response=await authenticatedFetch(session,`${supabaseUrl}/functions/v1/evidence-maintenance`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(body)});
  const data=await response.json().catch(()=>null) as ({error?:unknown;code?:unknown}&T)|null;
  if(!response.ok){
    const message=typeof data?.error==='string'&&data.error.length<=240?data.error:'The evidence lifecycle service is temporarily unavailable.';
    throw new Error(message);
  }
  if(!data)throw new Error('The evidence lifecycle service returned an invalid response.');
  return data as T;
}
export async function getEvidenceLifecycleSnapshot(session:StoredSession){
  return await invokeEvidenceMaintenance<EvidenceLifecycleSnapshot>(session,{action:'snapshot'});
}
export async function refreshEvidenceLifecycleInventory(session:StoredSession){
  await invokeEvidenceMaintenance<{inventory:Record<string,unknown>}>(session,{action:'refresh-inventory'});
}
export async function approveEvidenceDeletion(session:StoredSession,evidenceId:string,reason:string){
  await invokeEvidenceMaintenance<{jobId:string}>(session,{action:'approve-deletion',evidenceId,reason});
}
export async function placeEvidenceLegalHold(session:StoredSession,evidenceId:string,reason:string){
  return await invokeEvidenceMaintenance<{holdKey:string}>(session,{action:'place-legal-hold',evidenceId,reason});
}
export async function releaseEvidenceLegalHold(session:StoredSession,evidenceId:string,holdKey:string,reason:string){
  await invokeEvidenceMaintenance<{holdKey:string}>(session,{action:'release-legal-hold',evidenceId,holdKey,reason});
}
export async function acknowledgeEvidenceLifecycleAlert(session:StoredSession,alertId:string){
  await invokeEvidenceMaintenance<{acknowledged:boolean}>(session,{action:'acknowledge-alert',alertId});
}
function normalizeEvidenceVideo(file:File){
  const extension=file.name.split('.').pop()?.toLowerCase();
  const mimeType=file.type==='video/quicktime'||extension==='mov'
    ?'video/quicktime'
    :file.type==='video/webm'||extension==='webm'
    ?'video/webm'
    :file.type==='video/mp4'||extension==='mp4'
    ?'video/mp4'
    :'';
  if(!mimeType)throw new Error('Choose an MP4, MOV, or WebM video.');
  return file.type===mimeType?file:new File([file],file.name,{type:mimeType,lastModified:file.lastModified});
}
export async function uploadDealEvidence(session:StoredSession,dealId:string,uploaderRole:'seller'|'buyer',evidenceType:EvidenceType,file:File){
  const preparedFile=isVideoUpload(file)?normalizeEvidenceVideo(file):await prepareMediaUpload(file);
  const declaration={claimedMimeType:preparedFile.type,evidenceType,fileName:preparedFile.name,fileSize:preparedFile.size,role:uploaderRole};
  const validation=validateEvidenceDeclaration(declaration);
  if(!validation.ok)throw new Error(validation.message);
  const byteValidation=validateEvidenceBytes(new Uint8Array(await preparedFile.arrayBuffer()),declaration);
  if(!byteValidation.ok)throw new Error(byteValidation.message);
  const intake=await invokeEvidenceFiles<{intakeId:string;path:string;bucket:'deal-evidence-quarantine';expiresAt:string}>(session,{
    action:'request-upload',
    dealId,
    uploaderRole,
    evidenceType,
    fileName:preparedFile.name,
    claimedMimeType:preparedFile.type,
    fileSize:preparedFile.size
  });
  const encodedPath=intake.path.split('/').map(encodeURIComponent).join('/');
  const upload=await authenticatedFetch(session,`${supabaseUrl}/storage/v1/object/${intake.bucket}/${encodedPath}`,{method:'POST',headers:{apikey:publishableKey??'',Authorization:`Bearer ${session.accessToken}`,'Content-Type':preparedFile.type,'x-upsert':'false'},body:preparedFile});
  if(!upload.ok){const data=await upload.json().catch(()=>null);throw new Error(data?.message||data?.error||'Could not upload evidence file');}
  const result=await invokeEvidenceFiles<{evidence:DealEvidence}>(session,{action:'finalize-upload',intakeId:intake.intakeId});
  return result.evidence;
}
export async function listDealEvidence(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deal_evidence_safe?deal_id=eq.${encodeURIComponent(dealId)}&select=*&order=created_at.desc`,{headers:headers(session.accessToken)});if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.message||'Could not load evidence');}return await response.json() as DealEvidence[]}
async function evidenceViewerSha256(bytes:ArrayBuffer){
  if(!globalThis.crypto?.subtle)throw new Error('Secure file verification is unavailable in this browser.');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function loadDealEvidenceViewer(session:StoredSession,evidenceId:string){
  const data=await invokeEvidenceFiles<{
    url:string;
    expiresAt:string;
    mimeType:string;
    fileName:string|null;
    fileSizeBytes:number;
    sha256:string;
    scanStatus:string;
    scannedAt:string|null;
    integrityStatus:string;
    integrityCheckedAt:string;
  }>(session,{action:'signed-url',evidenceId});
  const allowedMimeTypes=new Set(['image/webp','video/mp4','video/webm','video/quicktime']);
  if(
    typeof data.url!=='string'
    || typeof data.expiresAt!=='string'
    || typeof data.mimeType!=='string'
    || (data.fileName!==null&&typeof data.fileName!=='string')
    || typeof data.sha256!=='string'
    || typeof data.scannedAt!=='string'
    || typeof data.integrityCheckedAt!=='string'
    || !allowedMimeTypes.has(data.mimeType)
    || data.scanStatus!=='clean'
    || data.integrityStatus!=='verified'
    || !/^[0-9a-f]{64}$/.test(data.sha256)
    || !Number.isSafeInteger(data.fileSizeBytes)
    || data.fileSizeBytes<=0
    || data.fileSizeBytes>50*1024*1024
    || !data.integrityCheckedAt
    || !data.scannedAt
    || !data.expiresAt
    || !Number.isFinite(Date.parse(data.integrityCheckedAt))
    || !Number.isFinite(Date.parse(data.scannedAt))
    || !Number.isFinite(Date.parse(data.expiresAt))
    || Date.parse(data.expiresAt)<=Date.now()
  )throw new Error('The evidence verification response was invalid.');
  let signedUrl:URL;
  try{signedUrl=new URL(data.url)}catch{throw new Error('The evidence verification response was invalid.')}
  if(!supabaseUrl)throw new Error(configurationUnavailableMessage);
  const expectedStorageOrigin=supabaseUrl;
  if(
    signedUrl.protocol!=='https:'
    || signedUrl.origin!==expectedStorageOrigin
    || !signedUrl.pathname.startsWith('/storage/v1/object/sign/deal-evidence/')
  )throw new Error('The secure evidence source was invalid.');
  const response=await fetch(signedUrl,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error('The verified evidence file could not be loaded.');
  const responseMimeType=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
  if(responseMimeType&&responseMimeType!==data.mimeType)throw new Error('The evidence file type changed during secure viewing.');
  const responseLength=Number(response.headers.get('Content-Length')||data.fileSizeBytes);
  if(!Number.isSafeInteger(responseLength)||responseLength!==data.fileSizeBytes)throw new Error('The evidence file size changed during secure viewing.');
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==data.fileSizeBytes)throw new Error('The evidence file size changed during secure viewing.');
  if(await evidenceViewerSha256(bytes)!==data.sha256)throw new Error('The evidence fingerprint changed during secure viewing.');
  const fileName=(data.fileName||'evidence-file').replace(/[\u0000-\u001f\u007f/\\]+/gu,'-').slice(0,160)||'evidence-file';
  return {
    objectUrl:URL.createObjectURL(new Blob([bytes],{type:data.mimeType})),
    expiresAt:data.expiresAt,
    mimeType:data.mimeType,
    fileName,
    fileSizeBytes:data.fileSizeBytes,
    sha256:data.sha256,
    scanStatus:'clean',
    scannedAt:data.scannedAt,
    integrityStatus:'verified',
    integrityCheckedAt:data.integrityCheckedAt
  } as DealEvidenceViewer;
}

export async function deleteDealMedia(session:StoredSession,dealId:string,publicUrl:string){const marker='/storage/v1/object/public/deal-media/';const encodedPath=publicUrl.split(marker)[1];if(!encodedPath)throw new Error('Invalid media URL');const path=encodedPath.split('/').map(decodeURIComponent).join('/');const removeObject=await authenticatedFetch(session,`${supabaseUrl}/storage/v1/object/deal-media/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'DELETE',headers:{apikey:publishableKey??'',Authorization:`Bearer ${session.accessToken}`}});if(!removeObject.ok)throw new Error('Could not remove the stored file');const removeRecord=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deal_media?deal_id=eq.${dealId}&storage_path=eq.${encodeURIComponent(path)}`,{method:'DELETE',headers:{...headers(session.accessToken),Prefer:'return=minimal'}});if(!removeRecord.ok)throw new Error('File removed, but its record could not be cleaned up')}
export async function reorderDealMedia(session:StoredSession,dealId:string,publicUrls:string[]){const marker='/storage/v1/object/public/deal-media/';const paths=publicUrls.map(url=>{const encoded=url.split(marker)[1];if(!encoded)throw new Error('Invalid media URL');return encoded.split('/').map(decodeURIComponent).join('/')});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/reorder_deal_media`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_paths:paths})});if(!response.ok){const data=await response.json();throw new Error(data?.message||'Could not reorder media')}}
export async function updatePublishedDeal(session:StoredSession,dealId:string,draft:DealDraft){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/update_published_deal`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_title:draft.title,p_description:draft.description,p_price_cents:toMinorUnits(draft.price,draft.currency),p_condition:draft.condition,p_delivery_method:draft.deliveryMethod})});if(!response.ok){const data=await response.json();throw new Error(data?.message||'Could not update deal')}return await response.json() as number}

export async function createUserDeal(session: StoredSession, draft: DealDraft) {
  const saved=await saveUserDealDraft(session,draft);
  return publishUserDealDraft(session,saved.id,draft);
}

export async function saveUserDealDraft(session:StoredSession,draft:DealDraft){
  const title=draft.title.trim();
  if(title.length<3||title.length>120)throw new Error('Item title must contain 3 to 120 characters.');
  const serial=draft.serialNumber.trim();
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deals`,{method:'POST',headers:{...headers(session.accessToken),Prefer:'return=representation'},body:JSON.stringify({seller_id:session.user.id,title,description:draft.description.trim(),price_cents:toMinorUnits(draft.price,draft.currency),currency:draft.currency,condition:draft.condition,serial_last_four:serial?serial.slice(-4):null,delivery_method:draft.deliveryMethod,status:'draft',current_agreement_version:0,published_at:null,expires_at:new Date(Date.now()+(draft.expiresInDays||7)*24*60*60*1000).toISOString(),...catalogWriteColumns(draft)})});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.message||'Could not save draft');
  return mapDeal((data as DealRow[])[0],session.user.displayName,session.user.id,await accountEmailConfirmed(session));
}

export async function updateUserDealDraft(session:StoredSession,dealId:string,draft:DealDraft){
  const title=draft.title.trim();
  if(title.length<3||title.length>120)throw new Error('Item title must contain 3 to 120 characters.');
  const serial=draft.serialNumber.trim();
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deals?id=eq.${encodeURIComponent(dealId)}&seller_id=eq.${session.user.id}&status=eq.draft`,{method:'PATCH',headers:{...headers(session.accessToken),Prefer:'return=representation'},body:JSON.stringify({title,description:draft.description.trim(),price_cents:toMinorUnits(draft.price,draft.currency),currency:draft.currency,condition:draft.condition,serial_last_four:serial?serial.slice(-4):null,delivery_method:draft.deliveryMethod,expires_at:new Date(Date.now()+(draft.expiresInDays||7)*24*60*60*1000).toISOString(),updated_at:new Date().toISOString(),...catalogWriteColumns(draft)})});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.message||'Could not update draft');
  if(!(data as DealRow[])[0])throw new Error('Draft was not found');
  return mapDeal((data as DealRow[])[0],session.user.displayName,session.user.id,await accountEmailConfirmed(session));
}

export async function publishUserDealDraft(session:StoredSession,dealId:string,draft:DealDraft){
  const title=draft.title.trim();
  if(title.length<3||title.length>120)throw new Error('Item title must contain 3 to 120 characters.');
  const serial=draft.serialNumber.trim();
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/publish_deal_with_seller_declarations`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_title:title,p_description:draft.description.trim(),p_price_cents:toMinorUnits(draft.price,draft.currency),p_currency:draft.currency,p_condition:draft.condition,p_serial_last_four:serial?serial.slice(-4):null,p_delivery_method:draft.deliveryMethod,p_expires_in_days:draft.expiresInDays||7})});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.message||'Could not publish draft');
  if(!(data as DealRow[])[0])throw new Error('Draft was not found');
  return mapDeal((data as DealRow[])[0],session.user.displayName,session.user.id,await accountEmailConfirmed(session));
}

export interface DealMeeting { id:string; deal_id:string; proposed_by:string; location_name:string; address:string; scheduled_at:string; status:'proposed'|'confirmed'|'cancelled'; seller_arrived:boolean; buyer_arrived:boolean }

export async function getDealMeeting(session: StoredSession, dealId: string) {
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deal_meetings?deal_id=eq.${dealId}&select=*`,{headers:headers(session.accessToken)});
  if(!response.ok) throw new Error('Could not load meeting');
  return ((await response.json()) as DealMeeting[])[0] || null;
}

export async function proposeMeeting(session:StoredSession,dealId:string,locationName:string,address:string,scheduledAt:string){
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/propose_meeting`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_location_name:locationName,p_address:address,p_scheduled_at:new Date(scheduledAt).toISOString()})});
  if(!response.ok){const data=await response.json();throw new Error(data?.message||'Could not propose meeting')}
}
export async function confirmMeeting(session:StoredSession,dealId:string){
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/confirm_meeting`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});
  if(!response.ok){const data=await response.json();throw new Error(data?.message||'Could not confirm meeting')}
}
export async function markArrived(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/mark_arrived`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not mark arrival')}}
export async function generateHandoffPin(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/generate_handoff_pin`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not generate PIN')}return await response.json() as string}
export async function completeHandoff(session:StoredSession,dealId:string,pin:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/complete_handoff`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_pin:pin})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not complete deal')}}
export async function submitRating(session:StoredSession,dealId:string,stars:number,comment:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/submit_rating`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_stars:stars,p_comment:comment})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not submit rating')}}
export async function getMyProfileSummary(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_my_profile_summary`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load profile')}const rows=await response.json() as ProfileSummary[];if(!rows[0])throw new Error('Profile was not found');return rows[0]}
export async function getMyAccountSessions(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_my_account_sessions`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok){const d=await response.json().catch(()=>null);throw new Error(d?.message||'Could not load signed-in devices')}return await response.json() as AccountSession[]}
export async function requestIdentityVerification(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/request_identity_verification`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not request verification')}return await response.json() as ProfileSummary['verification_status']}
export async function cancelDeal(session:StoredSession,dealId:string,reason:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/cancel_deal`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_reason:reason})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not cancel deal')}}
export async function openDealDispute(session:StoredSession,dealId:string,reason:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/open_deal_dispute`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_reason:reason})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not open dispute')}}
export async function reportPublicDeal(session:StoredSession,publicId:string,category:string,details:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/report_public_deal`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_public_id:publicId,p_category:category,p_details:details.trim()})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not submit report')}return await response.json() as string}
export async function getAdminAccess(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/is_dealsafe_admin`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok)return false;return Boolean(await response.json())}
export async function getAdminRevenueSummary(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_admin_revenue_summary`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok){const d=await response.json().catch(()=>null);throw new Error(d?.message||'Could not load revenue summary')}const rows=await response.json() as AdminRevenueSummary[];if(!rows[0])throw new Error('Revenue summary is unavailable');return rows[0]}
export async function getAdminRevenueTransactions(session:StoredSession,limit=100){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_admin_revenue_transactions`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_limit:limit})});if(!response.ok){const d=await response.json().catch(()=>null);throw new Error(d?.message||'Could not load revenue transactions')}return await response.json() as AdminRevenueTransaction[]}
export async function getAdminCatalogAdoption(session:StoredSession,days:7|30|90=30){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_admin_catalog_adoption`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_days:days})});if(!response.ok){const d=await response.json().catch(()=>null);throw new Error(d?.message||'Could not load catalog adoption')}return await response.json() as AdminCatalogAdoption[]}
export async function getAdminReports(session:StoredSession,status:'open'|'reviewed'|'dismissed'|'all'='open'){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_admin_reports`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_status:status})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load report queue')}return await response.json() as AdminReport[]}
export async function resolveAdminReport(session:StoredSession,reportId:string,decision:'reviewed'|'dismissed',note:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/resolve_deal_report`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_report_id:reportId,p_decision:decision,p_resolution_note:note.trim()})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not save report decision')}}
export async function getAdminDisputes(session:StoredSession,status:'open'|'resolved'|'all'='open'){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_admin_disputes`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_status:status})});if(!response.ok){const d=await response.json().catch(()=>null);throw new Error(d?.message||'Could not load dispute queue')}return await response.json() as AdminDispute[]}
export async function resolveAdminDispute(session:StoredSession,disputeId:string,decision:'resolved_buyer'|'resolved_seller'|'cancelled',note:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/resolve_deal_dispute`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_dispute_id:disputeId,p_decision:decision,p_resolution_note:note.trim()})});if(!response.ok){const d=await response.json().catch(()=>null);throw new Error(d?.message||'Could not save dispute decision')}}
export async function resolveAdminDisputeFinancial(session:StoredSession,disputeId:string,decision:'resolved_buyer'|'resolved_seller',note:string){return invokeEdgeFunction<{resolved:boolean;action:'refund'|'transfer';refundId?:string;transferId?:string}>(session,'stripe-resolve-dispute',{disputeId,decision,note:note.trim()})}
export async function setAdminDealVisibility(session:StoredSession,dealId:string,status:'visible'|'hidden',note:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_deal_moderation_status`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_status:status,p_note:note.trim()})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not update Deal Link visibility')}}
export async function getDealRiskAssessment(publicId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_deal_risk_assessment`,{method:'POST',headers:headers(),body:JSON.stringify({p_public_id:publicId})});if(!response.ok)throw new Error('Risk check is unavailable');return ((await response.json()) as RiskAssessment[])[0]||null}
export async function getPublicSellerTrustProfile(publicId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_seller_trust_profile`,{method:'POST',headers:headers(),body:JSON.stringify({p_public_id:publicId})});if(!response.ok)throw new Error('Seller trust profile is unavailable');return ((await response.json()) as PublicTrustProfile[])[0]||null}
export async function getTrustPassportSettings(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_my_trust_passport_settings`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load passport settings')}const rows=await response.json() as TrustPassportSettings[];if(!rows[0])throw new Error('Profile was not found');return rows[0]}
export async function setTrustPassportEnabled(session:StoredSession,enabled:boolean){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_trust_passport_enabled`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_enabled:enabled})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not update passport settings')}return await response.json() as string}
export async function getPublicTrustPassport(publicId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_trust_passport`,{method:'POST',headers:headers(),body:JSON.stringify({p_public_id:publicId})});if(!response.ok)throw new Error('Passport unavailable');return ((await response.json()) as TrustPassport[])[0]||null}
export async function getPublicSellerDeclaration(publicId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_seller_declaration`,{method:'POST',headers:headers(),body:JSON.stringify({p_public_id:publicId})});if(!response.ok)throw new Error('Seller declaration unavailable');return ((await response.json()) as SellerDeclarationRecord[])[0]||null}
export async function getPublicAgreementHistory(publicId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_agreement_history`,{method:'POST',headers:headers(),body:JSON.stringify({p_public_id:publicId})});if(!response.ok)throw new Error('Agreement history unavailable');return await response.json() as AgreementHistoryVersion[]}
export async function verifyAgreementRecord(publicId:string,contentHash:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/verify_agreement_record`,{method:'POST',headers:headers(),body:JSON.stringify({p_public_id:publicId,p_content_hash:contentHash})});if(!response.ok)throw new Error('Agreement verification is unavailable');return ((await response.json()) as AgreementVerificationResult[])[0]||null}
export async function renewDealLink(session:StoredSession,dealId:string,days:number){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/renew_deal_link`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_days:days})});if(!response.ok)throw new Error('Could not renew Deal Link');const rows=await response.json() as DealRenewalResult[];if(!rows[0])throw new Error('Could not renew Deal Link');return rows[0]}
export async function getDealAcceptanceProtection(publicId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_deal_acceptance_protection`,{method:'POST',headers:headers(),body:JSON.stringify({p_public_id:publicId})});if(!response.ok)return false;return Boolean(await response.json())}
export async function configureBuyerAccessCode(session:StoredSession,dealId:string,enabled:boolean){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/configure_buyer_access_code`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_enabled:enabled})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.message||'Could not update buyer access');return data as string|null}
export async function isDealSaved(session:StoredSession,publicId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/is_deal_saved`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_public_id:publicId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not check saved deal')}return Boolean(await response.json())}
export async function setDealSaved(session:StoredSession,publicId:string,saved:boolean){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_deal_saved`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_public_id:publicId,p_saved:saved})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not update saved deal')}return Boolean(await response.json())}
export async function getDealInspection(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_inspection`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load inspection receipt')}return ((await response.json()) as DealInspection[])[0]||null}
export async function recordDealInspection(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/record_deal_inspection`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_item_reviewed:true,p_price_confirmed:true,p_handoff_confirmed:true,p_reference_checked:true})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not save inspection receipt')}}
export async function getDealTimeline(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_timeline`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load timeline')}return await response.json() as TimelineEvent[]}
export async function getDealParticipants(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_participants`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok)throw new Error('Could not load participants');return ((await response.json()) as DealParticipants[])[0]||null}
export async function getDealActionPlan(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_action_plan`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok)throw new Error('Could not load deal action plan');return ((await response.json()) as DealActionPlan[])[0]||null}
export async function getMyNotifications(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_my_notifications`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_limit:12})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load notifications')}return await response.json() as DealNotification[]}
export async function markDealNotificationsRead(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/mark_deal_activity_read`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok)throw new Error('Could not update notifications')}
export async function markAllNotificationsRead(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/mark_all_activity_read`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok)throw new Error('Could not update notifications')}
export async function getDealMessages(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_messages`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load messages')}return await response.json() as DealMessage[]}
export async function sendDealMessage(session:StoredSession,dealId:string,body:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/send_deal_message`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_body:body})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not send message')}}
export async function makeDealOffer(session:StoredSession,publicId:string,amountCents:number,typedName:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/make_deal_offer`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_public_id:publicId,p_amount_cents:amountCents,p_typed_name:typedName})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not send offer')}}
export async function getDealOffers(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_offers`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load offers')}return await response.json() as DealOffer[]}
export async function getDealInquiries(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_inquiries`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok)throw new Error('Could not load questions');return await response.json() as DealInquiry[]}
export async function isCurrentUserDealSeller(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/is_current_user_deal_seller`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});return response.ok&&Boolean(await response.json())}
export async function askDealQuestion(session:StoredSession,publicId:string,body:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/ask_deal_question`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_public_id:publicId,p_body:body.trim()})});if(!response.ok)throw new Error('Could not send question')}
export async function replyDealInquiry(session:StoredSession,inquiryId:string,reply:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/reply_deal_inquiry`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_inquiry_id:inquiryId,p_reply:reply.trim()})});if(!response.ok)throw new Error('Could not send reply')}
export async function respondToOffer(session:StoredSession,offerId:string,accept:boolean){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/respond_to_offer`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_offer_id:offerId,p_accept:accept})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not respond to offer')}}
export async function getDealShipment(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deal_shipments?deal_id=eq.${dealId}&select=*`,{headers:headers(session.accessToken)});if(!response.ok)throw new Error('Could not load shipment');return ((await response.json()) as DealShipment[])[0]||null}
export async function getSellerShippingEvidenceReadiness(session:StoredSession,dealId:string){
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_seller_shipping_evidence_readiness`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.message||'Could not check shipping evidence');
  return ((data||[]) as SellerShippingEvidenceReadiness[])[0]||null;
}
export async function getDealDeliveryDetails(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_delivery_details`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok)throw new Error('Could not load delivery address');return ((await response.json()) as DealDeliveryDetails[])[0]||null}
export async function saveDealDeliveryDetails(session:StoredSession,dealId:string,recipientName:string,fullAddress:string,country:string,instructions:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_deal_delivery_details`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_recipient_name:recipientName,p_full_address:fullAddress,p_country:country,p_instructions:instructions||null})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not save delivery address')}}
export async function getDealPaymentRecord(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_payment_record`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok)throw new Error('Could not load payment record');return ((await response.json()) as DealPaymentRecord[])[0]||null}
export async function setDealPaymentMethod(session:StoredSession,dealId:string,method:DealPaymentMethod){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_deal_payment_method`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_method:method})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not save payment method')}}
export async function confirmDealPaymentMethod(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/confirm_deal_payment_method`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not confirm payment method')}}
export async function markDealPaymentSent(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/mark_deal_payment_sent`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not record payment sent')}}
export async function markDealPaymentReceived(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/mark_deal_payment_received`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not confirm payment received')}}
export class SecurePaymentServiceError extends Error{
  readonly code:string;
  readonly correlationId:string|null;
  readonly retryable:boolean;
  constructor(message:string,code:string,correlationId:string|null,retryable:boolean){
    super(message);
    this.name='SecurePaymentServiceError';
    this.code=code;
    this.correlationId=correlationId;
    this.retryable=retryable;
  }
}
async function invokeEdgeFunction<T>(session:StoredSession,name:string,body:Record<string,unknown>){
  const response=await authenticatedFetch(session,`${supabaseUrl}/functions/v1/${name}`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(body)});
  const data=await response.json().catch(()=>null) as {error?:unknown;code?:unknown;correlationId?:unknown;retryable?:unknown}|null;
  if(!response.ok){
    const safeMessage=typeof data?.error==='string'&&data.error.length<=240?data.error:'Secure payment service is unavailable.';
    const code=typeof data?.code==='string'&&/^[a-z0-9_]{1,64}$/.test(data.code)?data.code:'payment_service_error';
    const bodyReference=typeof data?.correlationId==='string'&&/^[0-9a-f-]{36}$/i.test(data.correlationId)?data.correlationId:null;
    const headerReference=response.headers.get('X-Dealivra-Correlation-Id');
    const correlationId=bodyReference||(headerReference&&/^[0-9a-f-]{36}$/i.test(headerReference)?headerReference:null);
    const referenceText=correlationId?` Support reference: ${correlationId}.`:'';
    throw new SecurePaymentServiceError(`${safeMessage}${referenceText}`,code,correlationId,data?.retryable===true);
  }
  return data as T;
}
export async function getStripeConnectStatus(session:StoredSession){return invokeEdgeFunction<StripeConnectStatus>(session,'stripe-connect',{action:'status'})}
export async function startStripeConnectOnboarding(session:StoredSession,dealPublicId:string){return invokeEdgeFunction<{url:string;expiresAt:number}>(session,'stripe-connect',{action:'onboard',dealPublicId})}
export async function getProtectedPaymentStatus(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_protected_payment_status`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.message||'Could not load protected payment');return (data as ProtectedPaymentStatus[])[0]||null}
export async function createProtectedCheckout(session:StoredSession,dealId:string){return invokeEdgeFunction<{url:string;expiresAt?:string;reused?:boolean}>(session,'stripe-create-checkout',{dealId})}
export async function createDealShipment(session:StoredSession,dealId:string,carrier:string,trackingNumber:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/create_deal_shipment`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_carrier:carrier,p_tracking_number:trackingNumber})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not save shipment')}}
export async function confirmShipmentDelivery(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/confirm_shipment_delivery`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not confirm delivery')}}

interface PublicDealRow extends DealRow {
  agreement_version: number;
  seller_name: string;
  seller_contact_verified: boolean;
  seller_verification: 'not_started' | 'pending' | 'verified';
  media_paths: string[];
}

interface SavedDealRow extends DealRow {
  seller_name: string;
  seller_contact_verified: boolean;
  seller_verification: 'not_started' | 'pending' | 'verified';
  media_paths: string[];
  saved_at: string;
}

export async function getMySavedDeals(session:StoredSession){
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_my_saved_deals`,{method:'POST',headers:headers(session.accessToken),body:'{}'});
  if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load saved deals')}
  const rows=await response.json() as SavedDealRow[];
  return rows.map(row=>({...mapDeal(row,row.seller_name),sellerContactVerified:row.seller_contact_verified,sellerVerification:row.seller_verification,mediaUrls:(row.media_paths||[]).map(publicMediaUrl)}));
}

export async function getPublicDeal(publicId: string) {
  requireSupabaseConfiguration();
  // Deal IDs are generated and stored in uppercase. Normalize copied or
  // manually typed links so a lowercase query string still resolves.
  const normalizedPublicId = publicId.trim().toUpperCase();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_deal`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ p_public_id: normalizedPublicId }),
  });
  if (!response.ok) throw new Error('Deal Link is unavailable');
  const rows = await response.json() as PublicDealRow[];
  const row = rows[0];
  if (!row) throw new Error('Deal Link was not found');
  return {
    ...mapDeal(row, row.seller_name),
    agreementVersion: row.agreement_version,
    sellerContactVerified: row.seller_contact_verified,
    sellerVerification: row.seller_verification,
    mediaUrls: (row.media_paths || []).map(publicMediaUrl),
  };
}

export async function acceptPublicDeal(session: StoredSession, publicId: string, typedName: string, accessCode='') {
  const response = await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/accept_deal`, {
    method: 'POST', headers: headers(session.accessToken),
    body: JSON.stringify({ p_public_id: publicId, p_typed_name: typedName, p_access_code: accessCode.trim() || null }),
  });
  const data = await response.json().catch(()=>null);
  if (!response.ok) {
    throw new Error(data?.message || 'Could not accept this deal');
  }
  if(data==='incorrect_code')throw new Error('Incorrect buyer access code');
  if(data==='rate_limited')throw new Error('Too many incorrect codes. Try again in 15 minutes.');
}

export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabaseUrl || !publishableKey) return false;

  try {
    // Health checks must not require anonymous SELECT access to a private
    // business table. The Auth health endpoint exposes no customer data.
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: publishableKey },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Authenticated CRUD is added after sign-up and the remaining RLS policies are ready.
