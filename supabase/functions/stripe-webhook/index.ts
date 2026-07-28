import { adminClient, json, requiredSecret } from "../_shared/common.ts";

type StripeEvent = {
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  data: { object: Record<string, unknown> };
};

type ClaimResult = {
  disposition: "claimed" | "processed" | "in_progress";
  claimToken?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providerIdPattern = /^[a-z][a-z0-9_]{2,63}$/i;
const maxWebhookBytes = 262_144;

async function verifyStripeSignature(payload: string, header: string, secret: string) {
  if (!header || header.length > 4096) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  if (parts.length > 20) return false;
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || timestampNumber <= 0) return false;
  if (Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  const expected = Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return signatures.some((signature) => {
    if (signature.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
      difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
    }
    return difference === 0;
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown, pattern?: RegExp) {
  if (typeof value !== "string" || value.length > 255) return null;
  return !pattern || pattern.test(value) ? value : null;
}

function safeFailure(object: Record<string, unknown>) {
  const error = record(object.last_payment_error);
  const code = stringValue(error.code, /^[a-z0-9_]{1,64}$/) || "payment_failed";
  const messages: Record<string, string> = {
    card_declined: "The card was declined. Try another payment method.",
    expired_card: "The card has expired. Try another payment method.",
    incorrect_cvc: "The card security code was not accepted.",
    insufficient_funds: "The payment could not be completed. Try another payment method.",
    processing_error: "The payment processor could not complete the payment. Please try again.",
  };
  return {
    code,
    message: messages[code] || "The payment was not completed. Please try again or use another payment method.",
  };
}

function references(event: StripeEvent) {
  const object = event.data.object;
  const metadata = record(object.metadata);
  const dealId = stringValue(metadata.deal_id, uuidPattern);
  const objectId = stringValue(object.id, providerIdPattern);
  const paymentIntent = typeof object.payment_intent === "string"
    ? stringValue(object.payment_intent, /^pi_[A-Za-z0-9_]{8,255}$/)
    : event.type.startsWith("payment_intent.")
    ? stringValue(object.id, /^pi_[A-Za-z0-9_]{8,255}$/)
    : null;
  const latestCharge = typeof object.latest_charge === "string"
    ? stringValue(object.latest_charge, /^ch_[A-Za-z0-9_]{8,255}$/)
    : null;

  return {
    dealId,
    checkoutSessionId: event.type.startsWith("checkout.session.")
      ? stringValue(objectId, /^cs_[A-Za-z0-9_]{8,255}$/)
      : null,
    paymentIntentId: paymentIntent,
    chargeId: event.type.startsWith("charge.")
      ? stringValue(objectId, /^ch_[A-Za-z0-9_]{8,255}$/)
      : latestCharge,
    paymentStatus: stringValue(object.payment_status, /^[a-z_]{1,32}$/),
    failure: safeFailure(object),
  };
}

function webhookError(status = 500) {
  return json({ error: "Webhook processing failed" }, status);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > maxWebhookBytes) {
    return json({ error: "Request is too large" }, 413);
  }
  let eventId: string | null = null;
  let claimToken: string | null = null;
  try {
    const payload = await request.text();
    if (new TextEncoder().encode(payload).byteLength > maxWebhookBytes) {
      return json({ error: "Request is too large" }, 413);
    }
    const signature = request.headers.get("Stripe-Signature") || "";
    if (!await verifyStripeSignature(payload, signature, requiredSecret("STRIPE_WEBHOOK_SECRET"))) {
      return json({ error: "Invalid Stripe signature" }, 400);
    }
    const event = JSON.parse(payload) as StripeEvent;
    if (
      !event
      || typeof event !== "object"
      || !/^evt_[A-Za-z0-9_]{8,255}$/.test(event.id || "")
      || !/^[a-z0-9_.]{1,100}$/.test(event.type || "")
      || !Number.isSafeInteger(event.created)
      || event.created <= 0
      || typeof event.livemode !== "boolean"
      || !event.data
      || typeof event.data.object !== "object"
    ) {
      return webhookError(400);
    }
    if (event.livemode) return webhookError(400);

    const admin = adminClient();
    eventId = event.id;
    const { data: claim, error: claimError } = await admin.rpc("claim_stripe_webhook_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_stripe_created_at: new Date(event.created * 1000).toISOString(),
      p_livemode: event.livemode,
      p_lease_seconds: 300,
    });
    if (claimError || !claim) return webhookError();

    const claimed = claim as ClaimResult;
    if (claimed.disposition === "processed") {
      return json({ received: true, duplicate: true });
    }
    if (claimed.disposition === "in_progress") {
      return json({ error: "Webhook is already being processed" }, 409);
    }
    claimToken = claimed.claimToken || null;
    if (!claimToken || !uuidPattern.test(claimToken)) return webhookError();

    const refs = references(event);
    const { data: applied, error: applyError } = await admin.rpc("apply_stripe_webhook_event", {
      p_event_id: event.id,
      p_claim_token: claimToken,
      p_event_type: event.type,
      p_deal_id: refs.dealId,
      p_checkout_session_id: refs.checkoutSessionId,
      p_payment_intent_id: refs.paymentIntentId,
      p_charge_id: refs.chargeId,
      p_payment_status: refs.paymentStatus,
      p_failure_code: refs.failure.code,
      p_failure_message: refs.failure.message,
    });
    if (applyError || !applied) {
      await admin.rpc("fail_stripe_webhook_event", {
        p_event_id: event.id,
        p_claim_token: claimToken,
        p_error_code: applyError?.code === "P0002" ? "payment_reference_not_found" : "apply_failed",
      });
      return webhookError();
    }

    return json({ received: true, outcome: (applied as { outcome?: string }).outcome || "processed" });
  } catch {
    if (eventId && claimToken) {
      try {
        await adminClient().rpc("fail_stripe_webhook_event", {
          p_event_id: eventId,
          p_claim_token: claimToken,
          p_error_code: "unhandled_failure",
        });
      } catch {
        // The lease permits a later Stripe retry even if failure recording is unavailable.
      }
    }
    return webhookError();
  }
});
