# Node Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file attachment system to workflow nodes so instructions can reference scripts, docs, and assets that agents download on demand during execution.

**Architecture:** `node_attachments` table (TEXT for text, BYTEA for binary, `storage_type` column for future backend swap). REST API with RBAC inheriting workflow permissions. 4 MCP tools. advance response extended with attachment metadata. Workflow editor UI for upload/manage. Tutorial + Swagger updates.

**Tech Stack:** PostgreSQL, Next.js 16 API routes, MCP SDK (TypeScript), React + shadcn/ui + lucide-react

---

## File Structure

| File | Responsibility |
|------|----------------|
| `docker/migrations/018_node_attachments.sql` | Create table + index |
| `docker/init.sql` | Add table to canonical schema + migration seed |
| `src/app/api/workflows/[id]/nodes/[node_id]/attachments/route.ts` | GET (list) + POST (upload) |
| `src/app/api/workflows/[id]/nodes/[node_id]/attachments/[attachId]/route.ts` | GET (download) + DELETE |
| `src/app/api/tasks/[id]/advance/route.ts` | Extend resolveNodeResponse with attachments |
| `mcp/src/server.ts` | Add 4 MCP tools + case handlers |
| `src/components/workflow-editor/node-attachments.tsx` | Attachment list + upload + delete UI component |
| `src/components/workflow-editor/node-card.tsx` | Add attachment count badge |
| `src/components/workflow-editor/editor.tsx` | Wire attachment component into expanded node panel |
| `src/components/task/step-detail.tsx` | Read-only attachment display in task view |
| `src/lib/openapi.ts` | Add Node Attachments tag + endpoints + schemas |
| `src/lib/i18n/ko.json` | i18n keys for attachments |
| `src/lib/i18n/en.json` | i18n keys for attachments |
| `src/app/(app)/tutorial/page.tsx` | Add attachment MCP tools to tutorial |
| `packages/cli/src/assets/skills/bk-start/SKILL.md` | Add attachment download guide |
| `packages/cli/src/assets/skills/bk-design/SKILL.md` | Add attachment upload guide |
| `packages/cli/src/assets/skills/bk-improve/SKILL.md` | Add attachment management guide |

---

### Task 1: DB Migration

**Files:**
- Create: `docker/migrations/018_node_attachments.sql`
- Modify: `docker/init.sql`

- [ ] **Step 1: Create migration file**

```sql
-- docker/migrations/018_node_attachments.sql

CREATE TABLE IF NOT EXISTS node_attachments (
  id SERIAL PRIMARY KEY,
  node_id INTEGER NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'text/plain',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content TEXT,
  content_binary BYTEA,
  storage_type TEXT NOT NULL DEFAULT 'db'
    CHECK (storage_type IN ('db', 'file', 's3')),
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_attachments_node ON node_attachments(node_id);
```

- [ ] **Step 2: Add to init.sql**

Add the same table definition after `workflow_evaluations` table (around line 240). Add to the `schema_migrations` INSERT at the bottom:

```sql
  ('018_node_attachments.sql')
```

- [ ] **Step 3: Apply to local dev DB**

```bash
npx tsx scripts/migrate.ts
```

Expected: `[migrate] applied 1 migration(s)`

- [ ] **Step 4: Verify**

```bash
docker exec docker-db-1 psql -U bluekiwi -d bluekiwi -c "\d node_attachments"
```

Expected: Table with all columns listed.

- [ ] **Step 5: Commit**

```bash
git add docker/migrations/018_node_attachments.sql docker/init.sql
git commit -m "feat(db): add node_attachments table (migration 018)"
```

---

### Task 2: API — List + Upload (POST /attachments)

**Files:**
- Create: `src/app/api/workflows/[id]/nodes/[node_id]/attachments/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { query, execute, insert, Workflow, okResponse, listResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canRead, canEdit } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import type { OwnedResource } from "@/lib/authorization";

type Params = { params: Promise<{ id: string; node_id: string }> };

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

async function verifyNodeBelongsToWorkflow(nodeId: number, workflowId: number) {
  const row = await import("@/lib/db").then(m =>
    m.queryOne<{ id: number }>(
      "SELECT id FROM workflow_nodes WHERE id = $1 AND workflow_id = $2",
      [nodeId, workflowId]
    )
  );
  return !!row;
}

export const GET = withAuth<Params>(
  "workflows:read",
  async (_request, user, { params }) => {
    const { id, node_id } = await params;
    const workflowId = Number(id);
    const nodeId = Number(node_id);

    const { resource: workflow, response: errResp } = await loadResourceOrFail<Workflow>({
      table: "workflows",
      id: workflowId,
      user,
      check: canRead as (u: typeof user, r: Workflow) => Promise<boolean>,
      notFoundMessage: "워크플로를 찾을 수 없습니다",
      forbiddenMessage: "조회 권한 없음",
    });
    if (errResp) return errResp;
    void workflow;

    if (!(await verifyNodeBelongsToWorkflow(nodeId, workflowId))) {
      const res = errorResponse("NOT_FOUND", "노드를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const rows = await query<{
      id: number; filename: string; mime_type: string; size_bytes: number; created_at: string;
    }>(
      "SELECT id, filename, mime_type, size_bytes, created_at FROM node_attachments WHERE node_id = $1 ORDER BY created_at",
      [nodeId]
    );

    const res = listResponse(rows, rows.length);
    return NextResponse.json(res.body, { status: res.status });
  }
);

export const POST = withAuth<Params>(
  "workflows:update",
  async (request, user, { params }) => {
    const { id, node_id } = await params;
    const workflowId = Number(id);
    const nodeId = Number(node_id);

    const { resource: workflow, response: errResp } = await loadResourceOrFail<Workflow>({
      table: "workflows",
      id: workflowId,
      user,
      check: canEdit as (u: typeof user, r: Workflow) => Promise<boolean>,
      notFoundMessage: "워크플로를 찾을 수 없습니다",
      forbiddenMessage: "편집 권한 없음",
    });
    if (errResp) return errResp;
    void workflow;

    if (!(await verifyNodeBelongsToWorkflow(nodeId, workflowId))) {
      const res = errorResponse("NOT_FOUND", "노드를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      const res = errorResponse("VALIDATION_ERROR", "file is required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    if (file.size > MAX_SIZE) {
      const res = errorResponse("VALIDATION_ERROR", `File too large (max ${MAX_SIZE / 1024 / 1024}MB)`, 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const mimeType = file.type || "application/octet-stream";
    const isText = mimeType.startsWith("text/");
    const buffer = Buffer.from(await file.arrayBuffer());

    let attachId: number;
    if (isText) {
      attachId = await insert(
        `INSERT INTO node_attachments (node_id, filename, mime_type, size_bytes, content)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [nodeId, file.name, mimeType, file.size, buffer.toString("utf-8")]
      );
    } else {
      attachId = await insert(
        `INSERT INTO node_attachments (node_id, filename, mime_type, size_bytes, content_binary)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [nodeId, file.name, mimeType, file.size, buffer]
      );
    }

    const res = okResponse({ id: attachId, filename: file.name, mime_type: mimeType, size_bytes: file.size }, 201);
    return NextResponse.json(res.body, { status: res.status });
  }
);
```

- [ ] **Step 2: Test upload via curl**

```bash
echo "print('hello')" > /tmp/test-attach.py
curl -s -X POST http://localhost:3100/api/workflows/67/nodes/106/attachments \
  -H "Authorization: Bearer $BK_API_KEY" \
  -F "file=@/tmp/test-attach.py;type=text/x-python"
```

Expected: `201` with `{ data: { id, filename: "test-attach.py" } }`

- [ ] **Step 3: Test list**

```bash
curl -s http://localhost:3100/api/workflows/67/nodes/106/attachments \
  -H "Authorization: Bearer $BK_API_KEY"
```

Expected: `{ data: [{ id, filename, mime_type, size_bytes }], total: 1 }`

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/workflows/[id]/nodes/[node_id]/attachments/route.ts"
git commit -m "feat(api): add attachment list + upload endpoints"
```

---

### Task 3: API — Download + Delete (GET/DELETE /attachments/{attachId})

**Files:**
- Create: `src/app/api/workflows/[id]/nodes/[node_id]/attachments/[attachId]/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, Workflow, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canRead, canEdit } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import type { OwnedResource } from "@/lib/authorization";

type Params = { params: Promise<{ id: string; node_id: string; attachId: string }> };

async function loadAttachment(attachId: number, nodeId: number, workflowId: number) {
  return queryOne<{
    id: number; node_id: number; filename: string; mime_type: string;
    size_bytes: number; content: string | null; content_binary: Buffer | null; created_at: string;
  }>(
    `SELECT a.* FROM node_attachments a
     JOIN workflow_nodes n ON n.id = a.node_id
     WHERE a.id = $1 AND a.node_id = $2 AND n.workflow_id = $3`,
    [attachId, nodeId, workflowId]
  );
}

export const GET = withAuth<Params>(
  "workflows:read",
  async (_request, user, { params }) => {
    const { id, node_id, attachId } = await params;
    const workflowId = Number(id);

    const { response: errResp } = await loadResourceOrFail<Workflow>({
      table: "workflows", id: workflowId, user,
      check: canRead as (u: typeof user, r: Workflow) => Promise<boolean>,
      notFoundMessage: "워크플로를 찾을 수 없습니다",
      forbiddenMessage: "조회 권한 없음",
    });
    if (errResp) return errResp;

    const att = await loadAttachment(Number(attachId), Number(node_id), workflowId);
    if (!att) {
      const res = errorResponse("NOT_FOUND", "첨부 파일을 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    // Text file: return JSON with content
    if (att.content !== null) {
      const res = okResponse({
        id: att.id, filename: att.filename, mime_type: att.mime_type,
        size_bytes: att.size_bytes, content: att.content,
      });
      return NextResponse.json(res.body, { status: res.status });
    }

    // Binary file: return raw bytes
    if (att.content_binary !== null) {
      return new NextResponse(att.content_binary, {
        headers: {
          "Content-Type": att.mime_type,
          "Content-Disposition": `attachment; filename="${att.filename}"`,
          "Content-Length": String(att.size_bytes),
        },
      });
    }

    const res = errorResponse("NOT_FOUND", "파일 내용이 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }
);

export const DELETE = withAuth<Params>(
  "workflows:update",
  async (_request, user, { params }) => {
    const { id, node_id, attachId } = await params;
    const workflowId = Number(id);

    const { response: errResp } = await loadResourceOrFail<Workflow>({
      table: "workflows", id: workflowId, user,
      check: canEdit as (u: typeof user, r: Workflow) => Promise<boolean>,
      notFoundMessage: "워크플로를 찾을 수 없습니다",
      forbiddenMessage: "편집 권한 없음",
    });
    if (errResp) return errResp;

    const att = await loadAttachment(Number(attachId), Number(node_id), workflowId);
    if (!att) {
      const res = errorResponse("NOT_FOUND", "첨부 파일을 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute("DELETE FROM node_attachments WHERE id = $1", [att.id]);

    const res = okResponse({ id: att.id, deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  }
);
```

- [ ] **Step 2: Test download**

```bash
curl -s http://localhost:3100/api/workflows/67/nodes/106/attachments/1 \
  -H "Authorization: Bearer $BK_API_KEY"
```

Expected: `{ data: { id, filename, content: "print('hello')\n" } }`

- [ ] **Step 3: Test delete**

```bash
curl -s -X DELETE http://localhost:3100/api/workflows/67/nodes/106/attachments/1 \
  -H "Authorization: Bearer $BK_API_KEY"
```

Expected: `{ data: { id: 1, deleted: true } }`

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/workflows/[id]/nodes/[node_id]/attachments/[attachId]/route.ts"
git commit -m "feat(api): add attachment download + delete endpoints"
```

---

### Task 4: MCP Tools

**Files:**
- Modify: `mcp/src/server.ts`

- [ ] **Step 1: Add 4 tool definitions**

After the `remove_node` tool definition (around line 480), add:

```typescript
  tool(
    "list_attachments",
    "List file attachments for a workflow node. Returns metadata only (id, filename, mime_type, size_bytes).",
    {
      workflow_id: { type: "number" },
      node_id: { type: "number" },
    },
    ["workflow_id", "node_id"],
  ),
  tool(
    "get_attachment",
    "Download attachment content. Returns text content directly for text files. For binary files, returns metadata with binary=true.",
    {
      workflow_id: { type: "number" },
      node_id: { type: "number" },
      attachment_id: { type: "number" },
    },
    ["workflow_id", "node_id", "attachment_id"],
  ),
  tool(
    "upload_attachment",
    "Upload a text file as an attachment to a workflow node. Text-only — binary uploads must use the web UI. Use this after creating a workflow to attach scripts, reference docs, or config files that agents can download during execution.",
    {
      workflow_id: { type: "number" },
      node_id: { type: "number" },
      filename: { type: "string" },
      content: { type: "string" },
      mime_type: { type: "string" },
    },
    ["workflow_id", "node_id", "filename", "content"],
  ),
  tool(
    "delete_attachment",
    "Delete an attachment from a workflow node.",
    {
      workflow_id: { type: "number" },
      node_id: { type: "number" },
      attachment_id: { type: "number" },
    },
    ["workflow_id", "node_id", "attachment_id"],
  ),
```

- [ ] **Step 2: Add case handlers**

After the `remove_node` case handler, add:

```typescript
      case "list_attachments": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const nodeId = requireNumberArg(args, "node_id");
        return wrap(
          await client.request(
            "GET",
            `/api/workflows/${workflowId}/nodes/${nodeId}/attachments`,
          ),
        );
      }
      case "get_attachment": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const nodeId = requireNumberArg(args, "node_id");
        const attachId = requireNumberArg(args, "attachment_id");
        return wrap(
          await client.request(
            "GET",
            `/api/workflows/${workflowId}/nodes/${nodeId}/attachments/${attachId}`,
          ),
        );
      }
      case "upload_attachment": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const nodeId = requireNumberArg(args, "node_id");
        // Construct multipart form data for text content
        const filename = args.filename as string;
        const content = args.content as string;
        const mimeType = (args.mime_type as string) || "text/plain";
        const blob = new Blob([content], { type: mimeType });
        const formData = new FormData();
        formData.append("file", blob, filename);
        return wrap(
          await client.requestFormData(
            "POST",
            `/api/workflows/${workflowId}/nodes/${nodeId}/attachments`,
            formData,
          ),
        );
      }
      case "delete_attachment": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const nodeId = requireNumberArg(args, "node_id");
        const attachId = requireNumberArg(args, "attachment_id");
        return wrap(
          await client.request(
            "DELETE",
            `/api/workflows/${workflowId}/nodes/${nodeId}/attachments/${attachId}`,
          ),
        );
      }
```

- [ ] **Step 3: Add requestFormData method to api-client.ts**

Add a `requestFormData` method to `BlueKiwiClient` in `mcp/src/api-client.ts` that sends FormData instead of JSON:

```typescript
async requestFormData(method: string, path: string, formData: FormData) {
  const url = `${this.baseUrl}${path}`;
  const headers: Record<string, string> = {};
  if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;
  // Do NOT set Content-Type — fetch sets it automatically with boundary for FormData

  const res = await fetch(url, { method, headers, body: formData });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, body: text };
  }
}
```

- [ ] **Step 4: Build MCP**

```bash
cd mcp && npm run build
```

Expected: `dist/server.js` built without errors.

- [ ] **Step 5: Commit**

```bash
git add mcp/src/server.ts mcp/src/api-client.ts
git commit -m "feat(mcp): add attachment tools (list/get/upload/delete)"
```

---

### Task 5: Extend advance Response

**Files:**
- Modify: `src/app/api/tasks/[id]/advance/route.ts`

- [ ] **Step 1: Add attachments query to resolveNodeResponse**

In the `resolveNodeResponse` function, after the credentials block (around line 48), add:

```typescript
  const attachments = await query<{
    id: number; filename: string; mime_type: string; size_bytes: number;
  }>(
    "SELECT id, filename, mime_type, size_bytes FROM node_attachments WHERE node_id = $1 ORDER BY created_at",
    [node.id],
  );
```

Add `query` to the import from `@/lib/db` if not already imported.

- [ ] **Step 2: Include attachments in return value**

Update the return statement to include:

```typescript
  return {
    node_id: node.id,
    step_order: node.step_order,
    node_type: node.node_type,
    title: node.title,
    instruction,
    hitl: node.hitl,
    loop_back_to: node.loop_back_to,
    credentials,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
```

- [ ] **Step 3: Verify**

```bash
curl -s -X POST http://localhost:3100/api/tasks/19/advance \
  -H "Authorization: Bearer $BK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"peek": true}'
```

Expected: Node response includes `attachments` array if any exist for that node.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/tasks/[id]/advance/route.ts"
git commit -m "feat(api): include attachment metadata in advance response"
```

---

### Task 6: Workflow Editor — Attachment Component

**Files:**
- Create: `src/components/workflow-editor/node-attachments.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useCallback } from "react";
import { Paperclip, Trash2, Download, Upload, FileText, Image, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/context";

interface Attachment {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

interface NodeAttachmentsProps {
  workflowId: number;
  nodeId: number | null; // null for unsaved new nodes
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("text/")) return <FileText className="h-4 w-4" />;
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

export default function NodeAttachments({ workflowId, nodeId }: NodeAttachmentsProps) {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchAttachments = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    const res = await fetch(`/api/workflows/${workflowId}/nodes/${nodeId}/attachments`);
    if (res.ok) {
      const json = await res.json();
      setAttachments(json.data ?? []);
    }
    setLoading(false);
  }, [workflowId, nodeId]);

  // Fetch on first expand
  const handleToggle = useCallback(() => {
    if (!expanded) fetchAttachments();
    setExpanded((v) => !v);
  }, [expanded, fetchAttachments]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nodeId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB)");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/workflows/${workflowId}/nodes/${nodeId}/attachments`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      toast.success(`${file.name} uploaded`);
      fetchAttachments();
    } else {
      toast.error("Upload failed");
    }
    e.target.value = "";
  }, [workflowId, nodeId, fetchAttachments]);

  const handleDelete = useCallback(async (att: Attachment) => {
    if (!nodeId) return;
    const res = await fetch(
      `/api/workflows/${workflowId}/nodes/${nodeId}/attachments/${att.id}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      toast.success(`${att.filename} deleted`);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    }
  }, [workflowId, nodeId]);

  const handleDownload = useCallback(async (att: Attachment) => {
    if (!nodeId) return;
    window.open(
      `/api/workflows/${workflowId}/nodes/${nodeId}/attachments/${att.id}`,
      "_blank",
    );
  }, [workflowId, nodeId]);

  if (!nodeId) return null;

  return (
    <div className="mt-3">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        <Paperclip className="h-3.5 w-3.5" />
        {t("editor.attachments")} {attachments.length > 0 && `(${attachments.length})`}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {loading && <p className="text-xs text-[var(--muted-foreground)]">Loading...</p>}

          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
              <FileIcon mimeType={att.mime_type} />
              <span className="flex-1 truncate">{att.filename}</span>
              <span className="text-[var(--muted-foreground)]">{formatSize(att.size_bytes)}</span>
              <button onClick={() => handleDownload(att)} className="p-0.5 hover:text-brand-blue-600">
                <Download className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(att)} className="p-0.5 hover:text-[var(--destructive)]">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors">
            <Upload className="h-3.5 w-3.5" />
            {t("editor.uploadFile")}
            <input type="file" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add i18n keys**

In `src/lib/i18n/ko.json` under `editor`:
```json
"attachments": "첨부 파일",
"uploadFile": "파일 업로드"
```

In `src/lib/i18n/en.json` under `editor`:
```json
"attachments": "Attachments",
"uploadFile": "Upload file"
```

- [ ] **Step 3: Commit**

```bash
git add src/components/workflow-editor/node-attachments.tsx src/lib/i18n/ko.json src/lib/i18n/en.json
git commit -m "feat(ui): add node attachments component for workflow editor"
```

---

### Task 7: Wire Attachment Component into Editor

**Files:**
- Modify: `src/components/workflow-editor/editor.tsx`
- Modify: `src/components/workflow-editor/node-card.tsx`

- [ ] **Step 1: Add attachment count badge to NodeCard**

In `node-card.tsx`, add a `Paperclip` icon import and an `attachmentCount` prop to `NodeCardProps`:

```typescript
interface NodeCardProps {
  node: NodeDraft;
  index: number;
  isExpanded: boolean;
  attachmentCount?: number;  // add this
  onClick: () => void;
  onRemove: () => void;
}
```

In the card body, after the existing badges (hitl, visual_selection), add:

```tsx
{props.attachmentCount != null && props.attachmentCount > 0 && (
  <Badge variant="outline" className="gap-1 text-[10px]">
    <Paperclip className="h-3 w-3" /> {props.attachmentCount}
  </Badge>
)}
```

- [ ] **Step 2: Add NodeAttachments to the expanded node panel in editor.tsx**

Import `NodeAttachments` and render it inside the expanded node editing section, after the instruction textarea:

```tsx
import NodeAttachments from "./node-attachments";

// Inside the expanded node panel, after instruction/credential fields:
{workflowId && selectedNode?.id && (
  <NodeAttachments
    workflowId={workflowId}
    nodeId={selectedNode.id}
  />
)}
```

Note: `workflowId` is available from the route params. `selectedNode.id` is the DB node id (available when editing existing workflows, null for new unsaved nodes).

- [ ] **Step 3: Commit**

```bash
git add src/components/workflow-editor/node-card.tsx src/components/workflow-editor/editor.tsx
git commit -m "feat(ui): wire attachment component into workflow editor"
```

---

### Task 8: Task Detail — Read-Only Attachment Display

**Files:**
- Modify: `src/components/task/step-detail.tsx`

- [ ] **Step 1: Add attachment display**

In the `StepLog` interface, the component receives `node_id`. After the existing output/visual sections, add:

```tsx
// Fetch attachments for this node
const [attachments, setAttachments] = useState<{id:number; filename:string; mime_type:string; size_bytes:number}[]>([]);

useEffect(() => {
  if (!workflowId || !log.node_id) return;
  fetch(`/api/workflows/${workflowId}/nodes/${log.node_id}/attachments`)
    .then(r => r.ok ? r.json() : null)
    .then(json => { if (json?.data) setAttachments(json.data); });
}, [workflowId, log.node_id]);
```

Render below the output area:

```tsx
{attachments.length > 0 && (
  <div className="mt-3">
    <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">
      <Paperclip className="inline h-3.5 w-3.5 mr-1" />
      Attachments
    </p>
    {attachments.map(att => (
      <div key={att.id} className="flex items-center gap-2 text-xs py-0.5">
        <FileText className="h-3.5 w-3.5" />
        <span>{att.filename}</span>
        <span className="text-[var(--muted-foreground)]">({formatSize(att.size_bytes)})</span>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/task/step-detail.tsx
git commit -m "feat(ui): show attachments in task detail step view"
```

---

### Task 9: Skill Updates

**Files:**
- Modify: `packages/cli/src/assets/skills/bk-start/SKILL.md`
- Modify: `packages/cli/src/assets/skills/bk-design/SKILL.md`
- Modify: `packages/cli/src/assets/skills/bk-improve/SKILL.md`

- [ ] **Step 1: Update bk-start**

After the "Gate step" section in "4. When Pausing", add an "Attachments" subsection:

```markdown
#### Attachments

<HARD-RULE>
When `advance` returns `node.attachments`:
1. Review the list (filename, mime_type, size_bytes)
2. Call `get_attachment(workflow_id, node_id, attachment_id)` for each text file the instruction references
3. Use downloaded content as context when executing the instruction
4. For binary files, note their existence but do not download unless explicitly required
</HARD-RULE>
```

- [ ] **Step 2: Update bk-design**

In the "Attachments" section under Node Design Guidelines (already added in previous work), verify the content matches the spec. No changes needed if the existing text is correct.

- [ ] **Step 3: Update bk-improve**

In Step 3 "Analyze the Current Workflow", verify the attachment management guidance is present.

- [ ] **Step 4: Build CLI**

```bash
cd packages/cli && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/assets/skills/bk-start/SKILL.md packages/cli/src/assets/skills/bk-design/SKILL.md packages/cli/src/assets/skills/bk-improve/SKILL.md
git commit -m "feat(skill): add attachment guides to bk-start, bk-design, bk-improve"
```

---

### Task 10: OpenAPI Spec (Swagger)

**Files:**
- Modify: `src/lib/openapi.ts`

- [ ] **Step 1: Add Node Attachments tag**

In the `tags` array, add:

```typescript
{ name: "Node Attachments", description: "워크플로 노드 첨부 파일 관리" },
```

- [ ] **Step 2: Add 4 path entries**

Add paths for:
- `GET /api/workflows/{id}/nodes/{nodeId}/attachments` — list
- `POST /api/workflows/{id}/nodes/{nodeId}/attachments` — upload (multipart/form-data)
- `GET /api/workflows/{id}/nodes/{nodeId}/attachments/{attachId}` — download
- `DELETE /api/workflows/{id}/nodes/{nodeId}/attachments/{attachId}` — delete

- [ ] **Step 3: Add schemas**

```typescript
NodeAttachment: {
  type: "object",
  properties: {
    id: { type: "integer" },
    filename: { type: "string" },
    mime_type: { type: "string" },
    size_bytes: { type: "integer" },
    created_at: { type: "string", format: "date-time" },
  },
},
NodeAttachmentContent: {
  allOf: [
    { $ref: "#/components/schemas/NodeAttachment" },
    { type: "object", properties: { content: { type: "string", description: "Text file content (text files only)" } } },
  ],
},
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/openapi.ts
git commit -m "docs(api): add node attachments to OpenAPI spec"
```

---

### Task 11: Tutorial Page + i18n

**Files:**
- Modify: `src/app/(app)/tutorial/page.tsx`
- Modify: `src/lib/i18n/ko.json`
- Modify: `src/lib/i18n/en.json`

- [ ] **Step 1: Add i18n keys**

In `ko.json`:
```json
"s7ToolListAttachments": "노드에 첨부된 파일 목록을 조회합니다.",
"s7ToolGetAttachment": "첨부 파일의 내용을 다운로드합니다.",
"s7ToolUploadAttachment": "노드에 파일을 첨부합니다.",
"s1AttachmentsTitle": "노드 첨부 파일",
"s1AttachmentsDesc": "워크플로 노드에 스크립트, 레퍼런스 문서, 설정 파일 등을 첨부할 수 있습니다. 에이전트는 실행 중 필요한 첨부 파일을 자동으로 다운로드합니다."
```

In `en.json`:
```json
"s7ToolListAttachments": "List files attached to a workflow node.",
"s7ToolGetAttachment": "Download attachment content.",
"s7ToolUploadAttachment": "Upload a file to a workflow node.",
"s1AttachmentsTitle": "Node Attachments",
"s1AttachmentsDesc": "Attach scripts, reference docs, and config files to workflow nodes. Agents automatically download needed attachments during execution."
```

- [ ] **Step 2: Add tools to tutorial table**

In `tutorial/page.tsx`, add to the MCP tools table array:

```tsx
["list_attachments", t("tutorial.s7ToolListAttachments")],
["get_attachment", t("tutorial.s7ToolGetAttachment")],
["upload_attachment", t("tutorial.s7ToolUploadAttachment")],
```

- [ ] **Step 3: Add attachments section to tutorial**

Add a brief section in the workflow area mentioning node attachments.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/tutorial/page.tsx" src/lib/i18n/ko.json src/lib/i18n/en.json
git commit -m "docs(tutorial): add node attachments to tutorial + i18n"
```

---

### Task 12: Final Integration Test + Deploy

- [ ] **Step 1: Run full build**

```bash
npx next build
cd mcp && npm run build
cd ../packages/cli && npm run build
```

- [ ] **Step 2: E2E test via API**

```bash
# Upload
curl -s -X POST http://localhost:3100/api/workflows/67/nodes/106/attachments \
  -F "file=@/tmp/test-attach.py;type=text/x-python"

# List
curl -s http://localhost:3100/api/workflows/67/nodes/106/attachments

# Download
curl -s http://localhost:3100/api/workflows/67/nodes/106/attachments/{id}

# Advance peek (verify attachments in response)
curl -s -X POST http://localhost:3100/api/tasks/19/advance \
  -H "Content-Type: application/json" -d '{"peek": true}'

# Delete
curl -s -X DELETE http://localhost:3100/api/workflows/67/nodes/106/attachments/{id}
```

- [ ] **Step 3: Deploy**

```bash
/bk-deploy all
```

- [ ] **Step 4: Verify production**

```bash
ssh DanteServer "docker logs bluekiwi-app-1 2>&1 | head -3"
```

Expected: `[migrate] applied 1 migration(s)` or `[migrate] up to date (18 migrations tracked)`
