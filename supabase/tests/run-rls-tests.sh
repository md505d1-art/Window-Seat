#!/usr/bin/env bash
# Applies the Orbit migration to a throwaway PostgreSQL 15+ database and runs the
# row-level security tests. Usage: npm run test:rls
#   PSQL="psql -U postgres -h localhost" npm run test:rls   (override the connection)
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-"sudo -u postgres psql"}
DB=orbit_rls_test
$PSQL -q -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run() { $PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/stub-supabase.sql
for m in migrations/*.sql; do run "$m"; done
run tests/rls.test.sql
$PSQL -q -c "drop database $DB" >/dev/null
echo "RLS tests passed"
