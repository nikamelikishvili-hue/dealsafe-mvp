import { adminClient, corsHeaders, errorResponse, json, requireUser, siteUrl, stripeRequest } from "../_shared/common.ts";

type StripeAccount = {
  id: string;
  details_submitted: boolean;
  payouts_enabled: boolean;
  capabilities?: { transfers?: string };
};

function accountStatus(account: StripeAccount) {
  return {
    connected: true,
    detailsSubmitted: Boolean(account.details_submitted),
    payoutsEnabled: Boolean(account.payouts_enabled),
    transfersActive: account.capabilities?.transfers === "active",
    ready: Boolean(account.details_submitted && account.payouts_enabled && account.capabilities?.transfers === "active"),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({})) as { action?: string; dealPublicId?: string };
    const admin = adminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", user.id)
      .single();
    if (profileError) throw new Error("Dealivra profile was not found");

    let accountId = profile?.stripe_account_id as string | null;
    let account: StripeAccount | null = null;
    if (accountId) {
      account = await stripeRequest<StripeAccount>(`/v1/accounts/${encodeURIComponent(accountId)}`, { method: "GET" });
    }

    if (body.action === "status") {
      if (!account) return json({ connected: false, detailsSubmitted: false, payoutsEnabled: false, transfersActive: false, ready: false });
      const status = accountStatus(account);
      await admin.from("profiles").update({
        stripe_details_submitted: status.detailsSubmitted,
        stripe_payouts_enabled: status.payoutsEnabled,
        stripe_transfers_active: status.transfersActive,
        stripe_onboarding_updated_at: new Date().toISOString(),
      }).eq("id", user.id);
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
      });
      accountId = account.id;
      const status = accountStatus(account);
      const { error } = await admin.from("profiles").update({
        stripe_account_id: accountId,
        stripe_details_submitted: status.detailsSubmitted,
        stripe_payouts_enabled: status.payoutsEnabled,
        stripe_transfers_active: status.transfersActive,
        stripe_onboarding_updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (error) throw new Error("Could not save the Stripe seller account");
    }

    const base = siteUrl();
    const dealQuery = body.dealPublicId ? `&deal=${encodeURIComponent(body.dealPublicId)}` : "";
    const params = new URLSearchParams();
    params.set("account", accountId!);
    params.set("refresh_url", `${base}/?stripe_onboarding=refresh${dealQuery}`);
    params.set("return_url", `${base}/?stripe_onboarding=returned${dealQuery}`);
    params.set("type", "account_onboarding");
    params.set("collection_options[fields]", "eventually_due");
    const link = await stripeRequest<{ url: string; expires_at: number }>("/v1/account_links", { params });
    return json({ url: link.url, expiresAt: link.expires_at });
  } catch (error) {
    return errorResponse(error);
  }
});

