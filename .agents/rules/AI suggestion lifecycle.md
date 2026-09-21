---
trigger: always_on
---

# AI Suggestion Lifecycle Rules

## Purpose

AI is an assistive system, not an authority over the user's financial records.

Every AI output must pass through a controlled lifecycle before it can affect authoritative data.

## Rules

### 1. AI Output Is Untrusted

Treat every AI response as untrusted external input.

Validate all structured output with Zod before using it.

### 2. AI Must Not Directly Modify Financial Records

AI generation must never directly write authoritative values into:

- Expense
- Budget
- Category
- PaymentMethod

AI produces suggestions only.

### 3. Every Suggestion Starts as PENDING

A valid suggestion must initially be stored as:

```text
PENDING