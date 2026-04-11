<div align="center">

<img src="public/icon-192.png" alt="BlueKiwi" width="96" height="96" />

# BlueKiwi

**AI Agent Workflow Engine**

Design reusable workflows, run them from any AI agent, and watch every step in real time.

[![npm](https://img.shields.io/npm/v/bluekiwi?color=4169e1)](https://www.npmjs.com/package/bluekiwi)
[![Docker](https://img.shields.io/badge/ghcr.io-bluekiwi-b7cf57)](https://ghcr.io/dandacompany/bluekiwi)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey)](LICENSE)

[Quick Setup](#quick-setup) · [Usage](#usage) · [Features](#features) · [MCP Tools](#mcp-tools) · [CLI](#cli) · [Configuration](#configuration) · [Troubleshooting](#troubleshooting)

🌐 [한국어](README.ko.md)

</div>

---

## What is BlueKiwi?

BlueKiwi is a self-hosted server that turns **multi-step agent instructions into reusable workflows**.

You build a workflow once in the web UI, then any connected AI agent (Claude Code, Codex, Gemini CLI, …) can start it, execute steps, pause for human input, and complete it — all tracked in a live timeline your team can watch in the browser.

```
You type:  /bk-start "code review"

Agent ──▶ BlueKiwi MCP ──▶ BlueKiwi Server ──▶ Web UI (live timeline)
          list_workflows      stores logs          your browser
          start_workflow      enforces RBAC        comments / artifacts
          execute_step        saves outputs
```

**No more copy-pasting prompts.** Your best agent workflows become institutional knowledge.

---

## Quick Setup

### Option 1 — Docker (recommended)

```bash
mkdir bluekiwi && cd bluekiwi

# Download docker-compose and env template
curl -L https://raw.githubusercontent.com/dandacompany/bluekiwi/main/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/dandacompany/bluekiwi/main/.env.example -o .env

# Set a strong password and secret (required)
# Edit .env → DB_PASSWORD and JWT_SECRET

docker compose up -d
```

Open **http://localhost:3100** → complete the `/setup` page → you're the **superuser**.

> The stack runs Next.js on port `3100` (configurable via `APP_PORT`), PostgreSQL, and Redis — all in Docker.

### Option 2 — Managed platforms

One-click deploy templates are available under [`deploy/`](./deploy/) for:

| Platform         |                         |
| ---------------- | ----------------------- |
| Railway          | `deploy/railway.json`   |
| Fly.io           | `deploy/fly.toml`       |
| Render           | `deploy/render.yaml`    |
| DigitalOcean App | `deploy/do-app.yaml`    |
| Dokku            | `deploy/dokku-setup.sh` |

---

## Usage

### 1. First-time setup (superuser)

After the server starts, navigate to **`/setup`** in your browser. This one-time wizard lets you create the superuser account. The `/setup` page is only available until the first account is created.

If you're using the CLI directly (no invite), run:

```bash
npm install -g bluekiwi

# Connect using an existing API key (superuser / admin use case)
bluekiwi init --server https://your-bluekiwi-server.example.com --api-key bk_...
```

### 2. Invite your team

Go to **Settings → Team** and create an invite link or token for each team member. Assign a role when creating the invite.

### 3. Team members accept the invite

```bash
# Install the CLI
npm install -g bluekiwi

# Accept invite (interactive: asks for username + password, then selects runtimes)
bluekiwi accept <token> --server https://your-bluekiwi-server.example.com

# Verify the connection
bluekiwi status
```

The `accept` command:

1. Validates the invite token
2. Prompts you to set a username and password
3. Creates your account on the server and issues an API key
4. Detects which agent runtimes are installed on your machine
5. Installs the BlueKiwi MCP server and skills into each selected runtime
6. Saves your credentials to `~/.bluekiwi/config.json`

**Non-interactive / CI mode** — skip prompts by passing flags or environment variables:

```bash
bluekiwi accept <token> --server <url> --username alice --password secret
```

### 4. Use workflows from your agent

Inside Claude Code (or any supported runtime), you now have these slash commands:

| Command                | What it does                   |
| ---------------------- | ------------------------------ |
| `/bk-start <workflow>` | Start a workflow by name or ID |
| `/bk-next`             | Advance to the next step       |
| `/bk-status`           | Show current task progress     |
| `/bk-rewind <step>`    | Jump back to a previous step   |

**Example session:**

```
You:   /bk-start "backend code review"

Agent: Starting workflow "Backend Code Review" (6 steps)
       Step 1/6 — Read changed files and summarize scope
       [... executes ...]
       Step 2/6 — Check for security issues
       ⏸ Gate: Please review my findings and approve to continue.

You:   /bk-next

Agent: Step 3/6 — Performance analysis
       [... continues ...]
```

While the agent runs, your team can watch the live timeline at  
`https://your-server/tasks/{id}` — with structured outputs, comments, and artifacts per step.

### 5. Build your own workflows

Open the web UI → **Workflows → New Workflow** → add steps using the Cmd+K node picker.

Three step types:

- **Action** — the agent executes autonomously
- **Gate** — pauses and waits for human approval before continuing
- **Loop** — repeats until a condition is met

Each step has an **instruction** field (what the agent should do) and an optional **structured output schema** (JSON schema the agent must fill in when the step completes).

---

## Features

### Live Timeline

Every task execution is tracked step-by-step. Each step shows:

- **Thinking** — the agent's reasoning
- **Output** — the assistant response
- **User input** — what the human provided at Gate steps
- **Artifacts** — any files the agent saved
- **Comments** — your team's notes on that step

### Workflow Editor

- Drag-and-drop step reordering
- **Cmd+K** node picker — search saved instruction templates
- Horizontal minimap — full pipeline overview
- Version history — every edit is non-destructive

### Multi-Runtime Support

| Runtime     | Auto-configured by `bluekiwi accept` |
| ----------- | ------------------------------------ |
| Claude Code | `~/.claude/mcp.json`                 |
| Codex CLI   | `~/.codex/config.toml`               |
| Gemini CLI  | `~/.gemini/settings.json`            |
| OpenCode    | `~/.opencode/mcp.json`               |
| OpenClaw    | `~/.openclaw/mcp.json`               |

After installing, BlueKiwi also copies its built-in skills (e.g., `/bk-start`) into each runtime's skills directory so they're available as slash commands immediately.

### Security & RBAC

- **4-tier roles**: `superuser` → `admin` → `editor` → `viewer`
- **API keys**: `bk_` prefix, SHA-256 hashed, with expiry and revocation
- **No default credentials** — first visitor runs `/setup` to create the superuser account
- The MCP server has **no direct DB access** — all requests go through the authenticated REST API

### Internationalization

Built-in Korean / English toggle. Add more languages by dropping a JSON file into `src/lib/i18n/`.

---

## MCP Tools

The `bluekiwi` MCP server exposes 16 tools your agent runtime can call:

| Tool               | Description                       |
| ------------------ | --------------------------------- |
| `list_workflows`   | List all available workflows      |
| `start_workflow`   | Start a workflow → creates a task |
| `execute_step`     | Save the current step's output    |
| `advance`          | Move to the next step             |
| `heartbeat`        | Send progress ping (keep-alive)   |
| `complete_task`    | Mark the task as done             |
| `rewind`           | Jump back to a previous step      |
| `get_web_response` | Fetch a URL (for Gate steps)      |
| `submit_visual`    | Attach a screenshot/image         |
| `save_artifacts`   | Persist files to the task         |
| `load_artifacts`   | Load previously saved files       |
| `get_comments`     | Read team comments on a step      |
| `list_credentials` | List stored API secrets           |
| `create_workflow`  | Create a new workflow via API     |
| `update_workflow`  | Update an existing workflow       |
| `delete_workflow`  | Delete a workflow                 |

**Run the MCP server manually** (for testing or custom integration):

```bash
cd mcp && npm install && npm run build
BLUEKIWI_API_URL=https://your-server.example.com \
BLUEKIWI_API_KEY=bk_... \
node dist/server.js
```

Full OpenAPI spec available at **`/docs`** on your running server (Swagger UI).

---

## CLI

### Installation

```bash
npm install -g bluekiwi
```

### Commands

| Command                           | Description                                          |
| --------------------------------- | ---------------------------------------------------- |
| `bluekiwi accept <token>`         | Accept a team invite and configure runtimes          |
| `bluekiwi init`                   | Connect with an existing API key (no invite)         |
| `bluekiwi status`                 | Show connection status and current user info         |
| `bluekiwi workflows`              | List available workflows                             |
| `bluekiwi run <workflow-id>`      | Start a workflow (prints task ID and web UI link)    |
| `bluekiwi runtimes list`          | Show all supported runtimes and their install status |
| `bluekiwi runtimes add <name>`    | Install BlueKiwi into an additional runtime          |
| `bluekiwi runtimes remove <name>` | Uninstall BlueKiwi from a runtime                    |
| `bluekiwi logout`                 | Log out and uninstall from all runtimes              |
| `bluekiwi upgrade`                | Upgrade to the latest CLI and refresh assets         |

**`bluekiwi accept`** — full flag reference:

```bash
bluekiwi accept <token> \
  --server   <url>        # BlueKiwi server URL (required)
  --username <name>       # Skip username prompt
  --password <pass>       # Skip password prompt
```

**`bluekiwi init`** — connect using an existing API key (admin / superuser workflow):

```bash
bluekiwi init \
  --server  <url>    # or env BLUEKIWI_SERVER
  --api-key <key>    # or env BLUEKIWI_API_KEY
  --runtime <name>   # repeat for multiple; or env BLUEKIWI_RUNTIMES=claude-code,codex
  --yes              # non-interactive (use detected runtimes)
```

---

## Configuration

### `~/.bluekiwi/config.json`

After running `bluekiwi accept` or `bluekiwi init`, your credentials are stored at:

```
~/.bluekiwi/config.json   (mode 0600 — owner read/write only)
~/.bluekiwi/              (mode 0700 — owner access only)
```

The file contains:

```json
{
  "version": "1.0.0",
  "server_url": "https://your-bluekiwi-server.example.com",
  "api_key": "bk_...",
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "role": "editor"
  },
  "runtimes": ["claude-code", "codex"],
  "installed_at": "2026-01-01T00:00:00.000Z",
  "last_used": "2026-01-01T00:00:00.000Z"
}
```

To inspect the current config:

```bash
cat ~/.bluekiwi/config.json
# or
bluekiwi status
```

To reset (log out and remove credentials):

```bash
bluekiwi logout
```

### MCP config files (per runtime)

`bluekiwi accept` / `bluekiwi init` injects the MCP server entry directly into each runtime's config:

| Runtime     | Config file modified      |
| ----------- | ------------------------- |
| Claude Code | `~/.claude/mcp.json`      |
| Codex CLI   | `~/.codex/config.toml`    |
| Gemini CLI  | `~/.gemini/settings.json` |
| OpenCode    | `~/.opencode/mcp.json`    |
| OpenClaw    | `~/.openclaw/mcp.json`    |

The injected entry runs the bundled `node dist/server.js` with two env vars:

```
BLUEKIWI_API_URL  = your server URL
BLUEKIWI_API_KEY  = your API key
```

To add a runtime that wasn't installed when you first ran `accept`:

```bash
# Install the missing runtime first, then:
bluekiwi runtimes add codex
```

To see which runtimes are detected and active:

```bash
bluekiwi runtimes list
```

---

## Troubleshooting

**"Not authenticated" error**

```
Error: Not authenticated. Run `npx bluekiwi accept <token> --server <url>` first.
```

`~/.bluekiwi/config.json` is missing or corrupted. Re-run `bluekiwi accept` or `bluekiwi init`.

---

**"Connection failed" in `bluekiwi status`**

The server is unreachable or the API key has been revoked. Check:

- The server URL in `~/.bluekiwi/config.json` is correct
- The server is running (`docker compose ps`)
- Your API key is not expired or revoked (**Settings → API Keys** in the web UI)

---

**Runtime not detected by `bluekiwi accept`**

The CLI checks for runtime binaries at install time. If you install a new agent runtime after running `bluekiwi accept`, add it manually:

```bash
bluekiwi runtimes add claude-code   # or: codex, gemini-cli, opencode, openclaw
```

---

**Slash commands not appearing in Claude Code**

BlueKiwi installs skills files into `~/.claude/skills/`. If they're missing, re-run:

```bash
bluekiwi runtimes remove claude-code
bluekiwi runtimes add claude-code
```

---

**Upgrading the CLI**

```bash
bluekiwi upgrade
# Equivalent to: npm install -g bluekiwi@latest + reinstall assets into all runtimes
```

---

## Contributing

Issues and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, architecture notes, and the database schema.

```bash
# Local dev stack (hot reload)
git clone https://github.com/dandacompany/bluekiwi.git
cd bluekiwi
bash scripts/dev.sh start
```

---

## License

MIT — see [LICENSE](LICENSE).  
Copyright © 2026 Dante Labs.

---

<div align="center">

**YouTube** [@dante-labs](https://youtube.com/@dante-labs) · **Email** dante@dante-labs.com · [☕ Buy Me a Coffee](https://buymeacoffee.com/dante.labs)

</div>
