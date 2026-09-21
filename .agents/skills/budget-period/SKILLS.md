````markdown
---
name: budget-period
description: Use when implementing or changing budgets, monthly budget periods, budget usage, mid-period edits, BudgetPeriodSnapshot, budget alerts, category budgets, or overall budgets.
---

# Budget Period Skill

This skill teaches the ordered workflow for implementing budget-period behavior. Its laws live in `Budget Period Integrity.md`, `money-billing.md`, and `security.md`.

## Procedure

1. Authenticate and derive the user's timezone context.
2. Resolve the target local month before calculating the budget period.
3. Convert the local period boundary to the UTC representation used by the database.
4. Identify whether the budget is overall or category-specific.
5. Load the budget using the authenticated `userId`.
6. When calculating usage, query authoritative non-deleted expenses for the resolved period.
7. Sum amounts using integer minor units.
8. For a mid-period budget change, preserve the historical interpretation of the period.
9. Create or use the required `BudgetPeriodSnapshot`.
10. Calculate current usage against the correct budget amount.
11. Evaluate the 80% and 100%+ thresholds.
12. Ensure each threshold notification is emitted only once per period.
13. Never rewrite historical spending merely because the current budget changed.
14. Keep category and overall budget behavior explicit.
15. Verify database uniqueness and null handling for overall budgets.

## Key Pattern

```ts
const period = resolveLocalMonth(userTimezone, requestedDate)

const budget = await prisma.budget.findFirst({
  where: {
    userId,
    categoryId,
    periodStart: period.utcStart,
  },
})

const spentMinorUnits = await getAuthoritativeSpent({
  userId,
  categoryId,
  period,
})

const usage = calculateBudgetUsage({
  budgetMinorUnits: budget.amountMinorUnits,
  spentMinorUnits,
})
````

## Common Traps

* Calculating month boundaries in server time instead of user time.
* Comparing a new budget against historical spending as if the old budget never existed.
* Counting deleted expenses.
* Using floating-point money.
* Treating category and overall budgets as the same query.
* Creating duplicate threshold alerts.
* Allowing a budget query without `userId`.

## Verify Before Done

* [ ] Local month boundaries are correct.
* [ ] UTC storage representation is correct.
* [ ] Current spending excludes deleted expenses.
* [ ] Category and overall budgets work independently.
* [ ] Mid-period edits preserve historical interpretation.
* [ ] Snapshots are created or used correctly.
* [ ] 80% alerts work once per period.
* [ ] 100%+ alerts work once per period.
* [ ] Money calculations use integer minor units.
* [ ] User ownership is enforced.
* [ ] Write unit tests for period resolution and budget calculations.
* [ ] Write integration tests for snapshots, usage, uniqueness, and alerts.
* [ ] Write e2e tests for budget creation, editing, monitoring, and alerts.

```
```
