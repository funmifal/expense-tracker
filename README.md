# Expense Tracker

A single-user web application for tracking personal expenses. Users record expenses manually, organize them by category, set budgets, and monitor spending. Built with Next.js 14 (App Router), TypeScript, Prisma, and PostgreSQL.

The PRD (`docs/Expense_Tracker_PRD_v2.md`) is the source of truth. `docs/AGENTS.md` defines the locked technical and product rules.

---

## Resource Design

Design first. Five core resources, plus supporting audit/auth resources. Every identifier is a generated `cuid()`, never a sequential integer — sequential integers let anyone enumerate the whole dataset by counting.

### Relationships (one page)

```text
User
 ├─< Category >─< Expense >─ ExpenseHistory
 ├─< PaymentMethod >─< Expense
 ├─< Budget >─ BudgetPeriodSnapshot
 ├─< Session
 ├─< AiSuggestion
 └─< Notification
```

- A `User` owns every other resource. All queries are scoped by the authenticated `userId`.
- A `Category` belongs to a `User`; an `Expense` belongs to a `User` and exactly one `Category`.
- A `PaymentMethod` belongs to a `User`; an `Expense` optionally references one.
- A `Budget` belongs to a `User` and optionally a `Category` (null category = overall budget).
- `ExpenseHistory` belongs to an `Expense`. `BudgetPeriodSnapshot` belongs to a `Budget`.

### Core Resources

**User** — the account owner. Identifier: `id` (cuid).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `email` | String | yes | Unique |
| `passwordHash` | String | yes | Never plaintext |
| `currency` | String | yes | Defaults to `"USD"`; locked after signup |
| `planTier` | PlanTier enum | yes | Defaults to `FREE` (`FREE` \| `PAID`) |
| `createdAt` | DateTime | yes | Auto |
| `updatedAt` | DateTime | yes | Auto |

**Expense** — an amount the user spent. Identifier: `id` (cuid).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `userId` | String | yes | Owner; FK to `User` |
| `amountMinorUnits` | Int | yes | Integer cents — never Float |
| `currency` | String | yes | Account currency snapshot |
| `date` | DateTime | yes | UTC instant; timezone applied at query time |
| `categoryId` | String | yes | FK to `Category` |
| `paymentMethodId` | String | no | FK to `PaymentMethod` |
| `description` | String | no | Free text |
| `isDeleted` | Boolean | yes | Defaults to `false` (soft delete) |
| `deletedAt` | DateTime | no | Set on soft delete; purged after 30 days |
| `createdAt` | DateTime | yes | Auto |
| `updatedAt` | DateTime | yes | Auto |

**Category** — user-defined grouping for expenses. Identifier: `id` (cuid).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `userId` | String | yes | Owner; FK to `User` |
| `name` | String | yes | Unique per user (`@@unique([userId, name])`) |
| `isDefault` | Boolean | yes | Defaults to `false`; seeded defaults use `true` |
| `createdAt` | DateTime | yes | Auto |

**PaymentMethod** — how an expense was paid. Identifier: `id` (cuid).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `userId` | String | yes | Owner; FK to `User` |
| `name` | String | yes | Unique per user (`@@unique([userId, name])`) |

**Budget** — a monthly spending limit, overall or per category. Identifier: `id` (cuid).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `userId` | String | yes | Owner; FK to `User` |
| `categoryId` | String | no | FK to `Category`; null = overall budget |
| `amountMinorUnits` | Int | yes | Integer cents |
| `periodStart` | DateTime | yes | Start of month (user timezone), stored UTC |
| `createdAt` | DateTime | yes | Auto |
| `updatedAt` | DateTime | yes | Auto |

### Supporting Resources

**ExpenseHistory** — immutable audit trail for expense edits. Retained 1 year independently of the expense.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `expenseId` | String | yes | FK to `Expense` |
| `changedAt` | DateTime | yes | Auto |
| `changedBy` | String | yes | userId; AI never writes here |
| `fieldName` | String | yes | Field that changed |
| `oldValue` | String | yes | Prior value |
| `newValue` | String | yes | New value |

**BudgetPeriodSnapshot** — preserves historical budget usage when a budget is edited mid-period or a period closes.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `budgetId` | String | yes | FK to `Budget` |
| `userId` | String | yes | FK to `User` |
| `categoryId` | String | no | Null = overall |
| `periodStart` | DateTime | yes | Period the snapshot covers |
| `budgetAmountMinorUnits` | Int | yes | Budget value in effect |
| `spentMinorUnits` | Int | yes | Non-deleted spend at snapshot time |
| `closedAt` | DateTime | yes | Auto |

**Session** — database-backed auth session (server-side revocable).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `userId` | String | yes | FK to `User` |
| `sessionToken` | String | yes | Unique |
| `expiresAt` | DateTime | yes | Expiry |
| `createdAt` | DateTime | yes | Auto |

**AiSuggestion** — an AI proposal awaiting explicit user action. Never writes to `Expense`/`Budget` directly.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `userId` | String | yes | FK to `User` |
| `type` | AiSuggestionType enum | yes | `CATEGORIZATION` \| `SUMMARY` \| `ANOMALY` \| `BUDGET_SUGGESTION` |
| `status` | AiSuggestionStatus enum | yes | Defaults to `PENDING` |
| `inputSummary` | Json | yes | What was sent; no raw PII |
| `outputPayload` | Json | yes | Validated AI output |
| `confidence` | Float | no | 0–1 |
| `targetExpenseId` | String | no | Dedup key component |
| `createdAt` | DateTime | yes | Auto |
| `resolvedAt` | DateTime | no | When accepted/rejected |

**Notification** — in-app alert (budget thresholds, AI insight ready).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `userId` | String | yes | FK to `User` |
| `type` | NotificationType enum | yes | `BUDGET_WARNING` \| `BUDGET_EXCEEDED` \| `AI_INSIGHT_READY` |
| `message` | String | yes | Display text |
| `isRead` | Boolean | yes | Defaults to `false` |
| `createdAt` | DateTime | yes | Auto |

### Identifier Strategy

All resources use `@id @default(cuid())` — a generated, collision-resistant, non-sequential string. This prevents dataset enumeration by counting. IDs are never reused and never exposed as a predictable sequence.

### Money Strategy

Authoritative money is stored as `Int` minor units (integer cents). Never `Float`, never floating-point arithmetic. This is a locked v1 decision for the single-currency assumption.
