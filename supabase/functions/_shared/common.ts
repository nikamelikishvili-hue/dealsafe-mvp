import { createClient, type User } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function requiredSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function siteUrl() {
  const configured = Deno.env.get("SITE_URL") || "https://dealivra.com";
  return configured.replace(/\/$/, "");
}

export function adminClient() {
  return createClient(
    requiredSecret("SUPABASE_URL"),
    requiredSecret("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

type VerifiedUserSession = {
  user: User;
  sessionId: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Your session is invalid or expired");
  try {
    const normalized = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - normalized.length % 4) % 4);
    const payload = JSON.parse(atob(normalized + padding));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid token payload");
    }
    return payload as Record<string, unknown>;
  } catch {
    throw new Error("Your session is invalid or expired");
  }
}

export async function requireActiveUserSession(request: Request): Promise<VerifiedUserSession> {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new Error("Sign in is required");

  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Your session is invalid or expired");

  const claims = decodeJwtPayload(token);
  const sessionId = typeof claims.session_id === "string" ? claims.session_id : "";
  const subject = typeof claims.sub === "string" ? claims.sub : "";
  const role = typeof claims.role === "string" ? claims.role : "";
  if (!sessionId || subject !== data.user.id || role !== "authenticated") {
    throw new Error("Your session is invalid or expired");
  }

  const { data: sessionActive, error: sessionError } = await admin.rpc(
    "is_auth_session_active_for_service",
    { p_user_id: data.user.id, p_session_id: sessionId },
  );
  if (sessionError || sessionActive !== true) {
    throw new Error("Your session is invalid or expired");
  }

  return { user: data.user, sessionId };
}

export async function requireUser(request: Request): Promise<User> {
  return (await requireActiveUserSession(request)).user;
}

type StripeRequestOptions = {
  method?: "GET" | "POST";
  params?: URLSearchParams;
  idempotencyKey?: string;
};

export async function stripeRequest<T>(path: string, options: StripeRequestOptions = {}): Promise<T> {
  const secretKey = requiredSecret("STRIPE_SECRET_KEY");
  if (!secretKey.startsWith("sk_test_")) {
    throw new Error("Dealivra beta requires a Stripe Sandbox secret key");
  }
  const method = options.method || "POST";
  const headers = new Headers({ Authorization: `Bearer ${secretKey}` });
  if (method === "POST") headers.set("Content-Type", "application/x-www-form-urlencoded");
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers,
    body: method === "POST" ? options.params?.toString() || "" : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || `Stripe request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  const status = /sign in is required|session is invalid or expired/i.test(message)
    ? 401
    : /required|invalid|expired|Only |unavailable|must |not ready/i.test(message)
    ? 400
    : 500;
  return json({ error: message }, status);
}

