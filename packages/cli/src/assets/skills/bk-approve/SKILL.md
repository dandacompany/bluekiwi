---
name: bk-approve
description: BlueKiwi approval skill. Handles pending approvals when resuming a session that was interrupted mid-HITL, or when the user explicitly wants to approve a paused step. During normal execution, HITL approval is handled inline by bk-start. Use this skill when the user says "/bk-approve", "approve this", "approve step", or returns to a session where a HITL step is already waiting.
user_invocable: true
---

# BlueKiwi Step Approval

Handle pending approvals in a running workflow. Covers two scenarios:

- **Gate step** (`node_type: gate`): Agent asked the human a question; collect the answer.
- **HITL step** (`node_type: action`, `hitl: true`): Agent completed work and called `request_approval`; human reviews and approves before the workflow continues.

## Argument Handling

- `/bk-approve` → Inspect the current step and handle whichever scenario applies.
- `/bk-approve <task_id>` → Load the pending step for the specified task.

## Execution Steps

### Step 1: Inspect Current Step

Call `advance` with `peek: true` to inspect the current step and its log status.

If no active task → show "No active task." and exit.

Check `log_status` and `node_type` to determine scenario:

| node_type     | log_status              | Scenario                                        |
| ------------- | ----------------------- | ----------------------------------------------- |
| `gate`        | any                     | Gate — collect human answer                     |
| `action`      | `completed` / `success` | HITL — review agent output and approve          |
| anything else | `pending` / `running`   | Not ready — tell user the step is still running |

### Step 2a: Gate Step

1. Show the gate question from `instruction`.
2. Check `get_web_response` for a pre-submitted web response. If found, show it and ask to confirm.
   If the web response is a JSON object from bk-\* components, display a readable summary instead of raw JSON:

   ```text
   VS Response:
   - Selected: [option names from selections array]
   - Values: budget = 70%, confidence = 85%
   - Ranking: 1. Security, 2. Performance, 3. UX
   - Matrix: auth -> high urgency / high importance
   - Comment: [global free-form memo, if present]
   - Field inputs: change_request = ..., constraints = ...
   - Option comments: B -> "Need tighter scope before approval"
   ```

   Map `selections` values back to the option labels shown in the VS screen. Present `values` with their units, `ranking` as a numbered list, and `matrix` positions as quadrant descriptions using high/low language for each axis. Also surface any `comment`, `fields`, and `option_comments` so approval decisions include the user's requested changes.

3. Collect decision via AskUserQuestion:
   - header: "Gate decision"
   - options: ["Approve (Recommended)", "Approve with edits", "Reject and revise", "Rewind to previous step"]
4. Call `execute_step` with the decision as `output`, status `"success"`.
5. Call `advance` to move to the next step and follow the auto-advance loop (see bk-start auto-advance loop).

### Step 2b: HITL Step

1. Show a summary of what the agent completed:

```
━━━━━━━━━━━━━━━━━━━━━━━━━
⏸ Awaiting Approval: {step title}
━━━━━━━━━━━━━━━━━━━━━━━━━
{brief summary of agent's output from task log}
━━━━━━━━━━━━━━━━━━━━━━━━━
```

2. Ask via AskUserQuestion:
   - header: "Approve?"
   - options: ["Approve — proceed to next step (Recommended)", "Reject — rewind to this step", "Rewind to earlier step"]

3. **If Approved**:
   - Call `approve_step(task_id=<id>)` MCP tool.
   - Call `advance` to move to the next step.
   - Follow the auto-advance loop (see bk-start auto-advance loop).

4. **If Rejected**:
   - Ask the user for the reason.
   - Call `rewind` to return to this step so the agent can redo it.
   - Tell the user: "Rewound to step {N}. Type `/bk-start` to retry."

5. **If Rewind to earlier step**:
   - Switch to `/bk-rewind` flow.

## Notes

- `approve_step` MCP tool handles authentication automatically using the configured API key.
- After approving a HITL step, always follow the auto-advance loop — the next step may auto-proceed.
- If `advance` still returns 403 after approval, wait a moment and retry — the approval write may not have propagated yet.
