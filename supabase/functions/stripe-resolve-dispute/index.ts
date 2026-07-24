import { adminClient, corsHeaders, errorResponse, json, requireUser, stripeRequest } from "../_shared/common.ts";

type Decision = "resolved_buyer" | "resolved_seller";
type StripeTransfer = { id: string };
type StripeRefund = { id: string; status?: string };
type StripePaymentIntent = { latest_charge?: string | { id?: string } | null };

const activeDisputeStatuses = ["open", "evidence_requested", "under_review"];

async function chargeIdForPayment(payment: { charge_id?: string | null; payment_intent_id?: string | null }) {
  if (payment.charge_id) return payment.charge_id;
  if (!payment.payment_intent_id) return null;
  const intent = await stripeRequest<StripePaymentIntent>(
    `/v1/payment_intents/${encodeURIComponent(payment.payment_intent_id)}`,
    { method: "GET" },
  );
  return typeof intent.latest_charge === "string"
    ? intent.latest_charge
    : intent.latest_charge?.id || null;
}

async function finishDispute(
  admin: ReturnType<typeof adminClient>,
  disputeId: string,
  dealId: string,
  decision: Decision,
  note: string,
  actorId: string,
) {
  const disputeStatus = decision;
  const { error: disputeError } = await admin
    .from("deal_disputes")
    .update({
      status: disputeStatus,
      resolution_note: note,
      resolved_by: actorId,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", disputeId)
    .in("status", activeDisputeStatuses);
  if (disputeError) throw new Error("Could not save the dispute decision");

  const nextDealStatus = decision === "resolved_buyer" ? "cancelled" : "completed";
  await admin
    .from("deals")
    .update({ status: nextDealStatus, updated_at: new Date().toISOString() })
    .eq("id", dealId)
    .eq("status", "disputed");

  await admin.from("audit_events").insert({
    deal_id: dealId,
    actor_id: actorId,
    event_type: decision === "resolved_buyer" ? "dispute_refunded" : "dispute_released_to_seller",
    metadata: { dispute_id: disputeId, note },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireUser(request);
    const body = await request.json() as { disputeId?: string; decision?: string; note?: string };
    const disputeId = body.disputeId?.trim();
    const note = body.note?.trim() || "";
    const decision = body.decision as Decision;
    if (!disputeId) throw new Error("Dispute is required");
    if (decision !== "resolved_buyer" && decision !== "resolved_seller") throw new Error("Invalid financial dispute decision");
    if (note.length < 3 || note.length > 1000) throw new Error("Resolution note must contain 3 to 1000 characters");

    const admin = adminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.is_admin) throw new Error("Admin access required");

    const { data: dispute, error: disputeError } = await admin
      .from("deal_disputes")
      .select("id,deal_id,status")
      .eq("id", disputeId)
      .single();
    if (disputeError || !dispute || !activeDisputeStatuses.includes(dispute.status)) {
      throw new Error("Open dispute was not found");
    }

    const { data: deal, error: dealError } = await admin
      .from("deals")
      .select("id,public_id,status")
      .eq("id", dispute.deal_id)
      .single();
    if (dealError || !deal) throw new Error("Deal was not found");

    const { data: payment, error: paymentError } = await admin
      .from("protected_payments")
      .select("id,status,seller_stripe_account_id,seller_amount_cents,currency,payment_intent_id,charge_id,transfer_group,transfer_id,refund_id")
      .eq("deal_id", deal.id)
      .single();
    if (paymentError || !payment) throw new Error("Protected payment was not found");

    if (decision === "resolved_buyer") {
      if (payment.refund_id && payment.status === "refunded") {
        return json({ resolved: true, action: "refund", refundId: payment.refund_id, idempotent: true });
      }
      if (payment.transfer_id || payment.status === "released") {
        throw new Error("Funds were already released and cannot be refunded automatically");
      }
      if (!["funds_secured", "disputed", "release_failed", "refund_pending"].includes(payment.status)) {
        throw new Error("Payment is not ready for a buyer refund");
      }

      await admin.from("protected_payments").update({
        status: "refund_pending",
        failure_message: null,
        updated_at: new Date().toISOString(),
      }).eq("id", payment.id);

      let stripeCompleted = false;
      try {
        const params = new URLSearchParams();
        if (payment.payment_intent_id) params.set("payment_intent", payment.payment_intent_id);
        else if (payment.charge_id) params.set("charge", payment.charge_id);
        else throw new Error("Stripe payment is not ready for a refund");
        params.set("metadata[deal_id]", deal.id);
        params.set("metadata[dispute_id]", dispute.id);
        params.set("metadata[dealsafe_payment_id]", payment.id);
        const refund = await stripeRequest<StripeRefund>("/v1/refunds", {
          params,
          idempotencyKey: `dealsafe-dispute-refund-${payment.id}-${dispute.id}`,
        });
        stripeCompleted = true;
        const refundedAt = new Date().toISOString();
        const { error: saveError } = await admin.from("protected_payments").update({
          status: "refunded",
          refund_id: refund.id,
          refunded_at: refundedAt,
          updated_at: refundedAt,
        }).eq("id", payment.id);
        if (saveError) throw new Error("Refund was created but could not be recorded");
        await finishDispute(admin, dispute.id, deal.id, decision, note, user.id);
        return json({ resolved: true, action: "refund", refundId: refund.id });
      } catch (error) {
        if (!stripeCompleted) {
          const failure = error instanceof Error ? error.message : "Stripe refund failed";
          await admin.from("protected_payments").update({
            status: "release_failed",
            failure_message: failure,
            updated_at: new Date().toISOString(),
          }).eq("id", payment.id);
        }
        throw error;
      }
    }

    if (payment.transfer_id && payment.status === "released") {
      return json({ resolved: true, action: "transfer", transferId: payment.transfer_id, idempotent: true });
    }
    if (!["funds_secured", "disputed", "release_failed"].includes(payment.status)) {
      throw new Error("Payment is not ready for a seller release");
    }
    if (!payment.seller_stripe_account_id) throw new Error("Seller Stripe payouts are not connected");
    const chargeId = await chargeIdForPayment(payment);
    if (!chargeId) throw new Error("Stripe charge is not ready for release");

    await admin.from("protected_payments").update({
      status: "release_pending",
      charge_id: payment.charge_id || chargeId,
      failure_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);

    let stripeCompleted = false;
    try {
      const params = new URLSearchParams();
      params.set("amount", String(payment.seller_amount_cents));
      params.set("currency", String(payment.currency).toLowerCase());
      params.set("destination", payment.seller_stripe_account_id);
      params.set("source_transaction", chargeId);
      params.set("transfer_group", payment.transfer_group);
      params.set("description", `DealSafe ${deal.public_id}`);
      params.set("metadata[deal_id]", deal.id);
      params.set("metadata[dispute_id]", dispute.id);
      params.set("metadata[dealsafe_payment_id]", payment.id);
      const transfer = await stripeRequest<StripeTransfer>("/v1/transfers", {
        params,
        idempotencyKey: `dealsafe-dispute-release-${payment.id}-${dispute.id}`,
      });
      stripeCompleted = true;
      const releasedAt = new Date().toISOString();
      const { error: saveError } = await admin.from("protected_payments").update({
        status: "released",
        transfer_id: transfer.id,
        released_at: releasedAt,
        updated_at: releasedAt,
      }).eq("id", payment.id);
      if (saveError) throw new Error("Transfer was created but could not be recorded");
      await finishDispute(admin, dispute.id, deal.id, decision, note, user.id);
      return json({ resolved: true, action: "transfer", transferId: transfer.id });
    } catch (error) {
      if (!stripeCompleted) {
        const failure = error instanceof Error ? error.message : "Stripe transfer failed";
        await admin.from("protected_payments").update({ status: "release_failed", failure_message: failure, updated_at: new Date().toISOString() }).eq("id", payment.id);
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
});
