---
name: bk-next
description: BlueKiwi next step skill. Completes the current step and executes the next one. This skill should be used when the user says "/bk-next", "next step", "next", "continue", "proceed", or wants to advance to the next step in a running BlueKiwi task.
user_invocable: true
---

# BlueKiwi Next Step

Complete the current step and execute the next one in a running task.

## Core Principles

- **Instructions are internal agent directives. Never expose raw instruction text to the user.**
- Show only execution results (analysis, questions, suggestions) to the user.
- Never use system terms like "node", "node_type" with the user.

## Natural Language Triggers

If the user says "proceed", "next", "continue", "let's go", "OK", "go ahead" — treat it the same as `/bk-next`.

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
  2. Call advance(peek=false) to fetch the next step
  3. If finished → call complete_task, then end
  4. Execute the next step (see step-type handling below)
  5. Check auto_advance:
     - true  → show brief inline result, then go back to step 2
     - false → pause and show result to user
```

<HARD-RULE>
After executing an auto_advance=true step, always proceed to the next step automatically.
Do not show "type /bk-next to continue" hint.
Show a brief one-line update: "✅ [{title}] done → continuing to next step..."
Repeat the loop until reaching an auto_advance=false step.
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

- After completing an action: "Type `/bk-next` to proceed."
- After showing a gate question: Wait for user response.

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

## Comment Check

If comments are present, notify the user before executing and ask how to handle them via AskUserQuestion.

## Failure Handling

Ask via AskUserQuestion: Skip / Retry / Previous step / Abort.
