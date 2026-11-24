# Fictional Pilot Test Data

Test data is for local development and controlled demonstrations only. Run it manually.
The seed command refuses to run when `NODE_ENV=production`.

## Create test data

```bash
npm run prisma:migrate --workspace backend
npm run prisma:seed --workspace backend
```

The seed command is repeatable. It updates existing test accounts and student records instead of duplicating them.

## Test credentials

All test accounts use password: `QcuTest!2026`

| Role | Email |
|---|---|
| Student | test-student-1@qcu.test |
| Administrator | test-admin@qcu.test |
| Super Administrator | test-superadmin@qcu.test |

The primary fictional student is `26-0001`, named `Test Student 1`, in `BSCS`, `1st Year`.

## Pilot data safety

No automatic production reset or test-data deletion command is provided.

Before any pilot:

1. Follow the authorization, backup, and isolated-restore gates in [pilot-readiness.md](pilot-readiness.md).
2. Verify that fictional `*.test` accounts and legacy `TEST-*`/`2026-*` student numbers are not present in the pilot dataset.
3. Remove unapproved test data only through an approved administrator review and cleanup process on the intended database.
4. Do not run this repository's fictional seed command against a pilot database.

Do not use real QCU student information without authorization.
