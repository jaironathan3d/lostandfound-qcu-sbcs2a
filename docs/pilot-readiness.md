# Pilot Readiness and Backup/Restore Runbook

## Status and scope

This runbook documents a safe local backup and isolated restore drill. A separate fictional-data staging database, `lostandfound_pilot_stage`, is running on the local PostgreSQL 19 instance at port 5433. Its frontend is at `http://localhost:5174` and its backend health endpoint is `http://localhost:4001/api/health`. A backup of staging was restored into `lostandfound_stage_restore_20261124_172934`; the restored database has all 16 migrations, three fictional accounts, and five fictional student records. The original `lostandfound` database was not backed up, restored, or modified by this drill. This local staging setup is not an authorized institutional pilot environment.

## Local staging verification record

- `npm exec --workspace backend -- prisma migrate deploy` applied all 16 existing migrations to `lostandfound_pilot_stage`; `prisma migrate status` reports the schema is up to date.
- The fictional seed created three `@qcu.test` accounts and five `26-` student records.
- `npm exec --workspace backend -- tsx --test src/test/*.test.ts` — passed, 12/12 PostgreSQL integration tests against staging with separate temporary file-storage directories. Afterward the seeded users and records remained, and test items, claims, conversations, vault entries, and handovers were all cleaned up.
- `E2E_BASE_URL=http://localhost:5174` with the fictional admin test credentials, `npm run test --workspace frontend` — passed, 5/5 Playwright tests.
- Staging health, administrator login, CORS origin, and frontend returned HTTP 200.
- The staging archive is `%LOCALAPPDATA%\QCU-LostAndFound\backups\lostandfound-pilot-stage-20261124_172934.dump`, SHA-256 `0B2CA15B9606365D0CBFC4A7FB29A9FCBDB07AE3252ED6B1C7F44E0F553C66E1`. Its restore into `lostandfound_stage_restore_20261124_172934` verified 16 migrations, three fictional users, and five fictional student records. The restore database and archive are retained for inspection.
- The original `lostandfound` database still reports all 16 migrations up to date.

## Safety requirements

- Use only a database and data set explicitly approved for the pilot. Do not use real student information without the required authorization.
- The repository's Docker Compose configuration and its default credentials are for local development only; do not expose them to a network or use them for a pilot.
- Never run the fictional seed command against an authorized pilot or production database. Its production-mode guard is not a substitute for selecting the correct database.
- A complete backup includes PostgreSQL and both configured file-storage directories: item media and private claim documents. Do not include `.env` files, JWT secrets, or credentials in the backup.
- Quiesce writes before coordinating a database dump with file copies. Keep backups outside the repository and ordinary sync folders, restrict access, encrypt them at rest, and follow the approved retention policy.
- The example commands below target the isolated staging database (`127.0.0.1:5433/lostandfound_pilot_stage`). Verify the target before running them; do not substitute the original development database or a pilot connection without approval.

## Local development backup

Run PowerShell from the repository root, and keep the same session open while running the code blocks so the variables are retained. Stop the backend first so database records and stored files are not changing while the coordinated backup is made. The default destination below is for a local drill only; use an approved encrypted backup destination for an authorized pilot.

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\19\bin'
$backupRoot = Join-Path $env:LOCALAPPDATA 'QCU-LostAndFound\backups'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path $backupRoot "lostandfound-$stamp.dump"
$dbUser = Read-Host 'Authorized PostgreSQL role'

New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
& "$pgBin\pg_dump.exe" --host 127.0.0.1 --port 5433 --username $dbUser --password --format custom --no-privileges --file $archive lostandfound_pilot_stage
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed; do not treat this backup as complete.' }

& "$pgBin\pg_restore.exe" --list $archive | Out-File -Encoding utf8 "$archive.list"
if ($LASTEXITCODE -ne 0) { throw 'The archive could not be listed; do not treat this backup as verified.' }
Get-FileHash -Path $archive -Algorithm SHA256
```

Copy the configured storage directories into a sibling folder named `storage-$stamp`. The current isolated staging instance uses `%LOCALAPPDATA%\QCU-LostAndFound\staging\item-media` and `%LOCALAPPDATA%\QCU-LostAndFound\staging\claim-documents`. With the default backend configuration, the sources are instead `backend\storage\item-media` and `backend\storage\claim-documents`. If either directory is missing, verify its configured path and confirm whether it has stored files; do not assume a missing directory means there is no media. For the current staging instance:

```powershell
$storageBackup = Join-Path $backupRoot "storage-$stamp"
$itemMediaSource = Join-Path $env:LOCALAPPDATA 'QCU-LostAndFound\staging\item-media'
$claimDocsSource = Join-Path $env:LOCALAPPDATA 'QCU-LostAndFound\staging\claim-documents'

foreach ($entry in @(
  @{ Source = $itemMediaSource; Name = 'item-media' },
  @{ Source = $claimDocsSource; Name = 'claim-documents' }
)) {
  if (-not (Test-Path -LiteralPath $entry.Source)) {
    throw "Storage source not found; verify its configured path: $($entry.Source)"
  }
  $destination = Join-Path $storageBackup $entry.Name
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  & robocopy.exe $entry.Source $destination /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /XJ
  if ($LASTEXITCODE -ge 8) { throw "Storage copy failed for $($entry.Source)." }
}
```

The backend resolves relative storage paths from its working directory. If `ITEM_MEDIA_DIRECTORY` or `CLAIM_DOCUMENT_DIRECTORY` is customized in the local environment, use those actual locations instead of the default source paths above. Do not share or commit environment files to resolve paths.

## Isolated restore drill

Restore only into a new, disposable database on the local development PostgreSQL instance. Do not use `--clean`, `--create`, or `migrate reset`; do not restore over `lostandfound` or any pilot database.

```powershell
$restoreDb = "lf_restore_$stamp"
& "$pgBin\createdb.exe" --host 127.0.0.1 --port 5433 --username $dbUser --password --template template0 $restoreDb
if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated restore database.' }

& "$pgBin\pg_restore.exe" --host 127.0.0.1 --port 5433 --username $dbUser --password --dbname $restoreDb --no-owner --no-privileges --exit-on-error --single-transaction $archive
if ($LASTEXITCODE -ne 0) { throw "Restore failed. Keep the source database and backup unchanged; inspect the disposable database before cleanup." }

& "$pgBin\psql.exe" --host 127.0.0.1 --port 5433 --username $dbUser --password --dbname $restoreDb --set ON_ERROR_STOP=1 --command 'SELECT count(*) AS applied_migrations FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;'
if ($LASTEXITCODE -ne 0) { throw 'The restored database validation query failed.' }
```

For a complete application restore drill, restore the item-media and claim-document copies into separate isolated storage directories, configure a separate backend environment with a new JWT secret and the disposable database, then verify startup and representative read-only pages/API responses. Do not point the restored application at the live database or live storage. Record the archive hash, restore result, and any missing files without recording credentials or personal data. Remove the disposable database and copied files only after review and explicit confirmation of their names.

## Pilot go/no-go checklist

- [ ] Pilot owner and data authorization are documented; pilot scope and test accounts are approved.
- [ ] A separate, access-controlled deployment and database are provisioned; development Docker credentials are not reused.
- [ ] Production secrets, HTTPS, allowed origins, persistent private file storage, administrator account setup, logging, and access controls are reviewed for that environment.
- [ ] A coordinated database-and-files backup is made to an approved encrypted destination, and a restore drill into an isolated target succeeds.
- [ ] Fictional development accounts and records are excluded from the pilot; no unauthorized student information is used.
- [ ] Known feature gaps are accepted or resolved: email delivery and authentication rate limiting are not implemented, and the Campus Security role/dashboard remains deferred.
- [ ] Pilot-specific end-to-end testing and operational ownership (monitoring, support, retention, recovery) are agreed.

**Current assessment: not ready for a real-data or production pilot.** The local fictional-data staging environment and its backup/restore drill are verified. Institutional authorization, an access-controlled deployment, security configuration, pilot-specific acceptance checks, and operational ownership have not been completed.
