# Expense Tracker

A single-user web application for tracking personal expenses. Users record expenses manually, organize them by category, set budgets, and monitor spending. Built with Next.js 14 (App Router), TypeScript, Prisma, and PostgreSQL.

The PRD (`docs/Expense_Tracker_PRD_v2.md`) is the product source of truth. `docs/AGENTS.md` defines the locked technical and product rules.

---

## Task 1 — Resource Design

Design before code. This document defines **5 resource types**. Every identifier is a generated `cuid()`, never a sequential integer — sequential integers let anyone enumerate the whole dataset by counting.

### 1. Resource Types and Relationships

```text
User
 ├─< Category ──────< Expense
 ├─< PaymentMethod ─< Expense   (optional)
 └─< Budget
```

- A **User** owns every other resource. Every query is scoped by the authenticated `userId`.
- A **Category** belongs to one User and groups many Expenses.
- A **PaymentMethod** belongs to one User and is optionally referenced by many Expenses.
- An **Expense** belongs to one User, exactly one Category, and zero-or-one PaymentMethod.
- A **Budget** belongs to one User and optionally one Category (null Category = overall budget).

### 2. Field Definitions

**User** — the account owner. Identifier: `id` (generated cuid).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `email` | String | yes | Unique |
| `passwordHash` | String | yes | Never plaintext |
| `currency` | String | yes | Defaults to `"USD"`; locked after signup |
| `createdAt` | DateTime | yes | Auto-generated |
| `updatedAt` | DateTime | yes | Auto-updated |

**Category** — user-defined grouping for expenses. Identifier: `id` (generated cuid).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `userId` | String | yes | Owner; FK to User |
| `name` | String | yes | Unique per user |
| `isDefault` | Boolean | yes | Defaults to `false` |
| `createdAt` | DateTime | yes | Auto-generated |

**PaymentMethod** — how an expense was paid. Identifier: `id` (generated cuid).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `userId` | String | yes | Owner; FK to User |
| `name` | String | yes | Unique per user |

**Expense** — an amount the user spent. Identifier: `id` (generated cuid).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `userId` | String | yes | Owner; FK to User |
| `amountMinorUnits` | Int | yes | Integer cents — never Float |
| `currency` | String | yes | Account currency snapshot |
| `date` | DateTime | yes | UTC instant; timezone applied at query time |
| `categoryId` | String | yes | FK to Category |
| `paymentMethodId` | String | no | FK to PaymentMethod |
| `description` | String | no | Free text |
| `isDeleted` | Boolean | yes | Defaults to `false` (soft delete) |
| `deletedAt` | DateTime | no | Set on soft delete; purged after 30 days |
| `createdAt` | DateTime | yes | Auto-generated |
| `updatedAt` | DateTime | yes | Auto-updated |

**Budget** — a monthly spending limit, overall or per category. Identifier: `id` (generated cuid).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String (cuid) | yes | Generated primary key |
| `userId` | String | yes | Owner; FK to User |
| `categoryId` | String | no | FK to Category; null = overall budget |
| `amountMinorUnits` | Int | yes | Integer cents |
| `periodStart` | DateTime | yes | Start of month (user timezone), stored UTC |
| `createdAt` | DateTime | yes | Auto-generated |
| `updatedAt` | DateTime | yes | Auto-updated |

### 3. Identifier Strategy

Every resource uses `@id @default(cuid())` — a generated, collision-resistant, non-sequential string. This prevents dataset enumeration by counting. Identifiers are never reused and never exposed as a predictable sequence.

### 4. REST API Sufficiency

The 5 resources cover the MVP REST surface: `users` (auth), `categories`, `payment-methods`, `expenses`, and `budgets`. Each resource has a stable generated identifier for path parameters (e.g. `/api/expenses/:id`) and an owning `userId` on every user-scoped resource, so authorization can be enforced at the query layer. Internal audit records (`ExpenseHistory`, `BudgetPeriodSnapshot`) are derived from `Expense` and `Budget` and are not exposed as top-level REST resources in this design.

### 5. Money and Time Conventions

Authoritative money is stored as `Int` minor units (integer cents) — never `Float`. Expense dates are stored as UTC instants; the user's timezone is applied at query time. These are locked v1 decisions.

---

## Status

**Step 1 (resource design) — complete.**
**Step 2 (seed data) — complete.** `prisma/seed.ts` populates a repeatable, idempotent dataset with `@faker-js/faker` (300 users, 2,700 categories, 1,200 payment methods, 2,700 budgets, 6,000 expenses, plus audit/history records). Running it again inserts nothing new.

No API endpoints, pagination, filtering, sorting, rate limiting, deployment, or UI have been implemented yet.
