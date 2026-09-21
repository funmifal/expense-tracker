---
trigger: always_on
---


## `.agents/rules/money-billing.md`

```markdown
# Money and Billing Rules

## Purpose

This application handles monetary values and paid subscriptions.

Money calculations and billing state must be deterministic and independently verifiable.

## Rules

### 1. Money Uses Integer Minor Units

All monetary values must be represented internally as integer minor units.

Never use floating-point numbers for authoritative financial calculations.

### 2. Currency Must Be Explicit

Every authoritative monetary record must have an associated currency.

v1 supports one currency per user account.

Do not implement currency conversion unless explicitly requested.

### 3. Never Trust Client-Side Payment State

The browser may initiate or display a payment flow.

It must not be the authority for:

- payment success
- subscription activation
- paid plan access

### 4. Flutterwave Is the Payment Provider

Flutterwave is the mandatory payment processor for this application.

Do not implement Stripe, Paystack, or another payment gateway unless explicitly instructed.

All Flutterwave integration must be isolated behind the billing layer.

### 5. Verify Payments Server-Side

Successful payment must be confirmed through trusted server-side Flutterwave verification and/or a verified webhook event.

A frontend success callback alone is insufficient.

### 6. Webhooks Must Be Idempotent

A Flutterwave webhook may be delivered more than once.

Processing the same event repeatedly must not:

- duplicate subscription records
- duplicate payment records
- repeatedly grant entitlement
- corrupt plan state

Persist sufficient event/reference information to make processing idempotent.

### 7. Subscription State Must Be Deterministic

Paid access must be derived from authoritative billing state.

Do not allow a client-provided `planTier = PAID` to grant access.

### 8. Separate Payment From Financial Expenses

Subscription billing records must not be mixed with the user's personal expense records.

The user's tracked expenses are product data; subscription payments are platform billing data.

### 9. Payment Failures Must Fail Safely

If Flutterwave is unavailable or payment verification fails:

- do not grant paid access
- do not assume payment succeeded
- provide a safe retry path
- preserve the pending/unknown state where appropriate

### 10. No Floating-Point Aggregation

Do not calculate totals using JavaScript floating-point addition.

Use integer arithmetic throughout the financial domain.

### 11. Display Formatting Happens at the Boundary

Convert minor units to formatted currency only for presentation.

Do not store formatted strings as authoritative amounts.

### 12. Test Billing Independently

Automated tests must cover:

- successful payment verification
- failed payment
- duplicate webhook
- invalid webhook
- repeated webhook
- subscription activation
- subscription state changes
- unauthorized paid-feature access