````markdown
---
name: ai-pipeline
description: Use when implementing AI categorization, AI insights, anomaly detection, AI budget suggestions, DeepSeek integration, Claude integration, AI validation, PII filtering, AI deduplication, or AiSuggestion processing.
---

# AI Pipeline Skill

This skill teaches the ordered workflow for AI-assisted features. Its laws live in `ai-pipeline.md` and `AI suggestion lifecycle.md`, with security requirements in `security.md`.

## Procedure

1. Identify the AI request type: categorization, summary, anomaly, or budget suggestion.
2. Authenticate the user server-side.
3. Derive `userId` from the authenticated session.
4. Check the user's AI access and usage limit.
5. Build only the context required for the request.
6. Remove unnecessary PII before sending external data.
7. Select the configured provider through the shared AI abstraction.
8. Send the request through the DeepSeek or Claude provider adapter.
9. Apply the configured timeout and handle provider failure.
10. Parse the provider response.
11. Validate the structured response with the application-owned schema.
12. Perform business validation after schema validation.
13. Check for duplicate processing.
14. Create the `AiSuggestion` as `PENDING`.
15. Do not modify authoritative financial records from the AI response.
16. Let the user review the suggestion.
17. On acceptance, use the normal authenticated business logic for the resulting mutation.

## Key Pattern

```ts
const provider = aiProviderRegistry.get(config.aiProvider)

const response = await provider.generate({
  requestType,
  context: filteredContext,
})

const output = aiResponseSchema.parse(response.data)

validateAIResultForUser(output, userId)

await prisma.aiSuggestion.create({
  data: {
    userId,
    type: requestType,
    status: "PENDING",
    outputPayload: output,
  },
})
````

## Common Traps

* Calling DeepSeek or Claude directly from business logic.
* Treating AI output as authoritative.
* Sending unnecessary PII.
* Trusting a provider response without schema validation.
* Accepting a category that does not belong to the user.
* Allowing AI to update an expense or budget directly.
* Making expense creation fail because AI failed.
* Creating duplicate suggestions after retries.
* Logging prompts or financial responses.
* Adding provider-specific business logic outside the provider adapter.

## Verify Before Done

* [ ] The operation is explicitly triggered.
* [ ] Authentication and authorization run server-side.
* [ ] AI usage limits are enforced.
* [ ] Context is minimal.
* [ ] PII filtering occurs before the provider call.
* [ ] DeepSeek and Claude use the same internal contract.
* [ ] Provider SDK code remains isolated.
* [ ] Output passes schema and business validation.
* [ ] Duplicate requests are handled.
* [ ] Suggestions start as `PENDING`.
* [ ] AI cannot directly mutate authoritative data.
* [ ] Provider failure is graceful.
* [ ] Financial content is excluded from logs.
* [ ] Write unit tests with mocked providers.
* [ ] Write integration tests for validation, authorization, deduplication, and suggestion creation.
* [ ] Write provider contract tests for DeepSeek and Claude adapters.

```
```
