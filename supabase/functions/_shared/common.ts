import { createClient, type User } from "npm:@supabase/supabase-js@2";
import {
  correlationHeader,
  type PaymentOperationContext,
  paymentError,
  paymentErrorResponse,
  stripeNetworkError,
  stripeProviderError,
  withPaymentCorrelation,
} from "./payment-observability.ts";
import {
  paymentCapabilityDecision,
  type PaymentCapability,
} from "./payment-mode.ts";
import {
  PaymentJsonBoundaryError,
  readBoundedPaymentJson,
} from "./payment-json-boundary.ts";
import {
  StripeResponseBoundaryError,
  readBoundedStripeJson,
} from "./stripe-response-boundary.ts";

const browserRequestHeaders = new Set([
  "apikey",
  "authorization",
  "content-type",
  "x-client-info",
  "x-supabase-api-version",
]);

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

export function requiredSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function requireSandboxPaymentCapability(capability: PaymentCapability) {
  const decision = paymentCapabilityDecision(
    capability,
    name => Deno.env.get(name),
  );
  if (decision.allowed) return;

  throw paymentError(
    decision.code || "payment_configuration_invalid",
    decision.mode === "disabled"
      ? "This payment action is temporarily unavailable."
      : "Secure payments are temporarily unavailable.",
    503,
  );
}

export async function readPaymentJson<T extends Record<string, unknown>>(
  request: Request,
  allowedKeys: readonly string[],
): Promise<T> {
  try {
    return await readBoundedPaymentJson(request, allowedKeys) as T;
  } catch (error) {
    if (error instanceof PaymentJsonBoundaryError) {
      throw paymentError(
        "payment_request_invalid",
        "The payment request is invalid.",
        error.code === "body_too_large" ? 413 : 400,
      );
    }
    throw error;
  }
}

export function siteUrl() {
  const configured = Deno.env.get("SITE_URL") || "https://dealivra.com";
  return configured.replace(/\/$/, "");
}

function exactBrowserOrigins() {
  const origins = new Set(["https://dealivra.com", "https://www.dealivra.com"]);
  const configured = [siteUrl(), ...(Deno.env.get("DEALIVRA_ALLOWED_ORIGINS") || "").split(",")];

  for (const value of configured) {
    try {
      const parsed = new URL(value.trim());
      if (parsed.protocol === "https:" && parsed.origin === value.trim().replace(/\/$/, "")) {
        origins.add(parsed.origin);
      }
    } catch {
      // Invalid configuration is ignored so it cannot broaden the allowlist.
    }
  }
  return origins;
}

function isOwnedVercelPreview(origin: URL) {
  const project = (Deno.env.get("DEALIVRA_VERCEL_PROJECT_SLUG") || "dealsafe").trim().toLowerCase();
  const team = (Deno.env.get("DEALIVRA_VERCEL_TEAM_SLUG") || "nika13").trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(project) || !/^[a-z0-9-]+$/.test(team)) return false;

  const prefix = `${project}-`;
  const suffix = `-${team}.vercel.app`;
  const hostname = origin.hostname.toLowerCase();
  return origin.protocol === "https:"
    && origin.port === ""
    && hostname.startsWith(prefix)
    && hostname.endsWith(suffix)
    && hostname.length > prefix.length + suffix.length;
}

function allowedBrowserOrigin(request: Request) {
  const value = request.headers.get("Origin")?.trim();
  if (!value || value === "null") return null;
  try {
    const parsed = new URL(value);
    if (parsed.origin !== value || parsed.username || parsed.password) return null;
    if (exactBrowserOrigins().has(parsed.origin) || isOwnedVercelPreview(parsed)) {
      return parsed.origin;
    }
  } catch {
    // Malformed origins fail closed.
  }
  return null;
}

function appendVaryOrigin(headers: Headers) {
  const values = (headers.get("Vary") || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!values.some((value) => value.toLowerCase() === "origin")) values.push("Origin");
  headers.set("Vary", values.join(", "));
}

function withBrowserCors(response: Response, origin: string) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Expose-Headers", correlationHeader);
  appendVaryOrigin(headers);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function deniedBrowserRequest(message = "Request origin is not allowed") {
  const response = json({ error: message }, 403);
  const headers = new Headers(response.headers);
  appendVaryOrigin(headers);
  return new Response(response.body, { status: response.status, headers });
}

export async function handleBrowserRequest(
  request: Request,
  handler: () => Promise<Response> | Response,
  context?: PaymentOperationContext,
) {
  const origin = allowedBrowserOrigin(request);
  if (!origin) {
    const response = deniedBrowserRequest();
    return context ? withPaymentCorrelation(response, context) : response;
  }

  if (request.method === "OPTIONS") {
    if (request.headers.get("Access-Control-Request-Method")?.toUpperCase() !== "POST") {
      const response = deniedBrowserRequest("Requested method is not allowed");
      return context ? withPaymentCorrelation(response, context) : response;
    }
    const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") || "")
      .split(",")
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);
    if (requestedHeaders.some((header) => !browserRequestHeaders.has(header))) {
      const response = deniedBrowserRequest("Requested headers are not allowed");
      return context ? withPaymentCorrelation(response, context) : response;
    }
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": [...browserRequestHeaders].join(", "),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Expose-Headers": correlationHeader,
        "Access-Control-Max-Age": "600",
        "Cache-Control": "no-store",
        ...(context ? { [correlationHeader]: context.correlationId } : {}),
        "Vary": "Origin",
      },
    });
  }

  const response = await handler();
  return withBrowserCors(context ? withPaymentCorrelation(response, context) : response, origin);
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
  assuranceLevel: "aal1" | "aal2";
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
  const assuranceLevel = claims.aal === "aal2" ? "aal2" : "aal1";
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

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("app_role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) throw new Error("Your session is invalid or expired");

  const verifiedFactor = data.user.factors?.some((factor) => factor.status === "verified") === true;
  const privilegedRole = ["support", "compliance", "admin"].includes(profile?.app_role || "");
  if ((verifiedFactor || privilegedRole) && assuranceLevel !== "aal2") {
    throw new Error("Multi-factor verification is required");
  }

  return { user: data.user, sessionId, assuranceLevel };
}

export async function requireUser(request: Request): Promise<User> {
  return (await requireActiveUserSession(request)).user;
}

type SensitiveChangeScope = "payout" | "email" | "mfa";

function sensitiveChangeProtectionMode() {
  const mode = (Deno.env.get("DEALIVRA_RECOVERY_CONTROL_MODE") || "staged")
    .trim()
    .toLowerCase();
  if (mode !== "staged" && mode !== "enforced") {
    throw paymentError(
      "recovery_protection_unavailable",
      "Account recovery protection is temporarily unavailable.",
      503,
    );
  }
  return mode;
}

export async function requireSensitiveChangeAllowedForService(
  userId: string,
  scope: SensitiveChangeScope,
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    || !["payout", "email", "mfa"].includes(scope)
  ) {
    throw paymentError(
      "sensitive_change_request_invalid",
      "The sensitive account change request is invalid.",
      400,
    );
  }
  if (sensitiveChangeProtectionMode() === "staged") return;

  const { data, error } = await adminClient().rpc(
    "is_sensitive_change_allowed_for_service",
    { p_user_id: userId, p_scope: scope },
  );
  if (error) {
    throw paymentError(
      "recovery_protection_unavailable",
      "Account recovery protection is temporarily unavailable.",
      503,
    );
  }
  if (data !== true) {
    throw paymentError(
      "recovery_cooldown_active",
      "Payout changes are temporarily locked after account recovery.",
      423,
    );
  }
}

type StripeRequestOptions = {
  method?: "GET" | "POST";
  params?: URLSearchParams;
  idempotencyKey?: string;
  context?: PaymentOperationContext;
};

const stripeRequestTimeoutMs = 10_000;

export async function stripeRequest<T>(path: string, options: StripeRequestOptions = {}): Promise<T> {
  const secretKey = requiredSecret("STRIPE_SECRET_KEY");
  if (!secretKey.startsWith("sk_test_")) {
    throw new Error("Dealivra beta requires a Stripe Sandbox secret key");
  }
  const method = options.method || "POST";
  const headers = new Headers({ Authorization: `Bearer ${secretKey}` });
  if (method === "POST") headers.set("Content-Type", "application/x-www-form-urlencoded");
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
  let response: Response;
  try {
    response = await fetch(`https://api.stripe.com${path}`, {
      method,
      headers,
      body: method === "POST" ? options.params?.toString() || "" : undefined,
      signal: AbortSignal.timeout(stripeRequestTimeoutMs),
    });
  } catch {
    throw stripeNetworkError();
  }
  let data: Record<string, unknown> | null = null;
  try {
    data = await readBoundedStripeJson(response);
  } catch (error) {
    if (
      error instanceof DOMException
      && (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw stripeNetworkError();
    }
    if (response.ok || !(error instanceof StripeResponseBoundaryError)) {
      throw paymentError(
        "provider_response_invalid",
        "The payment provider returned an invalid response. Please try again later.",
        502,
      );
    }
  }
  if (!response.ok) {
    throw stripeProviderError(response, data);
  }
  return data as T;
}

export function errorResponse(
  error: unknown,
  context: PaymentOperationContext,
  details: {
    commandId?: string | null;
    dealId?: string | null;
    providerEventId?: string | null;
  } = {},
) {
  return paymentErrorResponse(context, error, details);
}

