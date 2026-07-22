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
2. Run the feature setup files you need, including `supabase/reporting_setup.sql` for suspicious-deal reports; run `supabase/deal_expiration_setup.sql` after the other deal setup files.
3. Copy `.env.example` to `.env` and add the project URL and anonymous key.
4. Connect verification and e-sign providers through the interfaces in `src/services/providers.ts`.

## Important MVP boundary

This build records consent and deal terms; it is not an escrow service and does not hold funds. “Verification” is a transparent placeholder until a compliant vendor is connected. Legal counsel should review the agreement wording, privacy policy, evidence retention, and marketplace/payment obligations before launch.

See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for product decisions and [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) for the delivery plan.
