const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey);

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface StoredSession { accessToken: string; user: AuthUser }

interface DealRow {
  id: string; public_id: string; title: string; description: string;
  price_cents: number; currency: 'USD'; condition: 'Like new' | 'Good' | 'Fair';
  serial_last_four: string | null; delivery_method: 'Meet in person' | 'Ship to buyer';
  status: 'draft' | 'published' | 'accepted' | 'completed';
  current_agreement_version: number; created_at: string;
}

interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  user?: { id: string; email?: string; user_metadata?: { display_name?: string } };
  msg?: string;
  error_description?: string;
}

const sessionKey = 'dealsafe_session';

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
    const session = { accessToken: data.access_token, user };
    localStorage.setItem(sessionKey, JSON.stringify(session));
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
  const session = { accessToken: data.access_token, user };
  localStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}

export function signOut() { localStorage.removeItem(sessionKey); }

function mapDeal(row: DealRow, sellerName: string) {
  return {
    id: row.id, publicId: row.public_id, title: row.title, description: row.description,
    priceCents: row.price_cents, currency: row.currency, condition: row.condition,
    serialNumber: row.serial_last_four ? `•••• ${row.serial_last_four}` : undefined,
    deliveryMethod: row.delivery_method, status: row.status, sellerName,
    sellerVerification: 'not_started' as const,
    agreementVersion: Math.max(1, row.current_agreement_version), createdAt: row.created_at,
  };
}

export async function listUserDeals(session: StoredSession) {
  const response = await fetch(`${supabaseUrl}/rest/v1/deals?select=*&order=created_at.desc`, {
    headers: headers(session.accessToken),
  });
  if (!response.ok) throw new Error('Could not load your deals');
  const rows = await response.json() as DealRow[];
  return rows.map(row => mapDeal(row, session.user.displayName));
}

export async function createUserDeal(session: StoredSession, draft: import('../domain').DealDraft) {
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
  return mapDeal((data as DealRow[])[0], session.user.displayName);
}

interface PublicDealRow extends DealRow {
  agreement_version: number;
  seller_name: string;
  seller_verification: 'not_started' | 'pending' | 'verified';
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
