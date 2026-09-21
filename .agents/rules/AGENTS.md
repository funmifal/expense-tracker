---
trigger: always_on
---

# AGENTS.md

## 1. Project Identity

This repository contains a single-user personal Expense Tracker web application.

The product is designed for students, young professionals, and budget-conscious adults who want to manually track expenses, understand spending patterns, manage budgets, and eventually receive assistive AI insights.

The core product principle is:

> The user remains the authority over their financial data. AI may suggest, but it must never silently decide or modify authoritative financial information.

The PRD is the product source of truth.

---

## 2. Mandatory Files to Read

Before implementing or modifying any feature, read:

- `AGENTS.md`
- `coding-standard.md`
- `database-schema.md`
- `design-system-rule.md`
- `git-conventions.md`
- `security.md`
- `money-billing.md`
- `AI suggestion lifecycle.md`
- `Budget Period Integrity.md`
- `Expense Audit & Recovery.md`

Also refer to the Expense Tracker PRD whenever product behavior, scope, data requirements, or acceptance behavior is unclear.

Do not invent product requirements that are not supported by the PRD or explicit user instructions.

---

## 3. Source-of-Truth Priority

When instructions conflict, follow this order:

1. Explicit user instruction
2. `AGENTS.md`
3. `.agents/rules/*`
4. Expense Tracker PRD
5. Existing architecture and implementation patterns
6. Sensible implementation detail

Never silently override a higher-priority instruction.

If an important product or architectural decision is genuinely undefined, stop and ask for clarification rather than inventing a permanent product decision.

---

## 4. Current Product Scope

### MVP

The MVP includes:

- Email/password authentication
- Database-backed sessions
- Manual expense creation
- Manual expense editing
- Soft-delete and recovery
- Expense history
- User-defined categories
- User-defined payment methods
- Single currency per account
- Expense search
- Expense filtering
- Expense sorting
- Daily/weekly/monthly totals
- Category spending breakdown
- Monthly budgets
- Real-time budget usage
- 80% and 100%+ budget alerts
- Dashboard
- Core financial reporting

### Later Phases

Unless explicitly requested, do not implement these ahead of their planned phase:

- AI categorization
- AI insights
- AI anomaly detection
- AI budget suggestions
- Recurring expenses
- CSV export
- Email notifications
- Paid AI features

Do not expand MVP scope merely because an implementation would be convenient.

---

## 5. Technical Stack

The application uses:

- Next.js 14+
- App Router
- TypeScript with strict mode
- React Server Components where appropriate
- Client Components only where interaction requires them
- Prisma ORM
- PostgreSQL
- Auth.js
- Zod
- A single deployable Next.js application

Business logic must not be buried inside UI components or route handlers.

---

## 6. Architecture

Keep route handlers thin.

Use clear separation between:

- UI
- Route handlers
- Validation
- Domain/business logic
- Database access
- External integrations
- Background jobs

A typical structure is:

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
├── components/
├── lib/
│   ├── auth/
│   ├── ai/
│   ├── billing/
│   │   └── flutterwave/
│   ├── db/
│   ├── money/
│   ├── notifications/
│   ├── timezone/
│   ├── utils/
│   └── validation/
├── jobs/
├── prisma/
├── tests/
├── public/
├── types/
├── .agents/
│   └── rules/
├── .env.example
├── package.json
├── tsconfig.json
└── AGENTS.md