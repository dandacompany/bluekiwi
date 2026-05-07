# BlueKiwi Design System Registry Design

Date: 2026-05-07
Status: Approved for implementation planning

## 1. Overview

BlueKiwi currently turns reusable agent instructions into guided workflow chains.
The next product step is to let teams create, store, update, export, and reuse
design systems from the same BlueKiwi registry.

The feature adds a dedicated DesignSystem resource rather than overloading
existing instructions. A design system can contain structured tokens,
guidelines, generated skill instructions, and supporting assets. Agents consume
it through BlueKiwi MCP tools and a bundled `bk-design-system` skill. Humans can
manage it through a minimal web UI, and a seed workflow can guide creation of a
new design system.

MVP success criteria:

- Store design systems as first-class, versioned registry resources.
- Support text/tokens plus file assets such as CSS, templates, references, and
  small images.
- Provide REST API and MCP tools for list/get/create/update/version/asset/export.
- Add dedicated authorization permissions for design systems.
- Add a bundled `bk-design-system` skill for agent runtimes.
- Provide minimal web UI for list/detail/edit/export.
- Seed a "Design System Creation" workflow.

## 2. Architecture

### Main Components

- Database tables
  - `design_systems`: registry identity, ownership, folder placement,
    version-family metadata, active state, and status.
  - `design_system_versions`: structured schema, tokens, guidelines, skill
    markdown, and export manifest for a specific design-system version.
  - `design_system_assets`: files or file-like records attached to a design
    system version.
- Repository layer
  - Mirrors existing workflow/instruction repository style.
  - Normalizes booleans and timestamps across SQLite/PostgreSQL.
  - Builds export payloads from system, active version, and assets.
- REST API
  - Exposes resource management to UI and MCP server.
  - Uses `withAuth` and dedicated design-system permissions.
- MCP server
  - Adds tools that directly operate on the registry resource.
  - Keeps raw database details hidden from agents.
- CLI runtime assets
  - Adds `bk-design-system` to bundled skills.
  - Existing runtime sync installs it into supported agents.
- Web UI
  - Adds a registry page for list/create.
  - Adds a detail page for metadata, tokens, guidelines, skill markdown, assets,
    and export.
- Seed workflow
  - Guides an agent through designing a new system and saving it to the registry.

### Data Model

`design_systems`

```text
id
title
slug
description
owner_id
folder_id
visibility_override
family_root_id
parent_design_system_id
version
is_active
status
created_at
updated_at
```

`design_systems` is the versioned registry resource row, following the existing
workflow version-family pattern. A new published version creates a new
`design_systems` row in the same family, deactivates its active sibling, and gets
its own content payload row.

`design_system_versions`

```text
id
design_system_id
schema_json
tokens_json
guidelines_markdown
skill_markdown
export_manifest_json
created_at
updated_at
```

`design_system_versions` is the content payload for one `design_systems` row.
Despite the name, it is not a separate version-family table. In the MVP the
relationship is one-to-one: one `design_systems` row has one active payload row.
The name leaves room for future draft/history support without changing the
public resource table.

`design_system_assets`

```text
id
design_system_id
version_id
kind
filename
mime_type
content_text
content_base64
size_bytes
created_at
updated_at
```

Assets attach to a payload row through `version_id`, and also store
`design_system_id` for simple filtering and cleanup.

The version-family fields intentionally follow the workflow model. The current
MVP only needs active-version behavior; fork/remix/marketplace behavior can build
on the same shape later.

### Data Flow

Creation flow:

```text
UI/Agent
  -> POST /api/design-systems
  -> create design_systems row
  -> create initial design_system_versions row
  -> optional asset rows
  -> return registry resource
```

Update flow:

```text
UI/Agent
  -> PATCH /api/design-systems/:id
  -> update resource metadata and/or active version content
  -> return refreshed detail payload
```

New version flow:

```text
UI/Agent
  -> POST /api/design-systems/:id/versions
  -> copy metadata from source design_systems row
  -> insert a new design_systems row in the same family
  -> insert a new one-to-one design_system_versions payload row
  -> copy or replace assets according to request payload
  -> deactivate previous active sibling in the family
  -> return new active design system detail
```

Export flow:

```text
UI/Agent
  -> GET /api/design-systems/:id/export?format=json|skill
  -> load active design system, version, assets
  -> normalize export manifest
  -> return JSON payload or SKILL.md-compatible markdown package text
```

## 3. API and Interfaces

### REST API

```text
GET    /api/design-systems
POST   /api/design-systems
GET    /api/design-systems/:id
PATCH  /api/design-systems/:id
POST   /api/design-systems/:id/versions
POST   /api/design-systems/:id/assets
GET    /api/design-systems/:id/export?format=skill|json
```

`zip` is a future format. The MVP should stabilize `json` and `skill` first to
avoid premature binary streaming and download complexity.

### MCP Tools

```text
list_design_systems
get_design_system
create_design_system
update_design_system
create_design_system_version
add_design_system_asset
export_design_system
```

MCP tools call the REST API through the existing MCP API client. Tool schemas
should accept structured JSON strings for complex fields where MCP schema support
is limited, and the server should validate those fields before writing.

### Authorization

Add dedicated permissions:

```text
design_systems:read
design_systems:create
design_systems:update
```

MVP excludes delete. If delete is added later, use:

```text
design_systems:delete
```

Role mapping should follow the existing pattern:

```text
design_systems:read   -> viewer
design_systems:create -> editor
design_systems:update -> editor
```

Ownership and folder visibility should reuse the existing resource authorization
helpers where possible.

### Web UI

Routes:

```text
/design-systems
/design-systems/:id
```

MVP UI scope:

- List design systems.
- Create a design system.
- View/edit metadata.
- Edit tokens JSON.
- Edit guidelines markdown.
- Edit skill markdown.
- List/add text assets.
- Export as JSON or skill package text.

The MVP is not a full visual design editor.

### Bundled Skill

Add `bk-design-system`.

Responsibilities:

- Find relevant design systems in the BlueKiwi registry.
- Create or update a design system from project/brand context.
- Export registry content into an agent-usable skill package shape.
- Apply selected design-system rules during app/UI/content generation.

## 4. Error Handling

Validation errors:

- Missing title or invalid slug returns 400.
- Invalid JSON fields return 400 with a field-specific message.
- Unsupported asset kind returns 400.
- Unsupported export format returns 400.

Authorization errors:

- Unauthenticated requests return the existing auth failure response.
- Missing design-system permission returns 403.
- Requests for inaccessible folder-owned resources return 404 or 403 according
  to existing project convention.

Version errors:

- Updating an inactive design system version should be blocked unless the API
  explicitly targets metadata that is safe to edit.
- Creating a new version from a missing source returns 404.
- Duplicate slug within an owner/folder scope returns 409 for a new family. New
  versions reuse the source family slug.

Asset errors:

- Empty filename or MIME type returns 400.
- Asset content must be either `content_text` or `content_base64`, not both.
- MVP enforces a 256 KB limit for base64 assets and leaves larger binaries to a
  future object-storage or ZIP implementation.
- Large binary package export is out of scope until ZIP support is implemented.

MCP errors:

- MCP tools should return concise, actionable errors.
- Do not expose raw stack traces through MCP.
- If JSON string parsing fails, point to the bad argument name.

## 5. Test Strategy

Repository/API:

- Migration creates all design-system tables in SQLite and PostgreSQL paths.
- `createDesignSystem` creates resource and initial version.
- `listDesignSystems` respects ownership and folder visibility filters.
- `getDesignSystem` returns metadata, active version, and assets.
- `updateDesignSystem` updates metadata and editable active-version fields.
- `createDesignSystemVersion` preserves previous version and activates new one.
- `addDesignSystemAsset` validates kind/content/size and returns the asset.
- `exportDesignSystem(json)` returns stable manifest shape.
- `exportDesignSystem(skill)` returns SKILL.md-compatible markdown.

Authorization:

- Viewer can read accessible design systems.
- Editor can create/update.
- Users without access cannot read/update.

MCP:

- Tool names and schemas are registered.
- MCP client maps each tool to the expected REST route.
- Create/update/export tools parse structured JSON arguments correctly.

UI:

- List page renders existing systems.
- Create/edit forms submit valid payloads.
- Export buttons call expected API routes.

CLI/skill:

- `bk-design-system` is included in bundled skills.
- Runtime sync installs the new bundled skill without pruning user skills.

Seed workflow:

- Seed data includes the "Design System Creation" workflow.
- Workflow steps cover context, principles, tokens, guidelines, skill markdown,
  assets, registry save, and export review.

## 6. Implementation Slices

1. Add DB schema, auth permissions, TypeScript types, and repository helpers.
2. Add REST API routes for CRUD, version, asset, and export.
3. Add MCP tools and API-client methods.
4. Add bundled `bk-design-system` skill.
5. Add minimal UI pages and sidebar entry.
6. Add seed workflow.
7. Add tests and documentation updates.
