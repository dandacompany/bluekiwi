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

### Step 6: Report Result

On success:

```
✅ Workflow registered
Name: <title> (ID: <id>)
Steps: <n>
Version: 1.0

Type `/bk-run` to execute it now.
```

## Node Design Guidelines

- 3–7 steps is ideal. Consider splitting if more than 10.
- Use `node_type: "gate"` before the final step to let the user review results.
- Use `hitl: true` on `action` nodes only when the step requires explicit human judgment mid-flow (e.g., security-sensitive operations, irreversible actions).
- For nodes requiring external API calls, specify `credential_id`. Create credentials first with `/bk-credential`.

## 노드 수정 전략

<HARD-RULE>
- 노드 1개 수정 → `update_node(workflow_id, node_id, ...변경할 필드만)`
- 노드 추가 (끝에) → `append_node(workflow_id, title, instruction, node_type)`
- 노드 삽입 (중간) → `insert_node(workflow_id, after_step=N, title, instruction, node_type)`
- 노드 삭제 → `remove_node(workflow_id, node_id)`
- 전체 재설계가 아닌 이상 `update_workflow(nodes=[...])` 전체 교체 호출 금지
</HARD-RULE>
