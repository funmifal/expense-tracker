# Expense Tracker — Product Requirements Document (v2)

*Revised following live cross-functional review. All corrections from the review are applied below. Changed or newly added text is marked inline with **[REVIEW FIX]** the first time it appears in each section.*

## 1. Product Summary

The product is a single-user web application for tracking personal expenses. It serves individuals — primarily students, young professionals, and budget-conscious adults — who want a simple, trustworthy way to see where their money goes. The core problem: most people either avoid tracking expenses because it's tedious, or use spreadsheets/apps that show raw data without insight. The product solves this by making manual entry fast, and by using AI as an assistive layer that categorizes, summarizes, and flags anomalies — without ever silently changing the user's financial data.

Core product loop: user logs an expense → system categorizes it (manually or via AI suggestion) → system updates totals and budget usage → user reviews spending patterns and AI insights → user adjusts behavior or budgets.

AI's role is strictly assistive: suggest categories, summarize spending, flag anomalies, suggest budget adjustments. AI never writes to authoritative financial records without explicit user acceptance.

**[REVIEW FIX]** AI is core to the full product vision but is **not present in MVP** (see §13). MVP validates the manual-tracking value proposition — fast entry, budgets, category breakdowns — independent of AI. Stakeholders should not expect AI features in the first release.

## 2. Problem Statement

- Users who track expenses manually (spreadsheets, notebooks) find it tedious and give up within weeks.
- Existing budgeting apps (Mint-style aggregators) require bank-account linking, which many users don't trust or don't have consolidated accounts for (e.g., students using cash, multiple cards).
- Users lack a simple feedback loop between "I spent money" and "here's what that means for my goals."
- Poor expense tracking leads to budget overruns, financial stress, and missed savings goals.
- This product exists to serve users who want manual control (accuracy, trust, no bank linking) plus lightweight AI assistance (less tedium, more insight) without automation risk.

**[REVIEW FIX] ASSUMPTION ADDED:** Users prioritize manual control and data privacy over auto-import convenience strongly enough to choose this product over bank-linked alternatives. This is a strategic bet grounded in one persona's stated preference, not validated market research across the full target segment (students, young professionals). It should be tested against real user behavior before being treated as settled product strategy.

## 3. Goals and Non-Goals

**Product goals:** Fast manual expense entry; clear budget visibility; assistive AI that reduces categorization effort and surfaces anomalies.

**User goals:** Understand spending in under 30 seconds per session; stay within self-set budgets; trust that the numbers are accurate.

**Business goals:** Build a retained free user base; **[REVIEW FIX]** convert free users to paid at a rate to be defined once pricing is set (see §8, §11 — OPEN QUESTION until pricing and baseline metrics exist).

**Technical goals:** Single deployable Next.js app; strict typing; accurate decimal-safe financial math; provider-neutral AI abstraction.

**Non-goals for v1:** Bank/account linking or transaction import; multi-user/household accounts; multi-currency conversion; investment tracking; mobile native apps; automated bill pay; AI-initiated financial actions of any kind.

## 4. User Personas

**Primary — "Ada," 24, graduate student.** Tracks spending inconsistently on a notes app. Goal: stay under a monthly discretionary budget. Pain point: forgets to log small cash purchases. Planning style: reactive, checks balance before big purchases. Tech behavior: mobile-first browser use, moderate patience for onboarding. Product matters because it turns 10-second entries into a monthly picture without bank linking.

**Primary — "Marcus," 29, early-career software engineer.** Uses a spreadsheet today. Goal: understand discretionary vs. fixed spending, catch subscription creep. Pain point: spreadsheet formulas break, no anomaly detection. Tech behavior: desktop-first, comfortable with tools, wants AI insight rather than manual charting.

**[REVIEW FIX]** *The original persona set included a third persona framed around single-income household budgeting. She was cut: her core need (household-level budgeting) contradicted the stated non-goal of shared/household accounts (§3), and keeping her risked implying a household feature was planned when it isn't. If a secondary persona is needed later, it should describe a single individual's budgeting need, not a household framing.*

Personas driving v1 decisions: Ada and Marcus (fast entry, AI-assisted categorization, budget alerts). Per Product Principle 9 (keep v1 focused), two personas are sufficient for MVP scope decisions.

## 5. Functional Requirements

| ID | Requirement | Description | Priority | Acceptance Criteria |
|----|-------------|-------------|----------|---------------------|
| FR-1 | Account creation | Email + password signup | P0 | User can register with a valid email and password meeting policy; duplicate email rejected |
| FR-2 | Login | Session-based auth | P0 | Valid credentials create a database session (see §7); invalid credentials rejected with generic error |
| FR-3 | Expense creation | Manual entry of amount, date, category, payment method, optional description | P0 | Expense persists with all required fields; invalid amount rejected |
| FR-4 | Expense editing | Edit any field on an existing expense | P0 | Edit creates an `ExpenseHistory` audit record of prior value; `updatedAt` changes |
| FR-5 | Expense deletion | Soft-delete an expense | P0 | Expense marked deleted, excluded from totals. **[REVIEW FIX]** Recoverable for 30 days (ASSUMPTION ADDED), after which a scheduled job hard-deletes the `Expense` row. `ExpenseHistory` audit records referencing the expense are retained for 1 year independent of the expense's deletion, for audit purposes (both retention windows are ASSUMPTION ADDED / OPEN QUESTION pending a formal data-retention policy) |
| FR-6 | Expense categories | CRUD on user-defined categories, seeded with defaults | P0 | User can create/rename/delete categories; deleting a category in use prompts reassignment |
| FR-7 | Payment methods | User-defined payment methods (cash, card, etc.) | P1 | User can create/edit/delete payment methods |
| FR-8 | Currency | Single currency per user account, set at signup | P0 (single) / OPEN QUESTION (multi) | All expenses stored in account currency; multi-currency is v2 |
| FR-9 | Search | Full-text search on description/category | P1 | Returns matching expenses within 500ms for typical account size |
| FR-10 | Filtering | Filter by date range, category, payment method, amount range | P0 | Filters combine with AND logic |
| FR-11 | Sorting | Sort by date, amount, category | P1 | Sort persists within session |
| FR-12 | Daily/weekly/monthly views | Aggregate totals by period | P0 | Totals match sum of non-deleted expenses in period, using user's timezone |
| FR-13 | Category breakdown | Spending by category for a selected period | P0 | Breakdown sums to period total |
| FR-14 | Budget creation | Monthly budget per category or overall | P0 | Budget stored with start-of-month boundary in user's timezone; at most one "overall" (null-category) budget per user per period (see §10) |
| FR-15 | Budget editing | Edit budget amount mid-period | P0 | **[REVIEW FIX]** Change applies prospectively; historical budget-usage is preserved via a `BudgetPeriodSnapshot` record written at the moment of the mid-period edit and at period close, so "was I over budget on day X" remains answerable after a later edit (see §10) |
| FR-16 | Budget monitoring | Real-time budget usage percentage | P0 | Usage = sum(non-deleted expenses in category+period) / current budget amount for the open period; closed/edited periods read from `BudgetPeriodSnapshot` |
| FR-17 | Budget alerts | Warn at 80% and 100%+ of budget | P1 | Alert fires once per threshold per period, not on every expense |
| FR-18 | Recurring expenses | User defines a recurring template (rent, subscriptions) | P1 | System auto-generates expense instances on schedule; user can edit/skip individual instances |
| FR-19 | Income tracking | Not included in v1 (ASSUMPTION ADDED — product idea only mentions expenses; confirmed as correctly scoped in review) | Out of scope v1 | N/A |
| FR-20 | Dashboard | Summary view: current month totals, budget status, recent AI insights | P0 | Loads in under 2s for accounts with up to 5,000 expenses |
| FR-21 | Reports | Exportable period summary (see FR-29) | P1 | Report reflects same totals as dashboard for the same period |
| FR-22 | AI categorization | Suggest a category on expense creation | P1 | Suggestion shown inline, one-tap accept, never auto-applied |
| FR-23 | AI insights | Periodic natural-language spending summary | P1 | Generated on-demand or daily batch (see §6); clearly labeled "AI-generated" |
| FR-24 | AI spending summaries | Same as FR-23, monthly rollup | P1 | — |
| FR-25 | AI budgeting suggestions | Suggest budget adjustments based on history | P2 | Suggestion requires explicit accept before budget changes |
| FR-26 | AI anomaly detection | Flag expenses that deviate from historical pattern | P1 | Flag is advisory only; user can dismiss |
| FR-27 | User approval flows | Accept/reject/edit UI for every AI suggestion type | P0 | No AI output writes to Expense/Budget tables without this flow |
| FR-28 | Notifications | In-app notifications for budget alerts and AI insights ready | P1 | Email notifications: OPEN QUESTION (requires provider selection) |
| FR-29 | Data export | CSV export of expenses for a date range | P1 | Export matches on-screen totals exactly |
| FR-30 | Settings | Manage categories, payment methods, currency (locked post-signup), notification prefs | P1 | — |

## 6. AI Processing Pipeline

**Trigger:** User action (submitting an expense, opening dashboard, requesting insights) or a daily batch job for monthly summaries.

**Authentication:** Server verifies session before any AI call; AI routes are not accessible unauthenticated.

**Feature access check:** Server checks the user's plan tier (free vs. paid) before invoking AI; free tier gets a capped number of AI calls/month (ASSUMPTION ADDED: 20 free AI actions/month; exact number is OPEN QUESTION pending unit-economics validation — see §9).

**Input validation:** Request payload (expense draft, date range) validated with a schema (zod) before use.

**Financial context assembly:** Server assembles only the minimum data needed per feature:
- *Categorization:* amount, free-text description (PII-filtered), last 20 categories used.
- **[REVIEW FIX] *Anomaly detection:*** the flagged expense's **amount, category, and date only — never the free-text description** — plus the user's rolling 90-day category-level statistics (mean, standard deviation). Free-text descriptions are sent for categorization requests only, never for anomaly detection. This is a stated rule, not a "where possible" preference.

**Privacy filtering:** Free-text descriptions are scanned for obvious PII patterns (account numbers, SSNs) before inclusion; flagged text is redacted before leaving the server. Full name, email, and any linked account identifiers are never sent to the AI provider.

**Prompt construction:** Server builds a structured prompt with explicit output schema instructions (JSON only).

**Provider selection:** Server reads active provider from config (Claude, DeepSeek, or other) behind a common interface (see §7).

**Server-side model call:** All calls happen server-side; API keys never reach the client.

**Timeout handling:** 10-second timeout (ASSUMPTION ADDED). On timeout, the feature fails gracefully — manual entry/categorization is unaffected, and the user sees "AI suggestion unavailable."

**Structured response:** Provider must return JSON matching a defined schema (category id, confidence 0–1, rationale string; or anomaly flag, severity, rationale).

**Response validation:** Server validates the JSON against the schema; invalid/malformed responses are discarded and treated as a failure, not silently coerced.

**Business-rule validation:** Suggested category IDs must exist and belong to the user; suggested amounts (if ever surfaced, e.g. "did you mean $45.00 not $4500.00") are never auto-applied and are always advisory.

**[REVIEW FIX] Deduplication:** AI requests are deduplicated by a client-generated idempotency key (`expenseId` + `requestType`). A duplicate request within a 60-second window (ASSUMPTION ADDED, tune based on production data) returns the existing pending `AiSuggestion` instead of creating a new one. Enforced by a unique constraint on `AiSuggestion` (see §10).

**Suggestion creation:** A row is written to `AiSuggestion` (status: pending) — this is separate from the `Expense` table.

**User review:** Suggestion is shown in the UI, clearly labeled "AI suggestion."

**Acceptance/rejection/editing:** User can accept (writes to Expense/Budget), reject (suggestion marked rejected, no write), or edit-then-accept (user-modified value is written, not the raw AI output).

**Database commit:** Only user-approved data reaches `Expense`/`Budget` tables, via the normal authenticated write path — the AI pipeline has no direct write access to those tables.

**Logging and analytics:** Suggestion shown/accepted/rejected events logged for the acceptance-rate metric (§11); financial content is not included in analytics logs, only suggestion IDs and outcomes.

**Data sent to AI:** amount, category history, expense description (PII-filtered, categorization only), date, aggregated historical spend.
**Data never sent:** name, email, password, session tokens, payment method identifiers, free-text descriptions for anomaly detection, raw account data beyond what's needed for the specific feature.
**AI confidence:** returned as 0–1 float, displayed as Low/Medium/High in UI.
**Failure handling:** timeout, provider error, malformed response, and rate-limit all map to the same user-facing state — feature temporarily unavailable, core tracking unaffected.
**Provider switching:** achieved via a config flag and a shared `AIProvider` interface (see §7); no business logic references a provider-specific SDK outside the adapter layer.

## 7. Technical Requirements

**Application architecture:** Single Next.js 14+ App Router application, deployed as one unit (per stack lock). Server Components for data-heavy pages; Client Components for interactive forms.

**Frontend architecture:** App Router route groups per feature (`/dashboard`, `/expenses`, `/budgets`, `/insights`, `/settings`); shared UI in `/components`.

**Backend architecture:** Route Handlers (`/app/api/*`) for mutations and AI calls; Server Actions for simple form submissions where appropriate.

**API structure (representative):**
- `POST /api/expenses` — create
- `PATCH /api/expenses/:id` — edit
- `DELETE /api/expenses/:id` — soft delete
- `GET /api/expenses` — list/filter/search
- `POST /api/budgets`, `PATCH /api/budgets/:id`
- `POST /api/ai/categorize` — returns AiSuggestion, does not write Expense (idempotency-key required)
- `POST /api/ai/insights` — returns AiSuggestion (summary type)
- `POST /api/ai/suggestions/:id/accept` — the only path that converts an AI suggestion into an authoritative write
- `GET /api/export` — CSV export

**[REVIEW FIX] Authentication:** Database sessions via Auth.js (ASSUMPTION ADDED — chosen over JWT specifically because it enables server-side session revocation, which is required to properly handle the "unauthorized access to another user's account" edge case and a future account-deletion flow). This is no longer an open question; see §10 for the corresponding `Session` model field.

**Authorization:** Every query scoped by `userId` derived from the server session, never from client-supplied IDs. Enforced at the Prisma query layer (all queries include `where: { userId }`).

**Validation:** zod schemas shared between client forms and API route handlers.

**Database access:** Prisma Client, single connection pool via a serverless-safe singleton pattern (`globalThis.prisma` in dev, per-instance in prod).

**API security:** Rate limiting per user/IP on AI routes and auth routes; CSRF protection on state-changing routes; input size limits.

**AI provider abstraction:** `interface AIProvider { categorize(input): Promise<CategorizationResult>; summarize(input): Promise<SummaryResult>; detectAnomaly(input): Promise<AnomalyResult>; }` with `ClaudeProvider` and `DeepSeekProvider` implementations selected by env config.

**Background jobs:** Recurring-expense generation, monthly AI summary batch, and the 30-day soft-delete purge job (FR-5) run via a scheduled job (OPEN QUESTION: cron via platform scheduler vs. external queue — depends on hosting choice).

**Notifications:** In-app notification table populated by server events; email delivery is OPEN QUESTION pending provider choice.

**Environment configuration:** `.env` per environment (dev/staging/prod), validated at boot with zod.

**Secrets management:** AI provider keys and DB credentials stored in platform secret manager, never in client bundle or repo.

**Logging:** Structured server-side logs; financial values excluded from error logs (errors reference expense ID, not amount).

**Error handling:** Centralized error handler maps internal errors to generic client-safe messages; stack traces never returned to client.

**Rate limiting:** Token-bucket per user on `/api/ai/*` and `/api/auth/*`.

**[REVIEW FIX] Database connection management:** A Prisma singleton is used regardless of deployment target, but the connection-pooling strategy (whether an external pooler such as PgBouncer or Prisma Accelerate is required) **is deferred pending the deployment-platform decision** (see §14). This is flagged as a blocking dependency to resolve before infrastructure work starts — it is not a settled part of this architecture yet.

**Deployment:** Single deployable app (per stack lock) — OPEN QUESTION: specific host not specified in product idea.

**Environments:** dev/staging/production with separate databases and separate AI provider keys (staging uses lower-cost/mock provider where possible).

**Testing strategy:** Unit tests for money math and AI response validation; integration tests for API routes with an authorization-bypass test suite (verify cross-user access is blocked); AI provider calls mocked in CI.

## 8. Business Model

| Tier | Price | Includes |
|------|-------|----------|
| Free | $0 | Unlimited manual tracking, budgets, search/filter, CSV export, **[REVIEW FIX] recurring expenses (FR-18)**; capped AI actions/month (ASSUMPTION ADDED: 20/month, pending unit-economics validation — see §9) |
| Paid | OPEN QUESTION (price not determinable from product idea) | Unlimited AI categorization/insights/anomaly detection, priority AI response |

**[REVIEW FIX]** Recurring expenses (FR-18) was moved from paid to free tier. It is a manual-tracking convenience feature with no AI dependency, and gating it behind payment contradicted Product Principle 5 ("manual expense tracking must work without AI") in spirit. The paid tier is now strictly and consistently AI-volume-gated.

Trial strategy: OPEN QUESTION — not specified whether paid tier offers a free trial.
Payment processor: OPEN QUESTION — not specified; must be explicitly chosen, not silently assumed.
What stays free forever: core manual tracking, including recurring expenses (Product Principle 5).
What requires payment: AI feature volume beyond the free cap.

## 9. Risks

| Risk | Type | Impact | Likelihood | Mitigation |
|------|------|--------|------------|------------|
| Floating-point money errors | Technical | High | Medium | Money stored as integer minor-units (cents), confirmed decision — never `Float` (see §10) |
| AI hallucinated category/amount | Product/AI | Medium | Medium | AI suggestions never auto-write; validated against real category list |
| AI provider outage | Technical | Medium | Medium | Timeout + graceful degradation; core tracking unaffected |
| Privacy leak to AI provider | Privacy/Legal | High | Low | PII filtering, data minimization, documented data-sent list (§6) |
| Unauthorized cross-user data access | Security | High | Low | Server-side userId scoping on every query, tested in CI; database sessions enable revocation (§7) |
| Duplicate expense entry | Product | Low | Medium | Optional client-side duplicate warning (same amount+date+category within 5 min) |
| Low free-to-paid conversion | Business | Medium | Medium | Validate AI value via acceptance-rate metric before hard paywall |
| AI cost overrun | Business/Technical | Medium | Medium | Per-user AI action caps, provider-neutral abstraction to switch to cheaper provider. **[REVIEW FIX]** Mitigation is provisional pending a unit-economics pass (cost per AI call × projected free-tier volume × cap) — the 20/month figure has not been validated against actual provider pricing |
| Database failure mid-write | Technical | Medium | Low | Transactional writes, idempotency keys on expense creation and AI requests |
| Poor adoption (tedium of manual entry) | Product | Medium | Medium | Fast-entry UX, AI-assisted categorization reduces friction |
| Scope creep (bank linking, multi-currency) | Product | Medium | High | Explicit non-goals in §3, phased roadmap in §13 |

## 10. Prisma Data Model

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  currency      String   @default("USD")
  planTier      PlanTier @default(FREE)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  expenses         Expense[]
  categories       Category[]
  budgets          Budget[]
  budgetSnapshots  BudgetPeriodSnapshot[]
  paymentMethods   PaymentMethod[]
  aiSuggestions    AiSuggestion[]
  notifications    Notification[]
  sessions         Session[]
}

// [REVIEW FIX] sessionToken added — database sessions are now the confirmed
// auth strategy (see §7), not an open question.
model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  sessionToken String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  @@index([userId])
}

model Category {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  name      String
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())

  expenses  Expense[]
  budgets   Budget[]

  @@unique([userId, name])
  @@index([userId])
}

model PaymentMethod {
  id       String    @id @default(cuid())
  userId   String
  user     User      @relation(fields: [userId], references: [id])
  name     String
  expenses Expense[]

  @@unique([userId, name])
  @@index([userId])
}

// [REVIEW FIX] Money storage is a confirmed v1 decision, not a hedge:
// integer minor-units (cents) for the account's single locked currency.
// This assumes two-decimal currencies (e.g. USD). Multi-currency in v2
// must revisit this for currencies with non-two-decimal minor units
// (e.g. JPY has 0, BHD has 3).
model Expense {
  id               String        @id @default(cuid())
  userId           String
  user             User          @relation(fields: [userId], references: [id])
  amountMinorUnits Int           // integer cents; never Float or unscaled Decimal
  currency         String
  date             DateTime      // stored as UTC instant; user timezone applied at query time
  categoryId       String
  category         Category      @relation(fields: [categoryId], references: [id])
  paymentMethodId  String?
  paymentMethod    PaymentMethod? @relation(fields: [paymentMethodId], references: [id])
  description      String?
  isDeleted        Boolean       @default(false)
  deletedAt        DateTime?     // [REVIEW FIX] soft-delete; hard-deleted by
                                  // scheduled job 30 days after deletedAt
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  history          ExpenseHistory[]

  @@index([userId, date])
  @@index([userId, categoryId])
  @@index([userId, isDeleted])
}

// [REVIEW FIX] Retained for 1 year independent of the parent Expense's
// deletion, for audit purposes (Product Principle 8).
model ExpenseHistory {
  id         String   @id @default(cuid())
  expenseId  String
  expense    Expense  @relation(fields: [expenseId], references: [id])
  changedAt  DateTime @default(now())
  changedBy  String   // userId; AI never writes here directly
  fieldName  String
  oldValue   String
  newValue   String

  @@index([expenseId])
}

// [REVIEW FIX] @@unique constraint added to prevent duplicate "overall"
// budgets per period. NOTE: Postgres unique constraints do not enforce
// uniqueness across multiple NULL values in categoryId, so the API layer
// must additionally reject a second null-category budget for the same
// user+period as defense-in-depth.
model Budget {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  categoryId       String?  // null = overall budget
  category         Category? @relation(fields: [categoryId], references: [id])
  amountMinorUnits Int
  periodStart      DateTime // start-of-month in user timezone, stored as UTC
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  snapshots        BudgetPeriodSnapshot[]

  @@unique([userId, categoryId, periodStart])
  @@index([userId, periodStart])
}

// [REVIEW FIX] New model. Written when a budget period closes, or
// immediately before a mid-period budget edit takes effect, so that
// historical "was I over budget" queries remain accurate after later
// edits (fixes the FR-15/FR-16 contradiction found in review).
model BudgetPeriodSnapshot {
  id                     String   @id @default(cuid())
  budgetId               String
  budget                 Budget   @relation(fields: [budgetId], references: [id])
  userId                 String
  user                   User     @relation(fields: [userId], references: [id])
  categoryId             String?
  periodStart            DateTime
  budgetAmountMinorUnits Int      // budget value in effect during this snapshot
  spentMinorUnits        Int      // sum of non-deleted expenses at snapshot time
  closedAt               DateTime @default(now())

  @@index([userId, periodStart])
  @@index([budgetId])
}

// [REVIEW FIX] Unique constraint added on (userId, targetExpenseId, type) to
// support idempotency-key deduplication of AI requests (§6).
model AiSuggestion {
  id              String             @id @default(cuid())
  userId          String
  user            User               @relation(fields: [userId], references: [id])
  type            AiSuggestionType
  status          AiSuggestionStatus @default(PENDING)
  inputSummary    Json               // what was sent, for audit — no raw PII
  outputPayload   Json               // raw validated AI output
  confidence      Float?
  targetExpenseId String?
  createdAt       DateTime           @default(now())
  resolvedAt      DateTime?

  @@unique([userId, targetExpenseId, type])
  @@index([userId, status])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      NotificationType
  message   String
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, isRead])
}

enum PlanTier {
  FREE
  PAID
}

enum AiSuggestionType {
  CATEGORIZATION
  SUMMARY
  ANOMALY
  BUDGET_SUGGESTION
}

enum AiSuggestionStatus {
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
}

enum NotificationType {
  BUDGET_WARNING
  BUDGET_EXCEEDED
  AI_INSIGHT_READY
}
```

**Modeling decisions:** Money is stored as `Int` minor units (cents) — a confirmed v1 decision valid for the single-currency/USD assumption, flagged for revisit at multi-currency (v2). `ExpenseHistory` provides the audit trail required by Product Principle 8. `BudgetPeriodSnapshot` closes the gap where a mid-period budget edit would otherwise silently rewrite historical budget-usage interpretation. `AiSuggestion` remains fully decoupled from `Expense`/`Budget` — no foreign key forces a write; acceptance is a separate authenticated action. The `Session` model now carries a `sessionToken` because database sessions (not JWT) are the confirmed auth strategy.

## 11. Success Metrics

| Metric | Definition | Measurement | Initial Target |
|--------|------------|-------------|-----------------|
| DAU | Users with ≥1 session/day | Session start events | No pre-launch target; establish baseline from first 60 days of production data |
| WAU | Users with ≥1 session/week | Session start events | Same as above |
| Expense logging frequency | Expenses logged per active user per week | Count(Expense created) / WAU | No pre-launch target; baseline from first 60 days |
| **[REVIEW FIX] Categorization acceptance rate** *(renamed from "categorization accuracy")* | % of AI category suggestions accepted without edit | Accepted-unedited / total suggestions shown | No pre-launch target. **Note:** this is a proxy for correctness, not a true accuracy measure — a user may accept a wrong suggestion without noticing, or reject a correct one. True accuracy would require a labeled ground-truth sample, out of scope for v1 telemetry |
| Budget usage | % of active users with ≥1 budget set | Count(users with Budget) / active users | No pre-launch target; baseline from first 60 days |
| Budget adherence | % of budget-periods where spend ≤ budget | Count(period usage ≤100%) / total budget-periods (via `BudgetPeriodSnapshot`) | No target — descriptive metric |
| AI suggestion acceptance rate | Accepted / (accepted+rejected) | AiSuggestion.status | No pre-launch target; baseline from first 60 days |
| AI insight engagement | % of shown insights opened/viewed | View event / insight shown | No target — descriptive |
| Retention (D7/D30) | % of new users active at day 7/30 | Cohort analysis | No pre-launch target; baseline from first 60 days |
| Time to first tracked expense | Minutes from signup to first Expense row | Timestamp diff | No pre-launch target; baseline from first 60 days |
| Time to first completed budget | Minutes/days from signup to first Budget row | Timestamp diff | No target — descriptive |
| Free-to-paid conversion | Free users upgrading / total free users | Subscription events | OPEN QUESTION — depends on pricing (§8) |

**[REVIEW FIX]** Per Product Principle 9 (keep v1 focused), fabricated pre-launch numeric targets were removed. Setting specific targets before any production data exists risks optimizing the product toward arbitrary numbers. All descriptive/tracking metrics remain as defined; targets will be set from the first 60 days of real usage data.

## 12. Assumptions

*Regenerated last, after all other sections' corrections were applied, so nothing here is stale relative to the rest of the document.*

**Confirmed (from product idea/spec):**
- Single-user v1; no household accounts.
- Manual entry is core and must work without AI (Product Principle 5).
- AI is assistive-only, server-side, and never auto-writes to financial records.
- Strict Next.js/TypeScript/Prisma/PostgreSQL stack lock.
- No floating-point money math.
- Audit trail required on edits (`ExpenseHistory`).

**ASSUMPTION ADDED:**
- Users prioritize manual control/privacy over bank-linking convenience (§2) — not yet validated against the full target segment.
- Soft-deleted expenses recoverable for 30 days; `ExpenseHistory` retained 1 year independent of expense deletion (§5 FR-5, §10).
- Money stored as integer minor-units (cents) rather than Prisma `Decimal`, confirmed for single-currency v1, flagged for revisit at multi-currency v2 (§10).
- Database sessions (not JWT) are the confirmed auth strategy, chosen for server-side revocation support (§7).
- Free-tier AI action cap of 20/month — number not validated against provider unit economics (§6, §9).
- AI request timeout of 10 seconds (§6).
- AI request deduplication window of 60 seconds (§6) — placeholder pending production tuning.
- Recurring expenses (FR-18) placed in the free tier, not paid, to stay consistent with Product Principle 5 (§8).
- Duplicate-expense warning window of 5 minutes (§9).
- No pre-launch numeric metric targets; targets deferred to first 60 days of production data (§11).

## 13. Phased Roadmap

| Phase | Scope | Key Deliverables | Excluded |
|-------|-------|-------------------|----------|
| MVP | Manual expense CRUD, categories, budgets (overall + per-category), budget monitoring/alerts, dashboard, auth | FR-1–FR-6, FR-8, FR-10, FR-12–FR-17, FR-20. **[REVIEW FIX]** Note: FR-16/FR-17 depend on the `BudgetPeriodSnapshot` model (§10) — include this in MVP engineering estimation, not treated as a later add-on | AI features, recurring expenses, export |
| v1.0 | AI categorization + insights + anomaly detection, approval flows, CSV export | FR-9, FR-21–FR-27, FR-29 | Recurring expenses, notifications beyond in-app |
| v1.1 | Recurring expenses, notifications (in-app + email), business model launch | FR-18, FR-28, §8 | Multi-currency, income tracking |
| v2 | OPEN QUESTION scope: multi-currency (including non-two-decimal currency handling per §10), income tracking, possible bank-linked import | TBD | — |

## 14. Open Questions

*Regenerated last; resolved items from the review are removed, newly surfaced items are added.*

1. Exact free-tier AI action cap and paid-tier price (§8, §11) — materially affects business model and AI cost risk; requires a unit-economics pass (§9) before finalizing.
2. Payment processor selection (§8).
3. Email notification provider, or in-app only for v1 (§7, FR-28).
4. Hosting/deployment platform (§7) — blocks finalizing the connection-pooling strategy (§7) and background-job implementation (§7).
5. Whether soft-deleted expenses' 30-day recovery window and `ExpenseHistory`'s 1-year retention need a formal compliance/data-retention policy review (§5 FR-5, §10).
6. v2 scope: multi-currency handling (including non-two-decimal-minor-unit currencies) and conversion source, income tracking (§3, §13).
7. AI request deduplication window (currently a 60-second placeholder) — needs tuning against real usage patterns (§6).
8. Whether a free trial should be offered on the paid tier (§8).
