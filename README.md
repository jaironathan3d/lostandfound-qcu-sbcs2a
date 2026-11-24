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

