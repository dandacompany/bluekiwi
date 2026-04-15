#!/bin/bash
# BlueKiwi E2E Smoke — SQLite + UI visual selection + HITL approval
#
# 기본 대상:
#   - TARGET_URL=http://127.0.0.1:3510
#   - SQLITE_PATH=/tmp/bluekiwi-sqlite-smoke/data/bluekiwi.sqlite
#   - LOGIN_EMAIL=sqlite-smoke@example.com
#   - LOGIN_PASSWORD=Passw0rd!
#
# 사용법:
#   bash tests/4/run-hitl-vs-ui-smoke.sh
#   TARGET_URL=http://127.0.0.1:3102 bash tests/4/run-hitl-vs-ui-smoke.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_HOST="${TARGET_HOST:-127.0.0.1}"
TARGET_PORT="${TARGET_PORT:-3510}"
TARGET_URL="${TARGET_URL:-http://${TARGET_HOST}:${TARGET_PORT}}"
SQLITE_PATH="${SQLITE_PATH:-/tmp/bluekiwi-sqlite-smoke/data/bluekiwi.sqlite}"
LOGIN_EMAIL="${LOGIN_EMAIL:-sqlite-smoke@example.com}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-Passw0rd!}"
AUTO_START_SERVER="${AUTO_START_SERVER:-1}"
SERVER_MODE="${SERVER_MODE:-auto}"
APP_LOG_PATH="${APP_LOG_PATH:-/tmp/bluekiwi-hitl-vs-ui-smoke/app.log}"
SERVER_PID=""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BlueKiwi HITL + VS UI Smoke"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target URL : $TARGET_URL"
echo "SQLite DB  : $SQLITE_PATH"
echo "Login user : $LOGIN_EMAIL"
echo ""

if [ ! -f "$TEST_DIR/hitl-vs-ui-smoke.js" ]; then
  echo "❌ Test file not found: $TEST_DIR/hitl-vs-ui-smoke.js"
  exit 1
fi

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if ! curl -fsS -o /dev/null "$TARGET_URL/login"; then
  if [ "$AUTO_START_SERVER" != "1" ]; then
    echo "❌ Target server is not responding at $TARGET_URL"
    exit 1
  fi

  mkdir -p "$(dirname "$SQLITE_PATH")" "$(dirname "$APP_LOG_PATH")"

  if [ "$SERVER_MODE" = "auto" ]; then
    if [ -f "$ROOT/.next/BUILD_ID" ]; then
      SERVER_MODE="start"
    else
      SERVER_MODE="dev"
    fi
  fi

  echo "Starting local app server (${SERVER_MODE})..."
  cd "$ROOT"
  if [ "$SERVER_MODE" = "start" ]; then
    DB_TYPE=sqlite \
    SQLITE_PATH="$SQLITE_PATH" \
    NEXT_TELEMETRY_DISABLED=1 \
    npm run start -- --hostname "$TARGET_HOST" --port "$TARGET_PORT" \
      >"$APP_LOG_PATH" 2>&1 &
  else
    DB_TYPE=sqlite \
    SQLITE_PATH="$SQLITE_PATH" \
    NEXT_TELEMETRY_DISABLED=1 \
    npm run dev:raw -- --hostname "$TARGET_HOST" --port "$TARGET_PORT" \
      >"$APP_LOG_PATH" 2>&1 &
  fi
  SERVER_PID=$!

  for _ in $(seq 1 120); do
    if curl -fsS -o /dev/null "$TARGET_URL/login"; then
      break
    fi
    sleep 1
  done

  if ! curl -fsS -o /dev/null "$TARGET_URL/login"; then
    echo "❌ Local app server did not become ready at $TARGET_URL"
    echo "App log: $APP_LOG_PATH"
    tail -n 120 "$APP_LOG_PATH" || true
    exit 1
  fi
fi

TARGET_URL="$TARGET_URL" \
SQLITE_PATH="$SQLITE_PATH" \
LOGIN_EMAIL="$LOGIN_EMAIL" \
LOGIN_PASSWORD="$LOGIN_PASSWORD" \
PW_HEADLESS="${PW_HEADLESS:-1}" \
  node "$TEST_DIR/hitl-vs-ui-smoke.js"
