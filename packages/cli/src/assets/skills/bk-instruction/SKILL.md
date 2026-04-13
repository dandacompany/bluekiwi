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

## What is an Instruction?

An instruction is an **execution directive** that a workflow node delivers to the agent at runtime.

- Well-written instructions control agent behavior precisely.
- **Credential binding happens at the workflow node level**, not at the instruction level.
  To reference a credential in an instruction, include the service name in the `content` text.
  Then link the `credential_id` to the node when designing the workflow in `/bk-design` or `/bk-improve`.

## Execution Steps

### Step 0: Select Action

If no argument, ask via AskUserQuestion:

- header: "Instructions"
- options: ["List", "Create new", "Edit", "Delete"]

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

**Credential linking (natural language)**:

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

Add this credential reference to the instruction content?
```

If matched: append the following block to the content automatically:

```
## Required Credentials
- service: github (credential_id: 2)
  purpose: GitHub API authentication
```

If no match: "Could not find a matching credential. Register it first with `/bk-credential add`."

**Select folder**: Call `list_folders`, then ask via AskUserQuestion.

**Register**:

Call `create_instruction`:

```json
{
  "title": "<title>",
  "content": "<content>",
  "agent_type": "<agent type>",
  "tags": ["tag1", "tag2"],
  "priority": 0,
  "folder_id": <folder id>
}
```

On success:

```
✅ Instruction registered
Title: <title> (ID: <id>)

To use this instruction in a workflow node, set instruction_id: <id>
when designing nodes with `/bk-design`.
```

---

### Action: Edit

Call `list_instructions` → select target via AskUserQuestion.

Ask what to change (AskUserQuestion):

- options: ["Change title", "Edit content", "Change agent type", "Activate/Deactivate", "Cancel"]

Call `update_instruction` with only the changed fields.

---

### Action: Delete

Call `list_instructions` → select target via AskUserQuestion.

Confirm via AskUserQuestion:

- header: "Confirm delete"
- "Delete '{title}'? This will fail if any workflow node is using it."
- options: ["Delete", "Cancel"]

Call `delete_instruction`. On 409 error, show which workflow is using it.
