import { adminClient, errorResponse, handleBrowserRequest, json, requireUser, stripeRequest } from "../_shared/common.ts";
import { type FinancialCommand, verifyTrustedStripePayment } from "../_shared/financial.ts";
import { linkFinancialCommandObservation } from "../_shared/payment-ledger.ts";
import {
  paymentError,
  providerRequestId,
  recordPaymentSuccess,
  startPaymentOperation,
} from "../_shared/payment-observability.ts";

type Decision = "resolved_buyer" | "resolved_seller";

type StripeTransfer = {
  id: string;
  livemode: boolean;
  amount: number;
  currency: string;
  destination: string;
  source_transaction: string | null;
  transfer_group: string | null;
  metadata?: Record<string, string>;
};

type StripeRefund = {
  id: string;
  livemode: boolean;
  status: string;
  amount: number;
  currency: string;
  payment_intent: string | null;
  charge: string | null;
  metadata?: Record<string, string>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeVerificationCode(error: unknown) {
  const value = error instanceof Error ? error.message : "";
  return /^(financial_command_mismatch|payment_intent_mismatch|charge_mismatch|charge_not_transferable|charge_refund_mismatch|seller_account_mismatch)$/.test(value)
    ? value
    : "provider_verification_failed";
}

async function failClaim(commandId: string | null, claimToken: string | null, code: string) {
  if (!commandId || !claimToken) return;
  try {
    await adminClient().rpc("fail_stripe_financial_command", {
      p_command_id: commandId,
      p_claim_token: claimToken,
      p_error_code: code,
    });
  } catch {
    // The fenced command lease permits a later operations retry.
  }
}

Deno.serve((request) => {
  const context = startPaymentOperation("stripe-resolve-dispute");
  return handleBrowserRequest(request, async () => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let commandId: string | null = null;
  let claimToken: string | null = null;
  let dealIdForLog: string | null = null;
  let providerMayBeComplete = false;
  try {
    const user = await requireUser(request);
    const body = await request.json() as {
      disputeId?: string;
      decision?: string;
      note?: string;
    };
    const disputeId = body.disputeId?.trim() || "";
    const note = body.note?.trim() || "";
    const decision = body.decision as Decision;
    if (!uuidPattern.test(disputeId)) {
      throw paymentError("dispute_required", "Select a valid dispute before continuing.", 400);
    }
    if (decision !== "resolved_buyer" && decision !== "resolved_seller") {
      throw paymentError(
        "invalid_dispute_decision",
        "Select a valid dispute resolution.",
        400,
      );
    }
    if (note.length < 3 || note.length > 1000) {
      throw paymentError(
        "invalid_resolution_note",
        "Resolution note must contain 3 to 1000 characters.",
        400,
      );
    }

    const admin = adminClient();
    const { data: dispute, error: disputeError } = await admin
      .from("deal_disputes")
      .select("deal_id")
      .eq("id", disputeId)
      .single();
    if (disputeError || !dispute?.deal_id) {
      throw paymentError("dispute_not_found", "An open dispute was not found.", 404);
    }
    dealIdForLog = dispute.deal_id;

    const commandType = decision === "resolved_buyer"
      ? "dispute_refund"
      : "dispute_release";
    const action = decision === "resolved_buyer" ? "refund" : "transfer";
    const { data, error: prepareError } = await admin.rpc(
      "prepare_stripe_financial_command",
      {
        p_deal_id: dispute.deal_id,
        p_dispute_id: disputeId,
        p_command_type: commandType,
        p_actor_id: user.id,
        p_lease_seconds: 300,
      },
    );
    if (prepareError || !data) {
      throw paymentError(
        "dispute_action_not_eligible",
        "This dispute decision is not eligible for a financial action.",
        409,
      );
    }

    const command = data as FinancialCommand;
    if (command.disposition === "succeeded" && command.providerObjectId) {
      recordPaymentSuccess(context, "dispute_resolution_reused", {
        dealId: dealIdForLog,
      });
      return json({
        resolved: true,
        action,
        ...(action === "refund"
          ? { refundId: command.providerObjectId }
          : { transferId: command.providerObjectId }),
        idempotent: true,
      });
    }
    if (command.disposition === "in_progress") {
      throw paymentError(
        "dispute_action_in_progress",
        "This financial decision is already being reviewed. Please try again shortly.",
        409,
        { retryable: true },
      );
    }

    commandId = command.commandId || null;
    claimToken = command.claimToken || null;
    await linkFinancialCommandObservation(context, commandId, claimToken);
    try {
      await verifyTrustedStripePayment(command, action);
    } catch (error) {
      await linkFinancialCommandObservation(
        context,
        commandId,
        claimToken,
        providerRequestId(error),
      );
      await failClaim(commandId, claimToken, safeVerificationCode(error));
      commandId = null;
      claimToken = null;
      throw paymentError(
        "dispute_payment_verification_failed",
        "Payment verification did not pass. The dispute remains under operations review.",
        409,
      );
    }

    let providerObjectId: string;
    if (action === "refund") {
      const params = new URLSearchParams();
      params.set("payment_intent", command.paymentIntentId!);
      params.set("amount", String(command.amountCents));
      params.set("metadata[deal_id]", command.dealId!);
      params.set("metadata[dispute_id]", command.disputeId!);
      params.set("metadata[dealivra_payment_id]", command.paymentId!);
      params.set("metadata[dealivra_command_id]", command.commandId!);

      let refund: StripeRefund;
      providerMayBeComplete = true;
      try {
        refund = await stripeRequest<StripeRefund>("/v1/refunds", {
          params,
          idempotencyKey: command.idempotencyKey,
          context,
        });
      } catch (error) {
        await linkFinancialCommandObservation(
          context,
          commandId,
          claimToken,
          providerRequestId(error),
        );
        throw paymentError(
          "refund_reconciliation_required",
          "The approved refund needs operations review before a safe retry.",
          409,
          { providerRequestId: providerRequestId(error) },
        );
      }

      if (
        refund.livemode
        || !/^re_[A-Za-z0-9_]{8,255}$/.test(refund.id)
        || refund.amount !== command.amountCents
        || refund.currency.toUpperCase() !== command.currency
        || refund.payment_intent !== command.paymentIntentId
        || refund.charge !== command.chargeId
        || refund.metadata?.deal_id !== command.dealId
        || refund.metadata?.dispute_id !== command.disputeId
        || refund.metadata?.dealivra_payment_id !== command.paymentId
        || refund.metadata?.dealivra_command_id !== command.commandId
      ) {
        throw paymentError(
          "refund_confirmation_mismatch",
          "The refund confirmation did not match the approved command. Operations review is required.",
          409,
        );
      }
      if (refund.status !== "succeeded") {
        throw paymentError(
          "refund_confirmation_pending",
          "The refund is pending provider confirmation and remains under operations review.",
          409,
        );
      }
      providerObjectId = refund.id;
    } else {
      const params = new URLSearchParams();
      params.set("amount", String(command.amountCents));
      params.set("currency", command.currency!.toLowerCase());
      params.set("destination", command.sellerStripeAccountId!);
      params.set("source_transaction", command.chargeId!);
      params.set("transfer_group", command.transferGroup!);
      params.set("description", `Dealivra ${command.dealPublicId}`);
      params.set("metadata[deal_id]", command.dealId!);
      params.set("metadata[dispute_id]", command.disputeId!);
      params.set("metadata[dealivra_payment_id]", command.paymentId!);
      params.set("metadata[dealivra_command_id]", command.commandId!);

      let transfer: StripeTransfer;
      providerMayBeComplete = true;
      try {
        transfer = await stripeRequest<StripeTransfer>("/v1/transfers", {
          params,
          idempotencyKey: command.idempotencyKey,
          context,
        });
      } catch (error) {
        await linkFinancialCommandObservation(
          context,
          commandId,
          claimToken,
          providerRequestId(error),
        );
        throw paymentError(
          "dispute_release_reconciliation_required",
          "The approved payout needs operations review before a safe retry.",
          409,
          { providerRequestId: providerRequestId(error) },
        );
      }

      if (
        transfer.livemode
        || !/^tr_[A-Za-z0-9_]{8,255}$/.test(transfer.id)
        || transfer.amount !== command.amountCents
        || transfer.currency.toUpperCase() !== command.currency
        || transfer.destination !== command.sellerStripeAccountId
        || transfer.source_transaction !== command.chargeId
        || transfer.transfer_group !== command.transferGroup
        || transfer.metadata?.deal_id !== command.dealId
        || transfer.metadata?.dispute_id !== command.disputeId
        || transfer.metadata?.dealivra_payment_id !== command.paymentId
        || transfer.metadata?.dealivra_command_id !== command.commandId
      ) {
        throw paymentError(
          "dispute_release_confirmation_mismatch",
          "The payout confirmation did not match the approved command. Operations review is required.",
          409,
        );
      }
      providerObjectId = transfer.id;
    }

    const { data: finalized, error: finalizeError } = await admin.rpc(
      "finalize_stripe_financial_command",
      {
        p_command_id: commandId,
        p_claim_token: claimToken,
        p_provider_object_id: providerObjectId,
        p_resolution_note: note,
      },
    );
    if (finalizeError || !(finalized as { resolved?: boolean } | null)?.resolved) {
      throw paymentError(
        "dispute_recording_uncertain",
        "The provider action needs operations review before any retry.",
        409,
      );
    }

    recordPaymentSuccess(context, "dispute_financial_action_completed", {
      commandId,
      dealId: dealIdForLog,
    });
    commandId = null;
    claimToken = null;
    return json({
      resolved: true,
      action,
      ...(action === "refund"
        ? { refundId: providerObjectId }
        : { transferId: providerObjectId }),
    });
  } catch (error) {
    if (commandId && claimToken && !providerMayBeComplete) {
      await linkFinancialCommandObservation(
        context,
        commandId,
        claimToken,
        providerRequestId(error),
      );
      await failClaim(commandId, claimToken, "dispute_command_unhandled_failure");
    }
    return errorResponse(error, context, {
      commandId,
      dealId: dealIdForLog,
    });
  }
  }, context);
});
