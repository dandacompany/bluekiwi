#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.dev"
PID_FILE="$LOG_DIR/local-app.pid"
PORT_FILE="$LOG_DIR/local-app.port"
LOG_FILE="$LOG_DIR/local-app.log"

START_PORT="${APP_PORT:-3102}"
MAX_TRIES="${MAX_TRIES:-20}"

mkdir -p "$LOG_DIR"

green()  { printf "\033[32m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
bold()   { printf "\033[1m%s\033[0m\n" "$1"; }

is_running() {
  if [ ! -f "$PID_FILE" ]; then
    return 1
  fi

  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

find_free_port() {
  local port="$START_PORT"
  local tries=0

  while [ "$tries" -lt "$MAX_TRIES" ]; do
    if ! lsof -i ":$port" -P -n 2>/dev/null | grep -q LISTEN; then
      echo "$port"
      return 0
    fi
    yellow "Port $port is occupied, trying $((port + 1))..."
    port=$((port + 1))
    tries=$((tries + 1))
  done

  red "No free port found after $MAX_TRIES attempts."
  return 1
}

cmd_start() {
  if is_running; then
    local pid port
    pid="$(cat "$PID_FILE")"
    port="$(cat "$PORT_FILE" 2>/dev/null || echo "unknown")"
    yellow "Local app is already running. PID=$pid PORT=$port"
    return 0
  fi

  local port
  port="$(find_free_port)"

  bold "Starting BlueKiwi local app..."
  (
    cd "$PROJECT_ROOT"
    nohup env \
      WS_RELAY_URL="http://localhost:3001" \
      NEXT_TELEMETRY_DISABLED=1 \
      npm run dev:raw -- --hostname 0.0.0.0 --port "$port" \
      > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  )
  echo "$port" > "$PORT_FILE"

  green "Started local app"
  echo "  PID:  $(cat "$PID_FILE")"
  echo "  Port: $port"
  echo "  URL:  http://localhost:$port"
  echo "  Log:  $LOG_FILE"
}

cmd_stop() {
  if ! is_running; then
    rm -f "$PID_FILE" "$PORT_FILE"
    yellow "Local app is not running."
    return 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid"
  rm -f "$PID_FILE" "$PORT_FILE"
  green "Stopped local app (PID $pid)"
}

cmd_restart() {
  cmd_stop
  cmd_start
}

cmd_status() {
  if is_running; then
    local pid port code
    pid="$(cat "$PID_FILE")"
    port="$(cat "$PORT_FILE" 2>/dev/null || echo "unknown")"
    code="$(curl -sS --max-time 3 -o /dev/null -w "%{http_code}" "http://localhost:$port/login" 2>/dev/null || echo "000")"
    green "Local app is running"
    echo "  PID:  $pid"
    echo "  Port: $port"
    echo "  URL:  http://localhost:$port"
    echo "  HTTP: $code"
    echo "  Log:  $LOG_FILE"
  else
    red "Local app is not running."
  fi
}

cmd_port() {
  if [ -f "$PORT_FILE" ]; then
    cat "$PORT_FILE"
  else
    echo "$START_PORT"
  fi
}

usage() {
  cat <<'EOF'
Usage: bash scripts/dev-local-app.sh <command>

Commands:
  start     Start local Next.js app on the first free port starting from APP_PORT or 3102
  stop      Stop the local app process
  restart   Restart the local app
  status    Show current app status
  port      Print the current port
EOF
}

case "${1:-start}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_restart ;;
  status) cmd_status ;;
  port) cmd_port ;;
  *)
    usage
    exit 1
    ;;
esac
