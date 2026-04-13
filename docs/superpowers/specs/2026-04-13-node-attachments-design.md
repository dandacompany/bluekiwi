# Node Attachments — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file storage system to BlueKiwi workflow nodes so that instructions can reference attached scripts, reference docs, and assets. Agents download attachments on demand during execution.

**Architecture:** Single `node_attachments` table with DB storage (TEXT for text, BYTEA for binary). `storage_type` + `storage_path` columns reserved for future file/S3 backends. API follows existing RBAC pattern (workflow-level canRead/canEdit). MCP provides 4 tools. advance response extended with attachment metadata.

**Tech Stack:** PostgreSQL, Next.js API routes, MCP server (TypeScript), React + shadcn/ui

---

## 1. DB Schema

### Table: `node_attachments`

```sql
CREATE TABLE node_attachments (
  id SERIAL PRIMARY KEY,
  node_id INTEGER NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'text/plain',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content TEXT,                    -- text files (mime_type starts with 'text/')
  content_binary BYTEA,           -- binary files (images, PDFs, etc.)
  storage_type TEXT NOT NULL DEFAULT 'db'
    CHECK (storage_type IN ('db', 'file', 's3')),
  storage_path TEXT,              -- future: filesystem path or S3 key
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_node_attachments_node ON node_attachments(node_id);
```

### Constraints

- `node_id` FK to `workflow_nodes(id)` with CASCADE DELETE
- Either `content` or `content_binary` is populated, never both
- `storage_type` defaults to `'db'`; `'file'` and `'s3'` reserved for future backends
- `storage_path` is NULL when `storage_type = 'db'`

### Migration

File: `docker/migrations/018_node_attachments.sql`

Also update `docker/init.sql`:
- Add table + index definition
- Add `('018_node_attachments.sql')` to `schema_migrations` INSERT

---

## 2. API Endpoints

All endpoints nested under the workflow node path. RBAC inherited from workflow.

### `GET /api/workflows/{id}/nodes/{nodeId}/attachments`

- **Permission:** `workflows:read` + `canRead(workflow)`
- **Response:** `{ data: [{ id, filename, mime_type, size_bytes, created_at }], total: N }`
- **Notes:** Metadata only, no content. Ordered by `created_at ASC`.

### `POST /api/workflows/{id}/nodes/{nodeId}/attachments`

- **Permission:** `workflows:update` + `canEdit(workflow)`
- **Content-Type:** `multipart/form-data`
- **Fields:** `file` (required, the uploaded file)
- **Validation:**
  - `size_bytes > 5MB` → 400 error (default limit, configurable later)
  - Verify node belongs to workflow
- **Storage logic:**
  - `mime_type.startsWith('text/')` → store in `content` (TEXT)
  - Otherwise → store in `content_binary` (BYTEA)
- **Response:** `{ data: { id, filename, mime_type, size_bytes, created_at } }` (201)

### `GET /api/workflows/{id}/nodes/{nodeId}/attachments/{attachId}`

- **Permission:** `workflows:read` + `canRead(workflow)`
- **Response (text):** `{ data: { id, filename, mime_type, size_bytes, content } }`
- **Response (binary):** Raw binary body with `Content-Type` and `Content-Disposition: attachment` headers
- **Notes:** Verify attachment belongs to the specified node + workflow

### `DELETE /api/workflows/{id}/nodes/{nodeId}/attachments/{attachId}`

- **Permission:** `workflows:update` + `canEdit(workflow)`
- **Response:** `{ data: { id, deleted: true } }`

### RBAC Pattern

All handlers use the same pattern as existing node endpoints:

```typescript
const { resource: workflow, response: errResp } = await loadResourceOrFail<Workflow>({
  table: "workflows",
  id: workflowId,
  user,
  check: canEdit, // or canRead for GET
  notFoundMessage: "워크플로를 찾을 수 없습니다",
  forbiddenMessage: "편집 권한 없음",
});
```

Plus: verify `node_id` belongs to `workflow_id`, verify `attachment_id` belongs to `node_id`.

---

## 3. MCP Tools

### `list_attachments`

```
Description: List attachment metadata for a workflow node.
Parameters: workflow_id (required), node_id (required)
Calls: GET /api/workflows/{workflow_id}/nodes/{node_id}/attachments
```

### `get_attachment`

```
Description: Download attachment content. Returns text content directly for text files.
  For binary files, returns a message indicating the file is binary and should be
  accessed via web UI.
Parameters: workflow_id (required), node_id (required), attachment_id (required)
Calls: GET /api/workflows/{workflow_id}/nodes/{node_id}/attachments/{attachment_id}
Notes: For text files, returns { filename, content }. For binary, returns { filename, binary: true, size_bytes }.
```

### `upload_attachment`

```
Description: Upload a text file as an attachment to a workflow node.
  Text-only — binary uploads must use the web UI.
  Use this after creating a workflow to attach scripts, reference docs, or config files.
Parameters: workflow_id (required), node_id (required), filename (required), content (required), mime_type (optional, default 'text/plain')
Calls: POST /api/workflows/{workflow_id}/nodes/{node_id}/attachments (as multipart)
Notes: MCP server constructs a multipart request from the text content.
```

### `delete_attachment`

```
Description: Delete an attachment from a workflow node.
Parameters: workflow_id (required), node_id (required), attachment_id (required)
Calls: DELETE /api/workflows/{workflow_id}/nodes/{node_id}/attachments/{attachment_id}
```

---

## 4. advance Response Extension

### Current node response in advance:

```json
{
  "node_id": 109,
  "step_order": 4,
  "node_type": "loop",
  "title": "Clarifying Questions",
  "instruction": "...",
  "hitl": false,
  "loop_back_to": 4,
  "credentials": null
}
```

### Extended with attachments:

```json
{
  "node_id": 109,
  "step_order": 4,
  "node_type": "loop",
  "title": "Clarifying Questions",
  "instruction": "...",
  "hitl": false,
  "loop_back_to": 4,
  "credentials": null,
  "attachments": [
    { "id": 3, "filename": "rotate_pdf.py", "mime_type": "text/x-python", "size_bytes": 1240 },
    { "id": 4, "filename": "schema.md", "mime_type": "text/markdown", "size_bytes": 3400 }
  ]
}
```

### Implementation

In `resolveNodeResponse()` (`src/app/api/tasks/[id]/advance/route.ts`):

```typescript
const attachments = await query<{ id: number; filename: string; mime_type: string; size_bytes: number }>(
  "SELECT id, filename, mime_type, size_bytes FROM node_attachments WHERE node_id = $1 ORDER BY created_at",
  [node.id]
);

return {
  ...existingFields,
  attachments: attachments.length > 0 ? attachments : undefined,
};
```

---

## 5. Skill Updates

### bk-start

Add to "3. Execute First Step + Auto-Advance Loop" section:

```markdown
#### Attachments

If `advance` returns `node.attachments`, download relevant files before executing the instruction:

<HARD-RULE>
When attachments are present:
1. Review the attachment list (filename, mime_type, size)
2. Call `get_attachment` for each text file the instruction references
3. Use the downloaded content as context when executing the instruction
4. For binary files (images, PDFs), note their existence but do not download unless the instruction explicitly requires it
</HARD-RULE>
```

### bk-design

Add to "Node Design Guidelines" section:

```markdown
### Attachments

Nodes can have attached files (scripts, reference docs, config files). After creating a workflow
with `create_workflow`, attach files to individual nodes using `upload_attachment`.

**When to attach files:**
- The instruction references an external script that the agent should execute
- The instruction needs a reference document (API docs, schema, spec)
- The instruction requires a config/template file

**Pattern:**
1. `create_workflow` → get workflow_id and node IDs from response
2. For each node that needs files: `upload_attachment(workflow_id, node_id, filename, content)`
3. In the node's instruction, reference the file by name: "Execute the attached `rotate_pdf.py` script"

**Do NOT embed large file content in the instruction text.** Use attachments instead — the agent
downloads them on demand via `get_attachment`, saving context tokens.
```

### bk-improve

Add to "Step 3: Analyze the Current Workflow" section:

```markdown
For each node, also check `list_attachments` to see existing attached files. When modifying nodes:
- `update_node` changes instruction text; attachments are independent
- Use `upload_attachment` to add new files, `delete_attachment` to remove obsolete ones
- When splitting a node, move relevant attachments to the appropriate new node
```

### bk-import (future, Sub-project B)

```markdown
After bk-design creates the workflow:
1. For each scripts/ file in the source skill → upload_attachment to the corresponding node
2. For each references/ file → upload_attachment to nodes that need it
3. For each assets/ file → upload_attachment (binary via web UI if needed)
```

---

## 6. Web UI

### Workflow Editor — Node Card

- Show attachment count badge: `📎 2` on node cards that have attachments
- In node edit panel, add "Attachments" section below instruction textarea:
  - File list with filename, size, mime_type
  - Upload button (file picker + drag & drop)
  - Per-file: download button, delete button (with confirmation)
  - Text files: click filename to expand inline preview

### Task Detail — Step Detail

- If the step's node has attachments, show read-only "Attachments" section
- Text files: expandable inline preview
- Binary files: download link
- Source: query `node_attachments` by `node_id` from the task log

### Implementation Notes

- Use existing `Dialog` component for upload/preview modals
- File upload: `<input type="file">` + `fetch(POST, formData)`
- Attachment list: `useSWR` or `useEffect` fetch on node selection
- Follow existing patterns in workflow editor (`src/components/workflow-editor/`)

---

## 7. OpenAPI Spec (Swagger)

Update `src/lib/openapi.ts`:

- New tag: `{ name: "Node Attachments", description: "워크플로 노드 첨부 파일 관리" }`
- 4 path entries matching the API endpoints in Section 2
- New schemas:
  - `NodeAttachment`: `{ id, filename, mime_type, size_bytes, created_at }`
  - `NodeAttachmentContent`: extends NodeAttachment + `content` field (text files only)
- Update `WorkflowNode` schema: add `attachments` array field (metadata only, returned by advance)

---

## 8. Tutorial Page

Update `src/app/(app)/tutorial/page.tsx` and i18n files (`ko.json`, `en.json`):

### MCP Tools Table

Add to the tools table in section 7:

| Tool | Description (ko) | Description (en) |
|------|-------------------|-------------------|
| `list_attachments` | 노드에 첨부된 파일 목록을 조회합니다. | List files attached to a workflow node. |
| `get_attachment` | 첨부 파일의 내용을 다운로드합니다. | Download attachment content. |
| `upload_attachment` | 노드에 파일을 첨부합니다. | Upload a file to a workflow node. |

i18n keys: `s7ToolListAttachments`, `s7ToolGetAttachment`, `s7ToolUploadAttachment`

### Workflow Section

Add a brief mention in the workflow design section (s1 area) about node attachments:
- Nodes can have attached files (scripts, reference docs) that agents download during execution
- Manage attachments in the workflow editor node card

i18n keys: `s1AttachmentsTitle`, `s1AttachmentsDesc`

---

## 9. Future Extensions

- **File/S3 backend:** When `storage_type != 'db'`, read from `storage_path` instead of `content`/`content_binary`. Add `StorageBackend` interface at that point.
- **Size limit configuration:** Add `max_attachment_size_bytes` to a settings table or env var.
- **Versioning:** When `create_new_version` is used, copy attachments from old nodes to new nodes.
- **bk-import (Sub-project B):** Analyzes external skills, converts to workflows with attachments.
