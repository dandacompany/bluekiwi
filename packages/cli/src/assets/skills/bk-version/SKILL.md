---
name: bk-version
description: BlueKiwi version management skill. Lists all versions of a workflow family, activates or deactivates specific versions, and compares versions. This skill should be used when the user says "/bk-version", "manage versions", "switch version", "see version history", or wants to handle workflow versioning in BlueKiwi.
user_invocable: true
---

# BlueKiwi Version Management

View, compare, activate, and manage versions of a workflow family.

## Argument Handling

- `/bk-version` → Select a workflow and show its version history.
- `/bk-version <workflow name>` → Load version history for the named workflow directly.

## Core Concepts

- A **workflow family** shares the same root. All versions created via `create_new_version: true` are members of the same family.
- Only **one version per family** can be active at a time. Activating a version automatically deactivates the previous active one.
- Inactive (archived) versions are readable but cannot be started with `start_workflow`.

## Execution Steps

### Step 1: Select Workflow

If no argument, call `list_workflows` and ask via AskUserQuestion:

- header: "Which workflow?"
- options: workflow title list (up to 4)

### Step 2: Load Version History

Call `list_workflow_versions` for the selected workflow ID.

Display the version list:

```
Workflow versions: {title}
━━━━━━━━━━━━━━━━━━━━━━━━━
  v1.0  (ID: 12)  ✅ Active   created 2026-04-10
  v1.1  (ID: 15)  🗄️ Archived  created 2026-04-11
  v2.0  (ID: 18)  🗄️ Archived  created 2026-04-12
━━━━━━━━━━━━━━━━━━━━━━━━━
Active: v1.0
```

### Step 3: Select Action

Ask via AskUserQuestion:

- header: "Version action"
- options: ["Activate a version", "Deactivate current", "Compare two versions", "Cancel"]

---

### Action: Activate

Ask which version to activate via AskUserQuestion (show archived versions as options).

Confirm:

```
Activate v<x.y> (ID: <id>)?
This will deactivate the current active version v<current>.
```

Call `activate_workflow` with the selected `workflow_id`.

---

### Action: Deactivate Current

Confirm via AskUserQuestion:

- "Deactivate the current active version v<version>? No version will be active until you reactivate one."
- options: ["Deactivate", "Cancel"]

Call `deactivate_workflow`.

---

### Action: Compare Two Versions

Ask the user to select two versions to compare via AskUserQuestion.

Fetch both workflows and display a side-by-side node comparison:

```
Comparing v<a> vs v<b>
━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1: [same] Clarify Goal
Step 2: [changed] "Collect keywords" → "Collect top 10 keywords (by search volume)"
Step 3: [added in v<b>] Quantitative Validation
━━━━━━━━━━━━━━━━━━━━━━━━━
```
