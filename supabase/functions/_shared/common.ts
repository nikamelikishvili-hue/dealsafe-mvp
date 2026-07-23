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
  const configured = Deno.env.get("SITE_URL") || "https://dealsafe-mvp.vercel.app";
  return configured.replace(/\/$/, "");
}

export function adminClient() {
  return createClient(
    requiredSecret("SUPABASE_URL"),
    requiredSecret("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function requireUser(request: Request): Promise<User> {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new Error("Sign in is required");
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new Error("Your session is invalid or expired");
  return data.user;
}

type StripeRequestOptions = {
  method?: "GET" | "POST";
  params?: URLSearchParams;
  idempotencyKey?: string;
};

export async function stripeRequest<T>(path: string, options: StripeRequestOptions = {}): Promise<T> {
  const secretKey = requiredSecret("STRIPE_SECRET_KEY");
  if (!secretKey.startsWith("sk_test_")) {
    throw new Error("DealSafe beta requires a Stripe Sandbox secret key");
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
  const status = /required|invalid|expired|Only |unavailable|must |not ready/i.test(message) ? 400 : 500;
  return json({ error: message }, status);
}

