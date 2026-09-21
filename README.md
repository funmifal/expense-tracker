# Expense Tracker — API Reference

A single-user web application for tracking personal expenses: record expenses, group them by category, set monthly budgets, and monitor spending against the budget. This document is the complete reference for the REST API, which is the only way to read and write data.

The product requirements live in `docs/Expense_Tracker_PRD_v2.md` (source of truth) and the locked technical/product rules in `docs/AGENTS.md`.

---

## Base URL

All endpoints are mounted under a versioned prefix:

```
http://localhost:3000/api/v1
```

Every route under `/api/` (including these) is subject to rate limiting — see [Rate limiting](#rate-limiting).

---

## Conventions

### Request/response format

- Request and response bodies are `application/json`.
- Money is expressed in **integer minor units** (e.g. USD cents). Never floats. A currency code (ISO 4217, 3 letters) accompanies each amount.
- Dates are ISO 8601 UTC instants: `2025-06-15T12:00:00.000Z`. Budget `periodStart` values are normalized to the first day of the UTC month.

### Authentication

All endpoints except `POST /auth/register`, `POST /auth/login`, and `POST /auth/logout` require an authenticated session. Every query and mutation is scoped to the authenticated user; there is no way to read or write another user's data.

Provide the session either way:

| Method | How |
|--------|-----|
| Cookie (default) | Register/login set the `next-auth.session-token` cookie (httpOnly, 30-day session). Send it back with every request. |
| Bearer token | Send `Authorization: Bearer <token>` using the same 64-character session token the cookie contains. |

Unauthenticated requests return `401 UNAUTHORIZED`.

### Response envelope

Every response is wrapped in an envelope so a client can decode success vs. failure exactly once, without inspecting status codes or nesting:

**Success (single resource)**

```json
{
  "data": { ... }
}
```

**Success (list)**

```json
{
  "data": [ ... ],
  "meta": { "total": 25, "limit": 20, "offset": 0, "hasMore": true }
}
```

**Error**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "amountMinorUnits: Amount must be a positive integer in minor units (cents)",
    "details": [
      { "field": "amountMinorUnits", "message": "Amount must be a positive integer in minor units (cents)" }
    ]
  }
}
```

- `code` is a stable machine-readable string for programmatic branching.
- `message` is a human-readable description.
- `details` (present only on `VALIDATION_ERROR`) is an array of `{ field, message }`.

### Status codes and error codes

| HTTP | Error code | Meaning |
|------|-----------|---------|
| 200 | — | OK / updated |
| 201 | — | Created |
| 400 | `INVALID_QUERY` | Query parameter failed validation (per-endpoint rules below) |
| 400 | `INVALID_ID` | Path identifier is not a valid generated identifier format |
| 400 | `INVALID_JSON` | Request body is not valid JSON |
| 401 | `UNAUTHORIZED` | Missing or invalid session |
| 401 | `INVALID_CREDENTIALS` | Wrong email/password on login |
| 404 | (`*_NOT_FOUND`) | Resource not found, or does not belong to the current user |
| 409 | `EMAIL_EXISTS`, `CATEGORY_EXISTS`, `PAYMENT_METHOD_EXISTS`, `BUDGET_EXISTS`, `CATEGORY_IN_USE` | Uniqueness or reference conflict |
| 422 | `VALIDATION_ERROR` | Request body failed schema validation; see `details` |
| 429 | `RATE_LIMITED` | Request count exceeded for the current window |
| 500 | `INTERNAL_ERROR` | Unexpected server error (bug — please report) |

Path identifiers are validated for format **before** lookup: clearly malformed ids → `400 INVALID_ID`; well-formed but nonexistent ids → `404`. Neither case produces a `500`.

### Pagination

List endpoints share the same parameters and metadata:

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `offset` | integer ≥ 0 | `0` | Index of the first row to return. Non-integer or negative → `400 INVALID_QUERY`. |
| `limit` | integer ≥ 1 | `20` | Page size, **clamped** to a maximum of `100` (`limit=5000` returns 100). Non-integer or < 1 → `400 INVALID_QUERY`. |

`meta.total` is the count before pagination; `meta.hasMore` tells you another page exists (`offset + limit < total`).

### Sorting and filtering

- `sort=<field>` over a per-resource allow-list; `order=asc|desc`. Unknown `sort` or `order` values → `400 INVALID_QUERY` (never silently ignored). Defaults are listed per endpoint.
- Every list supports at least two filters, listed per endpoint. Blank (`""`) query values are treated as absent. Unparseable values (e.g. a non-date `startDate`) → `400 INVALID_QUERY`, never a `500`.

### Rate limiting

Every `/api` request is counted per client IP in a fixed window (default `100` requests / `60_000` ms, configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` in `.env`). Constants live in `config/rate-limit.ts`.

- All API responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Over the cap: `429 RATE_LIMITED` with `Retry-After: <seconds remaining>` and the standard error envelope.

---

## Quick start

```bash
npm install
# create .env with DATABASE_URL (PostgreSQL) — see .env.example
npx prisma migrate dev
npm run seed        # optional: 300 users + realistic data (password for all: Password123!)
npm run dev
```

The server listens on `http://localhost:3000`; the API root is `http://localhost:3000/api/v1`.

Verify behavior end-to-end with the integration suite against a running server:

```bash
powershell -ExecutionPolicy Bypass -File scripts/api-integration-tests.ps1 -BaseUrl http://localhost:3000
```

The examples below use a cookie jar for the session; both `next-auth.session-token` cookie and `Authorization: Bearer <token>` forms are equivalent.

---

## Endpoints

### Authentication and users

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Create an account, seed defaults, start a session |
| POST | `/api/v1/auth/login` | Authenticate and start a session |
| POST | `/api/v1/auth/logout` | Revoke the session and clear the cookie |
| POST | `/api/v1/users` | Alias of register (same request/response) |
| GET | `/api/v1/users/me` | Current user profile |

#### POST /api/v1/auth/register

Creates a user, seeds the user's default categories and payment methods, starts a session, and sets the `next-auth.session-token` cookie. **201.**

**Request body** — all fields via JSON:

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `email` | string | yes | — | Must be a valid email address; unique across the system |
| `password` | string | yes | — | At least 8 characters |
| `currency` | string | no | `"USD"` | ISO 4217, exactly 3 letters; locked after signup (no update endpoint) |

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{"email":"ada@example.com","password":"correct horse battery","currency":"USD"}'
```

**Example response — 201**

```json
{
  "data": {
    "user": {
      "id": "clzusr0000000000000000001",
      "email": "ada@example.com",
      "currency": "USD",
      "planTier": "FREE"
    }
  }
}
```

**Errors:** `400 INVALID_JSON`, `409 EMAIL_EXISTS`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

#### POST /api/v1/auth/login

Validates credentials and starts a session (sets the cookie). **200.**

**Request body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | yes | Valid email format |
| `password` | string | yes | Non-empty |

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{"email":"ada@example.com","password":"correct horse battery"}'
```

**Example response — 200**

```json
{
  "data": {
    "user": {
      "id": "clzusr0000000000000000001",
      "email": "ada@example.com",
      "currency": "USD",
      "planTier": "FREE"
    }
  }
}
```

**Errors:** `400 INVALID_JSON`, `401 INVALID_CREDENTIALS`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

#### POST /api/v1/auth/logout

Revokes the session (if any) and clears the cookie. **200.** Does not require a valid session.

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/logout -b cookies.txt -c cookies.txt
```

**Example response — 200**

```json
{ "data": { "success": true } }
```

**Errors:** `429 RATE_LIMITED`.

#### POST /api/v1/users

Identical to `POST /auth/register` (same request body, response, cookie behavior, and errors). **201.**

#### GET /api/v1/users/me

Returns the authenticated user's profile. **200.** No query parameters.

```bash
curl -i http://localhost:3000/api/v1/users/me -b cookies.txt
```

**Example response — 200**

```json
{
  "data": {
    "user": {
      "id": "clzusr0000000000000000001",
      "email": "ada@example.com",
      "currency": "USD",
      "planTier": "FREE",
      "createdAt": "2025-06-01T09:12:33.100Z",
      "updatedAt": "2025-06-01T09:12:33.100Z"
    }
  }
}
```

**Errors:** `401 UNAUTHORIZED`, `404 USER_NOT_FOUND`, `429 RATE_LIMITED`.

---

### Categories

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/categories` | List (paged, filterable, sortable) |
| POST | `/api/v1/categories` | Create |
| GET | `/api/v1/categories/:id` | Fetch one |
| PATCH | `/api/v1/categories/:id` | Update name / default flag |
| DELETE | `/api/v1/categories/:id` | Delete (blocked while referenced) |

A **Category** groups expenses. Categories are unique per user (name), and nine default categories are created on registration (`Housing`, `Groceries`, `Dining Out`, `Utilities`, `Transportation`, `Entertainment`, `Health`, `Shopping`, `Subscriptions`). A category object is:

```json
{
  "id": "clzcat0000000000000000001",
  "userId": "clzusr0000000000000000001",
  "name": "Groceries",
  "isDefault": false,
  "createdAt": "2025-06-01T09:15:00.000Z"
}
```

#### GET /api/v1/categories

Lists the current user's categories sorted by `name` ascending. **200.**

**Query parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `name` | string | absent | Case-insensitive substring (`"gro"` matches `"Groceries"`) |
| `isDefault` | `"true"` \| `"false"` | absent | Filter by default flag |
| `limit` | integer ≥ 1 | `20` | Clamped to 100 |
| `offset` | integer ≥ 0 | `0` | |
| `sort` | `name` \| `createdAt` | `name` | Unknown value → `400 INVALID_QUERY` |
| `order` | `asc` \| `desc` | `asc` | |

```bash
curl -i "http://localhost:3000/api/v1/categories?isDefault=true&limit=2" -b cookies.txt
```

**Example response — 200**

```json
{
  "data": [
    { "id": "clzcat0000000000000000001", "userId": "clzusr0000000000000000001", "name": "Dining Out", "isDefault": true, "createdAt": "2025-06-01T09:12:33.100Z" },
    { "id": "clzcat0000000000000000002", "userId": "clzusr0000000000000000001", "name": "Groceries", "isDefault": true, "createdAt": "2025-06-01T09:12:33.100Z" }
  ],
  "meta": { "total": 9, "limit": 2, "offset": 0, "hasMore": true }
}
```

**Errors:** `400 INVALID_QUERY`, `401 UNAUTHORIZED`, `429 RATE_LIMITED`.

#### POST /api/v1/categories

Creates a category. **201.**

**Request body:**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `name` | string | yes | — | 1–100 chars, trimmed; unique per user |
| `isDefault` | boolean | no | `false` | |

```bash
curl -i -X POST http://localhost:3000/api/v1/categories \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"name":"Pet Care"}'
```

**Example response — 201** (the created category object)

```json
{
  "data": {
    "id": "clzcat0000000000000000003",
    "userId": "clzusr0000000000000000001",
    "name": "Pet Care",
    "isDefault": false,
    "createdAt": "2025-06-10T14:02:11.000Z"
  }
}
```

**Errors:** `400 INVALID_JSON`, `409 CATEGORY_EXISTS`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `429 RATE_LIMITED`.

#### GET /api/v1/categories/:id

Fetches one category. **200.** No query parameters.

```bash
curl -i http://localhost:3000/api/v1/categories/clzcat0000000000000000001 -b cookies.txt
```

**Example response — 200** — the category object (same shape as the POST example).

**Errors:** `400 INVALID_ID`, `401 UNAUTHORIZED`, `404 CATEGORY_NOT_FOUND`, `429 RATE_LIMITED`.

#### PATCH /api/v1/categories/:id

Updates the name and/or the default flag. **200.** Only the fields you send are changed. Cannot rename to a name already used by another of the user's categories.

**Request body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | no | 1–100 chars; must stay unique per user |
| `isDefault` | boolean | no | |

```bash
curl -i -X PATCH http://localhost:3000/api/v1/categories/clzcat0000000000000000003 \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"name":"Pets"}'
```

**Example response — 200** — the updated category object.

**Errors:** `400 INVALID_ID`, `400 INVALID_JSON`, `401 UNAUTHORIZED`, `404 CATEGORY_NOT_FOUND`, `409 CATEGORY_EXISTS`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

#### DELETE /api/v1/categories/:id

Permanently deletes a category. **200.** Fails with `409 CATEGORY_IN_USE` when the category is referenced by any expense or budget — reassign or delete those first.

```bash
curl -i -X DELETE http://localhost:3000/api/v1/categories/clzcat0000000000000000003 -b cookies.txt
```

**Example response — 200** — the deleted category object.

**Errors:** `400 INVALID_ID`, `401 UNAUTHORIZED`, `404 CATEGORY_NOT_FOUND`, `409 CATEGORY_IN_USE`, `429 RATE_LIMITED`.

---

### Payment methods

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/payment-methods` | List (paged, filterable, sortable) |
| POST | `/api/v1/payment-methods` | Create |
| GET | `/api/v1/payment-methods/:id` | Fetch one |
| PATCH | `/api/v1/payment-methods/:id` | Rename |
| DELETE | `/api/v1/payment-methods/:id` | Delete (expenses keep working) |

A **PaymentMethod** records how an expense was paid. Four defaults are created on registration (`Cash`, `Credit Card`, `Debit Card`, `Bank Transfer`). Names are unique per user. A payment method object is:

```json
{
  "id": "clzpay0000000000000000001",
  "userId": "clzusr0000000000000000001",
  "name": "Credit Card"
}
```

Deleting a payment method sets `paymentMethodId` to null on the expenses that referenced it — expenses are never deleted or blocked.

#### GET /api/v1/payment-methods

Lists the current user's payment methods sorted by `name` ascending. **200.**

**Query parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `name` | string | absent | Case-insensitive substring |
| `id` | string | absent | Exact id match |
| `limit` | integer ≥ 1 | `20` | Clamped to 100 |
| `offset` | integer ≥ 0 | `0` | |
| `sort` | `name` \| `id` | `name` | Unknown value → `400 INVALID_QUERY` |
| `order` | `asc` \| `desc` | `asc` | |

```bash
curl -i "http://localhost:3000/api/v1/payment-methods?sort=id&limit=2" -b cookies.txt
```

**Example response — 200**

```json
{
  "data": [
    { "id": "clzpay0000000000000000001", "userId": "clzusr0000000000000000001", "name": "Cash" },
    { "id": "clzpay0000000000000000002", "userId": "clzusr0000000000000000001", "name": "Credit Card" }
  ],
  "meta": { "total": 4, "limit": 2, "offset": 0, "hasMore": true }
}
```

**Errors:** `400 INVALID_QUERY`, `401 UNAUTHORIZED`, `429 RATE_LIMITED`.

#### POST /api/v1/payment-methods

Creates a payment method. **201.**

**Request body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | 1–100 chars, trimmed; unique per user |

```bash
curl -i -X POST http://localhost:3000/api/v1/payment-methods \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"name":"Mobile Money"}'
```

**Example response — 201** — the created payment method object.

**Errors:** `400 INVALID_JSON`, `409 PAYMENT_METHOD_EXISTS`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `429 RATE_LIMITED`.

#### GET /api/v1/payment-methods/:id

Fetches one payment method. **200.**

```bash
curl -i http://localhost:3000/api/v1/payment-methods/clzpay0000000000000000001 -b cookies.txt
```

**Example response — 200** — the payment method object.

**Errors:** `400 INVALID_ID`, `401 UNAUTHORIZED`, `404 PAYMENT_METHOD_NOT_FOUND`, `429 RATE_LIMITED`.

#### PATCH /api/v1/payment-methods/:id

Renames a payment method. **200.** Cannot rename to a name already used by the user.

**Request body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | 1–100 chars; must stay unique per user |

```bash
curl -i -X PATCH http://localhost:3000/api/v1/payment-methods/clzpay0000000000000000005 \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"name":"Bank Transfer"}'
```

**Example response — 200** — the updated payment method object.

**Errors:** `400 INVALID_ID`, `400 INVALID_JSON`, `401 UNAUTHORIZED`, `404 PAYMENT_METHOD_NOT_FOUND`, `409 PAYMENT_METHOD_EXISTS`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

#### DELETE /api/v1/payment-methods/:id

Permanently deletes a payment method. **200.** Referencing expenses keep working; their `paymentMethodId` becomes null.

```bash
curl -i -X DELETE http://localhost:3000/api/v1/payment-methods/clzpay0000000000000000005 -b cookies.txt
```

**Example response — 200** — the deleted payment method object.

**Errors:** `400 INVALID_ID`, `401 UNAUTHORIZED`, `404 PAYMENT_METHOD_NOT_FOUND`, `429 RATE_LIMITED`.

---

### Expenses

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/expenses` | List (paged, filtered, sorted; excludes soft-deleted) |
| POST | `/api/v1/expenses` | Create |
| GET | `/api/v1/expenses/:id` | Fetch one |
| PATCH | `/api/v1/expenses/:id` | Update (writes an audit history row) |
| DELETE | `/api/v1/expenses/:id` | Soft delete |

An **Expense** is a recorded amount spent. Expenses are soft-deleted (`isDeleted` + `deletedAt`): deleted expenses disappear from lists and returns `404`, but the row and history remain for audit. Expense list and fetch responses embed the full `category` and `paymentMethod` objects:

```json
{
  "id": "clzexp0000000000000000001",
  "userId": "clzusr0000000000000000001",
  "amountMinorUnits": 4820,
  "currency": "USD",
  "date": "2025-06-15T12:00:00.000Z",
  "categoryId": "clzcat0000000000000000001",
  "paymentMethodId": "clzpay0000000000000000001",
  "description": "Weekly groceries",
  "isDeleted": false,
  "deletedAt": null,
  "createdAt": "2025-06-15T12:05:00.000Z",
  "updatedAt": "2025-06-15T12:05:00.000Z",
  "category": {
    "id": "clzcat0000000000000000001",
    "userId": "clzusr0000000000000000001",
    "name": "Groceries",
    "isDefault": false,
    "createdAt": "2025-06-01T09:12:33.100Z"
  },
  "paymentMethod": {
    "id": "clzpay0000000000000000001",
    "userId": "clzusr0000000000000000001",
    "name": "Credit Card"
  }
}
```

`paymentMethod` is `null` when the expense has none.

#### GET /api/v1/expenses

Lists the current user's non-deleted expenses, sorted by `date` descending. **200.** Amount filters use minor units (cents).

**Query parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `categoryId` | string | absent | Exact category id (must belong to the user if used) |
| `paymentMethodId` | string | absent | Exact payment method id |
| `startDate` | date | absent | Expenses on or after this date (inclusive). ISO 8601, e.g. `2025-06-01` or `2025-06-01T00:00:00.000Z` |
| `endDate` | date | absent | Expenses on or before this date (inclusive) |
| `minAmount` | integer | absent | Minimum `amountMinorUnits` (inclusive) |
| `maxAmount` | integer | absent | Maximum `amountMinorUnits` (inclusive) |
| `limit` | integer ≥ 1 | `20` | Clamped to 100 |
| `offset` | integer ≥ 0 | `0` | |
| `sort` | `date` \| `amountMinorUnits` \| `createdAt` | `date` | Unknown value → `400 INVALID_QUERY` |
| `order` | `asc` \| `desc` | `desc` | |

```bash
curl -i "http://localhost:3000/api/v1/expenses?categoryId=clzcat0000000000000000001&startDate=2025-06-01&endDate=2025-06-30&order=asc&limit=20" -b cookies.txt
```

**Example response — 200**

```json
{
  "data": [ { "id": "clzexp0000000000000000001", "userId": "clzusr0000000000000000001", "amountMinorUnits": 4820, "currency": "USD", "date": "2025-06-15T12:00:00.000Z", "categoryId": "clzcat0000000000000000001", "paymentMethodId": "clzpay0000000000000000001", "description": "Weekly groceries", "isDeleted": false, "deletedAt": null, "createdAt": "2025-06-15T12:05:00.000Z", "updatedAt": "2025-06-15T12:05:00.000Z", "category": { "id": "clzcat0000000000000000001", "userId": "clzusr0000000000000000001", "name": "Groceries", "isDefault": false, "createdAt": "2025-06-01T09:12:33.100Z" }, "paymentMethod": { "id": "clzpay0000000000000000001", "userId": "clzusr0000000000000000001", "name": "Credit Card" } } ],
  "meta": { "total": 25, "limit": 20, "offset": 0, "hasMore": true }
}
```

**Errors:** `400 INVALID_QUERY`, `401 UNAUTHORIZED`, `429 RATE_LIMITED`.

#### POST /api/v1/expenses

Creates an expense. **201.**

**Request body:**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `amountMinorUnits` | integer > 0 | yes | — | Amount in minor units (cents) |
| `currency` | string | no | `"USD"` | ISO 4217, exactly 3 letters |
| `date` | date string | yes | — | ISO 8601, e.g. `"2025-06-15T12:00:00.000Z"` |
| `categoryId` | string | yes | — | Must be one of the user's categories |
| `paymentMethodId` | string / null | no | `null` | Must be one of the user's payment methods |
| `description` | string / null | no | `null` | At most 500 characters |

```bash
curl -i -X POST http://localhost:3000/api/v1/expenses \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"amountMinorUnits":2500,"currency":"USD","date":"2025-06-20T18:30:00.000Z","categoryId":"clzcat0000000000000000001","paymentMethodId":"clzpay0000000000000000001","description":"Lunch with team"}'
```

**Example response — 201** — the created expense object (with embedded `category` and `paymentMethod`).

**Errors:** `400 INVALID_JSON`, `401 UNAUTHORIZED`, `404 CATEGORY_NOT_FOUND` / `404 PAYMENT_METHOD_NOT_FOUND` (foreign key does not belong to the user), `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

#### GET /api/v1/expenses/:id

Fetches one expense. **200.** Soft-deleted expenses return `404`.

```bash
curl -i http://localhost:3000/api/v1/expenses/clzexp0000000000000000001 -b cookies.txt
```

**Example response — 200** — the expense object.

**Errors:** `400 INVALID_ID`, `401 UNAUTHORIZED`, `404 EXPENSE_NOT_FOUND`, `429 RATE_LIMITED`.

#### PATCH /api/v1/expenses/:id

Updates any subset of the expense's fields. **200.** Every field that actually changes is recorded as an audit row in `ExpenseHistory` (field, old value, new value, change timestamp, actor) — there is no read endpoint for this audit trail in v1.

**Request body:** any subset of the create fields (same types; `description` and `paymentMethodId` accept `null` to clear them):

| Field | Type | Notes |
|-------|------|-------|
| `amountMinorUnits` | integer > 0 | |
| `currency` | string | 3 letters |
| `date` | date string | ISO 8601 |
| `categoryId` | string | Must belong to the user |
| `paymentMethodId` | string / null | Must belong to the user; `null` clears it |
| `description` | string / null | ≤ 500 chars; `null` clears it |

```bash
curl -i -X PATCH http://localhost:3000/api/v1/expenses/clzexp0000000000000000001 \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"amountMinorUnits":3100,"description":"Lunch — paid cash back"}'
```

**Example response — 200** — the updated expense object.

**Errors:** `400 INVALID_ID`, `400 INVALID_JSON`, `401 UNAUTHORIZED`, `404 EXPENSE_NOT_FOUND`, `404 CATEGORY_NOT_FOUND` / `404 PAYMENT_METHOD_NOT_FOUND` (new value), `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

#### DELETE /api/v1/expenses/:id

Soft-deletes an expense: sets `isDeleted: true` and `deletedAt`. **200.** The deleted expense is excluded from lists and reads (`404`) but its row and history remain. Repeating the request yields `404`.

```bash
curl -i -X DELETE http://localhost:3000/api/v1/expenses/clzexp0000000000000000001 -b cookies.txt
```

**Example response — 200**

```json
{
  "data": {
    "id": "clzexp0000000000000000001",
    "userId": "clzusr0000000000000000001",
    "amountMinorUnits": 4820,
    "currency": "USD",
    "date": "2025-06-15T12:00:00.000Z",
    "categoryId": "clzcat0000000000000000001",
    "paymentMethodId": "clzpay0000000000000000001",
    "description": "Weekly groceries",
    "isDeleted": true,
    "deletedAt": "2025-06-28T10:00:00.000Z",
    "createdAt": "2025-06-15T12:05:00.000Z",
    "updatedAt": "2025-06-28T10:00:00.000Z"
  }
}
```

**Errors:** `400 INVALID_ID`, `401 UNAUTHORIZED`, `404 EXPENSE_NOT_FOUND`, `429 RATE_LIMITED`.

---

### Budgets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/budgets` | List (paged, filtered, sorted) |
| POST | `/api/v1/budgets` | Create overall or per-category budget |
| GET | `/api/v1/budgets/:id` | Fetch one |
| PATCH | `/api/v1/budgets/:id` | Update amount (snapshots the previous period) |

A **Budget** is a monthly spending limit. It applies to all expenses in a given month (`categoryId` null = overall budget) or to one category's expenses. `.periodStart` is normalized to the first day of the UTC month. A budget object embeds its `category` (null for overall budgets):

```json
{
  "id": "clzbud0000000000000000001",
  "userId": "clzusr0000000000000000001",
  "categoryId": "clzcat0000000000000000001",
  "amountMinorUnits": 60000,
  "periodStart": "2025-06-01T00:00:00.000Z",
  "createdAt": "2025-06-01T10:00:00.000Z",
  "updatedAt": "2025-06-01T10:00:00.000Z",
  "category": {
    "id": "clzcat0000000000000000001",
    "userId": "clzusr0000000000000000001",
    "name": "Groceries",
    "isDefault": false,
    "createdAt": "2025-06-01T09:12:33.100Z"
  }
}
```

#### GET /api/v1/budgets

Lists the current user's budgets, sorted by `periodStart` descending. **200.**

**Query parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `categoryId` | string | absent | Only budgets for this category (overall budgets excluded) |
| `periodStart` | date | absent | Only budgets for this month (normalized to its UTC month start) |
| `limit` | integer ≥ 1 | `20` | Clamped to 100 |
| `offset` | integer ≥ 0 | `0` | |
| `sort` | `periodStart` \| `amountMinorUnits` \| `createdAt` | `periodStart` | Unknown value → `400 INVALID_QUERY` |
| `order` | `asc` \| `desc` | `desc` | |

```bash
curl -i "http://localhost:3000/api/v1/budgets?periodStart=2025-06-15&order=asc" -b cookies.txt
```

**Example response — 200**

```json
{
  "data": [
    {
      "id": "clzbud0000000000000000001",
      "userId": "clzusr0000000000000000001",
      "categoryId": "clzcat0000000000000000001",
      "amountMinorUnits": 60000,
      "periodStart": "2025-06-01T00:00:00.000Z",
      "createdAt": "2025-06-01T10:00:00.000Z",
      "updatedAt": "2025-06-01T10:00:00.000Z",
      "category": { "id": "clzcat0000000000000000001", "userId": "clzusr0000000000000000001", "name": "Groceries", "isDefault": false, "createdAt": "2025-06-01T09:12:33.100Z" }
    }
  ],
  "meta": { "total": 3, "limit": 20, "offset": 0, "hasMore": false }
}
```

**Errors:** `400 INVALID_QUERY`, `401 UNAUTHORIZED`, `429 RATE_LIMITED`.

#### POST /api/v1/budgets

Creates a budget for a month. **201.** At most one budget per (category, month), and at most one overall budget per month.

**Request body:**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `categoryId` | string / null | no | `null` | Omit or use `null` for an overall budget; otherwise must be the user's category |
| `amountMinorUnits` | integer > 0 | yes | — | Monthly limit in minor units |
| `periodStart` | date string | yes | — | Any date in the month; normalized to the first of the UTC month, e.g. `"2025-06-15"` → `2025-06-01` |

```bash
curl -i -X POST http://localhost:3000/api/v1/budgets \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"categoryId":"clzcat0000000000000000001","amountMinorUnits":60000,"periodStart":"2025-06-15"}'
```

**Example response — 201** — the created budget object.

**Errors:** `400 INVALID_JSON`, `401 UNAUTHORIZED`, `404 CATEGORY_NOT_FOUND`, `409 BUDGET_EXISTS`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

#### GET /api/v1/budgets/:id

Fetches one budget. **200.**

```bash
curl -i http://localhost:3000/api/v1/budgets/clzbud0000000000000000001 -b cookies.txt
```

**Example response — 200** — the budget object.

**Errors:** `400 INVALID_ID`, `401 UNAUTHORIZED`, `404 BUDGET_NOT_FOUND`, `429 RATE_LIMITED`.

#### PATCH /api/v1/budgets/:id

Updates the budget amount. **200.** Before applying the change, the service snapshots the prior (budget amount, spent-so-far) pair for the period into `BudgetPeriodSnapshot`, so history and usage tracking work even when a budget is edited mid-month.

**Request body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `amountMinorUnits` | integer > 0 | yes | New monthly limit |

```bash
curl -i -X PATCH http://localhost:3000/api/v1/budgets/clzbud0000000000000000001 \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"amountMinorUnits":75000}'
```

**Example response — 200** — the updated budget object.

**Errors:** `400 INVALID_ID`, `400 INVALID_JSON`, `401 UNAUTHORIZED`, `404 BUDGET_NOT_FOUND`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

---

## Design decisions

### Why these resources were chosen

The five resources — `User`, `Category`, `PaymentMethod`, `Expense`, and `Budget` — are the minimal orthogonal set that covers the entire MVP workflow: a user records an amount spent (`Expense`), attaches it to a categorization (`Category`) and an optional way it was paid (`PaymentMethod`), and sets a spending constraint (`Budget`) measured against the recorded expenses. Each resource corresponds one-to-one with a PRD entity and became a top-level REST collection, giving the consumer UI exactly the read/write surface it needs and nothing more.

`User` exists as the account and permission boundary: every other resource carries an owning `userId`, and all queries are filtered by it, so authorization is enforced at the query layer rather than spread through route handlers. `Category` and `PaymentMethod` are deliberately lightweight lookups (name + ownership) because they power grouping, filtering, and the monthly budget roll-ups. `Budget` uses a `periodStart` month dimension (plus optional category) because monitoring spending per category per month is the core product promise.

Internal audit records — `ExpenseHistory` (field-level change log) and `BudgetPeriodSnapshot` (prior budget value vs. spent) — are derived from `Expense` and `Budget`. They are intentionally **not** exposed as top-level REST resources in v1: they exist to make the visible resources tamper-evident and auditable, not to be consumed directly.

### Why generated identifiers are used

Every identifier is a generated, collision-resistant, non-sequential string (`@id @default(cuid())`). The reasons are:

- **No dataset enumeration.** Sequential integers let any caller infer total volume ("how many expenses does user X have?") and probe the entire dataset by counting. Unpredictable ids prevent counting and blind iteration.
- **No cross-tenant leakage.** Because ids carry no sequence, an id seen on the wire reveals nothing about order, count, or neighboring records.
- **Statelessness.** cuid generation needs no coordination or central counter, so ids can be minted wherever writes happen without a sequence/lock.
- **URL safety and index friendliness.** cuids are URL-path-safe, sortable, and shard well as database keys.
- **No reuse.** A deleted id (e.g. a `Category` deleted after reassignments, or a soft-deleted `Expense`) is never reused, so historical references remain unambiguous.

### Why offset pagination was chosen

List endpoints use **offset + limit** pagination because it is the best fit for this API's scale and requirements:

- **Simplicity and statelessness.** `offset`/`limit` are plain query parameters — no cursors to persist, encode, or refresh. A page URL can be shared, bookmarked, or jumped to directly (`offset=200` to see page 11).
- **Arbitrary sort keys.** Offset works uniformly with every sortable field (dates, amounts, names) without needing a per-field cursor. Cursor (keyset) pagination would require a composite cursor indexed for each sort column.
- **Stable, small datasets.** The primary consumer is a single user's own records (hundreds, not millions, of rows), where `OFFSET` is efficient and the risk of page drift under concurrent writes is negligible.

The trade-off is acknowledged: under concurrent inserts/deletes, offset pages can skip or repeat a row because they reference a position, not an anchor. That is acceptable at this scale, and the `meta` block (`total`, `limit`, `offset`, `hasMore`) makes pagination state explicit and driveable by the client. If a future report endpoint must page through a high-churn dataset, a keyset cursor on the primary sort field is the documented upgrade path.

### Why the response envelope has this shape

Every response is wrapped as `{ "data": ... }`, `{ "data": [...], "meta": {...} }`, or `{ "error": { "code", "message", "details?" } }`. This shape was chosen because:

- **Uniform decode.** A client reads success or failure from a single stable structure rather than mapping many JSON shapes to status codes by hand. `"data"` and `"error"` are mutually exclusive, so "has `error`?" is the single discriminator.
- **Forward compatibility.** Because all fields live inside a fixed envelope, adding fields later (e.g. `meta` fields, extra `details`) never breaks existing client decoders — an unversioned envelope, by contrast, risks leaking new top-level keys into consumers.
- **Stable, branchable error codes.** `code` is an opaque, machine-readable stable string (e.g. `INVALID_QUERY`, `BUDGET_EXISTS`, `RATE_LIMITED`) that clients can branch on programmatically, while `message` is a human-readable description for display. `details` carries field-level validation issues so forms can render an error on the exact offending input.
- **List metadata travels with the data.** `meta` (count, page size, offset, `hasMore`) is beside the rows it describes, so pagination state and results are always consistent and arrive atomically.
- **Minimal nesting.** One wrapper level (`data`) keeps responses shallow and cheap to parse; the envelope itself never contains echoing metadata that would have to be carried on every round trip.