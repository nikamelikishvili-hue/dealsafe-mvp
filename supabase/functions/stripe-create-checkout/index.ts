import { adminClient, corsHeaders, errorResponse, json, requireUser, siteUrl, stripeRequest } from "../_shared/common.ts";

type StripeAccount = { payouts_enabled: boolean; details_submitted: boolean; capabilities?: { transfers?: string } };
type StripeCheckoutSession = { id: string; url: string | null; expires_at: number; payment_intent: string | null };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(request);
    const { dealId } = await request.json() as { dealId?: string };
    if (!dealId) throw new Error("Deal is required");
    const admin = adminClient();
    const { data: deal, error: dealError } = await admin
      .from("deals")
      .select("id,public_id,title,price_cents,currency,status,buyer_id,seller_id,current_agreement_version")
      .eq("id", dealId)
      .single();
    if (dealError || !deal) throw new Error("Deal was not found");
    if (deal.buyer_id !== user.id || deal.status !== "accepted") throw new Error("Only the buyer can pay for an accepted deal");
    if (deal.currency !== "USD") throw new Error("Stripe protected payments currently support USD deals only");
    if (!Number.isSafeInteger(deal.price_cents) || deal.price_cents < 100) throw new Error("Deal amount is invalid");

    const { data: seller, error: sellerError } = await admin
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", deal.seller_id)
      .single();
    if (sellerError || !seller?.stripe_account_id) throw new Error("Seller must connect Stripe payouts before payment");
    const account = await stripeRequest<StripeAccount>(`/v1/accounts/${encodeURIComponent(seller.stripe_account_id)}`, { method: "GET" });
    const sellerReady = account.details_submitted && account.payouts_enabled && account.capabilities?.transfers === "active";
    await admin.from("profiles").update({
      stripe_details_submitted: Boolean(account.details_submitted),
      stripe_payouts_enabled: Boolean(account.payouts_enabled),
      stripe_transfers_active: account.capabilities?.transfers === "active",
      stripe_onboarding_updated_at: new Date().toISOString(),
    }).eq("id", deal.seller_id);
    if (!sellerReady) throw new Error("Seller payout setup is not complete");

    const { data: existing } = await admin
      .from("protected_payments")
      .select("status,checkout_url,checkout_expires_at")
      .eq("deal_id", deal.id)
      .maybeSingle();
    if (existing && ["funds_secured", "release_pending", "released", "disputed", "refunded"].includes(existing.status)) {
      throw new Error("This deal already has a protected payment");
    }
    if (existing?.status === "checkout_created" && existing.checkout_url && existing.checkout_expires_at && new Date(existing.checkout_expires_at).getTime() > Date.now() + 60_000) {
      return json({ url: existing.checkout_url, reused: true });
    }

    const feeBps = Math.max(0, Math.min(2000, Number(Deno.env.get("DEALSAFE_PLATFORM_FEE_BPS") || "0")));
    const platformFeeCents = Math.round(deal.price_cents * feeBps / 10_000);
    const sellerAmountCents = deal.price_cents - platformFeeCents;
    const transferGroup = `DS_${deal.id.replaceAll("-", "")}`;
    const base = siteUrl();
    const successUrl = `${base}/?deal=${encodeURIComponent(deal.public_id)}&payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${base}/?deal=${encodeURIComponent(deal.public_id)}&payment=cancelled`;
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("client_reference_id", deal.id);
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("customer_email", user.email || "");
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][unit_amount]", String(deal.price_cents));
    params.set("line_items[0][price_data][product_data][name]", deal.title.slice(0, 120));
    params.set("line_items[0][price_data][product_data][description]", `Dealivra ${deal.public_id} · Agreement version ${Math.max(1, deal.current_agreement_version || 1)}`);
    params.set("line_items[0][quantity]", "1");
    params.set("payment_intent_data[transfer_group]", transferGroup);
    params.set("payment_intent_data[metadata][deal_id]", deal.id);
    params.set("payment_intent_data[metadata][deal_public_id]", deal.public_id);
    params.set("metadata[deal_id]", deal.id);
    params.set("metadata[deal_public_id]", deal.public_id);
    params.set("metadata[buyer_id]", user.id);
    params.set("metadata[seller_id]", deal.seller_id);
    const session = await stripeRequest<StripeCheckoutSession>("/v1/checkout/sessions", {
      params,
      idempotencyKey: `dealsafe-checkout-${deal.id}-v${Math.max(1, deal.current_agreement_version || 1)}`,
    });
    if (!session.url) throw new Error("Stripe Checkout did not return a payment URL");

    const expiresAt = new Date(session.expires_at * 1000).toISOString();
    const { error: saveError } = await admin.from("protected_payments").upsert({
      deal_id: deal.id,
      buyer_id: user.id,
      seller_id: deal.seller_id,
      seller_stripe_account_id: seller.stripe_account_id,
      item_amount_cents: deal.price_cents,
      platform_fee_cents: platformFeeCents,
      seller_amount_cents: sellerAmountCents,
      currency: "USD",
      status: "checkout_created",
      checkout_session_id: session.id,
      payment_intent_id: session.payment_intent,
      checkout_url: session.url,
      checkout_expires_at: expiresAt,
      transfer_group: transferGroup,
      failure_message: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "deal_id" });
    if (saveError) throw new Error("Could not save the protected payment record");
    await admin.from("audit_events").insert({ deal_id: deal.id, actor_id: user.id, event_type: "payment_checkout_created" });
    return json({ url: session.url, expiresAt });
  } catch (error) {
    return errorResponse(error);
  }
});

