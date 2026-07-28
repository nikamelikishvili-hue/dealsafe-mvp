import { adminClient, errorResponse, handleBrowserRequest, json, requireUser, stripeRequest } from "../_shared/common.ts";

type StripeTransfer = { id: string };

Deno.serve((request) => handleBrowserRequest(request, async () => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(request);
    const { dealId } = await request.json() as { dealId?: string };
    if (!dealId) throw new Error("Deal is required");
    const admin = adminClient();
    const { data: deal, error: dealError } = await admin
      .from("deals")
      .select("id,public_id,status,buyer_id,seller_id")
      .eq("id", dealId)
      .single();
    if (dealError || !deal) throw new Error("Deal was not found");
    if (deal.buyer_id !== user.id) throw new Error("Only the buyer can release payment after confirming delivery");
    if (deal.status !== "completed") throw new Error("Payment can be released only after the deal is completed");
    const { data: payment, error: paymentError } = await admin
      .from("protected_payments")
      .select("id,status,seller_stripe_account_id,seller_amount_cents,currency,payment_intent_id,charge_id,transfer_group,transfer_id")
      .eq("deal_id", deal.id)
      .single();
    if (paymentError || !payment) throw new Error("Protected payment was not found");
    if (payment.transfer_id && payment.status === "released") return json({ released: true, transferId: payment.transfer_id });
    if (payment.status !== "funds_secured" && payment.status !== "release_failed") throw new Error("Payment is not ready for release");
    let chargeId = payment.charge_id as string | null;
    if (!chargeId && payment.payment_intent_id) {
      const intent = await stripeRequest<{ latest_charge?: string | { id?: string } | null }>(
        `/v1/payment_intents/${encodeURIComponent(payment.payment_intent_id)}`,
        { method: "GET" },
      );
      chargeId = typeof intent.latest_charge === "string"
        ? intent.latest_charge
        : intent.latest_charge?.id || null;
      if (chargeId) {
        await admin.from("protected_payments").update({ charge_id: chargeId, updated_at: new Date().toISOString() }).eq("id", payment.id);
      }
    }
    if (!chargeId) throw new Error("Stripe charge is not ready for release");

    await admin.from("protected_payments").update({ status: "release_pending", failure_message: null, updated_at: new Date().toISOString() }).eq("id", payment.id);
    try {
      const params = new URLSearchParams();
      params.set("amount", String(payment.seller_amount_cents));
      params.set("currency", String(payment.currency).toLowerCase());
      params.set("destination", payment.seller_stripe_account_id);
      params.set("source_transaction", chargeId);
      params.set("transfer_group", payment.transfer_group);
      params.set("description", `Dealivra ${deal.public_id}`);
      params.set("metadata[deal_id]", deal.id);
      params.set("metadata[dealsafe_payment_id]", payment.id);
      const transfer = await stripeRequest<StripeTransfer>("/v1/transfers", {
        params,
        idempotencyKey: `dealsafe-release-${payment.id}`,
      });
      const releasedAt = new Date().toISOString();
      await admin.from("protected_payments").update({
        status: "released",
        transfer_id: transfer.id,
        released_at: releasedAt,
        updated_at: releasedAt,
      }).eq("id", payment.id);
      await admin.from("audit_events").insert({ deal_id: deal.id, actor_id: user.id, event_type: "payment_released" });
      return json({ released: true, transferId: transfer.id });
    } catch (error) {
      const failure = error instanceof Error ? error.message : "Stripe transfer failed";
      await admin.from("protected_payments").update({ status: "release_failed", failure_message: failure, updated_at: new Date().toISOString() }).eq("id", payment.id);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}));
