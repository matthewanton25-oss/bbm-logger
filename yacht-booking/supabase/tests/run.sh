#!/usr/bin/env bash
# Spins up a throwaway Postgres, applies migrations and runs the SQL test suite.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}"
DATA="$(mktemp -d)"; PORT="${PORT:-54329}"
if [ "$(id -u)" = "0" ]; then RUN="runuser -u postgres --"; chown postgres "$DATA"; else RUN=""; fi
cleanup() { $RUN "$PGBIN/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
$RUN "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c timezone=UTC" -l "$DATA/log" start >/dev/null
sleep 1
PSQL="psql -h /tmp -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -f "$HERE/stub_supabase.sql"
for f in "$HERE"/../migrations/*.sql; do echo "▸ migrate $(basename "$f")"; $PSQL -f "$f"; done
echo "▸ tests"; $PSQL -f "$HERE/booking_rules.test.sql" >/dev/null
echo "✔ all database tests passed"
