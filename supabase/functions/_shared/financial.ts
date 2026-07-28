import { stripeRequest } from "./common.ts";

export type FinancialCommand = {
  disposition: "claimed" | "succeeded" | "in_progress";
  action?: "transfer" | "refund";
  commandId?: string;
  claimToken?: string;
  idempotencyKey?: string;
  paymentId?: string;
  dealId?: string;
  dealPublicId?: string;
  buyerId?: string;
  sellerId?: string;
  disputeId?: string | null;
  amountCents?: number;
  itemAmountCents?: number;
  currency?: string;
  sellerStripeAccountId?: string;
  paymentIntentId?: string;
  chargeId?: string;
  transferGroup?: string;
  agreementVersion?: number;
  feeVersion?: string;
  providerObjectId?: string;
};

type StripePaymentIntent = {
  id: string;
  livemode: boolean;
  status: string;
  amount: number;
  amount_received: number;
  currency: string;
  latest_charge?: string | { id?: string } | null;
  transfer_group?: string | null;
  metadata?: Record<string, string>;
};

type StripeCharge = {
  id: string;
  livemode: boolean;
  paid: boolean;
  refunded: boolean;
  disputed: boolean;
  status: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  payment_intent?: string | { id?: string } | null;
};

type StripeAccount = {
  id: string;
  livemode?: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  capabilities?: { transfers?: string };
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const accountPattern = /^acct_[A-Za-z0-9_]{8,255}$/;
const intentPattern = /^pi_[A-Za-z0-9_]{8,255}$/;
const chargePattern = /^ch_[A-Za-z0-9_]{8,255}$/;

function objectId(value: string | { id?: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id || null;
}

function trustedCommand(command: FinancialCommand) {
  return command.disposition === "claimed"
    && command.action !== undefined
    && uuidPattern.test(command.commandId || "")
    && uuidPattern.test(command.claimToken || "")
    && uuidPattern.test(command.paymentId || "")
    && uuidPattern.test(command.dealId || "")
    && uuidPattern.test(command.buyerId || "")
    && uuidPattern.test(command.sellerId || "")
    && (command.disputeId == null || uuidPattern.test(command.disputeId))
    && typeof command.idempotencyKey === "string"
    && /^dealivra-[a-z0-9_.-]{8,220}$/.test(command.idempotencyKey)
    && Number.isSafeInteger(command.amountCents)
    && Number.isSafeInteger(command.itemAmountCents)
    && (command.amountCents || 0) > 0
    && (command.itemAmountCents || 0) >= (command.amountCents || 0)
    && command.currency === "USD"
    && accountPattern.test(command.sellerStripeAccountId || "")
    && intentPattern.test(command.paymentIntentId || "")
    && chargePattern.test(command.chargeId || "")
    && typeof command.transferGroup === "string"
    && /^DLV_[a-f0-9]{32}$|^DS_[a-f0-9]{32}$/i.test(command.transferGroup)
    && Number.isSafeInteger(command.agreementVersion)
    && typeof command.feeVersion === "string";
}

function matchesMetadata(command: FinancialCommand, metadata: Record<string, string>) {
  if (metadata.deal_id !== command.dealId) return false;
  if (command.feeVersion === "legacy_v1") {
    return !metadata.dealivra_payment_id || metadata.dealivra_payment_id === command.paymentId;
  }
  return metadata.dealivra_payment_id === command.paymentId
    && metadata.buyer_id === command.buyerId
    && metadata.seller_id === command.sellerId
    && metadata.agreement_version === String(command.agreementVersion)
    && metadata.fee_version === command.feeVersion;
}

export async function verifyTrustedStripePayment(
  command: FinancialCommand,
  action: "transfer" | "refund",
) {
  if (!trustedCommand(command) || command.action !== action) {
    throw new Error("financial_command_mismatch");
  }

  const intent = await stripeRequest<StripePaymentIntent>(
    `/v1/payment_intents/${encodeURIComponent(command.paymentIntentId!)}`,
    { method: "GET" },
  );
  const charge = await stripeRequest<StripeCharge>(
    `/v1/charges/${encodeURIComponent(command.chargeId!)}`,
    { method: "GET" },
  );

  if (
    intent.id !== command.paymentIntentId
    || intent.livemode
    || intent.status !== "succeeded"
    || intent.amount !== command.itemAmountCents
    || intent.amount_received !== command.itemAmountCents
    || intent.currency.toUpperCase() !== command.currency
    || objectId(intent.latest_charge) !== command.chargeId
    || intent.transfer_group !== command.transferGroup
    || !matchesMetadata(command, intent.metadata || {})
  ) {
    throw new Error("payment_intent_mismatch");
  }

  const chargePaymentIntent = objectId(charge.payment_intent);
  if (
    charge.id !== command.chargeId
    || charge.livemode
    || !charge.paid
    || charge.status !== "succeeded"
    || charge.amount !== command.itemAmountCents
    || charge.currency.toUpperCase() !== command.currency
    || chargePaymentIntent !== command.paymentIntentId
    || charge.disputed
  ) {
    throw new Error("charge_mismatch");
  }

  if (action === "transfer") {
    if (charge.refunded || charge.amount_refunded !== 0) {
      throw new Error("charge_not_transferable");
    }
    const account = await stripeRequest<StripeAccount>(
      `/v1/accounts/${encodeURIComponent(command.sellerStripeAccountId!)}`,
      { method: "GET" },
    );
    if (
      account.id !== command.sellerStripeAccountId
      || account.livemode === true
      || !account.details_submitted
      || !account.payouts_enabled
      || account.capabilities?.transfers !== "active"
    ) {
      throw new Error("seller_account_mismatch");
    }
  } else if (
    charge.amount_refunded !== 0
    && !(charge.refunded && charge.amount_refunded === command.itemAmountCents)
  ) {
    throw new Error("charge_refund_mismatch");
  }

  return { intent, charge };
}
