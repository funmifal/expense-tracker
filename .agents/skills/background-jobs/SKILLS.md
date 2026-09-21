````markdown
---
name: background-jobs
description: Use when implementing recurring expense generation, monthly AI summaries, 30-day soft-delete purge, scheduled processing, retries, idempotency, or other background jobs explicitly defined by the product.
---

# Background Jobs Skill

This skill teaches the ordered workflow for the scheduled jobs defined by the product. Its laws live in `AGENTS.md`, `Expense Audit & Recovery.md`, `ai-pipeline.md`, and the PRD.

## Procedure

1. Identify the specific approved job: recurring expenses, monthly AI summaries, or soft-delete purge.
2. Define the job's execution boundary and target records.
3. Query records using the required ownership or system execution context.
4. Make the operation idempotent before performing mutations.
5. Validate records before creating or changing data.
6. For recurring expenses, create expenses through the normal expense rules.
7. For monthly AI summaries, use the AI pipeline and suggestion rules.
8. For soft-delete purge, select only records that have passed the 30-day recovery period.
9. Protect related historical records according to the retention rules.
10. Handle failures without partially repeating completed work.
11. Make retries safe.
12. Verify the job's result after execution.

## Key Pattern

```ts
async function runJob() {
  const candidates = await findCandidates()

  for (const candidate of candidates) {
    if (await alreadyProcessed(candidate)) {
      continue
    }

    await processCandidate(candidate)
  }
}
````

## Common Traps

* Running a job twice and creating duplicate expenses.
* Performing a destructive purge before the recovery period ends.
* Treating a scheduled AI job as exempt from AI validation.
* Mutating data before checking whether the job already processed it.
* Allowing partial failures to cause unsafe retries.
* Mixing unrelated scheduled tasks into one workflow.

## Verify Before Done

* [ ] The job corresponds to an approved product requirement.
* [ ] Execution scope is explicit.
* [ ] Repeated execution is safe.
* [ ] Required validation runs before mutation.
* [ ] Recurring expenses follow normal expense rules.
* [ ] Monthly AI summaries follow the AI pipeline.
* [ ] Purge respects the 30-day recovery period.
* [ ] Expense history retention is preserved.
* [ ] Failures do not cause unsafe duplicate work.
* [ ] Write unit tests for job logic and idempotency.
* [ ] Write integration tests for database mutations and failure/retry behavior.

```
```
