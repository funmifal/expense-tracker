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

## Task 1 — Step 3: REST API

All routes live under `/api/v1/`. Collection endpoints support pagination (`limit` + `offset`), filtering, and sorting. Every response uses a consistent envelope.

### Conventions

- **Success** — `{ "data": ... }`
- **List** — `{ "data": [...], "meta": { "total", "limit", "offset", "hasMore" } }`
- **Error** — `{ "error": { "code", "message", "details?" } }` — `details` is an array of `{ field, message }` included on validation failures so the offending field is always identified.
- **Status codes** — `200` ok/updated, `201` created, `400` invalid query (`INVALID_QUERY`), malformed path identifier (`INVALID_ID`), or malformed JSON (`INVALID_JSON`), `401` unauthenticated (`UNAUTHORIZED`) or bad login (`INVALID_CREDENTIALS`), `404` not found, `409` conflict (duplicate email/category/payment method/budget, category in use), `422` body validation failure (`VALIDATION_ERROR`).
- **Auth** — every route requires a session. Send the `next-auth.session-token` cookie (set on register/login) or `Authorization: Bearer <token>`. All queries are scoped to the authenticated user. Rate limiting is deferred to a later step.
- **Validation** — request bodies and query parameters are defined and enforced with Zod schemas in one place (`lib/validation/schemas.ts`). Body failures → `422 VALIDATION_ERROR` with field details; query failures → `400 INVALID_QUERY` with field details.
- **Pagination** — `limit` (default `20`) is clamped to the configured maximum of `100` (e.g. `limit=5000` → `100`), never honoured as-is. `offset` (default `0`) must be a non-negative integer; `offset=-5` → `400`. `meta.total` is the pre-pagination count, `meta.hasMore` indicates another page exists.
- **Filtering (every list has ≥ 2 filters)** — see per-resource filters below. Unparseable filter values (e.g. a non-date `startDate`) return `400 INVALID_QUERY` and never a `500`.
- **Sorting** — `sort=<field>&order=asc|desc` over a per-resource allowlist. Unknown fields are rejected with `400 INVALID_QUERY` — never silently ignored.
- **Identifiers** — path ids are validated before lookup: clearly malformed ids → `400 INVALID_ID`; well-formed but nonexistent ids → `404`. Neither path ever produces a `500`.

### Endpoints

**Auth / Users**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Create user (email, password, currency) and start session → `201` |
| POST | `/api/v1/auth/login` | email + password → session cookie |
| POST | `/api/v1/auth/logout` | Revoke session and clear cookie |
| POST | `/api/v1/users` | Same as register (alias) |
| GET | `/api/v1/users/me` | Current user profile |

**Categories**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/categories` | List. Filters: `name` (partial, case-insensitive), `isDefault`. Sort: `name`, `createdAt` (default `name asc`) |
| POST | `/api/v1/categories` | Create (name must be unique per user) |
| GET | `/api/v1/categories/:id` | Fetch one |
| PATCH | `/api/v1/categories/:id` | Rename (must stay unique) |
| DELETE | `/api/v1/categories/:id` | Delete; `409 CATEGORY_IN_USE` if referenced by any expense or budget |

**Payment Methods**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/payment-methods` | List. Filters: `name` (partial, case-insensitive), `id`. Sort: `name`, `id` (default `name asc`) |
| POST | `/api/v1/payment-methods` | Create (name must be unique per user) |
| GET | `/api/v1/payment-methods/:id` | Fetch one |
| PATCH | `/api/v1/payment-methods/:id` | Rename |
| DELETE | `/api/v1/payment-methods/:id` | Delete; expenses keep working with `paymentMethodId` nulled |

**Expenses**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/expenses` | List (excludes soft-deleted). Filters: `categoryId`, `paymentMethodId`, `startDate`, `endDate`, `minAmount`, `maxAmount` (minor units). Sort: `date`, `amountMinorUnits`, `createdAt` (default `date desc`) |
| POST | `/api/v1/expenses` | Create (amountMinorUnits, date, categoryId required) |
| GET | `/api/v1/expenses/:id` | Fetch one |
| PATCH | `/api/v1/expenses/:id` | Update; writes an `ExpenseHistory` audit row |
| DELETE | `/api/v1/expenses/:id` | Soft delete (sets `isDeleted`/`deletedAt`; excluded from lists) |

**Budgets**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/budgets` | List. Filters: `periodStart` (client date, normalized to that UTC month), `categoryId`. Sort: `periodStart`, `amountMinorUnits`, `createdAt` (default `periodStart desc`) |
| POST | `/api/v1/budgets` | Create overall (`categoryId` omitted) or per-category budget (one per category per month) |
| GET | `/api/v1/budgets/:id` | Fetch one |
| PATCH | `/api/v1/budgets/:id` | Update amount; snapshots prior value for period |

---

## Status

**Step 1 (resource design) — complete.**
**Step 2 (seed data) — complete.** `prisma/seed.ts` populates a repeatable, idempotent dataset with `@faker-js/faker` (300 users, 2,700 categories, 1,200 payment methods, 2,700 budgets, 6,000 expenses, plus audit/history records). Running it again inserts nothing new.

**Step 3 (API endpoints) — complete.** All `/api/v1/` endpoints above implemented and verified end-to-end: pagination, filters, sorting, validation (422), conflict (409), not-found (404), auth (401), and malformed-query (400) cases all tested live; `npx tsc --noEmit` and `npm run build` pass.

**Step 4 (ugly inputs) — complete.** Query parameters and request bodies are validated with Zod schemas centralized in `lib/validation/schemas.ts`. `limit` is clamped to `100` (never honoured beyond the max), negative/zero/non-integer offsets and limits return `400 INVALID_QUERY`, unknown `sort`/`order` values return `400` instead of being ignored, malformed identifiers return `400 INVALID_ID` (absent ones `404`, never `500`), and `POST`/`PATCH` bodies missing or mistyping required fields return `422 VALIDATION_ERROR` with the offending field named in `error.details`.

Regression + bad-input coverage lives in `scripts/api-integration-tests.ps1` (67 checks). Run it against a running dev server:
`powershell -ExecutionPolicy Bypass -File scripts/api-integration-tests.ps1 -BaseUrl http://localhost:3000`

Not implemented yet: rate limiting, deployment, and the consumer UI (later steps).
