<div align="center">

<img src="public/icon-192.png" alt="BlueKiwi" width="96" height="96" />

# BlueKiwi

**AI Agent Workflow Engine**

Design reusable workflows, run them from any AI coding agent, and watch every step in real time.

[![npm](https://img.shields.io/npm/v/bluekiwi?color=4169e1)](https://www.npmjs.com/package/bluekiwi)
[![Docker](https://img.shields.io/badge/ghcr.io-bluekiwi-b7cf57)](https://ghcr.io/dandacompany/bluekiwi)
[![License](https://img.shields.io/badge/License-Sustainable_Use-lightgrey)](LICENSE.md)

[Quick Setup](#quick-setup) · [Skills](#skills) · [MCP Tools](#mcp-tools) · [CLI](#cli) · [Self-Hosting](#self-hosting) · [Contributing](#contributing)

🌐 [한국어](README.ko.md) · 📊 [Presentation Slides](https://canva.link/5f62nmx6wk7x4ka)

</div>

---

## What is BlueKiwi?

BlueKiwi is a **self-hosted workflow engine for AI coding agents**. You design multi-step workflows once in the web UI, then any connected agent (Claude Code, Codex CLI, Gemini CLI, …) can start and execute them — with every step logged in a live timeline you can watch in the browser.

```
You type:  /bk-start "backend code review"

Agent ──▶ BlueKiwi MCP ──▶ BlueKiwi Server ──▶ Web UI (live timeline)
          list_workflows      stores logs          your browser
          start_workflow      enforces RBAC        comments / approvals
          execute_step        saves outputs
          advance
```

**No more copy-pasting prompts.** Your best agent workflows become reusable institutional knowledge.

---

## Quick Setup

### Prerequisites

- Docker + Docker Compose

### 1. Download the compose file

```bash
mkdir bluekiwi && cd bluekiwi
curl -L https://raw.githubusercontent.com/dandacompany/bluekiwi/main/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/dandacompany/bluekiwi/main/.env.example -o .env
```

### 2. Configure `.env`

Open `.env` and set the two required values:

```bash
# Generate with: openssl rand -hex 16
DB_PASSWORD=your_strong_password

# Generate with: openssl rand -hex 32
JWT_SECRET=your_jwt_secret
```

### 3. Start

```bash
docker compose up -d
```

Open **http://localhost:3100/setup** → create your superuser account. The `/setup` page is only available until the first account is created.

> The stack runs the Next.js app on port `3100` (configurable via `APP_PORT`), PostgreSQL 16, and Redis 7 — all managed by Docker.

### 4. Install the CLI

```bash
npm install -g bluekiwi
```

**Option A — accept an invite (recommended for new team members)**

Create an invite in **Settings → Team**, then:

```bash
bluekiwi accept <token> --server http://localhost:3100
```

Validates the invite → creates your account → issues an API key → detects installed agent runtimes → injects the BlueKiwi MCP server + skills into each one.

**Option B — init with an existing API key (superuser / admin)**

If you already have an account (e.g. the superuser created via `/setup`), generate a key in **Settings → API Keys**, then:

```bash
bluekiwi init --server http://localhost:3100 --api-key bk_xxxx
```

Connects to the server with the given key → detects installed runtimes → injects the MCP server + skills into each one.

---

## Quick Start Local Runtime (Beta)

If you want to try BlueKiwi without Docker, PostgreSQL, or Redis, the CLI can also run a local Quick Start runtime backed by SQLite.

Current stability level: `Beta`.

```bash
npm install -g bluekiwi
bluekiwi start
bluekiwi status
bluekiwi stop
```

What this mode does:

- runs BlueKiwi as a local process
- stores data in a local SQLite file
- auto-selects a free port starting from `3102`
- manages lifecycle through the CLI

This mode is intended for local authoring, demos, CI smoke validation, and small-scale testing. It is not positioned as full hosted/server parity yet. For team deployment and full hosted parity, use the Docker-based setup above.

---

## Skills

After `bluekiwi accept`, you have these slash commands inside Claude Code (and other supported runtimes):

| Command                | Description                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `/bk-start [workflow]` | Start or resume a workflow. Handles session restore, timed-out tasks, and HITL gates inline. |
| `/bk-design [goal]`    | Design and register a new workflow from a natural-language description.                      |
| `/bk-approve`          | Approve a paused HITL step when resuming a session mid-approval.                             |
| `/bk-improve`          | Analyze a completed task and suggest workflow improvements.                                  |
| `/bk-report`           | Generate a structured report for a completed task.                                           |
| `/bk-instruction`      | Create or update an instruction template in the library.                                     |
| `/bk-rewind`           | Rewind the current task to a previous step.                                                  |
| `/bk-status`           | Show current task progress and step details.                                                 |
| `/bk-version`          | Show or switch the active workflow version.                                                  |
| `/bk-credential`       | List or create credentials available to the agent.                                           |
| `/bk-scan`             | Run compliance pattern scans on the local repository.                                        |
| `/bk-share`            | Share a folder with a user group.                                                            |

**Example session:**

```
You:   /bk-start "backend code review"

Agent: → Starting "Backend Code Review" (6 steps)
         Step 1/6 — Summarize scope
         [executes ...]
         Step 2/6 — Security check
         ⏸  Gate: Review findings and approve to continue.
         [waits for human]

You:   /bk-approve

Agent: → Approved. Step 3/6 — Performance analysis ...
```

While the agent runs, watch the live timeline at **`http://localhost:3100/tasks/{id}`**.

---

## Workflow Builder

Open the web UI → **Workflows → New** → add steps.

### Node types

| Type       | Behavior                                                                                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Action** | Agent executes autonomously and advances automatically.                                                                                                                                                                                                     |
| **Gate**   | Agent pauses and waits for the next `/bk-start` call or human signal to continue. Enable **Visual Selection** to render a click-based HTML UI (bk-options, bk-checklist, bk-slider, …) that the agent writes and the user interacts with in a popup dialog. |
| **Loop**   | Agent repeats the step until a condition is met, then jumps forward.                                                                                                                                                                                        |

### HITL (Human-in-the-Loop)

Mark any **Action** node as `hitl=true` to require explicit human approval before the agent can advance. The agent calls `request_approval` and stops; a human reviews the output in the web UI and clicks **Approve**.

### Task lifecycle

```
pending → running → completed
                  → failed
                  → timed_out   (inactive for 2+ hours; /bk-start offers resume)
```

Tasks can be **rewound** to any previous step from the web UI or via `/bk-rewind`.

---

## MCP Tools

The `bluekiwi` MCP server exposes tools your agent runtime calls automatically. Full reference at **`/docs`** on your running server (Swagger UI + OpenAPI JSON).

### Workflow execution

| Tool             | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `list_workflows` | List workflows visible to the current user                |
| `start_workflow` | Start a task from a workflow                              |
| `execute_step`   | Submit the current step's output                          |
| `advance`        | Move to the next step (or `peek=true` to inspect current) |
| `heartbeat`      | Append progress ping to keep the step alive               |
| `complete_task`  | Mark the task as completed or failed                      |
| `rewind`         | Jump back to a previous step                              |

### Visual Selection

| Tool               | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `set_visual_html`  | Write bk-\* component HTML for a visual_selection gate node     |
| `get_web_response` | Fetch the user's click response after they submit the VS dialog |
| `submit_visual`    | Attach rendered HTML to a step (lower-level alternative)        |

### Human approval (HITL)

| Tool               | Description                                                   |
| ------------------ | ------------------------------------------------------------- |
| `request_approval` | Signal that a human must approve before the agent can advance |
| `approve_step`     | Approve the current HITL step (only called by `/bk-approve`)  |

### Task data

| Tool                              | Description                                                |
| --------------------------------- | ---------------------------------------------------------- |
| `list_tasks`                      | List tasks with optional filters (status, workflow, query) |
| `get_comments`                    | Read team comments on a step                               |
| `save_artifacts`                  | Persist files or references to the task                    |
| `load_artifacts`                  | Load previously saved artifacts                            |
| `save_feedback`                   | Save post-workflow feedback survey responses               |
| `save_findings` / `list_findings` | Save or retrieve compliance scan findings                  |

### Workflow management

| Tool                                                          | Description                            |
| ------------------------------------------------------------- | -------------------------------------- |
| `create_workflow` / `update_workflow` / `delete_workflow`     | Full CRUD                              |
| `list_workflow_versions`                                      | List all versions in a workflow family |
| `activate_workflow` / `deactivate_workflow`                   | Toggle active version                  |
| `append_node` / `insert_node` / `update_node` / `remove_node` | Node-level CRUD                        |

### Attachments

| Tool                                      | Description                                     |
| ----------------------------------------- | ----------------------------------------------- |
| `list_attachments` / `get_attachment`     | Browse and download node file attachments       |
| `upload_attachment` / `delete_attachment` | Add or remove text file attachments from a node |

### Instructions & Credentials

| Tool                                                                                     | Description                  |
| ---------------------------------------------------------------------------------------- | ---------------------------- |
| `list_instructions` / `create_instruction` / `update_instruction` / `delete_instruction` | Instruction template library |
| `list_credentials` / `create_credential` / `update_credential` / `delete_credential`     | Credential store             |

### Folders & sharing

| Tool                                 | Description                            |
| ------------------------------------ | -------------------------------------- |
| `list_folders` / `create_folder`     | Browse and create folders              |
| `share_folder` / `unshare_folder`    | Share a folder with a user group       |
| `move_workflow` / `move_instruction` | Move items between folders             |
| `transfer_workflow`                  | Transfer ownership to another user     |
| `list_my_groups`                     | List user groups the caller belongs to |

### Compliance

| Tool        | Description                                                                      |
| ----------- | -------------------------------------------------------------------------------- |
| `scan_repo` | Run static pattern scans on the local filesystem (runs in-process, not via REST) |

---

## CLI

```bash
npm install -g bluekiwi
```

| Command                                        | Description                                          |
| ---------------------------------------------- | ---------------------------------------------------- |
| `bluekiwi accept <token> --server <url>`       | Accept a team invite and configure agent runtimes    |
| `bluekiwi init --server <url> --api-key <key>` | Connect with an existing API key (superuser / admin) |
| `bluekiwi status`                              | Show connection status and current user info         |
| `bluekiwi runtimes list`                       | Show supported runtimes and their install status     |
| `bluekiwi runtimes add <name>`                 | Install BlueKiwi into an additional runtime          |
| `bluekiwi runtimes remove <name>`              | Remove BlueKiwi from a runtime                       |
| `bluekiwi logout`                              | Log out and remove all credentials                   |
| `bluekiwi upgrade`                             | Upgrade CLI and refresh MCP assets in all runtimes   |

**Supported runtimes (17):**

| #   | Runtime            | Runtime id       | Config file                                                                                                              | Format                                           |
| --- | ------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| 1   | Claude Code        | `claude-code`    | `~/.claude.json`                                                                                                         | JSON (`mcpServers`)                              |
| 2   | Claude Desktop     | `claude-desktop` | `~/Library/Application Support/Claude/claude_desktop_config.json` _(macOS)_                                              | JSON (`mcpServers`)                              |
| 3   | Codex CLI          | `codex`          | `~/.codex/config.toml`                                                                                                   | TOML section                                     |
| 4   | Gemini CLI         | `gemini-cli`     | `~/.gemini/settings.json`                                                                                                | JSON (`mcpServers`)                              |
| 5   | OpenCode           | `opencode`       | `~/.opencode/mcp.json`                                                                                                   | JSON (`mcpServers`)                              |
| 6   | OpenClaw           | `openclaw`       | `~/.openclaw/mcp.json`                                                                                                   | JSON (`mcpServers`)                              |
| 7   | Cursor             | `cursor`         | `~/.cursor/mcp.json`                                                                                                     | JSON (`mcpServers`)                              |
| 8   | Antigravity        | `antigravity`    | `~/.antigravity/mcp.json`                                                                                                | JSON (`mcpServers`)                              |
| 9   | Windsurf           | `windsurf`       | `~/.codeium/windsurf/mcp_config.json`                                                                                    | JSON (`mcpServers`)                              |
| 10  | Cline (VS Code)    | `cline`          | VS Code `globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`                                          | JSON (`mcpServers`)                              |
| 11  | Roo Code (VS Code) | `roo-code`       | VS Code `globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`                                            | JSON (`mcpServers`)                              |
| 12  | VS Code (Copilot)  | `vscode`         | `<VS Code User dir>/mcp.json`                                                                                            | JSON (`servers` + `type: "stdio"`)               |
| 13  | Continue.dev       | `continue`       | `~/.continue/mcpServers/bluekiwi.yaml`                                                                                   | YAML (standalone file)                           |
| 14  | Zed                | `zed`            | `~/.config/zed/settings.json`                                                                                            | JSON (`context_servers`)                         |
| 15  | Goose              | `goose`          | `~/.config/goose/config.yaml`                                                                                            | YAML (`extensions:` with managed sentinel block) |
| 16  | JetBrains AI       | `jetbrains`      | `<JetBrains>/<each-ide-version>/mcp.json` (fans out across every IntelliJ / PyCharm / WebStorm / Rider / … installation) | JSON (`mcpServers`)                              |
| 17  | Trae               | `trae`           | `~/Library/Application Support/Trae/User/mcp.json` _(best-effort; Trae global path is not officially documented)_        | JSON (`mcpServers`)                              |

After connecting, BlueKiwi also copies its built-in skills into each runtime's skills directory. Slash commands are available natively in runtimes that scan a skills directory (Claude Code, Claude Desktop, Codex, Gemini, OpenCode, OpenClaw). In runtimes without native skills support, skill files are still written (at `<base>/skills/`) for future compatibility but are not auto-loaded today.

Target a single runtime with `--runtime <id>`, e.g. `bluekiwi init --runtime cursor`.

---

## Self-Hosting

### Environment variables

| Variable           | Required | Default                 | Description                                                   |
| ------------------ | -------- | ----------------------- | ------------------------------------------------------------- |
| `DB_PASSWORD`      | ✅       | —                       | PostgreSQL password                                           |
| `JWT_SECRET`       | ✅       | —                       | JWT signing secret (min 32 chars)                             |
| `APP_PORT`         |          | `3100`                  | Host port for the web UI                                      |
| `TEAM_NAME`        |          | —                       | Optional team label shown in UI metadata and sidebar branding |
| `PUBLIC_URL`       |          | `http://localhost:3100` | Public URL shown in invite links                              |
| `BLUEKIWI_VERSION` |          | `latest`                | Pin a specific image tag                                      |
| `RESEND_API_KEY`   |          | —                       | Enables email delivery for invites                            |
| `FROM_EMAIL`       |          | —                       | Sender address for invite emails                              |

### One-click deploy

| Platform         | Template                       |
| ---------------- | ------------------------------ |
| Railway          | `deploy/railway.json`          |
| Fly.io           | `deploy/fly.toml`              |
| Render           | `deploy/render.yaml`           |
| DigitalOcean App | `deploy/digitalocean-app.yaml` |
| Dokku            | `deploy/dokku/`                |

### Database migrations

The app runs migrations automatically on startup. For a fresh install, Docker loads `docker/init.sql` which creates the complete schema and marks the initial migration as applied — no manual steps needed.

To run migrations manually (e.g., in a CI pipeline):

```bash
npx tsx scripts/migrate.ts
```

### Upgrading

Pull the new image and restart:

```bash
docker compose pull && docker compose up -d
```

Migrations run automatically on the next app start.

---

## Security & RBAC

- **4-tier roles**: `superuser` → `admin` → `editor` → `viewer`
- **API keys**: `bk_` prefix, SHA-256 hashed, with expiry and revocation
- **Folders**: personal / group / public visibility with 2-level hierarchy
- **Sharing**: grant groups `reader` or `contributor` access to specific folders
- **No default credentials** — the superuser account is created on first visit to `/setup`
- **MCP has no direct DB access** — all calls go through the authenticated REST API

---

## Contributing

```bash
git clone https://github.com/dandacompany/bluekiwi.git
cd bluekiwi
bash scripts/dev.sh start
# App:     http://localhost:3100
# DB:      localhost:5433
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture notes, dev commands, and how to add migrations.

Issues and PRs are welcome.

---

## License

[Sustainable Use License](LICENSE.md) — free for personal and internal business use.  
Commercial redistribution or SaaS hosting requires a separate agreement.  
Copyright © 2026 Dante Labs.

---

<div align="center">

**YouTube** [@dante-labs](https://youtube.com/@dante-labs) · **Email** dante@dante-labs.com · [☕ Buy Me a Coffee](https://buymeacoffee.com/dante.labs)

</div>
