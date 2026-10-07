#!/usr/bin/env bash
set -euo pipefail
: "${BACKUP_DATABASE_URL:?Set BACKUP_DATABASE_URL to the source database}"
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to a disposable restore database}"
if [[ "$BACKUP_DATABASE_URL" == "$RESTORE_DATABASE_URL" ]]; then echo "Refusing to overwrite the source database" >&2; exit 1; fi
for binary in pg_dump pg_restore psql; do command -v "$binary" >/dev/null || { echo "$binary is required" >&2; exit 1; }; done
archive="$(mktemp "${TMPDIR:-/tmp}/denes-backup.XXXXXX.dump")"
trap 'rm -f "$archive"' EXIT
before="$(psql "$BACKUP_DATABASE_URL" -Atc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")"
pg_dump --format=custom --no-owner --no-acl --dbname="$BACKUP_DATABASE_URL" --file="$archive"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
pg_restore --exit-on-error --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$archive"
after="$(psql "$RESTORE_DATABASE_URL" -Atc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")"
[[ "$before" == "$after" ]] || { echo "Restore verification failed: $before source tables vs $after restored" >&2; exit 1; }
echo "Backup/restore drill passed with $after public tables."
