#!/usr/bin/env bash
# scripts/bk-release.sh — BlueKiwi release validation harness.
# Phases: ci-check | deploy | e2e | tmux | all
set -euo pipefail

PHASE="${1:-all}"
REPO="dandacompany/bluekiwi"
SERVER="DanteServer"                          # SSH config alias
REMOTE_DIR='~/projects/bluekiwi'
BLUEKIWI_URL="${BLUEKIWI_URL:-https://bluekiwi.dante-labs.com}"
CF_ENV="${CF_ENV:-$HOME/.bluekiwi-deploy.env}"
APP_PORT="${APP_PORT:-3100}"                  # starting port; auto-increments on conflict

log()  { echo "[bk-release] $*"; }
ok()   { echo "  ✓ $*"; }
fail() { echo "  ✗ $*" >&2; exit 1; }

run_phase() { [[ "$PHASE" == "all" || "$PHASE" == "$1" ]]; }

phase_ci_check() {
  log "Phase 1: CI check"
  local status
  status="$(gh run list --repo "$REPO" --workflow=build.yml \
    --limit=1 --json conclusion --jq '.[0].conclusion' 2>/dev/null || echo 'unknown')"
  [[ "$status" == "success" ]] \
    || fail "build.yml last run: $status (expected success)"
  ok "GHCR build: success"
}

phase_deploy() {
  log "Phase 2: Deploy to $SERVER"

  # Load Cloudflare creds
  [[ -f "$CF_ENV" ]] || fail "$CF_ENV not found. Create it with CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID"
  set -a; source "$CF_ENV"; set +a
  : "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN missing in $CF_ENV}"
  : "${CLOUDFLARE_ZONE_ID:?CLOUDFLARE_ZONE_ID missing in $CF_ENV}"

  # Use SSH ControlMaster to share one authenticated connection for all remote ops
  local ctl="/tmp/ssh-bk-$$"
  ssh -fNM -o ControlPath="$ctl" -o ControlPersist=120 "$SERVER"
  trap "ssh -O exit -o ControlPath='$ctl' '$SERVER' 2>/dev/null || true" RETURN

  # Helper: run a command over the shared connection
  ssh_run() { ssh -o ControlPath="$ctl" "$SERVER" "$@"; }

  # Step 1: Remote git clone + docker compose up (auto port)
  ssh_run bash <<REMOTE
set -euo pipefail
if [ -d "$REMOTE_DIR" ]; then
  cd "$REMOTE_DIR"
  docker compose down -v >/dev/null 2>&1 || true
  cd ~
  rm -rf "$REMOTE_DIR"
fi
git clone https://github.com/${REPO}.git "$REMOTE_DIR"
cd "$REMOTE_DIR"

# Auto-detect free port starting from ${APP_PORT}
port=${APP_PORT}
while ss -tlnp 2>/dev/null | grep -q ":\${port} "; do
  port=\$((port + 1))
done
echo "[deploy] using port \$port"
echo "\$port" > /tmp/bk_port

cat > .env <<ENV
DB_PASSWORD=\$(openssl rand -hex 16)
JWT_SECRET=\$(openssl rand -hex 32)
APP_PORT=\$port
PUBLIC_URL=${BLUEKIWI_URL}
BLUEKIWI_VERSION=latest
ENV
docker compose pull
docker compose up -d
for i in \$(seq 1 60); do
  curl -sf -o /dev/null "http://localhost:\$port/" && break || sleep 2
done
curl -sf -o /dev/null "http://localhost:\$port/" || { echo "stack never became ready"; exit 1; }
echo "stack ready"
REMOTE

  local remote_port
  remote_port="$(ssh_run "cat /tmp/bk_port")"
  ok "docker compose up on $SERVER (port $remote_port)"

  # Step 2: Cloudflare DNS
  log "Configuring Cloudflare DNS..."
  local cf_resp
  cf_resp="$(curl -s \
    "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=bluekiwi.dante-labs.com&type=A" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")"
  local cf_ok existing
  cf_ok="$(echo "$cf_resp" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).success" 2>/dev/null || echo false)"
  if [[ "$cf_ok" != "true" ]]; then
    log "WARNING: Cloudflare API auth failed — skipping DNS setup (record may already exist)"
    ok "DNS step skipped (auth failed; assuming record exists)"
  else
    existing="$(echo "$cf_resp" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).result.length")"
    if [[ "$existing" == "0" ]]; then
      curl -sf -X POST \
        "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{"type":"A","name":"bluekiwi","content":"119.66.34.25","proxied":true}' \
        > /dev/null
      ok "DNS record created: bluekiwi.dante-labs.com → 119.66.34.25"
    else
      ok "DNS record already exists"
    fi
  fi

  # Step 3: Caddy config (pass actual port as $1)
  ssh_run bash -s "$remote_port" <<'CADDY'
port="$1"
BLOCK="
bluekiwi.dante-labs.com {
    reverse_proxy localhost:${port}
}"
if ! grep -q "bluekiwi.dante-labs.com" /etc/caddy/Caddyfile 2>/dev/null; then
  echo "$BLOCK" | sudo tee -a /etc/caddy/Caddyfile > /dev/null
  sudo systemctl reload caddy
  echo "caddy: block added and reloaded"
elif ! grep -q "reverse_proxy localhost:${port}" /etc/caddy/Caddyfile; then
  sudo sed -i "s|reverse_proxy localhost:[0-9]*|reverse_proxy localhost:${port}|g" /etc/caddy/Caddyfile
  sudo systemctl reload caddy
  echo "caddy: port updated to ${port} and reloaded"
else
  echo "caddy: block already present, skipping"
fi
CADDY
  ok "Caddy configured"

  # Step 4: Health check (follow redirects; fallback to DanteServer local check)
  log "Health check: ${BLUEKIWI_URL}"
  local i http_code
  for i in $(seq 1 20); do
    http_code="$(curl -sfL -o /dev/null -w "%{http_code}" "${BLUEKIWI_URL}/" 2>/dev/null || echo "0")"
    [[ "$http_code" =~ ^[23] ]] && break || sleep 3
  done
  if [[ "$http_code" =~ ^[23] ]]; then
    ok "health check: ${BLUEKIWI_URL} → $http_code"
  else
    # DNS may not have propagated locally — verify via DanteServer
    http_code="$(ssh_run "curl -sfL -o /dev/null -w '%{http_code}' '${BLUEKIWI_URL}/' 2>/dev/null || echo 0")"
    [[ "$http_code" =~ ^[23] ]] \
      || fail "health check failed: ${BLUEKIWI_URL} (local DNS may not have propagated)"
    ok "health check (via $SERVER): ${BLUEKIWI_URL} → $http_code"
  fi
}

phase_e2e() {
  log "Phase 3: E2E scenarios"
  BLUEKIWI_EXTERNAL=1 BLUEKIWI_API_URL="$BLUEKIWI_URL" \
    bash "$(dirname "$0")/e2e-oss.sh"
}

phase_tmux() {
  log "Phase 4: tmux init"
  local api_key="${BK_API_KEY:-}"
  if [[ -z "$api_key" ]]; then
    echo "Enter BlueKiwi API key for tmux test (bk_...):"
    read -r api_key
  fi
  ssh "$SERVER" "BK_API_KEY=${api_key@Q} BLUEKIWI_API_URL=${BLUEKIWI_URL@Q} bash ${REMOTE_DIR@Q}/scripts/tmux-init.sh"
  echo ""
  echo "tmux session 'bk-test' is ready on $SERVER."
  echo "Interact via SSH + tmux capture-pane / send-keys."
}

run_phase "ci-check" && phase_ci_check
run_phase "deploy"   && phase_deploy
run_phase "e2e"      && phase_e2e
run_phase "tmux"     && phase_tmux

echo ""
echo "✓ bk-release.sh ${PHASE} complete"
