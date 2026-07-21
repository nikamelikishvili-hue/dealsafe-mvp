# Implementation roadmap and $15,000 budget

## Recommended stack

| Layer | Choice | Why it fits the MVP |
|---|---|---|
| Web app | React + TypeScript + Vite | Fast, inexpensive, mobile-friendly, large hiring pool |
| UI | CSS design tokens, native form controls | Small bundle and easy customization |
| Backend | Supabase: Postgres, Auth, Storage, Edge Functions | One managed platform with strong SQL and row-level security |
| Hosting | Vercel or Cloudflare Pages | Simple preview deploys and low early cost |
| Email/SMS | Resend; Twilio only when phone verification is tested | Avoid SMS cost before it proves conversion value |
| Identity | Persona, Stripe Identity, or equivalent adapter | Vendor keeps sensitive documents; selection requires pricing/legal review |
| E-sign | Dropbox Sign/DocuSign adapter or clickwrap counsel approves | Do not invent a legal-signature system |
| Monitoring | Sentry + provider logs | Low-cost error visibility and auditability |
| Analytics | PostHog with privacy settings | Funnel and repeat-use measurement |

Vendor pricing and availability should be checked when procurement begins.

## Six-week delivery plan

| Week | Deliverable | Acceptance criterion |
|---|---|---|
| 1 | Discovery, clickable flow, agreement/legal workshop | Five sellers complete prototype test |
| 2 | Auth, profiles, deal drafts, photo storage | Seller can save and resume a draft |
| 3 | Published Deal Link, sharing, buyer claim | Buyer sees only approved public data |
| 4 | Versioned agreement, consent and audit trail | Material edit forces re-acceptance |
| 5 | Completion, ratings, reporting, admin basics | End-to-end happy path and abuse path work |
| 6 | Security QA, mobile/accessibility pass, analytics, private beta | Launch checklist passes; backups and alerts tested |

## Budget allocation

| Item | Budget |
|---|---:|
| Product/design and user testing | $2,000 |
| Full-stack implementation | $8,000 |
| QA, accessibility, and security review | $1,500 |
| Legal/privacy agreement review | $1,500 |
| Hosting, email, monitoring, vendor sandbox costs | $500 |
| Contingency | $1,500 |
| **Total** | **$15,000** |

This budget assumes one experienced builder using managed services and a tightly protected scope. It does not include escrow licensing, money transmission, insurance, custom KYC, native iOS/Android apps, or a production fraud model.

## Release gates

1. **Prototype gate:** five of eight target sellers finish without assistance.
2. **Private beta gate:** no critical authorization issue; agreement versions and audit events verified.
3. **Paid pilot gate:** at least 35% buyer acceptance and evidence of seller repeat use.
4. **Expansion gate:** only add payments/KYC after legal analysis and repeatable demand.

## Next backlog after validation

- QR export and richer sharing previews
- Real verification vendor connection
- Agreement PDF generation and externally verifiable receipt hash
- Seller subscription and usage billing
- Delivery tracking integration
- Category-specific templates
- API/webhooks for partner marketplaces
