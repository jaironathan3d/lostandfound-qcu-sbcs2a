# Test Plan

## Scope

The product needs coverage for:

- Authentication and role authorization
- Item reporting, browsing, detail, and lifecycle transitions
- Claim validation and guard review
- Vault intake, reference codes, handovers, and release
- Thread/comment permissions
- Notification creation and read state
- Admin actions and audit logging
- Frontend route guards, forms, loading states, and API error states

## Current baseline

There are no test files in the repository yet. The workspace test scripts currently print `No backend tests yet` and `No frontend tests yet`, so a green `npm run test` is not evidence of feature correctness.

CI currently runs:

```bash
npm ci
npm run lint
npm run build
npm run test
```

See `.github/workflows/ci.yml`.

## Recommended test levels

### Unit tests

Use unit tests for pure validation, role checks, status-transition rules, environment parsing, and API response helpers.

### Integration tests

Use a test PostgreSQL database for Prisma-backed route tests. Cover database constraints, relations, transactions, and authorization at the HTTP boundary.

### Frontend tests

Cover route access, form validation, API success/error states, and rendering of empty/loading states. Keep API calls behind a small client abstraction so tests can mock the boundary.

### End-to-end tests

Once the core flows exist, cover:

1. Login/register
2. Report item
3. Browse and open item
4. Submit and review claim
5. Vault intake and handover
6. Notification acknowledgement

## Validation commands

Run from the repository root:

```bash
npm run lint
npm run build
npm run test
```

For database work:

```bash
docker compose up -d
npm run prisma:migrate --workspace backend
npm run prisma:generate --workspace backend
npm run prisma:seed --workspace backend
```

## Test data and isolation

Use deterministic test users for each `UserRole`. Do not rely on the development seed for destructive or parallel tests. Use a separate database/schema or reset strategy for integration tests.

Never use real student records, credentials, or personal images in tests.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Empty test scripts appear successful | Replace placeholders with a real test runner before feature completion |
| Role checks exist only in the frontend | Enforce authorization in backend middleware/services |
| Invalid lifecycle transitions corrupt data | Centralize transition rules and test every allowed/denied edge |
| Image references point to unavailable files | Mock storage in tests and validate upload ownership |
| Tests share mutable PostgreSQL data | Isolate database state per suite or test |
