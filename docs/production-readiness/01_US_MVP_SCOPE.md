# US MVP scope and product boundary

## 1. Target customer

### Seller

A US adult selling a personally owned used iPhone or similar compact electronic item through Facebook Marketplace, Craigslist, Instagram, WhatsApp, or a direct referral.

### Buyer

A US adult who received a private Dealivra link and wants clear item facts, price, condition, payment status, delivery evidence, and a structured problem-reporting path.

### Initial problem

Private-sale participants commonly lose context across messages, have ambiguous terms, do not know which action is next, and lack one coherent evidence record when something goes wrong.

## 2. Product promise

> Dealivra gives both parties one private workspace for agreed terms, verified status, payment progress, delivery evidence, inspection, and support records.

Approved supporting claims must be factual:

- “Identity check completed by [provider]” only after a provider event confirms it.
- “Payment confirmed by Stripe” only after a verified provider event.
- “Delivery recorded” only when the carrier or defined handoff evidence exists.
- “Agreement version accepted” only for the exact immutable version.

Prohibited claims before separate legal approval:

- “Legal escrow”
- “Guaranteed safe”
- “Fraud-free”
- “Insured” or “money-back guarantee”
- “Authenticated item” unless a contracted item-authentication provider made that determination
- “Legally binding everywhere”

## 3. Initial category rules

### Included

- Used smartphones.
- Tablets, laptops, smartwatches, and cameras only after the phone flow is stable.
- One item per deal.
- A defined minimum and maximum transaction value.
- In-person public-location handoff or trackable domestic shipping.

### Required category fields

- Brand and model.
- Storage/capacity when applicable.
- Condition with structured defect disclosure.
- Ownership declaration.
- Serial/IMEI last four for participant display.
- Full serial/IMEI encrypted or held by an approved verification provider only when required.
- Photos showing front, back, sides, screen-on state, and known damage.
- Activation-lock and carrier-lock disclosure.
- Included accessories.
- Delivery method and inspection expectations.

### Prohibited for initial release

- Stolen or activation-locked devices.
- Gift cards, cash equivalents, crypto, weapons, regulated goods, medical devices, tickets, services, vehicles, real estate, and cross-border transactions.
- Multiple sellers, multiple buyers, split payouts, auctions, and installment financing.

The prohibited-items policy must be public before inviting external pilot users.

## 4. Core user journey

### Seller

1. Creates an account and verifies email.
2. Creates one item record using the category template.
3. Adds required disclosures and evidence.
4. Selects in-person or domestic shipping.
5. Reviews exact terms and publishes a private Deal Link.
6. Shares the link with the intended buyer.
7. Completes required provider onboarding before protected payment becomes available.
8. Documents package or public meeting as instructed.
9. Responds to delivery, inspection, or support events.

### Buyer

1. Opens a private Deal Link and sees only approved public fields.
2. Signs in and confirms they are the intended participant.
3. Reviews item facts, limitations, seller status, fees, and agreement version.
4. Accepts the exact version.
5. Pays through the approved hosted provider when enabled.
6. Tracks shipment or confirms the public meeting.
7. Records inspection and receipt.
8. Completes the deal or reports a problem within the disclosed window.

### Support

1. Receives a structured case tied to one deal and payment.
2. Confirms authorization before viewing private evidence.
3. Preserves the record and blocks release where policy permits.
4. Requests only missing evidence.
5. Records every decision and communication.
6. Executes an approved provider action or closes the case with a reason.

## 5. MVP capability boundary

| Capability | Paid pilot | Protected-payment beta | Deferred |
|---|---|---|---|
| Private Deal Link and agreement | Yes | Yes | — |
| Category-specific evidence | Yes | Yes | More categories |
| Email verification | Yes | Yes | — |
| Government ID/KYC | Optional by risk | Required for sellers before payout | In-house document storage |
| Payment | External/informational or provider-approved record fee | Stripe-hosted buyer payment | Crypto, cash, financing |
| Fund release | No Dealivra custody | Provider flow after defined conditions | Automatic release without operations maturity |
| Disputes | Workflow/support record | Workflow plus provider actions | Binding arbitration service |
| Ratings | After completed participant deal | Yes | Universal trust score |
| Shipping | Supported US carriers/validated tracking | Yes | International customs |
| Language/currency | English/USD | English/USD | Additional locales and currencies |

## 6. First-revenue model

The first-revenue model must minimize regulatory and fraud exposure.

### Recommended sequence

1. **Closed workflow subscription or per-record fee:** charge the seller for Dealivra software after counsel confirms the terms. Do not hold the item price.
2. **Protected-payment transaction fee:** add only after Stripe approval, counsel review, reconciliation, refund/dispute operations, and paid-beta release gates.

Fees must be visible before agreement acceptance and again before Checkout. No hidden or post-acceptance fee changes are permitted.

## 7. Global-ready design without premature expansion

The code and data model must support:

- ISO country and currency codes.
- Locale-aware dates, numbers, addresses, and time zones.
- Provider capability by country.
- Country-specific policy and agreement versions.
- Configurable retention and age requirements.
- Translation keys rather than embedded customer copy.

Only `US`, `USD`, and `en-US` are enabled for the initial product. Disabled country support is not marketed as available.

## 8. Product success and stop conditions

### Continue if

- Users complete the core flow without staff guidance.
- Support volume and fraud loss remain within approved limits.
- Repeat seller use proves the workflow has value.
- Provider and legal reviews support the operating model.

### Pause expansion if

- Users misunderstand Dealivra as a guarantee or escrow.
- Authorization or evidence privacy defects are found.
- Reconciliation cannot explain every provider transaction.
- Dispute volume exceeds the staffed capacity.
- Chargebacks/fraud losses exceed the approved threshold.

