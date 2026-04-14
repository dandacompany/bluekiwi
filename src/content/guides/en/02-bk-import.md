# BlueKiwi Tutorial #02 — bk-import: Convert Any Resource into a Workflow

## 0. What this tutorial shows

A GitHub repo, a local skill, an external URL — one `/bk-import` command is all it takes to:

1. **Deeply analyze** the resource with repomix or WebFetch
2. **Translate** its process logic into action / gate / loop nodes
3. **Register** a workflow with detailed, executable instructions on the server
4. Open it in the browser and run it immediately with `/bk-run`

---

## 1. Supported input types

| Type              | Example                         | Analysis method                              |
| ----------------- | ------------------------------- | -------------------------------------------- |
| GitHub repo URL   | `https://github.com/owner/repo` | repomix `--remote` (Tree-sitter compression) |
| GitHub shorthand  | `owner/repo`                    | Same                                         |
| Local skill name  | `bk-design`, `bk-start`         | Reads `~/.claude/skills/<name>/SKILL.md`     |
| Local path        | `~/projects/my-script`          | Reads files directly                         |
| External URL      | `https://example.com/runbook`   | WebFetch                                     |
| Text / JSON paste | n8n workflow JSON, etc.         | Direct parse                                 |

---

## 2. Quick start

### 2-1. Create a workflow from a GitHub repo

```text
/bk-import yamadashy/repomix
```

The agent automatically:

1. Runs `npx repomix@latest --remote yamadashy/repomix --compress`
2. Extracts process logic from README and key source files
3. Maps sequential steps → action, decision points → gate, loops → loop nodes
4. Shows the proposed structure and asks for confirmation

### 2-2. Create a workflow from a local skill

```text
/bk-import bk-design
```

Reads `~/.claude/skills/bk-design/SKILL.md` and converts the skill's execution flow into a BlueKiwi workflow.

### 2-3. Create a workflow from an external document

```text
/bk-import https://docs.example.com/runbook/deploy
```

Fetches the page with WebFetch and converts the described procedure into a workflow.

---

## 3. Interaction flow

```
User: /bk-import yamadashy/repomix

Agent:
  📦 Packing repo... (repomix --compress)
  ✓ 43 files, ~18,000 tokens

  📦 Importing: yamadashy/repomix

  Proposed workflow: Repomix — Repository Analysis Pipeline
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [Understand repo purpose & structure]   action
  2. [Select analysis scope]                 gate  ← user decision
  3. [Deep pattern exploration]              loop ↩ repeats
  4. [Review analysis results]               gate  ← user approval
  5. [Generate insights report]              action
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  5 steps · source: yamadashy/repomix

  [Create] [Edit node structure] [Cancel]
```

---

## 4. Instruction quality

`/bk-import` applies the same **Instruction Depth Standard** as `/bk-design`. Every node instruction must include:

1. **Role/context** — who or what performs this step
2. **Numbered sub-steps** — what to do and how
3. **Output specification** — file path, format, structure
4. **Verification** — how to confirm completion
5. **Loop nodes** — explicit termination condition

Instructions that are only 1–2 sentences are automatically rejected and expanded.

---

## 5. Real-world example — converting an n8n workflow JSON

Export a workflow from n8n, paste the JSON into Claude Code, then:

```text
/bk-import
```

Select "Paste text or JSON" when prompted for the input type, then paste the JSON. The agent maps n8n's node structure (Trigger → HTTP Request → If → Set → ...) to BlueKiwi action/gate/loop nodes.

---

## 6. Running the imported workflow

Once registered, run it immediately:

```text
/bk-run
```

Or click the **Run** button on the workflow page that opens in your browser.

[bk://try/02-repomix-analysis-pipeline]

---

## 7. Tips

- **Large GitHub repos** — repomix applies `--compress` automatically, reducing token count by ~70%.
- **Not happy with the result?** — choose "Edit node structure" to refine specific nodes before registering.
- **Similar workflow already exists?** — use `/bk-improve` to enhance it instead of creating a duplicate.
- **Local skill names** — the `bk-` prefix is optional (`design` is resolved to `bk-design` automatically).
