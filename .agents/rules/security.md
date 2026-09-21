---
trigger: always_on
---


## `.agents/rules/security.md`

```markdown
# Security Rules

## Purpose

The application handles private financial information and payment-related data.

Security failures involving unauthorized access, data leakage, or payment state are critical failures.

## Rules

### 1. Server-Side Authorization Is Mandatory

Every protected operation must derive the authenticated `userId` from the server-side session.

Never trust:

```text
userId
planTier
paymentStatus
isPaid