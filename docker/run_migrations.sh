#!/bin/bash
set -e
# Run all migration files in order
for f in /docker-entrypoint-initdb.d/migrations/*.sql; do
  echo "[migrations] applying $f"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done
echo "[migrations] done"
