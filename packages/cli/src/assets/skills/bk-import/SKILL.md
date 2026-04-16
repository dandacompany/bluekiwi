---
name: bk-import
description: Analyzes an external resource (GitHub repo, local skill, URL, or text) and converts it into a BlueKiwi workflow registered directly on the server. Triggers when the user says "/bk-import", "import from github", "convert this skill to workflow", "create workflow from repo/url/skill", or pastes content they want turned into a workflow.
user_invocable: true
---

# bk-import — External Resource to BlueKiwi Workflow

Analyze an external resource, extract its process logic, convert it into a structured BlueKiwi workflow, and register it directly via MCP.

## Argument Handling

- `/bk-import` → Ask for the resource via AskUserQuestion.
- `/bk-import <resource>` → Start analysis from the provided resource.

## Step 1: Parse Input

Determine the resource type from the argument:

| Type         | Detection rule                                   | Analysis method           |
| ------------ | ------------------------------------------------ | ------------------------- |
| GitHub repo  | `https://github.com/…` or `owner/repo` pattern   | repomix `--remote`        |
| Local skill  | Matches `bk-*` name or `~/.claude/skills/…` path | Read `SKILL.md` + scripts |
| Local path   | Starts with `/`, `./`, or `~/`                   | Read files directly       |
| External URL | `http://` or `https://` (non-GitHub)             | WebFetch                  |
| Text/JSON    | Anything else                                    | Direct parse              |

If no argument, ask via AskUserQuestion:

- header: "Import from where?"
- "Which resource do you want to convert into a BlueKiwi workflow?"
- options: ["GitHub repo URL or owner/repo", "Local skill (e.g. bk-run)", "External URL", "Paste text or JSON"]

## Step 2: Fetch & Analyze Content

### GitHub Repository

```bash
npx repomix@latest --remote <owner/repo> --compress --output /tmp/bk-import-<repo-name>.xml
```

After packing, extract in order:

1. File tree → identify architecture layers (API, UI, scripts, config)
2. README.md → purpose, key steps, usage examples
3. Main entry points (index, main, app) → sequential process logic
4. Configuration files → decision points and branching options

Clean up when done: `rm /tmp/bk-import-<repo-name>.xml`

**If the repo URL points to a subdirectory** (e.g., `…/tree/main/packages/cli`), run repomix on the full repo then focus grep analysis on that path.

### Local Skill

Resolve path:

- Bare name (e.g. `bk-run`) → `~/.claude/skills/bk-run/SKILL.md`
- Full path → read directly

Read `SKILL.md` completely. Also read any files under `scripts/` if present.

Extract:

- Numbered or headed execution steps → sequential actions
- Options/choices presented to the user → decision points
- "Repeat until" or loop patterns → iterative steps

### External URL

```
WebFetch <url>
```

Extract the main process described: step sequences, decision criteria, iterative patterns.

### Text / JSON Paste

If JSON: detect format (n8n workflow, GitHub Actions, etc.) and parse its nodes/steps/jobs structure.

If plain text: extract numbered or headed steps, conditionals, and loops.

## Step 3: Extract Workflow Logic

From the analyzed content, identify and label each element:

**Sequential execution → `action` node candidates**

- "Do X, then Y" patterns
- Script / CLI execution steps
- Data fetching or transformation steps
- API calls, file generation, report writing

**Decision points → `gate` node candidates**

- User approval required before continuing
- "Choose between A or B" patterns
- Final review before an irreversible action

**Iterative patterns → `loop` node candidates**

- "Repeat until condition met"
- Q&A / clarification loops (ask one question, get answer, repeat)
- Review → feedback → revise cycles

**Human sign-off for risky actions → `hitl: true` on action nodes**

- Sending emails or external messages
- Deploying to production
- Deleting or overwriting data

## Step 4: Design Nodes

Convert the extracted logic into BlueKiwi nodes. Apply the **Instruction Depth Standard** (same rules as bk-design) to every node:

<HARD-RULE>
Every node instruction must include ALL of the following:

1. **Role/context** (1 line): who or what performs this step
2. **Numbered sub-steps**: at least 2 explicit steps describing HOW — not just WHAT
3. **Output specification**: exactly what is produced (file path, format, structure)
4. **Verification**: how to confirm the step succeeded
5. **Loop nodes only**: explicit termination condition on the last line

Minimum instruction length: 80 words. One-sentence summaries are rejected.
</HARD-RULE>

**Anti-patterns to avoid when writing instructions:**

| ❌ Do not write           | ✅ Write instead                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Analyze the repository." | "Read README.md and list top-level directories. For each dir, identify its role. Output a bullet-point component map covering tech stack, architecture pattern, and entry points." |
| "Review the results."     | "Check output against the success criteria from Step 1. Present a pass/fail table with specific evidence per criterion. Flag any item below threshold."                            |
| "Ask the user."           | "Present exactly 3 options via bk-options (sm): A) proceed, B) revise, C) cancel. Include a one-sentence consequence for each."                                                    |

**Node count target:** 4–8 nodes. If the source describes more than 10 distinct steps, group related micro-steps into single nodes.

## Step 5: Present Proposed Structure

Display the proposed workflow to the user:

```
📦 Importing: <resource name>

Proposed workflow: <title>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [Step Name]           action
2. [Step Name]           gate      ← user approval
3. [Step Name]           loop  ↩   repeats until X
4. [Step Name]           action    🔒 hitl
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<N> steps  ·  source: <resource>
```

Ask via AskUserQuestion:

- header: "Confirm import"
- "Create this workflow from <resource>?"
- options: ["Create", "Edit node structure", "Cancel"]

If "Edit" → accept modification input, redesign affected nodes, and re-present.

## Step 6: Select Folder

Call `list_folders`. Ask via AskUserQuestion:

- header: "Save location"
- "Which folder should this workflow be saved in?"
- options: folder name list (up to 4) + "My Workspace (default)"

## Step 7: Register via MCP

Call `create_workflow`:

```json
{
  "title": "<derived title — concise, action-oriented>",
  "description": "<1–2 sentences: what this workflow does and when to use it>",
  "version": "1.0",
  "folder_id": <selected folder id>,
  "nodes": [
    {
      "step_order": 1,
      "node_type": "action",
      "title": "...",
      "instruction": "...",
      "hitl": false,
      "loop_back_to": null,
      "visual_selection": false
    }
  ]
}
```

<HARD-RULE>
Immediately validate the `create_workflow` result:

- If the response includes `node_verification`, require `node_verification.mismatch === false`.
- If `nodes` were supplied to `create_workflow`, do not follow with `append_node` for the same imported step set.
- Never treat an older `data.nodes=[]` response shape as evidence that the initial nodes were not created.
- If verification fails, STOP and investigate instead of patching the workflow incrementally.
  </HARD-RULE>

## Step 8: Report Result + Open in Browser

On success:

```bash
open "${WEBUI_URL}/workflows/${WORKFLOW_ID}"
```

`WEBUI_URL` = the `webui_url` field returned by `create_workflow`.

Display:

```
✅ Workflow imported
Name:   <title> (ID: <id>)
Source: <resource>
Steps:  <n>
🔗 ${WEBUI_URL}/workflows/${WORKFLOW_ID}

Type /bk-run to execute it now.
```

## Node Type Quick Reference

| Type                               | Behavior                                     | When to use                                    |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `action`                           | Auto-advances                                | Execution, data work, generation               |
| `gate`                             | Pauses for user input                        | Approval, direction choice, review             |
| `loop`                             | Repeats until termination condition          | Q&A, iterative refinement, section review      |
| `hitl: true` on `action`           | Pauses after execution for explicit sign-off | Irreversible or security-sensitive actions     |
| `visual_selection: true` on `gate` | Agent renders HTML; user clicks to choose    | Visual A/B choices, layout picks, option cards |
