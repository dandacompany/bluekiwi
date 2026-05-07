---
name: bk-design
description: Create, update, export, and apply BlueKiwi design systems from the registry through MCP tools. Use when the user says "/bk-design", asks to create a design system, apply a registered design system, export a design system skill, or update brand/design tokens in BlueKiwi.
user_invocable: true
---

# BlueKiwi Design System

Use BlueKiwi's design-system registry through MCP tools. Do not write directly
to the database or call raw HTTP APIs when MCP tools are available.

## Core Concepts

A BlueKiwi design system is a versioned registry resource containing:

- metadata: title, slug, description, status
- taxonomy metadata: category and surface (`web`, `slides`, `docs`, `image`,
  `video`, or `audio`)
- schema and split token JSON (`color_tokens`, `typography_tokens`,
  `component_tokens`)
- guidelines markdown
- SKILL.md-compatible markdown
- component documents for React, pure HTML/CSS, Tailwind CSS, and shadcn/ui
  components
- assets such as CSS, templates, references, logos, or images

## Required Interaction Gate

If the user invokes `bk-design` without explicitly saying what operation they
want, ask an `AskUserQuestion` before using mutation tools. The first question
must classify the intent:

- create a design system
- update a design system
- delete a design system
- load or export a design system

Use `AskUserQuestion` for selection and confirmation steps whenever the next
action would create, update, or delete registry data. Do not infer destructive
intent from vague wording.

### Design Depth Gate

Before creating or materially updating design tokens, typography, or
components, ask whether the user wants a LoFi or HiFi design-system process.

- LoFi: create a practical, lightweight token/component set from the user's
  stated requirements. Keep the questionnaire short and optimize for speed.
- HiFi: run a richer design exploration before writing registry data. Read
  `references/hifi-design-playbook.md` and `references/craft-rules.md` first.
  Use them as the local basis for recommendations, auto-generation, quality
  checks, and feedback loops.

For HiFi, show at least three recommended design directions before generation.
Each recommendation should include:

- visual concept and product fit
- color palette direction
- typography direction
- component style direction
- tradeoffs or constraints

Always allow a custom user request as an option alongside recommendations.

If the user asks you to proceed automatically, select the strongest direction
from `references/hifi-design-playbook.md` based on the user's product context,
state the assumptions, generate the complete design-system draft, summarize the
result by category, and ask for feedback before writing registry mutations.

### Generation Mode Gate

After the user chooses LoFi or HiFi, ask how to generate the design system:

- guided loop: ask category-by-category questions, then create tokens,
  typography, and components from explicit user direction
- automatic draft: generate the whole initial design system automatically, then
  ask for feedback and revise in follow-up loops

For guided loops, ask what component families to include before generating
component specs. Offer a practical checklist such as:

- foundations: colors, typography, spacing, radius, shadows, motion
- controls: button, input, textarea, checkbox, radio, switch, select, slider
- navigation: tabs, breadcrumb, menu, sidebar, pagination
- feedback: alert, toast, badge, progress, skeleton
- layout/data: card, table, dialog, drawer, accordion, tooltip, popover
- domain-specific components requested by the user

For automatic drafts, generate a complete first pass, summarize the design
system by category, then ask for feedback before final registry mutation.

### Create Gate

For create intent:

1. Call `list_design_systems` first.
2. If an existing design system appears related by product, brand, slug, or
   domain, ask whether to create a new version of that system or create a
   separate new design system.
3. If the user chooses versioning, use `create_design_system_version`.
4. If the user chooses a separate system, use `create_design_system`.
5. Run the Design Depth Gate and Generation Mode Gate before creating tokens,
   typography, or component documents.

### Update Gate

For update intent:

1. Call `list_design_systems`.
2. Ask the user to choose the design system to update from the list.
3. Ask whether to update the whole design system or a specific design category.
4. If category-level, offer categories such as colors, typography/fonts,
   components, guidelines, skill, schema, tokens, or assets.
5. Show the relevant list or current section value, then ask the user to
   confirm the target before applying changes.
6. Use section or component tools for scoped changes. Use full
   `update_design_system` only for metadata or intentional whole-payload edits.
7. If the update changes tokens, typography, or components materially, run the
   Design Depth Gate and Generation Mode Gate before applying the update.

### Delete Gate

For delete intent:

1. Call `list_design_systems`.
2. Ask the user to choose the design system to delete.
3. Ask whether to delete only the selected version, the full version family, a
   single component, or a single asset.
4. Confirm the selected target before calling any delete tool.

## Tool Map

- `list_design_systems` — find relevant systems.
- `get_design_system` — load metadata, active payload, and assets.
- `get_active_design_system` — load the current user's active design-system
  context.
- `set_active_design_system` — pin a visible system as the active context.
- `clear_active_design_system` — clear the active context.
- MCP resources — read-heavy lookups expose `bk://design-systems/<id>/DESIGN.md`
  and `bk://active/design-system/DESIGN.md` when the client supports resources.
  Prefer these resources for applying an existing design system to generation
  work.
- `create_design_system` — create a new registry item.
- `seed_design_systems` — seed the built-in BlueKiwi design-system library into
  the current user's `[Design Seeds]` folder. Use it when the registry is empty
  or the user asks for starter/reference systems.
- `update_design_system` — update metadata or active payload.
- `create_design_system_version` — publish a new active version.
- `delete_design_system` — delete one version or a full version family.
- `get_design_system_section` — load one category such as colors,
  typography, components, guidelines, skill, or assets.
- `update_design_system_section` — replace or shallow-merge one category.
- `delete_design_system_section` — clear one category.
- `get_design_system_section_entry` — load one keyed token/spec from an
  object category.
- `upsert_design_system_section_entry` — create or replace one keyed
  token/spec inside a category.
- `delete_design_system_section_entry` — delete one keyed token/spec.
- `get_design_component` — load one component by name with normalized docs.
- `upsert_design_component` — create or replace one component spec by name.
- `delete_design_component` — delete one component spec by name.
- `lint_design_system` — run deterministic checks for token coverage, contrast,
  component states, shadcn/Tailwind metadata, and agent-readability gaps.
- `add_design_system_asset` — attach a small text/base64 asset.
- `delete_design_system_asset` — remove obsolete source assets.
- `export_design_system` — export `json`, `skill`, `design`, or `bundle`
  format. `bundle` returns `DESIGN.md`, `SKILL.md`, split token files,
  component docs, text assets, and lint results in one payload.

## Flow: Use an Existing Design System

1. Call `get_active_design_system` first when the user asks to "use the design
   system" without naming one. If active exists, confirm whether to use it.
2. Call `list_design_systems`.
3. If the list is empty and the user wants recommendations or starter systems,
   ask whether to seed the built-in library. If approved, call
   `seed_design_systems`, then call `list_design_systems` again.
4. Select the most relevant system by user request, project name, category,
   surface, or slug.
5. Ask whether to set the chosen system as active if it will guide follow-up
   work. If approved, call `set_active_design_system`.
6. Call `get_design_system`, or read `bk://active/design-system/DESIGN.md` when
   the active context is already set and MCP resources are available.
7. Apply the loaded tokens and guidelines to the current work.
8. If the user requests portable output, call `export_design_system` with
   `format: "skill"`.

## Flow: Create a New Design System

Collect the minimum viable context:

- brand or product name
- audience and usage medium
- category and surface
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
  "category": "Education",
  "surface": "web",
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
  "color_tokens": {},
  "typography_tokens": {},
  "component_tokens": {
    "LessonCard": {
      "framework": "shadcn",
      "style_system": "shadcn/ui + Tailwind CSS",
      "description": "Compact lesson module card.",
      "dependencies": ["@radix-ui/react-slot", "class-variance-authority"],
      "install": ["npx shadcn@latest add card button"],
      "props": [
        {
          "name": "title",
          "type": "string",
          "description": "Lesson title"
        }
      ],
      "variants": ["default", "active"],
      "states": ["default", "hover", "focus-visible", "disabled", "loading"],
      "tailwind": {
        "classes": ["rounded-lg", "border", "bg-card", "text-card-foreground"],
        "theme_tokens": ["--card", "--card-foreground"]
      },
      "shadcn": {
        "registry_items": ["card", "button"],
        "dependencies": ["lucide-react"]
      },
      "preview": {
        "html": "<article class=\"lesson-card\"><h3>Prompt Design</h3></article>",
        "css": ".lesson-card{border:1px solid #D8CCB8;padding:16px}"
      },
      "source": {
        "react": "export function LessonCard({ title }) { return <article>{title}</article>; }"
      },
      "usage": "Use inside workshop outlines and curriculum dashboards.",
      "assets": ["LessonCard.tsx", "lesson-card.css"]
    }
  },
  "guidelines_markdown": "## Principles\n...",
  "skill_markdown": "Use this design system when..."
}
```

## Flow: Load by Category

Prefer category tools when the user asks for a specific part of a design
system:

- colors or palette: `get_design_system_section` with `section: "colors"`
- fonts or typography: `get_design_system_section` with
  `section: "typography"`
- components: `get_design_system_section` with `section: "components"`
- one component: `get_design_component` with the component `name`
- guidelines: `get_design_system_section` with `section: "guidelines"`
- portable agent docs: `export_design_system` with `format: "design"`

## Flow: Update a Design System

For metadata edits, call `update_design_system`.

For category edits, do not send the full design-system payload unless the user
explicitly asks to replace everything:

- Add or update a color: `upsert_design_system_section_entry` with
  `section: "colors"` and the token name as `key`.
- Add or update a typography role: `upsert_design_system_section_entry` with
  `section: "typography"`.
- Add or update multiple colors/fonts/components at once:
  `update_design_system_section` with `mode: "merge"`.
- Replace a full category intentionally: `update_design_system_section` with
  `mode: "replace"` after summarizing the impact.
- Clear a category: `delete_design_system_section`.
- Delete one token/spec: `delete_design_system_section_entry`.

For component edits, use `get_design_component`, `upsert_design_component`,
and `delete_design_component`. Treat the web UI as a read-only viewer for
component documents. Add/update/delete component documents through MCP tools,
not by expecting a visual editor in BlueKiwi.

Before finalizing a HiFi system or a substantial update, call
`lint_design_system`. Resolve `error` issues before presenting the result as
ready. Summarize `warning` issues and ask whether to fix them now or leave them
as intentional tradeoffs.

For Tailwind or shadcn/ui components, include enough integration metadata for
another agent to copy the component into a target project:

- `framework`: `tailwind` or `shadcn`
- `style_system`: for example `Tailwind CSS` or `shadcn/ui + Tailwind CSS`
- `dependencies`: npm packages required by the component
- `install`: commands such as `npx shadcn@latest add button card`
- `tailwind`: class names, plugins, content paths, theme tokens, config notes
- `shadcn`: registry items, style, base color, aliases, Radix/Base UI choice
- `preview.html` and `preview.css`: static browser preview for BlueKiwi viewer
- `source.react`: TSX source to copy into the application

For a meaningful published revision, call `create_design_system_version` so the
previous active version remains in history.

Never overwrite a user's established design rules without first summarizing the
change and asking for confirmation.

## Flow: Delete

Use `delete_design_system` only when the user explicitly asks to remove a
design system.

- Delete the current version only: `family: false` or omit `family`.
- Delete all versions in the family: `family: true`.
- Delete assets separately with `delete_design_system_asset`.
- Delete a single component with `delete_design_component`.

## Flow: Add Assets

Use `add_design_system_asset` for small text assets:

- CSS: `kind="css"`, `mime_type="text/css"`, `content_text`
- React source: `kind="template"`, `mime_type="text/tsx"` or `text/jsx`
- HTML component: `kind="template"`, `mime_type="text/html"`
- Tailwind config/docs: `kind="reference"`, `mime_type="application/json"` or
  `text/markdown`
- shadcn source or registry notes: `kind="template"` or `kind="reference"`
- reference: `kind="reference"`, `mime_type="text/markdown"`

Base64 assets are limited by the server and should be used sparingly.
Use `delete_design_system_asset` to remove stale component source files.

## Flow: Export

Use:

```json
{
  "design_system_id": 123,
  "format": "design"
}
```

`format: "design"` returns DESIGN.md documentation for agent lookup. If MCP
resources are available, read `bk://design-systems/<id>/DESIGN.md` for the same
agent-facing view without invoking extra mutation-capable tools. Use
`format: "skill"` when the user specifically needs a portable SKILL.md. Use
`format: "bundle"` when another agent needs the whole system in one response.

## Safety

- Do not invent a registered design system. If lookup returns no match, say so.
- Do not expose raw API keys or credentials in design-system assets.
- Preserve existing tokens unless the user explicitly asks to replace them.
- Keep generated design rules concrete enough for another agent to apply.
