---
name: bk-approve
description: BlueKiwi gate approval skill. Reviews and approves (or rejects) a pending gate step in a running workflow. This skill should be used when the user says "/bk-approve", "approve this", "approve step", or wants to handle a gate decision in a BlueKiwi workflow.
user_invocable: true
---

# BlueKiwi Gate Approval

Review and approve (or reject/edit) a pending gate step in a running workflow.

## Argument Handling

- `/bk-approve` → Check the current gate step and present the decision.
- `/bk-approve <task_id>` → Load the gate step for the specified task.

## Execution Steps

### Step 1: Fetch Current Gate Step

Call `advance` with `peek: true` to inspect the current step.

If no active task → show "No active task." and exit.
If the current step is not a `gate` node → show "Current step is not a gate. Use `/bk-next` instead." and exit.

### Step 2: Display Gate Content

Show the gate question and any supporting context from `task_context`:

```
━━━━━━━━━━━━━━━━━━━━━━━━━
Gate: {node title}
━━━━━━━━━━━━━━━━━━━━━━━━━
{instruction content}

Previous step summary:
{task_context.running_context summary}
━━━━━━━━━━━━━━━━━━━━━━━━━
```

Check `get_web_response` for any pre-submitted web responses. If one exists, show it and ask the user to confirm.

### Step 3: Collect Decision

Ask via AskUserQuestion:

- header: "Gate decision"
- options: ["Approve (Recommended)", "Approve with edits", "Reject and revise", "Rewind to previous step"]

**Approve**: Record approval decision and proceed.

**Approve with edits**: Accept free-text modifications from the user. Include them in the output.

**Reject and revise**: Accept the reason for rejection. Use `rewind` to go back to the appropriate step.

**Rewind to previous step**: Switch to `/bk-rewind` flow.

### Step 4: Execute Step

Call `execute_step` with the decision:

```json
{
  "task_id": <id>,
  "node_id": <id>,
  "output": "<decision and reasoning>",
  "status": "success",
  "context_snapshot": {
    "gate_decision": "approved",
    "modifications": "<if any>",
    "reason": "<if rejected>"
  }
}
```

### Step 5: Advance

Call `advance` to move to the next step and follow the auto_advance loop as defined in `/bk-next`.
