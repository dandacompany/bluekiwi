# Credential Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노드 레벨 API 시크릿 관리 시스템. 외부 API 연동이 필요한 노드에 credential을 바인딩하고, Claude Code 세션에서 안전하게 사용.

**Architecture:** credentials 테이블(service_name, title, secrets JSON)을 추가하고, chain_nodes에 credential_id FK를 추가. 웹 API는 마스킹된 값만 반환하고, MCP(advance/start_chain/rewind)에서만 원본 secrets를 전달. 스킬에서 credential을 사용하여 API 호출 수행.

**Tech Stack:** PostgreSQL, Next.js 16 API routes (pg Pool), MCP server (pg Pool), React client components

**Spec:** `docs/specs/2026-04-08-credential-store-design.md`

---

## File Map

| Action | File                                    | Responsibility                                                               |
| ------ | --------------------------------------- | ---------------------------------------------------------------------------- |
| Modify | `docker/init.sql`                       | credentials 테이블 + chain_nodes.credential_id 컬럼 + 인덱스                 |
| Modify | `src/lib/db.ts`                         | Credential 타입 + 마스킹 헬퍼 함수                                           |
| Create | `src/app/api/credentials/route.ts`      | GET(목록), POST(생성)                                                        |
| Create | `src/app/api/credentials/[id]/route.ts` | GET(상세), PUT(수정), DELETE(삭제)                                           |
| Modify | `mcp/src/server.ts`                     | ChainNode.credential_id, resolveCredential, 기존 도구 수정, list_credentials |
| Create | `src/app/credentials/page.tsx`          | Credential 목록/생성/편집/삭제 UI                                            |
| Modify | `src/app/chains/editor.tsx`             | 노드 카드에 credential 선택 드롭다운                                         |
| Modify | `src/app/tasks/[id]/page.tsx`           | credential 사용 노드에 서비스 뱃지                                           |
| Modify | `~/.claude/skills/or-next/SKILL.md`     | credential 핸들링 지침                                                       |
| Modify | `~/.claude/skills/or-start/SKILL.md`    | credential 핸들링 지침                                                       |
| Modify | `src/app/layout.tsx`                    | 네비게이션에 Credentials 링크 추가                                           |

---

### Task 1: DB 스키마 — credentials 테이블 + chain_nodes 확장

**Files:**

- Modify: `docker/init.sql`
- Modify: `src/lib/db.ts`

- [ ] **Step 1: init.sql에 credentials 테이블 추가**

`docker/init.sql`의 `task_comments` 테이블 뒤에 추가:

```sql
CREATE TABLE IF NOT EXISTS credentials (
  id SERIAL PRIMARY KEY,
  service_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  secrets TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials(service_name);
```

- [ ] **Step 2: init.sql에 chain_nodes.credential_id 추가**

chain_nodes CREATE TABLE 문에 컬럼 추가:

```sql
-- chain_nodes 테이블의 auto_advance 뒤에 추가:
  credential_id INTEGER REFERENCES credentials(id) ON DELETE SET NULL,
```

- [ ] **Step 3: db.ts에 Credential 타입 추가**

`src/lib/db.ts`의 TaskComment 인터페이스 뒤에 추가:

```typescript
export interface Credential {
  id: number;
  service_name: string;
  title: string;
  description: string;
  secrets: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: db.ts에 마스킹 헬퍼 추가**

Response helpers 앞에 추가:

```typescript
export function maskSecrets(secretsJson: string): Record<string, string> {
  try {
    const parsed = JSON.parse(secretsJson) as Record<string, string>;
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") {
        masked[key] = "****";
      } else if (value.length >= 10) {
        masked[key] = value.slice(0, 6) + "****" + value.slice(-4);
      } else if (value.length > 0) {
        masked[key] = value.slice(0, 2) + "****";
      } else {
        masked[key] = "";
      }
    }
    return masked;
  } catch {
    return {};
  }
}
```

- [ ] **Step 5: ChainNode 인터페이스에 credential_id 추가**

`src/lib/db.ts`의 ChainNode 인터페이스:

```typescript
export interface ChainNode {
  id: number;
  chain_id: number;
  instruction_id: number | null;
  credential_id: number | null; // ← 추가
  step_order: number;
  node_type: NodeType;
  title: string;
  instruction: string;
  loop_back_to: number | null;
  auto_advance: number;
  created_at: string;
}
```

- [ ] **Step 6: 실행 중인 DB에 마이그레이션 적용**

```bash
psql postgresql://omegarod:omegarod_dev_2026@localhost:5433/omegarod -c "
  CREATE TABLE IF NOT EXISTS credentials (
    id SERIAL PRIMARY KEY,
    service_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    secrets TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials(service_name);
  ALTER TABLE chain_nodes ADD COLUMN IF NOT EXISTS credential_id INTEGER REFERENCES credentials(id) ON DELETE SET NULL;
"
```

- [ ] **Step 7: 커밋**

```bash
git add docker/init.sql src/lib/db.ts
git commit -m "feat: add credentials table and chain_nodes.credential_id"
```

---

### Task 2: 웹 API — Credential CRUD

**Files:**

- Create: `src/app/api/credentials/route.ts`
- Create: `src/app/api/credentials/[id]/route.ts`

- [ ] **Step 1: GET /api/credentials + POST /api/credentials**

`src/app/api/credentials/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  query,
  insert,
  Credential,
  maskSecrets,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";

export async function GET() {
  const rows = await query<Credential>(
    "SELECT * FROM credentials ORDER BY updated_at DESC",
  );

  const masked = rows.map((r) => ({
    ...r,
    secrets_masked: maskSecrets(r.secrets),
    secrets: undefined,
  }));

  const res = listResponse(masked, masked.length);
  return NextResponse.json(res.body, { status: res.status });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { service_name, title, description, secrets } = body;

  if (!service_name || !title) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "service_name and title are required",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const secretsJson =
    typeof secrets === "object" ? JSON.stringify(secrets) : (secrets ?? "{}");

  const id = await insert(
    "INSERT INTO credentials (service_name, title, description, secrets) VALUES ($1, $2, $3, $4) RETURNING id",
    [
      service_name.trim(),
      title.trim(),
      (description ?? "").trim(),
      secretsJson,
    ],
  );

  const row = await query<Credential>(
    "SELECT * FROM credentials WHERE id = $1",
    [id],
  );

  const res = okResponse(
    {
      ...row[0],
      secrets_masked: maskSecrets(row[0].secrets),
      secrets: undefined,
    },
    201,
  );
  return NextResponse.json(res.body, { status: res.status });
}
```

- [ ] **Step 2: GET/PUT/DELETE /api/credentials/:id**

`src/app/api/credentials/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  execute,
  Credential,
  maskSecrets,
  okResponse,
  errorResponse,
} from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = await queryOne<Credential>(
    "SELECT * FROM credentials WHERE id = $1",
    [Number(id)],
  );
  if (!row) {
    const res = errorResponse(
      "NOT_FOUND",
      "credential을 찾을 수 없습니다",
      404,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  // 연결된 노드 수 조회
  const linked = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM chain_nodes WHERE credential_id = $1",
    [Number(id)],
  );

  const res = okResponse({
    ...row,
    secrets_masked: maskSecrets(row.secrets),
    secrets: undefined,
    linked_nodes: Number(linked?.count ?? 0),
  });
  return NextResponse.json(res.body, { status: res.status });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { service_name, title, description, secrets } = body;

  const existing = await queryOne<Credential>(
    "SELECT * FROM credentials WHERE id = $1",
    [Number(id)],
  );
  if (!existing) {
    const res = errorResponse(
      "NOT_FOUND",
      "credential을 찾을 수 없습니다",
      404,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  // secrets: 새 값이 전달되면 업데이트, 아니면 기존 유지
  let newSecrets = existing.secrets;
  if (secrets && typeof secrets === "object") {
    const existingParsed = JSON.parse(existing.secrets) as Record<
      string,
      string
    >;
    const merged = { ...existingParsed };
    for (const [k, v] of Object.entries(secrets as Record<string, string>)) {
      if (v !== "" && v !== undefined) {
        merged[k] = v; // 새 값으로 교체
      }
      // 빈 문자열이면 기존 값 유지
    }
    newSecrets = JSON.stringify(merged);
  }

  await execute(
    "UPDATE credentials SET service_name = $1, title = $2, description = $3, secrets = $4, updated_at = NOW() WHERE id = $5",
    [
      (service_name ?? existing.service_name).trim(),
      (title ?? existing.title).trim(),
      (description ?? existing.description).trim(),
      newSecrets,
      Number(id),
    ],
  );

  const updated = await queryOne<Credential>(
    "SELECT * FROM credentials WHERE id = $1",
    [Number(id)],
  );

  const res = okResponse({
    ...updated!,
    secrets_masked: maskSecrets(updated!.secrets),
    secrets: undefined,
  });
  return NextResponse.json(res.body, { status: res.status });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await execute("DELETE FROM credentials WHERE id = $1", [
    Number(id),
  ]);
  if (result.rowCount === 0) {
    const res = errorResponse(
      "NOT_FOUND",
      "credential을 찾을 수 없습니다",
      404,
    );
    return NextResponse.json(res.body, { status: res.status });
  }
  const res = okResponse({ id: Number(id), deleted: true });
  return NextResponse.json(res.body, { status: res.status });
}
```

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/credentials/
git commit -m "feat: add credential CRUD API with secrets masking"
```

---

### Task 3: MCP 서버 — resolveCredential + 기존 도구 수정 + list_credentials

**Files:**

- Modify: `mcp/src/server.ts`

- [ ] **Step 1: ChainNode 인터페이스에 credential_id 추가**

```typescript
interface ChainNode {
  id: number;
  chain_id: number;
  instruction_id: number | null;
  credential_id: number | null; // ← 추가
  step_order: number;
  node_type: string;
  title: string;
  instruction: string;
  loop_back_to: number | null;
  auto_advance: number;
}
```

- [ ] **Step 2: resolveCredential 헬퍼 추가**

`resolveInstruction` 함수 뒤에 추가:

```typescript
async function resolveCredential(node: ChainNode): Promise<{
  service: string;
  title: string;
  secrets: Record<string, string>;
} | null> {
  if (!node.credential_id) return null;
  const { rows } = await pool.query(
    "SELECT service_name, title, secrets FROM credentials WHERE id = $1",
    [node.credential_id],
  );
  if (!rows[0]) return null;
  return {
    service: rows[0].service_name,
    title: rows[0].title,
    secrets: JSON.parse(rows[0].secrets),
  };
}
```

- [ ] **Step 3: maskSecrets 헬퍼 추가 (MCP용)**

```typescript
function maskSecrets(secretsJson: string): Record<string, string> {
  try {
    const parsed = JSON.parse(secretsJson) as Record<string, string>;
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") {
        masked[key] = "****";
      } else if (value.length >= 10) {
        masked[key] = value.slice(0, 6) + "****" + value.slice(-4);
      } else if (value.length > 0) {
        masked[key] = value.slice(0, 2) + "****";
      } else {
        masked[key] = "";
      }
    }
    return masked;
  } catch {
    return {};
  }
}
```

- [ ] **Step 4: start_chain에 credentials 반환 추가**

start_chain의 반환 jsonResult에 credentials 필드 추가:

```typescript
return jsonResult({
  task_id: taskId,
  chain_title: chain.title,
  total_steps: Number(totalSteps.count),
  current_step: {
    node_id: firstNode.id,
    step_order: firstNode.step_order,
    node_type: firstNode.node_type,
    title: firstNode.title,
    instruction: await resolveInstruction(firstNode),
    auto_advance: !!firstNode.auto_advance,
    loop_back_to: firstNode.loop_back_to,
    credentials: await resolveCredential(firstNode), // ← 추가
  },
});
```

- [ ] **Step 5: advance에 credentials 반환 추가**

advance의 peek 모드와 전진 모드 두 반환 지점 모두에 credentials 추가:

```typescript
// peek 모드 반환:
credentials: currentNode ? await resolveCredential(currentNode) : null,

// 전진 모드 반환:
credentials: await resolveCredential(nextNode),
```

- [ ] **Step 6: rewind에 credentials 반환 추가**

rewind의 반환 jsonResult에:

```typescript
credentials: await resolveCredential(targetNode),
```

- [ ] **Step 7: create_workflow / update_workflow에 credential_id 지원 추가**

create_workflow의 노드 스키마에 `credential_id` 파라미터 추가:

```typescript
credential_id: z.number().optional().describe("연결할 credential ID"),
```

INSERT 쿼리에 credential_id 컬럼 추가:

```sql
INSERT INTO chain_nodes (chain_id, step_order, node_type, title, instruction, instruction_id, loop_back_to, auto_advance, credential_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
```

update_workflow도 동일하게 수정.

- [ ] **Step 8: list_credentials 도구 추가**

delete_workflow 뒤에 추가:

```typescript
server.tool(
  "list_credentials",
  "사용 가능한 credential 목록을 조회합니다 (secrets는 마스킹).",
  {},
  async () => {
    const { rows } = await pool.query(
      "SELECT id, service_name, title, description, secrets, created_at FROM credentials ORDER BY service_name ASC",
    );
    const result = rows.map(
      (r: {
        id: number;
        service_name: string;
        title: string;
        description: string;
        secrets: string;
        created_at: string;
      }) => ({
        id: r.id,
        service_name: r.service_name,
        title: r.title,
        description: r.description,
        secrets_masked: maskSecrets(r.secrets),
      }),
    );
    return jsonResult(result);
  },
);
```

- [ ] **Step 9: MCP 빌드**

```bash
cd mcp && npm run build
```

Expected: 빌드 성공

- [ ] **Step 10: 커밋**

```bash
git add mcp/src/server.ts
git commit -m "feat: add resolveCredential to MCP, credentials in advance/start/rewind responses"
```

---

### Task 4: 웹 UI — Credential 관리 페이지

**Files:**

- Create: `src/app/credentials/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Credential 관리 페이지 생성**

`src/app/credentials/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CredentialItem {
  id: number;
  service_name: string;
  title: string;
  description: string;
  secrets_masked: Record<string, string>;
  linked_nodes?: number;
  created_at: string;
}

// 전체 컴포넌트: 목록 + 생성/편집 다이얼로그 + 삭제
// - GET /api/credentials로 목록 로드
// - POST /api/credentials로 생성 (service_name, title, description, secrets)
// - PUT /api/credentials/:id로 수정 (빈 값 = 기존 유지)
// - DELETE /api/credentials/:id로 삭제
// - secrets 입력은 동적 key-value 필드 (+ 버튼으로 추가)
// - 마스킹된 값을 표시, 수정 시 비어있으면 기존 유지
```

(실제 JSX는 구현 시 완성. 핵심 패턴: 기존 `/instructions` 페이지와 동일한 CRUD 패턴)

- [ ] **Step 2: layout.tsx에 네비게이션 링크 추가**

기존 네비게이션에 "Credentials" 링크 추가 (Workflow, Tasks 사이에):

```tsx
{ href: "/credentials", label: "Credentials", icon: Key }
```

Lucide `Key` 아이콘을 `src/components/icons/lucide.tsx`에 추가 필요.

- [ ] **Step 3: 타입 체크 + 빌드 확인**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/credentials/ src/app/layout.tsx src/components/icons/lucide.tsx
git commit -m "feat: add credential management UI page"
```

---

### Task 5: 웹 UI — 체인 편집기에 credential 드롭다운

**Files:**

- Modify: `src/app/chains/editor.tsx`

- [ ] **Step 1: NodeDraft 인터페이스에 credential_id 추가**

```typescript
interface NodeDraft {
  key: string;
  title: string;
  node_type: "action" | "gate" | "loop";
  source: "inline" | "reference";
  instruction: string;
  instruction_id: number | null;
  credential_id: number | null; // ← 추가
  loop_back_to: number | null;
  auto_advance: boolean;
}
```

- [ ] **Step 2: credential 목록 로드**

기존 instructions 로드 패턴과 동일:

```typescript
const [credentials, setCredentials] = useState<
  { id: number; service_name: string; title: string }[]
>([]);

useEffect(() => {
  fetch("/api/credentials")
    .then((r) => r.json())
    .then((json) => setCredentials(json.data ?? []));
}, []);
```

- [ ] **Step 3: 노드 카드에 credential 선택 드롭다운 추가**

기존 auto_advance 토글 아래에:

```tsx
<div className="mt-3">
  <label className="text-xs text-[var(--muted)]">Credential</label>
  <Select
    value={node.credential_id?.toString() ?? ""}
    onChange={(e) =>
      updateNode(i, {
        credential_id: e.target.value ? Number(e.target.value) : null,
      })
    }
  >
    <option value="">없음</option>
    {credentials.map((c) => (
      <option key={c.id} value={c.id}>
        {c.title} ({c.service_name})
      </option>
    ))}
  </Select>
</div>
```

- [ ] **Step 4: 저장 시 credential_id 포함**

handleSave의 nodes 매핑에 `credential_id: node.credential_id ?? null` 추가.

- [ ] **Step 5: 기존 체인 로드 시 credential_id 복원**

loadChain의 node 매핑에 `credential_id: n.credential_id ?? null` 추가.

- [ ] **Step 6: 커밋**

```bash
git add src/app/chains/editor.tsx
git commit -m "feat: add credential dropdown to chain node editor"
```

---

### Task 6: 웹 UI — 태스크 상세에 credential 뱃지

**Files:**

- Modify: `src/app/tasks/[id]/page.tsx`

- [ ] **Step 1: TaskLog 인터페이스는 변경 불필요**

credential 정보는 task_logs에 저장되지 않음. chain_nodes에서 조회 필요. 하지만 태스크 상세 API가 logs를 반환할 때 node의 credential 정보를 포함하지 않음.

대안: task_logs 반환 시 node의 service_name을 JOIN으로 포함하거나, 별도 API 호출.

가장 단순한 방식: `/api/tasks/:id` 응답에 chain_nodes의 credential 정보를 포함.

- [ ] **Step 2: /api/tasks/:id 수정 — credential_service 포함**

`src/app/api/tasks/[id]/route.ts`의 GET에서 logs 조회 시 chain_nodes JOIN:

```typescript
const logs = await query<TaskLog & { credential_service: string | null }>(
  `SELECT tl.*, cn.credential_id,
    (SELECT c.service_name FROM credentials c WHERE c.id = cn.credential_id) as credential_service
   FROM task_logs tl
   LEFT JOIN chain_nodes cn ON cn.id = tl.node_id
   WHERE tl.task_id = $1
   ORDER BY tl.step_order ASC`,
  [Number(id)],
);
```

- [ ] **Step 3: 태스크 상세 UI에 뱃지 표시**

LoopCollapseTimeline의 노드 메타 라인에:

```tsx
{
  log.credential_service && (
    <Badge className="border-[var(--warm)] bg-[var(--warm-light)] text-[var(--foreground)] text-[10px]">
      🔑{log.credential_service}
    </Badge>
  );
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/tasks/[id]/route.ts src/app/tasks/[id]/page.tsx
git commit -m "feat: show credential service badge on task detail timeline"
```

---

### Task 7: 스킬 업데이트 — credential 핸들링 지침

**Files:**

- Modify: `~/.claude/skills/or-next/SKILL.md`
- Modify: `~/.claude/skills/or-start/SKILL.md`

- [ ] **Step 1: or-next에 credential 사용 지침 추가**

실행 루프 섹션 앞에:

```markdown
## Credential 사용 (API 서비스 노드)

advance 반환에 `credentials` 필드가 있으면 해당 노드는 외부 API 연동이 필요한 노드이다.

<HARD-RULE>
credentials.secrets의 키-값을 사용하여 API 호출을 수행한다.
예: credentials.secrets.ACCESS_TOKEN → curl -H "Authorization: Bearer $ACCESS_TOKEN" 형태로 사용
execute_step의 output에 시크릿 원본(토큰, 키 값)을 절대 포함하지 않는다.
결과(URL, 상태코드, 응답 요약)만 기록한다.
</HARD-RULE>
```

- [ ] **Step 2: or-start에도 동일 지침 추가**

or-start의 "execute_step 호출 시 필수 파라미터" 섹션 뒤에 동일한 credential 사용 지침 추가.

- [ ] **Step 3: 커밋**

```bash
git add ~/.claude/skills/or-next/SKILL.md ~/.claude/skills/or-start/SKILL.md
git commit -m "feat: add credential handling instructions to or-next/or-start skills"
```

---

### Task 8: 웹 API — chains 엔드포인트에 credential_id 지원

**Files:**

- Modify: `src/app/api/chains/route.ts`
- Modify: `src/app/api/chains/[id]/route.ts`

- [ ] **Step 1: POST /api/chains에서 노드 생성 시 credential_id 포함**

chains/route.ts POST의 노드 INSERT에 credential_id 컬럼 추가:

```typescript
await client.query(
  "INSERT INTO chain_nodes (chain_id, step_order, node_type, title, instruction, instruction_id, loop_back_to, auto_advance, credential_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
  [
    chainId,
    i + 1,
    (node.node_type ?? "action").trim(),
    (node.title ?? "").trim(),
    (node.instruction ?? "").trim(),
    node.instruction_id ?? null,
    node.loop_back_to ?? null,
    node.auto_advance ? 1 : 0,
    node.credential_id ?? null, // ← 추가
  ],
);
```

NodeInput 인터페이스에 `credential_id?: number` 추가.

- [ ] **Step 2: PUT /api/chains/:id에서도 동일 수정**

chains/[id]/route.ts PUT의 노드 INSERT에 credential_id 포함.

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/chains/route.ts src/app/api/chains/[id]/route.ts
git commit -m "feat: support credential_id in chain node creation/update API"
```
