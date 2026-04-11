---
name: bk-scan
description: BlueKiwi compliance scan skill. Scans a local repository path for security and compliance risks using static pattern analysis, then saves findings to a BlueKiwi task. This skill should be used when the user says "/bk-scan", "scan for security issues", "compliance scan", or wants to run a repository scan with BlueKiwi.
user_invocable: true
---

# BlueKiwi Compliance Scan

Scan a local repository for security and compliance risks using built-in static patterns, then optionally link results to a BlueKiwi task.

## Argument Handling

- `/bk-scan` → Ask for the path to scan.
- `/bk-scan <path>` → Start scanning the given path immediately.
- `/bk-scan <path> --task <task_id>` → Scan and attach findings to a specific task.

## Built-in Rule Set: korea-ota-code

The default rule set checks for:

| ID                | Severity | Description                                 |
| ----------------- | -------- | ------------------------------------------- |
| PIPA-001-RRN      | REVIEW   | Korean Resident Registration Number pattern |
| ISMS-001-SECRET   | BLOCK    | Hardcoded secret/API key                    |
| PIPA-002-FIELD    | REVIEW   | High-risk PII field names                   |
| ISMS-004-HTTP     | WARN     | Plaintext HTTP URL (external)               |
| LIA-001-GEO       | REVIEW   | Geolocation API usage                       |
| PIPA-004-PRECHECK | REVIEW   | Pre-checked consent checkbox                |

## Execution Steps

### Step 1: Get Scan Path

If no argument, ask via AskUserQuestion:

- header: "Scan path"
- "Enter the repository path to scan."
- options: ["./ (current directory)", "src/", "Type a path"]

### Step 2: Configure Options (Optional)

Ask via AskUserQuestion:

- header: "Scan options"
- options: ["Default (korea-ota-code rules, 200 max matches)", "Custom settings"]

If "Custom settings":

- Max matches: ask for a number (default 200, max 1000)
- Additional custom patterns: accept in `{ id, regex, description, severity }` format

### Step 3: Run Scan

Call `scan_repo`:

```json
{
  "path": "<scan path>",
  "rule_set": "korea-ota-code",
  "max_matches": 200,
  "task_id": <if provided>
}
```

### Step 4: Display Results

```
Scan Results: {path}
━━━━━━━━━━━━━━━━━━━━━━━━━
Files scanned: {n}
Matches found: {total}

BLOCK (must fix before release): {count}
  ISMS-001  src/config.ts:42   Hardcoded secret: API_KEY="sk-..."

REVIEW (review recommended): {count}
  PIPA-002  src/models/user.ts:15  High-risk field: residentRegistration

WARN (best practice): {count}
  ISMS-004  src/api/client.ts:8   Plaintext HTTP: http://external-api.com
━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 5: Save Findings (Optional)

If a `task_id` was provided or an active task exists, ask via AskUserQuestion:

- header: "Save findings?"
- "Attach these findings to Task #{task_id}?"
- options: ["Save findings", "Skip"]

If saving, call `save_findings`:

```json
{
  "task_id": <id>,
  "findings": [
    {
      "rule_id": "ISMS-001",
      "severity": "BLOCK",
      "file": "src/config.ts",
      "line": 42,
      "description": "Hardcoded secret detected"
    }
  ]
}
```

### Step 6: Remediation Guidance

For each BLOCK finding, provide a brief remediation suggestion:

- Hardcoded secrets → move to environment variables or a secrets manager
- HTTP URLs → upgrade to HTTPS
- RRN patterns → apply masking or tokenization
