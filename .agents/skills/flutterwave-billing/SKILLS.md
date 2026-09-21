````markdown
---
name: flutterwave-billing
description: Use when implementing Flutterwave payments, payment initiation, payment verification, webhooks, paid plans, subscription state, billing access, payment failures, or Flutterwave integration.
---

# Flutterwave Billing Skill

This skill teaches the ordered workflow for the product's paid billing flow. Its laws live in `money-billing.md`, `security.md`, `AGENTS.md`, and the PRD.

## Procedure

1. Identify the billing operation: payment initiation, verification, webhook processing, or subscription access.
2. Authenticate the user for user-triggered billing operations.
3. Keep Flutterwave secrets server-side.
4. Create the payment request through the dedicated Flutterwave integration.
5. Never treat the frontend payment result as authoritative.
6. For completed payments, verify the payment server-side with Flutterwave.
7. For webhook events, validate the webhook before processing it.
8. Identify the corresponding user and billing transaction using trusted server-side data.
9. Check whether the event has already been processed.
10. Apply the billing state change only after successful verification.
11. Persist the authoritative subscription state.
12. Make webhook retries idempotent.
13. Keep billing state separate from expense records.
14. Handle failed or invalid payments without granting paid access.
15. Keep provider-specific Flutterwave code inside `lib/billing/flutterwave/`.

## Key Pattern

```ts
const payment = await flutterwave.verifyPayment(transactionId)

if (!payment.valid) {
  throw new PaymentVerificationError()
}

if (await isAlreadyProcessed(payment.id)) {
  return
}

await prisma.$transaction(async (tx) => {
  await recordVerifiedPayment(tx, payment)
  await updateSubscriptionState(tx, payment)
})
````

```text
Frontend
   ↓
Server payment initiation
   ↓
Flutterwave
   ↓
Server-side verification / webhook
   ↓
Idempotency check
   ↓
Authoritative billing state
```

## Common Traps

* Granting paid access because the frontend says payment succeeded.
* Trusting an unverified webhook.
* Processing the same webhook twice.
* Putting Flutterwave secrets in client code.
* Mixing billing state with expense data.
* Replacing Flutterwave with Stripe, Paystack, or another processor.
* Updating subscription state before payment verification.

## Verify Before Done

* [ ] Flutterwave is the only configured payment processor.
* [ ] Secrets remain server-side.
* [ ] Frontend payment state is never authoritative.
* [ ] Payments are verified server-side.
* [ ] Webhooks are validated.
* [ ] Duplicate webhook events are safe.
* [ ] Paid access requires verified payment state.
* [ ] Billing state is persisted.
* [ ] Expense records remain separate from billing records.
* [ ] Payment failures do not grant paid access.
* [ ] Write unit tests for payment state and idempotency.
* [ ] Write integration tests for verification and webhook handling.
* [ ] Write e2e tests for the paid-plan flow.

```
```
