# VS Design System — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current inline-HTML Visual Selector with a frame-based component library that provides 12 built-in components, BlueKiwi design token integration, light/dark theme support, and a structured JSON response protocol. Agents write content fragments using `bk-*` CSS classes; the frontend wraps them in a design-consistent frame automatically.

**Architecture:** `public/vs/` contains components.css, helper.js, frame.html as development sources. `scripts/build-vs-frame.ts` bundles them into `src/lib/vs-frame.ts` (a single exported string constant). VisualSelector component detects fragments vs full HTML, wraps fragments with the frame, injects the current theme, and handles both legacy and new postMessage protocols.

**Tech Stack:** Pure CSS + vanilla JS (no frameworks in iframe), React (VisualSelector component), BlueKiwi design tokens from `ref/bluekiwi-globals.css`

---

## 1. Architecture

```
Agent → set_visual_html(fragment) → DB (fragment only)
                                      ↓
User → Task page → VisualSelector component
       → isFragment(html)? wrapWithFrame(html, theme) : html
       → iframe srcDoc
       → User interacts with bk-* components
       → Submit button → postMessage({type:'bk_visual_submit', data:{...}})
       → VisualSelector catches message → POST /respond (JSON)
       → Agent polls get_web_response → structured JSON object
```

### File Structure

| File | Role |
|------|------|
| `public/vs/components.css` | 12 built-in component styles (dev source) |
| `public/vs/helper.js` | Interaction logic: select, drag, slider, submit (~200 lines) |
| `public/vs/frame.html` | Frame template with `{{AGENT_CONTENT}}` placeholder |
| `scripts/build-vs-frame.ts` | Bundles public/vs/ → src/lib/vs-frame.ts |
| `src/lib/vs-frame.ts` | Exported `VS_FRAME_TEMPLATE` string constant |
| `src/components/task/step-detail.tsx` | VisualSelector modification |
| `mcp/src/server.ts` | `set_visual_html` tool description update |
| `packages/cli/src/assets/skills/bk-start/SKILL.md` | VS execution guide |
| `packages/cli/src/assets/skills/bk-design/SKILL.md` | VS node design guide |
| `packages/cli/src/assets/skills/bk-improve/SKILL.md` | VS node improvement guide |
| `packages/cli/src/assets/skills/bk-instruction/SKILL.md` | VS directive in templates |
| `packages/cli/src/assets/skills/bk-approve/SKILL.md` | VS JSON response reading |
| `packages/cli/src/assets/skills/bk-report/SKILL.md` | VS response in reports |

---

## 2. Built-in Components (12)

All components use `bk-` prefix. Agents write class-based HTML fragments only.

### Selection components (collect choices)

**bk-options** — A/B/C single select cards
```html
<div class="bk-options">
  <div class="bk-option" data-value="a" data-recommended>
    <div class="bk-option-letter">A</div>
    <div class="bk-option-body"><h3>Title</h3><p>Description</p></div>
  </div>
</div>
```
`data-recommended` shows a badge. Single select within container.

**bk-cards** — Visual cards with image preview
```html
<div class="bk-cards">
  <div class="bk-card" data-value="design1">
    <div class="bk-card-image"><!-- preview HTML/SVG --></div>
    <div class="bk-card-body"><h3>Name</h3><p>Description</p></div>
  </div>
</div>
```

**bk-checklist** — Multi-select checkboxes
```html
<div class="bk-checklist">
  <div class="bk-check-item" data-value="auth" data-checked>Auth system</div>
  <div class="bk-check-item" data-value="i18n">i18n support</div>
</div>
```
`data-checked` for defaults. Multiple selections allowed.

**bk-code-compare** — Side-by-side code selection
```html
<div class="bk-code-compare">
  <div class="bk-code-option" data-value="hooks">
    <div class="bk-code-label">Approach A: Hooks</div>
    <pre class="bk-code">const [s, setS] = useState(...);</pre>
  </div>
</div>
```

### Input components (collect values)

**bk-slider** — Numeric input
```html
<div class="bk-slider" data-name="budget" data-min="0" data-max="100" data-value="50" data-unit="%">
  <label>Budget allocation</label>
</div>
```
helper.js renders a range input and value display.

**bk-ranking** — Drag-to-reorder
```html
<div class="bk-ranking">
  <div class="bk-rank-item" data-value="security">Security</div>
  <div class="bk-rank-item" data-value="performance">Performance</div>
</div>
```
helper.js adds rank numbers and drag handlers.

**bk-matrix** — 2x2 matrix placement
```html
<div class="bk-matrix" data-x-label="Urgency" data-y-label="Importance">
  <div class="bk-matrix-item" data-value="auth">Auth refactor</div>
  <div class="bk-matrix-item" data-value="cache">Cache layer</div>
</div>
```
helper.js renders a 2x2 grid; items are draggable to set x,y coordinates (0-1).

### Display components (no values collected)

**bk-split** — Side-by-side comparison
```html
<div class="bk-split">
  <div class="bk-split-panel"><h3>Before</h3>...</div>
  <div class="bk-split-panel"><h3>After</h3>...</div>
</div>
```

**bk-pros-cons** — Pros and cons columns
```html
<div class="bk-pros-cons">
  <div class="bk-pros"><h4>Pros</h4><ul><li>Fast</li></ul></div>
  <div class="bk-cons"><h4>Cons</h4><ul><li>Complex</li></ul></div>
</div>
```

**bk-mockup** — Wireframe container
```html
<div class="bk-mockup">
  <div class="bk-mockup-header">Dashboard Preview</div>
  <div class="bk-mockup-body">
    <div class="bk-mock-nav">Logo | Home | Settings</div>
    <div class="bk-mock-content">Main area</div>
  </div>
</div>
```

**bk-timeline** — Step timeline
```html
<div class="bk-timeline">
  <div class="bk-timeline-item" data-status="done">Phase 1</div>
  <div class="bk-timeline-item" data-status="current">Phase 2</div>
  <div class="bk-timeline-item" data-status="pending">Phase 3</div>
</div>
```

### Layout utilities

```html
<h2>Page title</h2>
<p class="bk-subtitle">Secondary description</p>
<div class="bk-section"><!-- section break --></div>
<div class="bk-label">CATEGORY</div>
```

---

## 3. Frame Template

`public/vs/frame.html`:
```html
<!DOCTYPE html>
<html data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>/* components.css inlined here */</style>
</head>
<body>
  <div class="bk-vs-container">
    <div class="bk-vs-content">{{AGENT_CONTENT}}</div>
    <div class="bk-vs-footer">
      <div class="bk-vs-status"></div>
      <button class="bk-vs-submit" disabled>확인</button>
    </div>
  </div>
  <script>/* helper.js inlined here */</script>
</body>
</html>
```

**Fragment detection:** If the stored visual_html starts with `<!DOCTYPE` or `<html`, serve as-is (legacy). Otherwise, wrap with frame template.

**Theme injection:** VisualSelector reads current theme from `document.documentElement` and sets `data-theme` attribute on the iframe's `<html>`.

**Build pipeline:** `scripts/build-vs-frame.ts` reads the 3 source files and generates `src/lib/vs-frame.ts`:
```typescript
export const VS_FRAME_TEMPLATE = `...`;
```

---

## 4. CSS Design Tokens

Mapped directly from `ref/bluekiwi-globals.css`:

### Light theme (data-theme="light")
```
--bk-bg: #f8fbff (canvas)
--bk-surface: #ffffff
--bk-surface-soft: #f3f7fb
--bk-surface-strong: #edf3fb
--bk-text: #1e2a44 (ink-900)
--bk-text-muted: #6d7690 (ink-500)
--bk-border: #dce4ef (border-soft)
--bk-primary: #4169e1 (brand-blue-600)
--bk-primary-light: #eaf0ff (brand-blue-100)
--bk-primary-dark: #3557be (brand-blue-700)
--bk-accent: #b7cf57 (kiwi-600)
--bk-accent-light: #f4f8dd (kiwi-100)
--bk-success: #2f8f6b
--bk-warning: #b78226
--bk-danger: #c94d5d
--bk-radius: 1rem
--bk-radius-sm: 0.75rem
--bk-radius-lg: 1.5rem
--bk-shadow: 0 10px 24px rgba(30,42,68,0.08)
--bk-font: 'Inter', system-ui, sans-serif
--bk-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace
```

### Dark theme (data-theme="dark")
```
--bk-bg: #0f1728
--bk-surface: #162033
--bk-surface-soft: #1d2a40
--bk-surface-strong: #243249
--bk-text: #eef4ff
--bk-text-muted: #94a5bf
--bk-border: #2f3a50
--bk-primary: #6d8ef0
--bk-primary-light: rgba(109,142,240,0.18)
--bk-primary-dark: #4169e1
--bk-accent: #b7cf57
--bk-accent-light: rgba(183,207,87,0.18)
--bk-danger: #de6a78
```

Component styles follow `ref/bluekiwi-shadcn-variants.tsx` patterns:
- Cards: `border-radius: var(--bk-radius-lg)` (1.5rem), `box-shadow: var(--bk-shadow)`
- Buttons: `border-radius: 9999px` (rounded-full)
- Hover: `background: var(--bk-primary-light)`, `border-color: var(--bk-primary)`
- Selected: ring effect `box-shadow: 0 0 0 3px rgba(65,105,225,0.2)`
- Recommended badge: `color: var(--bk-accent)`

---

## 5. helper.js Logic

~200 lines vanilla JS, no external dependencies. Runs inside iframe sandbox.

### Core functions

| Function | Role |
|----------|------|
| `initVS()` | DOM load → detect components → bind events → update submit state |
| `toggleSelect(container, item)` | Single select toggle for options/cards/code-compare |
| `toggleCheck(item)` | Multi-select toggle for checklist |
| `bindSliders()` | Render range inputs, sync value display |
| `bindRanking()` | Add drag handlers + rank numbers |
| `bindMatrix()` | Render 2x2 grid, enable item drag placement |
| `collectState()` | Gather all component values → `{selections, values, ranking, matrix}` |
| `handleSubmit()` | collectState → postMessage → disable button → show checkmark |
| `updateSubmitState()` | Enable submit when interactable components exist AND user has interacted |

### Ranking: HTML5 drag-and-drop (dragstart/dragover/drop), auto-numbered.

### Matrix: Absolute-positioned items on a relative grid container. Mouse/touch drag updates `data-x`/`data-y` (0-1 range). Quadrant labels from `data-x-label`/`data-y-label`.

---

## 6. postMessage Protocol

### New protocol
```javascript
window.parent.postMessage({
  type: 'bk_visual_submit',
  data: {
    selections: ['a'],           // bk-options, bk-cards, bk-checklist, bk-code-compare
    values: { budget: 70 },      // bk-slider
    ranking: ['security', 'ux'], // bk-ranking
    matrix: { auth: {x:0.8, y:0.9} }  // bk-matrix
  }
}, '*');
```

Only populated fields are included. If no sliders exist, `values` is omitted.

### Legacy compatibility
VisualSelector handles both:
- `{type: 'bk_visual_submit', data: {...}}` → store as-is
- `{type: 'bk_visual_select', value: 'x'}` → convert to `{selections: ['x']}`

---

## 7. VisualSelector Component Changes

### Fragment detection
```typescript
function isFragment(html: string): boolean {
  const trimmed = html.trim();
  return !trimmed.startsWith('<!DOCTYPE') && !trimmed.startsWith('<html');
}
```

### Frame wrapping
```typescript
import { VS_FRAME_TEMPLATE } from '@/lib/vs-frame';

const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
const srcDoc = isFragment(html)
  ? VS_FRAME_TEMPLATE
      .replace('{{AGENT_CONTENT}}', html)
      .replace('data-theme="light"', `data-theme="${theme}"`)
  : html;
```

### Message handler
```typescript
function handleMessage(event: MessageEvent) {
  if (event.source !== iframeRef.current?.contentWindow) return;
  const msg = event.data;
  if (msg?.type === 'bk_visual_submit') {
    submitResponse(JSON.stringify(msg.data));
  } else if (msg?.type === 'bk_visual_select') {
    submitResponse(JSON.stringify({ selections: [msg.value] }));
  }
}
```

---

## 8. MCP Tool Updates

### `set_visual_html` — Description Rewrite

Replace the current inline-style guide with a component-reference guide listing all 12 `bk-*` components, their markup patterns, and the response format. See Section 4 of the brainstorming notes for the full text.

Key changes:
- "Write content fragments, NOT full HTML"
- Component reference table (selection/input/display)
- Response format: `{selections, values, ranking, matrix}`
- Example fragment using bk-options

### `get_web_response` — History Mode

Extend to support VS response history per node.

**Current behavior:**
```
get_web_response(task_id) → latest web_response only (1 row)
```

**Extended behavior:**
```
get_web_response(task_id)                → latest (unchanged, backward compatible)
get_web_response(task_id, node_id)       → all web_response values for that node (history mode)
```

When `node_id` is provided, return `web_response` only (no visual_html — lightweight) for all iterations:

```json
{
  "task_id": 19,
  "node_id": 109,
  "history": [
    { "iteration": 1, "web_response": {"selections":["a"]}, "created_at": "..." },
    { "iteration": 2, "web_response": {"selections":["b"],"values":{"confidence":80}}, "created_at": "..." },
    { "iteration": 3, "web_response": {"selections":["b"],"values":{"confidence":95}}, "created_at": "..." }
  ]
}
```

**MCP tool definition update:**
```
"get_web_response"
"Fetch VS response for a task. Without node_id: returns the latest response.
With node_id: returns the response history for that node across all loop
iterations (web_response only, no visual_html). Useful for tracking how
user preferences evolved across iterations."
Parameters: task_id (required), node_id (optional)
```

**API change:** `GET /api/tasks/{id}/respond?node_id=109`
- Without `node_id`: existing behavior (latest 1 row)
- With `node_id`: return history array (web_response only, visual_html excluded)

**Iteration numbering:** Computed as `ROW_NUMBER() OVER (PARTITION BY task_id, node_id ORDER BY id)`.

### Storage Policy — `visual_html` Retention

`visual_html` is rendering-only content (HTML fragments, potentially large). All iterations are preserved by default — no automatic pruning.

**Default behavior:** Keep all `visual_html` and `web_response` across iterations. Data accumulates over time but remains queryable for audit/review.

**Manual cleanup:** Settings page provides a "Clear visual HTML history" action that bulk-nullifies `visual_html` on completed tasks while preserving `web_response`.

**Implementation:**
- Settings page: add "Storage" section with "Clear VS render cache" button
- API: `POST /api/settings/cleanup-visual-html` (superuser only)
- SQL: `UPDATE task_logs SET visual_html = NULL WHERE task_id IN (SELECT id FROM tasks WHERE status IN ('completed', 'failed')) AND visual_html IS NOT NULL`
- Show affected row count + estimated freed size before confirmation
- `web_response` is never touched — always preserved

---

## 9. Skill Updates

### bk-start
- VS gate section: compose fragment with bk-* classes, open deep link, poll get_web_response, parse JSON response object
- Loop + VS pattern: in a loop with VS gate, use `get_web_response(task_id, node_id)` to access previous iteration responses and adapt the next VS screen accordingly

### bk-design
- Node Design Guidelines: plan which bk-* components the agent should use, document in node instruction

### bk-improve
- VS node review: check legacy inline vs bk-* components, suggest migration, verify instruction specifies components, check downstream response format compatibility
- Attachment Management section: add VS-related guidance

### bk-instruction
- VS Component Directives: how to write instruction templates that direct the execution agent to use specific bk-* components

### bk-approve
- VS JSON response parsing: show readable summary of selections/values/ranking/matrix before confirming

### bk-report
- VS response formatting: convert JSON to readable text grouped by type

---

## 10. OpenAPI / Swagger

- Update `set_visual_html` endpoint description to mention fragment-based content and the new response format.
- Update `/api/tasks/{id}/respond` POST description to document the JSON response structure.
- Update `/api/tasks/{id}/respond` GET description: add optional `node_id` query parameter for history mode. Document the `history` array response format.

---

## 11. Tutorial Page

Add a brief mention of Visual Selector components in the workflow section. i18n keys for component descriptions are not needed (VS is agent-facing, not end-user tutorial content), but mention that VS gates show interactive selection UI.

---

## 12. Build Pipeline

### New script: `scripts/build-vs-frame.ts`

Reads `public/vs/frame.html`, `public/vs/components.css`, `public/vs/helper.js` and generates `src/lib/vs-frame.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const dir = path.resolve(__dirname, '../public/vs');
const css = fs.readFileSync(path.join(dir, 'components.css'), 'utf-8');
const js = fs.readFileSync(path.join(dir, 'helper.js'), 'utf-8');
const frame = fs.readFileSync(path.join(dir, 'frame.html'), 'utf-8');

const result = frame
  .replace('/* components.css inlined here */', css)
  .replace('/* helper.js inlined here */', js);

const output = `// Auto-generated by scripts/build-vs-frame.ts — do not edit\nexport const VS_FRAME_TEMPLATE = ${JSON.stringify(result)};\n`;

fs.writeFileSync(
  path.resolve(__dirname, '../src/lib/vs-frame.ts'),
  output,
);
console.log('[build-vs-frame] done');
```

Add to build pipeline: run before `next build` or as a pre-build step in package.json.
