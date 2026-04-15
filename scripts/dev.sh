#!/usr/bin/env bash
# ═══════════════════════════════════════════════════
# BlueKiwi Dev Server Manager (Docker Compose)
# ═══════════════════════════════════════════════════
# Usage: bash scripts/dev.sh [command]
#
# Commands:
#   start / up    Start all services (db + ws-relay + app)
#   stop / down   Stop all services
#   restart       Restart all services
#   status        Show service status
#   logs [svc]    Tail logs (all or specific: app, db, ws-relay)
#   build         Rebuild app container (after dependency changes)
#   seed          Seed database with test data
#   reset         Stop + remove volumes (destructive)
#   port          Show current app port
#   shell         Open shell in app container
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.dev.yml"
LOG_DIR="$PROJECT_ROOT/.dev"
COMPOSE="docker compose -f $COMPOSE_FILE"

# ─── Colors ───
green()  { printf "\033[32m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
bold()   { printf "\033[1m%s\033[0m\n" "$1"; }
dim()    { printf "\033[2m%s\033[0m\n" "$1"; }

mkdir -p "$LOG_DIR"

# ─── Helpers ───

get_app_port() {
  # Read the mapped port from compose or default
  local port
  port=$($COMPOSE port app 3000 2>/dev/null | cut -d: -f2 || echo "")
  if [ -z "$port" ]; then
    # Fallback: read from env or default
    port="${APP_PORT:-3100}"
  fi
  echo "$port"
}

find_free_port() {
  local port="${1:-3100}"
  local tries=0
  while [ $tries -lt 10 ]; do
    if ! lsof -i ":$port" -P -n 2>/dev/null | grep -q LISTEN; then
      echo "$port"
      return 0
    fi
    yellow "  Port $port occupied, trying $((port + 1))..."
    port=$((port + 1))
    tries=$((tries + 1))
  done
  red "No free port found"
  return 1
}

wait_for_healthy() {
  local service="$1"
  local max_wait="${2:-30}"
  local i=0
  while [ $i -lt $max_wait ]; do
    local health
    health=$($COMPOSE ps --format json "$service" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health',''))" 2>/dev/null || echo "")
    if [ "$health" = "healthy" ]; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

# ─── Commands ───

cmd_start() {
  bold "🚀 BlueKiwi Dev Stack"
  echo ""

  # 1. Find free port
  echo "▸ Checking ports..."
  local port
  port=$(find_free_port "${APP_PORT:-3100}")
  export APP_PORT="$port"
  echo "$port" > "$LOG_DIR/dev.port"
  green "  App port: $port"
  echo ""

  # 2. Start compose
  echo "▸ Starting services (db + ws-relay + app)..."
  $COMPOSE up -d --build 2>&1 | grep -v "obsolete" | while read -r line; do
    echo "  $line"
  done
  echo ""

  # 3. Wait for DB
  echo "▸ Waiting for DB health..."
  if wait_for_healthy "db" 20; then
    green "  DB: healthy"
  else
    yellow "  DB: still starting (check logs)"
  fi

  # 4. Report
  echo ""
  bold "═══════════════════════════════════════════"
  green "  App:    http://localhost:$port"
  echo "  DB:     localhost:5433 (bluekiwi/bluekiwi_dev_2026)"
  echo "  WS:     localhost:3001"
  bold "═══════════════════════════════════════════"
  echo ""
  echo "Commands:"
  dim "  bash scripts/dev.sh logs        # Tail all logs"
  dim "  bash scripts/dev.sh logs app    # Tail app only"
  dim "  bash scripts/dev.sh status      # Service status"
  dim "  bash scripts/dev.sh stop        # Stop all"
  echo ""
  dim "First visit? Go to /setup to create your admin account"
  echo ""
}

cmd_stop() {
  bold "Stopping BlueKiwi dev stack..."
  $COMPOSE down 2>&1 | grep -v "obsolete"
  rm -f "$LOG_DIR/dev.port"
  green "Stopped"
}

cmd_restart() {
  cmd_stop
  echo ""
  cmd_start
}

cmd_status() {
  bold "BlueKiwi Dev Status"
  echo ""

  # Compose services
  echo "Services:"
  $COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  (no services running)"
  echo ""

  # App port
  if [ -f "$LOG_DIR/dev.port" ]; then
    local port
    port=$(cat "$LOG_DIR/dev.port")
    echo "App URL: http://localhost:$port"

    # Health check
    local code
    code=$(curl -sS --max-time 3 -o /dev/null -w "%{http_code}" "http://localhost:$port/login" 2>/dev/null || echo "000")
    if [ "$code" = "200" ]; then
      green "Health: OK ($code)"
    elif [ "$code" = "000" ]; then
      red "Health: Unreachable"
    else
      yellow "Health: HTTP $code (compiling or redirecting)"
    fi
  else
    dim "App port unknown — server may not be running"
  fi
  echo ""
}

cmd_logs() {
  local service="${1:-}"
  if [ -n "$service" ]; then
    $COMPOSE logs -f "$service"
  else
    $COMPOSE logs -f
  fi
}

cmd_build() {
  bold "Rebuilding app container..."
  $COMPOSE build --no-cache app 2>&1 | grep -v "obsolete"
  green "Done. Run 'bash scripts/dev.sh restart' to apply."
}

cmd_seed() {
  bold "Seeding database..."

  # Wait for DB
  if ! $COMPOSE ps --format json db 2>/dev/null | grep -q "healthy"; then
    yellow "DB not healthy. Starting services first..."
    $COMPOSE up -d db 2>&1 | grep -v "obsolete"
    sleep 5
  fi

  # Create superuser if not exists
  local count
  count=$(PGPASSWORD=bluekiwi_dev_2026 psql -h localhost -p 5433 -U bluekiwi -d bluekiwi -tAc "SELECT COUNT(*) FROM users" 2>/dev/null || echo "0")

  if [ "$count" = "0" ] || [ -z "$count" ]; then
    # Generate bcrypt hash inside the app container (or locally)
    local hash
    hash=$(node -e "console.log(require('bcryptjs').hashSync('admin', 12))" 2>/dev/null || \
           docker run --rm node:22-alpine sh -c "npm install -s bcryptjs && node -e \"console.log(require('bcryptjs').hashSync('admin', 12))\"" 2>/dev/null)

    PGPASSWORD=bluekiwi_dev_2026 psql -h localhost -p 5433 -U bluekiwi -d bluekiwi -c "
      INSERT INTO users (username, email, password_hash, role, must_change_password)
      VALUES ('admin', 'admin@bluekiwi.local', '$hash', 'superuser', true)
      ON CONFLICT (email) DO NOTHING;
    " > /dev/null 2>&1
    green "Created superuser: admin@bluekiwi.local / admin"
  else
    dim "Users exist ($count). Skipping."
  fi

  green "Seed complete"
}

cmd_reset() {
  red "⚠ This will destroy ALL data (DB volume)"
  echo -n "Continue? [y/N] "
  read -r confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Cancelled"
    return 0
  fi

  bold "Resetting..."
  $COMPOSE down -v 2>&1 | grep -v "obsolete"
  rm -f "$LOG_DIR/dev.port"
  green "Done. Run 'bash scripts/dev.sh start' to rebuild with fresh data."
}

cmd_port() {
  if [ -f "$LOG_DIR/dev.port" ]; then
    cat "$LOG_DIR/dev.port"
  else
    echo "3100"
  fi
}

cmd_shell() {
  $COMPOSE exec app sh
}

# ─── Usage ───

usage() {
  bold "BlueKiwi Dev Server Manager (Docker Compose)"
  echo ""
  echo "Usage: bash scripts/dev.sh <command>"
  echo ""
  echo "Lifecycle:"
  echo "  start, up      Start all services (db + ws-relay + app)"
  echo "  stop, down     Stop all services"
  echo "  restart        Restart all services"
  echo "  build          Rebuild app container (after npm install)"
  echo ""
  echo "Monitoring:"
  echo "  status         Show service status + health"
  echo "  logs [svc]     Tail logs (all, or: app / db / ws-relay)"
  echo "  port           Print current app port"
  echo ""
  echo "Data:"
  echo "  seed           Seed DB with test superuser"
  echo "  reset          Stop + destroy all volumes (⚠ destructive)"
  echo "  shell          Open shell in app container"
}

# ─── Main ───

case "${1:-}" in
  start|up)   cmd_start ;;
  stop|down)  cmd_stop ;;
  restart)    cmd_restart ;;
  status)     cmd_status ;;
  logs)       cmd_logs "${2:-}" ;;
  build)      cmd_build ;;
  seed)       cmd_seed ;;
  reset)      cmd_reset ;;
  port)       cmd_port ;;
  shell)      cmd_shell ;;
  -h|--help|help) usage ;;
  "")         cmd_start ;;
  *)          red "Unknown: $1"; echo ""; usage; exit 1 ;;
esac
