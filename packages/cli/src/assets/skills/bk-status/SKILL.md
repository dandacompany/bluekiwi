---
name: bk-status
description: BlueKiwi task status skill. Checks the progress of active and completed tasks. This skill should be used when the user says "/bk-status", "task status", "check progress", or wants to view BlueKiwi task status.
user_invocable: true
---

# BlueKiwi Task Status

View the progress of active and completed tasks.

## Argument Handling

- `/bk-status` → Show all running tasks. If none, show recent completed tasks.
- `/bk-status <task_id>` → Show detailed step-by-step log for that task.
- `/bk-status running` → Show only running tasks.
- `/bk-status completed` → Show only completed tasks.

## Execution Steps

### 1. Fetch Tasks

Call `list_tasks` with optional filters:

- No argument: `list_tasks()` (all tasks) or `list_tasks(status="running")`
- With status filter: `list_tasks(status="running")` or `list_tasks(status="completed")`
- With task_id: `advance(task_id=<id>, peek=true)` for detailed view

### 2. Display Task List

```
BlueKiwi Task Status
━━━━━━━━━━━━━━━━━━━━━━━━━
  #1  [completed] Feature Brainstorm   8/8 steps   2026-04-07
  #2  [running]   PR Security Review   2/4 steps   2026-04-07  ← active
  #3  [running]   DB Migration Plan    5/7 steps   2026-04-08  ← active
━━━━━━━━━━━━━━━━━━━━━━━━━
Active: 2 tasks
```

### 3. Detailed View

If a task number is given, call `advance(task_id=<id>, peek=true)` and show the step-by-step log:

```
Task #2: PR Security Review (running)
━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ 1. Code Analysis          completed  12s
  ✅ 2. Dependency Check        completed  8s
  ⏸ 3. Security Review         pending    ← current (gate)
  ○  4. Report Generation       —
━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4. Offer Actions

After displaying, ask via AskUserQuestion:

- header: "Actions"
- options: ["Resume active task (/bk-start)", "View detailed task", "Done"]

## Notes

- `list_tasks` respects RBAC — only tasks on workflows the user can read are returned.
- For real-time monitoring, use the web UI: http://localhost:3000/tasks
