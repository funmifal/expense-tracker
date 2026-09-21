---
trigger: always_on
---


## `.agents/rules/Expense Audit & Recovery.md`

```markdown
# Expense Audit and Recovery Rules

## Purpose

Expenses are authoritative financial records.

The system must preserve a trustworthy history of changes while giving users a defined recovery window for accidental deletion.

## Rules

### 1. Expense Edits Require History

Every meaningful edit to an expense must create an `ExpenseHistory` record.

The history must identify:

- expense
- timestamp
- actor
- field changed
- previous value
- new value

### 2. Do Not Overwrite Audit History

Expense history is append-oriented.

Do not update historical audit records merely to make them match the current expense.

### 3. Deletes Are Soft Deletes

Deleting an expense must set the appropriate deletion state rather than immediately destroying the expense.

Use:

```text
isDeleted = true
deletedAt = <timestamp>