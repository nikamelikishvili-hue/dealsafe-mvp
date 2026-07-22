# DealSafe MVP

A mobile-first proof of concept for creating a trusted transaction record and sharing it through a Deal Link.

## What is included

- Create and preview a deal
- Save private deal drafts, resume editing, and publish when ready
- Public Deal Link with immutable-style terms summary
- Buyer acceptance flow
- Verification placeholders for both parties
- Digital agreement preview and acceptance record
- Post-completion ratings
- Signed-in trust and safety reports for suspicious public deals
- Role-protected moderation center for reviewing and resolving reports
- Reversible public hiding and restoration of unsafe Deal Links
- Explainable automated risk score with visible, non-accusatory signals
- Privacy-preserving public seller trust profile with verified reputation totals
- Opt-in Digital Trust Passport with a private-by-default, shareable reputation link
- Private Saved Deal Links watchlist tied to the signed-in buyer account
- Side-by-side comparison for up to three saved deals
- Durable buyer inspection receipt required before in-person or shipped completion
- Enforceable Deal Link expiration with seller-selected validity periods
- Supabase-ready PostgreSQL schema with row-level-security notes
- Editable product brief, flows, roadmap, and budget

## Run locally

```bash
npm install
npm run dev
```

Open the address shown in the terminal. No credentials are needed for the demo; data is held in browser state.

## Production setup

1. Create a Supabase project and run `supabase/schema.sql`.
2. Run the feature setup files you need. For moderation, run `supabase/reporting_setup.sql`, `supabase/admin_reporting_setup.sql`, and then `supabase/admin_moderation_actions.sql`; run `supabase/deal_expiration_setup.sql` before the moderation action file because the latter installs the protected public Deal Link query. Run `supabase/risk_assessment_setup.sql` and `supabase/public_trust_profile_setup.sql` after moderation to enable the public trust panels. Run `supabase/inspection_receipt_setup.sql` after meeting and shipping setup to require a recorded buyer inspection before completion. Run `supabase/trust_passport_setup.sql` to add the opt-in public Digital Trust Passport. Run `supabase/watchlist_setup.sql` to enable private Saved Deal Links, then run `supabase/contact_verification_setup.sql` to expose the privacy-safe seller email-confirmed status. Run `supabase/seller_declaration_setup.sql` to require and record seller declarations before publication. Run `supabase/agreement_history_setup.sql` to expose the privacy-safe agreement version history, then `supabase/agreement_verification_setup.sql` to let visitors verify a saved agreement code. Run `supabase/deal_renewal_setup.sql` to let sellers extend or renew unaccepted Deal Links. Run `supabase/inquiry_setup.sql` to enable private pre-acceptance buyer questions and seller replies, then run `supabase/notification_read_setup.sql` to persist unread activity for each user. Run `supabase/buyer_access_code_setup.sql` to let sellers protect acceptance with a one-time private buyer code, then run `supabase/deal_participants_setup.sql` and `supabase/deal_action_plan_setup.sql` to expose the private participant record and role-aware next-step plan after acceptance. Finally, run `supabase/delivery_details_setup.sql` to require a private buyer address before shipped deals can be dispatched.
3. Copy `.env.example` to `.env` and add the project URL and anonymous key.
4. Connect verification and e-sign providers through the interfaces in `src/services/providers.ts`.

## Important MVP boundary

This build records consent and deal terms; it is not an escrow service and does not hold funds. “Verification” is a transparent placeholder until a compliant vendor is connected. Legal counsel should review the agreement wording, privacy policy, evidence retention, and marketplace/payment obligations before launch.

See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for product decisions and [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) for the delivery plan.
