---
name: bk-rewind
description: BlueKiwi step rewind skill. Returns to a previous or specific step in a running task. This skill should be used when the user says "/bk-rewind", "go back", "previous step", "rewind", or wants to return to an earlier step in a BlueKiwi task.
user_invocable: true
---

# BlueKiwi Rewind

Return to a specific step in a running task. Previous execution logs are preserved; a new pending log is created at the target step.

## Argument Handling

- `/bk-rewind` → No argument. Ask the user to select a step via AskUserQuestion.
- `/bk-rewind 3` → Target step number provided directly.
- `/bk-rewind clarification question` → Match by step title.

## Execution Steps

### 1. Verify Active Task

Call `advance` with `peek: true` to check the active task.

- If no active task → show "No active task." and exit.

### 2. Determine Target Step

If no argument, show a selection UI via AskUserQuestion:

- List completed steps as options
- Include a summary of the step's output in each option's description
- Show any comments on that step in the preview

If the argument is a number → use that step number directly.
If the argument is text → match against step titles to find the step number.

### 3. Confirm User Requirements

Before rewinding, ask via AskUserQuestion:

```
"Going back to Step [N] ({title}). Do you have any specific requirements for this re-run?"
```

Options:

- "Proceed as-is (Recommended)" — continue without additional context
- "I have specific requirements" — free text input via Other

If the user enters requirements, save them as a comment on the task (task_comments).

### 4. Execute Rewind

Call `rewind` to go back to the target step.

Show the result:

```
━━━━━━━━━━━━━━━━━━━━━━━━━
Going back to Step [N]/[Total]: [{node title}] [{node_type}]
(Previous execution logs are preserved)
━━━━━━━━━━━━━━━━━━━━━━━━━
Type `/bk-next` to re-execute this step.
━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Rules

- Always ask the user for additional requirements before rewinding.
- If requirements are provided, save them as a comment so `/bk-next` can reference them.
- Handle all choices via AskUserQuestion.
