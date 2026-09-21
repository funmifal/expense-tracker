---
trigger: always_on
---

 
## `.agents/rules/coding-standard.md`

```markdown
# Coding Standards

## Purpose

These rules define enforceable implementation standards for the Expense Tracker.

The goal is to keep financial logic deterministic, testable, maintainable, and separated from presentation concerns.

## Rules

### 1. Use Strict TypeScript

- `strict` mode must remain enabled.
- Do not use `any` unless there is a documented, unavoidable boundary case.
- Prefer explicit domain types and discriminated unions.
- Do not silence TypeScript errors with `@ts-ignore` or unsafe casts without justification.

### 2. Keep Routes Thin

Route handlers must coordinate:

1. Authentication
2. Input validation
3. Business-service invocation
4. Response formatting

Complex business logic must not live inside route handlers.

### 3. Keep Financial Logic Pure

Calculations such as:

- totals
- budget usage
- threshold calculations
- period aggregation
- remaining budget

should be implemented in deterministic, testable functions wherever possible.

### 4. Validate at Boundaries

Validate:

- API input
- query parameters
- AI responses
- external payment responses
- environment variables

before passing data deeper into the application.

### 5. Never Duplicate Business Rules

Do not implement the same:

- budget calculation
- ownership check
- money conversion
- AI acceptance logic
- payment-state transition

in multiple places.

Create a reusable domain/service function.

### 6. Prefer Server-Side Authority

Authoritative financial operations must execute server-side.

Client components may collect and display data but must not determine:

- ownership
- payment status
- subscription entitlement
- authoritative totals
- AI approval state

### 7. Make Side Effects Explicit

Database writes, external API calls, notifications, and billing operations must be obvious from the service boundary.

Avoid hidden side effects inside formatting or utility functions.

### 8. Test High-Risk Logic

Every change to money, authorization, budgets, audit history, AI acceptance, or billing requires relevant automated tests.

### 9. Avoid Premature Abstraction

Do not create abstractions merely for theoretical future requirements.

Create an abstraction when it protects a real boundary in the current product, especially:

- AI providers
- Flutterwave billing
- money operations
- authentication
- persistence

### 10. Preserve Existing Behavior

When modifying an existing feature, understand its current behavior before refactoring it.

Do not introduce unrelated architectural changes during feature work.