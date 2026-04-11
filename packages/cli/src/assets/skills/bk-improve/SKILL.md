---
name: bk-improve
description: BlueKiwi workflow improvement skill. Analyzes an existing workflow, creates a better version, and optionally runs it to compare results. This skill should be used when the user says "/bk-improve", "improve workflow", "make a better version", or wants to refine an existing BlueKiwi workflow.
user_invocable: true
---

# BlueKiwi Workflow Improve

Improve an existing workflow by creating a new version, then optionally execute it to compare results.

## Argument Handling

- `/bk-improve` → Fetch workflow list, ask user to select.
- `/bk-improve <workflow name>` → Load that workflow directly.

## Execution Steps

### Step 1: Select Target Workflow

If no argument, call `list_workflows` and ask via AskUserQuestion:

- header: "Which workflow?"
- "Which workflow would you like to improve?"
- options: workflow title list (up to 4)

### Step 2: Understand Improvement Direction

Ask via AskUserQuestion:

- header: "Improvement goal"
- "What would you like to improve?"
- options: ["Set more quantitative goals", "Break steps into finer detail", "Improve accuracy", "Type my own"]

If "Type my own" → accept free-text improvement direction.

### Step 3: Analyze the Current Workflow

## 피드백 데이터 활용

워크플로 개선 시, advance(peek=true)로 태스크를 조회하면 `feedback_data` 필드를 확인할 수 있다.
`feedback_data`가 존재하면 이를 개선 분석의 1차 자료로 활용한다:

1. 각 feedback 항목의 `question`과 `answer`를 읽는다
2. 부정적 답변(만족하지 않음, 부족함 등)을 식별한다
3. 해당 feedback과 관련된 단계를 개선 우선순위에 올린다
4. 개선 제안 시 "사용자 피드백 기반" 임을 명시한다

Display the current workflow node structure:

```
Current workflow: <title> v<version>
━━━━━━━━━━━━━━━━━━━━━━━━━
1. [Step name] — <instruction summary>
2. [Step name] — <instruction summary>
...
━━━━━━━━━━━━━━━━━━━━━━━━━
```

Review each node against the improvement direction:

- Vague goals → add quantitative criteria
- Oversized steps → split them
- Missing validation → add it
- Unnecessary steps → remove them

### Step 4: Design Improved Nodes

Design the full improved node set.

Show a diff of the changes:

```
Improvements:
━━━━━━━━━━━━━━━━━━━━━━━━━
✏️  Step 1: "Collect keywords" → "Collect top 10 keywords (by search volume)"
➕  Step 4 added: "Quantitative validation (retry if below threshold)"
━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask via AskUserQuestion:

- header: "Confirm"
- "Create a new version (v<x.y>) with these improvements?"
- options: ["Create new version", "Adjust more", "Cancel"]

### Step 5: Create New Version

Call `update_workflow` with `create_new_version: true`:

```json
{
  "workflow_id": <existing id>,
  "create_new_version": true,
  "version": "<new version>",
  "nodes": [<improved node array>]
}
```

### Step 6: Offer Immediate Execution

Ask via AskUserQuestion:

- header: "Run now?"
- "New version v<x.y> created. Run it now to check results?"
- options: ["Run now", "Run later"]

If "Run now" → switch to `/bk-run` flow and start a task with the new version.

### Step 7: Report Result

```
✅ New version created
Workflow: <title>
Previous: v<old>  →  New: v<new>
Improved steps: <n>
```

## 노드 수정 전략

<HARD-RULE>
- 노드 1개 수정 → `update_node(workflow_id, node_id, ...변경할 필드만)`
- 노드 추가 (끝에) → `append_node(workflow_id, title, instruction, node_type)`
- 노드 삽입 (중간) → `insert_node(workflow_id, after_step=N, title, instruction, node_type)`
- 노드 삭제 → `remove_node(workflow_id, node_id)`
- 전체 재설계가 아닌 이상 `update_workflow(nodes=[...])` 전체 교체 호출 금지
</HARD-RULE>
