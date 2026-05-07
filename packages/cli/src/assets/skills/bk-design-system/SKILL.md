---
name: bk-design-system
description: Create, update, export, and apply BlueKiwi design systems from the registry through MCP tools. Use when the user says "/bk-design-system", asks to create a design system, apply a registered design system, export a design system skill, or update brand/design tokens in BlueKiwi.
user_invocable: true
---

# BlueKiwi Design System

Use BlueKiwi's design-system registry through MCP tools. Do not write directly
to the database or call raw HTTP APIs when MCP tools are available.

## Core Concepts

A BlueKiwi design system is a versioned registry resource containing:

- metadata: title, slug, description, status
- schema and tokens JSON
- guidelines markdown
- SKILL.md-compatible markdown
- assets such as CSS, templates, references, logos, or images

## Tool Map

- `list_design_systems` — find relevant systems.
- `get_design_system` — load metadata, active payload, and assets.
- `create_design_system` — create a new registry item.
- `update_design_system` — update metadata or active payload.
- `create_design_system_version` — publish a new active version.
- `add_design_system_asset` — attach a small text/base64 asset.
- `export_design_system` — export `json` or `skill` format.

## Flow: Use an Existing Design System

1. Call `list_design_systems`.
2. Select the most relevant system by user request, project name, or slug.
3. Call `get_design_system`.
4. Apply the loaded tokens and guidelines to the current work.
5. If the user requests portable output, call `export_design_system` with
   `format: "skill"`.

## Flow: Create a New Design System

Collect the minimum viable context:

- brand or product name
- audience and usage medium
- tone and design principles
- color direction
- typography direction
- component needs
- hard prohibitions

Then call `create_design_system` with:

```json
{
  "title": "Example Design System",
  "slug": "example-design-system",
  "description": "Short purpose statement",
  "schema": {
    "version": "1.0",
    "mediums": ["web", "slides", "docs"]
  },
  "tokens": {
    "color": {},
    "typography": {},
    "spacing": {},
    "components": {}
  },
  "guidelines_markdown": "## Principles\n...",
  "skill_markdown": "Use this design system when..."
}
```

## Flow: Update a Design System

For small edits, call `update_design_system`.

For a meaningful published revision, call `create_design_system_version` so the
previous active version remains in history.

Never overwrite a user's established design rules without first summarizing the
change and asking for confirmation.

## Flow: Add Assets

Use `add_design_system_asset` for small text assets:

- CSS: `kind="css"`, `mime_type="text/css"`, `content_text`
- template: `kind="template"`, `mime_type="text/plain"` or `text/html`
- reference: `kind="reference"`, `mime_type="text/markdown"`

Base64 assets are limited by the server and should be used sparingly.

## Flow: Export

Use:

```json
{
  "design_system_id": 123,
  "format": "skill"
}
```

The returned content is SKILL.md-compatible. Use it as the canonical portable
representation unless the user specifically asks for JSON.

## Safety

- Do not invent a registered design system. If lookup returns no match, say so.
- Do not expose raw API keys or credentials in design-system assets.
- Preserve existing tokens unless the user explicitly asks to replace them.
- Keep generated design rules concrete enough for another agent to apply.

