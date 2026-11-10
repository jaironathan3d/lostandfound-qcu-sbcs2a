# Lost and Found QCU SBCS2A

Lost and Found is a web platform for reporting, discovering, verifying, storing, and returning items found around campus. The repository is a TypeScript monorepo with a React frontend, an Express REST API, and a Prisma/PostgreSQL data layer.

> This repository is an active scaffold. The route groups, data model, and page inventory establish the target product, but most feature handlers and page implementations are still TODO or placeholders. Read the implementation-status sections before extending behavior.

## What the system is intended to do

1. A student, professor, or staff member reports a found item with descriptive details and images.
2. Authorized users browse public item reports and open an item discussion thread.
3. A potential owner submits a claim, answers a hidden-detail question, and supplies proof images.
4. A security guard verifies the claim, stores the item in the vault, and records the eventual handover.
5. Notifications communicate claim, moderation, and release events.
6. Administrators manage users, records, categories, and audit history.

The canonical lifecycle values are documented in [`docs/architecture.md`](docs/architecture.md) and defined in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

## Repository layout

```text
.
├── backend/
│   ├── prisma/                 # Prisma schema, migration, and seed data
│   └── src/
│       ├── config/             # Environment parsing
│       ├── features/           # Feature-owned route modules
│       ├── middlewares/        # Express middleware
│       └── routes/             # API composition and health endpoint
├── frontend/
│   └── src/
│       ├── components/         # Shared layout components
│       ├── guards/             # Role-based route guards
│       ├── lib/                # API client configuration
│       ├── pages/              # Page components (currently placeholders)
│       └── router/             # Browser route definitions
├── docs/                       # Architecture, API, test, and agent guidance
├── docker-compose.yml          # Local PostgreSQL
└── package.json                # Workspace scripts
```

## Prerequisites

- Node.js 20 or newer
- npm
- Docker Desktop (for the local PostgreSQL container)

## Local setup

From the repository root:

```bash
npm install
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
docker compose up -d
npm run prisma:migrate --workspace backend
npm run prisma:seed --workspace backend
```

On macOS/Linux, replace the `copy` commands with:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Start the applications in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

The default URLs are:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000/api`
- Health check: `http://localhost:4000/api/health`

The seed command creates sample accounts for every `UserRole`, default categories, and twenty mock student records. Seed passwords are not usable authentication credentials until password hashing and auth handlers are implemented.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev:frontend` | Start Vite frontend development server |
| `npm run dev:backend` | Start the Express server with `tsx watch` |
| `npm run lint` | Lint both workspaces |
| `npm run build` | Type-check/build both workspaces |
| `npm run test` | Run workspace test commands; tests are currently placeholders |
| `npm run prisma:migrate --workspace backend` | Apply/create a development migration |
| `npm run prisma:generate --workspace backend` | Generate the Prisma client |
| `npm run prisma:seed --workspace backend` | Seed local development data |
| `docker compose up -d` | Start PostgreSQL |
| `docker compose down` | Stop PostgreSQL |

## Current implementation status

Implemented today:

- Workspace scripts and TypeScript builds
- Express app mounting `/api`
- `GET /api/health`
- Prisma schema, initial migration, and development seed
- Frontend route map, shared layout shell, and role guard scaffolding

Scaffolded but not implemented:

- Authentication and session/token handling
- CRUD handlers for items, claims, threads, notifications, vault, users, admin, and student records
- Image upload/storage integration
- Frontend forms, API calls, loading states, and error states
- Automated unit, integration, and end-to-end tests

Do not document a feature as complete merely because its router is registered. Check the route file and its service/controller implementation first.

## Development rules

- Keep business logic inside the owning backend feature rather than putting it in `routes/index.ts`.
- Treat `backend/prisma/schema.prisma` as the source of truth for entity names, relations, roles, and status enums.
- Any schema, status lifecycle, or API contract change must update the related docs and migration, then go through a PR.
- Preserve the `/api` prefix and the existing feature route boundaries.
- Keep secrets out of the repository. Use `.env` files locally and update `.env.example` when configuration changes.
- Run `npm run lint`, `npm run build`, and `npm run test` before submitting a PR.

## Documentation and AI-agent guidance

Start with [`docs/agent-guide.md`](docs/agent-guide.md) when using an AI coding agent. It explains the source-of-truth hierarchy, safe implementation order, status transitions, validation checklist, and known scaffold limitations.

- [`docs/architecture.md`](docs/architecture.md) - system boundaries and domain model
- [`docs/api-contract.md`](docs/api-contract.md) - route groups and API conventions
- [`docs/test-plan.md`](docs/test-plan.md) - validation strategy and testing gaps
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - branch, PR, review, and commit rules
