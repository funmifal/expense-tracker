 expense-lifecycle
description: Use when implementing or changing expense create, edit, delete, recover, search, filter, sort, ExpenseHistory, soft-delete, or expense API behavior.
---

# Expense Lifecycle Skill

This skill teaches the ordered workflow for changing the expense lifecycle. Its laws live in `Expense Audit & Recovery.md`, `security.md`, `money-billing.md`, and `coding-standard.md`.

## Procedure

1. Identify the operation: create, edit, delete, recover, search, filter, or sort.
2. Authenticate the request server-side and derive `userId` from the session.
3. Validate the request with the shared schema before business logic.
4. Load the target expense using both its ID and authenticated `userId`.
5. For create, validate amount, currency, date, category, payment method, and optional description.
6. Store money as integer minor units.
7. For edit, compare the old and new values before writing.
8. Create an `ExpenseHistory` record for every changed field.
9. For delete, set `isDeleted` and `deletedAt`; do not hard-delete immediately.
10. For recovery, verify the expense is recoverable and clear the soft-delete state.
11. For search, filtering, and sorting, apply all filters to the authenticated user's active expenses.
12. Keep deleted expenses out of normal totals and active expense results.
13. Use a transaction when the operation changes multiple authoritative records.
14. Return only data the authenticated user is allowed to see.

## Key Pattern

```ts
const session = await requireSession()
const userId = session.user.id

const expense = await prisma.expense.findFirst({
  where: {
    id: expenseId,
    userId,
    isDeleted: false,
  },
})

if (!expense) {
  throw new NotFoundError()
}

const input = expenseSchema.parse(body)

// Perform the authorized business operation.
// Create ExpenseHistory for changed fields when editing.
Common Traps
Trusting userId from the client.
Updating an expense without creating history.
Hard-deleting an expense during norll/
''
'
mal deletion.
Including soft-deleted expenses in totals.
Using floating-point values for money.
Updating a record by ID without ownership scoping.
Letting the UI enforce authorization.
Mixing validation, database access, and business rules into an oversized route handler.
Verify Before Done

Create works with valid expense data.

Invalid input is rejected.

Cross-user access is rejected.

Edit creates the required ExpenseHistory records.

Delete is soft-delete.

Recovery restores the expense correctly.

Deleted expenses are excluded from active queries and totals.

Search, filters, and sorting remain user-scoped.

Money uses integer minor units.

Multi-record changes are transactional where required.

Write unit tests for expense validation and lifecycle logic.

Write integration tests for authorization, CRUD, audit history, delete, and recovery.

Write e2e tests for the user-facing expense lifecycle.