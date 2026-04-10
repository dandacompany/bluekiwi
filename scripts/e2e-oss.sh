#!/usr/bin/env bash
# scripts/e2e-oss.sh - BlueKiwi OSS distribution end-to-end smoke test.
# Spins up a fresh stack via docker-compose.yml, creates an admin, issues an
# API key, creates an invite, then walks the bluekiwi CLI through `accept`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BLUEKIWI_API_URL="${BLUEKIWI_API_URL:-http://localhost:3100}"
ADMIN_EMAIL="e2e-admin@test.local"
ADMIN_PASSWORD="e2e-admin-1234"
ADMIN_USERNAME="e2eadmin"
INVITEE_EMAIL="e2e-invitee@test.local"
INVITEE_USERNAME="e2eguest"
INVITEE_PASSWORD="e2e-guest-1234"
SANDBOX_HOME="$(mktemp -d -t bluekiwi-e2e-home.XXXXXX)"

cleanup() {
  echo "[cleanup] stopping stack..."
  docker compose down -v >/dev/null 2>&1 || true
  rm -rf "$SANDBOX_HOME"
}
trap cleanup EXIT

echo "[1/7] Start compose stack"
if [ ! -f .env ]; then
  {
    echo "DB_PASSWORD=$(openssl rand -hex 16)"
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "APP_PORT=3100"
    echo "PUBLIC_URL=${BLUEKIWI_API_URL}"
    echo "BLUEKIWI_VERSION=${BLUEKIWI_VERSION:-latest}"
  } > .env
fi
docker compose up -d

echo "[2/7] Wait for server"
for i in $(seq 1 60); do
  if curl -sf -o /dev/null "${BLUEKIWI_API_URL}/"; then
    break
  fi
  sleep 2
done

echo "[3/7] Create first admin via /api/auth/setup"
curl -s -X POST "${BLUEKIWI_API_URL}/api/auth/setup" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${ADMIN_USERNAME}\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  > /tmp/bk-e2e-setup.json

echo "[4/7] Login + generate API key"
COOKIE_JAR="$(mktemp)"
curl -s -c "$COOKIE_JAR" -X POST "${BLUEKIWI_API_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  > /tmp/bk-e2e-login.json

API_KEY="$(curl -s -b "$COOKIE_JAR" -X POST "${BLUEKIWI_API_URL}/api/apikeys" \
  -H "Content-Type: application/json" \
  -d '{"name":"e2e"}' \
  | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).plaintext")"
if [ -z "$API_KEY" ] || [ "$API_KEY" = "undefined" ]; then
  echo "failed to mint API key" >&2
  cat /tmp/bk-e2e-login.json >&2
  exit 1
fi

echo "[5/7] Create invite"
TOKEN="$(curl -s -X POST "${BLUEKIWI_API_URL}/api/invites" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${INVITEE_EMAIL}\",\"role\":\"editor\"}" \
  | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).token")"
echo "  invite token: $TOKEN"

echo "[6/7] Accept invite via CLI in sandboxed HOME"
( cd packages/cli && npm run build >/dev/null )
HOME="$SANDBOX_HOME" node packages/cli/dist/index.js accept "$TOKEN" \
  --server "${BLUEKIWI_API_URL}" <<STDIN
${INVITEE_USERNAME}
${INVITEE_PASSWORD}

STDIN

echo "[7/7] Status check"
HOME="$SANDBOX_HOME" node packages/cli/dist/index.js status

echo ""
echo "\xE2\x9C\x93 BlueKiwi OSS E2E passed"
