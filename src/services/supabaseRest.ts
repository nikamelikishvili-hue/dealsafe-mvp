import type { Deal, DealDraft } from '../domain';
import { toMinorUnits, type CurrencyCode } from '../currency';
import { isVideoUpload, prepareMediaUpload } from '../mediaPrivacy';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey);

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface StoredSession { accessToken:string;refreshToken?:string;expiresAt?:number;user:AuthUser }
export interface ProfileSummary { display_name:string; verification_status:'not_started'|'pending'|'verified'|'failed'; member_since:string; completed_deals:number; rating_count:number; average_rating:number|null; recent_ratings:{stars:number;comment:string|null;created_at:string}[] }
export interface TimelineEvent { id:string; event_type:string; created_at:string; is_mine:boolean }
export interface DealNotification extends TimelineEvent { deal_id:string; public_id:string; title:string }
export interface DealMessage { id:number; sender_id:string; sender_name:string; body:string; created_at:string; is_mine:boolean }
export interface DealOffer { id:string;amount_cents:number;status:'pending'|'accepted'|'declined'|'withdrawn';buyer_name:string;created_at:string;is_mine:boolean }
export interface DealShipment { id:string;deal_id:string;carrier:string;tracking_number:string;status:'shipped'|'delivered';shipped_at:string;delivered_at:string|null }
export interface AdminReport { report_id:string;deal_id:string;public_id:string;title:string;reason:string;report_status:'open'|'reviewed'|'dismissed';moderation_status:'visible'|'hidden';created_at:string;reporter_name:string;seller_name:string;resolution_note:string|null }
export interface RiskAssessment { risk_score:number;risk_level:'low'|'medium'|'high';signals:string[] }
export interface PublicTrustProfile { display_name:string;verification_status:'not_started'|'pending'|'verified'|'failed';member_since:string;completed_sales:number;rating_count:number;average_rating:number|null }
export interface TrustPassportSettings { public_id:string;enabled:boolean }
export interface TrustPassport { display_name:string;verification_status:'not_started'|'pending'|'verified'|'failed';member_since:string;completed_deals:number;completed_sales:number;completed_purchases:number;rating_count:number;average_rating:number|null;recent_ratings:{stars:number;created_at:string}[] }
export interface DealInspection { agreement_version:number;item_reviewed:boolean;price_confirmed:boolean;handoff_confirmed:boolean;reference_checked:boolean;inspected_at:string;buyer_name:string }

interface DealRow {
  id: string; public_id: string; title: string; description: string;
  price_cents: number; currency: CurrencyCode; condition: 'Like new' | 'Good' | 'Fair';
  serial_last_four: string | null; delivery_method: 'Meet in person' | 'Ship to buyer';
  status: 'draft' | 'published' | 'accepted' | 'completed' | 'cancelled' | 'disputed';
  current_agreement_version: number; created_at: string;
  expires_at: string | null;
  deal_media?: { storage_path: string; sort_order: number }[];
  seller_id?: string; buyer_id?: string | null;
}

interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email?: string; user_metadata?: { display_name?: string } };
  msg?: string;
  error_description?: string;
}

const sessionKey = 'dealsafe_session';
export const sessionUpdatedEvent = 'dealsafe-session-updated';
export const sessionExpiredEvent = 'dealsafe-session-expired';
let refreshPromise: Promise<StoredSession> | null = null;

function storeSession(data:AuthResponse,user:AuthUser){const session:StoredSession={accessToken:data.access_token!,refreshToken:data.refresh_token,expiresAt:Date.now()+(data.expires_in||3600)*1000,user};localStorage.setItem(sessionKey,JSON.stringify(session));window.dispatchEvent(new CustomEvent<StoredSession>(sessionUpdatedEvent,{detail:session}));return session}

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
    displayName: data.user.user_metadata?.display_name || data.user.email.split('@')[0],
  };
}

export function getStoredSession(): StoredSession | null {
  try {
    const session=JSON.parse(localStorage.getItem(sessionKey) || 'null') as StoredSession|null;
    if(!session?.accessToken||!session.refreshToken||!session.user?.id){
      localStorage.removeItem(sessionKey);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(sessionKey);
    return null;
  }
}

export async function signUp(email: string, password: string, displayName: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ email, password, data: { display_name: displayName } }),
  });
  const data = await response.json() as AuthResponse;
  if (!response.ok) throw new Error(data.msg || data.error_description || 'Sign up failed');
  const user = toUser(data);
  if (data.access_token && user) {
    const session = storeSession(data,user);
    return { session, needsEmailConfirmation: false };
  }
  return { session: null, needsEmailConfirmation: true };
}

export async function signIn(email: string, password: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ email, password }),
  });
  const data = await response.json() as AuthResponse;
  if (!response.ok) throw new Error(data.error_description || data.msg || 'Sign in failed');
  const user = toUser(data);
  if (!data.access_token || !user) throw new Error('No session returned');
  return storeSession(data,user);
}

export async function refreshSession(session:StoredSession){
  const current=getStoredSession()||session;
  if(!current.refreshToken)throw new Error('Your session expired. Please sign in again.');
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async()=>{
    const response=await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:headers(),body:JSON.stringify({refresh_token:current.refreshToken})});
    const data=await response.json() as AuthResponse;
    if(!response.ok||!data.access_token)throw new Error(data.error_description||data.msg||'Your session expired. Please sign in again.');
    return storeSession(data,toUser(data)||current.user);
  })();
  try{return await refreshPromise}finally{refreshPromise=null}
}

function expireSession(){
  localStorage.removeItem(sessionKey);
  window.dispatchEvent(new Event(sessionExpiredEvent));
}

async function authenticatedFetch(session:StoredSession,input:RequestInfo|URL,init:RequestInit={}){
  let current=getStoredSession()||session;
  const renew=async()=>{
    try{return await refreshSession(current)}catch(error){
      expireSession();
      throw error instanceof Error?error:new Error('Your session expired. Please sign in again.');
    }
  };
  if(!current.refreshToken){
    expireSession();
    throw new Error('Your session expired. Please sign in again.');
  }
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
  return response;
}

export async function requestPasswordReset(email:string,redirectTo:string){const response=await fetch(`${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,{method:'POST',headers:headers(),body:JSON.stringify({email})});if(!response.ok){const data=await response.json();throw new Error(data?.msg||data?.error_description||'Could not send reset email')}}
export async function updateRecoveredPassword(accessToken:string,password:string){const response=await fetch(`${supabaseUrl}/auth/v1/user`,{method:'PUT',headers:headers(accessToken),body:JSON.stringify({password})});if(!response.ok){const data=await response.json();throw new Error(data?.msg||data?.error_description||'Could not update password')}}

export async function updateAccountName(session:StoredSession,displayName:string){
  const name=displayName.trim();
  if(name.length<2)throw new Error('Name must contain at least 2 characters.');
  const authResponse=await authenticatedFetch(session,`${supabaseUrl}/auth/v1/user`,{method:'PUT',headers:headers(session.accessToken),body:JSON.stringify({data:{display_name:name}})});
  if(!authResponse.ok){const data=await authResponse.json();throw new Error(data?.msg||data?.error_description||'Could not update account name')}
  const profileResponse=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}`,{method:'PATCH',headers:{...headers(session.accessToken),Prefer:'return=minimal'},body:JSON.stringify({display_name:name})});
  if(!profileResponse.ok){const data=await profileResponse.json();throw new Error(data?.message||'Could not update profile name')}
  const current=getStoredSession()||session;
  const updated:StoredSession={...current,user:{...current.user,displayName:name}};
  localStorage.setItem(sessionKey,JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent<StoredSession>(sessionUpdatedEvent,{detail:updated}));
  return updated;
}

export async function updateAccountPassword(session:StoredSession,password:string){
  if(password.length<8)throw new Error('Password must contain at least 8 characters.');
  const response=await authenticatedFetch(session,`${supabaseUrl}/auth/v1/user`,{method:'PUT',headers:headers(session.accessToken),body:JSON.stringify({password})});
  if(!response.ok){const data=await response.json();throw new Error(data?.msg||data?.error_description||'Could not update password')}
}

export function signOut() { localStorage.removeItem(sessionKey); }

async function accountEmailConfirmed(session:StoredSession){
  const response=await authenticatedFetch(session,`${supabaseUrl}/auth/v1/user`,{headers:headers(session.accessToken)});
  if(!response.ok)return false;
  const account=await response.json() as {email_confirmed_at?:string|null};
  return Boolean(account.email_confirmed_at);
}

function mapDeal(row: DealRow, sellerName: string, viewerId?: string, sellerContactVerified=false) {
  const viewerRole: Deal['viewerRole'] = viewerId ? (row.seller_id===viewerId?'seller':row.buyer_id===viewerId?'buyer':'visitor') : 'visitor';
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
    viewerRole,
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

export async function deleteDealMedia(session:StoredSession,dealId:string,publicUrl:string){const marker='/storage/v1/object/public/deal-media/';const encodedPath=publicUrl.split(marker)[1];if(!encodedPath)throw new Error('Invalid media URL');const path=encodedPath.split('/').map(decodeURIComponent).join('/');const removeObject=await authenticatedFetch(session,`${supabaseUrl}/storage/v1/object/deal-media/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'DELETE',headers:{apikey:publishableKey??'',Authorization:`Bearer ${session.accessToken}`}});if(!removeObject.ok)throw new Error('Could not remove the stored file');const removeRecord=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deal_media?deal_id=eq.${dealId}&storage_path=eq.${encodeURIComponent(path)}`,{method:'DELETE',headers:{...headers(session.accessToken),Prefer:'return=minimal'}});if(!removeRecord.ok)throw new Error('File removed, but its record could not be cleaned up')}
export async function reorderDealMedia(session:StoredSession,dealId:string,publicUrls:string[]){const marker='/storage/v1/object/public/deal-media/';const paths=publicUrls.map(url=>{const encoded=url.split(marker)[1];if(!encoded)throw new Error('Invalid media URL');return encoded.split('/').map(decodeURIComponent).join('/')});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/reorder_deal_media`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_paths:paths})});if(!response.ok){const data=await response.json();throw new Error(data?.message||'Could not reorder media')}}
export async function updatePublishedDeal(session:StoredSession,dealId:string,draft:DealDraft){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/update_published_deal`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_title:draft.title,p_description:draft.description,p_price_cents:toMinorUnits(draft.price,draft.currency),p_condition:draft.condition,p_delivery_method:draft.deliveryMethod})});if(!response.ok){const data=await response.json();throw new Error(data?.message||'Could not update deal')}return await response.json() as number}

export async function createUserDeal(session: StoredSession, draft: DealDraft) {
  const title = draft.title.trim();
  if (title.length < 3 || title.length > 120) {
    throw new Error('Item title must contain 3 to 120 characters.');
  }
  const serial = draft.serialNumber.trim();
  const response = await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deals`, {
    method: 'POST',
    headers: { ...headers(session.accessToken), Prefer: 'return=representation' },
    body: JSON.stringify({
      seller_id: session.user.id,
      title,
      description: draft.description,
      price_cents: toMinorUnits(draft.price, draft.currency),
      currency: draft.currency,
      condition: draft.condition,
      serial_last_four: serial ? serial.slice(-4) : null,
      delivery_method: draft.deliveryMethod,
      status: 'published',
      current_agreement_version: 1,
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now()+(draft.expiresInDays||7)*24*60*60*1000).toISOString(),
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = String(data?.message || '');
    if (message.includes('deals_title_check')) {
      throw new Error('Item title must contain 3 to 120 characters.');
    }
    throw new Error(message || 'Could not save this deal');
  }
  return mapDeal((data as DealRow[])[0], session.user.displayName, session.user.id, await accountEmailConfirmed(session));
}

export async function saveUserDealDraft(session:StoredSession,draft:DealDraft){
  const title=draft.title.trim();
  if(title.length<3||title.length>120)throw new Error('Item title must contain 3 to 120 characters.');
  const serial=draft.serialNumber.trim();
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deals`,{method:'POST',headers:{...headers(session.accessToken),Prefer:'return=representation'},body:JSON.stringify({seller_id:session.user.id,title,description:draft.description.trim(),price_cents:toMinorUnits(draft.price,draft.currency),currency:draft.currency,condition:draft.condition,serial_last_four:serial?serial.slice(-4):null,delivery_method:draft.deliveryMethod,status:'draft',current_agreement_version:0,published_at:null,expires_at:new Date(Date.now()+(draft.expiresInDays||7)*24*60*60*1000).toISOString()})});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.message||'Could not save draft');
  return mapDeal((data as DealRow[])[0],session.user.displayName,session.user.id,await accountEmailConfirmed(session));
}

export async function updateUserDealDraft(session:StoredSession,dealId:string,draft:DealDraft){
  const title=draft.title.trim();
  if(title.length<3||title.length>120)throw new Error('Item title must contain 3 to 120 characters.');
  const serial=draft.serialNumber.trim();
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deals?id=eq.${encodeURIComponent(dealId)}&seller_id=eq.${session.user.id}&status=eq.draft`,{method:'PATCH',headers:{...headers(session.accessToken),Prefer:'return=representation'},body:JSON.stringify({title,description:draft.description.trim(),price_cents:toMinorUnits(draft.price,draft.currency),currency:draft.currency,condition:draft.condition,serial_last_four:serial?serial.slice(-4):null,delivery_method:draft.deliveryMethod,expires_at:new Date(Date.now()+(draft.expiresInDays||7)*24*60*60*1000).toISOString(),updated_at:new Date().toISOString()})});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.message||'Could not update draft');
  if(!(data as DealRow[])[0])throw new Error('Draft was not found');
  return mapDeal((data as DealRow[])[0],session.user.displayName,session.user.id,await accountEmailConfirmed(session));
}

export async function publishUserDealDraft(session:StoredSession,dealId:string,draft:DealDraft){
  const title=draft.title.trim();
  if(title.length<3||title.length>120)throw new Error('Item title must contain 3 to 120 characters.');
  const serial=draft.serialNumber.trim();const now=new Date().toISOString();
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deals?id=eq.${encodeURIComponent(dealId)}&seller_id=eq.${session.user.id}&status=eq.draft`,{method:'PATCH',headers:{...headers(session.accessToken),Prefer:'return=representation'},body:JSON.stringify({title,description:draft.description.trim(),price_cents:toMinorUnits(draft.price,draft.currency),currency:draft.currency,condition:draft.condition,serial_last_four:serial?serial.slice(-4):null,delivery_method:draft.deliveryMethod,status:'published',current_agreement_version:1,published_at:now,expires_at:new Date(Date.now()+(draft.expiresInDays||7)*24*60*60*1000).toISOString(),updated_at:now})});
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
export async function requestIdentityVerification(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/request_identity_verification`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not request verification')}return await response.json() as ProfileSummary['verification_status']}
export async function cancelDeal(session:StoredSession,dealId:string,reason:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/cancel_deal`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_reason:reason})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not cancel deal')}}
export async function openDealDispute(session:StoredSession,dealId:string,reason:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/open_deal_dispute`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_reason:reason})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not open dispute')}}
export async function reportPublicDeal(session:StoredSession,publicId:string,category:string,details:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/report_public_deal`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_public_id:publicId,p_category:category,p_details:details.trim()})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not submit report')}return await response.json() as string}
export async function getAdminAccess(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/is_dealsafe_admin`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok)return false;return Boolean(await response.json())}
export async function getAdminReports(session:StoredSession,status:'open'|'reviewed'|'dismissed'|'all'='open'){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_admin_reports`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_status:status})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load report queue')}return await response.json() as AdminReport[]}
export async function resolveAdminReport(session:StoredSession,reportId:string,decision:'reviewed'|'dismissed',note:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/resolve_deal_report`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_report_id:reportId,p_decision:decision,p_resolution_note:note.trim()})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not save report decision')}}
export async function setAdminDealVisibility(session:StoredSession,dealId:string,status:'visible'|'hidden',note:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_deal_moderation_status`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_status:status,p_note:note.trim()})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not update Deal Link visibility')}}
export async function getDealRiskAssessment(publicId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_deal_risk_assessment`,{method:'POST',headers:headers(),body:JSON.stringify({p_public_id:publicId})});if(!response.ok)throw new Error('Risk check is unavailable');return ((await response.json()) as RiskAssessment[])[0]||null}
export async function getPublicSellerTrustProfile(publicId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_seller_trust_profile`,{method:'POST',headers:headers(),body:JSON.stringify({p_public_id:publicId})});if(!response.ok)throw new Error('Seller trust profile is unavailable');return ((await response.json()) as PublicTrustProfile[])[0]||null}
export async function getTrustPassportSettings(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_my_trust_passport_settings`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load passport settings')}const rows=await response.json() as TrustPassportSettings[];if(!rows[0])throw new Error('Profile was not found');return rows[0]}
export async function setTrustPassportEnabled(session:StoredSession,enabled:boolean){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_trust_passport_enabled`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_enabled:enabled})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not update passport settings')}return await response.json() as string}
export async function getPublicTrustPassport(publicId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_trust_passport`,{method:'POST',headers:headers(),body:JSON.stringify({p_public_id:publicId})});if(!response.ok)throw new Error('Passport unavailable');return ((await response.json()) as TrustPassport[])[0]||null}
export async function isDealSaved(session:StoredSession,publicId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/is_deal_saved`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_public_id:publicId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not check saved deal')}return Boolean(await response.json())}
export async function setDealSaved(session:StoredSession,publicId:string,saved:boolean){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_deal_saved`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_public_id:publicId,p_saved:saved})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not update saved deal')}return Boolean(await response.json())}
export async function getDealInspection(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_inspection`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load inspection receipt')}return ((await response.json()) as DealInspection[])[0]||null}
export async function recordDealInspection(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/record_deal_inspection`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_item_reviewed:true,p_price_confirmed:true,p_handoff_confirmed:true,p_reference_checked:true})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not save inspection receipt')}}
export async function getDealTimeline(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_timeline`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load timeline')}return await response.json() as TimelineEvent[]}
export async function getMyNotifications(session:StoredSession){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_my_notifications`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_limit:12})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load notifications')}return await response.json() as DealNotification[]}
export async function getDealMessages(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_messages`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load messages')}return await response.json() as DealMessage[]}
export async function sendDealMessage(session:StoredSession,dealId:string,body:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/send_deal_message`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_body:body})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not send message')}}
export async function makeDealOffer(session:StoredSession,publicId:string,amountCents:number,typedName:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/make_deal_offer`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_public_id:publicId,p_amount_cents:amountCents,p_typed_name:typedName})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not send offer')}}
export async function getDealOffers(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_offers`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load offers')}return await response.json() as DealOffer[]}
export async function respondToOffer(session:StoredSession,offerId:string,accept:boolean){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/respond_to_offer`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_offer_id:offerId,p_accept:accept})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not respond to offer')}}
export async function getDealShipment(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deal_shipments?deal_id=eq.${dealId}&select=*`,{headers:headers(session.accessToken)});if(!response.ok)throw new Error('Could not load shipment');return ((await response.json()) as DealShipment[])[0]||null}
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
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_deal`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ p_public_id: publicId }),
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

export async function acceptPublicDeal(session: StoredSession, publicId: string, typedName: string) {
  const response = await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/accept_deal`, {
    method: 'POST', headers: headers(session.accessToken),
    body: JSON.stringify({ p_public_id: publicId, p_typed_name: typedName }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data?.message || 'Could not accept this deal');
  }
}

export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabaseUrl || !publishableKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/deals?select=id&limit=1`, {
      headers: headers(),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Authenticated CRUD is added after sign-up and the remaining RLS policies are ready.
