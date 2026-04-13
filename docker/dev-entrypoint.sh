#!/bin/sh
# Dev entrypoint: auto-refresh node_modules when package-lock.json changes.
# Compares hash of package-lock.json with the last installed version.
# If different, runs npm ci inside the container (Linux binaries).

HASH_FILE="/app/node_modules/.package-lock-hash"
CURRENT_HASH=$(md5sum /app/package-lock.json 2>/dev/null | awk '{print $1}')
STORED_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")

if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
  echo "[dev-entrypoint] package-lock.json changed — refreshing node_modules..."

  # Remove workspace node_modules from host mount (macOS binaries cause ENOENT in Linux)
  rm -rf /app/packages/*/node_modules 2>/dev/null

  cd /app
  if npm ci --workspaces=false 2>&1 | tail -5; then
    echo "$CURRENT_HASH" > "$HASH_FILE"
    echo "[dev-entrypoint] node_modules refreshed ✓"
  else
    echo "[dev-entrypoint] npm ci failed — trying npm install..."
    npm install --workspaces=false 2>&1 | tail -5
    echo "$CURRENT_HASH" > "$HASH_FILE"
    echo "[dev-entrypoint] node_modules refreshed (fallback) ✓"
  fi
else
  echo "[dev-entrypoint] node_modules up to date ✓"
fi

exec "$@"
