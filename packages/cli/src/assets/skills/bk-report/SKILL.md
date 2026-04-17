---
name: bk-report
description: BlueKiwi task report skill. Generates a structured summary report of a completed or in-progress task, including decisions, artifacts, and findings. This skill should be used when the user says "/bk-report", "show task report", "summarize results", or wants a structured report of a BlueKiwi task.
user_invocable: true
---

# BlueKiwi Task Report

Generate a structured summary report of a completed or in-progress task.

## Argument Handling

- `/bk-report` → Report on the most recent active or completed task.
- `/bk-report <task_id>` → Report on the specified task.

## Execution Steps

### Step 1: Load Task Data

Call `advance` with `peek: true` to get the current task state and `task_context`.

If a specific task_id is provided, use it directly.

`task_context.artifacts` already contains the full artifact list for the task (file paths, git refs, URLs that were recorded via `execute_step`'s `artifacts[]` array). No separate load call is needed.

### Step 2: Load Findings

If the workflow includes compliance steps, call `list_findings` to retrieve compliance findings. Otherwise skip this step.

### Step 3: Generate Report

Build the report from the collected data:

```markdown
# Task Report: {workflow title}

**Task ID**: {id}
**Status**: {running | completed | failed}
**Started**: {started_at}
**Completed**: {completed_at or "in progress"}
**Steps**: {completed}/{total}

---

## Summary

{task_context.running_context summary — key decisions and outcomes}

---

## Step-by-Step Log

| Step | Title        | Status | Key Output                   |
| ---- | ------------ | ------ | ---------------------------- |
| 1    | Clarify Goal | ✅     | Defined target market as SMB |
| 2    | Collect Data | ✅     | 15 competitors identified    |
| 3    | Review       | ⏳     | Pending approval             |

---

## VS Responses

{for each step with web_response data}

### Step {N}: {title}

{format the JSON response as readable text}

- **Selected**: {selections joined with ", "}
- **Values**: {key = value for each entry in values}
- **Priority ranking**: {ranking as numbered list}
- **Matrix placement**: {item -> quadrant description for each entry}
- **Comment**: {comment if present}
- **Field inputs**: {key = value for each entry in fields}
- **Option comments**: {option -> note for each entry in option_comments}

{if no VS responses}
No visual selection responses recorded.

---

## Artifacts

| Type       | Title      | Location                          |
| ---------- | ---------- | --------------------------------- |
| file       | Design Doc | `docs/specs/2026-04-11-design.md` |
| git_commit | Phase 1    | `a1b2c3d`                         |

---

## Compliance Findings

{if findings exist}
| ID | Severity | Description | File |
|----|----------|-------------|------|
| ISMS-001 | BLOCK | Hardcoded secret | src/config.ts:42 |

{if no findings}
No compliance issues found.

---

## Next Steps

{task_context summary of recommended next actions}
```

### Step 4: Display and Offer Export

Show the report.

Ask via AskUserQuestion:

- header: "Export?"
- "Would you like to save this report to a file?"
- options: ["Save as Markdown", "Skip"]

If "Save as Markdown" → write to `reports/bk-report-{task_id}-{date}.md`.
