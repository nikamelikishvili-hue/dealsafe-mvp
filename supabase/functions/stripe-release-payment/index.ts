import { adminClient, errorResponse, handleBrowserRequest, json, requireUser, stripeRequest } from "../_shared/common.ts";
import { type FinancialCommand, verifyTrustedStripePayment } from "../_shared/financial.ts";

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

Deno.serve((request) => handleBrowserRequest(request, async () => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let commandId: string | null = null;
  let claimToken: string | null = null;
  let providerMayBeComplete = false;
  try {
    const user = await requireUser(request);
    const { dealId } = await request.json() as { dealId?: string };
    if (!dealId || !uuidPattern.test(dealId)) throw new Error("Deal is required");

    const admin = adminClient();
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
      throw new Error("This payout is not eligible for release or requires operations review");
    }

    const command = data as FinancialCommand;
    if (command.disposition === "succeeded" && command.providerObjectId) {
      return json({ released: true, transferId: command.providerObjectId, idempotent: true });
    }
    if (command.disposition === "in_progress") {
      throw new Error("This payout is already being reviewed. Please try again shortly.");
    }

    commandId = command.commandId || null;
    claimToken = command.claimToken || null;
    try {
      await verifyTrustedStripePayment(command, "transfer");
    } catch (error) {
      await failClaim(commandId, claimToken, safeVerificationCode(error));
      commandId = null;
      claimToken = null;
      throw new Error("Payout verification did not pass. Operations review is required.");
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
      });
    } catch {
      throw new Error("The seller payout needs reconciliation before a safe retry.");
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
      throw new Error("Stripe payout confirmation did not match the approved command.");
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
      throw new Error("The payout was created but needs reconciliation before any retry");
    }

    commandId = null;
    claimToken = null;
    return json({ released: true, transferId: transfer.id });
  } catch (error) {
    if (commandId && claimToken && !providerMayBeComplete) {
      await failClaim(commandId, claimToken, "release_unhandled_failure");
    }
    return errorResponse(error);
  }
}));
