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

<<<<<<< HEAD
| Risk | Mitigation |
|---|---|
| Empty test scripts appear successful | Replace placeholders with a real test runner before feature completion |
| Role checks exist only in the frontend | Enforce authorization in backend middleware/services |
| Invalid lifecycle transitions corrupt data | Centralize transition rules and test every allowed/denied edge |
| Image references point to unavailable files | Mock storage in tests and validate upload ownership |
| Tests share mutable PostgreSQL data | Isolate database state per suite or test |
=======
## Phase 4 media verification

- Valid JPG, PNG, and WebP image data is accepted.
- Valid MP4 and WebM video data is accepted.
- Unsupported or mismatched media types are rejected.
- Up to four image/video attachments are accepted per report.
- Image and video size limits (10 MiB and 25 MiB by default) are enforced by the API and configurable through backend environment variables.
- Uploads are streamed to temporary disk files and stored outside the database.
- Stored files for pending reports are not readable without a short-lived, authenticated media link.
- Pending report edits preserve existing media by default.
- Users can explicitly remove selected pending-report media.
- Attempts to retain media belonging to another report are rejected.
- Pending reports can add media while retaining existing attachments.
- Approved and returned reports cannot be edited.
- Public listings expose media only for approved reports.
- Verified by the PostgreSQL integration suite: three simultaneous file types, >1 MiB image, invalid signature, over-limit image, >4-file rejection, private pending-media access, and public approved-media retrieval.
- Pending deletion is limited to the owning reporter; deleting a pending report removes its stored files.
- Rejected reports are excluded from public listings and cannot be edited or deleted by the reporter.
- Repeated moderation decisions and edits/deletions after approval are rejected.

## Phase 5 search and categories

- Public search supports keyword, Lost/Found type, category, location, date range, sorting, and pagination.
- Approved reports only are returned.
- Category names are available to public browsing and report forms.
- Administrators and Super Administrators can create, rename, search, and delete unused categories.
- Duplicate category names are rejected.
- Categories used by reports cannot be deleted.
- Verified by the PostgreSQL integration suite: filter combinations, inclusive date ranges, stable sorting/pagination, invalid date/page rejection, category create/rename/duplicate handling, role authorization, usage counts, and used-category deletion protection.

## Phase 6 claim documents

- Claimants may optionally upload one COR and one class schedule as PDF, JPG, PNG, or WebP files up to 10 MiB each.
- Invalid signatures, duplicate document fields, and oversized uploads are rejected.
- Documents are stored outside PostgreSQL; short-lived signed links are available only to the claimant and authorized administrators while the claim is pending.
- Admin approval or rejection deletes the document files and associated rows.
- Existing optional proof-image submission continues to work alongside multipart document uploads.
- Verified by the PostgreSQL integration suite: upload and signed owner/admin downloads, unauthenticated access denial, and file/row cleanup after both approval and rejection.

## Phase 7 chat and notifications

- Conversation messages and reports can be accessed only by the two participants.
- A participant may submit one safety report per conversation, with a validated reason and optional detail; duplicate, invalid, and nonparticipant submissions are rejected.
- Administrators can inspect pending reports and the related transcript, then mark the report reviewed or dismiss it; repeated decisions are rejected and recorded in the audit log.
- Notifications are scoped to their owner, list the newest 50 entries, expose an unread count, and support marking one or all as read.
- New private messages, conversation report acknowledgements/reviews, item report decisions, and claim decisions generate in-app notifications with internal links.
- Verified by the PostgreSQL integration suite: participant/admin authorization, report lifecycle, transcript access, cross-account notification-read denial, notification creation, and unread-state updates.

## Phase 8 vault and physical handover

- Only administrators and Super Administrators can view vault entries, receive eligible approved items, or record handovers.
- Vault intake requires a secure storage location, updates the item custody state, and cannot create duplicate vault records.
- Found items in secure storage remain publicly discoverable and claimable. Rejected claims restore the item to its in-vault state.
- Handover is allowed only to a verified claimant or the owner of a confirmed lost report, and the presented code must match the private code issued to that owner.
- The code is exposed only through that owner’s `/claims/mine` response and notifications; administrator vault listings and handover history do not expose it.
- Successful handover creates a handover record, updates the vault/item/lost-report status, and records an audit event. Repeated or direct unverified return actions are rejected.
- Verified by the PostgreSQL integration suite: unauthorized access, invalid storage location, duplicate intake, code/recipient validation, successful and repeated handover, claimant collection-code visibility, rejected-claim state restoration, and direct lost-report return.

## Phase 9 responsive/browser smoke

- Checked the public home, item browse, threads, safety-help, and sign-in pages, plus the administrator vault, student records, categories, item reports, matches, and conversation safety pages in a narrow browser viewport.
- Each checked page's document width matched its viewport width; no horizontal page overflow was observed.
- The administrator vault page rendered successfully after seeded-admin sign-in. `POST /api/auth/login`, `GET /api/vault?status=ALL`, and `GET /api/admin/items?status=APPROVED` returned HTTP 200; the browser console had no errors or warnings.
- The Campus Security placeholder remains outside this responsive smoke scope. The current role model has no security/guard role or matching authorization/API workflow, so completing it requires a separately defined role and permissions design.

## Phase 10 system integration

- `npm --workspace backend test` — passed, 12/12 PostgreSQL-backed integration tests.
- `npm run build` — passed for frontend and backend workspaces.
- `npm run lint --workspaces` — passed for frontend and backend workspaces.
- Browser smoke verified public and administrator page rendering, no horizontal overflow on the checked narrow viewports, and successful administrator vault API requests.
- The frontend Playwright suite covers public browse/filter API integration, narrow-screen overflow checks, unauthenticated admin-route redirection, invalid-login feedback, and seeded-admin vault/API access.
- The seeded-admin test is skipped unless its test-account email and password are provided through `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`.

## Phase 11 security/regression review

- The security-review agent found no actionable vulnerabilities in the reviewed application changes.
- The match-submission alert from the prior review was checked against the public UI and product documentation: any signed-in user is intentionally allowed to suggest a match, and administrators review suggestions before the owner is notified. Owner-only access was not imposed because it would break the documented workflow.
- Prisma was upgraded to 7.10.1 with the PostgreSQL driver adapter and config; all 16 existing migrations are present and the database schema is up to date. No database reset or migration was performed as part of the upgrade.
- `npm audit` — passed with 0 vulnerabilities.
- `npm audit --omit=dev` — passed with 0 production vulnerabilities.
- `npm --workspace backend test` — passed, 12/12 PostgreSQL-backed integration tests.
- `npm run test --workspace frontend` — passed, 5/5 Playwright tests with the seeded administrator credentials configured.
- `npm run build` and `npm run lint --workspaces` — passed.
- The backend test run emits a non-failing `pg@8` deprecation warning from `@prisma/adapter-pg` transaction execution; no test failures occurred.
- Review scope covers the application changes and regression areas listed above; it is not a comprehensive external security audit. Browser coverage for claims, media, and handovers remains limited.

## Phase 12 local staging and restore drill

- Created `lostandfound_pilot_stage` separately from the original development database, applied all 16 migrations, and seeded only fictional accounts and student records.
- `npm exec --workspace backend -- tsx --test src/test/*.test.ts` — passed, 12/12 PostgreSQL integration tests against staging with separate temporary media/document storage. Test fixtures were cleaned up.
- `E2E_BASE_URL=http://localhost:5174` with the seeded administrator credentials and `npm run test --workspace frontend` — passed, 5/5 Playwright tests against staging.
- Backed up staging database and configured file directories, restored the archive to a separate database, and verified the migration table plus fictional account/record counts. The original `lostandfound` database was not modified.
- A real-data or institutional pilot remains blocked on authorization, a separately approved deployment, security configuration, and pilot-specific acceptance checks. See [pilot-readiness.md](./pilot-readiness.md).
>>>>>>> origin/C-o-r-n-y
