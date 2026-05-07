# BlueKiwi Design System Registry Implementation Plan

Date: 2026-05-07
Spec: `docs/bluekiwi/specs/2026-05-07-design-system-registry-design.md`
Status: Ready for implementation

## MVP Boundary

Included:

- DB schema for design systems, payload rows, and assets.
- Dedicated permissions: `design_systems:read`, `design_systems:create`,
  `design_systems:update`.
- Repository helpers and REST API routes.
- MCP tools for list/get/create/update/version/asset/export.
- Bundled `bk-design-system` skill.
- Minimal web UI for list/detail/create/edit/export.
- Seed workflow for creating a design system.
- Tests for repository/API/export/MCP wiring where practical.

Deferred:

- ZIP export.
- Large binary object storage.
- Visual design editor.
- Delete/archive UI.
- Public marketplace distribution.

## Dependency Map

```text
Phase 0 Baseline
  -> Phase 1 DB/Auth/Types
    -> Phase 2 Repository
      -> Phase 3 REST API
        -> Phase 4 MCP Tools
        -> Phase 5 Web UI
      -> Phase 6 Bundled Skill
      -> Phase 7 Seed Workflow
        -> Phase 8 Tests/Docs
```

Parallelizable after Phase 3:

- Phase 4 MCP tools
- Phase 5 Web UI
- Phase 6 bundled skill
- Phase 7 seed workflow

## Phase 0 — Baseline

### Work

- Confirm current tests/build status before edits.
- Identify existing DB migration registration patterns for SQLite/PostgreSQL.
- Confirm current API route style and MCP API-client style.

### Files

- `package.json`
- `src/lib/db/migrations/sqlite/index.ts`
- `src/lib/db/migrations/postgres/index.ts`
- `mcp/src/server.ts`
- `mcp/src/api-client.ts`

### Dependencies

- None.

### Verification

```bash
npm test -- --runInBand
npm run lint
```

If the full baseline is too slow, record that and run targeted tests after each
implementation slice.

## Phase 1 — DB, Auth, Types

### Work

- Add migrations for:
  - `design_systems`
  - `design_system_versions`
  - `design_system_assets`
- Add foreign keys for owner, folder, parent/family, and payload/assets.
- Add TypeScript DB/resource types.
- Add auth permission constants and role mappings:
  - `design_systems:read`
  - `design_systems:create`
  - `design_systems:update`

### Files

- `src/lib/db/migrations/sqlite/sql/013_design_systems.sql`
- `src/lib/db/migrations/sqlite/index.ts`
- `src/lib/db/migrations/postgres/index.ts`
- `docker/migrations/013_design_systems.sql`
- `src/lib/db.ts`
- `src/lib/auth.ts`

### Dependencies

- Phase 0.

### Verification

- Migration file is registered in both runtime paths.
- TypeScript compiles after adding types.
- Auth permission map contains the new permissions.

## Phase 2 — Repository and Export Helpers

### Work

- Add repository functions:
  - `listDesignSystemsForVisibilityFilter`
  - `createDesignSystem`
  - `findDesignSystemById`
  - `updateDesignSystem`
  - `createDesignSystemVersion`
  - `addDesignSystemAsset`
  - `exportDesignSystem`
- Normalize JSON text fields and timestamps.
- Enforce MVP validation:
  - title required
  - slug format
  - supported asset kind
  - exactly one of `content_text` or `content_base64`
  - base64 limit 256 KB
- Generate `json` and `skill` export payloads.

### Files

- `src/lib/db/repositories/design-systems.ts`
- `src/lib/design-system-export.ts` or repository-local helper
- `tests/design-systems.test.ts`

### Dependencies

- Phase 1.

### Verification

```bash
npx vitest run tests/design-systems.test.ts
```

## Phase 3 — REST API

### Work

- Add routes:
  - `GET /api/design-systems`
  - `POST /api/design-systems`
  - `GET /api/design-systems/:id`
  - `PATCH /api/design-systems/:id`
  - `POST /api/design-systems/:id/versions`
  - `POST /api/design-systems/:id/assets`
  - `GET /api/design-systems/:id/export`
- Use `withAuth` and dedicated permissions.
- Use existing authorization helpers for owned/folder-visible resources.
- Return consistent JSON error responses.

### Files

- `src/app/api/design-systems/route.ts`
- `src/app/api/design-systems/[id]/route.ts`
- `src/app/api/design-systems/[id]/versions/route.ts`
- `src/app/api/design-systems/[id]/assets/route.ts`
- `src/app/api/design-systems/[id]/export/route.ts`
- `tests/api/design-systems.test.ts`

### Dependencies

- Phase 2.

### Verification

```bash
npx vitest run tests/api/design-systems.test.ts
```

## Phase 4 — MCP Tools

### Work

- Add API-client methods for design-system routes.
- Register MCP tool schemas:
  - `list_design_systems`
  - `get_design_system`
  - `create_design_system`
  - `update_design_system`
  - `create_design_system_version`
  - `add_design_system_asset`
  - `export_design_system`
- Parse JSON-string arguments for tokens/schema/manifest/assets.
- Keep MCP errors concise and actionable.

### Files

- `mcp/src/api-client.ts`
- `mcp/src/server.ts`
- `mcp/tests/design-systems.test.ts` if MCP tests exist or are easy to add.

### Dependencies

- Phase 3.

### Verification

```bash
cd mcp && npm test
cd mcp && npm run build
```

## Phase 5 — Minimal Web UI

### Work

- Add sidebar/nav entry for Design Systems.
- Add list page with empty state and create form/dialog.
- Add detail page with editable metadata, tokens JSON, guidelines markdown,
  skill markdown, asset list/add, and export buttons.
- Use existing UI primitives and list-fetch patterns.

### Files

- `src/app/(app)/design-systems/page.tsx`
- `src/app/(app)/design-systems/[id]/page.tsx`
- `src/components/design-systems/design-system-list.tsx`
- `src/components/design-systems/design-system-detail.tsx`
- `src/components/layout/sidebar.tsx`
- `src/lib/i18n/en.json`
- `src/lib/i18n/ko.json`

### Dependencies

- Phase 3.

### Verification

```bash
npm run lint
npm run build
```

Manual smoke:

- Open `/design-systems`.
- Create a design system.
- Edit detail fields.
- Export JSON and skill.

## Phase 6 — Bundled Skill

### Work

- Add bundled `bk-design-system` skill.
- Teach the skill to use MCP tools, never raw API calls.
- Include flows for:
  - using an existing design system
  - creating a new draft
  - updating a registry item
  - exporting a skill package

### Files

- `packages/cli/src/assets/skills/bk-design-system/SKILL.md`
- `packages/cli/src/assets/index.ts`
- `packages/cli/tests/skills-helper.test.ts`

### Dependencies

- Phase 3 for API/MCP concepts.
- Can be authored in parallel with Phase 4.

### Verification

```bash
npm --workspace packages/cli test
npm --workspace packages/cli run build
```

## Phase 7 — Seed Workflow

### Work

- Add a seed workflow for "Design System Creation".
- Steps:
  1. Brand/product context
  2. Design principles
  3. Tokens
  4. Usage/prohibition guidelines
  5. Skill markdown
  6. Assets/CSS/templates
  7. Registry save
  8. Export review
- Ensure instructions point agents to MCP tools rather than direct DB writes.

### Files

- `src/lib/seed-workflows.ts`
- Optional seed payload under `docker/seed-workflows/`

### Dependencies

- Phase 3.

### Verification

- Seed function compiles.
- Local seed can create the workflow without duplicate-key errors.

## Phase 8 — Final Verification and Docs

### Work

- Run targeted and broad tests.
- Update README/README.ko if user-facing commands changed.
- Run a basic UI smoke test if dev server is available.
- Record remaining future work.

### Files

- `README.md`
- `README.ko.md`
- `docs/bluekiwi/specs/2026-05-07-design-system-registry-design.md`

### Dependencies

- Phases 1-7.

### Verification

```bash
npm run lint
npm run build
npm test
cd mcp && npm run build
```

## First Implementation Slice

The first slice should implement Phases 1-3 plus the JSON/skill export helpers.
That creates the product backbone and lets MCP/UI/skill work proceed against a
real contract.

