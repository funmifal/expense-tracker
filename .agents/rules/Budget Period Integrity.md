---
trigger: always_on
---


## `.agents/rules/Budget Period Integrity.md`

```markdown
# Budget Period Integrity Rules

## Purpose

Budget history must remain trustworthy even when users change budgets during an active period.

Historical financial interpretation must never be silently rewritten.

## Rules

### 1. Budget Periods Are Time-Bound

A budget belongs to a defined monthly period.

Period boundaries must use the user's configured timezone and be represented consistently in UTC storage.

### 2. Mid-Period Changes Are Prospective

When a user edits a budget during an active period:

- the new amount applies prospectively
- previously recorded spending remains unchanged
- historical reporting must remain interpretable

### 3. Preserve Historical Interpretation

Use `BudgetPeriodSnapshot` where required by the PRD to preserve:

- budget amount
- spent amount
- user
- category
- period
- closure information

### 4. Never Recalculate History From Only the Current Budget

Historical reports must not assume that today's budget value was the budget value throughout the historical period.

### 5. Spending Is Independent of Budget Edits

Changing a budget must never:

- change an expense
- change expense history
- change historical spending
- delete spending records

### 6. Category Budgets and Overall Budgets Must Remain Distinct

Do not accidentally combine:

- category-specific budgets
- overall budgets

during calculations.

A budget's scope must be explicit.

### 7. Preserve Budget Uniqueness

Prevent duplicate budgets for the same:

```text
user + category + period