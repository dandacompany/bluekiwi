# BlueKiwi HiFi Design Playbook

This is BlueKiwi's own design-system recommendation guide. Use it when a user
asks for a HiFi design system, gives vague visual direction, asks for automatic
generation, or cannot decide which tokens, fonts, or components should be
created.

The goal is not to copy another design style. The goal is to create a coherent
registry-ready system that another agent can load, understand, and apply
without re-interviewing the user.

## Design Stance

BlueKiwi design systems should be:

- semantic: tokens are named by role and behavior, not just color appearance
- useful: every component includes states, usage notes, and implementation hints
- inspectable: exports should read like `DESIGN.md`, not a raw dump of JSON
- adaptable: support React, plain HTML/CSS, Tailwind CSS, and shadcn/ui
- grounded: visual decisions should match product type, audience, and workflow
- editable by agents: small category-level updates should be possible without
  replacing the whole system

## When the User Is Vague

Do not ask a long survey first. Infer what you can, state assumptions, then
offer three or more concrete directions.

Ask only for missing information that would materially change the system:

- product or brand name
- primary medium: app, website, docs, slides, course, community, internal tool
- audience: operators, students, developers, consumers, executives, creators
- implementation target: React, HTML/CSS, Tailwind CSS, shadcn/ui
- density: airy, balanced, dense
- risk level: conservative, distinct, expressive
- required or forbidden brand constraints

If the user says "자동으로", "알아서", "추천해서", or equivalent, select the
best direction yourself, explain the assumptions, generate a full draft, and ask
for feedback before writing to the registry.

## Recommendation Contract

For HiFi work, present at least three options plus custom input:

```markdown
## Recommended Design Directions

### A. [Direction Name]
- Fit: [why this matches the product]
- Palette: [role names and hex values]
- Type: [font choices by role]
- Components: [component style and coverage]
- Layout/Motion: [density, grid, interaction behavior]
- Safe choices: [category conventions preserved]
- Risks: [where the system becomes memorable, with tradeoffs]

### B. ...
### C. ...

### Custom
Describe a reference product, mood, color, font, or constraint.
```

The recommendations should be opinionated. Avoid "it depends" unless a real
constraint is missing.

## BlueKiwi Direction Matrix

Use these directions as native BlueKiwi archetypes. Mix them only when the
product needs a hybrid.

### 1. Operator Console

For admin tools, CRM, workflow systems, registries, and internal software.

- Mood: quiet, precise, durable, low-distraction
- Density: balanced to dense
- Palette: Canvas `#F8FAFC`, Surface `#FFFFFF`, Ink `#18181B`,
  Muted `#71717A`, Line `#E4E4E7`, Accent `#2563EB` or `#0F766E`
- Type: Geist or Source Sans 3 for UI, JetBrains Mono for IDs and metrics
- Shape: 6px controls, 8px cards, crisp borders
- Components: button, input, select, checkbox, switch, table, tabs, badge,
  dialog, toast, sidebar, command palette
- Motion: fast functional transitions only
- Safe choice: predictable navigation and table behavior
- Risk: distinctive accent stripe, command-first UX, dense status metadata

### 2. Learning Workshop Kit

For education, courses, tutorials, agentic AI workshops, and documentation.

- Mood: structured, editorial, practical, trustworthy
- Density: balanced
- Palette: Paper `#F7F2E6`, Ink `#1A1A1A`, Graphite `#6B665E`,
  Rule `#D8CCB8`, Accent Rust `#A0522D` or Forest `#2F6B4F`
- Type: Instrument Serif or Fraunces for display, Source Sans 3 or Noto Sans
  for UI, IBM Plex Mono for code and exercises
- Shape: restrained radius, clear callout borders, visible section markers
- Components: lesson card, module timeline, code block, checklist, rubric
  table, resource card, instructor note, progress, quiz input
- Motion: subtle reveal and completion feedback
- Safe choice: strong readability and explicit learning hierarchy
- Risk: editorial tone can feel less app-like if overused

### 3. Developer Workbench

For API products, MCP tools, CLI platforms, automation builders, and SDK docs.

- Mood: technical, exact, high-signal, fast
- Density: dense but not cramped
- Palette: Near White `#FAFAFA`, Charcoal `#171717`, Slate `#475569`,
  Code Surface `#0F172A`, Code Ink `#E2E8F0`, Accent Green `#16A34A`
- Type: Geist for UI, Berkeley Mono, JetBrains Mono, or Fira Code for code
- Shape: compact controls, clear focus rings, no decorative softness
- Components: command palette, code block, copy button, log stream, status
  badge, config panel, API key field, trace timeline, table
- Motion: nearly static, state clarity over animation
- Safe choice: copyable code and obvious developer affordances
- Risk: can feel cold without good onboarding and empty states

### 4. Premium Product Narrative

For high-value landing pages, portfolios, launches, and product storytelling.

- Mood: refined, confident, spacious, memorable
- Density: airy
- Palette: Porcelain `#FAFAF7`, Deep Ink `#111113`, Warm Gray `#8A8178`,
  Hairline `#DDD6CC`, Accent Oxblood `#7F1D1D` or Brass `#A16207`
- Type: Satoshi or Cabinet Grotesk for display, Instrument Sans or DM Sans for
  body, optional Instrument Serif for editorial emphasis
- Shape: fewer elements, stronger hierarchy, polished CTAs
- Components: hero block, media panel, comparison section, testimonial,
  feature detail, pricing card, modal preview
- Motion: intentional staggered entrance, restrained hover polish
- Safe choice: strong first impression and clear conversion path
- Risk: not ideal for repeated operational workflows

### 5. Community Product

For creator tools, student communities, lightweight social products, and group
collaboration.

- Mood: welcoming, energetic, human, approachable
- Density: balanced to airy
- Palette: Cloud `#F8FAFC`, Ink `#172033`, Sky `#38BDF8`, Lime `#84CC16`,
  Coral `#F97316`, Line `#DDE7F0`
- Type: Outfit, Plus Jakarta Sans, or Satoshi
- Shape: friendly controls, clear touch targets, expressive empty states
- Components: avatar, reaction, card, feed item, onboarding step, badge,
  comment input, notification, progress
- Motion: small bouncy feedback, no excessive choreography
- Safe choice: approachable onboarding and social affordances
- Risk: too much color reduces trust for serious tasks

### 6. Data Cockpit

For analytics, monitoring, finance, security, operations, and live dashboards.

- Mood: serious, instrumented, information-dense
- Density: dense
- Palette: Graphite `#111827`, Panel `#1F2937`, Text `#F9FAFB`,
  Muted `#9CA3AF`, Grid `#374151`, Accent Amber `#F59E0B` or Cyan `#06B6D4`
- Type: IBM Plex Sans or Geist for UI, JetBrains Mono for figures
- Shape: compact panels, chart-first spacing, strong status contrast
- Components: metric tile, chart panel, table, filter bar, segmented control,
  alert, status dot, timeline, drawer
- Motion: minimal, only for live update and focus changes
- Safe choice: visible hierarchy for scanning and comparison
- Risk: dark dense systems need strict contrast and spacing discipline

### 7. Organic Service Brand

For wellness, food, lifestyle, local service, personal brands, and hospitality.

- Mood: warm, tactile, calm, grounded
- Density: airy to balanced
- Palette: Bone `#F7F0E6`, Bark `#3B2F2A`, Moss `#4D6B4D`,
  Clay `#B66A4B`, Linen `#E2D5C5`
- Type: Fraunces or Instrument Serif for display, DM Sans or Source Sans 3 for
  body
- Shape: gentle curves, image-aware modules, soft dividers
- Components: service card, booking form, testimonial, image block, FAQ,
  location card, CTA strip
- Motion: slow, soft transitions
- Safe choice: warmth and clarity
- Risk: beige monotony and low contrast if not checked

### 8. Raw Utility

For experimental tools, indie products, zines, internal prototypes, and
opinionated technical culture.

- Mood: direct, raw, memorable, grid-visible
- Density: balanced to dense
- Palette: White `#FFFFFF`, Ink `#0A0A0A`, Concrete `#E5E5E5`,
  Alert Red `#DC2626`, Signal Yellow `#FACC15`
- Type: Archivo, system sans, or IBM Plex Mono
- Shape: hard borders, sharp controls, explicit focus states
- Components: button, input, table, alert, simple card, command block,
  changelog, status label
- Motion: none or near none
- Safe choice: extreme clarity and low implementation cost
- Risk: can look unfinished if spacing, copy, and alignment are weak

## Token Model

Create split token sections. Do not store everything as one opaque object.

### `color_tokens`

Use role-based names:

- `canvas`: app/page background
- `surface`: default container
- `surfaceElevated`: modal, popover, drawer
- `ink`: primary text
- `muted`: secondary text
- `line`: border and divider
- `accent`: primary action and focus
- `accentInk`: text on accent
- `success`, `warning`, `danger`, `info`: semantic feedback
- `codeSurface`, `codeInk`: code blocks and terminal-like surfaces

Every palette should define usage ratios:

- 60 percent base/canvas/surface
- 30 percent text, line, and structural neutrals
- 10 percent accent and semantic states

### `typography_tokens`

Use role-based names:

- `display`: hero and major marketing titles
- `heading`: app section and panel titles
- `body`: default readable text
- `label`: form labels, buttons, table headers
- `caption`: metadata and helper text
- `mono`: code, IDs, logs, dense numeric data

HiFi typography should have a reason. Do not default to overused primary fonts
such as Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Montserrat, or Poppins
unless the user explicitly requests them or category convention makes the
tradeoff worthwhile.

### `tokens`

Include foundations:

- `spacing`: `xs`, `sm`, `md`, `lg`, `xl`, `section`
- `radius`: `control`, `card`, `modal`
- `shadow`: `none`, `soft`, `raised`
- `motion`: `durationFast`, `durationBase`, `easingStandard`
- `focus`: ring color, width, and offset

## Component Model

Each `component_tokens` entry should help both UI viewers and agents.

Required fields for HiFi components:

- `framework`: `react`, `html`, `tailwind`, `shadcn`, or `mixed`
- `style_system`: the implementation approach
- `description`: what the component is for
- `props`: names, types, defaults, and descriptions
- `variants`: visual or behavioral variants
- `states`: hover, focus, disabled, loading, error, selected where relevant
- `usage`: when to use and when not to use it
- `preview.html` and `preview.css`: static viewer preview
- `source.react` or `source.html`: implementation source when useful
- `tailwind` and `shadcn`: integration metadata when relevant

Use this shape:

```json
{
  "framework": "shadcn",
  "style_system": "shadcn/ui + Tailwind CSS",
  "description": "Primary action button for forms and command surfaces.",
  "props": [
    {
      "name": "variant",
      "type": "default | secondary | destructive | ghost",
      "default": "default",
      "description": "Visual treatment."
    }
  ],
  "variants": ["default", "secondary", "destructive", "ghost"],
  "states": ["hover", "focus-visible", "disabled", "loading"],
  "tailwind": {
    "classes": ["inline-flex", "h-9", "rounded-md", "font-medium"],
    "theme_tokens": ["--accent", "--accent-ink", "--line"]
  },
  "shadcn": {
    "registry_items": ["button"],
    "dependencies": ["@radix-ui/react-slot"]
  },
  "preview": {
    "html": "<button class=\"bk-button\">Save</button>",
    "css": ".bk-button{height:36px;border-radius:6px}"
  },
  "source": {
    "react": "export function Button({ children }) { return <button>{children}</button>; }"
  },
  "usage": "Use for the primary action in a compact workflow."
}
```

## Component Coverage Presets

Use these presets when the user wants automatic generation.

### LoFi Starter

Button, Input, Select, Checkbox, Card, Dialog, Alert.

### Standard Product

Button, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Slider, Tabs,
Breadcrumb, DropdownMenu, Card, Table, Badge, Alert, Toast, Dialog, Drawer,
Accordion, Tooltip, Popover, Progress, Skeleton.

### Education

LessonCard, ModuleTimeline, ExercisePanel, CodeBlock, RubricTable,
ResourceCard, InstructorNote, CompletionChecklist, QuizInput.

### Developer Tool

CommandPalette, CodeBlock, CopyButton, LogStream, StatusBadge, ConfigPanel,
ApiKeyField, TraceTimeline, TokenInspector.

### Data Cockpit

MetricTile, ChartPanel, FilterBar, DataTable, StatusDot, AlertBanner,
Timeline, DrilldownDrawer.

## Coherence Rules

- Operational products need scanning speed before visual flourish.
- Education products need hierarchy, examples, and progression cues before
  decoration.
- Developer tools need copyability, code readability, and error clarity before
  marketing polish.
- Premium landing pages can be airy and cinematic, but product screenshots and
  conversion paths must remain inspectable.
- Dense dashboards should use fewer shadows and more structural lines.
- Playful systems need trust anchors: readable type, restrained semantic colors,
  and clear disabled/error states.

When a user mixes conflicting choices, flag the tradeoff but accept the final
decision. Example: "Editorial typography with a dense monitoring dashboard can
work, but it will slow scanning. Want to keep that tension or switch the body
font to a compact sans?"

## Banned Defaults

Avoid these unless explicitly requested:

- purple/blue neon gradients as the default "AI" style
- generic equal 3-card feature rows with icon circles
- gradient buttons as the default CTA
- centered everything with uniform spacing
- one radius value applied to every component
- fake metrics, fake uptime, fake performance numbers
- stock-photo hero imagery when the product itself should be visible
- emoji-heavy design-system copy
- vague token names with no role explanation
- components without states, props, or usage guidance
- text that explains UI controls instead of making the controls obvious

## Registry Mutation Rule

Before writing to BlueKiwi:

1. Summarize the selected direction.
2. Show the planned sections: colors, typography, foundations, components,
   guidelines, skill instructions, and assets if any.
3. Ask for confirmation unless the user has explicitly asked for fully automatic
   execution.
4. Prefer category tools for edits:
   - colors: `update_design_system_section` or `upsert_design_system_section_entry`
   - typography: `update_design_system_section` or `upsert_design_system_section_entry`
   - components: `upsert_design_component`
   - docs: `guidelines` and `skill` sections

The registry should end up with a system an agent can use directly, not just a
pretty palette.
