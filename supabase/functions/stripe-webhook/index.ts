import { adminClient, errorResponse, json, requiredSecret } from "../_shared/common.ts";

type StripeEvent = { id: string; type: string; data: { object: Record<string, any> } };

async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  const expected = Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return signatures.some((signature) => signature.length === expected.length && signature.split("").every((character, index) => character === expected[index]));
}

async function secureFunds(dealId: string, paymentIntentId: string, chargeId: string | null) {
  const admin = adminClient();
  const now = new Date().toISOString();
  await admin.from("protected_payments").update({
    status: "funds_secured",
    payment_intent_id: paymentIntentId,
    charge_id: chargeId,
    paid_at: now,
    failure_message: null,
    updated_at: now,
  }).eq("deal_id", dealId).neq("status", "released");
  const { data: deal } = await admin.from("deals").select("seller_id,buyer_id").eq("id", dealId).single();
  if (deal?.seller_id && deal?.buyer_id) {
    await admin.from("deal_payment_records").upsert({
      deal_id: dealId,
      method: "card_invoice",
      proposed_by: deal.seller_id,
      buyer_confirmed_at: now,
      buyer_marked_sent_at: now,
      seller_marked_received_at: now,
      updated_at: now,
    }, { onConflict: "deal_id" });
    await admin.from("audit_events").insert({ deal_id: dealId, actor_id: deal.buyer_id, event_type: "payment_funds_secured" });
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const payload = await request.text();
    const signature = request.headers.get("Stripe-Signature") || "";
    if (!await verifyStripeSignature(payload, signature, requiredSecret("STRIPE_WEBHOOK_SECRET"))) {
      return json({ error: "Invalid Stripe signature" }, 400);
    }
    const event = JSON.parse(payload) as StripeEvent;
    const admin = adminClient();
    const { data: processed } = await admin.from("stripe_webhook_events").select("id").eq("id", event.id).maybeSingle();
    if (processed) return json({ received: true, duplicate: true });
    const object = event.data.object;

    if (event.type === "checkout.session.completed") {
      const dealId = object.metadata?.deal_id as string | undefined;
      if (dealId) {
        await admin.from("protected_payments").update({
          checkout_session_id: object.id,
          payment_intent_id: typeof object.payment_intent === "string" ? object.payment_intent : null,
          status: object.payment_status === "paid" ? "funds_secured" : "processing",
          updated_at: new Date().toISOString(),
        }).eq("deal_id", dealId);
        if (object.payment_status === "paid" && typeof object.payment_intent === "string") {
          await secureFunds(dealId, object.payment_intent, null);
        }
      }
    } else if (event.type === "checkout.session.expired") {
      await admin.from("protected_payments").update({ status: "expired", checkout_url: null, updated_at: new Date().toISOString() })
        .eq("checkout_session_id", object.id).eq("status", "checkout_created");
    } else if (event.type === "payment_intent.processing") {
      const dealId = object.metadata?.deal_id as string | undefined;
      if (dealId) await admin.from("protected_payments").update({ status: "processing", payment_intent_id: object.id, updated_at: new Date().toISOString() }).eq("deal_id", dealId);
    } else if (event.type === "payment_intent.succeeded") {
      const dealId = object.metadata?.deal_id as string | undefined;
      if (dealId) await secureFunds(dealId, object.id, typeof object.latest_charge === "string" ? object.latest_charge : null);
    } else if (event.type === "payment_intent.payment_failed") {
      const dealId = object.metadata?.deal_id as string | undefined;
      if (dealId) await admin.from("protected_payments").update({
        status: "failed",
        payment_intent_id: object.id,
        failure_message: object.last_payment_error?.message || "Payment failed",
        updated_at: new Date().toISOString(),
      }).eq("deal_id", dealId);
    } else if (event.type === "charge.dispute.created") {
      const paymentIntentId = typeof object.payment_intent === "string" ? object.payment_intent : "";
      const { data: payment } = await admin.from("protected_payments").update({ status: "disputed", disputed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("payment_intent_id", paymentIntentId).select("deal_id").maybeSingle();
      if (payment?.deal_id) await admin.from("deals").update({ status: "disputed", updated_at: new Date().toISOString() }).eq("id", payment.deal_id);
    } else if (event.type === "charge.refunded") {
      await admin.from("protected_payments").update({ status: "refunded", refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("charge_id", object.id);
    }

    await admin.from("stripe_webhook_events").insert({ id: event.id, event_type: event.type });
    return json({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
});

