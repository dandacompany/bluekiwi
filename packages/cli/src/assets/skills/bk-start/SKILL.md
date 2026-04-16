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

## Session Restore (Resume In-Progress or Timed-Out Task)

<HARD-RULE>
Follow all steps in order before proceeding to workflow selection.

### Step A — Mark zombie tasks

Call `POST /api/tasks/timeout-stale` with `{"timeout_minutes": 120}`.
This converts any `running` tasks idle for over 2 hours to `timed_out`.

### Step B — Fetch existing tasks

Call `list_tasks` with `status=running` and again with `status=timed_out`.
Collect all results into a combined candidate list sorted by `updated_at` descending (most recent first).

If the list is empty → skip to workflow selection.

### Step C — Build the task summary

For each candidate, compute age from `updated_at` to now.
Format: `"Task #{id} — {workflow_name} (Step {current_step}/{total_steps}, {age}전)"`

Example output:

```
미완료 태스크 2건이 있습니다:
① Task #31 — 코드 리뷰 워크플로 (Step 3/6, 3시간 전) [timed_out]
② Task #28 — 보안 점검 (Step 1/4, 30분 전) [running]
```

### Step D — Ask what to do

**Case 1: exactly 1 candidate**

Ask via AskUserQuestion:

- header: "미완료 태스크"
- preview: `"Task #{id} — {workflow_name}\nStep {N}/{total} · {age}전 중단"`
- options (pick the most appropriate 3–4):
  - `"이어서 진행"` — resume this task
  - `"종료하고 새로 시작"` — close this task then start fresh
  - `"닫지 않고 새로 시작"` — leave as-is, open a new task
  - _(only if status=running)_ `"계속 실행 중"` — another agent is handling it, do nothing

**Case 2: 2 or more candidates**

Ask via AskUserQuestion:

- header: "미완료 태스크"
- preview: the task summary list built above
- options:
  - `"가장 최근 태스크 이어서"` — resume the most recent one
  - `"모두 종료하고 새로 시작"` — close all candidates, then start fresh
  - `"새 태스크 시작 (기존 유지)"` — leave existing as-is, open a new task

### Step E — Execute the choice

**"이어서 진행" / "가장 최근 태스크 이어서"**:
Call `advance(task_id, peek=true)`, read `task_context`, then continue with the auto-advance loop.

**"종료하고 새로 시작" / "모두 종료하고 새로 시작"**:
For each task to close, call `complete_task(task_id, summary="사용자 요청으로 종료됨")`.
Confirm: "기존 태스크를 종료했습니다. 새 워크플로를 선택하세요." → proceed to workflow selection.

**"닫지 않고 새로 시작" / "새 태스크 시작 (기존 유지)"**:
Proceed to workflow selection without touching existing tasks.
</HARD-RULE>

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

**No workflows exist**: Ask via AskUserQuestion:

- header: "No workflows"
- "No workflows found. Would you like to create one now?"
- options: "Create new workflow" / "Cancel"

If "Create new workflow" → immediately invoke the `bk-design` skill. Pass the user's original argument (if any) as the goal so `bk-design` can pre-fill the design step. After `bk-design` completes and the workflow is registered, return here and proceed with Step 2 using the newly created workflow.

**Single workflow**: Skip the selection UI, just confirm:

- "Start the '{title}' workflow?" (AskUserQuestion: "Start" / "Cancel")

**Multiple workflows**: Show selection via AskUserQuestion.

If the user selects "Create new workflow" from the selection UI → invoke `bk-design`, then continue as above.

### 2. Create Task + Open Monitoring Page

Call `start_workflow`. Pass any argument as `context`.

<HARD-RULE>
Always derive a short `title` (max 60 chars) from the user's goal or argument and pass it alongside `context`.
- If the argument is short (≤60 chars): use it as-is.
- If longer: distill the core topic into a concise noun phrase (e.g. "Hermes AI 아티클 생성" not the full paragraph).
- Never pass the raw prompt verbatim when it exceeds 60 characters.
</HARD-RULE>

<HARD-RULE>
After `start_workflow` returns the task_id, immediately open the task monitoring page in the user's browser:

```bash
open "${WEBUI_URL}/tasks/${TASK_ID}"
```

`WEBUI_URL` = the `webui_url` field returned by `start_workflow`. Use `open` on macOS, `xdg-open` on Linux.
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
📺 Live: ${WEBUI_URL}/tasks/${TASK_ID}
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
     <p class="bk-subtitle">
       Select the architecture that best fits your needs
     </p>
     <div class="bk-options">
       <div class="bk-option" data-value="monolith" data-recommended>
         <div class="bk-option-letter">A</div>
         <div class="bk-option-body">
           <h3>Monolith</h3>
           <p>Simple deployment</p>
         </div>
       </div>
       <div class="bk-option" data-value="microservices">
         <div class="bk-option-letter">B</div>
         <div class="bk-option-body">
           <h3>Microservices</h3>
           <p>Independent scaling</p>
         </div>
       </div>
     </div>
     ```

  2. Call `set_visual_html(task_id, node_id, html)` with the fragment.
  3. Open the VS deep link so the user sees the selection UI immediately:
     ```bash
     open "${WEBUI_URL}/tasks/${TASK_ID}?step=${STEP_ORDER}&vs=true"
     ```
  4. Poll `get_web_response(task_id)` every 3-5 seconds until a response arrives (max 120 seconds).
  5. The response is a **JSON object** (not a plain string). Parse it to read the user's choices and feedback:

     ```json
     {
       "selections": ["monolith"],
       "values": { "budget": 70 },
       "ranking": ["security", "ux"],
       "comment": "Keep this direction but tighten rollout scope",
       "fields": { "change_request": "Add a rollback plan" },
       "option_comments": {
         "monolith": "Prefer this if we can phase deployment"
       }
     }
     ```

     - `selections`: chosen option values (from bk-options, bk-cards, bk-checklist, bk-code-compare)
     - `values`: numeric inputs (from bk-slider, keyed by data-name)
     - `ranking`: ordered list (from bk-ranking)
     - `matrix`: placement coordinates (from bk-matrix)
     - `comment`: free-form global memo from bk-textarea/bk-input with `data-response-key="comment"` (or `data-name="comment"`)
     - `fields`: named text inputs from bk-input / bk-textarea, plus any option-level memo stored via `data-comment-name`
     - `option_comments`: per-option free-text notes attached to selected choices
       Only populated fields appear.

  6. When forming the gate answer, never ignore free-text feedback:
     - If `comment` exists, summarize it in the gate output.
     - If `fields.change_request` or similar named fields exist, treat them as authoritative revision instructions.
     - If `option_comments` exists, preserve the mapping between the selected option and its note.
     - A response like "select B + add changes" must not be collapsed into just `"selections": ["b"]`.

  7. Use the parsed response to form the gate answer and call `advance`.

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
    {
      "iteration": 1,
      "web_response": { "selections": ["a"] },
      "created_at": "..."
    },
    {
      "iteration": 2,
      "web_response": {
        "selections": ["b"],
        "values": { "confidence": 80 },
        "fields": { "change_request": "Need more detail on error handling" }
      },
      "created_at": "..."
    }
  ]
}
```

Use the history to adapt subsequent VS screens - for example, pre-selecting the user's previous choice, adjusting slider defaults based on past values, carrying forward `fields.change_request` into the next revision prompt, or skipping already-confirmed items.

## Remote Cancellation (웹 UI에서 중지된 경우)

<HARD-RULE>
If any of the following signals indicate the task was cancelled externally (from the web UI):

- `advance(peek=true)` returns `status: "cancelled"`
- `heartbeat(...)` returns `cancelled: true`

You MUST immediately stop all execution, make no further MCP calls, and notify the user:

```
⚠️ 태스크가 웹 UI에서 중지되었습니다.
Task #{id} — Step {N}에서 사용자에 의해 중단되었습니다.
다시 시작하려면 /bk-start를 실행하세요.
```

Do NOT call `complete_task`, `execute_step`, or `advance` after receiving a cancellation signal.
</HARD-RULE>

## Graceful Interruption (중단 처리)

<HARD-RULE>
Whenever the user requests a stop mid-workflow — phrases like "stop", "pause", "cancel", "잠깐", "중단", "그만", "멈춰", or presses Ctrl+C — you MUST ask before exiting:

Ask via AskUserQuestion:

- header: "작업 중단"
- "현재 Step {N}에서 중단합니다. 어떻게 처리할까요?"
- options:
  - "일시 중지 (나중에 이어서)" — leave task as `running`; it will auto-timeout after 2 hours of inactivity, and can be resumed next session
  - "태스크 종료 (완전히 닫기)" — call `complete_task(task_id, summary="사용자 요청으로 중단됨")` to mark the task finished
  - "계속 진행" — dismiss and continue the current step

If "일시 중지":

- Save the current progress to `context_snapshot` via `execute_step` (mark output as "작업이 일시 중지되었습니다. 다음 세션에서 이어서 진행 가능합니다.")
- Remind the user: "Task #{id}은 Step {N}에서 일시 중지되었습니다. 다음에 `/bk-start`를 실행하면 이어서 진행할 수 있습니다."

If "태스크 종료":

- Call `complete_task(task_id, summary="사용자 요청으로 중단됨. 마지막 완료 스텝: {N}")`.
- Remind the user: "태스크가 종료되었습니다. 처음부터 다시 시작하려면 `/bk-start`를 실행하세요."

**When not to prompt**: If ALL steps are already completed and `complete_task` is about to be called, skip this dialog — the workflow is naturally finishing.
</HARD-RULE>

## Feedback Survey (before calling complete_task)

When the workflow finishes, run the feedback survey flow.
Follow the sequence: `save_feedback` → `complete_task` → suggest improvements.
