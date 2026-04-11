#!/usr/bin/env bash
# scripts/tmux-init.sh — Initialize tmux session with Claude Code for BlueKiwi interactive testing.
# After this script completes, interact via:
#   tmux capture-pane -t bk-test -p -S -50
#   tmux send-keys -t bk-test '<prompt>' Enter
set -euo pipefail

SESSION="bk-test"
WORKSPACE="${BK_TMUX_WORKSPACE:-/tmp/bk-tmux-$(openssl rand -hex 4)}"
BLUEKIWI_API_URL="${BLUEKIWI_API_URL:-https://bluekiwi.dante-labs.com}"
API_KEY="${BK_API_KEY:?BK_API_KEY environment variable is required}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null && echo "killed old session" || true

# Create workspace directory
mkdir -p "$WORKSPACE"

# Find the MCP server path (must be pre-built: mcp/dist/server.js)
MCP_SERVER_PATH="$(cd "$(dirname "$0")/.." && pwd)/mcp/dist/server.js"

if [[ ! -f "$MCP_SERVER_PATH" ]]; then
  echo "ERROR: MCP server not built. Run 'cd mcp && npm install && npm run build' first." >&2
  exit 1
fi

# Write .mcp.json to workspace
cat > "$WORKSPACE/.mcp.json" <<EOF
{
  "mcpServers": {
    "bluekiwi": {
      "command": "node",
      "args": ["$MCP_SERVER_PATH"],
      "env": {
        "BLUEKIWI_API_URL": "$BLUEKIWI_API_URL",
        "BLUEKIWI_API_KEY": "$API_KEY"
      }
    }
  }
}
EOF
echo "  ✓ .mcp.json written to $WORKSPACE"

# Verify MCP server starts and responds
echo "  → Verifying MCP server..."
MCP_VERIFY=$(printf '%s\n' \
  '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"1"}}}' \
  '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_workflows","arguments":{}}}' | \
  timeout 15 \
  env BLUEKIWI_API_URL="$BLUEKIWI_API_URL" BLUEKIWI_API_KEY="$API_KEY" \
  node "$MCP_SERVER_PATH" 2>/dev/null || true)

if echo "$MCP_VERIFY" | grep -q '"id":1'; then
  if echo "$MCP_VERIFY" | grep '"id":1' | grep -q '"result"'; then
    echo "  ✓ MCP server verified (list_workflows ok)"
  else
    echo "  ✗ MCP list_workflows returned error" >&2
    echo "$MCP_VERIFY" >&2
    exit 1
  fi
else
  echo "  ✗ MCP server did not respond" >&2
  exit 1
fi

# Create tmux session
tmux new-session -d -s "$SESSION" -c "$WORKSPACE"
echo "  ✓ tmux session '$SESSION' created"

# Launch Claude Code if available and ANTHROPIC_API_KEY is set
if command -v claude &>/dev/null && [[ -n "$ANTHROPIC_API_KEY" ]]; then
  tmux send-keys -t "$SESSION" \
    "ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY' claude --dangerously-skip-permissions" Enter
  echo "  ✓ Claude Code launched in session"
elif command -v claude &>/dev/null; then
  # claude available but no API key — start with env set for user to auth
  tmux send-keys -t "$SESSION" \
    "echo 'BlueKiwi MCP ready. Run: claude --dangerously-skip-permissions'" Enter
  echo "  ⚠ Claude Code available but ANTHROPIC_API_KEY not set — set it before running claude"
else
  # Fallback: start shell with MCP env pre-set for manual inspection
  tmux send-keys -t "$SESSION" \
    "export BLUEKIWI_API_URL='$BLUEKIWI_API_URL' BLUEKIWI_API_KEY='$API_KEY'; echo 'BlueKiwi env ready. Install claude with: npm install -g @anthropic-ai/claude-code'" Enter
  echo "  ⚠ claude not installed — tmux shell ready with BlueKiwi env set"
fi

# Print status
cat <<EOF

╔════════════════════════════════════════════════════════════════╗
║           BlueKiwi tmux Session Ready                        ║
╠════════════════════════════════════════════════════════════════╣
║ Session:   $SESSION
║ Workspace: $WORKSPACE
║ MCP:       $WORKSPACE/.mcp.json
║ API URL:   $BLUEKIWI_API_URL
╠════════════════════════════════════════════════════════════════╣
║ Interact:                                                      ║
║   View output:                                                 ║
║     tmux capture-pane -t $SESSION -p -S -50                   ║
║   Send command:                                                ║
║     tmux send-keys -t $SESSION '<prompt>' Enter               ║
║   Attach session:                                              ║
║     tmux attach -t $SESSION                                   ║
╚════════════════════════════════════════════════════════════════╝

EOF
