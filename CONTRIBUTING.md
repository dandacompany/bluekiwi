# Contributing to BlueKiwi

Thank you for your interest in BlueKiwi. This document covers everything you need to set up a local dev environment, understand the codebase, and submit changes.

---

## Dev Setup

### Prerequisites

- Node.js 22+
- Docker + Docker Compose

### Start the dev stack

```bash
git clone https://github.com/dandacompany/bluekiwi.git
cd bluekiwi
bash scripts/dev.sh start
```

The dev stack runs:

- **Next.js app** on `http://localhost:3100` (hot-reload, source mounted as volume)
- **PostgreSQL 16** on port `5433`
- **Redis 7** on port `6379`

### Dev commands

```bash
bash scripts/dev.sh start      # spin up DB + Redis + app
bash scripts/dev.sh stop       # tear down
bash scripts/dev.sh restart
bash scripts/dev.sh status     # health check + ports

bash scripts/dev.sh logs       # tail all services
bash scripts/dev.sh logs app   # app container only

bash scripts/dev.sh seed       # insert test workflows
bash scripts/dev.sh reset      # ⚠ wipe volumes (destructive)
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
| `PUBLIC_URL`   | `http://localhost:3100`                                    | Used in invite URLs   |

> ⚠ **Production**: always override `JWT_SECRET` with a strong random value (`openssl rand -hex 32`) and use a dedicated `DB_PASSWORD`.

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
├── packages/
│   └── cli/                 # bluekiwi npm CLI package
├── docker/
│   ├── docker-compose.dev.yml   # DB + Redis + app (hot-reload)
│   ├── docker-compose.yml       # production stack
│   ├── Dockerfile.dev
│   ├── Dockerfile               # multi-stage production build
│   └── migrations/              # versioned SQL, applied by scripts/migrate.js
├── scripts/
│   ├── dev.sh               # dev stack manager
│   ├── e2e-oss.sh           # full E2E test runner (S1–S6)
│   ├── bk-release.sh        # release validation harness
│   └── tmux-init.sh         # tmux session setup with MCP verification
├── tests/                   # integration tests (vitest)
├── ref/                     # design guide + theme reference (gitignored)
└── public/                  # icons, favicon, OG image
```

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

## Database

18 tables — see `docker/migrations/` (applied in order by `scripts/migrate.js`):

```
workflows             # workflow definitions (versioned)
workflow_nodes        # ordered nodes within a workflow
instructions          # reusable instruction templates
credentials           # encrypted API secrets
tasks                 # execution instances
task_logs             # per-step structured outputs
task_artifacts        # file attachments
task_comments         # threaded discussion
users                 # accounts with 4-tier roles
user_groups           # team groupings
user_group_members
api_keys              # bk_* tokens (SHA-256 hashed)
invites               # invite tokens
folders               # workspace folder hierarchy
folder_shares         # folder access grants
workflow_evaluations  # quality contracts
sessions              # active JWT sessions
audit_log             # admin audit trail
```

---

## REST API Reference

Full OpenAPI spec at **`/docs`** (Swagger UI) on your running server.

```
Auth
  POST   /api/auth/setup           # create first superuser
  POST   /api/auth/login           # returns JWT cookie
  POST   /api/auth/logout
  GET    /api/auth/me
  POST   /api/auth/change-password

Workflows
  GET    /api/workflows            # list (with nodes)
  POST   /api/workflows            # create
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

---

## Tests

```bash
# Unit + integration tests (vitest)
npm test

# Full E2E against a running server
export BLUEKIWI_API_URL=http://localhost:3100
bash scripts/e2e-oss.sh

# Lint
npm run lint
```

---

## Design System

- **Theme**: Royal Blue (`#4169e1`) + Kiwi Green (`#b7cf57`)
- **Base**: shadcn/ui with custom variants (rounded-full buttons, soft shadows, 1.5rem radii)
- **Font**: Inter
- **Modes**: light/dark ready
- Full component guide: `ref/design-guide.html` (gitignored; run dev stack to generate)

### Adding a new locale

1. Create `src/lib/i18n/<locale>.json` (copy `ko.json` as a template)
2. Add the locale key to `src/lib/i18n/index.ts`
3. The locale toggle in the user menu will pick it up automatically

---

## Submitting Changes

1. Fork the repo and create a branch from `main`
2. Make your changes with tests where applicable
3. Run `npm run lint && npm test` — both must pass
4. Open a PR against `main` with a clear description

Issues and PRs are welcome. For large changes, open an issue first to discuss the approach.
