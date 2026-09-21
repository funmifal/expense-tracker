---
trigger: always_on
---

# AI Pipeline Rules

## Purpose

The AI pipeline is responsible for safely processing AI-assisted features such as expense categorization, spending insights, anomaly detection, and budget suggestions.

The pipeline must be provider-neutral.

The application may use **DeepSeek as the primary AI provider** and may use **Claude as an alternative provider**. Switching between providers must not change the application's business rules, validation requirements, security controls, suggestion lifecycle, or financial behavior.

AI output is always considered untrusted external input.

---

## 1. Provider Abstraction Is Mandatory

Do not call DeepSeek or Claude directly from business logic, route handlers, UI components, or database services.

All AI providers must implement the same internal provider contract.

Use an abstraction similar to:

```ts
interface AIProvider {
  generate<T>(request: AIRequest): Promise<AIResponse<T>>
}