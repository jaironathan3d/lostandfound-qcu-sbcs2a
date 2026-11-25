# Lost and Found QCU SBCS2A

Lost and Found is a web platform for reporting, discovering, verifying, storing, and returning items found around campus. The repository is a TypeScript monorepo with a React frontend, an Express REST API, and a Prisma/PostgreSQL data layer.

> This repository is an active scaffold. The route groups, data model, and page inventory establish the target product, but most feature handlers and page implementations are still TODO or placeholders. Read the implementation-status sections before extending behavior.

<<<<<<< HEAD
## What the system is intended to do
=======
- `frontend` - React + TypeScript + Vite app
- `backend` - Node.js + TypeScript + Express + Prisma app
- `docs` - architecture/API/testing templates
>>>>>>> origin/C-o-r-n-y

1. A student, professor, or staff member reports a found item with descriptive details and images.
2. Authorized users browse public item reports and open an item discussion thread.
3. A potential owner submits a claim, answers a hidden-detail question, and supplies proof images.
4. A security guard verifies the claim, stores the item in the vault, and records the eventual handover.
5. Notifications communicate claim, moderation, and release events.
6. Administrators manage users, records, categories, and audit history.

<<<<<<< HEAD
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
=======
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
4. Start PostgreSQL with Docker Compose:
   ```bash
   docker compose up -d
   ```
5. Run Prisma migration:
   ```bash
   npm run prisma:migrate --workspace backend
   ```
6. Seed initial data:
   ```bash
   npm run prisma:seed --workspace backend
   ```
7. Run apps in separate terminals:
   ```bash
   npm run dev:backend
   npm run dev:frontend
   ```

The backend uses Prisma 7 with the PostgreSQL driver adapter. Set `DATABASE_URL` in `backend/.env` for the PostgreSQL instance you use; `backend/prisma.config.ts` loads the backend environment and migration configuration. Backend dev, build, start, test, and migration scripts generate the Prisma Client automatically. Use the existing migration workflow for schema changes; do not reset a database containing data.

The included Docker Compose database configuration and credentials are for local development only. Pilot setup, backup, restore, and readiness gates are documented in [docs/pilot-readiness.md](docs/pilot-readiness.md).

Item attachments are stored on local disk under `backend/storage/item-media` by default, not in PostgreSQL. Configure `ITEM_MEDIA_DIRECTORY`, `ITEM_IMAGE_MAX_BYTES` (default 10 MiB), and `ITEM_VIDEO_MAX_BYTES` (default 25 MiB) in `backend/.env`; set the matching `VITE_ITEM_*_MAX_BYTES` values in `frontend/.env.development` to keep browser validation in sync. Reports support up to four total image/video attachments.

Claim support documents are stored privately under `backend/storage/claim-documents` by default. Configure `CLAIM_DOCUMENT_DIRECTORY` and `CLAIM_DOCUMENT_MAX_BYTES` in `backend/.env`, and set the matching `VITE_CLAIM_DOCUMENT_MAX_BYTES` in `frontend/.env.development`. A claimant may optionally attach one Certificate of Registration and one class schedule (PDF, JPG, PNG, or WebP; 10 MiB each by default). The claimant and authorized administrators receive short-lived download links; stored files and document records are deleted after approval or rejection. Back up the media directories together with the database.

## Authentication setup

- Copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET` to a random secret of at least 32 characters. Generate one in PowerShell with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Copy `frontend/.env.example` to `frontend/.env`.
- Run the authentication migration with `npm run prisma:migrate --workspace backend`.
- New email/password accounts are assigned the student role. Elevated roles must be assigned by an administrator.

The backend exposes `POST /api/auth/register` (name, `##-####` Student ID, course, year level, email, password, confirmation, Terms acceptance, and Privacy acknowledgment), `POST /api/auth/login` (email, password), `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, and `GET /api/auth/me` (a session token in the `Authorization: Bearer ...` header). Registration creates and links a Student Record; it does not require a preloaded official QCU record. Password-reset tokens are hashed and expire after 30 minutes, but real email delivery is not configured in this repository.

Fictional test-data setup, accounts, and cleanup instructions are documented in [docs/test-data.md](docs/test-data.md). Test records and accounts must not be used in a production or authorized pilot database.

Email/password authentication uses the backend and PostgreSQL. Lost/found reports and public item listings also use the database: creating a report requires an authenticated account, and the public listing API omits private identifying details, contact emails, and custody locations. The report schema migration is applied with `npm run prisma:migrate --workspace backend`.

The app's JWT session token is kept in browser `localStorage`; account, report, and claim records are stored in PostgreSQL. New item reports are private until an administrator approves them. Posters can review or delete their own pending reports at `/my-reports`; administrators review posts at `/admin-dashboard/reports`. Claimants can submit ownership details and an optional proof image, then track claim status at `/my-claims`. Users with the `ADMIN` or `SUPER_ADMIN` role can review claims at `/admin-dashboard`; the backend checks those roles before returning private report/claim details or accepting an approve/reject decision. Decisions are recorded in the audit log. Claim approval verifies ownership but does not confirm a physical handover.

Administrators can receive approved found items or confirmed lost reports into secure storage at `/admin-dashboard/vault`. The system generates a private handover code for an eligible owner; it is shown in that owner’s My Claims page and in their private notifications, not in the administrator’s vault listing. At collection, an administrator records the recipient and verifies the presented code. The resulting handover is audit-logged, and the item and related lost report are marked returned.

Signed-in users can suggest that a found item matches an approved lost-item report. Administrators review suggestions at `/admin-dashboard/matches` and record a collection location when approving. Administrators can also mark an approved lost report found directly from `/admin-dashboard/reports`, optionally linking an approved found report. The report owner can see confirmed-found and returned items, plus collection details, in `/my-claims` and `/my-reports`.

Community threads, replies, follows, and private item conversations are stored in PostgreSQL. Signed-in users can find their conversations and in-app notifications at `/messages`; only the two participants can read or reply. Participants can report a conversation for safety concerns, and administrators can review the report and its transcript at `/admin-dashboard/conversations`. Notifications include new messages and item/claim moderation outcomes; they are in-app only. Saved listings remain browser-local. The campus-security dashboard is still a placeholder; vault intake and handover are restricted to administrator roles.

**Public thread posts and replies are visible to all visitors.** Users should keep contact details and ownership-verification information out of public threads. Private conversations are access-controlled to their participants; an administrator may inspect a conversation only when a participant submits a report. Configurable conversation retention controls are not implemented.

## Browser end-to-end tests

The frontend Playwright suite requires the local PostgreSQL database to be migrated and seeded, the backend environment to be configured, and Microsoft Edge to be installed. The Playwright configuration starts or reuses the backend and frontend development servers.

Run the public browse, access-control, and invalid-login checks with:

```bash
npm run test --workspace frontend
```

The seeded-administrator vault check also runs when `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` are set to the fictional administrator credentials from [docs/test-data.md](docs/test-data.md). Without them, that one test is skipped. The suite does not create, edit, or delete database records.

>>>>>>> origin/C-o-r-n-y
