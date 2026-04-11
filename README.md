<div align="center">

<img src="public/icon-192.png" alt="BlueKiwi" width="96" height="96" />

# BlueKiwi

**AI Agent Workflow Engine**

Design reusable workflows, run them from any AI agent, and watch every step in real time.

[![npm](https://img.shields.io/npm/v/bluekiwi?color=4169e1)](https://www.npmjs.com/package/bluekiwi)
[![Docker](https://img.shields.io/badge/ghcr.io-bluekiwi-b7cf57)](https://ghcr.io/dandacompany/bluekiwi)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey)](LICENSE)

[Quick Setup](#quick-setup) · [Usage](#usage) · [Features](#features) · [MCP Tools](#mcp-tools) · [CLI](#cli)

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

### 1. Invite your team

After setup, go to **Settings → Team** and create an invite link or token for each team member.

### 2. Team members accept the invite

```bash
# Install the CLI
npm install -g bluekiwi

# Accept invite (auto-configures MCP for detected agent runtimes)
bluekiwi accept <token> --server https://your-bluekiwi-server.example.com

# Verify the connection
bluekiwi status
```

The `accept` command detects which agent runtimes you have installed (Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw) and installs the BlueKiwi MCP server into each one automatically.

### 3. Use workflows from your agent

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

### 4. Build your own workflows

Open the web UI → **Workflows → New Workflow** → add steps using the Cmd+K node picker.

Three step types:

- **Action** — the agent executes autonomously
- **Gate** — pauses and waits for human approval before continuing
- **Loop** — repeats until a condition is met

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
node dist/server.js
# Env: BLUEKIWI_API_URL, BLUEKIWI_API_KEY
```

Full OpenAPI spec available at **`/docs`** on your running server (Swagger UI).

---

## CLI

```bash
# Accept team invite and configure MCP
bluekiwi accept <token> --server <url>

# Check connection and current user info
bluekiwi status

# List available workflows
bluekiwi workflows

# Start a workflow (prints task ID and web UI link)
bluekiwi run <workflow-id>
```

Install:

```bash
npm install -g bluekiwi
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
