---
name: bk-improve
description: BlueKiwi workflow improvement skill. Analyzes an existing workflow, creates a better version, and optionally runs it to compare results. This skill should be used when the user says "/bk-improve", "improve workflow", "make a better version", or wants to refine an existing BlueKiwi workflow.
user_invocable: true
---

# BlueKiwi Workflow Improve

Improve an existing workflow by creating a new version, then optionally execute it to compare results.

## Argument Handling

- `/bk-improve` → Fetch workflow list, ask user to select.
- `/bk-improve <workflow name>` → Load that workflow directly.

## Execution Steps

### Step 1: Select Target Workflow

If no argument, call `list_workflows` and ask via AskUserQuestion:

- header: "Which workflow?"
- "Which workflow would you like to improve?"
- options: workflow title list (up to 4)

### Step 2: Understand Improvement Direction

Ask via AskUserQuestion:

- header: "Improvement goal"
- "What would you like to improve?"
- options: ["Set more quantitative goals", "Break steps into finer detail", "Improve accuracy", "Type my own"]

If "Type my own" → accept free-text improvement direction.

### Step 3: Analyze the Current Workflow

## Leveraging Feedback Data

When improving a workflow, call `advance(peek=true)` on a past task to check for `feedback_data`.
If `feedback_data` exists, use it as the primary input for improvement analysis:

1. Read each feedback item's `question` and `answer`
2. Identify negative responses (unsatisfied, insufficient, etc.)
3. Prioritize steps related to that feedback for improvement
4. Explicitly note "based on user feedback" when proposing changes

Display the current workflow node structure:

```
Current workflow: <title> v<version>
━━━━━━━━━━━━━━━━━━━━━━━━━
1. [Step name] — <instruction summary>
2. [Step name] — <instruction summary>
...
━━━━━━━━━━━━━━━━━━━━━━━━━
```

Review each node against the improvement direction:

- Vague goals → add quantitative criteria
- Oversized steps → split them
- Missing validation → add it
- Unnecessary steps → remove them
- Missing attachments → add the required script, reference doc, or config file
- Stale attachments → remove outdated files and replace them with the current version
- Unclear attachment usage → update the instruction so it references the attachment by filename and explains when to use it

### Step 4: Propose Changes

Design the improvements and show a diff:

```
Proposed improvements:
━━━━━━━━━━━━━━━━━━━━━━━━━
✏️  Step 1: "Collect keywords" → "Collect top 10 keywords (by search volume)"
✏️  Step 3: instruction refined (add termination criteria)
➕  Step 4 added: "Quantitative validation (retry if below threshold)"
🗑️  Step 6 removed: redundant summary
━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 5: Choose Modification Strategy

Ask via AskUserQuestion:

- header: "How to apply?"
- options: ["Edit in place (patch current version)", "Create new version (v<x.y>)", "Adjust more", "Cancel"]

**Edit in place** — for minor tweaks (instruction wording, adding/removing 1-2 nodes). Modifies the current active version directly.

**Create new version** — for substantial restructuring (reordering steps, changing node types, major logic changes). Creates a new version in the same family; old version is archived.

### Step 5a: Edit in Place (update_node)

Apply changes one by one using granular MCP tools:

```
# Update inline instruction for a single node
update_node(workflow_id=67, node_id=109, instruction="new instruction text")

# Update node title
update_node(workflow_id=67, node_id=110, title="New Title")

# Change node type or add loop
update_node(workflow_id=67, node_id=112, node_type="loop", loop_back_to=7)

# Add a new node after step 3
insert_node(workflow_id=67, after_step=3, title="Validation", instruction="...", node_type="action")

# Remove a node
remove_node(workflow_id=67, node_id=115)
```

<HARD-RULE>
When editing in place, apply each change as a separate `update_node`, `insert_node`, `append_node`, or `remove_node` call. Never use `update_workflow(nodes=[...])` for in-place edits — it replaces ALL nodes and loses node IDs.
</HARD-RULE>

After all changes, report:

```
✅ Workflow updated in place
Workflow: <title> v<version>
Changes: <n> nodes modified, <n> added, <n> removed
```

### Step 5b: Create New Version

Call `update_workflow` with `create_new_version: true`:

```json
{
  "workflow_id": <existing id>,
  "create_new_version": true,
  "version": "<new version>",
  "nodes": [<full improved node array>]
}
```

Report:

```
✅ New version created
Workflow: <title>
Previous: v<old>  →  New: v<new>
Changed steps: <n>
```

### Step 6: Offer Immediate Execution

Ask via AskUserQuestion:

- header: "Run now?"
- "Run the updated workflow now to verify changes?"
- options: ["Run now", "Run later"]

If "Run now" → switch to `/bk-run` flow.

## Attachment Management

- Add new text attachments with `upload_attachment(workflow_id, node_id, filename, content)` when a node needs reusable execution context.
- Remove obsolete files with `delete_attachment(workflow_id, node_id, attachment_id)` instead of leaving stale materials attached.
- When improving a node, keep its attachments aligned with the revised instruction. If the instruction changes, verify the referenced filenames and file contents still match.
- Prefer replacing outdated text attachments with a freshly uploaded version rather than keeping multiple conflicting variants on the same node.

## Node Modification Strategy

<HARD-RULE>
- Update a single node → `update_node(workflow_id, node_id, ...only changed fields)`
- Append a node (at the end) → `append_node(workflow_id, title, instruction, node_type, loop_back_to?, visual_selection?)`
- Insert a node (in the middle) → `insert_node(workflow_id, after_step=N, title, instruction, node_type, loop_back_to?, visual_selection?)`
- Delete a node → `remove_node(workflow_id, node_id)`
- Never use `update_workflow(nodes=[...])` for full replacement unless a complete redesign is intended
</HARD-RULE>
