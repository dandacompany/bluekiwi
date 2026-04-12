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

### Step 4: Design Improved Nodes

Design the full improved node set.

Show a diff of the changes:

```
Improvements:
━━━━━━━━━━━━━━━━━━━━━━━━━
✏️  Step 1: "Collect keywords" → "Collect top 10 keywords (by search volume)"
➕  Step 4 added: "Quantitative validation (retry if below threshold)"
━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask via AskUserQuestion:

- header: "Confirm"
- "Create a new version (v<x.y>) with these improvements?"
- options: ["Create new version", "Adjust more", "Cancel"]

### Step 5: Create New Version

Call `update_workflow` with `create_new_version: true`:

```json
{
  "workflow_id": <existing id>,
  "create_new_version": true,
  "version": "<new version>",
  "nodes": [<improved node array>]
}
```

### Step 6: Offer Immediate Execution

Ask via AskUserQuestion:

- header: "Run now?"
- "New version v<x.y> created. Run it now to check results?"
- options: ["Run now", "Run later"]

If "Run now" → switch to `/bk-run` flow and start a task with the new version.

### Step 7: Report Result

```
✅ New version created
Workflow: <title>
Previous: v<old>  →  New: v<new>
Improved steps: <n>
```

## Node Modification Strategy

<HARD-RULE>
- Update a single node → `update_node(workflow_id, node_id, ...only changed fields)`
- Append a node (at the end) → `append_node(workflow_id, title, instruction, node_type, loop_back_to?, visual_selection?)`
- Insert a node (in the middle) → `insert_node(workflow_id, after_step=N, title, instruction, node_type, loop_back_to?, visual_selection?)`
- Delete a node → `remove_node(workflow_id, node_id)`
- Never use `update_workflow(nodes=[...])` for full replacement unless a complete redesign is intended
</HARD-RULE>
