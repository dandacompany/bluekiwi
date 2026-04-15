#!/bin/bash
# BlueKiwi E2E Smoke — packaged CLI quick start runtime

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_ROOT="${TMP_ROOT:-/tmp/bluekiwi-packaged-cli-smoke}"
PREFIX_DIR="$TMP_ROOT/prefix"
HOME_DIR="$TMP_ROOT/home"
PACK_DIR="$TMP_ROOT/pack"
PORT="${PORT:-3530}"
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_URL="http://${APP_HOST}:${PORT}"
DATA_DIR="${DATA_DIR:-$HOME_DIR/.bluekiwi/quickstart/default}"
AUTO_BUILD="${AUTO_BUILD:-1}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BlueKiwi Packaged CLI Smoke"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "App URL   : $APP_URL"
echo "Prefix    : $PREFIX_DIR"
echo "HOME      : $HOME_DIR"
echo "Data dir  : $DATA_DIR"
echo ""

rm -rf "$TMP_ROOT"
mkdir -p "$PREFIX_DIR" "$HOME_DIR" "$PACK_DIR"

if [ "$AUTO_BUILD" = "1" ]; then
  echo "Building CLI package..."
  cd "$ROOT"
  npm run build:cli >/tmp/bluekiwi-packaged-cli-build.log 2>&1
fi

cd "$ROOT"
TARBALL_NAME="$(npm pack ./packages/cli --pack-destination "$PACK_DIR" | tail -n 1)"
TARBALL_PATH="$PACK_DIR/$TARBALL_NAME"

echo "Installing packaged CLI..."
npm install -g --prefix "$PREFIX_DIR" "$TARBALL_PATH" >/tmp/bluekiwi-packaged-cli-install.log 2>&1

export HOME="$HOME_DIR"
export PATH="$PREFIX_DIR/bin:$PATH"

echo "Starting packaged CLI runtime..."
bluekiwi start --host "$APP_HOST" --port "$PORT" --data-dir "$DATA_DIR" >/tmp/bluekiwi-packaged-cli-start.log 2>&1

INITIAL_STATUS_OUTPUT="$(bluekiwi status || true)"
ACTUAL_URL="$(printf '%s\n' "$INITIAL_STATUS_OUTPUT" | sed -n 's/^Local URL:[[:space:]]*//p' | head -n 1)"
if [ -z "$ACTUAL_URL" ]; then
  ACTUAL_URL="$APP_URL"
fi

for _ in $(seq 1 120); do
  if curl -fsS -o /dev/null "$ACTUAL_URL/login"; then
    break
  fi
  sleep 1
done

if ! curl -fsS -o /dev/null "$ACTUAL_URL/login"; then
  echo "❌ packaged CLI runtime did not become ready at $ACTUAL_URL"
  echo "--- bluekiwi start ---"
  cat /tmp/bluekiwi-packaged-cli-start.log || true
  echo "--- bundled app log ---"
  tail -n 160 "$DATA_DIR/logs/app.log" 2>/dev/null || true
  exit 1
fi

STATUS_OUTPUT="$(bluekiwi status)"
echo "$STATUS_OUTPUT"

if ! printf '%s\n' "$STATUS_OUTPUT" | grep -q "Local runtime:.*running"; then
  echo "❌ bluekiwi status did not report running runtime"
  exit 1
fi

if ! printf '%s\n' "$STATUS_OUTPUT" | grep -q "Local runtime kind:.*bundle"; then
  echo "❌ packaged CLI did not use bundled runtime"
  exit 1
fi

if ! printf '%s\n' "$STATUS_OUTPUT" | grep -q "Local health:.*ok"; then
  echo "❌ packaged CLI runtime health is not ok"
  exit 1
fi

curl -fsS -o /dev/null "$ACTUAL_URL/api/auth/setup"

if [ ! -f "$DATA_DIR/data/bluekiwi.sqlite" ]; then
  echo "❌ packaged CLI runtime did not create SQLite file"
  exit 1
fi

bluekiwi stop >/tmp/bluekiwi-packaged-cli-stop.log 2>&1

echo "PACKAGED_CLI_OK"
echo "{\"success\":true,\"url\":\"$ACTUAL_URL\",\"sqlite\":\"$DATA_DIR/data/bluekiwi.sqlite\"}"
