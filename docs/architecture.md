# Architecture

## Context

The system has three runtime layers:

```text
React/Vite browser app
        |
        | HTTP JSON requests to /api
        v
Express/TypeScript API
        |
        | Prisma queries
        v
PostgreSQL
```

The frontend is in `frontend/`, the API is in `backend/`, and the database contract is in `backend/prisma/schema.prisma`. Local PostgreSQL is provisioned by `docker-compose.yml`.

## Components

### Frontend

- Entry point: `frontend/src/main.tsx`
- App shell: `frontend/src/App.tsx` and `frontend/src/components/AppLayout.tsx`
- Browser routes: `frontend/src/router/index.tsx`
- API base URL: `frontend/src/lib/apiClient.ts`
- Role guard: `frontend/src/guards/RoleGuard.tsx`
- Current pages: login, register, browse items, item detail, report item, my claims, guard dashboard, and admin dashboard

The page components currently render placeholders. New pages should use the existing router and keep role restrictions in `RoleGuard`.

### Backend

- Server startup: `backend/src/server.ts`
- Express app: `backend/src/app.ts`
- API composition: `backend/src/routes/index.ts`
- Error middleware: `backend/src/middlewares/errorHandler.ts`
- Environment parsing: `backend/src/config/env.ts`
- Feature boundaries: `backend/src/features/*`

All API routes are mounted below `/api`. Each feature owns its router and should eventually own validation, service logic, and persistence calls.

### Database

Prisma models currently cover:

- `User` and `StudentRecord` for identity and campus records
- `Category` and `Item` for reports
- `ItemImage` and `ClaimProofImage` for media references
- `Claim` for ownership verification
- `Thread` and `Comment` for item discussion
- `Notification` for user-facing events
- `VaultEntry` and `Handover` for custody and release
- `AuditLog` for administrative traceability

Images are represented as URLs in the database. A concrete object-storage provider is not configured yet.

## Request flow

1. The browser loads a route from `frontend/src/router/index.tsx`.
2. A page uses the configured API base URL, normally `http://localhost:4000/api`.
3. Express receives the request through `backend/src/app.ts`.
4. `routes/index.ts` dispatches to a feature router.
5. The feature validates identity, role, input, and lifecycle rules.
6. Prisma reads or writes PostgreSQL.
7. The API returns a documented JSON response or passes an error to `errorHandler`.
8. The frontend renders success, loading, empty, or error state.

The auth and feature-handler steps are target behavior until their TODO routers are implemented.

## Domain lifecycles

### Item status

```text
REPORTED -> IN_VAULT -> CLAIM_PENDING -> VERIFIED -> RETURNED
```

The exact transition rules still need to be enforced by the claims and vault features. Do not add a new status casually; update the Prisma enum, migration, API contract, UI behavior, and tests together.

### Claim status

```text
PENDING -> VERIFIED
PENDING -> REJECTED
```

Only an authorized reviewer should transition a claim out of `PENDING`.

### Roles

| Role | Intended responsibility |
|---|---|
| `STUDENT` | Browse, report, claim, comment |
| `PROFESSOR` | Browse, report, claim, comment |
| `STAFF` | Browse, report, claim, comment |
| `SECURITY_GUARD` | Review claims, manage vault, record handovers |
| `ADMIN` | Moderate users, records, reports, and audit data |
| `SUPERADMIN` | Highest administrative scope |

## Current implementation boundaries

The route groups below are registered, but most are empty TODO routers:

`/auth`, `/users`, `/items`, `/claims`, `/threads`, `/notifications`, `/vault`, `/admin`, and `/student-records`.

`GET /api/health` is the only implemented endpoint currently visible in the source. Agents must inspect the target feature before assuming an endpoint exists.

## Change checklist

For an architecture-affecting change:

1. Update the implementation and its nearest feature module.
2. Update the Prisma schema/migration if persistence changes.
3. Update [`api-contract.md`](api-contract.md) for request/response behavior.
4. Update this document for new boundaries or lifecycle rules.
5. Add or update tests, then run the root validation commands.
