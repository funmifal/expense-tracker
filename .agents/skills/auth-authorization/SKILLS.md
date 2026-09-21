````markdown
---
name: auth-authorization
description: Use when implementing authentication, protected pages, protected APIs, Server Actions, user-owned queries, ownership checks, session handling, or cross-user access protection.
---

# Auth Authorization Skill

This skill teaches the ordered workflow for protecting user-owned application operations. Its laws live in `security.md`, `coding-standard.md`, and `AGENTS.md`.

## Procedure

1. Identify whether the operation requires an authenticated user.
2. Retrieve the server-side Auth.js database session.
3. Reject unauthenticated access.
4. Derive `userId` from the session.
5. Validate request input separately from authorization.
6. Add `userId` to every user-owned database query.
7. When accessing a resource by ID, query by both resource ID and `userId`.
8. For mutations, verify ownership before changing data.
9. Keep authorization on the server even when the UI hides an action.
10. Return generic client-safe errors without exposing internal details.
11. For cross-user tests, attempt access using a second authenticated user.

## Key Pattern

```ts
const session = await auth()

if (!session?.user?.id) {
  throw new UnauthorizedError()
}

const userId = session.user.id

const expense = await prisma.expense.findFirst({
  where: {
    id: expenseId,
    userId,
  },
})

if (!expense) {
  throw new NotFoundError()
}
````

## Common Traps

* Trusting a client-provided `userId`.
* Checking authorization only in React components.
* Querying by resource ID alone.
* Assuming possession of an ID means ownership.
* Reusing an unscoped database helper.
* Returning different errors that reveal whether another user's record exists.

## Verify Before Done

* [ ] Authentication is server-side.
* [ ] `userId` comes from the session.
* [ ] Every user-owned query is scoped.
* [ ] Every user-owned mutation is scoped.
* [ ] UI restrictions are not the only authorization control.
* [ ] Client errors do not expose internal details.
* [ ] Write unit tests for authorization helpers.
* [ ] Write integration tests for cross-user access on the affected resource.
* [ ] Write e2e tests for protected user flows where applicable.

```
```
