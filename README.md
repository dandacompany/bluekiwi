<div align="center">

<img src="public/icon-192.png" alt="BlueKiwi" width="96" height="96" />

# BlueKiwi

**Agent Workflow Engine**

Design, execute, and monitor AI agent workflows step-by-step.
Built for Claude Code, Codex, and any MCP-compatible agent runtime.

[Quick Start](#quick-start) · [Features](#features) · [How It Works](#how-it-works) · [Tech Stack](#tech-stack) · [API](#api)

</div>

---

## Overview

BlueKiwi lets you define **reusable AI workflows** as ordered instruction nodes, then execute them from your agent of choice (Claude Code, Codex, or any MCP client). Each step can:

- **Action** — run an instruction autonomously
- **Gate** — pause for user input before continuing
- **Loop** — repeat until a condition is met

Progress is tracked in real time, with structured logs (user input / thinking / assistant output), artifacts, and comments — all stored in PostgreSQL and browsable from a web UI.

**Use cases**: code review pipelines, research & analysis workflows, guided onboarding, customer support automation, content generation pipelines, anything that benefits from repeatable multi-step agent execution.

---

## Quick Start

BlueKiwi has two installation tracks — pick the one that matches your role.

### 🖥️ For server operators (superusers)

Deploy the full BlueKiwi stack for your team.

**Docker (recommended):**

```bash
mkdir bluekiwi && cd bluekiwi
curl -L https://raw.githubusercontent.com/dandacompany/bluekiwi/main/docker-compose.yml > docker-compose.yml
curl -L https://raw.githubusercontent.com/dandacompany/bluekiwi/main/.env.example > .env
# Edit .env — set DB_PASSWORD and JWT_SECRET
docker compose up -d
```

Open `http://localhost:3100` → complete `/setup` → you become the **superuser** → invite your team from **Settings → Team**.

**Managed hosting:** one-click templates are provided for Railway, Fly.io, Render, DigitalOcean App Platform, and Dokku under [`deploy/`](./deploy/).

**Local development:** if you're hacking on BlueKiwi itself, use the dev compose stack with hot reload:

```bash
git clone https://github.com/dandacompany/bluekiwi.git
cd bluekiwi
bash scripts/dev.sh start
```

The dev stack runs sidecar containers: Next.js app on `3100`, PostgreSQL on `5433`, Redis on `6379`.

### 👩‍💻 For end-users (team members)

You've received an invite link or token from your team admin.

```bash
# From an invite URL shared via Slack/email
npx bluekiwi accept <token> --server https://your-team.bluekiwi.dev

# Or install the CLI globally first
npm install -g bluekiwi
bluekiwi accept <token> --server https://your-team.bluekiwi.dev
```

The CLI auto-detects Claude Code, Codex CLI, Gemini CLI, OpenCode, and OpenClaw, then installs the `/bk-start`, `/bk-next`, `/bk-status`, `/bk-rewind` slash commands into whichever runtimes you select. Verify with:

```bash
bluekiwi status
```

**SkillsMP alternative:** if you prefer skill-marketplace installation,

```bash
skills add dante-labs/bluekiwi-skills -g --copy -a claude-code
npx bluekiwi init  # configure server URL + API key
```

---

## How It Works

```
┌──────────────────┐    ┌─────────────────┐    ┌───────────────────┐    ┌────────────┐
│ User             │    │ Agent runtime   │    │ bluekiwi-mcp      │    │ BlueKiwi   │
│ /bk-start        │───▶│ runs skill      │───▶│ (REST client,     │───▶│ server     │
│ "research agent" │    │                 │    │  no DB access)    │    │ REST + UI  │
└──────────────────┘    └─────────────────┘    └───────────────────┘    └────────────┘
                                                                                │
┌───────────────────────────────────────────────────────────────────────────────┘
│ Browser monitors live progress via timeline view + structured outputs
▼
https://your-team.bluekiwi.dev/tasks/{id}
```

The agent calls MCP tools (`list_workflows`, `start_workflow`, `execute_step`, `advance`, `complete_task`…) which send authenticated HTTPS requests to the BlueKiwi REST API. The MCP client has **no database access** — all storage and RBAC is enforced by the server. Humans watch execution in real time from the web UI.

## Supported Agent Runtimes

| Runtime     | Slash commands                                      | Config file               |
| ----------- | --------------------------------------------------- | ------------------------- |
| Claude Code | `/bk-start`, `/bk-next`, `/bk-status`, `/bk-rewind` | `~/.claude/mcp.json`      |
| Codex CLI   | same                                                | `~/.codex/config.toml`    |
| Gemini CLI  | same                                                | `~/.gemini/settings.json` |
| OpenCode    | same                                                | `~/.opencode/mcp.json`    |
| OpenClaw    | same                                                | `~/.openclaw/mcp.json`    |

The `bluekiwi` CLI auto-detects which of these you have installed and only writes to the runtimes you confirm during `bluekiwi accept` or `bluekiwi init`.

---

## Features

### 🎨 Workflow Editor

- **Drag-and-drop** node reordering (@dnd-kit)
- **Cmd+K node picker** — search from saved instruction templates
- **Horizontal step minimap** — full pipeline at a glance
- **Version control** — every edit creates a new workflow version

### ⚡ Task Execution

- **Timeline view** — vertical progress bar with step-by-step status
- **Structured output** — separated panels for user input, thinking, and assistant response
- **Artifacts** — file attachments tracked per step
- **Comments** — threaded discussions on individual steps
- **Rewind & replay** — jump back to any step and re-run

### 🔐 Auth & RBAC

- **First-visitor setup** — no default credentials; first registered user becomes superuser
- **4-tier roles** — `superuser` > `admin` > `editor` > `viewer`
- **API keys** — `bk_` prefix, SHA-256 hashed, expiry + revocation
- **JWT sessions** — httpOnly cookies, 7-day expiry

### 🌐 Internationalization

- Built-in **Korean / English** translation with a context-based `t()` hook
- `localStorage`-persisted locale toggle in the user menu
- Easy to add more languages — just drop a JSON dictionary into `src/lib/i18n/`

### 🎯 Design System

- **BlueKiwi theme** — Royal Blue (#4169e1) + Kiwi Green (#b7cf57)
- **shadcn/ui** base with custom variants (rounded-full buttons, soft shadows, 1.5rem radii)
- **Inter font**, light/dark mode ready
- Full component guide in `ref/design-guide.html`

### 🔧 Developer Experience

- **`/dev` command** — `bash scripts/dev.sh {start|stop|logs|seed|reset|shell}`
- **Auto port detection** — no more "port in use" errors
- **Hot reload** — source mounted as volume in the app container
- **One-shot seed** — pre-populated test workflows for fast iteration

---

## Tech Stack

| Layer     | Technology                                                 |
| --------- | ---------------------------------------------------------- |
| Framework | [Next.js 16](https://nextjs.org) (App Router), React 19    |
| UI        | [shadcn/ui](https://ui.shadcn.com), Tailwind CSS 4, Lucide |
| Database  | PostgreSQL 16                                              |
| Cache     | Redis 7                                                    |
| Auth      | JWT via [jose](https://github.com/panva/jose), bcryptjs    |
| DnD       | [@dnd-kit/core](https://dndkit.com) + sortable             |
| Commands  | [cmdk](https://cmdk.paco.me) for Cmd+K palette             |
| Toast     | [sonner](https://sonner.emilkowal.ski)                     |
| Container | Docker Compose                                             |
| MCP       | Custom stdio server (16 tools)                             |

---

## API

### REST Endpoints

```
Auth
  POST   /api/auth/setup           # create first superuser
  POST   /api/auth/login           # returns JWT cookie
  POST   /api/auth/logout
  GET    /api/auth/me
  POST   /api/auth/change-password

Workflows
  GET    /api/workflows            # list (with nodes)
  POST   /api/workflows            # create (with nodes)
  GET    /api/workflows/:id
  PUT    /api/workflows/:id        # update (optionally create new version)
  DELETE /api/workflows/:id

Tasks
  GET    /api/tasks                # list active + completed
  POST   /api/tasks/start          # start a workflow → create task
  GET    /api/tasks/:id            # task + logs + artifacts
  POST   /api/tasks/:id/execute    # save current step result
  POST   /api/tasks/:id/advance    # move to next step
  POST   /api/tasks/:id/complete   # finalize task
  POST   /api/tasks/:id/heartbeat  # progress ping
  POST   /api/tasks/:id/rewind     # jump back to step N

Users & Keys
  GET    /api/users                # team list (admin+)
  POST   /api/users                # invite team member
  GET    /api/apikeys              # user's keys
  POST   /api/apikeys              # generate new key (bk_xxx)
  DELETE /api/apikeys/:id          # revoke
```

Full OpenAPI spec at **`/docs`** (Swagger UI).

### MCP Tools

```
list_workflows, start_workflow, execute_step, advance,
heartbeat, complete_task, rewind, get_web_response,
submit_visual, save_artifacts, load_artifacts,
get_comments, list_credentials,
create_workflow, update_workflow, delete_workflow
```

Run the MCP server:

```bash
cd mcp && npm run build && node dist/server.js --api-key bk_xxx
```

### E2E Test

```bash
export BLUEKIWI_API_URL=http://localhost:3100/api
bash scripts/e2e-workflow.sh <workflow_id>
```

---

## Commands

```bash
# Server lifecycle
bash scripts/dev.sh start      # spin up DB + Redis + app
bash scripts/dev.sh stop       # tear down
bash scripts/dev.sh restart
bash scripts/dev.sh status     # health check + ports

# Logs
bash scripts/dev.sh logs       # tail all services
bash scripts/dev.sh logs app   # app container only

# Data
bash scripts/dev.sh seed       # insert test workflows
bash scripts/dev.sh reset      # ⚠ wipe volumes (destructive)

# Troubleshooting
bash scripts/dev.sh build      # rebuild app container (after npm install)
bash scripts/dev.sh shell      # open a shell inside the app container
```

npm aliases: `npm run dev`, `npm run dev:stop`, `npm run dev:status`, `npm run dev:logs`, `npm run dev:seed`, `npm run dev:restart`.

---

## Environment Variables

| Variable       | Default                                                    | Purpose               |
| -------------- | ---------------------------------------------------------- | --------------------- |
| `DATABASE_URL` | `postgresql://bluekiwi:bluekiwi_dev_2026@db:5432/bluekiwi` | PostgreSQL            |
| `JWT_SECRET`   | `bluekiwi-dev-secret-change-in-production`                 | JWT signing key       |
| `APP_PORT`     | `3100`                                                     | Host port for Next.js |

> ⚠ **Production**: always override `JWT_SECRET` with a strong random value and use a dedicated DB password.

---

## Project Structure

```
blue-kiwi/
├── src/
│   ├── app/
│   │   ├── (auth)/          # login, setup, change-password
│   │   ├── (app)/           # dashboard, workflows, tasks, settings
│   │   └── api/             # REST endpoints
│   ├── components/
│   │   ├── ui/              # shadcn/ui base components
│   │   ├── layout/          # sidebar, top bar, app shell
│   │   ├── workflow-editor/ # DnD editor, minimap, node picker
│   │   ├── task/            # timeline, step detail
│   │   ├── dashboard/       # stat cards, active tasks, activity feed
│   │   ├── settings/        # profile, API keys, team tabs
│   │   └── shared/          # empty states, command palette
│   └── lib/
│       ├── db.ts            # PostgreSQL pool + query helpers
│       ├── auth.ts          # bcrypt, API keys, RBAC matrix
│       ├── session.ts       # JWT sign / verify
│       ├── i18n/            # ko + en translation dictionaries
│       └── node-type-config.ts
├── mcp/                     # MCP stdio server (16 tools)
├── docker/
│   ├── docker-compose.dev.yml  # DB + Redis + app (hot-reload)
│   ├── docker-compose.yml      # production stack
│   ├── Dockerfile.dev
│   ├── Dockerfile              # multi-stage production build
│   ├── init.sql                # schema: 13 tables
│   └── migrations/
├── scripts/
│   ├── dev.sh               # dev stack manager
│   ├── cli.ts               # user/apikey CLI
│   └── e2e-workflow.sh      # REST-based E2E runner
├── tests/                   # sprint integration tests
├── ref/                     # design guide + theme reference (gitignored)
└── public/                  # icons, favicon, OG image
```

---

## Database

13 tables — see `docker/init.sql`:

```
workflows           # workflow definitions (versioned)
workflow_nodes      # ordered nodes within a workflow
instructions        # reusable instruction templates
credentials         # encrypted API secrets
tasks               # execution instances
task_logs           # per-step structured outputs
task_artifacts      # file attachments
task_comments       # threaded discussion
users               # accounts with 4-tier roles
user_groups         # team groupings
user_group_members
api_keys            # bk_* tokens
workflow_evaluations # quality contracts
```

---

## Contributing

This project is a work in progress. Issues and PRs welcome.

- **Linting**: `npm run lint`
- **Build check**: `npm run build`
- **Integration tests**: `bash tests/sprint1-integration.sh`

---

## License

MIT — see [LICENSE](LICENSE).

Copyright © 2026 Dante Labs.

---

## Support

- YouTube: [@dante-labs](https://youtube.com/@dante-labs)
- Email: `dante@dante-labs.com`
- Buy Me a Coffee: `https://buymeacoffee.com/dante.labs`
