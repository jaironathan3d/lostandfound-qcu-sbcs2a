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

## Remove test data

No automatic production reset or test-data deletion command is provided.

Before pilot testing:

1. Back up the authorized pilot database.
2. Verify that no `*.test` accounts or legacy `TEST-*`/`2026-*` student numbers are present.
3. Remove unapproved test data from a disposable database using an administrator review process or direct database cleanup approved by the project adviser.
4. Seed only the approved pilot records.

Do not use real QCU student information without authorization.
