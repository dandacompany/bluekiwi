#!/bin/sh
# Dev entrypoint: auto-refresh node_modules when package-lock.json changes.
# Compares hash of package-lock.json with the last installed version.
# If different, runs npm ci inside the container (Linux binaries).

HASH_FILE="/app/node_modules/.package-lock-hash"
CURRENT_HASH=$(md5sum /app/package-lock.json 2>/dev/null | awk '{print $1}')
STORED_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")

ensure_lightningcss_binary() {
  LIGHTNINGCSS_VERSION=$(node -p "require('/app/node_modules/lightningcss/package.json').version" 2>/dev/null || echo "")
  BINARY_PATH="/app/node_modules/lightningcss-linux-arm64-musl/lightningcss.linux-arm64-musl.node"

  if [ -z "$LIGHTNINGCSS_VERSION" ]; then
    echo "[dev-entrypoint] lightningcss package missing — skipping native binary check"
    return 0
  fi

  if [ -f "$BINARY_PATH" ]; then
    echo "[dev-entrypoint] lightningcss linux-arm64-musl binary present ✓"
    return 0
  fi

  echo "[dev-entrypoint] missing lightningcss linux-arm64-musl binary — installing..."
  npm install --no-save --workspaces=false "lightningcss-linux-arm64-musl@${LIGHTNINGCSS_VERSION}" >/tmp/lightningcss-install.log 2>&1 \
    || {
      echo "[dev-entrypoint] failed to install lightningcss linux-arm64-musl"
      tail -20 /tmp/lightningcss-install.log
      return 1
    }
  echo "[dev-entrypoint] lightningcss linux-arm64-musl binary installed ✓"
}

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

cd /app
ensure_lightningcss_binary

exec "$@"
