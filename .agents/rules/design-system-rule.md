---
trigger: always_on
---


## `.agents/rules/design-system-rule.md`

```markdown
# Design System Rules

## Purpose

The Expense Tracker UI must communicate financial information clearly, consistently, and accessibly.

## Rules

### 1. Use Shared Components

Do not create one-off versions of common:

- Buttons
- Inputs
- Selects
- Dialogs
- Cards
- Tables
- Badges
- Alerts
- Empty states

Use the shared design system whenever an equivalent component exists.

### 2. Financial States Must Be Visually Distinguishable

The UI must clearly distinguish:

- Within budget
- Approaching budget
- Budget exceeded
- Active expense
- Deleted/recoverable expense
- Pending AI suggestion
- Accepted AI suggestion
- Rejected AI suggestion
- Payment pending
- Payment successful
- Payment failed

Do not rely on color alone.

### 3. AI Suggestions Must Look Like Suggestions

AI-generated information must never visually appear identical to authoritative financial data.

Use explicit labels such as:

- AI suggestion
- Suggested category
- Suggested budget
- AI insight

The user must understand when information is advisory.

### 4. Financial Numbers Must Be Clear

Display:

- Currency
- Amount
- Budget usage
- Remaining amount
- Period

with consistent formatting.

Avoid ambiguous financial values.

### 5. Destructive Actions Require Clear Confirmation

Actions such as deleting an expense must clearly communicate:

- what will happen
- whether recovery is possible
- the recovery period where applicable

### 6. Responsive Design

The expense-entry experience must work well on small screens because manual expense entry is a core product loop.

Do not prioritize desktop-only interactions for critical workflows.

### 7. Accessibility

Interactive controls must have:

- keyboard accessibility
- visible focus states
- appropriate labels
- sufficient contrast
- meaningful error states
- accessible status communication

Do not use color as the only indicator of financial status.

### 8. Loading and Error States

Every asynchronous financial workflow should have intentional:

- loading
- success
- error
- empty

states.

Do not leave users wondering whether an expense, payment, or budget change was saved.

### 9. Avoid Decorative Complexity

Animations must not interfere with:

- expense entry
- financial comprehension
- accessibility
- performance

The interface should prioritize clarity over visual novelty.
