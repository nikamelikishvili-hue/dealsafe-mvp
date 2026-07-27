# Dealivra Production Readiness Master Plan

**Version:** 1.0  
**Program start:** July 2026  
**Initial market:** United States  
**Initial language and currency:** English and USD  
**Initial category:** peer-to-peer used phones and compact consumer electronics  
**Target:** a controlled paid US beta, followed by a measured nationwide release

## 1. Executive decision

Dealivra will not launch as a broad marketplace or claim to be legal escrow. It will launch as a focused transaction workspace for private sales:

> Create clear terms, verify relevant facts, document payment and delivery, preserve evidence, and provide a structured support path.

The safest path to first revenue has two steps:

1. A paid closed pilot for transaction-record and workflow services, without Dealivra holding customer funds.
2. A limited US protected-payment beta only after provider approval, counsel review, production controls, reconciliation, support, and independent security testing.

Global-ready means country, currency, language, tax, identity, payment, retention, and policy behavior are configurable. It does not mean enabling multiple countries at the first release.

## 2. Repository assessment at program start

The current project is a substantial prototype, not a blank starting point.

### Existing strengths

- A recognizable Dealivra brand and responsive public landing experience.
- Seller creation, buyer acceptance, agreement history, evidence, delivery, inspection, ratings, chat, reporting, moderation, dispute, and payment-sandbox concepts.
- Supabase/Postgres schema with RLS used across many feature tables.
- Stripe Sandbox Edge Functions for Connect, Checkout, webhooks, release, and dispute resolution.
- Explicit customer messaging that the beta is not legal escrow.
- Reversible deployment and preview workflow through GitHub and Vercel.

### Production gaps confirmed in the current code

| Area | Current evidence | Required outcome |
|---|---|---|
| Application structure | `src/app.tsx` is over 2,000 lines and feature CSS is highly fragmented | Route and domain modules with isolated responsibilities and a governed component system |
| Automated quality | No unit, integration, E2E, RLS, accessibility, or visual-regression test files | A CI-enforced test suite covering happy, failure, abuse, and recovery paths |
| Dependency governance | Several packages use `latest` | Exact versions, automated update review, lockfile policy, and dependency scanning |
| Authentication | Browser bearer session is stored in `localStorage` | Server-managed or equivalently hardened session boundary, strict CSP, token rotation, and session revocation |
| Database delivery | Base schema plus many manually ordered setup SQL files | Versioned, repeatable migrations tested from an empty database and through upgrades |
| Authorization | RLS exists, but there is no automated negative authorization suite | Every table, view, function, bucket, and admin action has deny-by-default tests |
| Payments | Sandbox-only implementation is a good safety boundary | Provider-approved live architecture, atomic/idempotent event handling, reconciliation, refunds, chargebacks, and operations |
| KYC and e-sign | Provider interfaces are placeholders | Contracted providers, webhook state, manual-review path, privacy limits, and support procedures |
| Web security | `vercel.json` currently defines SPA rewrites only | CSP, HSTS, clickjacking, referrer, MIME, permissions, caching, and environment-specific headers |
| Edge Functions | Broad CORS and raw error behavior; webhook deduplication needs atomicity tests | Restricted origins, normalized errors, rate limits, atomic event claims, replay safety, and alerting |
| Observability | Private visitor analytics exists; production error and security monitoring are not complete | Errors, traces, audit events, uptime, payment alerts, security alerts, and on-call runbooks |
| Operations | Product screens exist without a complete staffed support model | Case queues, SLAs, escalation rules, refund authority, evidence policy, and incident response |

This assessment is a planning baseline, not a claim that every listed control is absent. Each control must be proven by a test or an operational record before it can be marked complete.

The first foundation batch has already pinned direct dependencies, standardized npm/lockfile usage,
added initial CI and foundation tests, and added an initial browser-security header policy. These
steps reduce the baseline gaps but do not replace the application, authorization, provider, and
independent verification required by the release gates. Ongoing evidence is recorded in
[09_PROGRESS_LOG.md](09_PROGRESS_LOG.md).

## 3. Product and engineering principles

1. **Facts, not guarantees.** Display what was verified, by whom, when, and with what limitation. Never label a person or deal “safe.”
2. **Provider-held sensitive credentials.** Dealivra does not store raw card, bank, government-ID, or biometric documents unless a separately approved requirement proves it necessary.
3. **Server authority.** The browser may request actions; it may not declare payment, verification, release, refund, dispute, or administrator truth.
4. **Deny by default.** Private records are unavailable unless a tested role and relationship grants access.
5. **One primary action.** Each workflow state has one clear next action in view without requiring a full-page scroll.
6. **Progressive disclosure.** Ordinary users see the minimum needed to complete the current step; details and records remain available without dominating the page.
7. **Accessible by construction.** WCAG 2.2 AA is part of component acceptance, not a final polish pass.
8. **No big-bang production change.** Each architectural change is independently deployable, reversible, monitored, and tested.
9. **Evidence over confidence.** “Done” requires test output, review evidence, or an operational drill.
10. **Country-by-country expansion.** A new country is a new regulated product configuration, not a language toggle.

## 4. Milestones and realistic schedule

The dates assume a core team of five to seven experienced people plus payments counsel and specialist security support.

| Milestone | Target window | Exit result |
|---|---|---|
| M0 — Production specification | Jul–Aug 2026 | This document set approved and mapped to the backlog |
| M1 — Architecture and design-system foundation | Aug–Oct 2026 | Modular shell, governed UI components, staging, CI, core tests |
| M2 — Secure product core | Oct 2026–Jan 2027 | Hardened auth, migrations, RLS tests, evidence controls, observability |
| M3 — Paid workflow pilot without holding funds | Nov 2026–Jan 2027 | Counsel-approved subscription/record fee and invited users |
| M4 — Provider-complete protected payments | Jan–May 2027 | Live-ready Connect/KYC architecture, reconciliation, disputes, support |
| M5 — Independent verification and closed beta | May–Sep 2027 | Pentest, load/accessibility tests, controlled real-money transactions |
| M6 — Wider US release | Oct 2027–Mar 2028 | Measured expansion after fraud, support, and reliability targets hold |
| M7 — First international market | Jul 2028 or later | Separate country assessment, providers, policies, localization, and beta |

External provider approval, banking review, legal analysis, or incident remediation can extend these dates. They must never be compressed by removing release gates.

## 5. Required team responsibilities

One person may hold more than one role early, but every responsibility must have a named owner.

| Responsibility | Minimum ownership |
|---|---|
| Product scope, metrics, customer research | Founder/Product Lead |
| Application architecture and technical quality | Senior Technical Lead |
| Backend, payments, database authorization | Senior Backend/Payments Engineer |
| Frontend, design system, accessibility | Frontend Engineer + Product Designer |
| Test automation and release evidence | QA Automation Engineer |
| Cloud security, secrets, monitoring, recovery | DevSecOps/Security Engineer |
| Funds flow, terms, privacy, prohibited goods | US Payments/Privacy Counsel |
| Fraud review, disputes, refunds, support | Trust & Safety Operations Lead |

No engineer may approve their own production payment release implementation without independent review.

## 6. Program metrics

### Product

- Median first deal creation under 3 minutes after onboarding.
- At least 60% of invited buyers understand the next required action without support.
- At least 40% invited-link-to-agreement conversion in the selected category.
- Fewer than 3% of sessions produce a support request caused by unclear navigation.
- At least 25% of pilot sellers create a second deal within 60 days.

### Reliability

- 99.9% monthly availability target after public release.
- 95th-percentile interactive page load under 2.5 seconds on defined mobile test conditions.
- Zero lost acknowledged payment webhooks.
- Recovery point objective at or below 15 minutes for payment/audit data.
- Recovery time objective at or below 4 hours for the initial public product.

### Security and operations

- Zero open critical or high findings at launch.
- 100% of public-schema objects included in authorization tests.
- 100% of privileged production accounts protected by phishing-resistant MFA where supported.
- 100% of payment/refund/release actions reconcile to provider records.
- All critical alerts acknowledged within 15 minutes during the controlled beta.

## 7. Decision and launch authority

### Changes the delivery team may make autonomously

- Reversible application, test, documentation, and design-system improvements.
- Non-production branches, preview deployments, staging migrations, and security scans.
- Refactors that preserve behavior and are covered by tests.
- Dependency updates that pass the full quality pipeline.

### Changes requiring an explicit production decision record

- Enabling real money, payouts, refunds, automatic release, or a new payment method.
- Changing payment liability, fees, dispute deadlines, or fund-release conditions.
- Collecting a new class of sensitive data.
- Publishing identity, contact, evidence, or reputation information.
- Enabling a new country, category with elevated risk, or external partner.
- Lowering a security, privacy, accessibility, or recovery gate.

### Actions requiring the founder or designated company officer

- Provider contracts and paid plans.
- Legal acceptance and corporate/banking information.
- Production secrets and live-mode activation.
- Final policy publication and customer pricing.
- Material deletion of production records or irreversible infrastructure changes.

## 8. Top program risks

| Risk | Likelihood/impact | Treatment |
|---|---|---|
| Product wording creates a false escrow or safety guarantee | High/High | Counsel review, controlled vocabulary, claim tests |
| Account takeover causes payment or evidence abuse | Medium/High | MFA, step-up auth, session controls, anomaly alerts, recovery controls |
| RLS/function mistake exposes a private deal | Medium/Critical | Deny-by-default migrations and automated cross-user authorization tests |
| Webhook replay/race creates incorrect payment state | Medium/Critical | Atomic event claiming, idempotency, state-transition constraints, reconciliation |
| Fraud losses exceed fee revenue | High/High | Low limits, one category, KYC, velocity controls, manual review, reserves |
| Support cannot handle disputes | Medium/High | Closed volume, case SLAs, evidence templates, refund authority, drills |
| Visual polish hides workflow complexity | High/Medium | Usability testing, one-primary-action rule, support-contact metric |
| Global expansion introduces unreviewed obligations | High/High | Country launch template and legal/provider approval per market |

## 9. Standards baseline

- [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/) Level 2 for the product, with selected Level 3 requirements for administration, payments, identity, and evidence.
- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework) for governance, protection, detection, response, and recovery.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) AA for web accessibility.
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) and tested RLS for every exposed object.
- Stripe-hosted Connect onboarding and Checkout to reduce collection of regulated identity and payment credentials.

Compliance with a framework is not inferred from using a provider. It must be demonstrated through evidence and, where appropriate, independent assessment.
