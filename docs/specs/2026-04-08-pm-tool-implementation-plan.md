# 프로젝트 관리 도구 — 구현 계획

> 설계 문서: `docs/specs/2026-04-08-pm-tool-design.md`
> 작성일: 2026-04-08

## Phase 1: DB 스키마 + 마이그레이션

### 작업 내용

- `src/lib/db.ts`의 `migrate()` 함수에 `pm_projects`, `pm_labels`, `pm_tasks` 테이블 CREATE 문 추가
- TypeScript 타입 정의 추가: `PmProject`, `PmLabel`, `PmTask`
- Response helper는 기존 `okResponse`, `listResponse`, `errorResponse` 재사용

### 관련 파일

- `src/lib/db.ts` (수정)

### 의존성

- 없음 (첫 번째 단계)

### 검증

- `npm run dev` 실행 후 `data/omega-rod.db`에 테이블 생성 확인
- `sqlite3 data/omega-rod.db ".tables"` 로 pm\_ 테이블 3개 확인

---

## Phase 2: Projects API

### 작업 내용

- `GET /api/pm/projects` — 프로젝트 목록 (is_archived=0 필터)
- `POST /api/pm/projects` — 프로젝트 생성 (title 필수, description/color 선택)
- `GET /api/pm/projects/[id]` — 프로젝트 상세 + 해당 태스크 + 라벨 JOIN 조회
- `PATCH /api/pm/projects/[id]` — 부분 수정
- `DELETE /api/pm/projects/[id]` — 삭제 (CASCADE로 태스크/라벨 자동 삭제)

### 관련 파일

- `src/app/api/pm/projects/route.ts` (신규)
- `src/app/api/pm/projects/[id]/route.ts` (신규)

### 의존성

- Phase 1 (DB 스키마)

### 검증

- curl로 CRUD 전체 테스트
- CASCADE 삭제 확인 (프로젝트 삭제 시 태스크/라벨도 삭제)

---

## Phase 3: Tasks API

### 작업 내용

- `POST /api/pm/tasks` — 태스크 생성 (position 자동 할당: 같은 project+status 내 MAX(position)+1024)
- `PATCH /api/pm/tasks/[id]` — 수정 (status/position 변경 = 칸반 드래그&드롭)
- `DELETE /api/pm/tasks/[id]` — 삭제

### 관련 파일

- `src/app/api/pm/tasks/route.ts` (신규)
- `src/app/api/pm/tasks/[id]/route.ts` (신규)

### 의존성

- Phase 1 (DB 스키마)
- Phase 2와 병렬 가능하나, 테스트 시 프로젝트가 필요하므로 순차 권장

### 검증

- 태스크 생성 후 position 자동 할당 확인
- status 변경 + position 변경 동시 PATCH 테스트
- 존재하지 않는 project_id로 생성 시 FK 에러 확인

---

## Phase 4: Labels API

### 작업 내용

- `GET /api/pm/labels?project_id=N` — 프로젝트별 라벨 목록
- `POST /api/pm/labels` — 라벨 생성 (project_id, name 필수)
- `DELETE /api/pm/labels/[id]` — 라벨 삭제 (해당 태스크의 label_id는 NULL로)

### 관련 파일

- `src/app/api/pm/labels/route.ts` (신규)
- `src/app/api/pm/labels/[id]/route.ts` (신규)

### 의존성

- Phase 1 (DB 스키마)

### 검증

- 라벨 삭제 후 해당 태스크의 label_id가 NULL로 변경 확인 (ON DELETE SET NULL)

---

## Phase 5: 프로젝트 목록 UI

### 작업 내용

- `/projects` 페이지 (서버 컴포넌트)
- `ProjectCard` 컴포넌트: 프로젝트 색상 태그, 제목, 설명, 태스크 수 표시
- `NewProjectDialog` 컴포넌트: title/description/color 입력 폼 (클라이언트 컴포넌트)
- 빈 상태(프로젝트 없음) UI

### 관련 파일

- `src/app/projects/page.tsx` (신규)
- `src/app/projects/components/ProjectCard.tsx` (신규)
- `src/app/projects/components/NewProjectDialog.tsx` (신규)

### 의존성

- Phase 2 (Projects API)

### 검증

- 프로젝트 생성 → 목록에 즉시 반영
- 프로젝트 카드 클릭 → `/projects/[id]`로 이동

---

## Phase 6: 칸반 보드 UI

### 작업 내용

- `/projects/[id]` 페이지 (클라이언트 컴포넌트)
- `BoardColumn` 컴포넌트: Todo / Doing / Done 3개 컬럼
- `TaskCard` 컴포넌트: 제목, 우선순위 뱃지, 라벨, 마감일 표시
- `NewTaskButton` 컴포넌트: 컬럼 하단 "+" 버튼 → 인라인 입력

### 관련 파일

- `src/app/projects/[id]/page.tsx` (신규)
- `src/app/projects/[id]/components/BoardColumn.tsx` (신규)
- `src/app/projects/[id]/components/TaskCard.tsx` (신규)
- `src/app/projects/[id]/components/NewTaskButton.tsx` (신규)

### 의존성

- Phase 2 (Projects API — 프로젝트 상세 조회)
- Phase 3 (Tasks API — 태스크 CRUD)

### 검증

- 3개 컬럼에 태스크가 올바르게 분류되는지 확인
- 태스크 생성 시 해당 컬럼에 추가

---

## Phase 7: 드래그&드롭

### 작업 내용

- `TaskCard`에 `draggable` 속성 추가
- `BoardColumn`에 `onDragOver`, `onDrop` 이벤트 핸들러
- 드롭 시 `useOptimistic`으로 UI 즉시 반영
- PATCH `/api/pm/tasks/[id]` 호출 (status + position 업데이트)
- 실패 시 롤백 + 에러 토스트

### 관련 파일

- `src/app/projects/[id]/components/TaskCard.tsx` (수정)
- `src/app/projects/[id]/components/BoardColumn.tsx` (수정)
- `src/app/projects/[id]/page.tsx` (수정 — useOptimistic 로직)

### 의존성

- Phase 6 (칸반 보드 UI)

### 검증

- 같은 컬럼 내 순서 변경 (position만 변경)
- 다른 컬럼으로 이동 (status + position 변경)
- 네트워크 차단 후 드롭 → 롤백 확인

---

## Phase 8: 태스크 상세 패널

### 작업 내용

- `TaskDetailPanel` 슬라이드오버 컴포넌트 (우측에서 슬라이드인)
- 태스크 제목/설명 인라인 편집
- 우선순위, 라벨, 마감일 변경
- 삭제 버튼 (확인 후 삭제)

### 관련 파일

- `src/app/projects/[id]/components/TaskDetailPanel.tsx` (신규)

### 의존성

- Phase 6 (칸반 보드 UI)
- Phase 4 (Labels API — 라벨 선택)

### 검증

- 태스크 카드 클릭 → 패널 열림
- 필드 수정 → 자동 저장 (PATCH)
- 삭제 → 칸반 보드에서 즉시 제거

---

## Phase 9: 홈 페이지 연동

### 작업 내용

- `src/app/page.tsx`의 `links` 배열에 "프로젝트 관리" 항목 추가
- 색상: 기존 테마에 맞는 색상 선택 (예: `bg-blue-600`)

### 관련 파일

- `src/app/page.tsx` (수정)

### 의존성

- Phase 5 (프로젝트 목록 UI)

### 검증

- 홈 페이지에서 "프로젝트 관리" 클릭 → `/projects`로 이동

---

## Phase 10: E2E 테스트

### 작업 내용

- `tests/pm/` 디렉토리 생성
- API E2E 테스트 스크립트: 프로젝트 CRUD → 태스크 CRUD → 라벨 CRUD → CASCADE 삭제
- DB 무결성 테스트: FK 제약조건, position 자동 할당

### 관련 파일

- `tests/pm/run-pm-e2e.sh` (신규)

### 의존성

- Phase 2, 3, 4 (모든 API)

### 검증

- `bash tests/pm/run-pm-e2e.sh` 실행 → 전체 통과
