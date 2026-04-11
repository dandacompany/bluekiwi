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

  # Step 1: Remote git clone + docker compose up
  ssh "$SERVER" bash <<REMOTE
set -euo pipefail
if [ -d "$REMOTE_DIR" ]; then
  cd "$REMOTE_DIR"
  docker compose down -v >/dev/null 2>&1 || true
  cd ~
  rm -rf "$REMOTE_DIR"
fi
git clone https://github.com/${REPO}.git "$REMOTE_DIR"
cd "$REMOTE_DIR"
cat > .env <<ENV
DB_PASSWORD=\$(openssl rand -hex 16)
JWT_SECRET=\$(openssl rand -hex 32)
APP_PORT=3100
PUBLIC_URL=${BLUEKIWI_URL}
BLUEKIWI_VERSION=latest
ENV
docker compose up -d
for i in \$(seq 1 60); do
  curl -sf -o /dev/null "http://localhost:3100/" && break || sleep 2
done
echo "stack ready"
REMOTE
  ok "docker compose up on $SERVER"

  # Step 2: Cloudflare DNS
  log "Configuring Cloudflare DNS..."
  local existing
  existing="$(curl -sf \
    "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=bluekiwi.dante-labs.com&type=A" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).result.length")"

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

  # Step 3: Caddy config
  ssh "$SERVER" bash <<'CADDY'
BLOCK="
bluekiwi.dante-labs.com {
    reverse_proxy localhost:3100
}"
if ! grep -q "bluekiwi.dante-labs.com" /etc/caddy/Caddyfile 2>/dev/null; then
  echo "$BLOCK" | sudo tee -a /etc/caddy/Caddyfile > /dev/null
  sudo systemctl reload caddy
  echo "caddy: block added and reloaded"
else
  echo "caddy: block already present, skipping"
fi
CADDY
  ok "Caddy configured"

  # Step 4: Health check (wait up to 30s for DNS/Caddy)
  log "Health check: ${BLUEKIWI_URL}"
  local i
  for i in $(seq 1 15); do
    curl -sf -o /dev/null "${BLUEKIWI_URL}/" && break || sleep 2
  done
  curl -sf -o /dev/null "${BLUEKIWI_URL}/" || fail "health check failed: ${BLUEKIWI_URL}"
  ok "health check: ${BLUEKIWI_URL} → 200"
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
  ssh "$SERVER" "BK_API_KEY=$api_key BLUEKIWI_API_URL=$BLUEKIWI_URL \
    bash $REMOTE_DIR/scripts/tmux-init.sh"
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
