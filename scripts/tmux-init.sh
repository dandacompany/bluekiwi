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

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null && echo "killed old session" || true

# Create workspace directory
mkdir -p "$WORKSPACE"

# Find the MCP server path
MCP_SERVER_PATH="$(cd "$(dirname "$0")/.." && pwd)/mcp/dist/server.js"

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

# Create tmux session
tmux new-session -d -s "$SESSION" -c "$WORKSPACE"

# Start Claude Code
tmux send-keys -t "$SESSION" "claude --dangerously-skip-permissions" Enter

# Print status box
cat <<EOF

╔════════════════════════════════════════════════════════════════╗
║           BlueKiwi Claude Code tmux Session Started          ║
╠════════════════════════════════════════════════════════════════╣
║ Session:      $SESSION
║ Workspace:    $WORKSPACE
║ MCP Config:   $WORKSPACE/.mcp.json
║ API URL:      $BLUEKIWI_API_URL
╠════════════════════════════════════════════════════════════════╣
║ Commands to interact with the session:                        ║
║                                                                ║
║ View last 50 lines:                                           ║
║   tmux capture-pane -t $SESSION -p -S -50                     ║
║                                                                ║
║ Send a command (replace <prompt>):                            ║
║   tmux send-keys -t $SESSION '<prompt>' Enter                 ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

EOF
