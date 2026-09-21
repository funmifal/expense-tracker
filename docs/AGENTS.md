```md
# AGENTS.md

## 1. What Is This Project?

You are building a single-user web application for tracking personal expenses.

The product is for individuals, primarily:

- Students.
- Young professionals.
- Budget-conscious adults.

The product helps users:

- Record personal expenses manually.
- Organize expenses into categories.
- Track spending by day, week, month, and date range.
- Create and monitor budgets.
- View spending patterns.
- Receive budget alerts.
- Use AI for categorization, summaries, anomaly detection, and budgeting suggestions in later releases.

The core product principle is:

> The user's financial data is authoritative. AI assists the user but never controls the user's financial records.

### Current Build Target

Build the **MVP first** unless the task explicitly states that a later phase is being implemented.

The MVP includes:

- Account creation.
- Login.
- Manual expense CRUD.
- User-defined expense categories.
- Single account currency.
- Expense filtering.
- Daily, weekly, and monthly spending views.
- Category spending breakdowns.
- Overall and per-category budgets.
- Budget monitoring.
- Budget threshold alerts.
- Dashboard.

Do not implement AI features, recurring expenses, CSV export, email notifications, or other later-phase functionality during MVP work unless the task explicitly asks for that phase.

The PRD is the primary product source of truth:

> **Expense Tracker — Product Requirements Document (v2)**

When the user explicitly changes a locked project decision, such as selecting Flutterwave for payments, follow that explicit instruction and update the implementation rules accordingly.

---

## 2. What Is Locked?

The following choices are locked. Do not replace, swap, remove, or "improve" them without explicit user authorization.

### Technology Stack

Use:

- Next.js 14+.
- Next.js App Router.
- TypeScript.
- TypeScript strict mode.
- Prisma ORM.
- PostgreSQL.

Use a single deployable Next.js application.

Do not introduce a separate backend service unless explicitly authorized.

Do not replace PostgreSQL with another database.

Do not replace Prisma with another ORM.

Do not replace TypeScript with JavaScript.

Do not replace the Next.js App Router architecture.

### Authentication

Use database-backed sessions with Auth.js.

Do not replace database sessions with JWT authentication.

The session must support server-side revocation.

Store and use the session token according to the authentication implementation.

### Database

Use Prisma as the database access layer.

Use PostgreSQL as the primary database.

Use Prisma migrations for schema changes.

Do not modify the database schema manually in production as a substitute for migrations.

Preserve the relationships and business rules defined by the PRD.

### Money Storage

Store authoritative money values as integer minor units.

For the v1 single-currency assumption, this means integer cents.

Never use floating-point values for authoritative financial calculations.

Do not use JavaScript `number` arithmetic as the authoritative representation of money.

Do not use Prisma `Float` for money.

Multi-currency handling is not part of v1.

### Currency

Use one currency per user account.

The account currency is set at signup.

Do not implement currency conversion in v1.

Do not introduce multi-currency support unless the task explicitly targets v2.

### Billing

Use **Flutterwave** as the payment processor.

Do not substitute Stripe, Paystack, Paddle, Lemon Squeezy, or another payment provider.

Keep Flutterwave-specific code inside the billing integration boundary.

Do not spread Flutterwave SDK or provider-specific logic throughout the application.

Do not invent pricing.

The paid-tier price remains an explicit product decision unless the user provides it.

Never grant paid access based only on client-side payment state.

### AI Provider Architecture

AI must use a provider-neutral abstraction.

The architecture must support providers such as:

- Claude.
- DeepSeek.
- Other compatible providers added later.

Provider-specific SDKs must remain inside their adapter layer.

Business logic must not depend directly on Claude or DeepSeek SDKs.

Changing the configured AI provider must not require changing product business logic.

### Application Architecture

Use:

- Server Components for data-heavy pages where appropriate.
- Client Components for interactive interfaces.
- Route Handlers under `/app/api/*` for API mutations and AI calls.
- Server Actions only where appropriate for simple form submissions.
- Shared UI components under `/components`.

Keep authoritative business rules on the server.

---

## 3. What Must Never Happen?

Breaking any rule in this section means the task has failed, even if the application builds and appears to work.

### Product Scope

Do not introduce features that are outside the requested phase.

Do not build bank-account linking or transaction import in v1.

Do not build multi-user or household accounts.

Do not build multi-currency conversion in v1.

Do not build investment tracking.

Do not build automated bill payment.

Do not build native mobile applications.

Do not allow AI to perform autonomous financial actions.

Do not silently add features because they are common in other expense-tracking applications.

### Financial Data

Treat user-entered financial data as authoritative.

Never silently change an expense.

Never silently change a budget.

Never silently delete an expense.

Never allow an AI response to directly modify authoritative financial records.

Never invent a transaction.

Never invent an expense amount.

Never invent financial information.

Never overwrite user data with an AI-generated value without explicit user approval.

### Money

Store money as integer minor units.

Never use floating-point arithmetic for authoritative money calculations.

Never introduce rounding behavior that changes financial totals unexpectedly.

Define and preserve consistent rules for:

- Amount validation.
- Zero amounts.
- Negative amounts.
- Large amounts.
- Addition.
- Subtraction.
- Budget calculations.

Financial calculations must be deterministic and testable.

### Expense Ownership

Every expense query must be scoped to the authenticated user's `userId`.

Never trust a client-supplied `userId`.

Never allow one user to read another user's expenses.

Never allow one user to edit another user's expenses.

Never allow one user to delete another user's expenses.

Never allow one user to access another user's budgets, categories, payment methods, notifications, sessions, or AI suggestions.

Authorization must be enforced on the server.

### Expense Deletion

Expense deletion must be a soft delete.

Deleted expenses must be excluded from financial totals.

Do not physically delete an expense immediately when the user requests deletion.

The planned recovery period is 30 days.

The scheduled purge must not remove the expense before that retention period.

Expense history must remain independently retained according to the retention rule defined by the PRD.

### Expense Editing

Editing an expense must create an `ExpenseHistory` audit record containing the previous value.

Do not modify an expense without preserving the required audit information.

AI must never write directly to `ExpenseHistory`.

### Categories

A category belongs to a user.

Never allow a user to assign an expense to another user's category.

Never delete a category that is still referenced by expenses without requiring the user to resolve the affected expenses.

Do not silently reassign expenses when deleting a category.

### Budgets

Support:

- Overall budgets.
- Per-category budgets.

An overall budget uses a null category.

Do not allow multiple overall budgets for the same user and period.

Budget calculations must use non-deleted expenses.

A mid-period budget edit must not rewrite the historical interpretation of previous spending.

Preserve budget-period history using `BudgetPeriodSnapshot` as defined by the PRD.

Do not silently change historical budget usage because the current budget value changed.

### Budget Alerts

Budget alerts must fire once per threshold per period.

Do not repeatedly fire the same 80% or 100%+ alert for every subsequent expense.

### AI

AI is assistive only.

AI must never automatically:

- Modify an expense.
- Delete an expense.
- Modify a budget.
- Create a financial action.
- Guarantee a financial outcome.
- Present uncertain information as fact.

Every AI suggestion must be clearly identified as an AI suggestion.

Every AI suggestion that changes authoritative data requires explicit user action.

The valid suggestion lifecycle is:

```text
PENDING
   ↓
ACCEPTED
   ↓
Authoritative change
```

or:

```text
PENDING
   ↓
REJECTED
```

or:

```text
PENDING
   ↓
EDITED_AND_ACCEPTED
   ↓
User-modified authoritative change
```

Do not bypass this lifecycle.

### AI Access

AI calls must happen on the server.

Never expose AI provider API keys to the browser.

Never accept raw AI prompts from the client as trusted instructions.

The server must construct AI context.

The server must validate AI input.

The server must validate AI output.

Malformed AI responses must be rejected.

Do not silently coerce malformed AI responses into valid-looking data.

### AI Privacy

Minimize financial information sent to AI providers.

Never send:

- Passwords.
- Session tokens.
- Full names.
- Email addresses.
- Linked account identifiers.

For anomaly detection, send only:

- Expense amount.
- Expense category.
- Expense date.
- Required aggregated historical statistics.

Never send free-text expense descriptions to the AI provider for anomaly detection.

For categorization, free-text descriptions may be used only after the required PII filtering.

Do not include financial content in analytics logs when suggestion IDs and outcomes are sufficient.

### AI Failures

An AI failure must never break manual expense tracking.

Handle:

- Provider failures.
- Timeouts.
- Rate limits.
- Malformed responses.
- Invalid categories.
- Invalid AI output.

Gracefully show that the AI feature is unavailable.

Do not partially apply an AI response.

### AI Deduplication

AI requests must use the defined idempotency strategy.

The PRD specifies:

```text
expenseId + requestType
```

as the basis for request deduplication.

Do not create duplicate pending AI suggestions for the same request within the defined deduplication window.

The current window is 60 seconds.

Treat this value as configurable so it can be tuned later.

### Authentication

Require authentication for protected application routes and APIs.

Never trust client-side authentication state as authorization.

Use the server session as the source of authenticated user identity.

Return generic authentication errors where detailed errors could reveal sensitive account information.

### API Security

Authenticate before performing protected operations.

Authorize before accessing user-owned data.

Validate all external input.

Apply rate limiting to authentication and AI endpoints.

Apply input-size limits.

Protect state-changing operations against CSRF where applicable.

Never expose internal stack traces to users.

Never expose secrets in API responses.

### Secrets

Never commit:

- Database credentials.
- AI API keys.
- Flutterwave credentials.
- Session secrets.
- Production secrets.

Never place server secrets in client-side code.

Use environment variables and the platform's secret-management system.

### Billing

Use Flutterwave only.

Keep billing operations server-controlled.

Do not trust client-side claims that a payment succeeded.

Do not grant paid access based solely on a redirect or browser state.

Do not invent subscription status.

Do not expose private Flutterwave credentials to the client.

Do not change the paid-tier price in code without an explicit product decision.

### Database Integrity

Use transactions when multiple database operations must succeed or fail together.

Do not create partial financial writes.

Do not bypass Prisma for ordinary application database operations without explicit authorization.

Do not create destructive migrations that cause user data loss.

Do not remove existing data solely to make a migration easier.

### Time and Dates

Expense dates are stored as UTC instants.

Use the user's timezone when interpreting daily, weekly, monthly, and period boundaries.

Never assume the server timezone is the user's timezone.

Never calculate monthly totals using the server's local timezone.

Do not introduce silent timezone conversions.

### Background Jobs

Background jobs must be safe to retry.

Do not create duplicate recurring expenses because a job runs twice.

Do not create duplicate notifications because a job retries.

Do not hard-delete expenses before their retention period.

Do not allow background jobs to bypass ownership or business rules.

### Errors

Never expose stack traces to users.

Never expose secrets.

Never expose unnecessary financial values in error logs.

Use expense IDs or other safe identifiers when diagnosing errors.

Do not swallow errors silently.

### Code Quality

Do not introduce spaghetti code.

Do not put unrelated business logic into route handlers.

Do not create giant components or utility files containing unrelated responsibilities.

Do not duplicate important business rules across multiple modules.

Do not use `any` to bypass TypeScript errors.

Do not disable strict TypeScript checks to make code compile.

Do not mark work as complete when it has not been tested.

---

## 4. How Is the Work Arranged?

Use this project structure unless the task provides a specific reason to change it:

```text
/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── expenses/
│   │   ├── budgets/
│   │   ├── insights/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/
│   │   ├── expenses/
│   │   ├── budgets/
│   │   ├── ai/
│   │   ├── notifications/
│   │   ├── export/
│   │   └── billing/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── ui/
│   ├── expenses/
│   ├── budgets/
│   ├── dashboard/
│   ├── ai/
│   ├── notifications/
│   └── billing/
│
├── lib/
│   ├── auth/
│   ├── ai/
│   │   ├── providers/
│   │   ├── validation/
│   │   └── context/
│   ├── billing/
│   │   └── flutterwave/
│   ├── db/
│   ├── validation/
│   ├── money/
│   ├── timezone/
│   ├── notifications/
│   └── utils/
│
├── jobs/
│   ├── recurring-expenses/
│   ├── ai-summaries/
│   └── expense-purge/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── public/
│
├── types/
│
├── .env.example
├── package.json
├── tsconfig.json
└── AGENTS.md
```

### Responsibility Boundaries

Keep these boundaries clear:

```text
UI
 ↓
API / Server Action
 ↓
Authentication
 ↓
Authorization
 ↓
Validation
 ↓
Business Logic
 ↓
Prisma
 ↓
PostgreSQL
```

For AI:

```text
Client
 ↓
AI API Route
 ↓
Authentication
 ↓
Plan Access Check
 ↓
Input Validation
 ↓
Financial Context Assembly
 ↓
Privacy Filtering
 ↓
AI Provider Interface
 ↓
Provider Adapter
 ↓
Structured AI Response
 ↓
Schema Validation
 ↓
Business Validation
 ↓
AiSuggestion
 ↓
User Review
 ↓
Explicit Acceptance
 ↓
Normal Authoritative Write Path
```

For billing:

```text
Client
 ↓
Billing Route
 ↓
Authentication
 ↓
Flutterwave Integration Boundary
 ↓
Server Verification
 ↓
Subscription / Plan State
```

Do not allow the AI provider layer to directly write to `Expense` or `Budget`.

Do not allow the client to directly determine the user's plan tier.

Do not allow provider-specific logic to leak into business logic.

---

## 5. How Should the Code Look?

Write clean, readable, modern TypeScript.

Use strict TypeScript.

Prefer small modules with one clear responsibility.

Use descriptive names.

Prefer explicit types over implicit assumptions.

Avoid unnecessary abstraction.

Do not create abstractions without a clear reason.

Keep components focused.

Keep route handlers thin.

Move complex business logic into appropriate server-side modules.

Keep database access centralized where practical.

Validate data at system boundaries.

Treat data from:

- Clients.
- AI providers.
- Payment providers.
- External services.

as untrusted until validated.

Use schemas for API input and AI output validation.

Use consistent error handling.

Return safe client-facing errors.

Log useful diagnostic information without exposing sensitive financial information.

### Naming

Use clear names such as:

```text
createExpense
updateExpense
softDeleteExpense
calculateBudgetUsage
detectBudgetThreshold
createAiSuggestion
acceptAiSuggestion
verifyFlutterwavePayment
```

Avoid vague names such as:

```text
doThing
processData
handleStuff
misc
helper
temp
```

### Money

Keep money conversion and calculation logic in dedicated, testable functions.

Example conceptual boundary:

```ts
type MoneyMinorUnits = number;
```

Do not allow arbitrary floating-point calculations to become authoritative financial values.

### API Route Order

Protected mutations should follow this general order:

```text
1. Authenticate
2. Authorize
3. Validate input
4. Load required records
5. Apply business rules
6. Perform database or external operation
7. Return typed response
```

Do not perform database mutations before authentication and validation.

### Prisma

Use Prisma Client consistently.

Scope user-owned queries by authenticated `userId`.

Use transactions where atomicity is required.

Use migrations for schema changes.

Do not casually modify the Prisma schema without considering existing data and relationships.

### AI

Keep provider adapters separate:

```text
lib/ai/providers/ClaudeProvider
lib/ai/providers/DeepSeekProvider
```

Use a shared interface:

```ts
interface AIProvider {
  categorize(input: CategorizationInput): Promise<CategorizationResult>;
  summarize(input: SummaryInput): Promise<SummaryResult>;
  detectAnomaly(input: AnomalyInput): Promise<AnomalyResult>;
}
```

Business logic should call the interface, not the provider SDK.

### Flutterwave

Keep Flutterwave-specific implementation inside:

```text
lib/billing/flutterwave/
```

The rest of the application should work with application-level billing concepts rather than Flutterwave-specific details.

### Testing

Write tests for important business rules.

At minimum, test:

- Money calculations.
- Expense ownership.
- Expense deletion.
- Expense history.
- Budget calculations.
- Budget period boundaries.
- Budget threshold alerts.
- AI response validation.
- AI suggestion lifecycle.
- AI request deduplication.
- Authentication.
- Cross-user authorization.
- Flutterwave payment state handling.
- API validation.

Never remove a test simply because it exposes a bug.

Fix the underlying behavior.

---

## 6. What Counts as Done?

A task is not done because the code was written.

Before declaring completion, verify the implementation against the task and the applicable PRD requirements.

### Required Completion Checklist

At the end of every implementation task, provide a checklist containing:

- [ ] Requested feature implemented.
- [ ] Applicable PRD requirements satisfied.
- [ ] Authentication handled.
- [ ] Authorization handled.
- [ ] Input validation handled.
- [ ] Database changes implemented safely.
- [ ] Financial calculations verified where applicable.
- [ ] AI rules followed where applicable.
- [ ] Flutterwave rules followed where billing applies.
- [ ] Error states handled.
- [ ] Edge cases considered.
- [ ] Relevant tests added or updated.
- [ ] Tests pass.
- [ ] TypeScript type checking passes.
- [ ] Production build passes.
- [ ] No secrets were added.
- [ ] No out-of-scope features were introduced.

If a checklist item does not apply, mark it as:

```text
N/A
```

Do not claim that a test, build, migration, or integration was completed unless it was actually verified.

### Build Requirement

The application must build without errors.

Do not ignore TypeScript errors.

Do not ignore lint errors that affect correctness.

Do not suppress errors merely to make the build pass.

### Database Requirement

For database changes:

- Update `schema.prisma`.
- Create the appropriate Prisma migration.
- Verify affected queries.
- Test important data-integrity behavior.

Do not claim a migration is safe without checking its effect on existing data.

### Security Requirement

Before completion, verify that protected resources cannot be accessed by another authenticated user.

Cross-user authorization must be tested.

### AI Requirement

For AI-related tasks, verify that:

- The AI call happens server-side.
- The correct plan access rule is enforced.
- Input is validated.
- Sensitive data is minimized.
- Output is schema-validated.
- Business rules are validated.
- Suggestions remain proposals.
- Explicit user acceptance is required before authoritative changes.
- Provider-specific code remains inside the adapter boundary.
- AI failure does not break core tracking.

### Billing Requirement

For billing-related tasks, verify that:

- Flutterwave is used.
- Client-side payment state is not trusted as authoritative.
- Paid access cannot be granted through client manipulation.
- Provider credentials remain server-side.
- Pricing is not invented.
- Billing logic remains isolated from unrelated business logic.

---

## 7. What Does the Agent Do When Unsure?

When requirements are unclear, do not invent product scope.

Do not add features because they seem useful.

Do not silently change a business rule.

Do not replace a locked technology.

Do not introduce a different payment provider.

Do not bypass an architectural boundary.

Do not create a workaround that violates a product rule.

Do not inject spaghetti code simply because the correct implementation is unclear.

### Decision Order

When resolving uncertainty, use this order:

```text
1. Explicit user instruction
2. AGENTS.md locked rules
3. PRD requirements
4. Existing established project architecture
5. Sensible implementation detail
```

If two requirements conflict, stop and identify the conflict rather than silently choosing one.

### Scope

If a requested feature belongs to a later roadmap phase, do not implement it during an MVP task unless the user explicitly requests that phase.

If the request requires a product decision that the PRD identifies as an open question, do not invent the decision.

Clearly state:

```text
OPEN QUESTION
```

and identify what decision is required.

### Technical Uncertainty

If there are multiple valid technical implementations, choose the simplest implementation that:

- Fits the locked stack.
- Preserves existing architecture.
- Protects user data.
- Preserves financial accuracy.
- Keeps business logic testable.
- Does not create unnecessary infrastructure.

Do not introduce a new library, service, database, framework, or provider without a clear requirement.

### Final Rule

When unsure, **stop before inventing**.

Never sacrifice:

- Financial accuracy.
- User ownership.
- Privacy.
- Security.
- Explicit AI approval.
- Database integrity.
- Locked technology choices.
- Product scope.

for the sake of making a task appear complete.

If the agent cannot determine the correct behavior from the user instruction, AGENTS.md, and PRD, it must flag the ambiguity rather than making up a new product rule.
```