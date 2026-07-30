import {
  adminClient,
  errorResponse,
  handleBrowserRequest,
  json,
  readPaymentJson,
  requireSandboxPaymentCapability,
  requireSensitiveChangeAllowedForService,
  requireUser,
  siteUrl,
  stripeRequest,
} from "../_shared/common.ts";
import {
  paymentError,
  recordPaymentSuccess,
  startPaymentOperation,
} from "../_shared/payment-observability.ts";

type StripeAccount = {
  id: string;
  livemode?: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  capabilities?: { transfers?: string };
};

const stripeAccountPattern = /^acct_[A-Za-z0-9_]{8,255}$/;

function accountStatus(account: StripeAccount) {
  return {
    connected: true,
    detailsSubmitted: Boolean(account.details_submitted),
    payoutsEnabled: Boolean(account.payouts_enabled),
    transfersActive: account.capabilities?.transfers === "active",
    ready: Boolean(account.details_submitted && account.payouts_enabled && account.capabilities?.transfers === "active"),
  };
}

Deno.serve((request) => {
  const context = startPaymentOperation("stripe-connect");
  return handleBrowserRequest(request, async () => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(request);
    const body = await readPaymentJson<{
      action?: string;
      dealPublicId?: string;
    }>(request, ["action", "dealPublicId"]);
    if (body.action !== "status" && body.action !== "onboard") {
      throw paymentError("invalid_connect_action", "Select a valid seller payout action.", 400);
    }
    if (body.action === "onboard") {
      requireSandboxPaymentCapability("seller_onboarding");
      await requireSensitiveChangeAllowedForService(user.id, "payout");
    }
    const admin = adminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", user.id)
      .single();
    if (profileError) {
      throw paymentError(
        "profile_unavailable",
        "Your Dealivra profile could not be loaded. Please try again.",
        503,
        { retryable: true },
      );
    }

    let accountId = profile?.stripe_account_id as string | null;
    let account: StripeAccount | null = null;
    if (accountId) {
      account = await stripeRequest<StripeAccount>(
        `/v1/accounts/${encodeURIComponent(accountId)}`,
        { method: "GET", context },
      );
      if (
        account.id !== accountId
        || !stripeAccountPattern.test(account.id)
        || account.livemode === true
      ) {
        throw paymentError(
          "seller_account_mismatch",
          "Seller payout status could not be verified. Please contact support.",
          409,
        );
      }
    }

    if (body.action === "status") {
      if (!account) {
        recordPaymentSuccess(context, "connect_status_checked");
        return json({ connected: false, detailsSubmitted: false, payoutsEnabled: false, transfersActive: false, ready: false });
      }
      const status = accountStatus(account);
      const { error: statusSaveError } = await admin.from("profiles").update({
        stripe_details_submitted: status.detailsSubmitted,
        stripe_payouts_enabled: status.payoutsEnabled,
        stripe_transfers_active: status.transfersActive,
        stripe_onboarding_updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (statusSaveError) {
        throw paymentError(
          "connect_status_save_failed",
          "Seller payout status could not be saved. Please try again.",
          503,
          { retryable: true },
        );
      }
      recordPaymentSuccess(context, "connect_status_checked");
      return json(status);
    }

    if (!account) {
      const params = new URLSearchParams();
      params.set("type", "express");
      params.set("country", "US");
      if (user.email) params.set("email", user.email);
      params.set("capabilities[transfers][requested]", "true");
      params.set("business_profile[product_description]", "Private-sale proceeds through Dealivra");
      params.set("metadata[dealsafe_user_id]", user.id);
      account = await stripeRequest<StripeAccount>("/v1/accounts", {
        params,
        idempotencyKey: `dealsafe-connect-${user.id}`,
        context,
      });
      if (!stripeAccountPattern.test(account.id) || account.livemode === true) {
        throw paymentError(
          "seller_account_mismatch",
          "Seller payout status could not be verified. Please contact support.",
          409,
        );
      }
      accountId = account.id;
      const status = accountStatus(account);
      const { error } = await admin.from("profiles").update({
        stripe_account_id: accountId,
        stripe_details_submitted: status.detailsSubmitted,
        stripe_payouts_enabled: status.payoutsEnabled,
        stripe_transfers_active: status.transfersActive,
        stripe_onboarding_updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (error) {
        throw paymentError(
          "connect_account_save_failed",
          "The seller payout account could not be saved. Please contact support.",
          503,
        );
      }
    }

    const base = siteUrl();
    const dealQuery = body.dealPublicId ? `&deal=${encodeURIComponent(body.dealPublicId)}` : "";
    const params = new URLSearchParams();
    params.set("account", accountId!);
    params.set("refresh_url", `${base}/?stripe_onboarding=refresh${dealQuery}`);
    params.set("return_url", `${base}/?stripe_onboarding=returned${dealQuery}`);
    params.set("type", "account_onboarding");
    params.set("collection_options[fields]", "eventually_due");
    const link = await stripeRequest<{ url: string; expires_at: number }>(
      "/v1/account_links",
      { params, context },
    );
    if (
      typeof link.url !== "string"
      || !link.url.startsWith("https://connect.stripe.com/")
      || !Number.isSafeInteger(link.expires_at)
    ) {
      throw paymentError(
        "connect_link_invalid",
        "Secure seller onboarding could not be verified. Please contact support.",
        502,
      );
    }
    recordPaymentSuccess(context, "connect_onboarding_created");
    return json({ url: link.url, expiresAt: link.expires_at });
  } catch (error) {
    return errorResponse(error, context);
  }
  }, context);
});
