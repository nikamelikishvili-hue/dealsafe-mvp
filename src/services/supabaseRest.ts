import type { Deal, DealDraft } from '../domain';

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

interface DealRow {
  id: string; public_id: string; title: string; description: string;
  price_cents: number; currency: 'USD'; condition: 'Like new' | 'Good' | 'Fair';
  serial_last_four: string | null; delivery_method: 'Meet in person' | 'Ship to buyer';
  status: 'draft' | 'published' | 'accepted' | 'completed' | 'cancelled' | 'disputed';
  current_agreement_version: number; created_at: string;
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

function storeSession(data:AuthResponse,user:AuthUser){const session:StoredSession={accessToken:data.access_token!,refreshToken:data.refresh_token,expiresAt:Date.now()+(data.expires_in||3600)*1000,user};localStorage.setItem(sessionKey,JSON.stringify(session));return session}

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
  try { return JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch { return null; }
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
  if(!session.refreshToken)return session;
  const response=await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:headers(),body:JSON.stringify({refresh_token:session.refreshToken})});
  const data=await response.json() as AuthResponse;
  if(!response.ok||!data.access_token)throw new Error(data.error_description||data.msg||'Session expired');
  return storeSession(data,toUser(data)||session.user);
}

export function signOut() { localStorage.removeItem(sessionKey); }

function mapDeal(row: DealRow, sellerName: string, viewerId?: string) {
  const viewerRole: Deal['viewerRole'] = viewerId ? (row.seller_id===viewerId?'seller':row.buyer_id===viewerId?'buyer':'visitor') : 'visitor';
  return {
    id: row.id, publicId: row.public_id, title: row.title, description: row.description,
    priceCents: row.price_cents, currency: row.currency, condition: row.condition,
    serialNumber: row.serial_last_four ? `•••• ${row.serial_last_four}` : undefined,
    deliveryMethod: row.delivery_method, status: row.status, sellerName,
    sellerVerification: 'not_started' as const,
    agreementVersion: Math.max(1, row.current_agreement_version), createdAt: row.created_at,
    mediaUrls: (row.deal_media || []).sort((a,b)=>a.sort_order-b.sort_order).map(item=>publicMediaUrl(item.storage_path)),
    viewerRole,
  };
}

export async function listUserDeals(session: StoredSession) {
  const response = await fetch(`${supabaseUrl}/rest/v1/deals?select=*,deal_media(storage_path,sort_order)&order=created_at.desc`, {
    headers: headers(session.accessToken),
  });
  if (!response.ok) throw new Error('Could not load your deals');
  const rows = await response.json() as DealRow[];
  return rows.map(row => mapDeal(row, session.user.displayName, session.user.id));
}

function publicMediaUrl(path: string) {
  return `${supabaseUrl}/storage/v1/object/public/deal-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export async function uploadDealPhotos(session: StoredSession, dealId: string, files: File[]) {
  const urls: string[] = [];
  for (let index=0; index<files.length; index++) {
    const file=files[index];
    const extension=file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path=`${session.user.id}/${dealId}/${crypto.randomUUID()}.${extension}`;
    const upload=await fetch(`${supabaseUrl}/storage/v1/object/deal-media/${path}`,{method:'POST',headers:{apikey:publishableKey??'',Authorization:`Bearer ${session.accessToken}`,'Content-Type':file.type||'image/jpeg','x-upsert':'false'},body:file});
    if(!upload.ok) throw new Error(`Photo ${index+1} could not be uploaded`);
    const record=await fetch(`${supabaseUrl}/rest/v1/deal_media`,{method:'POST',headers:{...headers(session.accessToken),Prefer:'return=minimal'},body:JSON.stringify({deal_id:dealId,storage_path:path,sort_order:index})});
    if(!record.ok) throw new Error(`Photo ${index+1} could not be linked to the deal`);
    urls.push(publicMediaUrl(path));
  }
  return urls;
}

export async function createUserDeal(session: StoredSession, draft: DealDraft) {
  const serial = draft.serialNumber.trim();
  const response = await fetch(`${supabaseUrl}/rest/v1/deals`, {
    method: 'POST',
    headers: { ...headers(session.accessToken), Prefer: 'return=representation' },
    body: JSON.stringify({
      seller_id: session.user.id,
      title: draft.title,
      description: draft.description,
      price_cents: Math.round(Number(draft.price) * 100),
      currency: 'USD',
      condition: draft.condition,
      serial_last_four: serial ? serial.slice(-4) : null,
      delivery_method: draft.deliveryMethod,
      status: 'published',
      current_agreement_version: 1,
      published_at: new Date().toISOString(),
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Could not save this deal');
  return mapDeal((data as DealRow[])[0], session.user.displayName, session.user.id);
}

export interface DealMeeting { id:string; deal_id:string; proposed_by:string; location_name:string; address:string; scheduled_at:string; status:'proposed'|'confirmed'|'cancelled'; seller_arrived:boolean; buyer_arrived:boolean }

export async function getDealMeeting(session: StoredSession, dealId: string) {
  const response=await fetch(`${supabaseUrl}/rest/v1/deal_meetings?deal_id=eq.${dealId}&select=*`,{headers:headers(session.accessToken)});
  if(!response.ok) throw new Error('Could not load meeting');
  return ((await response.json()) as DealMeeting[])[0] || null;
}

export async function proposeMeeting(session:StoredSession,dealId:string,locationName:string,address:string,scheduledAt:string){
  const response=await fetch(`${supabaseUrl}/rest/v1/rpc/propose_meeting`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_location_name:locationName,p_address:address,p_scheduled_at:new Date(scheduledAt).toISOString()})});
  if(!response.ok){const data=await response.json();throw new Error(data?.message||'Could not propose meeting')}
}
export async function confirmMeeting(session:StoredSession,dealId:string){
  const response=await fetch(`${supabaseUrl}/rest/v1/rpc/confirm_meeting`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});
  if(!response.ok){const data=await response.json();throw new Error(data?.message||'Could not confirm meeting')}
}
export async function markArrived(session:StoredSession,dealId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/mark_arrived`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not mark arrival')}}
export async function generateHandoffPin(session:StoredSession,dealId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/generate_handoff_pin`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not generate PIN')}return await response.json() as string}
export async function completeHandoff(session:StoredSession,dealId:string,pin:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/complete_handoff`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_pin:pin})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not complete deal')}}
export async function submitRating(session:StoredSession,dealId:string,stars:number,comment:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/submit_rating`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_stars:stars,p_comment:comment})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not submit rating')}}
export async function getMyProfileSummary(session:StoredSession){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_my_profile_summary`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load profile')}const rows=await response.json() as ProfileSummary[];if(!rows[0])throw new Error('Profile was not found');return rows[0]}
export async function requestIdentityVerification(session:StoredSession){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/request_identity_verification`,{method:'POST',headers:headers(session.accessToken),body:'{}'});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not request verification')}return await response.json() as ProfileSummary['verification_status']}
export async function cancelDeal(session:StoredSession,dealId:string,reason:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/cancel_deal`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_reason:reason})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not cancel deal')}}
export async function openDealDispute(session:StoredSession,dealId:string,reason:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/open_deal_dispute`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_reason:reason})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not open dispute')}}
export async function getDealTimeline(session:StoredSession,dealId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_deal_timeline`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load timeline')}return await response.json() as TimelineEvent[]}
export async function getMyNotifications(session:StoredSession){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_my_notifications`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_limit:12})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load notifications')}return await response.json() as DealNotification[]}
export async function getDealMessages(session:StoredSession,dealId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_deal_messages`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load messages')}return await response.json() as DealMessage[]}
export async function sendDealMessage(session:StoredSession,dealId:string,body:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/send_deal_message`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_body:body})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not send message')}}
export async function makeDealOffer(session:StoredSession,publicId:string,amountCents:number,typedName:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/make_deal_offer`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_public_id:publicId,p_amount_cents:amountCents,p_typed_name:typedName})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not send offer')}}
export async function getDealOffers(session:StoredSession,dealId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_deal_offers`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not load offers')}return await response.json() as DealOffer[]}
export async function respondToOffer(session:StoredSession,offerId:string,accept:boolean){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/respond_to_offer`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_offer_id:offerId,p_accept:accept})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not respond to offer')}}
export async function getDealShipment(session:StoredSession,dealId:string){const response=await fetch(`${supabaseUrl}/rest/v1/deal_shipments?deal_id=eq.${dealId}&select=*`,{headers:headers(session.accessToken)});if(!response.ok)throw new Error('Could not load shipment');return ((await response.json()) as DealShipment[])[0]||null}
export async function createDealShipment(session:StoredSession,dealId:string,carrier:string,trackingNumber:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/create_deal_shipment`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId,p_carrier:carrier,p_tracking_number:trackingNumber})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not save shipment')}}
export async function confirmShipmentDelivery(session:StoredSession,dealId:string){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/confirm_shipment_delivery`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_deal_id:dealId})});if(!response.ok){const d=await response.json();throw new Error(d?.message||'Could not confirm delivery')}}

interface PublicDealRow extends DealRow {
  agreement_version: number;
  seller_name: string;
  seller_verification: 'not_started' | 'pending' | 'verified';
  media_paths: string[];
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
    sellerVerification: row.seller_verification,
    mediaUrls: (row.media_paths || []).map(publicMediaUrl),
  };
}

export async function acceptPublicDeal(session: StoredSession, publicId: string, typedName: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/accept_deal`, {
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
