````markdown
---
name: database-migration
description: Use when changing Prisma schema, database models, relations, indexes, unique constraints, enums, nullable fields, migrations, or persisted financial data structures.
---

# Database Migration Skill

This skill teaches the ordered workflow for changing the Prisma database safely. Its laws live in `database-schema.md`, `AGENTS.md`, and the PRD data model.

## Procedure

1. Identify the feature requiring the schema change.
2. Inspect the existing model and its relations before editing.
3. Identify ownership, uniqueness, indexes, nullable fields, and historical-data requirements.
4. Update `schema.prisma` to represent the required model.
5. Preserve integer minor-unit fields for monetary values.
6. Preserve user ownership relationships and constraints.
7. Add required indexes for the affected query patterns.
8. Add database uniqueness where the rule requires uniqueness.
9. Create a Prisma migration.
10. Review the generated migration before applying it.
11. Check whether existing records are compatible with the change.
12. Apply the migration in the appropriate environment.
13. Verify the resulting schema and affected application queries.
14. Run tests for the changed data path.

## Key Pattern

```prisma
model Expense {
  id              String   @id @default(cuid())
  userId          String
  amountMinorUnits Int
  currency        String
  date            DateTime
  isDeleted       Boolean  @default(false)

  user User @relation(fields: [userId], references: [id])

  @@index([userId, date])
  @@index([userId, isDeleted])
}
````

```bash
npx prisma migrate dev --name describe_change
npx prisma generate
```

## Common Traps

* Changing the schema without a migration.
* Removing a field that historical records still require.
* Omitting `userId` from a user-owned model or query path.
* Using floating-point database fields for money.
* Forgetting required indexes.
* Relying only on application checks for required uniqueness.
* Applying a migration without reviewing its effect on existing data.

## Verify Before Done

* [ ] Schema matches the intended PRD model.
* [ ] Ownership relations remain intact.
* [ ] Required uniqueness exists.
* [ ] Required indexes exist.
* [ ] Monetary fields remain integer minor units.
* [ ] Nullable fields are intentional.
* [ ] Migration is created and reviewed.
* [ ] Existing data remains valid.
* [ ] Generated Prisma client is current.
* [ ] Write unit tests for affected data logic.
* [ ] Write integration tests against the migrated schema.

```
```
