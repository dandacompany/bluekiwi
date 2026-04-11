---
name: bk-run
description: BlueKiwi workflow run skill. Selects a workflow and immediately starts it — a streamlined alias for /bk-start with explicit workflow selection. This skill should be used when the user says "/bk-run", "run workflow", "execute workflow", or wants to quickly start a specific workflow by name.
user_invocable: true
---

# BlueKiwi Workflow Run

Quickly select and start a specific workflow. Delegates to `/bk-start` execution flow once a workflow is selected.

## Argument Handling

- `/bk-run` → List workflows and ask the user to select.
- `/bk-run <name>` → Find the best-matching workflow and confirm before starting.

## Execution Steps

### Step 1: Select Workflow

Call `list_workflows` to get the active workflow list.

If an argument is provided, find the best match by title and confirm:

```
Run '{title}' (v<version>)?
```

Ask via AskUserQuestion:

- header: "Run workflow"
- options: ["Run", "Pick a different one", "Cancel"]

If no argument, show the full list via AskUserQuestion (up to 4 options).

### Step 2: Start

Call `start_workflow` with the selected `workflow_id`.

Collect and pass `session_meta` exactly as described in `/bk-start`.

### Step 3: Execute

Continue with the same execution loop as `/bk-start`:

- Show the roadmap.
- Execute the first step immediately.
- Follow the auto_advance loop.
- Pause at `auto_advance: false` steps.

Refer to `/bk-start` for all execution details including credential handling and execute_step requirements.
