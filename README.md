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
- For Google sign-in, create or select a project in Google Cloud Console, configure the OAuth consent screen (including test users if the app is in testing), and create an OAuth client ID with application type **Web application**. Add `http://localhost:5173` as an authorized JavaScript origin. This implementation uses the Google Identity Services button and ID-token flow, so it does not require the Gmail API, a Google API key, or an authorized redirect URI. Set the client ID as `GOOGLE_CLIENT_ID` in `backend/.env` and `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`. Keep the client ID public; never put a client secret in frontend code. Restart both development servers after changing environment files.
- New email/password and Google accounts are assigned the student role. Elevated roles must be assigned by an administrator.

The backend exposes `POST /api/auth/register` (name, email, password), `POST /api/auth/login` (email, password), `POST /api/auth/google` (Google ID token credential), and `GET /api/auth/me` (a session token in the `Authorization: Bearer ...` header). The frontend receives the Google credential from Google Identity Services and sends it to the backend. The backend verifies the credential against the configured client ID before creating or signing in the account and issuing the app's own session token.

Email/password and Google authentication use the backend and PostgreSQL. Lost/found reports and public item listings also use the database: creating a report requires an authenticated account, and the public listing API omits private identifying details, contact emails, and custody locations. The report schema migration is applied with `npm run prisma:migrate --workspace backend`.

The app's JWT session token is kept in browser `localStorage`; account, report, and claim records are stored in PostgreSQL. New item reports are private until an administrator approves them. Posters can review or delete their own pending reports at `/my-reports`; administrators review posts at `/admin-dashboard/reports`. Claimants can submit ownership details and an optional proof image, then track claim status at `/my-claims`. Users with the `ADMIN` or `SUPERADMIN` role can review claims at `/admin-dashboard`; the backend checks those roles before returning private report/claim details or accepting an approve/reject decision. Decisions are recorded in the audit log. Approval verifies ownership but does not confirm a physical handover.

Signed-in users can suggest that a found item matches an approved lost-item report. Administrators review suggestions at `/admin-dashboard/matches` and record a collection location when approving. Administrators can also mark an approved lost report found directly from `/admin-dashboard/reports`, optionally linking an approved found report. The report owner can see confirmed-found and returned items, plus collection details, in `/my-claims` and `/my-reports`.

Community threads, replies, follows, and private item conversations are stored in PostgreSQL. Signed-in users can find their conversations at `/messages`; only the two participants can read or reply. Saved listings remain browser-local. The campus-security dashboard and physical handover workflow are placeholders.

**Public thread posts and replies are visible to all visitors.** Users should keep contact details and ownership-verification information out of public threads. Private conversations are access-controlled to their participants, but do not have administrator mediation or configurable retention controls.

### Google sign-in request flow

1. The browser loads Google's Identity Services script and renders Google's sign-in button using `VITE_GOOGLE_CLIENT_ID`.
2. After consent, Google returns a signed ID token to the frontend. The frontend posts that credential to `POST /api/auth/google`.
3. The backend validates the token signature, audience, and verified email using `GOOGLE_CLIENT_ID`; the frontend does not decide which Google accounts are trusted.
4. The backend links or creates the account, then returns the app's own JWT. The app uses that token for its authenticated session; the Google token is not used as the app session.
