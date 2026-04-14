# BlueKiwi Practical Tutorial #01 — Market Research Workflow

## 0. What This Tutorial Demonstrates

With a single natural-language prompt, BlueKiwi will:

1. Use `/bk-design` to **design a 7-step workflow → register it on the server**
2. Use `/bk-start` to **auto-execute each step** (web search + artifact writing)
3. Pause mid-run for a **VS Gate (Visual Selection)** human review
4. Automatically produce a final **Markdown report**

All of this is shown with a real session log.

---

## 1. Prerequisites

### 1-1. Install BlueKiwi CLI & Connect to Server

```bash
npm i -g bluekiwi
bluekiwi accept <invite-token>      # or: bluekiwi login
bluekiwi --version                  # 0.3.9
```

`~/.bluekiwi/config.json` stores your server URL and API key.

```json
{
  "server_url": "https://dantelabs.bluekiwi.work",
  "api_key": "bk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### 1-2. Verify Skill Registration

When you install the BlueKiwi CLI, **skills** like `/bk-design` and `/bk-start` are automatically registered in Claude Code. Skills run as slash commands and communicate with the BlueKiwi server internally.

> **You only need to call the skill.** MCP connections and API calls are handled automatically.

Once installation is complete, `/bk-` skills are available immediately in any Claude Code session.

### 1-3. ⚠️ Permission Mode Notice

For skills to communicate with the BlueKiwi server automatically, Claude Code must be started in the **appropriate permission mode**. In `don't ask` mode, skill execution is blocked and every step requires manual approval.

```bash
# Recommended: bypass mode — skills run automatically (personal machine)
claude --permission-mode bypassPermissions

# Or acceptEdits — a confirmation popup appears before each skill runs
claude --permission-mode acceptEdits
```

After startup, `⏵⏵ bypass permissions on` in the bottom-right corner means you're good to go.

---

## 2. The One-Line Prompt

Open Claude Code in your working folder (`~/workspace/.../test`) and type:

```text
Run a market research on domestic AI coding assistants
(focusing on Cursor, Windsurf, and Claude Code).

Comparison points:
- Pricing (individual / team / enterprise)
- Core feature differentiators
- Korean user community reactions (blogs, YouTube, communities)
- Strengths and weaknesses

Use /bk-design to design the workflow, then /bk-start to execute it,
and produce a final Markdown comparison report at the end.
```

That's it. The agent handles everything from here.

---

## 3. Step-by-Step Session Log

### Phase A — `/bk-design` Workflow Design

```
⏺ Skill(bk-design)  Successfully loaded skill
```

The agent runs the `/bk-design` skill. It queries existing folders and workflows on the BlueKiwi server, then proposes a **7-step design** tailored to the goal.

```
Workflow: Domestic AI Coding Assistant Market Research (Cursor/Windsurf/Claude Code)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [Define Research Scope & Items]    action
2. [Cursor Research]                  action
3. [Windsurf Research]                action
4. [Claude Code Research]             action
5. [Comparative Analysis & SWOT]      action
6. [Draft Review]                     gate (VS: pros-cons)
7. [Generate Final Markdown Report]   action
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total 7 steps · Folder: Marketing & Content
```

After you approve the design, the skill registers the workflow on the BlueKiwi server:

```
✅ Workflow registered
Name: Domestic AI Coding Assistant Market Research (ID: 90) · Steps: 7 · Version: 1.0
```

### Phase B — `/bk-start` Execution

```
⏺ Skill(bk-start)  Successfully loaded skill

Starting: Domestic AI Coding Assistant Market Research (7 steps)
━━━━━━━━━━━━━━━━━━━━━━━━━
**1** → 2 → 3 → 4 → 5 → 6 → 7
━━━━━━━━━━━━━━━━━━━━━━━━━
```

Each step is tracked server-side (Task #1) and you can watch progress in real time from the web UI.

#### Step 1 — Define Research Scope

Writes `scope.json` (42 lines): targets, pricing tiers, and Korean-specific search queries — all structured.

```json
{
  "targets": ["Cursor", "Windsurf", "Claude Code"],
  "comparison_fields": {
    "pricing": { "tiers": ["individual", "team", "enterprise"], ... },
    "core_features": { ... },
    "korean_community": { ... },
    "strengths_weaknesses": { ... }
  }
}
```

#### Steps 2–4 — Per-Product Research (Cursor / Windsurf / Claude Code)

**4 web searches per product**, then writes a JSON artifact:

```
⏺ Step 2: Cursor Research
⏺ Web Search("Cursor AI editor pricing 2026 Hobby Pro Business Enterprise plan")
⏺ Web Search("Cursor AI 후기 사용법 한국 블로그 2025")
⏺ Web Search("Cursor Composer Agent Tab MCP features codebase indexing 2026")
⏺ Web Search("커서 AI 단점 불만 한국 개발자 유튜브")
⏺ Write(cursor.json)  → 61 lines
```

Mixing English and Korean queries captures both global pricing data and domestic community sentiment.

#### Step 5 — Comparative Analysis & SWOT

Writes `comparison.md` (72 lines): pricing comparison table, core feature differentiators, Korean community reaction summary, and per-product SWOT analysis.

#### Step 6 — Draft Review (VS Gate) ⏸

The agent pauses for **human input**:

```
☐ Draft Decision
Have you reviewed the draft? Generate the final report now,
or pick additional items to include?

❯ 1. Approve (generate final report)
  2. Add security & privacy section, then generate
  3. Add benchmarks, then generate
  4. Add Korean enterprise adoption cases
  5. Type something.
```

For this run, `1. Approve` was selected. (In practice you might pick 2–4 to loop in an extra refinement pass.)

> 💡 **VS Gate** is one of BlueKiwi's core differentiators. Instead of a plain "y/n", the gate presents the choices you defined at design time, visually, for the user to select.

#### Step 7 — Generate Final Markdown Report

Auto-writes `ai-coding-assistants-kr-report.md` (15 KB, 7 sections):

1. Executive Summary
2. Pricing Comparison
3. Core Feature Differentiators
4. Korean Community Reactions
5. Strengths / Weaknesses
6. Recommendations by User Type
7. Sources & Limitations

---

## 4. Final Artifacts

The following files are left in the working folder:

| File                                | Size      | Purpose                                         |
| ----------------------------------- | --------- | ----------------------------------------------- |
| `scope.json`                        | 2 KB      | Research scope, comparison axes, Korean queries |
| `cursor.json`                       | 4 KB      | Raw Cursor research data (with sources)         |
| `windsurf.json`                     | 4 KB      | Raw Windsurf research data                      |
| `claude-code.json`                  | 5 KB      | Raw Claude Code research data                   |
| `comparison.md`                     | 9 KB      | Comparative analysis draft (intermediate)       |
| `ai-coding-assistants-kr-report.md` | **15 KB** | **Final report (7 sections)**                   |

On the server, Workflow #90 and Task #1 preserve all step logs and artifacts, so you can **re-run the same workflow on a different topic** anytime.

---

## 5. Key Takeaways (Report Summary)

The agent's one-line summary at the end of the report:

- **Cursor** — Unmatched Tab speed & immediacy; downside: limited Korean-market support and pricing burden
- **Windsurf** — Cascade large-context handling & Korean-friendly; downside: ownership-change risk
- **Claude Code** — Sub-agent / Skills / Hooks composability + thickest official Korean ecosystem; downside: terminal learning curve

---

## 6. Wrap-Up & Usage Tips

### Strengths of This Workflow

- **7-step auto-execution from one natural-language prompt**: No need to direct each step individually — `/bk-design` analyzes your goal and designs the full structure.
- **Isolated artifacts per step**: Each step's output (`cursor.json`, `windsurf.json`, etc.) is stored independently, so you can edit and re-run a single step.
- **Mid-run intervention via VS Gate**: Rather than "run everything to the end", you can embed explicit review checkpoints inside the workflow.

### Caveats

- **Permission mode is required**: Skill auto-execution is blocked in `don't ask` mode. Always start Claude Code with `bypassPermissions` or `acceptEdits`.

### Remix Ideas

This workflow is built on an **"N targets × comparison axes × VS review"** structure that transfers directly to other topics:

- No-code automation tools (n8n / Make / Zapier / Activepieces)
- Vector DB comparison (Pinecone / Weaviate / Qdrant / pgvector)
- LLM gateway comparison (OpenRouter / LiteLLM / Portkey)

Run `/bk-start workflow_id=90` and change only the input prompt to re-execute the same structure on a new subject.

[Add this workflow to your workspace](bk://try/01-market-research-ai-coding-assistants)
