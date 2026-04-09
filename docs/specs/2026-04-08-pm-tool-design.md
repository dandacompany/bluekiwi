# 프로젝트 관리 도구 설계 문서

> 작성일: 2026-04-08 | 접근 방식: OmegaRod 확장형

## 1. 개요

### 무엇을 만드는가

OmegaRod 프로젝트에 **개인 태스크/프로젝트 관리 모듈**을 추가한다. 프로젝트별 칸반 보드로 태스크를 시각적으로 관리할 수 있는 웹앱.

### 왜 만드는가

개인 생산성 향상을 위한 태스크 추적 도구. 기존 OmegaRod 인프라(Next.js 16 + SQLite + Tailwind v4)를 재활용하여 빠르게 MVP에 도달한다.

### MVP 성공 기준

- 태스크 CRUD (생성/조회/수정/삭제)
- 칸반 보드 (Todo → Doing → Done 드래그&드롭)

---

## 2. 아키텍처

### DB 스키마 (신규 3 테이블)

```sql
CREATE TABLE pm_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#6366f1',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE pm_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#94a3b8',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE pm_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',  -- todo | doing | done
  priority INTEGER NOT NULL DEFAULT 0,  -- 0=none, 1=low, 2=medium, 3=high
  label_id INTEGER REFERENCES pm_labels(id) ON DELETE SET NULL,
  position REAL NOT NULL DEFAULT 0,     -- float for drag & drop ordering (서버에서 자동 할당: 같은 status 내 MAX(position) + 1024)
  due_date TEXT,                        -- nullable ISO date
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 라우트 구조

```
src/app/
  ├─ projects/                  → 프로젝트 목록 (서버 컴포넌트)
  │   └─ [id]/
  │       ├─ page.tsx           → 칸반 보드 (클라이언트 컴포넌트)
  │       └─ settings/page.tsx  → 프로젝트 설정/라벨 관리
  ├─ api/pm/
  │   ├─ projects/route.ts      → GET (목록), POST (생성)
  │   ├─ projects/[id]/route.ts → GET (상세+태스크), PATCH, DELETE
  │   ├─ tasks/route.ts         → POST (생성)
  │   ├─ tasks/[id]/route.ts    → PATCH (수정), DELETE
  │   ├─ labels/route.ts        → GET (?project_id), POST
  │   └─ labels/[id]/route.ts   → DELETE
  └─ (기존 라우트 유지)
```

### 핵심 설계 결정

| 결정                             | 근거                                            |
| -------------------------------- | ----------------------------------------------- |
| `pm_` 테이블 접두사              | 기존 `tasks` 테이블과 이름 충돌 방지            |
| `position` REAL 타입             | 드래그&드롭 시 두 카드 사이 값 할당 (O(1) 연산) |
| status 고정 3단계                | MVP 범위. 커스텀 컬럼은 v2에서 확장             |
| 기존 `db.ts`에 마이그레이션 추가 | 기존 자동 마이그레이션 패턴 재활용              |

---

## 3. API / 인터페이스

### Projects API

| Method | Path                    | Body                                             | Response                               |
| ------ | ----------------------- | ------------------------------------------------ | -------------------------------------- |
| GET    | `/api/pm/projects`      | -                                                | `{ data: Project[], total: number }`   |
| POST   | `/api/pm/projects`      | `{ title, description?, color? }`                | `{ data: Project }`                    |
| GET    | `/api/pm/projects/[id]` | -                                                | `{ data: { project, tasks, labels } }` |
| PATCH  | `/api/pm/projects/[id]` | `{ title?, description?, color?, is_archived? }` | `{ data: Project }`                    |
| DELETE | `/api/pm/projects/[id]` | -                                                | `{ data: { deleted: true } }`          |

### Tasks API

| Method | Path                 | Body                                                                                          | Response                      |
| ------ | -------------------- | --------------------------------------------------------------------------------------------- | ----------------------------- |
| POST   | `/api/pm/tasks`      | `{ project_id, title, status?, priority?, label_id?, due_date? }` (position은 서버 자동 할당) | `{ data: Task }`              |
| PATCH  | `/api/pm/tasks/[id]` | `{ title?, description?, status?, priority?, label_id?, position?, due_date? }`               | `{ data: Task }`              |
| DELETE | `/api/pm/tasks/[id]` | -                                                                                             | `{ data: { deleted: true } }` |

### Labels API

| Method | Path                          | Body                           | Response                           |
| ------ | ----------------------------- | ------------------------------ | ---------------------------------- |
| GET    | `/api/pm/labels?project_id=N` | -                              | `{ data: Label[], total: number }` |
| POST   | `/api/pm/labels`              | `{ project_id, name, color? }` | `{ data: Label }`                  |
| DELETE | `/api/pm/labels/[id]`         | -                              | `{ data: { deleted: true } }`      |

### Response 형식

기존 OmegaRod의 `okResponse`, `listResponse`, `errorResponse` 헬퍼 재활용.

---

## 4. 컴포넌트 설계

### 페이지 컴포넌트 트리

```
projects/page.tsx (서버 컴포넌트)
├─ ProjectCard              — 프로젝트 카드 (색상 태그, 태스크 수)
└─ NewProjectDialog         — 새 프로젝트 생성 폼

projects/[id]/page.tsx (클라이언트 컴포넌트)
├─ BoardColumn              — 상태별 컬럼 (Todo / Doing / Done)
│   └─ TaskCard             — 개별 태스크 카드 (draggable)
├─ TaskDetailPanel          — 태스크 상세 슬라이드오버 패널
└─ NewTaskButton            — 태스크 추가 (컬럼 하단)
```

### 드래그&드롭

- HTML5 Drag and Drop API (네이티브, 외부 의존성 없음)
- `draggable`, `onDragStart`, `onDragOver`, `onDrop` 이벤트
- 드롭 시 PATCH → `status` + `position` 업데이트

### 상태 관리

- 서버 컴포넌트 기본, 칸반 보드만 `'use client'`
- `useOptimistic` 훅으로 낙관적 업데이트 (드래그 즉시 반영)

---

## 5. 에러 처리

| 상황                       | 처리 방법                                |
| -------------------------- | ---------------------------------------- |
| API 네트워크 실패          | 낙관적 업데이트 롤백 + 토스트 알림       |
| 유효성 검증 실패           | 폼 인라인 에러 메시지                    |
| 404 (삭제된 항목 접근)     | 프로젝트 목록으로 리다이렉트             |
| position float 정밀도 한계 | 해당 컬럼 전체 position 재정렬 배치 실행 |

---

## 6. 테스트 전략

| 레벨        | 범위                 | 방식                                    |
| ----------- | -------------------- | --------------------------------------- |
| API E2E     | 모든 엔드포인트 CRUD | 셸 스크립트 + curl (기존 `tests/` 패턴) |
| 드래그&드롭 | 상태 변경, 순서 변경 | 수동 테스트 (MVP)                       |
| DB 무결성   | FK, CASCADE 삭제     | 시드 스크립트로 검증                    |

---

## 7. 서브프로젝트 분해 (구현 순서)

| 순서 | 서브프로젝트             | 산출물                  |
| ---- | ------------------------ | ----------------------- |
| 1    | DB 스키마 + 마이그레이션 | `db.ts` 확장            |
| 2    | Projects API             | `/api/pm/projects/`     |
| 3    | Tasks API                | `/api/pm/tasks/`        |
| 4    | Labels API               | `/api/pm/labels/`       |
| 5    | 프로젝트 목록 UI         | `/projects` 페이지      |
| 6    | 칸반 보드 UI             | `/projects/[id]` 페이지 |
| 7    | 드래그&드롭              | HTML5 DnD 연동          |
| 8    | 태스크 상세 패널         | 슬라이드오버 패널       |
| 9    | 홈 페이지 연동           | 기존 네비게이션에 추가  |
| 10   | E2E 테스트               | `tests/` 셸 스크립트    |
