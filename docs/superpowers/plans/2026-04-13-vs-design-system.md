# VS Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current inline-HTML Visual Selector with a frame-based component library. Agents write content fragments using `bk-*` CSS classes; the frontend wraps them in a design-consistent frame with 12 built-in components, BlueKiwi design tokens, light/dark theme support, and a structured JSON response protocol (`{selections, values, ranking, matrix}`).

**Architecture:** `public/vs/` contains `components.css`, `helper.js`, `frame.html` as development sources. `scripts/build-vs-frame.ts` bundles them into `src/lib/vs-frame.ts` (a single exported string constant). The `VisualSelector` component detects fragments vs full HTML, wraps fragments with the frame template, injects the current theme, and handles both legacy (`bk_visual_select`) and new (`bk_visual_submit`) postMessage protocols.

**Tech Stack:** Pure CSS + vanilla JS (no frameworks in iframe), React (VisualSelector component), Next.js App Router, PostgreSQL, BlueKiwi design tokens from `ref/bluekiwi-globals.css`.

---

## File Structure

| File | Change | Role |
|------|--------|------|
| `public/vs/components.css` | Create | 12 built-in bk-* component styles with light/dark theme |
| `public/vs/helper.js` | Create | ~200 lines vanilla JS: interaction, drag, slider, submit |
| `public/vs/frame.html` | Create | Frame template with `{{AGENT_CONTENT}}` placeholder |
| `scripts/build-vs-frame.ts` | Create | Bundles public/vs/ into src/lib/vs-frame.ts |
| `src/lib/vs-frame.ts` | Generated | Exported `VS_FRAME_TEMPLATE` string constant |
| `src/components/task/step-detail.tsx` | Modify | VisualSelector: fragment detection, frame wrapping, dual protocol |
| `src/app/api/tasks/[id]/respond/route.ts` | Modify | GET handler: add optional node_id for history mode |
| `mcp/src/server.ts` | Modify | Update set_visual_html description, get_web_response node_id param |
| `packages/cli/src/assets/skills/bk-start/SKILL.md` | Modify | VS gate section rewrite with bk-* components |
| `packages/cli/src/assets/skills/bk-design/SKILL.md` | Modify | VS node design guidelines |
| `packages/cli/src/assets/skills/bk-improve/SKILL.md` | Modify | VS node review checklist |
| `packages/cli/src/assets/skills/bk-instruction/SKILL.md` | Modify | VS component directives |
| `packages/cli/src/assets/skills/bk-approve/SKILL.md` | Modify | VS JSON response parsing |
| `packages/cli/src/assets/skills/bk-report/SKILL.md` | Modify | VS response formatting |
| `src/app/(app)/settings/page.tsx` | Modify | Add "Storage" section with cleanup button |
| `src/app/api/settings/cleanup-visual-html/route.ts` | Create | POST handler: nullify visual_html on completed tasks |
| `src/lib/openapi.ts` | Modify | Update VS-related endpoint descriptions |
| `src/lib/auth.ts` | Modify | Add `settings:manage` permission for superuser |
| `package.json` | Modify | Add `build:vs` npm script |

---

## Task 1: Create `public/vs/components.css`

**Files:**
- Create: `public/vs/components.css`

**Parallelizable:** Yes (Tasks 1, 2, 3 can run in parallel)

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p /Users/dante/workspace/dante-code/projects/bluekiwi/public/vs
```

- [ ] **Step 2: Write the complete CSS file**

Create `public/vs/components.css` with the following exact content:

```css
/* VS Design System — components.css
 * 12 built-in bk-* components using BlueKiwi design tokens.
 * Light theme by default; dark via [data-theme="dark"].
 * Auto-generated frames include this file inline. Do not import externally.
 */

/* ─── Design Tokens ─── */

:root, [data-theme="light"] {
  --bk-bg: #f8fbff;
  --bk-surface: #ffffff;
  --bk-surface-soft: #f3f7fb;
  --bk-surface-strong: #edf3fb;
  --bk-text: #1e2a44;
  --bk-text-muted: #6d7690;
  --bk-border: #dce4ef;
  --bk-primary: #4169e1;
  --bk-primary-light: #eaf0ff;
  --bk-primary-dark: #3557be;
  --bk-accent: #b7cf57;
  --bk-accent-light: #f4f8dd;
  --bk-success: #2f8f6b;
  --bk-warning: #b78226;
  --bk-danger: #c94d5d;
  --bk-radius: 1rem;
  --bk-radius-sm: 0.75rem;
  --bk-radius-lg: 1.5rem;
  --bk-shadow: 0 10px 24px rgba(30,42,68,0.08);
  --bk-font: 'Inter', system-ui, -apple-system, sans-serif;
  --bk-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}

[data-theme="dark"] {
  --bk-bg: #0f1728;
  --bk-surface: #162033;
  --bk-surface-soft: #1d2a40;
  --bk-surface-strong: #243249;
  --bk-text: #eef4ff;
  --bk-text-muted: #94a5bf;
  --bk-border: #2f3a50;
  --bk-primary: #6d8ef0;
  --bk-primary-light: rgba(109,142,240,0.18);
  --bk-primary-dark: #4169e1;
  --bk-accent: #b7cf57;
  --bk-accent-light: rgba(183,207,87,0.18);
  --bk-success: #4aba8a;
  --bk-warning: #d4a04a;
  --bk-danger: #de6a78;
  --bk-shadow: 0 10px 26px rgba(2,6,23,0.3);
}

/* ─── Base Reset ─── */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--bk-font);
  color: var(--bk-text);
  background: var(--bk-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* ─── Layout Utilities ─── */

h2 {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 0.25rem;
}

.bk-subtitle {
  font-size: 0.9rem;
  color: var(--bk-text-muted);
  margin-bottom: 1.25rem;
}

.bk-section {
  border-top: 1px solid var(--bk-border);
  margin: 1.5rem 0;
  padding-top: 1.5rem;
}

.bk-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--bk-text-muted);
  margin-bottom: 0.75rem;
}

/* ─── VS Container ─── */

.bk-vs-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
}

.bk-vs-content {
  flex: 1;
}

.bk-vs-footer {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 0 0;
  margin-top: 1.5rem;
  border-top: 1px solid var(--bk-border);
  background: var(--bk-bg);
}

.bk-vs-status {
  font-size: 0.8rem;
  color: var(--bk-text-muted);
}

.bk-vs-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 2.5rem;
  padding: 0 1.5rem;
  border: none;
  border-radius: 9999px;
  background: var(--bk-primary);
  color: #ffffff;
  font-family: var(--bk-font);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s, transform 0.1s;
  box-shadow: 0 10px 18px rgba(53,87,190,0.18);
}

.bk-vs-submit:hover:not(:disabled) {
  background: var(--bk-primary-dark);
}

.bk-vs-submit:active:not(:disabled) {
  transform: scale(0.97);
}

.bk-vs-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

.bk-vs-submit.submitted {
  background: var(--bk-success);
  pointer-events: none;
}

/* ─── 1. bk-options (A/B/C single select) ─── */

.bk-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bk-option {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--bk-surface);
  border: 1.5px solid var(--bk-border);
  border-radius: var(--bk-radius-lg);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  box-shadow: var(--bk-shadow);
  position: relative;
}

.bk-option:hover {
  background: var(--bk-primary-light);
  border-color: var(--bk-primary);
}

.bk-option.selected {
  border-color: var(--bk-primary);
  background: var(--bk-primary-light);
  box-shadow: 0 0 0 3px rgba(65,105,225,0.2);
}

.bk-option-letter {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--bk-surface-strong);
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--bk-text-muted);
  flex-shrink: 0;
}

.bk-option.selected .bk-option-letter {
  background: var(--bk-primary);
  color: #ffffff;
}

.bk-option-body h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.15rem;
}

.bk-option-body p {
  font-size: 0.85rem;
  color: var(--bk-text-muted);
  line-height: 1.5;
}

.bk-option[data-recommended]::after {
  content: 'Recommended';
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--bk-accent);
  background: var(--bk-accent-light);
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
}

/* ─── 2. bk-cards (visual cards with image preview) ─── */

.bk-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.bk-card {
  background: var(--bk-surface);
  border: 1.5px solid var(--bk-border);
  border-radius: var(--bk-radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-shadow: var(--bk-shadow);
}

.bk-card:hover {
  border-color: var(--bk-primary);
}

.bk-card.selected {
  border-color: var(--bk-primary);
  box-shadow: 0 0 0 3px rgba(65,105,225,0.2);
}

.bk-card-image {
  width: 100%;
  aspect-ratio: 16/10;
  background: var(--bk-surface-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-bottom: 1px solid var(--bk-border);
}

.bk-card-image svg { max-width: 80%; max-height: 80%; }

.bk-card-body {
  padding: 1rem;
}

.bk-card-body h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.15rem;
}

.bk-card-body p {
  font-size: 0.8rem;
  color: var(--bk-text-muted);
}

/* ─── 3. bk-checklist (multi-select) ─── */

.bk-checklist {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bk-check-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bk-surface);
  border: 1.5px solid var(--bk-border);
  border-radius: var(--bk-radius);
  cursor: pointer;
  font-size: 0.9rem;
  transition: border-color 0.15s, background 0.15s;
}

.bk-check-item::before {
  content: '';
  display: block;
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--bk-border);
  border-radius: 0.35rem;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}

.bk-check-item:hover {
  background: var(--bk-primary-light);
  border-color: var(--bk-primary);
}

.bk-check-item.checked {
  border-color: var(--bk-primary);
  background: var(--bk-primary-light);
}

.bk-check-item.checked::before {
  background: var(--bk-primary);
  border-color: var(--bk-primary);
  /* Checkmark via box-shadow trick */
  box-shadow: inset 0 0 0 2px var(--bk-primary),
    inset 0.15rem -0.15rem 0 0 #fff;
}

/* ─── 4. bk-code-compare (side-by-side code selection) ─── */

.bk-code-compare {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.bk-code-option {
  background: var(--bk-surface);
  border: 1.5px solid var(--bk-border);
  border-radius: var(--bk-radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.bk-code-option:hover {
  border-color: var(--bk-primary);
}

.bk-code-option.selected {
  border-color: var(--bk-primary);
  box-shadow: 0 0 0 3px rgba(65,105,225,0.2);
}

.bk-code-label {
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--bk-text-muted);
  border-bottom: 1px solid var(--bk-border);
  background: var(--bk-surface-soft);
}

pre.bk-code {
  margin: 0;
  padding: 1rem;
  font-family: var(--bk-font-mono);
  font-size: 0.8rem;
  line-height: 1.6;
  overflow-x: auto;
  color: var(--bk-text);
  background: transparent;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ─── 5. bk-slider (numeric input) ─── */

.bk-slider {
  padding: 1rem 1.25rem;
  background: var(--bk-surface);
  border: 1.5px solid var(--bk-border);
  border-radius: var(--bk-radius-lg);
  margin-bottom: 0.75rem;
}

.bk-slider label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.bk-slider-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.bk-slider-controls input[type="range"] {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bk-surface-strong);
  border-radius: 3px;
  outline: none;
}

.bk-slider-controls input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bk-primary);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(65,105,225,0.3);
}

.bk-slider-controls input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: var(--bk-primary);
  cursor: pointer;
}

.bk-slider-value {
  min-width: 3.5rem;
  text-align: right;
  font-size: 0.95rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--bk-primary);
}

/* ─── 6. bk-ranking (drag-to-reorder) ─── */

.bk-ranking {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bk-rank-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bk-surface);
  border: 1.5px solid var(--bk-border);
  border-radius: var(--bk-radius);
  cursor: grab;
  font-size: 0.9rem;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  user-select: none;
}

.bk-rank-item:active { cursor: grabbing; }

.bk-rank-item.dragging {
  opacity: 0.5;
  border-color: var(--bk-primary);
}

.bk-rank-item.drag-over {
  border-color: var(--bk-primary);
  box-shadow: 0 0 0 2px rgba(65,105,225,0.15);
}

.bk-rank-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--bk-surface-strong);
  font-weight: 700;
  font-size: 0.75rem;
  color: var(--bk-text-muted);
  flex-shrink: 0;
}

.bk-rank-grip {
  color: var(--bk-text-muted);
  font-size: 1rem;
  flex-shrink: 0;
  opacity: 0.5;
}

/* ─── 7. bk-matrix (2x2 matrix placement) ─── */

.bk-matrix {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  max-width: 500px;
  margin: 0 auto;
  background: var(--bk-surface);
  border: 1.5px solid var(--bk-border);
  border-radius: var(--bk-radius-lg);
  overflow: hidden;
}

.bk-matrix-grid {
  position: absolute;
  inset: 2.5rem;
}

.bk-matrix-grid::before,
.bk-matrix-grid::after {
  content: '';
  position: absolute;
  background: var(--bk-border);
}

/* Vertical center line */
.bk-matrix-grid::before {
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  transform: translateX(-0.5px);
}

/* Horizontal center line */
.bk-matrix-grid::after {
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  transform: translateY(-0.5px);
}

.bk-matrix-x-label,
.bk-matrix-y-label {
  position: absolute;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--bk-text-muted);
}

.bk-matrix-x-label {
  bottom: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
}

.bk-matrix-y-label {
  top: 50%;
  left: 0.5rem;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: center;
}

.bk-matrix-item {
  position: absolute;
  padding: 0.4rem 0.75rem;
  background: var(--bk-primary);
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  cursor: grab;
  user-select: none;
  white-space: nowrap;
  z-index: 1;
  transition: box-shadow 0.1s;
  box-shadow: 0 2px 8px rgba(65,105,225,0.25);
}

.bk-matrix-item:active { cursor: grabbing; }

.bk-matrix-item.dragging {
  box-shadow: 0 4px 16px rgba(65,105,225,0.4);
  z-index: 10;
}

/* ─── 8. bk-split (side-by-side comparison) ─── */

.bk-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.bk-split-panel {
  padding: 1.25rem;
  background: var(--bk-surface);
  border: 1.5px solid var(--bk-border);
  border-radius: var(--bk-radius-lg);
  box-shadow: var(--bk-shadow);
}

.bk-split-panel h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--bk-text);
}

.bk-split-panel p,
.bk-split-panel ul,
.bk-split-panel ol {
  font-size: 0.85rem;
  color: var(--bk-text-muted);
  line-height: 1.6;
}

/* ─── 9. bk-pros-cons ─── */

.bk-pros-cons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.bk-pros, .bk-cons {
  padding: 1.25rem;
  border-radius: var(--bk-radius-lg);
}

.bk-pros {
  background: rgba(47,143,107,0.08);
  border: 1.5px solid rgba(47,143,107,0.2);
}

.bk-cons {
  background: rgba(201,77,93,0.08);
  border: 1.5px solid rgba(201,77,93,0.2);
}

.bk-pros h4 { color: var(--bk-success); }
.bk-cons h4 { color: var(--bk-danger); }

.bk-pros h4, .bk-cons h4 {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.5rem;
}

.bk-pros ul, .bk-cons ul {
  list-style: none;
  padding: 0;
}

.bk-pros li, .bk-cons li {
  font-size: 0.85rem;
  color: var(--bk-text);
  padding: 0.25rem 0;
  line-height: 1.5;
}

.bk-pros li::before { content: '+ '; color: var(--bk-success); font-weight: 600; }
.bk-cons li::before { content: '- '; color: var(--bk-danger); font-weight: 600; }

/* ─── 10. bk-mockup (wireframe container) ─── */

.bk-mockup {
  background: var(--bk-surface);
  border: 1.5px solid var(--bk-border);
  border-radius: var(--bk-radius-lg);
  overflow: hidden;
  box-shadow: var(--bk-shadow);
}

.bk-mockup-header {
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--bk-text-muted);
  background: var(--bk-surface-soft);
  border-bottom: 1px solid var(--bk-border);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bk-mockup-header::before {
  content: '';
  display: flex;
  gap: 0.25rem;
  width: 3rem;
  height: 0.5rem;
  background:
    radial-gradient(circle at 0.25rem 0.25rem, var(--bk-danger) 3.5px, transparent 4px),
    radial-gradient(circle at 1rem 0.25rem, var(--bk-warning) 3.5px, transparent 4px),
    radial-gradient(circle at 1.75rem 0.25rem, var(--bk-success) 3.5px, transparent 4px);
}

.bk-mockup-body {
  padding: 1rem;
  min-height: 200px;
}

.bk-mock-nav {
  padding: 0.5rem 0.75rem;
  background: var(--bk-surface-soft);
  border-radius: var(--bk-radius-sm);
  font-size: 0.75rem;
  color: var(--bk-text-muted);
  margin-bottom: 0.75rem;
}

.bk-mock-content {
  padding: 0.75rem;
  background: var(--bk-surface-strong);
  border-radius: var(--bk-radius-sm);
  font-size: 0.8rem;
  color: var(--bk-text-muted);
  min-height: 120px;
}

/* ─── 11. bk-timeline ─── */

.bk-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-left: 1.5rem;
  position: relative;
}

.bk-timeline::before {
  content: '';
  position: absolute;
  left: 0.5rem;
  top: 0.5rem;
  bottom: 0.5rem;
  width: 2px;
  background: var(--bk-border);
}

.bk-timeline-item {
  position: relative;
  padding: 0.75rem 0 0.75rem 1.25rem;
  font-size: 0.9rem;
}

.bk-timeline-item::before {
  content: '';
  position: absolute;
  left: -1.25rem;
  top: 1rem;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid var(--bk-border);
  background: var(--bk-surface);
}

.bk-timeline-item[data-status="done"]::before {
  background: var(--bk-success);
  border-color: var(--bk-success);
}

.bk-timeline-item[data-status="current"]::before {
  background: var(--bk-primary);
  border-color: var(--bk-primary);
  box-shadow: 0 0 0 3px rgba(65,105,225,0.2);
}

.bk-timeline-item[data-status="pending"]::before {
  background: var(--bk-surface);
  border-color: var(--bk-border);
}

.bk-timeline-item[data-status="done"] {
  color: var(--bk-text-muted);
}

.bk-timeline-item[data-status="current"] {
  font-weight: 600;
  color: var(--bk-primary);
}

.bk-timeline-item[data-status="pending"] {
  color: var(--bk-text-muted);
  opacity: 0.7;
}
```

- [ ] **Step 3: Verify file created**

```bash
wc -l public/vs/components.css
# Expected: ~530 lines
```

---

## Task 2: Create `public/vs/helper.js`

**Files:**
- Create: `public/vs/helper.js`

**Parallelizable:** Yes (Tasks 1, 2, 3 can run in parallel)

- [ ] **Step 1: Write the complete JS file**

Create `public/vs/helper.js` with the following exact content:

```javascript
/**
 * VS Design System — helper.js
 * ~200 lines vanilla JS. Runs inside iframe sandbox.
 * Handles: select, check, slider, ranking (drag), matrix (drag), submit.
 */
(function () {
  'use strict';

  /* ── State ── */
  let hasInteracted = false;

  /* ── Init ── */
  function initVS() {
    bindSelectables('.bk-options', '.bk-option');
    bindSelectables('.bk-cards', '.bk-card');
    bindSelectables('.bk-code-compare', '.bk-code-option');
    bindChecklist();
    bindSliders();
    bindRanking();
    bindMatrix();

    const btn = document.querySelector('.bk-vs-submit');
    if (btn) btn.addEventListener('click', handleSubmit);

    updateSubmitState();
  }

  /* ── Single-select toggle ── */
  function bindSelectables(containerSel, itemSel) {
    document.querySelectorAll(containerSel).forEach(function (container) {
      container.querySelectorAll(itemSel).forEach(function (item) {
        item.addEventListener('click', function () {
          toggleSelect(container, item, itemSel);
        });
      });
    });
  }

  function toggleSelect(container, item, itemSel) {
    var wasSelected = item.classList.contains('selected');
    container.querySelectorAll(itemSel).forEach(function (el) {
      el.classList.remove('selected');
    });
    if (!wasSelected) item.classList.add('selected');
    hasInteracted = true;
    updateSubmitState();
  }

  /* ── Multi-select checklist ── */
  function bindChecklist() {
    document.querySelectorAll('.bk-checklist').forEach(function (list) {
      list.querySelectorAll('.bk-check-item').forEach(function (item) {
        /* Apply defaults */
        if (item.hasAttribute('data-checked')) item.classList.add('checked');
        item.addEventListener('click', function () {
          toggleCheck(item);
        });
      });
    });
  }

  function toggleCheck(item) {
    item.classList.toggle('checked');
    hasInteracted = true;
    updateSubmitState();
  }

  /* ── Sliders ── */
  function bindSliders() {
    document.querySelectorAll('.bk-slider').forEach(function (container) {
      var min = Number(container.dataset.min || 0);
      var max = Number(container.dataset.max || 100);
      var val = Number(container.dataset.value || Math.round((min + max) / 2));
      var unit = container.dataset.unit || '';

      var controls = document.createElement('div');
      controls.className = 'bk-slider-controls';

      var input = document.createElement('input');
      input.type = 'range';
      input.min = min;
      input.max = max;
      input.value = val;

      var display = document.createElement('span');
      display.className = 'bk-slider-value';
      display.textContent = val + unit;

      input.addEventListener('input', function () {
        display.textContent = input.value + unit;
        container.dataset.value = input.value;
        hasInteracted = true;
        updateSubmitState();
      });

      controls.appendChild(input);
      controls.appendChild(display);
      container.appendChild(controls);
    });
  }

  /* ── Ranking (HTML5 drag-and-drop) ── */
  function bindRanking() {
    document.querySelectorAll('.bk-ranking').forEach(function (list) {
      var items = list.querySelectorAll('.bk-rank-item');
      items.forEach(function (item, i) {
        /* Add rank number */
        var num = document.createElement('span');
        num.className = 'bk-rank-number';
        num.textContent = String(i + 1);
        item.insertBefore(num, item.firstChild);

        /* Add grip icon */
        var grip = document.createElement('span');
        grip.className = 'bk-rank-grip';
        grip.textContent = '\u2261';
        item.appendChild(grip);

        item.setAttribute('draggable', 'true');

        item.addEventListener('dragstart', function (e) {
          item.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', '');
        });

        item.addEventListener('dragend', function () {
          item.classList.remove('dragging');
          list.querySelectorAll('.bk-rank-item').forEach(function (el) {
            el.classList.remove('drag-over');
          });
          renumberRanking(list);
          hasInteracted = true;
          updateSubmitState();
        });

        item.addEventListener('dragover', function (e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          var dragging = list.querySelector('.dragging');
          if (dragging && dragging !== item) {
            item.classList.add('drag-over');
            var rect = item.getBoundingClientRect();
            var mid = rect.top + rect.height / 2;
            if (e.clientY < mid) {
              list.insertBefore(dragging, item);
            } else {
              list.insertBefore(dragging, item.nextSibling);
            }
          }
        });

        item.addEventListener('dragleave', function () {
          item.classList.remove('drag-over');
        });
      });
    });
  }

  function renumberRanking(list) {
    list.querySelectorAll('.bk-rank-item').forEach(function (item, i) {
      var num = item.querySelector('.bk-rank-number');
      if (num) num.textContent = String(i + 1);
    });
  }

  /* ── Matrix (mouse/touch drag placement) ── */
  function bindMatrix() {
    document.querySelectorAll('.bk-matrix').forEach(function (container) {
      /* Build grid overlay */
      var grid = document.createElement('div');
      grid.className = 'bk-matrix-grid';
      container.appendChild(grid);

      /* Add axis labels */
      var xLabel = document.createElement('div');
      xLabel.className = 'bk-matrix-x-label';
      xLabel.textContent = container.dataset.xLabel || 'X';
      container.appendChild(xLabel);

      var yLabel = document.createElement('div');
      yLabel.className = 'bk-matrix-y-label';
      yLabel.textContent = container.dataset.yLabel || 'Y';
      container.appendChild(yLabel);

      /* Position items */
      var items = container.querySelectorAll('.bk-matrix-item');
      var n = items.length;
      items.forEach(function (item, i) {
        /* Default spread: distribute items in center area */
        var dx = item.dataset.x !== undefined ? Number(item.dataset.x) : (0.3 + 0.4 * (i / Math.max(n - 1, 1)));
        var dy = item.dataset.y !== undefined ? Number(item.dataset.y) : (0.3 + 0.4 * (i / Math.max(n - 1, 1)));
        placeMatrixItem(item, container, dx, dy);
        makeMatrixDraggable(item, container);
      });
    });
  }

  function placeMatrixItem(item, container, x, y) {
    item.dataset.x = String(Math.max(0, Math.min(1, x)).toFixed(2));
    item.dataset.y = String(Math.max(0, Math.min(1, y)).toFixed(2));
    /* CSS uses left/bottom but we need top offset (y inverted: 1=top, 0=bottom) */
    var pad = 40; /* px padding for labels */
    item.style.left = (pad + x * (container.clientWidth - 2 * pad)) + 'px';
    item.style.top = (pad + (1 - y) * (container.clientHeight - 2 * pad)) + 'px';
    item.style.transform = 'translate(-50%, -50%)';
  }

  function makeMatrixDraggable(item, container) {
    var startX, startY;

    function onStart(e) {
      e.preventDefault();
      item.classList.add('dragging');
      var pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX;
      startY = pt.clientY;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    }

    function onMove(e) {
      e.preventDefault();
      var pt = e.touches ? e.touches[0] : e;
      var rect = container.getBoundingClientRect();
      var pad = 40;
      var x = Math.max(0, Math.min(1, (pt.clientX - rect.left - pad) / (rect.width - 2 * pad)));
      var y = Math.max(0, Math.min(1, 1 - (pt.clientY - rect.top - pad) / (rect.height - 2 * pad)));
      placeMatrixItem(item, container, x, y);
    }

    function onEnd() {
      item.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      hasInteracted = true;
      updateSubmitState();
    }

    item.addEventListener('mousedown', onStart);
    item.addEventListener('touchstart', onStart, { passive: false });
  }

  /* ── Collect State ── */
  function collectState() {
    var state = {};

    /* selections: bk-options, bk-cards, bk-code-compare (single select) */
    var selections = [];
    document.querySelectorAll('.bk-option.selected, .bk-card.selected, .bk-code-option.selected').forEach(function (el) {
      if (el.dataset.value) selections.push(el.dataset.value);
    });
    /* bk-checklist (multi select) */
    document.querySelectorAll('.bk-check-item.checked').forEach(function (el) {
      if (el.dataset.value) selections.push(el.dataset.value);
    });
    if (selections.length > 0) state.selections = selections;

    /* values: bk-slider */
    var values = {};
    var hasValues = false;
    document.querySelectorAll('.bk-slider').forEach(function (el) {
      if (el.dataset.name && el.dataset.value !== undefined) {
        values[el.dataset.name] = Number(el.dataset.value);
        hasValues = true;
      }
    });
    if (hasValues) state.values = values;

    /* ranking: bk-ranking */
    document.querySelectorAll('.bk-ranking').forEach(function (list) {
      var order = [];
      list.querySelectorAll('.bk-rank-item').forEach(function (item) {
        if (item.dataset.value) order.push(item.dataset.value);
      });
      if (order.length > 0) state.ranking = order;
    });

    /* matrix: bk-matrix */
    var matrix = {};
    var hasMatrix = false;
    document.querySelectorAll('.bk-matrix-item').forEach(function (item) {
      if (item.dataset.value) {
        matrix[item.dataset.value] = {
          x: Number(Number(item.dataset.x).toFixed(2)),
          y: Number(Number(item.dataset.y).toFixed(2))
        };
        hasMatrix = true;
      }
    });
    if (hasMatrix) state.matrix = matrix;

    return state;
  }

  /* ── Submit ── */
  function handleSubmit() {
    var btn = document.querySelector('.bk-vs-submit');
    if (!btn || btn.disabled) return;
    var data = collectState();
    window.parent.postMessage({ type: 'bk_visual_submit', data: data }, '*');
    btn.disabled = true;
    btn.classList.add('submitted');
    btn.textContent = '\u2713';
    var status = document.querySelector('.bk-vs-status');
    if (status) status.textContent = 'Submitted';
  }

  /* ── Submit State ── */
  function updateSubmitState() {
    var btn = document.querySelector('.bk-vs-submit');
    if (!btn || btn.classList.contains('submitted')) return;
    /* Enable if user has interacted with any interactable component */
    var hasInteractable =
      document.querySelector('.bk-options, .bk-cards, .bk-checklist, .bk-code-compare, .bk-slider, .bk-ranking, .bk-matrix');
    btn.disabled = !(hasInteractable && hasInteracted);
  }

  /* ── Boot ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVS);
  } else {
    initVS();
  }
})();
```

- [ ] **Step 2: Verify file created**

```bash
wc -l public/vs/helper.js
# Expected: ~235 lines
```

---

## Task 3: Create `public/vs/frame.html`

**Files:**
- Create: `public/vs/frame.html`

**Parallelizable:** Yes (Tasks 1, 2, 3 can run in parallel)

- [ ] **Step 1: Write the complete frame template**

Create `public/vs/frame.html` with the following exact content:

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
      <button class="bk-vs-submit" disabled>Submit</button>
    </div>
  </div>
  <script>/* helper.js inlined here */</script>
</body>
</html>
```

- [ ] **Step 2: Verify**

```bash
cat public/vs/frame.html
```

---

## Task 4: Create `scripts/build-vs-frame.ts` + npm script

**Files:**
- Create: `scripts/build-vs-frame.ts`
- Modify: `package.json`

**Depends on:** Tasks 1, 2, 3

- [ ] **Step 1: Write the build script**

Create `scripts/build-vs-frame.ts` with the following exact content:

```typescript
/**
 * build-vs-frame.ts
 * Reads public/vs/{components.css, helper.js, frame.html},
 * inlines CSS+JS into the frame template, and outputs
 * src/lib/vs-frame.ts as an exported string constant.
 *
 * Usage: npx tsx scripts/build-vs-frame.ts
 */
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");
const vsDir = path.join(root, "public", "vs");

const css = fs.readFileSync(path.join(vsDir, "components.css"), "utf-8");
const js = fs.readFileSync(path.join(vsDir, "helper.js"), "utf-8");
const frame = fs.readFileSync(path.join(vsDir, "frame.html"), "utf-8");

const result = frame
  .replace("/* components.css inlined here */", css)
  .replace("/* helper.js inlined here */", js);

const output = [
  "// Auto-generated by scripts/build-vs-frame.ts — do not edit",
  `export const VS_FRAME_TEMPLATE = ${JSON.stringify(result)};`,
  "",
].join("\n");

const outPath = path.join(root, "src", "lib", "vs-frame.ts");
fs.writeFileSync(outPath, output);

const sizeKB = (Buffer.byteLength(output) / 1024).toFixed(1);
console.log(`[build-vs-frame] wrote ${outPath} (${sizeKB} KB)`);
```

- [ ] **Step 2: Add npm script to package.json**

In `package.json`, add the `build:vs` script after the existing `lint` script:

Old:
```json
    "lint": "eslint",
    "test": "npx vitest run --dir tests"
```

New:
```json
    "lint": "eslint",
    "build:vs": "npx tsx scripts/build-vs-frame.ts",
    "test": "npx vitest run --dir tests"
```

- [ ] **Step 3: Run the build script**

```bash
cd /Users/dante/workspace/dante-code/projects/bluekiwi
npm run build:vs
```

Expected output: `[build-vs-frame] wrote .../src/lib/vs-frame.ts (XX.X KB)`

- [ ] **Step 4: Verify generated file**

```bash
head -2 src/lib/vs-frame.ts
# Expected:
# // Auto-generated by scripts/build-vs-frame.ts — do not edit
# export const VS_FRAME_TEMPLATE = "<!DOCTYPE html>...
```

---

## Task 5: Modify `src/components/task/step-detail.tsx` — VisualSelector

**Files:**
- Modify: `src/components/task/step-detail.tsx`

**Depends on:** Task 4 (needs `VS_FRAME_TEMPLATE`)

- [ ] **Step 1: Add import for VS_FRAME_TEMPLATE**

At the top of the file, add:

```typescript
import { VS_FRAME_TEMPLATE } from "@/lib/vs-frame";
```

- [ ] **Step 2: Add isFragment and wrapWithFrame helper functions**

Add these functions right above the `VisualSelector` function definition (before line 263):

```typescript
/** Detect whether the stored visual_html is a fragment (bk-* components) or full HTML. */
function isFragment(html: string): boolean {
  const trimmed = html.trim();
  return !trimmed.startsWith("<!DOCTYPE") && !trimmed.startsWith("<html");
}

/** Wrap a fragment with the VS frame template, injecting the current theme. */
function wrapWithFrame(html: string): string {
  const theme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  return VS_FRAME_TEMPLATE.replace("{{AGENT_CONTENT}}", html).replace(
    'data-theme="light"',
    `data-theme="${theme}"`,
  );
}
```

- [ ] **Step 3: Update iframe srcDoc to use frame wrapping**

In the VisualSelector component, find the iframe element and change the srcDoc prop.

Old (around line 370):
```tsx
              <iframe
                ref={iframeRef}
                srcDoc={html}
                className="w-full min-h-[600px] bg-white"
                sandbox="allow-scripts"
              />
```

New:
```tsx
              <iframe
                ref={iframeRef}
                srcDoc={isFragment(html) ? wrapWithFrame(html) : html}
                className="w-full min-h-[600px] bg-white dark:bg-[#0f1728]"
                sandbox="allow-scripts"
              />
```

- [ ] **Step 4: Update the message handler to support both protocols**

Replace the existing `handleMessage` function inside the `useEffect` (around lines 304-326):

Old:
```typescript
    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string; value?: string };
      if (data?.type !== "bk_visual_select") return;

      setSubmitting(true);
      fetch(`/api/tasks/${taskId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: nodeId,
          response: data.value ?? "",
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("respond failed");
          setSubmitted(true);
          onSelected?.();
        })
        .catch(() => {
          setSubmitting(false);
        });
    }
```

New:
```typescript
    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const msg = event.data;

      let responsePayload: string | undefined;

      if (msg?.type === "bk_visual_submit") {
        // New protocol: structured JSON data
        responsePayload = JSON.stringify(msg.data);
      } else if (msg?.type === "bk_visual_select") {
        // Legacy protocol: single value → convert to selections array
        responsePayload = JSON.stringify({ selections: [msg.value] });
      }

      if (!responsePayload) return;

      setSubmitting(true);
      fetch(`/api/tasks/${taskId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: nodeId,
          response: responsePayload,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("respond failed");
          setSubmitted(true);
          onSelected?.();
        })
        .catch(() => {
          setSubmitting(false);
        });
    }
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/dante/workspace/dante-code/projects/bluekiwi
npx tsc --noEmit src/components/task/step-detail.tsx 2>&1 | head -20
```

---

## Task 6: Modify `src/app/api/tasks/[id]/respond/route.ts` — History mode

**Files:**
- Modify: `src/app/api/tasks/[id]/respond/route.ts`

**Parallelizable:** Yes (Tasks 6, 7 can run in parallel)

- [ ] **Step 1: Update the GET handler to support node_id query param**

Replace the entire GET handler:

Old:
```typescript
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:read");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const rows = await query<{
    node_id: number;
    step_order: number;
    web_response: string | null;
  }>(
    "SELECT node_id, step_order, web_response FROM task_logs WHERE task_id = $1 AND web_response IS NOT NULL ORDER BY step_order DESC LIMIT 1",
    [Number(id)],
  );

  if (rows.length === 0) {
    const res = okResponse({ task_id: Number(id), web_response: null });
    return NextResponse.json(res.body, { status: res.status });
  }

  const row = rows[0];
  let parsed: unknown = row.web_response;
  try {
    parsed = JSON.parse(row.web_response!);
  } catch {}

  const res = okResponse({
    task_id: Number(id),
    node_id: row.node_id,
    step_order: row.step_order,
    web_response: parsed,
  });
  return NextResponse.json(res.body, { status: res.status });
}
```

New:
```typescript
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:read");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const taskId = Number(id);
  const nodeIdParam = request.nextUrl.searchParams.get("node_id");

  // History mode: return all web_response values for a specific node
  if (nodeIdParam) {
    const nodeId = Number(nodeIdParam);
    const rows = await query<{
      id: number;
      web_response: string | null;
      created_at: string;
    }>(
      "SELECT id, web_response, created_at FROM task_logs WHERE task_id = $1 AND node_id = $2 AND web_response IS NOT NULL ORDER BY id ASC",
      [taskId, nodeId],
    );

    const history = rows.map((row, idx) => {
      let parsed: unknown = row.web_response;
      try {
        parsed = JSON.parse(row.web_response!);
      } catch {}
      return {
        iteration: idx + 1,
        web_response: parsed,
        created_at: row.created_at,
      };
    });

    const res = okResponse({ task_id: taskId, node_id: nodeId, history });
    return NextResponse.json(res.body, { status: res.status });
  }

  // Default mode: return latest web_response (backward compatible)
  const rows = await query<{
    node_id: number;
    step_order: number;
    web_response: string | null;
  }>(
    "SELECT node_id, step_order, web_response FROM task_logs WHERE task_id = $1 AND web_response IS NOT NULL ORDER BY step_order DESC LIMIT 1",
    [taskId],
  );

  if (rows.length === 0) {
    const res = okResponse({ task_id: taskId, web_response: null });
    return NextResponse.json(res.body, { status: res.status });
  }

  const row = rows[0];
  let parsed: unknown = row.web_response;
  try {
    parsed = JSON.parse(row.web_response!);
  } catch {}

  const res = okResponse({
    task_id: taskId,
    node_id: row.node_id,
    step_order: row.step_order,
    web_response: parsed,
  });
  return NextResponse.json(res.body, { status: res.status });
}
```

---

## Task 7: Modify `mcp/src/server.ts` — Tool updates

**Files:**
- Modify: `mcp/src/server.ts`

**Parallelizable:** Yes (Tasks 6, 7 can run in parallel)

- [ ] **Step 1: Update `set_visual_html` tool description**

Find the current `set_visual_html` tool definition (around line 292).

Old:
```typescript
  tool(
    "set_visual_html",
    "Submit shadcn-based selection UI HTML for a visual_selection=true gate node. The web UI will show a '선택하기' button that opens this HTML in an iframe dialog. When the user clicks an element, the selection is POSTed to /respond. Use get_web_response to poll for the result. CSS tokens: --background:#0A0A0A, --foreground:#F5F5F5, --brand-mint:#00D4AA, --border:rgba(255,255,255,0.1), --radius:8px. Each selectable element must have a data-value attribute and onclick: window.parent.postMessage({type:'bk_visual_select',value:this.dataset.value},'*'). IMPORTANT: the postMessage must include type:'bk_visual_select' — the web UI ignores messages without this type.",
    {
      task_id: { type: "number" },
      node_id: { type: "number" },
      html: { type: "string" },
    },
    ["task_id", "node_id", "html"],
  ),
```

New:
```typescript
  tool(
    "set_visual_html",
    `Submit a VS content fragment for a visual_selection=true gate node. Write HTML fragments using bk-* component classes — the frame (CSS, JS, submit button) is added automatically. Do NOT include <html>, <head>, or <body> tags.

Built-in components (use class names directly):
SELECTION (collect choices):
- bk-options: A/B/C cards. Wrap in .bk-options, each .bk-option with data-value. Optional data-recommended badge. Contains .bk-option-letter + .bk-option-body with h3+p.
- bk-cards: Visual cards. Wrap in .bk-cards, each .bk-card with data-value. Contains .bk-card-image + .bk-card-body.
- bk-checklist: Multi-select. Wrap in .bk-checklist, each .bk-check-item with data-value. Optional data-checked for defaults.
- bk-code-compare: Code selection. Wrap in .bk-code-compare, each .bk-code-option with data-value. Contains .bk-code-label + pre.bk-code.

INPUT (collect values):
- bk-slider: Numeric. data-name, data-min, data-max, data-value, data-unit on .bk-slider. Contains label.
- bk-ranking: Drag reorder. Wrap in .bk-ranking, each .bk-rank-item with data-value.
- bk-matrix: 2x2 placement. .bk-matrix with data-x-label, data-y-label. Each .bk-matrix-item with data-value.

DISPLAY (no values):
- bk-split: Side-by-side. Two .bk-split-panel inside .bk-split.
- bk-pros-cons: .bk-pros + .bk-cons inside .bk-pros-cons.
- bk-mockup: .bk-mockup-header + .bk-mockup-body inside .bk-mockup.
- bk-timeline: .bk-timeline-item with data-status="done|current|pending".

Layout: h2 for title, .bk-subtitle, .bk-section for breaks, .bk-label for category.

Response format (JSON via get_web_response):
{selections: ["a"], values: {budget: 70}, ranking: ["security","ux"], matrix: {auth: {x:0.8,y:0.9}}}
Only populated fields are included.`,
    {
      task_id: { type: "number" },
      node_id: { type: "number" },
      html: { type: "string" },
    },
    ["task_id", "node_id", "html"],
  ),
```

- [ ] **Step 2: Update `get_web_response` tool definition**

Find the current `get_web_response` tool definition (around line 274).

Old:
```typescript
  tool(
    "get_web_response",
    "Fetch the pending web response payload for a task",
    {
      task_id: { type: "number" },
    },
    ["task_id"],
  ),
```

New:
```typescript
  tool(
    "get_web_response",
    "Fetch VS response for a task. Without node_id: returns the latest response. With node_id: returns the response history for that node across all loop iterations (web_response only, no visual_html). Useful for tracking how user preferences evolved across iterations.",
    {
      task_id: { type: "number" },
      node_id: { type: "number" },
    },
    ["task_id"],
  ),
```

- [ ] **Step 3: Update the `get_web_response` case handler**

Find the case handler (around line 790).

Old:
```typescript
      case "get_web_response": {
        const taskId = requireNumberArg(args, "task_id");
        return wrap(
          await client.request("GET", `/api/tasks/${taskId}/respond`),
        );
      }
```

New:
```typescript
      case "get_web_response": {
        const taskId = requireNumberArg(args, "task_id");
        const nodeId = typeof args.node_id === "number" ? args.node_id : null;
        const url = nodeId
          ? `/api/tasks/${taskId}/respond?node_id=${nodeId}`
          : `/api/tasks/${taskId}/respond`;
        return wrap(await client.request("GET", url));
      }
```

---

## Task 8: Update `bk-start/SKILL.md`

**Files:**
- Modify: `packages/cli/src/assets/skills/bk-start/SKILL.md`

**Parallelizable:** Yes (Tasks 8, 9 can run in parallel)

- [ ] **Step 1: Rewrite the VS gate section**

Find the current VS section (under "#### Gate step") starting around the `If visual_selection: true:` block.

Replace the current VS content:

Old:
```markdown
- If `visual_selection: true`:
  1. Call `set_visual_html` with interactive HTML
  2. Open the VS deep link in the browser so the user can see and click the selection UI:
     ```bash
     open "${BLUEKIWI_URL:-http://localhost:3100}/tasks/${TASK_ID}?step=${STEP_ORDER}&vs=true"
     ```
  3. Poll `get_web_response` every 3-5 seconds until a response arrives (max 120 seconds)
  4. When the response arrives, use it as the gate answer and call `advance`
```

New:
```markdown
- If `visual_selection: true`:
  1. Compose a VS content **fragment** using `bk-*` component classes. Write **only the inner HTML** — do not include `<html>`, `<head>`, or `<body>` tags. The frame (CSS, JS, submit button) is injected automatically by the web UI.

     **Component quick reference:**
     - Selection: `bk-options` (A/B/C cards, single), `bk-cards` (visual cards, single), `bk-checklist` (multi-select), `bk-code-compare` (code blocks, single)
     - Input: `bk-slider` (numeric range), `bk-ranking` (drag reorder), `bk-matrix` (2x2 drag placement)
     - Display: `bk-split`, `bk-pros-cons`, `bk-mockup`, `bk-timeline`
     - Layout: `h2`, `.bk-subtitle`, `.bk-section`, `.bk-label`

     Every selection/input element needs a `data-value` attribute. Example fragment:
     ```html
     <h2>Choose an approach</h2>
     <p class="bk-subtitle">Select the architecture that best fits your needs</p>
     <div class="bk-options">
       <div class="bk-option" data-value="monolith" data-recommended>
         <div class="bk-option-letter">A</div>
         <div class="bk-option-body"><h3>Monolith</h3><p>Simple deployment</p></div>
       </div>
       <div class="bk-option" data-value="microservices">
         <div class="bk-option-letter">B</div>
         <div class="bk-option-body"><h3>Microservices</h3><p>Independent scaling</p></div>
       </div>
     </div>
     ```

  2. Call `set_visual_html(task_id, node_id, html)` with the fragment.
  3. Open the VS deep link so the user sees the selection UI immediately:
     ```bash
     open "${BLUEKIWI_URL:-http://localhost:3100}/tasks/${TASK_ID}?step=${STEP_ORDER}&vs=true"
     ```
  4. Poll `get_web_response(task_id)` every 3-5 seconds until a response arrives (max 120 seconds).
  5. The response is a **JSON object** (not a plain string). Parse it to read the user's choices:
     ```json
     {"selections": ["monolith"], "values": {"budget": 70}, "ranking": ["security", "ux"]}
     ```
     - `selections`: chosen option values (from bk-options, bk-cards, bk-checklist, bk-code-compare)
     - `values`: numeric inputs (from bk-slider, keyed by data-name)
     - `ranking`: ordered list (from bk-ranking)
     - `matrix`: placement coordinates (from bk-matrix)
     Only populated fields appear.
  6. Use the parsed response to form the gate answer and call `advance`.
```

- [ ] **Step 2: Add Loop + VS History pattern**

After the existing Loop section (after the `</HARD-RULE>` around line 229), add a new subsection:

```markdown
#### Loop + VS History Pattern

When a loop node uses `visual_selection: true`, each iteration presents a VS screen and collects a response. Use `get_web_response(task_id, node_id)` to access all previous iteration responses for that node:

```json
{
  "task_id": 19,
  "node_id": 109,
  "history": [
    {"iteration": 1, "web_response": {"selections": ["a"]}, "created_at": "..."},
    {"iteration": 2, "web_response": {"selections": ["b"], "values": {"confidence": 80}}, "created_at": "..."}
  ]
}
```

Use the history to adapt subsequent VS screens — for example, pre-selecting the user's previous choice, adjusting slider defaults based on past values, or skipping already-confirmed items.
```

---

## Task 9: Update other skills (parallelizable)

**Files:**
- Modify: `packages/cli/src/assets/skills/bk-design/SKILL.md`
- Modify: `packages/cli/src/assets/skills/bk-improve/SKILL.md`
- Modify: `packages/cli/src/assets/skills/bk-instruction/SKILL.md`
- Modify: `packages/cli/src/assets/skills/bk-approve/SKILL.md`
- Modify: `packages/cli/src/assets/skills/bk-report/SKILL.md`

**Parallelizable:** Yes (all 5 skills can be updated in parallel; also parallel with Task 8)

### 9a: bk-design — VS Node Design Guidelines

- [ ] **Step 1: Add VS component guidance to "Node Design Guidelines" section**

After the existing `visual_selection: true` bullet (around line 182), append:

```markdown

#### VS Component Selection Guide

When designing a `visual_selection: true` gate node, specify which `bk-*` components the agent should use in the node instruction. This ensures consistent, well-structured VS screens.

**Component → Use Case mapping:**
| Component | Best for |
|-----------|----------|
| `bk-options` | Mutually exclusive choices with descriptions (A/B/C decisions) |
| `bk-cards` | Visual previews (layout, chart type, UI template selection) |
| `bk-checklist` | Feature toggles, multi-select from a list |
| `bk-code-compare` | Comparing code approaches side by side |
| `bk-slider` | Budget allocation, confidence levels, thresholds |
| `bk-ranking` | Priority ordering (requirements, features) |
| `bk-matrix` | Urgency/importance mapping, risk assessment |

**Instruction template pattern:**
```
Present the options using bk-options with data-recommended on the suggested choice.
Include a bk-slider for confidence level (0-100).
```
```

### 9b: bk-improve — VS Node Review

- [ ] **Step 1: Add VS review checklist to Step 3 analysis section**

After the existing bullet list in Step 3 (around line 67), append:

```markdown
- Legacy VS nodes using inline onclick/postMessage → migrate to bk-* component fragments
- VS nodes missing component specification in instruction → add which bk-* components to use
- VS response format mismatch → verify downstream steps parse JSON `{selections, values, ranking, matrix}` instead of plain strings
```

- [ ] **Step 2: Add VS guidance to Attachment Management section**

After the existing attachment management section (around line 169), append:

```markdown

### VS Node Improvement

When improving a node with `visual_selection: true`:
- Check if the node still uses legacy inline HTML (full `<!DOCTYPE>` documents with inline styles). If so, migrate to bk-* component fragments.
- Verify the instruction specifies which bk-* components to use (e.g., "Present using bk-options with bk-slider for confidence").
- Check that downstream steps reading `get_web_response` parse the JSON response object (`{selections, values, ranking, matrix}`) correctly, not treating it as a plain string.
```

### 9c: bk-instruction — VS Component Directives

- [ ] **Step 1: Add VS section after the "Generate AI draft" format block**

After the Output Format / Success Criteria template block (around line 92), add:

```markdown

#### VS Component Directives

When writing instructions for `visual_selection: true` gate nodes, include a VS directive block that tells the execution agent which components to render:

```
## VS Components
Use bk-options for the main selection. Add data-recommended to the suggested choice.
Include a bk-slider named "confidence" (0-100, default 75, unit "%").
Add a bk-section break before the slider.
```

The execution agent reads this directive and composes the corresponding bk-* HTML fragment. Available components: bk-options, bk-cards, bk-checklist, bk-code-compare, bk-slider, bk-ranking, bk-matrix, bk-split, bk-pros-cons, bk-mockup, bk-timeline.
```

### 9d: bk-approve — VS JSON Response Parsing

- [ ] **Step 1: Update Step 2a to parse VS JSON responses**

In Step 2a (Gate Step), after the line "Check `get_web_response` for a pre-submitted web response. If found, show it and ask to confirm." (around line 38), expand:

```markdown
   If the web response is a JSON object (from bk-* components), display a readable summary:
   ```
   VS Response:
   - Selected: [option names from selections array]
   - Values: budget = 70%, confidence = 85%
   - Ranking: 1. Security, 2. Performance, 3. UX
   - Matrix: auth → high urgency/high importance
   ```
   Map `selections` values back to the option labels shown in the VS screen. Present `values` with their units, `ranking` as a numbered list, and `matrix` positions as quadrant descriptions (high/low for each axis).
```

### 9e: bk-report — VS Response Formatting

- [ ] **Step 1: Add VS response section to the report template**

In Step 3 (Generate Report), after the "Step-by-Step Log" table and before the "Artifacts" section (around line 61), add:

```markdown

## VS Responses

{for each step with web_response data}
### Step {N}: {title}
{format the JSON response as readable text}
- **Selected**: {selections joined with ", "}
- **Values**: {key = value for each entry in values}
- **Priority ranking**: {ranking as numbered list}
- **Matrix placement**: {item → quadrant description for each entry}

{if no VS responses}
No visual selection responses recorded.
```

---

## Task 10: Modify `src/app/(app)/settings/page.tsx` — Storage section

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/lib/auth.ts`

**Depends on:** Task 11 (API endpoint)

- [ ] **Step 1: Add `settings:manage` permission to auth.ts**

In `src/lib/auth.ts`, find the PERMISSIONS object (around line 120) and add:

Old:
```typescript
  // Instructions
  "instructions:read": "viewer" as Role,
  "instructions:write": "editor" as Role,
} as const;
```

New:
```typescript
  // Instructions
  "instructions:read": "viewer" as Role,
  "instructions:write": "editor" as Role,

  // Settings
  "settings:manage": "superuser" as Role,
} as const;
```

- [ ] **Step 2: Add Storage tab and cleanup button to settings page**

In `src/app/(app)/settings/page.tsx`, add the following changes:

First, add imports. After the existing lucide imports:

Old:
```typescript
import { Bell, Settings } from "lucide-react";
```

New:
```typescript
import { Bell, HardDrive, Settings } from "lucide-react";
```

Add Button import. After the Card imports:

Old:
```typescript
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
```

New:
```typescript
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
```

Add state variables after the existing `loading` state:

Old:
```typescript
  const [loading, setLoading] = useState(true);
```

New:
```typescript
  const [loading, setLoading] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
```

Add `isSuperuser` check after `isAdmin`:

Old:
```typescript
  const isAdmin = user?.role === "admin" || user?.role === "superuser";
```

New:
```typescript
  const isAdmin = user?.role === "admin" || user?.role === "superuser";
  const isSuperuser = user?.role === "superuser";
```

Add the cleanup handler function before the `if (loading)` check:

```typescript
  async function handleCleanupVisualHtml() {
    if (!confirm("Clear visual HTML cache from completed/failed tasks? web_response data will be preserved.")) return;
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/settings/cleanup-visual-html", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const count = json?.data?.cleared_count ?? 0;
      setCleanupResult(`Cleared ${count} visual HTML entries.`);
    } catch {
      setCleanupResult("Failed to clear visual HTML cache.");
    } finally {
      setCleanupLoading(false);
    }
  }
```

Add the Storage tab trigger after the notifications TabsTrigger:

Old:
```tsx
          <TabsTrigger value="notifications">
            {t("settings.notifications")}
          </TabsTrigger>
```

New:
```tsx
          <TabsTrigger value="notifications">
            {t("settings.notifications")}
          </TabsTrigger>
          {isSuperuser && (
            <TabsTrigger value="storage">Storage</TabsTrigger>
          )}
```

Add the Storage TabsContent after the notifications TabsContent (before the closing `</div>` of the mt-4 wrapper):

After the `</TabsContent>` for notifications, add:

```tsx
          {isSuperuser && (
            <TabsContent value="storage">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-[var(--muted-foreground)]" />
                    <CardTitle>Storage</CardTitle>
                  </div>
                  <CardDescription>
                    Manage VS render cache and storage usage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-[var(--border)] p-4">
                    <div>
                      <p className="text-sm font-medium">VS Render Cache</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Clear visual_html from completed/failed tasks. web_response data is preserved.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCleanupVisualHtml}
                      disabled={cleanupLoading}
                    >
                      {cleanupLoading ? "Clearing..." : "Clear Cache"}
                    </Button>
                  </div>
                  {cleanupResult && (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {cleanupResult}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
```

---

## Task 11: Create `src/app/api/settings/cleanup-visual-html/route.ts`

**Files:**
- Create: `src/app/api/settings/cleanup-visual-html/route.ts`

**Parallelizable:** Yes (can be done in parallel with Task 10)

- [ ] **Step 1: Create directory**

```bash
mkdir -p /Users/dante/workspace/dante-code/projects/bluekiwi/src/app/api/settings/cleanup-visual-html
```

- [ ] **Step 2: Write the route handler**

Create `src/app/api/settings/cleanup-visual-html/route.ts` with the following exact content:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { execute, okResponse, errorResponse } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request, "settings:manage");
  if (authResult instanceof NextResponse) return authResult;

  // Nullify visual_html on completed/failed tasks (preserves web_response)
  const result = await execute(
    `UPDATE task_logs SET visual_html = NULL
     WHERE task_id IN (SELECT id FROM tasks WHERE status IN ('completed', 'failed'))
       AND visual_html IS NOT NULL`,
  );

  const res = okResponse({
    cleared_count: result.rowCount ?? 0,
  });
  return NextResponse.json(res.body, { status: res.status });
}
```

---

## Task 12: Update `src/lib/openapi.ts`

**Files:**
- Modify: `src/lib/openapi.ts`

**Parallelizable:** Yes (can be done in parallel with Tasks 10-11)

- [ ] **Step 1: Update `/api/tasks/{id}/respond` GET description and add node_id parameter**

Find the current GET definition for `/api/tasks/{id}/respond` (around line 1386).

Old:
```typescript
    "/api/tasks/{id}/respond": {
      get: {
        tags: ["Task Execution"],
        summary: "Visual Selection 응답 폴링",
        description: "에이전트가 사용자의 Visual Selection 응답을 폴링합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "web_response가 null이면 아직 응답 없음",
          },
        },
      },
```

New:
```typescript
    "/api/tasks/{id}/respond": {
      get: {
        tags: ["Task Execution"],
        summary: "VS response polling",
        description:
          "Poll for VS response. Without node_id: returns the latest web_response. With node_id: returns the response history for that node across all loop iterations.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
          {
            name: "node_id",
            in: "query",
            required: false,
            schema: { type: "integer" },
            description:
              "When provided, returns all web_response values for this node as a history array with iteration numbers.",
          },
        ],
        responses: {
          "200": {
            description:
              "Without node_id: {task_id, node_id, step_order, web_response}. With node_id: {task_id, node_id, history: [{iteration, web_response, created_at}]}",
          },
        },
      },
```

- [ ] **Step 2: Update `/api/tasks/{id}/visual` POST description**

Find the current visual endpoint definition (around line 1437).

Old:
```typescript
        summary: "Visual HTML 제출 (set_visual_html)",
```

New:
```typescript
        summary: "Submit VS content fragment (set_visual_html)",
```

Also update the html property description:

Old:
```typescript
                  html: {
                    type: "string",
                    description: "Visual Selection UI HTML",
                  },
```

New:
```typescript
                  html: {
                    type: "string",
                    description:
                      "VS content fragment using bk-* component classes. Do not include <html>/<head>/<body> — the frame is injected automatically.",
                  },
```

- [ ] **Step 3: Add POST /api/settings/cleanup-visual-html endpoint**

Find a good location in the openapi spec to add the new settings endpoint. After the last existing endpoint definition and before the closing of the `paths` object, add:

```typescript
    "/api/settings/cleanup-visual-html": {
      post: {
        tags: ["Settings"],
        summary: "Clear VS render cache",
        description:
          "Nullify visual_html on completed/failed tasks. Preserves web_response. Superuser only.",
        responses: {
          "200": {
            description: "Returns {cleared_count: number}",
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden — superuser only" },
        },
      },
    },
```

---

## Task 13: Integration test + build + deploy verification

**Depends on:** All previous tasks

- [ ] **Step 1: Rebuild VS frame**

```bash
cd /Users/dante/workspace/dante-code/projects/bluekiwi
npm run build:vs
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Run existing tests**

```bash
npm test 2>&1 | tail -20
```

- [ ] **Step 4: Manual smoke test**

Start the dev server and verify:

1. Open a task with a VS gate step
2. Use the MCP tool to set a bk-* fragment:
   ```
   set_visual_html(task_id, node_id, '<h2>Test</h2><div class="bk-options"><div class="bk-option" data-value="a"><div class="bk-option-letter">A</div><div class="bk-option-body"><h3>Option A</h3><p>Description</p></div></div></div>')
   ```
3. Verify the fragment is wrapped in the frame (has design tokens, submit button)
4. Click an option, click Submit
5. Verify `get_web_response` returns `{"selections": ["a"]}`
6. Test dark mode toggle (the iframe should switch themes)
7. Test legacy full-HTML (should render as-is without frame)
8. Test history mode: `get_web_response(task_id, node_id)` returns history array
9. Test cleanup: Settings > Storage > Clear Cache (superuser only)

- [ ] **Step 5: Build production bundle**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add public/vs/ scripts/build-vs-frame.ts src/lib/vs-frame.ts \
  src/components/task/step-detail.tsx \
  src/app/api/tasks/\[id\]/respond/route.ts \
  src/app/api/settings/cleanup-visual-html/route.ts \
  src/app/\(app\)/settings/page.tsx \
  src/lib/auth.ts src/lib/openapi.ts \
  mcp/src/server.ts \
  packages/cli/src/assets/skills/ \
  package.json

git commit -m "feat(vs): add VS Design System with 12 bk-* components, frame template, and structured JSON response protocol"
```
