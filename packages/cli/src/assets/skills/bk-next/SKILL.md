---
name: bk-next
description: BlueKiwi resume skill. Finds the active running task and resumes execution from the current step. Use when the user says "/bk-next", "next step", "next", "continue", "proceed", "이어서", "계속", or wants to resume a running BlueKiwi task from where it left off.
user_invocable: true
---

# BlueKiwi Next Step

Find the active task and resume execution from the current step. Works even in a fresh session with no prior context.

## Core Principles

- **Instructions are internal agent directives. Never expose raw instruction text to the user.**
- Show only execution results (analysis, questions, suggestions) to the user.
- Never use system terms like "node", "node_type" with the user.

## Natural Language Triggers

If the user says "proceed", "next", "continue", "let's go", "OK", "go ahead", "이어서", "계속" — treat it the same as `/bk-next`.

## Step 0 — Find the Active Task

<HARD-RULE>
Always resolve the task to resume before doing anything else.

1. Call `list_tasks(status=running)`.
2. If **exactly one** running task exists → use it directly.
3. If **multiple** running tasks exist → ask via AskUserQuestion:
   - header: "태스크 선택"
   - preview: list of tasks formatted as `"Task #{id} — {workflow_name} (Step {current_step}/{total_steps})"`
   - options: up to 4 task entries (most recent first)
4. If **no running tasks** → call `list_tasks(status=timed_out)` and check for timed-out tasks.
   - If found → ask: "이어서 진행할 태스크가 없습니다. 타임아웃된 태스크를 재개할까요?" (options: 가장 최근 재개 / 취소)
   - If none → tell the user "실행 중인 태스크가 없습니다. `/bk-start`로 새 워크플로를 시작하세요."

Once task_id is resolved, call `advance(task_id, peek=true)` to load the current step without advancing.
</HARD-RULE>

## Session Restore (Context Injection)

The `advance` response includes `task_context`. Use it to resume seamlessly in a new session.

1. `task_context.running_context` — Accumulated decisions and project state. Read and internalize it.
2. `task_context.completed_steps` — Summary of completed steps. Understand where we are.
3. `task_context.artifacts` — List of available artifacts. Use the Read tool on `file_path` entries when needed.
4. `task_context.last_session` — Last execution session info. Note if a different session/user progressed it.

When resuming in a new session (no prior conversation context), use `task_context` to reconstruct the situation before proceeding.

## execute_step Required Parameters

<HARD-RULE>
Always populate these parameters when calling execute_step:
- `context_snapshot`: JSON string. Store decisions made, key findings, and hints for the next step.
  Example: `{"decisions":[{"question":"tech stack","chosen":"Next.js","reason":"team experience"}],"key_findings":["RLS required"],"next_step_hint":"write implementation plan"}`
- `session_id`: Current session ID (omit if unknown)
- `agent_id`: Agent identifier (e.g., "claude-code")
- `model_id`: Current LLM model ID (e.g., "claude-opus-4-6", "gpt-5.2"). Check system prompt.
- `user_name`: User name (omit if unknown)

If files were created or modified, record in the `artifacts` array:

- File created: `{artifact_type: "file", title: "Design Doc", file_path: "docs/specs/design.md"}`
- Git commit: `{artifact_type: "git_commit", title: "Phase 1 Implementation", git_ref: "<hash>"}`
- URL: `{artifact_type: "url", title: "PR", url: "https://..."}`
  </HARD-RULE>

## Credential Handling (API Service Nodes)

If the `advance` response includes a `credentials` field, the node requires external API integration.

<HARD-RULE>
Use key-value pairs from `credentials.secrets` to make API calls.
Example: `credentials.secrets.ACCESS_TOKEN` → `curl -H "Authorization: Bearer $TOKEN"`
Never include raw secret values (tokens, keys) in `execute_step` output.
Record only results (URL, status code, response summary).
</HARD-RULE>

## Execution Loop

```
LOOP:
  1. If the current step is pending → extract response from conversation, save with execute_step
     → Check execute_step response for next_action field (see HITL section below)
  2. Call advance(peek=false) to fetch the next step
  3. If finished → call complete_task, then end
  4. Execute the next step (see step-type handling below)
  5. Check auto_advance:
     - true  → show brief inline result, then go back to step 2
     - false → HITL pause (see below)
```

<HARD-RULE>
After executing an auto_advance=true step, always proceed to the next step automatically.
Do not show "type /bk-next to continue" hint.
Show a brief one-line update: "✅ [{title}] done → continuing to next step..."
Repeat the loop until reaching an auto_advance=false step.
</HARD-RULE>

## HITL Pause (auto_advance=false steps)

<HARD-RULE>
When execute_step returns `next_action: "wait_for_human_approval"`:

1. Call `request_approval` with a brief message summarizing what was done.
2. Show the user:
   ```
   ⏸ Step [{title}] complete — waiting for approval before proceeding.
   A notification has been sent. Use /bk-approve when ready.
   ```
3. STOP. Do NOT call `advance`. Do NOT proceed to the next step.

The server will reject `advance` with 403 until a human approves via /bk-approve.
</HARD-RULE>

## Step-Type Handling

### action step

1. Read the instruction and execute it. Reference task context.
2. **Use heartbeat actively**: For tasks taking 30+ seconds, send heartbeat regularly.
   Example: "Analyzing architecture section...", "Designing API endpoints...", "Writing design doc line 119..."
3. Show the result to the user.
4. Save with `execute_step`.

### gate step

1. Check `get_web_response` for a web response first.
2. If none, ask naturally via `AskUserQuestion`.
3. **Partial edit option**: For approve/modify questions, offer 3 options: "Approve (Recommended)" / "Partial edit" / "Full rewrite".
4. Save the response with `execute_step`.

### loop step

1. Execute the instruction.
2. **Confirm before stopping**: When the stop condition is met, do not auto-stop — ask via AskUserQuestion:
   - "Enough information collected. Do you have anything else to add?"
   - "That's enough (Recommended)" / "I have more to add"
3. **Call execute_step once per loop iteration.** Do not merge multiple answers into one. Each iteration is a separate log entry.
4. Pass `loop_continue` true/false to execute_step.

## Progress Display

Show progress at the start of each step as a single line:

```
✅1 → ✅2 → ✅3 → **4** → 5 → 6 → 7 → 8 → 9 → 10 → 11
```

## When Pausing (auto_advance=false only)

- **HITL approval required** (execute_step returned `next_action: "wait_for_human_approval"`):
  Call `request_approval`, show waiting message, stop. Resume only after `/bk-approve`.
- **Gate step**: Wait for user response via AskUserQuestion.
- **Other action step pausing without HITL**: "Type `/bk-next` to proceed."

## Completion Message

<HARD-RULE>
When the workflow finishes, call `complete_task` with a non-empty `summary`.
The summary must include decisions made, artifact paths, and suggested next actions, formatted in Markdown.
</HARD-RULE>

```
complete_task(task_id=N, status="completed", summary="## Decisions\n- Goal: ...\n- Approach: ...\n\n## Artifacts\n- Design doc: `docs/specs/...`\n\n## Next Steps\nStart implementation from Phase 1.")
```

Show completion message to user:

```
🎉 Workflow complete!
━━━━━━━━━━━━━━━━━━━━━━━━━

## Summary
[key decisions table]

## Artifacts
- 📄 Design doc: `docs/specs/YYYY-MM-DD-xxx-design.md`

## Next Steps
Start implementation from Phase 1.
━━━━━━━━━━━━━━━━━━━━━━━━━
```

## output Format

<HARD-RULE>
All output must be at least 200 characters. Do not send one-line summaries only.
Always use ## heading structure.
Write in past-tense declarative form ("I analyzed...", "I generated...").
Include absolute paths for any files created.
</HARD-RULE>

action:

```markdown
## Actions Taken

Analyzed the project context.

## Results

- **Project name**: recipe-sharing-app
- **Current state**: Initial stage (no code yet)
- **Tech stack**: TBD
- **Key findings**: ...

## Artifacts

Saved design doc to `/tmp/or-test-verify/docs/specs/2026-04-08-recipe-design.md`.
```

gate:

```markdown
## Question

What is the core problem this project management tool aims to solve?

## Options

1. Personal task management (Recommended)
2. Team collaboration
3. Educational use

## Response

Selected "Personal task management" — proceeding as a personal productivity task tracker.
```

## Web UI State Synchronization (웹 UI 상태 동기화)

<HARD-RULE>
The web UI can change task/step state at any time. You MUST check every heartbeat and execute_step response for the following signals and react immediately:

### 1. Task cancelled — `cancelled: true`

Triggered by: `heartbeat` response OR `advance(peek=true)` returning `status: "cancelled"`

Action:

- Stop all execution immediately. Make no further MCP calls.
- Notify the user:
  ```
  ⚠️ 태스크가 웹 UI에서 중지되었습니다.
  Task #{id} — Step {N}에서 사용자에 의해 중단되었습니다.
  다시 시작하려면 /bk-next로 재개하거나 /bk-start로 새 워크플로를 시작하세요.
  ```
- Do NOT call `complete_task`, `execute_step`, or `advance`.

### 2. Step rewound — `rewound: true` or error code `STEP_REWOUND`

Triggered by:

- `heartbeat` response contains `rewound: true` (web UI rewound while step was running)
- `execute_step` returns HTTP 409 with `error_code: "STEP_REWOUND"` (tried to save a cancelled step)

Action:

- Stop executing the current step immediately.
- Call `advance(task_id, peek=true)` to get the new current step.
- Notify the user briefly:
  ```
  🔄 웹 UI에서 되감기가 실행되었습니다. Step {new_step}부터 재개합니다.
  ```
- Re-execute from the new current step as if it was just assigned.
- The new step's `log_status` will be `"pending"` — treat it normally.

### 3. Step log cancelled but task still running — `log_status: "cancelled"` + `status: "running"`

Triggered by: `advance(peek=true)` at the start of a step loop

This means the step was reset by a rewind. Action:

- Re-execute this step from scratch. Do not skip it.
- Do not treat this as a terminal error.

### Polling cadence

- Call `heartbeat` at least every 30 seconds during long-running steps.
- Always check the response — never fire-and-forget heartbeats.
- At the start of each new step (before executing), verify `advance(peek=true)` reflects the expected step. If `current_step` differs from what you expected, follow the server's value.
  </HARD-RULE>

## Comment Check

If comments are present, notify the user before executing and ask how to handle them via AskUserQuestion.

## Failure Handling

Ask via AskUserQuestion: Skip / Retry / Previous step / Abort.
