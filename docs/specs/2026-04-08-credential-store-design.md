# OmegaRod Credential Store

노드 레벨 API 시크릿 관리 시스템. 외부 API 연동이 필요한 노드에 credential을 바인딩하고, Claude Code 세션에서 안전하게 사용할 수 있도록 한다.

## 배경

OmegaRod 워크플로의 특정 노드는 외부 API를 호출해야 한다 (예: Threads 포스팅, Slack 메시지, OpenAI 호출). 현재는 API 키를 관리하는 메커니즘이 없어서, instruction에 "auth-loader에서 키를 로드하라"는 가이드를 수동으로 작성해야 한다.

## 결정 사항

| 항목        | 결정                                               |
| ----------- | -------------------------------------------------- |
| 사용 주체   | Claude Code 세션 (MCP를 통해 전달받아 사용)        |
| 바인딩 범위 | 노드 레벨 — API 서비스 전용 노드에 1:1 연결        |
| 저장소      | PostgreSQL 평문 저장 + 웹 API 마스킹               |
| 전달 방식   | advance/start_chain 응답에 별도 `credentials` 필드 |

## 데이터 모델

### credentials 테이블 (신규)

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

- `service_name`: 서비스 식별자 (threads, slack, openai 등)
- `title`: 사람이 읽는 이름 ("단테 Threads 계정")
- `secrets`: JSON 문자열 (`{"ACCESS_TOKEN":"ig_xxx","USER_ID":"123"}`)

### chain_nodes 확장

```sql
ALTER TABLE chain_nodes ADD COLUMN credential_id INTEGER
  REFERENCES credentials(id) ON DELETE SET NULL;
```

credential_id가 NULL이면 일반 노드, 값이 있으면 API 서비스 노드.

### 관계

```
credentials (1) ──< chain_nodes (N)
    id               credential_id → credentials.id
```

`instruction_id → instructions` 패턴과 동일한 원리.

## 보안 모델

### 보안 경계

```
                    secrets 원본    마스킹값    접근불가
─────────────────────────────────────────────────
PostgreSQL DB          O
MCP (stdio → Claude)   O
웹 API 응답                          O
웹 UI 화면                           O
task_logs.output                                 O
```

### 마스킹 규칙

웹 API 응답에서 secrets 값을 마스킹:

- 10자 이상: 앞 6자 + `****` + 뒤 4자
- 10자 미만: 앞 2자 + `****`
- secrets 원본은 웹 API로 절대 반환하지 않음

### MCP 전달

advance(), start_chain(), rewind() 응답에서만 원본 전달:

```json
{
  "current_step": {
    "credentials": {
      "service": "threads",
      "title": "단테 Threads 계정",
      "secrets": {
        "ACCESS_TOKEN": "ig_FGAxxxxxxx",
        "USER_ID": "123456789"
      }
    }
  }
}
```

### 스킬 보안 규칙

- credentials가 있으면 해당 키로 API 호출 수행
- execute_step의 output에 시크릿 원본을 포함하지 않음
- 결과(URL, 상태코드, 응답 요약)만 기록

## 웹 API

| Method | Path                 | 설명                             |
| ------ | -------------------- | -------------------------------- |
| GET    | /api/credentials     | 목록 (secrets 마스킹)            |
| GET    | /api/credentials/:id | 상세 (secrets 마스킹)            |
| POST   | /api/credentials     | 생성                             |
| PUT    | /api/credentials/:id | 수정 (빈 secrets 값은 기존 유지) |
| DELETE | /api/credentials/:id | 삭제                             |

## MCP 도구 변경

### 기존 도구 수정

- `start_chain`: 첫 노드에 credential_id 있으면 credentials 필드 포함
- `advance`: 다음 노드에 credential_id 있으면 credentials 필드 포함
- `rewind`: 대상 노드에 credential_id 있으면 credentials 필드 포함
- `create_workflow` / `update_workflow`: nodes 배열에 credential_id 파라미터 추가

### 신규 도구

- `list_credentials`: credential 목록 (마스킹). 워크플로 생성 시 선택용.

### resolveCredential 헬퍼

```typescript
async function resolveCredential(node: ChainNode) {
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

## 웹 UI

### /credentials 페이지

- Credential 목록 (service_name, title, 마스킹된 secrets, 연결 노드 수)
- 생성/편집/삭제
- 수정 시 secrets 값이 비어있으면 기존 값 유지

### 체인 편집기 확장

노드 카드에 credential 선택 드롭다운 추가:

- "없음" / 등록된 credential 목록
- 선택 시 credential_id 저장

### 태스크 상세

credential이 사용된 노드에 서비스 뱃지 표시 (시크릿 값 미표시)

## 구현 범위

1. DB: credentials 테이블 + chain_nodes.credential_id 컬럼
2. 웹 API: /api/credentials CRUD (마스킹)
3. MCP: resolveCredential + 기존 도구 수정 + list_credentials
4. 스킬: or-next, or-start에 credential 핸들링 지침 추가
5. 웹 UI: /credentials 페이지, 체인 편집기 드롭다운, 태스크 뱃지
