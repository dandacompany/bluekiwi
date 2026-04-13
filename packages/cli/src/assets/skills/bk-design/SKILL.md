---
name: bk-design
description: BlueKiwi workflow design skill. Takes a natural language goal and designs a structured workflow, then registers it on the server. This skill should be used when the user says "/bk-design", "create workflow", "design new workflow", or wants to build a new BlueKiwi workflow from scratch.
user_invocable: true
---

# BlueKiwi Workflow Design

Design a structured workflow from a natural language goal and register it on the BlueKiwi server.

## Argument Handling

- `/bk-design` → Ask for the goal via AskUserQuestion.
- `/bk-design <goal>` → Start designing from the provided goal.

## Core Principles

- One node = **one agent action**. Split overly large chunks.
- `node_type: "action"` = regular agent step; auto-advances unless `hitl: true`.
- `node_type: "gate"` = user decision point; always pauses for human approval.
- `node_type: "loop"` = repeating step; set `loop_back_to` to the target step order.
- `hitl: true` = action node that requires explicit human approval before advancing. Default: `false`.
- `visual_selection: true` = gate node where the agent renders an HTML UI and the user makes a selection by clicking (instead of typing). Only valid on `gate` nodes. Default: `false`.

## Execution Steps

### Step 1: Understand the Goal

Extract the goal from arguments. If none, ask via AskUserQuestion:

- header: "What to build?"
- "What task would you like to automate? Please describe in detail."
- options: ["Competitor analysis", "Code review", "Report generation", "Type my own"]

If "Type my own" → accept free-text goal input.

### Step 2: Check for Existing Workflows

Call `list_workflows` to check for similar existing workflows.

If a similar one is found, ask via AskUserQuestion:

- header: "Existing workflow"
- "'{title}' already exists. Create a new one or improve the existing one?"
- options: ["Create new", "Improve existing (switch to /bk-improve)"]

If "Improve existing" → switch to `/bk-improve` flow.

### Step 3: Select Folder

Call `list_folders` to get the folder list.

Ask via AskUserQuestion:

- header: "Save location"
- "Which folder should this be saved in?"
- options: folder name list (up to 4) + "My Workspace (default)"

### Step 4: Design Workflow Structure

Analyze the goal and design the nodes.

**Node structure example:**

```json
{
  "title": "Clarify Goal",
  "instruction": "Analyze the user's stated goal and extract the 3 most important clarifying questions.",
  "node_type": "action",
  "hitl": false,
  "order": 1
}
```

Show the design to the user:

```
Designed workflow: <title>
━━━━━━━━━━━━━━━━━━━━━━━━━
1. [Clarify Goal]     action
2. [Collect Data]     action
3. [Run Analysis]     action
4. [Review Results]   gate ← pauses for human approval
5. [Generate Report]  action
━━━━━━━━━━━━━━━━━━━━━━━━━
5 steps total
```

Ask via AskUserQuestion:

- header: "Confirm"
- "Create the workflow with this structure?"
- options: ["Create", "Edit", "Cancel"]

If "Edit" → accept modification input and redesign.

### Step 5: Register Workflow

Call `create_workflow`:

```json
{
  "title": "<workflow title>",
  "description": "<goal summary>",
  "version": "1.0",
  "folder_id": <selected folder id>,
  "nodes": [...]
}
```

### Step 6: Report Result + Open in Browser

On success, open the workflow detail page in the browser:

```bash
open "${BLUEKIWI_URL:-http://localhost:3100}/workflows/${WORKFLOW_ID}"
```

Then display:

```
✅ Workflow registered
Name: <title> (ID: <id>)
Steps: <n>
Version: 1.0
🔗 ${BLUEKIWI_URL}/workflows/${WORKFLOW_ID}

Type `/bk-run` to execute it now.
```

## Node Type Reference

### action — Auto-executing agent step

- `auto_advance=1` (automatic). The agent executes the instruction, saves the result, and automatically proceeds to the next step.
- Set `hitl: true` to require human approval after execution. Use only for security-sensitive or irreversible operations.

### gate — User decision point

- `auto_advance=0`. Must receive a user response before proceeding.
- Set `visual_selection: true` to have the agent render an HTML UI where the user selects by clicking.
- Used for final result review, direction choices, approval/rejection, etc.

### loop — Conditional repetition

- `auto_advance=0`. Repeats the same step until the termination condition is met.
- `loop_back_to`: target step_order to loop back to. Usually points to itself (self-loop).
- **The instruction MUST include a clear termination condition** so the agent can decide `loop_continue=true/false`.

**Loop node design patterns:**

```json
{
  "title": "Clarifying Questions",
  "node_type": "loop",
  "loop_back_to": 4,
  "instruction": "Ask one question at a time. Use multiple choice when possible.\n\nGather:\n- Purpose: What problem does this feature solve?\n- Constraints: Tech stack, performance, security limitations?\n- Success criteria: What defines completion?\n\nTermination: End when purpose, scope, constraints, and success criteria are all clear."
}
```

```json
{
  "title": "Design Section Presentation",
  "node_type": "loop",
  "loop_back_to": 7,
  "instruction": "Present the design section by section.\nEach section scales with complexity: a few sentences if simple, 200-300 words if nuanced.\nCover: architecture, components, data flow, error handling, testing.\nAfter each section, ask the user for confirmation.\n\nTermination: End when all design sections have been approved by the user."
}
```

**When to use loop nodes:**

- Information gathering (question → answer repetition)
- Section-by-section presentation/review (present → approve repetition)
- Iterative refinement (result → feedback → revision repetition)

## Node Design Guidelines

- 3–7 steps is ideal. Consider splitting if more than 10.
- Use `node_type: "gate"` before the final step to let the user review results.
- Use `node_type: "loop"` when a step needs iterative user interaction. Always include a clear termination condition in the instruction.
- Use `hitl: true` on `action` nodes only when the step requires explicit human judgment mid-flow (e.g., security-sensitive operations, irreversible actions).
- Use `visual_selection: true` on `gate` nodes when the selection is best expressed visually — e.g., choosing a layout, picking a chart type, selecting a UI template. The agent must call `set_visual_html` with interactive HTML before executing the step; the user's click supplies the response.
- For nodes requiring external API calls, specify `credential_id`. Create credentials first with `/bk-credential`.

#### VS Component Selection Guide

When designing a `visual_selection: true` gate node, specify which `bk-*` components the agent should use in the node instruction. This keeps VS screens consistent and prevents vague "make a selection UI" instructions.

<HARD-RULE>
- VS content shown to the user must be written in the user's language.
- Labels, option descriptions, helper text, slider units, ranking item names, and matrix axis labels must all follow the user's language.
- Keep component class names and JSON keys in their canonical English forms (`bk-options`, `selections`, `values`, `ranking`, `matrix`).
</HARD-RULE>

**Dialog size directive — add as the first line of the HTML:**

```html
<!-- @bk size=sm -->
<!-- default 448px: simple options, checklist -->
<!-- @bk size=md -->
<!-- 672px: cards, code-compare -->
<!-- @bk size=lg -->
<!-- 896px: pros-cons, ranking, timeline -->
<!-- @bk size=xl -->
<!-- 1152px: mockups, matrix, side-by-side wireframes -->
<!-- @bk size=full -->
<!-- 95vw: dashboard previews, complex layouts -->
```

Rule: choose `xl` or `full` whenever content benefits from horizontal space (side-by-side comparisons, wireframe mockups, multi-column layouts). Omit or use `sm` for simple single-column choices.

**Component → Use Case mapping:**

| Component         | Recommended size | Best for                                                       |
| ----------------- | ---------------- | -------------------------------------------------------------- |
| `bk-options`      | `sm`             | Mutually exclusive choices with descriptions (A/B/C decisions) |
| `bk-cards`        | `md`             | Visual previews (layout, chart type, UI template selection)    |
| `bk-checklist`    | `sm`             | Feature toggles, multi-select from a list                      |
| `bk-code-compare` | `lg`             | Comparing code approaches side by side                         |
| `bk-slider`       | `sm`             | Budget allocation, confidence levels, thresholds               |
| `bk-ranking`      | `md`             | Priority ordering (requirements, features)                     |
| `bk-matrix`       | `xl`             | Urgency/importance mapping, risk assessment                    |
| `bk-split`        | `xl`             | Two-option comparison (A vs B)                                 |
| `bk-pros-cons`    | `lg`             | Pros and cons review                                           |
| `bk-mockup`       | `xl` or `full`   | UI wireframe / layout previews                                 |
| `bk-timeline`     | `lg`             | Roadmap / milestone review                                     |

**Instruction template patterns:**

```text
Present the alternatives using bk-options with data-recommended on the suggested choice.
(dialog: sm — default, no directive needed)
```

```text
Show the layout candidates using bk-cards (size=md), then add a bk-slider named "confidence" (0-100, unit "%").
Start the HTML with: <!-- @bk size=md -->
```

```text
Collect optional capabilities with bk-checklist and ask the user to rank the top three priorities using bk-ranking.
(dialog: sm or md — omit directive or use <!-- @bk size=md -->)
```

```text
Compare the two implementation approaches using bk-code-compare (size=lg), then capture risk posture in a bk-matrix (size=xl).
If both appear on the same screen, use the larger size: <!-- @bk size=xl -->
```

```text
Show a UI wireframe mockup or dashboard layout preview using bk-mockup with inline styles.
Start the HTML with: <!-- @bk size=xl --> or <!-- @bk size=full -->
Place two mockup cards side by side using display:grid;grid-template-columns:1fr 1fr.
```

### Attachments

- Use node attachments for scripts, reference docs, prompts, and config files that the agent should load during execution.
- Add attachments only after the workflow and target node exist, using `upload_attachment(workflow_id, node_id, filename, content)`.
- Prefer text-based files so the execution skill can download and use their contents directly.
- Mention the attachment by filename in the node instruction when the agent is expected to read it.
- Keep attachments node-specific. Shared reusable logic belongs in an instruction template or a separate workflow step, not duplicated across many nodes.
- Use binary attachments only when necessary. Execution agents may only inspect their metadata unless the task explicitly requires the binary asset.

## Node Modification Strategy

<HARD-RULE>
- Update a single node → `update_node(workflow_id, node_id, ...only changed fields)`
- Append a node (at the end) → `append_node(workflow_id, title, instruction, node_type, loop_back_to?, visual_selection?)`
- Insert a node (in the middle) → `insert_node(workflow_id, after_step=N, title, instruction, node_type, loop_back_to?, visual_selection?)`
- Delete a node → `remove_node(workflow_id, node_id)`
- Never use `update_workflow(nodes=[...])` for full replacement unless a complete redesign is intended
</HARD-RULE>

## Inline vs Template Instructions

Nodes can have two types of instructions:

- **Template reference**: Node has `instruction_id` set. References a shared instruction template. Use `update_instruction` to modify the template — affects all nodes that reference it.
- **Inline instruction**: Node has no `instruction_id` and stores text directly in the `instruction` field. Use `update_node(workflow_id, node_id, instruction="new text")` to modify — affects only that node.

```
# Update inline instruction — affects only this node
update_node(workflow_id=67, node_id=109, instruction="new instruction text")

# Update instruction template — affects all referencing nodes
update_instruction(instruction_id=5, content="new template text")
```

## Folder & Workflow Organization

Triggered when the user says "move workflow", "change folder", "organize", or "create folder".

### Move an Existing Workflow to a Different Folder

1. Call `list_workflows` to identify the target workflow (or use the name the user mentioned).
2. Call `list_folders` to get the folder list.
3. Ask via AskUserQuestion:
   - header: "Move to"
   - "Which folder should '{workflow title}' be moved to?"
   - options: folder name list + "My Workspace (default)"
4. Call `move_workflow`:
   ```json
   { "workflow_id": <id>, "folder_id": <destination folder id> }
   ```
5. Report: `✅ Moved '{workflow title}' → '{folder name}'`

### Create a Standalone Folder

1. Ask for name and optional visibility (`personal` / `group` / `public`).
2. Call `create_folder`:
   ```json
   { "name": "<name>", "description": "<desc>", "visibility": "personal" }
   ```
3. Report: `✅ Folder '{name}' created.`

### Rename a Folder

Call `update_folder`:

```json
{ "folder_id": <id>, "name": "<new name>" }
```

### Delete an Empty Folder

Call `delete_folder`:

```json
{ "folder_id": <id> }
```

> Note: `delete_folder` fails with `FOLDER_NOT_EMPTY` if the folder contains any workflows, instructions, credentials, or sub-folders. Empty the folder first.
