---
name: bk-start
description: BlueKiwi workflow execution skill. Selects a registered workflow and starts the first step immediately. This skill should be used when the user says "/bk-start", "/bk-run", "start workflow", "run workflow", "execute workflow", "run BlueKiwi", or wants to begin a registered instruction workflow.
user_invocable: true
---

# BlueKiwi Workflow Start

Select a registered workflow, create a task, and immediately execute the first step.

## Argument Handling

- `/bk-start` → Fetch workflow list, ask user to select via AskUserQuestion.
- `/bk-start security review` → Propose the best-matching workflow as Recommended.

## Core Principles

- **Instructions are internal agent directives. Never expose raw instruction text to the user.**
- Never use system terms like "node", "node_type", "chain_nodes" with the user.
- Refer to steps as "step" only.
- All `output` written to the server must be in past-tense declarative form ("I analyzed...", "I generated...").

## AskUserQuestion Parameter Rules

- `options` must have 2–4 entries.
- `preview` is a plain string. Use `\n` for line breaks.
- `header` must be 12 characters or fewer.
- `multiSelect` must be `false`.

## Session Restore (Resume In-Progress Task)

Before starting, check for running tasks using `advance(task_id, peek=true)` if a task ID is known, or prompt the user.

If an in-progress task is found, ask via AskUserQuestion:

- header: "Resume?"
- "Task #{id} ({workflow name}, Step {N}/{total}) is in progress. Resume or start a new workflow?"
- options: "Resume (Recommended)" / "Start new workflow"

If resuming → call `advance(task_id, peek=true)`, read `task_context`, then continue with the auto-advance loop.

## execute_step Required Parameters

<HARD-RULE>
Always populate these parameters when calling execute_step:
- `context_snapshot`: JSON string. Store decisions made, key findings, and hints for the next step.
- `model_id`: Current LLM model ID (e.g., "claude-opus-4-6"). Check your system prompt.
- `user_name`: User name (omit if unknown)

Note: `provider_slug` (coding tool identity) is auto-injected by the MCP server from the connection handshake. Do not send it manually.

If files were created or modified, record them in the `artifacts` array:

- File created: `{artifact_type: "file", title: "Design Doc", file_path: "docs/specs/design.md"}`
- Git commit: `{artifact_type: "git_commit", title: "Implementation", git_ref: "<hash>"}`
  </HARD-RULE>

## Session Metadata Collection

<HARD-RULE>
Before calling `start_workflow`, collect session metadata and pass it as `session_meta`.
Run the following via Bash:

```bash
echo "PROJECT_DIR: $(pwd)"
echo "GIT_REMOTE: $(git remote get-url origin 2>/dev/null || echo 'none')"
echo "GIT_BRANCH: $(git branch --show-current 2>/dev/null || echo 'unknown')"
echo "USER: $(whoami 2>/dev/null || echo 'unknown')"
echo "OS: $(uname -s 2>/dev/null || echo 'unknown') $(uname -m 2>/dev/null)"
# Detect CLI tool by walking up the process tree (up to 4 levels)
_AGENT=unknown; _PID=$PPID
for _L in 1 2 3 4; do
  _C=$(ps -o comm= -p $_PID 2>/dev/null | tr '[:upper:]' '[:lower:]')
  case "$_C" in
    *claude*)   _AGENT=claude-code; break ;;
    *gemini*)   _AGENT=gemini-cli;  break ;;
    *codex*)    _AGENT=codex-cli;   break ;;
    *cursor*)   _AGENT=cursor;      break ;;
    *windsurf*) _AGENT=windsurf;    break ;;
    *opencode*) _AGENT=opencode;    break ;;
  esac
  _PID=$(ps -o ppid= -p $_PID 2>/dev/null | tr -d ' ')
  [ -z "$_PID" ] || [ "$_PID" = "0" ] || [ "$_PID" = "1" ] && break
done
echo "AGENT: $_AGENT"
```

Build a JSON object:

```json
{
  "agent": "claude-code",
  "project_dir": "/Users/dante/workspace/project",
  "user_name": "dante",
  "model_id": "claude-opus-4-6",
  "git_remote": "git@github.com:user/repo.git",
  "git_branch": "main",
  "os": "Darwin arm64",
  "started_at": "2026-04-08T12:00:00Z"
}
```

- `agent`: detected CLI tool name (from AGENT output above)
- `model_id`: current model ID (check system prompt)
- `started_at`: current UTC time
  </HARD-RULE>

## Credential Handling (API Service Nodes)

If the `advance` response includes a `credentials` field, the node requires external API integration.

<HARD-RULE>
Use key-value pairs from `credentials.secrets` to make API calls.
Example: `credentials.secrets.ACCESS_TOKEN` → `curl -H "Authorization: Bearer $TOKEN"`
Never include raw secret values (tokens, keys) in `execute_step` output.
Record only results (URL, status code, response summary).
</HARD-RULE>

## Execution Steps

### 1. Fetch and Select Workflow

Call `list_workflows` to retrieve the list.

**Single workflow**: Skip the selection UI, just confirm:

- "Start the '{title}' workflow?" (AskUserQuestion: "Start" / "Cancel")

**Multiple workflows**: Show selection via AskUserQuestion.

### 2. Create Task

Call `start_workflow`. Pass any argument as `context`.

### 3. Execute First Step + Auto-Advance Loop

Read the first step's instruction as an **internal directive and execute immediately**.

After execution, save with `execute_step`, then check the response for `next_action` before calling `advance`.

**Show roadmap at start** (#20):

```
Starting: {workflow title} ({n} steps)
━━━━━━━━━━━━━━━━━━━━━━━━━
**1** → 2 → 3 → 4 → 5 → 6 → 7
━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Auto-advance loop**: If execute_step returns no `next_action`, continue executing the next step without pausing.

<HARD-RULE>
After executing a step with no next_action, always proceed to the next step automatically.
Show a brief inline update: "✅ [{title}] done → continuing to next step..."
Repeat the loop until reaching a gate step or a hitl=true action step.
</HARD-RULE>

### 4. When Pausing

Check the `next_action` field in the `execute_step` response and handle accordingly:

#### HITL (next_action: "wait_for_human_approval")

Call `request_approval`, then immediately show the HITL approval AskUserQuestion (inline HITL approval). Do NOT stop and tell the user to type `/bk-approve`.

#### Gate step (no next_action, node_type=gate)

- If `visual_selection: true` → call `set_visual_html` with interactive HTML, then poll `get_web_response` every 3-5 seconds until a response arrives (max 120 seconds). When the response arrives, use it as the gate answer and call `advance`.
- If `visual_selection: false` → present the gate question to the user via AskUserQuestion. Use the response as gate answer, call `execute_step` with the answer, then `advance`.

#### Loop (next_action: "loop_back")

<HARD-RULE>
Loop nodes repeat until a termination condition is met. The instruction contains the termination condition.

**Execution flow:**

1. Read the instruction and execute one iteration (e.g., ask one clarifying question).
2. Present the result/question to the user via AskUserQuestion.
3. Based on user response, decide: is the termination condition met?
   - **NOT met** → call `execute_step(loop_continue=true)` → server creates a new pending log on the same node → re-execute the loop step (go back to step 1)
   - **Met** → call `execute_step(loop_continue=false)` → loop ends → call `advance` to move to next step

**Example — "Clarifying Questions" loop (loop_back_to=self):**

```
Iteration 1: "Who is the primary user of this feature?" → user answers → purpose clear, constraints unclear → loop_continue=true
Iteration 2: "Are there tech stack limitations?" → user answers → constraints clear, success criteria unclear → loop_continue=true
Iteration 3: "What defines completion?" → user answers → all items clear → loop_continue=false → advance
```

**Example — "Design Section Presentation" loop:**

```
Iteration 1: Present architecture section → user "looks good" → more sections remain → loop_continue=true
Iteration 2: Present data flow section → user "needs revision" → revise and re-present → loop_continue=true
Iteration 3: Present final section → user approves → all sections done → loop_continue=false → advance
```

</HARD-RULE>

## Feedback Survey (before calling complete_task)

When the workflow finishes, run the feedback survey flow.
Follow the sequence: `save_feedback` → `complete_task` → suggest improvements.
