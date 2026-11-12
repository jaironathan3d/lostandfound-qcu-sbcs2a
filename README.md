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

Authentication is implemented on the backend. The lost-and-found API is still a placeholder; this front-end demo uses sample listings and browser-local report, thread, saved-item, message, and pending-claim data. Reporting and searching real records will need item endpoints and database-backed frontend requests.

### UI demo and remaining implementation

The login and registration screens can be tested without backend credentials by running the Vite development server; `frontend/.env.development` enables `VITE_DEMO_AUTH=true` for local development. This mode is also guarded by Vite's development flag, creates only a local browser session, and accepts any non-empty username/email and password. It is not authentication: it does not create backend accounts or authorize server requests. Production builds never enable this mode, even if the variable is set. Do not use it with real user data.

This is a front-end demonstration, not a complete or secure lost-and-found system. Lost/found reports, community threads, saved listings, messages, and pending claim records are stored in browser `localStorage`; they are not sent to the backend. Clear the browser's site data to reset the demo.

The administrator and campus-security pages are placeholders. Real administrator workflows still need to be implemented, including report and claim review, comparison with private item details, dispute handling, custody tracking, audit logs, and approval and confirmation of physical handovers. The backend item, messaging, and claim APIs and database-backed frontend requests also remain unfinished.

**Messaging privacy is not implemented.** Public thread content and replies are visible to visitors, and the item-detail message form only saves a local demo record; there is no private conversation or administrator mediation. Before using real data, implement authenticated, access-controlled private messaging between the claimant and authorized administrators (and, where appropriate, the item reporter), prevent private contact and verification details from appearing in public threads/listings, and add server-side authorization, retention controls, and auditability. Never treat this browser-only demo as a way to disclose personal or ownership-verification information.

### Google sign-in request flow

1. The browser loads Google's Identity Services script and renders Google's sign-in button using `VITE_GOOGLE_CLIENT_ID`.
2. After consent, Google returns a signed ID token to the frontend. The frontend posts that credential to `POST /api/auth/google`.
3. The backend validates the token signature, audience, and verified email using `GOOGLE_CLIENT_ID`; the frontend does not decide which Google accounts are trusted.
4. The backend links or creates the account, then returns the app's own JWT. The app uses that token for its authenticated session; the Google token is not used as the app session.
