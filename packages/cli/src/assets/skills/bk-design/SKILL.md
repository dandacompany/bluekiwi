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
- schema and split token JSON (`color_tokens`, `typography_tokens`,
  `component_tokens`)
- guidelines markdown
- SKILL.md-compatible markdown
- component documents for React, pure HTML/CSS, Tailwind CSS, and shadcn/ui
  components
- assets such as CSS, templates, references, logos, or images

## Tool Map

- `list_design_systems` — find relevant systems.
- `get_design_system` — load metadata, active payload, and assets.
- `create_design_system` — create a new registry item.
- `update_design_system` — update metadata or active payload.
- `create_design_system_version` — publish a new active version.
- `add_design_system_asset` — attach a small text/base64 asset.
- `delete_design_system_asset` — remove obsolete source assets.
- `export_design_system` — export `json`, `skill`, or `design` format.

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

## Flow: Update a Design System

For small edits, call `update_design_system`.

For component edits, update the full `component_tokens` object. Treat the web
UI as a read-only viewer for component documents. Add/update/delete component
documents through MCP tools, not by expecting a visual editor in BlueKiwi.

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

`format: "design"` returns DESIGN.md documentation for agent lookup. Use
`format: "skill"` when the user specifically needs a portable SKILL.md.

## Safety

- Do not invent a registered design system. If lookup returns no match, say so.
- Do not expose raw API keys or credentials in design-system assets.
- Preserve existing tokens unless the user explicitly asks to replace them.
- Keep generated design rules concrete enough for another agent to apply.
