import {
  adminClient,
  errorResponse,
  handleBrowserRequest,
  json,
  readPaymentJson,
  requireSandboxPaymentCapability,
  requireSensitiveChangeAllowedForService,
  requireUser,
  stripeRequest,
} from "../_shared/common.ts";
import { type FinancialCommand, verifyTrustedStripePayment } from "../_shared/financial.ts";
import { linkFinancialCommandObservation } from "../_shared/payment-ledger.ts";
import {
  paymentError,
  providerRequestId,
  recordPaymentSuccess,
  startPaymentOperation,
} from "../_shared/payment-observability.ts";

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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeVerificationCode(error: unknown) {
  const value = error instanceof Error ? error.message : "";
  return /^(financial_command_mismatch|payment_intent_mismatch|charge_mismatch|charge_not_transferable|seller_account_mismatch)$/.test(value)
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
  const context = startPaymentOperation("stripe-release-payment");
  return handleBrowserRequest(request, async () => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let commandId: string | null = null;
  let claimToken: string | null = null;
  let dealIdForLog: string | null = null;
  let providerMayBeComplete = false;
  try {
    const user = await requireUser(request);
    const { dealId } = await readPaymentJson<{ dealId?: string }>(
      request,
      ["dealId"],
    );
    if (!dealId || !uuidPattern.test(dealId)) {
      throw paymentError("deal_required", "Select a valid deal before requesting payout review.", 400);
    }
    dealIdForLog = dealId;
    requireSandboxPaymentCapability("payout_release");

    const admin = adminClient();
    const { data: payoutDeal, error: payoutDealError } = await admin
      .from("deals")
      .select("seller_id")
      .eq("id", dealId)
      .single();
    if (
      payoutDealError
      || !payoutDeal?.seller_id
      || !uuidPattern.test(payoutDeal.seller_id)
    ) {
      throw paymentError(
        "release_not_eligible",
        "This payout is not eligible for release or requires operations review.",
        409,
      );
    }
    await requireSensitiveChangeAllowedForService(payoutDeal.seller_id, "payout");
    const { data, error: prepareError } = await admin.rpc(
      "prepare_stripe_financial_command",
      {
        p_deal_id: dealId,
        p_dispute_id: null,
        p_command_type: "release",
        p_actor_id: user.id,
        p_lease_seconds: 300,
      },
    );
    if (prepareError || !data) {
      throw paymentError(
        "release_not_eligible",
        "This payout is not eligible for release or requires operations review.",
        409,
      );
    }

    const command = data as FinancialCommand;
    if (command.disposition === "succeeded" && command.providerObjectId) {
      recordPaymentSuccess(context, "release_reused", { dealId });
      return json({ released: true, transferId: command.providerObjectId, idempotent: true });
    }
    if (command.disposition === "in_progress") {
      throw paymentError(
        "release_in_progress",
        "This payout is already being reviewed. Please try again shortly.",
        409,
        { retryable: true },
      );
    }

    commandId = command.commandId || null;
    claimToken = command.claimToken || null;
    await linkFinancialCommandObservation(context, commandId, claimToken);
    try {
      await verifyTrustedStripePayment(command, "transfer");
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
        "release_verification_failed",
        "Payout verification did not pass. Operations review is required.",
        409,
      );
    }

    const params = new URLSearchParams();
    params.set("amount", String(command.amountCents));
    params.set("currency", command.currency!.toLowerCase());
    params.set("destination", command.sellerStripeAccountId!);
    params.set("source_transaction", command.chargeId!);
    params.set("transfer_group", command.transferGroup!);
    params.set("description", `Dealivra ${command.dealPublicId}`);
    params.set("metadata[deal_id]", command.dealId!);
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
        "release_reconciliation_required",
        "The seller payout needs operations review before a safe retry.",
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
      || transfer.metadata?.dealivra_payment_id !== command.paymentId
      || transfer.metadata?.dealivra_command_id !== command.commandId
    ) {
      throw paymentError(
        "release_confirmation_mismatch",
        "The payout confirmation did not match the approved command. Operations review is required.",
        409,
      );
    }

    const { data: finalized, error: finalizeError } = await admin.rpc(
      "finalize_stripe_financial_command",
      {
        p_command_id: commandId,
        p_claim_token: claimToken,
        p_provider_object_id: transfer.id,
        p_resolution_note: null,
      },
    );
    if (finalizeError || !(finalized as { resolved?: boolean } | null)?.resolved) {
      throw paymentError(
        "release_recording_uncertain",
        "The payout was created but needs operations review before any retry.",
        409,
      );
    }

    recordPaymentSuccess(context, "release_completed", {
      commandId,
      dealId,
    });
    commandId = null;
    claimToken = null;
    return json({ released: true, transferId: transfer.id });
  } catch (error) {
    if (commandId && claimToken && !providerMayBeComplete) {
      await linkFinancialCommandObservation(
        context,
        commandId,
        claimToken,
        providerRequestId(error),
      );
      await failClaim(commandId, claimToken, "release_unhandled_failure");
    }
    return errorResponse(error, context, {
      commandId,
      dealId: dealIdForLog,
    });
  }
  }, context);
});
