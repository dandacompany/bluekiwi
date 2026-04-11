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
- `auto_advance: true` = proceeds without user intervention. Suitable for data collection and transformation steps.
- `auto_advance: false` = requires user confirmation or judgment.
- `node_type` must be either `"agent"` (agent execution) or `"gate"` (user decision).

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
  "node_type": "agent",
  "auto_advance": true,
  "order": 1
}
```

Show the design to the user:

```
Designed workflow: <title>
━━━━━━━━━━━━━━━━━━━━━━━━━
1. [Clarify Goal]     (auto)
2. [Collect Data]     (auto)
3. [Run Analysis]     (auto)
4. [Review Results]   ← pauses here
5. [Generate Report]  (auto)
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
- The first step should always be `auto_advance: false` (user provides initial context).
- Insert a `gate` node (result review) before the final step.
- For nodes requiring external API calls, specify `credential_id`. Create credentials first with `/bk-credential`.
