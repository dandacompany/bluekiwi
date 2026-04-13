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

### 2. Create Task + Open Monitoring Page

Call `start_workflow`. Pass any argument as `context`.

<HARD-RULE>
After `start_workflow` returns the task_id, immediately open the task monitoring page in the user's browser:

```bash
open "${BLUEKIWI_URL:-http://localhost:3100}/tasks/${TASK_ID}"
```

Use `open` on macOS, `xdg-open` on Linux. Derive `BLUEKIWI_URL` from the MCP connection or default to `http://localhost:3100`.
</HARD-RULE>

### 3. Execute First Step + Auto-Advance Loop

Read the first step's instruction as an **internal directive and execute immediately**.

After execution, save with `execute_step`, then check the response for `next_action` before calling `advance`.

**Show roadmap at start** (#20):

```
Starting: {workflow title} ({n} steps)
━━━━━━━━━━━━━━━━━━━━━━━━━
**1** → 2 → 3 → 4 → 5 → 6 → 7
━━━━━━━━━━━━━━━━━━━━━━━━━
📺 Live: ${BLUEKIWI_URL}/tasks/${TASK_ID}
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

<HARD-RULE>
Write all VS content text (titles, descriptions, option labels, button text)
in the user's language. The frame UI (Submit button, status) is auto-localized,
but agent-authored content must match the user's locale.
</HARD-RULE>

- If `visual_selection: true`:
  1. Compose a VS content **fragment** using `bk-*` component classes. Write **only the inner HTML** - do not include `<html>`, `<head>`, or `<body>` tags. The frame (CSS, JS, submit button) is injected automatically by the web UI.

     **Component quick reference:**
     - Selection: `bk-options` (A/B/C cards, single), `bk-cards` (visual cards, single), `bk-checklist` (multi-select), `bk-code-compare` (code blocks, single)
     - Input: `bk-slider` (numeric range), `bk-ranking` (drag reorder), `bk-matrix` (2x2 drag placement)
     - Display: `bk-split`, `bk-pros-cons`, `bk-mockup`, `bk-timeline`
     - Layout: `h2`, `.bk-subtitle`, `.bk-section`, `.bk-label`

     Every selection/input element needs a `data-value` attribute. Example fragment:
     ```html
     <h2>Choose an approach</h2>
     <p class="bk-subtitle">Select the architecture that best fits your needs</p>
     <div class="bk-options">
       <div class="bk-option" data-value="monolith" data-recommended>
         <div class="bk-option-letter">A</div>
         <div class="bk-option-body"><h3>Monolith</h3><p>Simple deployment</p></div>
       </div>
       <div class="bk-option" data-value="microservices">
         <div class="bk-option-letter">B</div>
         <div class="bk-option-body"><h3>Microservices</h3><p>Independent scaling</p></div>
       </div>
     </div>
     ```

  2. Call `set_visual_html(task_id, node_id, html)` with the fragment.
  3. Open the VS deep link so the user sees the selection UI immediately:
     ```bash
     open "${BLUEKIWI_URL:-http://localhost:3100}/tasks/${TASK_ID}?step=${STEP_ORDER}&vs=true"
     ```
  4. Poll `get_web_response(task_id)` every 3-5 seconds until a response arrives (max 120 seconds).
  5. The response is a **JSON object** (not a plain string). Parse it to read the user's choices:
     ```json
     {"selections": ["monolith"], "values": {"budget": 70}, "ranking": ["security", "ux"]}
     ```
     - `selections`: chosen option values (from bk-options, bk-cards, bk-checklist, bk-code-compare)
     - `values`: numeric inputs (from bk-slider, keyed by data-name)
     - `ranking`: ordered list (from bk-ranking)
     - `matrix`: placement coordinates (from bk-matrix)
     Only populated fields appear.
  6. Use the parsed response to form the gate answer and call `advance`.
- If `visual_selection: false` → present the gate question to the user via AskUserQuestion. Use the response as gate answer, call `execute_step` with the answer, then `advance`.

#### Attachments

<HARD-RULE>
When `advance` returns `node.attachments`:
1. Review the list (filename, mime_type, size_bytes)
2. Call `get_attachment(workflow_id, node_id, attachment_id)` for each text file the instruction references
3. Use downloaded content as context when executing the instruction
4. For binary files, note their existence but do not download unless explicitly required
</HARD-RULE>

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

#### Loop + VS History Pattern

When a loop node uses `visual_selection: true`, each iteration presents a VS screen and collects a response. Use `get_web_response(task_id, node_id)` to access all previous iteration responses for that node:

```json
{
  "task_id": 19,
  "node_id": 109,
  "history": [
    {"iteration": 1, "web_response": {"selections": ["a"]}, "created_at": "..."},
    {"iteration": 2, "web_response": {"selections": ["b"], "values": {"confidence": 80}}, "created_at": "..."}
  ]
}
```

Use the history to adapt subsequent VS screens - for example, pre-selecting the user's previous choice, adjusting slider defaults based on past values, or skipping already-confirmed items.

## Feedback Survey (before calling complete_task)

When the workflow finishes, run the feedback survey flow.
Follow the sequence: `save_feedback` → `complete_task` → suggest improvements.
