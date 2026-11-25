# Project Progress

## Project overview

- Project: QCU CCS Lost and Found website.
- Location: `C:\Users\Anthony\lostandfound-qcu-sbcs2a`.
- Stack: React 19, TypeScript, Vite, React Router, Express 5, Prisma 7, PostgreSQL 19.
- Current branch: `C-o-r-n-y`.
- Working branch: `C-o-r-n-y`; implementation changes are uncommitted.
- Repository state: the current branch is 5 commits ahead of `main` and contains the combined implementation work.

## Current development phase

Current phase: **Phase 12 — Pilot Testing Preparation**. A local isolated staging environment and fictional-data backup/restore drill are verified; institutional approval and a controlled pilot deployment remain.

## Phase-by-phase status

| Phase | Status | Evidence and remaining work |
|---|---|---|
| 0 — Project Audit | Complete | Repository, branches, architecture, existing features, and baseline state were audited. |
| 1 — Project Stability and Environment | Complete for local development | Frontend/backend builds and startup, PostgreSQL connection, 16 migrations, seed data, health endpoint, and seeded login were verified. PostgreSQL uses a local user-owned cluster on port 5433. |
| 2 — Database and Student Records | Partially complete | Student records, linked user accounts, `##-####` validation, registration persistence, admin search/edit/import, and database uniqueness exist. Full admin workflows and activation/association edge cases need integration coverage. |
| 3 — Authentication and Roles | Partially complete | Student registration/login/logout, three roles, role guards, Terms/Privacy acknowledgement, hashed reset tokens, and reset flow exist. Email delivery and rate limiting are missing; activation behavior and the full workflow need verification. |
| 4 — Item Management and Media | Partially complete; API workflows verified | Reports accept up to four multipart image/video attachments, with 10 MiB image and 25 MiB video defaults. Files are staged and stored on disk; MIME, extension, size, and file signatures are checked. Pending media uses short-lived signed links; approved media is publicly retrievable. API tests cover edit, approval/rejection, owner deletion, media cleanup, and post-moderation restrictions; browser end-to-end coverage remains. |
| 5 — Search and Categories | Partially complete; backend behavior verified | Integration tests cover keyword/type/category/location/date filters, status visibility, stable sorting/pagination, malformed date/page rejection, category create/rename/duplicate handling, and protection of categories in use. Browser end-to-end coverage remains. |
| 6 — Claim Verification | Partially complete; supporting-document workflow implemented | Claims accept one optional COR and one optional class schedule (PDF/JPG/PNG/WebP, 10 MiB each) using disk storage. Claimant/admin links are signed and private; files and document rows are removed after approval or rejection. API tests cover both decisions and cleanup; browser end-to-end coverage remains. |
| 7 — Chat and Notifications | Core workflows implemented; browser verification remains | Participants can report a conversation once, administrators can review its report and transcript, and authenticated users can list and mark in-app notifications as read. New messages and item/claim/conversation review outcomes generate notifications. PostgreSQL integration tests cover participant/admin authorization, report lifecycle, transcript access, and notification privacy/read state. |
| 8 — Item Return Management | Core workflows implemented; browser verification remains | Administrators can intake approved found items and confirmed lost reports into the vault, issue private handover codes to eligible owners, and record audited physical releases. Handover updates the item and linked lost-report status; direct unverified return actions are rejected. Integration tests cover vault access, duplicate intake, claim state restoration, owner/code authorization, and release history. |
| 9 — Frontend Completion | Complete for the current role model | Public, auth, report, student-record, and admin pages were responsive-smoke-tested on narrow viewports with no horizontal page overflow. The Campus Security role/dashboard is explicitly deferred because the current system supports only student/admin roles. |
| 10 — System Integration | Core API and browser smoke verified | `npm --workspace backend test` passes 12/12 PostgreSQL integration tests; all five Playwright tests pass, including seeded-admin vault access. Workspace build and lint pass. |
| 11 — Security and Regression Testing | Complete for the reviewed changes | No actionable vulnerabilities were found in reviewed application changes. Full and production npm audits both report 0 vulnerabilities after upgrading to Prisma 7.10.1 and applying the compatible Effect override. This was not a comprehensive external security audit. |
| 12 — Pilot Testing Preparation | Local staging and restore drill verified; institutional pilot pending | `lostandfound_pilot_stage` is separate from the existing database, has 16 migrations and fictional seed data, and runs on ports 4001/5174. Its database-and-storage backup restored successfully into a separate verification database. Pilot authorization and an institutional environment remain outstanding. |
| 13 — Final Verification | Local verification complete; not ready for real-data pilot | Build, lint, PostgreSQL integration, Playwright, migration, audit, and isolated restore checks pass. An authorized deployment, security configuration, pilot-specific acceptance checks, and operational ownership remain prerequisites. |

## Completed and verified

- PostgreSQL 19 is running locally on port 5433; all 16 migrations and documented fictional seed data are applied.
- Backend integration tests cover health, database-backed categories, login validation, seeded login, and report-media edit behavior.
- Multipart media tests cover three simultaneous file types, an image larger than 1 MiB, invalid signatures, over-limit images, the four-file cap, pending-media authorization, and public retrieval after approval.
- Item lifecycle tests cover pending deletion ownership, physical media cleanup, admin rejection, and preventing edits/deletions after moderation.
- Search/category tests cover filters, inclusive date ranges, invalid dates/page numbers, stable pagination, category uniqueness/rename, authorization, item counts, and preventing deletion of used categories.
- Conversation tests cover participant-only access, duplicate and invalid reports, admin transcript review, cross-account notification-read denial, and unread-state updates.
- Vault tests cover authorized intake, owner-only code visibility, eligibility and code checks, repeat-operation rejection, handover history, and claim/lost-report state transitions.
- Workspace production build and lint pass.

## Partially completed

- Authentication and role guards.
- Student registration and Student Records.
- Lost/found item reports and public listings.
- Search and category management.
- Claims and administrator claim review.
- Item media uploads.
- Item matching and confirmed-found workflow.
- Community threads and private participant conversations.
- Administrator dashboards and user/student record management.
- Password reset flow.

## Known limitations and missing requirements

- Browser automation currently covers public browse/filter, mobile overflow, auth guard and invalid-login behavior, and seeded-admin vault access; broader claim/media/thread browser workflows are not covered by Playwright.
- Supporting claim documents are private and removed after review; other private-document workflows still require review.
- The campus-security dashboard remains a placeholder; vault operations are currently restricted to administrators and Super Administrators.
- Super Admin account and system-wide configuration workflows require verification.
- Conversation retention controls and real email/push notification delivery are not implemented.
- Full and production dependency audits both report 0 vulnerabilities. Broader end-to-end testing and pilot preparation remain separate from this verified scope.
- `docs/pilot-readiness.md` documents the backup/restore drill and pilot go/no-go checklist. PostgreSQL 19 `pg_dump`, `pg_restore`, and `createdb` are installed; the backup/restore drill used only isolated fictional staging data, not the original `lostandfound` database.
- Created isolated PostgreSQL staging database `lostandfound_pilot_stage` with all 16 migrations and fictional seed data (3 test accounts, 5 student records). Its backend/frontend run on ports 4001/5174 with a generated staging-only JWT secret and file storage under `%LOCALAPPDATA%`.
- Staging browser suite: 5/5 Playwright tests passed; staging health, fictional administrator login, CORS origin, and frontend HTTP 200 were verified.
- Backend integration suite: 12/12 passed against staging with isolated temporary media storage; post-test checks confirmed the three seeded accounts and five student records remained and all test items, claims, conversations, vault entries, and handovers were cleaned up.
- Backed up only the fictional staging database and its separate storage directories, then restored into `lostandfound_stage_restore_20261124_172934`. Verified 16 migrations, 3 fictional users, 5 fictional student records, and calculated the archive SHA-256. The original `lostandfound` database was not modified.

## Database and migration state

- PostgreSQL schema and migration history exist under `backend/prisma`.
- Prisma 7.10.1 Client is generated locally through the PostgreSQL driver adapter.
- PostgreSQL 19 is installed locally.
- A dedicated user-owned PostgreSQL cluster is running on port 5433.
- The earlier port 5432 service configuration is not used by the project environment.
- The `lostandfound` development database was created.
- All 16 Prisma migrations were applied successfully.
- The documented fictional pilot data was seeded successfully.
- No database reset or migration deletion was performed.

## Verification performed

- Initial Git status and branch audit: clean.
- Frontend build: passed.
- Initial backend build: failed because dependencies were incomplete and Prisma types were not generated.
- `npm install --legacy-peer-deps`: completed due to the existing ESLint peer-dependency conflict.
- Prisma generate: passed.
- Backend build after restoration: passed.
- Workspace build after restoration: passed.
- Added a Playwright browser suite; all five tests pass with the seeded administrator credentials configured.
- Backend startup: passed with temporary environment variables.
- Backend health endpoint: `GET /api/health` returned `{ "status": "ok" }`.
- Docker is not required because PostgreSQL 19 is installed locally and running natively on Windows.
- PostgreSQL 19 is installed locally and running through the Windows service/cluster.
- Local backend and frontend environment files are configured.
- Local database migrations: passed.
- Local seed: passed.
- Live backend health: `GET /api/health` returned `{ "status": "ok" }`.
- Live seeded student login: passed.
- Live frontend page: HTTP 200 at `http://127.0.0.1:5173`.
- Backend integration tests: 5/5 passed on PostgreSQL port 5433.
- PostgreSQL authentication aligned to the project-supplied local password.
- Fixed the Express 5 error handler signature and verified the live backend.
- Pending-report edits now preserve existing media by default, display the existing attachments, and remove them only when explicitly selected.
- Added backend validation that retained media IDs belong to the report and that retained plus newly attached files stay within the four-file cap.
- Added multipart uploads with disk staging, signature checks, configurable size limits, signed pending-media URLs, and cleanup when media is removed.
- Frontend report form supports multiple image and video selections, previews, attachment removal, and multipart submission.
- Backend integration tests: 6/6 passed, including media retention/removal, multipart upload, size/type/count rejection, and pending/public media access.
- Backend integration tests: 9/9 passed, including item lifecycle/moderation, search filters/pagination, and category administration.
- Backend integration tests: 10/10 passed, including private claim-document upload/download and cleanup after both approval and rejection.
- Added and applied `20261124161500_conversation_reports_and_notification_links`; Prisma reports all 16 migrations are applied.
- Added participant-authorized conversation reporting, private admin transcript investigation, audit-logged review/dismiss decisions, and report status notifications.
- Replaced the notifications placeholder with authenticated list, unread count, mark-one-read, and mark-all-read endpoints. New messages and item/claim review decisions generate linked in-app notifications.
- Added conversation-reporting and notification-inbox UI to Messages, plus an admin conversation safety review page.
- Backend integration tests: 11/11 passed, including conversation reports, transcript permissions, notification privacy, and unread-state updates.
- Backend/frontend builds and workspace lint pass after Phase 7 changes.
- Implemented administrator-only vault intake and physical handover routes using the existing VaultEntry/Handover models. Intake creates private owner codes and rejects duplicate records; releases require a verified claimant or confirmed lost-report owner plus the matching code.
- Vault operations update item and lost-report states, retain handover/audit history, notify the owner, and prevent the old direct mark-returned action from bypassing verification.
- Added the admin Vault & Handover page and owner-facing collection-code display on My Claims; found items in storage remain browsable and claimable.
- Backend integration tests: 12/12 passed, including secure code access, duplicate/invalid operations, claim restoration to vault, and complete return workflows.
- Added and applied the additive `20261124160000_add_claim_documents` migration; Prisma reports the schema is up to date.
- Workspace build and lint pass after claim-document UI and API changes.
- Invalid calendar dates, reversed date ranges, and unsafe page numbers now return explicit validation errors instead of reaching Prisma queries.
- Workspace build and lint: passed after report-media changes.
- Local PostgreSQL on port 5433 was restarted after it was found stopped; database-backed verification then passed.
- Removed the non-functional login "Remember me" control.
- Updated administrator CSV student-record import so class schedules and university email remain optional, with `##-####` Student ID validation.
- Workspace build: passed after focused fixes.
- Workspace lint: passed after focused fixes.
- Phase 8 browser smoke: seeded administrator sign-in succeeded; `/admin-dashboard/vault` rendered with vault counts and navigation, vault/admin-item API requests returned HTTP 200, and the browser console reported no errors or warnings.
- Phase 9 responsive smoke: public home, item browse, threads, safety-help, sign-in, and administrator vault, student-record, category, item-report, match, and conversation pages rendered at narrow viewport sizes without horizontal page overflow.
- Phase 10 integration verification: `npm --workspace backend test` passed 12/12; the five-test Playwright suite passed; `npm run build` and `npm run lint --workspaces` passed.
- Added a Playwright E2E suite for public browse/filter behavior, 390px responsive layout checks, unauthenticated admin-route protection, invalid-login feedback, and seeded-admin vault/API access.
- Upgraded Prisma to 7.10.1 with the PostgreSQL driver adapter and Prisma config; build, migration status, and all 12 PostgreSQL integration tests pass. All 16 existing migrations are present and the schema is up to date; no reset or new migration was run.
- Full and production `npm audit` both report 0 vulnerabilities after the Prisma upgrade and Effect override.
- Phase 11 security review found no actionable vulnerabilities in the reviewed application changes. The final regression run passes; one non-failing `pg@8` deprecation warning originates in `@prisma/adapter-pg` transaction execution and should be monitored for upstream fixes.

## Next planned task

Obtain institutional pilot authorization and provision an access-controlled deployment, then complete security configuration and pilot-specific acceptance checks. The local staging backup/restore drill is complete; the existing `lostandfound` development database remains intact with all 16 migrations applied. The Campus Security page remains deferred; adding it later requires defining a new role and its permissions/API workflow because the current role model supports only students and administrators.
