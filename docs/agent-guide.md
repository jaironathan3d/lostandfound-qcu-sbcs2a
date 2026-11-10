# AI Agent Guide

This document is the operating guide for an AI coding agent working in this repository. It is intentionally concrete: inspect the source before making assumptions, preserve the current boundaries, and leave the repository in a verifiable state.

## Mission

Build a reliable campus Lost and Found platform. The important domain behaviors are:

- A person reports a found item without exposing its hidden verification detail.
- A potential owner proves ownership through a claim and supporting evidence.
- A security guard controls custody and handover.
- Administrators retain oversight and an audit trail.

## Source-of-truth order

When documents disagree, use this order:

1. Current TypeScript implementation
2. `backend/prisma/schema.prisma` and applied migrations
3. Frontend router and role guard
4. This documentation
5. User stories or older planning material

If the implementation and documentation disagree, fix the documentation when behavior is intentional. If behavior is unclear, do not silently choose a new contract; flag the ambiguity in the PR or ask for clarification.

## First inspection pass

Before editing:

1. Read the root `package.json`.
2. Read the target feature router and neighboring feature modules.
3. Read related models and enums in `backend/prisma/schema.prisma`.
4. Read `frontend/src/router/index.tsx` and `RoleGuard.tsx` for UI access.
5. Search for existing tests, TODOs, and callers.
6. Read the relevant file in `docs/`.

Use narrow searches and inspect the actual call chain. A registered router does not prove that its handlers exist.

## Architecture constraints

- Keep the React app in `frontend/` and Express API in `backend/`.
- Keep the `/api` prefix.
- Keep feature routes under `backend/src/features/<feature>/`.
- Keep database access through Prisma.
- Keep shared API composition in `backend/src/routes/index.ts`; do not put feature logic there.
- Keep browser route access in `frontend/src/router/index.tsx`.
- Treat `RoleGuard` as a frontend convenience only. Every protected operation requires backend authorization.

## Domain invariants

### Roles

`STUDENT`, `PROFESSOR`, and `STAFF` can report, browse, claim, and comment. `SECURITY_GUARD` manages custody and handovers. `ADMIN` and `SUPERADMIN` manage administrative operations.

Role values in the Prisma enum are uppercase. Frontend route guard values are currently lowercase strings. Preserve or normalize this boundary deliberately; do not compare them casually.

### Item lifecycle

The intended lifecycle is:

```text
REPORTED -> IN_VAULT -> CLAIM_PENDING -> VERIFIED -> RETURNED
```

### Claim lifecycle

```text
PENDING -> VERIFIED
PENDING -> REJECTED
```

Do not expose `hiddenDetail` in public item responses. Use it only in the protected claim-review flow.

### Custody

Every vault entry belongs to one item and one guard, has a unique `referenceCode`, and may have handovers. A handover must record the guard, recipient, reference code, and release time.

## Safe implementation order

For a new feature, prefer:

1. Contract and authorization rules
2. Pure validation and lifecycle helpers
3. Prisma query/service logic
4. Route handler and error mapping
5. Frontend API call and UI states
6. Tests
7. Documentation

Keep each step small enough to validate. If a feature needs a schema change, create the migration before relying on the new fields.

## API rules

- Validate at the HTTP boundary.
- Return explicit status codes and stable error codes.
- Do not leak password hashes, hidden details, stack traces, or private student data.
- Enforce ownership and role checks on the server.
- Keep image URLs as references unless the task explicitly adds a storage provider.
- Use transactions when multiple related records must change together.
- Normalize errors through `backend/src/middlewares/errorHandler.ts`.

## Frontend rules

- Use the existing route tree.
- Represent loading, empty, success, and error states explicitly.
- Do not assume a request succeeded because the page rendered.
- Keep API URL configuration in `frontend/src/lib/apiClient.ts`.
- Do not duplicate role policy in arbitrary components.
- Avoid adding dependencies when an existing React or platform capability is sufficient.

## Validation checklist

Before reporting completion:

- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm run test` was run and its limitations are reported
- [ ] New or changed routes have request/response documentation
- [ ] Protected routes enforce backend authorization
- [ ] Schema changes have migrations
- [ ] Lifecycle transitions reject invalid moves
- [ ] Sensitive fields are not returned to public callers
- [ ] Loading and error states are handled in the frontend
- [ ] Related docs are updated

## Known scaffold limitations

- Auth routers are empty and seed passwords contain `TODO_SET_HASH`.
- Most backend feature routers are empty.
- Frontend pages are placeholders.
- No test files exist yet.
- No image-storage provider is configured.
- The API transport for authentication has not been selected.

Treat these as implementation work, not as reasons to hide behavior behind mocks or success-shaped fallbacks.
