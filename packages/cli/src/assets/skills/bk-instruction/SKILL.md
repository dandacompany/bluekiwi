---
name: bk-instruction
description: BlueKiwi instruction template management skill. Creates, updates, and deletes agent instruction templates, and links credentials using natural language. This skill should be used when the user says "/bk-instruction", "create instruction", "manage instruction templates", or wants to manage BlueKiwi instruction templates.
user_invocable: true
---

# BlueKiwi Instruction Management

Create, update, and delete agent instruction templates. Optionally link credentials to instructions using natural language.

## Argument Handling

- `/bk-instruction` → Show action selection menu.
- `/bk-instruction add <title>` → Start creating a new instruction.
- `/bk-instruction list` → Show instruction list.
- `/bk-instruction move <id> <folder id>` → Move an instruction between folders.

## What is an Instruction?

An instruction is an **execution directive** that a workflow node delivers to the agent at runtime.

- Well-written instructions control agent behavior precisely.
- Instructions can optionally bind a **default credential** via `credential_id`. When a workflow node references this instruction, the credential is available automatically at runtime.

## Execution Steps

### Step 0: Select Action

If no argument, ask via AskUserQuestion:

- header: "Instructions"
- options: ["List", "Create new", "Edit", "Move", "Delete"]

---

### Action: List

Call `list_instructions` and display results:

```
Instruction Templates
━━━━━━━━━━━━━━━━━━━━━━━━━
ID   Title                   Agent Type    Active
━━━━━━━━━━━━━━━━━━━━━━━━━
1    SaaS Competitor Analysis  general       ✅
2    Code Review Checklist     code-review   ✅
━━━━━━━━━━━━━━━━━━━━━━━━━
2 total
```

For folder-based filtering → call `list_folders`, then re-query with `list_instructions(folder_id)`.

---

### Action: Create New

**Collect basic info**:

1. Title: ask via AskUserQuestion.
2. Agent type: ask via AskUserQuestion (options: ["general", "code-review", "data-analysis", "Type my own"])
3. Tags: comma-separated keywords (optional)
4. Priority: integer (default 0, higher = more important)

**Write content**:

Ask how to write the content via AskUserQuestion:

- header: "Write content"
- "How would you like to write the instruction content?"
- options: ["I'll write it myself", "Generate AI draft for review"]

**If "Generate AI draft"**:

Based on the goal and agent type, write a draft using this format:

```
## Goal
<1-sentence goal>

## Instructions
1. <specific action 1>
2. <specific action 2>
...

## Output Format
<expected output format>

## Success Criteria
- <quantitative criterion 1>
- <quantitative criterion 2>
```

Show the draft and ask if the user wants to modify it.

#### VS Component Directives

When writing instructions for `visual_selection: true` gate nodes, include a VS directive block that tells the execution agent which components to render:

```text
## VS Components
Use bk-options for the main selection. Add data-recommended to the suggested choice.
Include a bk-slider named "confidence" (0-100, default 75, unit "%").
Add a bk-section break before the slider.
```

The execution agent reads this directive and composes the corresponding bk-\* HTML fragment. Available components: `bk-options`, `bk-cards`, `bk-checklist`, `bk-code-compare`, `bk-slider`, `bk-ranking`, `bk-matrix`, `bk-split`, `bk-pros-cons`, `bk-mockup`, `bk-timeline`.

Write the directive in concrete terms. Specify:

- which component(s) to use
- which option should be marked `data-recommended`, if any
- names, ranges, defaults, and units for sliders
- which items must appear in rankings, checklists, or matrix plots
- the user's language for all visible text

**Credential binding**:

Ask: "Does this instruction use an external service?" via AskUserQuestion:

- options: ["Yes, specify a service", "No"]

If "Yes":

1. Ask the user to describe the service in natural language. Example: "Use the GitHub API to fetch the PR list."
2. Call `list_credentials` to get registered credentials.
3. Try to match the input against `service_name` (case-insensitive partial match).
4. Show the match result and confirm:

```
Matched credentials for "GitHub":
  → ID 2: github (GitHub PAT)

Bind this credential to the instruction?
```

If matched: set `credential_id` in the `create_instruction` call (see below).

If no match: "Could not find a matching credential. Register it first with `/bk-credential add`."

**Select folder**: Call `list_folders`, show the tree to the user, then ask via AskUserQuestion which folder the new instruction should live in. If the user picks nothing, omit `folder_id` — the server drops the instruction into the caller's **My Workspace**.

Folders control who else can see/edit this instruction: group-shared folders expose the instruction to the members of those groups; personal folders keep it caller-only. To change visibility later, either move the instruction with `move_instruction` or change the folder's sharing with the folder share APIs.

**Register**:

Call `create_instruction`:

```json
{
  "title": "<title>",
  "content": "<content>",
  "agent_type": "<agent type>",
  "tags": ["tag1", "tag2"],
  "priority": 0,
  "credential_id": <credential id or omit>,
  "folder_id": <folder id or omit>
}
```

On success:

```
✅ Instruction registered
Title: <title> (ID: <id>)
Credential: <service_name> (ID: <credential_id>) — or "없음"

To use this instruction in a workflow node, set instruction_id: <id>
when designing nodes with `/bk-design`.
```

---

### Action: Edit

Call `list_instructions` → select target via AskUserQuestion.

Ask what to change (AskUserQuestion):

- options: ["Change title", "Edit content", "Change agent type", "Change credential", "Activate/Deactivate", "Cancel"]

If "Change credential": call `list_credentials`, show options, then call `update_instruction` with `credential_id` (or `null` to unbind).

Call `update_instruction` with only the changed fields.

---

### Action: Move

Call `list_instructions` → select the instruction to move via AskUserQuestion.

Call `list_folders` → display the folder tree and ask which folder to move into (AskUserQuestion).

Call `move_instruction`:

```json
{
  "instruction_id": <id>,
  "folder_id": <target folder id>
}
```

The server validates that the caller has edit access on the target folder
(otherwise returns 403). Moving between group-shared folders changes who
can see/edit the instruction because visibility is inherited from the
folder unless the instruction has an explicit `visibility_override`.

**On 403**: tell the user "이 폴더로 이동할 권한이 없습니다. 다른 폴더를 선택하거나, 폴더 소유자에게 contributor 권한을 요청하세요." Offer to retry with a different folder via AskUserQuestion. Do not silently swallow the error.

---

### Action: Delete

Call `list_instructions` → select target via AskUserQuestion.

Confirm via AskUserQuestion:

- header: "Confirm delete"
- "Delete '{title}'? This will fail if any workflow node is using it."
- options: ["Delete", "Cancel"]

Call `delete_instruction`. On 409 error, show which workflow is using it.
