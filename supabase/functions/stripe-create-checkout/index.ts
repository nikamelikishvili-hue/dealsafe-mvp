import { adminClient, errorResponse, handleBrowserRequest, json, requireUser, siteUrl, stripeRequest } from "../_shared/common.ts";
import { linkFinancialCommandObservation } from "../_shared/payment-ledger.ts";
import {
  paymentError,
  providerRequestId,
  recordPaymentSuccess,
  startPaymentOperation,
} from "../_shared/payment-observability.ts";

type StripeAccount = {
  id: string;
  livemode?: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  capabilities?: { transfers?: string };
};

type CheckoutReservation = {
  disposition: "claimed" | "reused" | "in_progress";
  commandId?: string;
  claimToken?: string;
  idempotencyKey?: string;
  paymentId?: string;
  dealId?: string;
  dealPublicId?: string;
  title?: string;
  buyerId?: string;
  sellerId?: string;
  sellerStripeAccountId?: string;
  itemAmountCents?: number;
  platformFeeCents?: number;
  sellerAmountCents?: number;
  currency?: string;
  transferGroup?: string;
  agreementVersion?: number;
  feeVersion?: string;
  checkoutUrl?: string;
  checkoutExpiresAt?: string;
};

type StripeCheckoutSession = {
  id: string;
  url: string | null;
  expires_at: number;
  payment_intent: string | null;
  amount_total: number | null;
  currency: string | null;
  client_reference_id: string | null;
  livemode: boolean;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const stripeAccountPattern = /^acct_[A-Za-z0-9_]{8,255}$/;

function integerSetting(name: string, fallback: number, minimum: number, maximum: number) {
  const raw = Deno.env.get(name);
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw paymentError(
      "checkout_configuration_invalid",
      "Secure checkout is temporarily unavailable.",
      503,
    );
  }
  return value;
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
    // The fenced command lease permits a safe retry if failure recording is unavailable.
  }
}

Deno.serve((request) => {
  const context = startPaymentOperation("stripe-create-checkout");
  return handleBrowserRequest(request, async () => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let commandId: string | null = null;
  let claimToken: string | null = null;
  let dealIdForLog: string | null = null;
  let providerRequestStarted = false;
  try {
    const user = await requireUser(request);
    const { dealId } = await request.json() as { dealId?: string };
    if (!dealId || !uuidPattern.test(dealId)) {
      throw paymentError("deal_required", "Select a valid deal before starting checkout.", 400);
    }
    dealIdForLog = dealId;

    const legacyFeeBps = integerSetting("DEALSAFE_PLATFORM_FEE_BPS", 0, 0, 2000);
    const feeBps = integerSetting("DEALIVRA_PLATFORM_FEE_BPS", legacyFeeBps, 0, 2000);
    const maximumAmountCents = integerSetting(
      "DEALIVRA_CHECKOUT_MAX_CENTS",
      5_000_000,
      100,
      100_000_000,
    );
    const feeVersion = (Deno.env.get("DEALIVRA_PLATFORM_FEE_VERSION") || "sandbox_v1").trim();
    if (!/^[a-z0-9][a-z0-9_.-]{0,39}$/.test(feeVersion)) {
      throw paymentError(
        "checkout_fee_policy_unavailable",
        "Secure checkout is temporarily unavailable.",
        503,
      );
    }

    const admin = adminClient();
    const { data: sellerLookup, error: sellerLookupError } = await admin
      .from("deals")
      .select("seller_id,profiles!deals_seller_id_fkey(stripe_account_id)")
      .eq("id", dealId)
      .eq("buyer_id", user.id)
      .single();
    const sellerProfile = Array.isArray(sellerLookup?.profiles)
      ? sellerLookup?.profiles[0]
      : sellerLookup?.profiles;
    const sellerAccountId = sellerProfile?.stripe_account_id;
    if (sellerLookupError || !sellerAccountId || !stripeAccountPattern.test(sellerAccountId)) {
      throw paymentError(
        "seller_onboarding_required",
        "The seller must complete payout setup before checkout can begin.",
        409,
      );
    }

    const account = await stripeRequest<StripeAccount>(
      `/v1/accounts/${encodeURIComponent(sellerAccountId)}`,
      { method: "GET", context },
    );
    if (
      account.id !== sellerAccountId
      || account.livemode === true
      || !stripeAccountPattern.test(account.id)
    ) {
      throw paymentError(
        "seller_account_mismatch",
        "Seller payout status could not be verified. Please contact support.",
        409,
      );
    }

    const sellerReady = account.details_submitted
      && account.payouts_enabled
      && account.capabilities?.transfers === "active";
    const { error: accountSaveError } = await admin.from("profiles").update({
      stripe_details_submitted: Boolean(account.details_submitted),
      stripe_payouts_enabled: Boolean(account.payouts_enabled),
      stripe_transfers_active: account.capabilities?.transfers === "active",
      stripe_onboarding_updated_at: new Date().toISOString(),
    }).eq("id", sellerLookup.seller_id).eq("stripe_account_id", sellerAccountId);
    if (accountSaveError) {
      throw paymentError(
        "seller_status_save_failed",
        "Seller payout status could not be saved. Please try again.",
        503,
        { retryable: true },
      );
    }
    if (!sellerReady) {
      throw paymentError(
        "seller_onboarding_incomplete",
        "The seller's payout setup is not complete.",
        409,
      );
    }

    const { data, error: prepareError } = await admin.rpc("prepare_stripe_checkout", {
      p_deal_id: dealId,
      p_buyer_id: user.id,
      p_fee_bps: feeBps,
      p_fee_version: feeVersion,
      p_max_amount_cents: maximumAmountCents,
    });
    if (prepareError || !data) {
      throw paymentError(
        "checkout_not_eligible",
        "Secure checkout is not available for this deal.",
        409,
      );
    }
    const reservation = data as CheckoutReservation;

    if (
      reservation.disposition === "reused"
      && reservation.checkoutUrl
      && reservation.checkoutExpiresAt
    ) {
      recordPaymentSuccess(context, "checkout_reused", { dealId });
      return json({
        url: reservation.checkoutUrl,
        expiresAt: reservation.checkoutExpiresAt,
        reused: true,
      });
    }
    if (reservation.disposition === "in_progress") {
      throw paymentError(
        "checkout_in_progress",
        "Checkout is already being prepared. Please try again shortly.",
        409,
        { retryable: true },
      );
    }

    commandId = reservation.commandId || null;
    claimToken = reservation.claimToken || null;
    if (
      reservation.disposition !== "claimed"
      || !commandId
      || !claimToken
      || !reservation.idempotencyKey
      || !reservation.paymentId
      || !reservation.dealId
      || !reservation.dealPublicId
      || !reservation.title
      || !reservation.buyerId
      || !reservation.sellerId
      || reservation.sellerStripeAccountId !== account.id
      || !Number.isSafeInteger(reservation.itemAmountCents)
      || !Number.isSafeInteger(reservation.platformFeeCents)
      || !Number.isSafeInteger(reservation.sellerAmountCents)
      || reservation.currency !== "USD"
      || !reservation.transferGroup
      || !Number.isSafeInteger(reservation.agreementVersion)
      || !reservation.feeVersion
    ) {
      throw paymentError(
        "checkout_reservation_invalid",
        "Secure checkout could not be verified. Please contact support.",
        409,
      );
    }
    await linkFinancialCommandObservation(context, commandId, claimToken);

    const base = siteUrl();
    const successUrl = `${base}/?deal=${encodeURIComponent(reservation.dealPublicId)}&payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${base}/?deal=${encodeURIComponent(reservation.dealPublicId)}&payment=cancelled`;
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("client_reference_id", reservation.dealId);
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("customer_email", user.email || "");
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][unit_amount]", String(reservation.itemAmountCents));
    params.set("line_items[0][price_data][product_data][name]", reservation.title.slice(0, 120));
    params.set(
      "line_items[0][price_data][product_data][description]",
      `Dealivra ${reservation.dealPublicId} · Agreement version ${reservation.agreementVersion}`,
    );
    params.set("line_items[0][quantity]", "1");
    params.set("payment_intent_data[transfer_group]", reservation.transferGroup);

    const trustedMetadata: Record<string, string> = {
      deal_id: reservation.dealId,
      deal_public_id: reservation.dealPublicId,
      dealivra_payment_id: reservation.paymentId,
      buyer_id: reservation.buyerId,
      seller_id: reservation.sellerId,
      agreement_version: String(reservation.agreementVersion),
      fee_version: reservation.feeVersion,
    };
    for (const [key, value] of Object.entries(trustedMetadata)) {
      params.set(`metadata[${key}]`, value);
      params.set(`payment_intent_data[metadata][${key}]`, value);
    }

    let session: StripeCheckoutSession;
    providerRequestStarted = true;
    try {
      session = await stripeRequest<StripeCheckoutSession>("/v1/checkout/sessions", {
        params,
        idempotencyKey: reservation.idempotencyKey,
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
        "checkout_reconciliation_required",
        "Checkout needs operations review before it can be retried safely. Contact support with the reference below.",
        409,
        { providerRequestId: providerRequestId(error) },
      );
    }

    if (
      session.livemode
      || !/^cs_test_[A-Za-z0-9_]{8,255}$/.test(session.id)
      || session.client_reference_id !== reservation.dealId
      || session.amount_total !== reservation.itemAmountCents
      || session.currency?.toUpperCase() !== reservation.currency
      || !session.url
      || session.expires_at * 1000 <= Date.now() + 60_000
    ) {
      throw paymentError(
        "checkout_confirmation_mismatch",
        "Checkout could not be verified and needs operations review.",
        409,
      );
    }

    const expiresAt = new Date(session.expires_at * 1000).toISOString();
    const { data: attached, error: attachError } = await admin.rpc(
      "attach_stripe_checkout_session",
      {
        p_command_id: commandId,
        p_claim_token: claimToken,
        p_checkout_session_id: session.id,
        p_payment_intent_id: session.payment_intent,
        p_checkout_url: session.url,
        p_checkout_expires_at: expiresAt,
      },
    );
    if (attachError || attached !== true) {
      throw paymentError(
        "checkout_recording_uncertain",
        "Checkout was prepared but needs operations review before any retry.",
        409,
      );
    }

    recordPaymentSuccess(context, "checkout_created", {
      commandId,
      dealId,
    });
    commandId = null;
    claimToken = null;
    return json({ url: session.url, expiresAt });
  } catch (error) {
    if (!providerRequestStarted) {
      await linkFinancialCommandObservation(
        context,
        commandId,
        claimToken,
        providerRequestId(error),
      );
      await failClaim(commandId, claimToken, "checkout_unhandled_failure");
    }
    return errorResponse(error, context, {
      commandId,
      dealId: dealIdForLog,
    });
  }
  }, context);
});
