# Lost and Found QCU SBCS2A

Starter monorepo scaffold for the Lost and Found thesis project.

## Project structure

- `frontend` - React + TypeScript + Vite app
- `backend` - Node.js + TypeScript + Express + Prisma app
- `docs` - architecture/API/testing templates

## Setup

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

## Authentication setup

- Copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET` to a random secret of at least 32 characters. Generate one in PowerShell with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Copy `frontend/.env.example` to `frontend/.env`.
- Run the authentication migration with `npm run prisma:migrate --workspace backend`.
- New email/password accounts are assigned the student role. Elevated roles must be assigned by an administrator.

The backend exposes `POST /api/auth/register` (name, `##-####` Student ID, course, year level, email, password, confirmation, Terms acceptance, and Privacy acknowledgment), `POST /api/auth/login` (email, password), `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, and `GET /api/auth/me` (a session token in the `Authorization: Bearer ...` header). Registration creates and links a Student Record; it does not require a preloaded official QCU record. Password-reset tokens are hashed and expire after 30 minutes, but real email delivery is not configured in this repository.

Fictional test-data setup, accounts, and cleanup instructions are documented in [docs/test-data.md](docs/test-data.md). Test records and accounts must not be used in a production or authorized pilot database.

Email/password authentication uses the backend and PostgreSQL. Lost/found reports and public item listings also use the database: creating a report requires an authenticated account, and the public listing API omits private identifying details, contact emails, and custody locations. The report schema migration is applied with `npm run prisma:migrate --workspace backend`.

The app's JWT session token is kept in browser `localStorage`; account, report, and claim records are stored in PostgreSQL. New item reports are private until an administrator approves them. Posters can review or delete their own pending reports at `/my-reports`; administrators review posts at `/admin-dashboard/reports`. Claimants can submit ownership details and an optional proof image, then track claim status at `/my-claims`. Users with the `ADMIN` or `SUPER_ADMIN` role can review claims at `/admin-dashboard`; the backend checks those roles before returning private report/claim details or accepting an approve/reject decision. Decisions are recorded in the audit log. Approval verifies ownership but does not confirm a physical handover.

Signed-in users can suggest that a found item matches an approved lost-item report. Administrators review suggestions at `/admin-dashboard/matches` and record a collection location when approving. Administrators can also mark an approved lost report found directly from `/admin-dashboard/reports`, optionally linking an approved found report. The report owner can see confirmed-found and returned items, plus collection details, in `/my-claims` and `/my-reports`.

Community threads, replies, follows, and private item conversations are stored in PostgreSQL. Signed-in users can find their conversations at `/messages`; only the two participants can read or reply. Saved listings remain browser-local. The campus-security dashboard and physical handover workflow are placeholders.

**Public thread posts and replies are visible to all visitors.** Users should keep contact details and ownership-verification information out of public threads. Private conversations are access-controlled to their participants, but do not have administrator mediation or configurable retention controls.

