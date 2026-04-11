---
name: bk-status
description: BlueKiwi task status skill. Checks the progress of active and completed tasks. This skill should be used when the user says "/bk-status", "task status", "check progress", or wants to view BlueKiwi task status.
user_invocable: true
---

# BlueKiwi Task Status

View the progress of active and completed tasks.

## Execution Steps

### 1. Fetch Tasks

Call `advance` with `peek: true` on any known active task, or check the server for running tasks.

### 2. Display Results

```
BlueKiwi Task Status
━━━━━━━━━━━━━━━━━━━━━━━━━
  #1  [completed] Feature Brainstorm   8/8 steps   2026-04-07
  #2  [running]   PR Security Review   2/4 steps   2026-04-07  ← active
━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. Detailed View

If a task number is given as an argument (`/bk-status 2`), show the step-by-step log for that task.

## Notes

- Web UI: http://localhost:3000/tasks
- Real-time monitoring: Requires WebSocket Relay (`npm run ws`)
