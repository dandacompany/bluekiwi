# BlueKiwi Docker Deployment

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  docker-compose                                      │
│                                                      │
│  ┌──────────┐           ┌──────────────────┐         │
│  │ PostgreSQL│           │   Next.js App    │         │
│  │  :5432    │           │   :3000          │         │
│  │           │◄──────────┤                  │         │
│  │  bluekiwi │           │  API routes      │         │
│  │  database │           │  Web UI          │         │
│  └──────────┘           └──────────────────┘         │
│       ▲                              ▲               │
│       │                              │               │
│       │              ┌──────────────────┐            │
│       │              │  WS Relay        │            │
│       └──────────────┤  :3001           │            │
│                      │  WebSocket 중계   │            │
│                      └──────────────────┘            │
└─────────────────────────────────────────────────────┘
                          ▲
                          │ MCP (stdio)
                    ┌─────┴─────┐
                    │ Claude Code │
                    │ (호스트)    │
                    └───────────┘
```

## Quick Start

### 1. 환경 변수 설정

```bash
cd docker
cp .env.example .env
# 필요 시 .env 편집 (프로덕션에서는 비밀번호 변경 필수)
```

### 2. 컨테이너 실행

```bash
docker compose up -d
```

### 3. 상태 확인

```bash
docker compose ps
docker compose logs app --tail 20
```

### 4. 접속

- Web UI: http://localhost:3000
- API: http://localhost:3000/api
- WebSocket: ws://localhost:3001

## Services

| Service    | Image              | Port | Description             |
| ---------- | ------------------ | ---- | ----------------------- |
| `db`       | postgres:16-alpine | 5432 | PostgreSQL 데이터베이스 |
| `app`      | custom (Next.js)   | 3000 | Web UI + API            |
| `ws-relay` | custom             | 3001 | WebSocket 실시간 중계   |

## Environment Variables

| Variable            | Default           | Description         |
| ------------------- | ----------------- | ------------------- |
| `POSTGRES_DB`       | bluekiwi          | DB 이름             |
| `POSTGRES_USER`     | bluekiwi          | DB 사용자           |
| `POSTGRES_PASSWORD` | bluekiwi_dev_2026 | DB 비밀번호         |
| `DB_PORT`           | 5432              | PostgreSQL 포트     |
| `APP_PORT`          | 3000              | Next.js 앱 포트     |
| `WS_PORT`           | 3001              | WebSocket 중계 포트 |
| `DATABASE_URL`      | (auto)            | PostgreSQL 연결 URL |

## Development Mode

로컬 개발 시에는 DB만 Docker로 실행하고, 앱은 호스트에서 실행합니다:

```bash
# DB만 실행
docker compose up db -d

# 호스트에서 앱 실행
cd ..
DATABASE_URL=postgresql://bluekiwi:bluekiwi_dev_2026@localhost:5432/bluekiwi npm run dev

# WS Relay
npm run ws
```

### MCP 서버 연결

`.mcp.json`에서 `DATABASE_URL` 환경변수를 설정합니다:

```json
{
  "mcpServers": {
    "blue-kiwi": {
      "command": "node",
      "args": ["/path/to/BlueKiwi/mcp/dist/server.js"],
      "env": {
        "DATABASE_URL": "postgresql://bluekiwi:bluekiwi_dev_2026@localhost:5432/bluekiwi"
      }
    }
  }
}
```

## Database

### Schema

앱 컨테이너 시작 시 `scripts/migrate.js`가 `docker/migrations/*.sql`을 순서대로 적용합니다 (`schema_migrations` 테이블로 추적).

7개 테이블:

- `instructions` — 에이전트 지침
- `workflows` — 워크플로 정의
- `workflow_nodes` — 워크플로 노드 (단계)
- `tasks` — 태스크 인스턴스
- `task_logs` — 단계별 실행 로그
- `task_artifacts` — 산출물 참조 (파일, git, URL)
- `task_comments` — 단계별 코멘트

### DB 접속

```bash
# psql로 직접 접속
docker compose exec db psql -U bluekiwi -d bluekiwi

# 외부에서 접속
psql postgresql://bluekiwi:bluekiwi_dev_2026@localhost:5432/bluekiwi
```

### 데이터 백업/복원

```bash
# 백업
docker compose exec db pg_dump -U bluekiwi bluekiwi > backup.sql

# 복원
cat backup.sql | docker compose exec -T db psql -U bluekiwi -d bluekiwi
```

### 초기화

```bash
docker compose down -v   # 볼륨 포함 삭제
docker compose up -d     # 재생성 (migrate.js가 모든 마이그레이션 재실행)
```

## Seed Data

워크플로 시드 데이터를 등록하려면:

```bash
# DB + 앱이 실행 중인 상태에서
cd ..
bash scripts/seed-gstack.sh http://localhost:3000
```

## Production

프로덕션에서는 반드시:

1. `.env`의 비밀번호를 강력한 값으로 변경
2. `POSTGRES_PASSWORD` 변경
3. 외부 접근이 필요 없으면 `DB_PORT` 매핑 제거
4. 볼륨 백업 정책 수립

```bash
# 프로덕션 실행
docker compose --env-file .env.production up -d
```

## Troubleshooting

### DB 연결 실패

```bash
# PostgreSQL 상태 확인
docker compose exec db pg_isready -U bluekiwi

# 로그 확인
docker compose logs db --tail 50
```

### 마이그레이션 문제

새 스키마 변경은 `docker/migrations/NNN_*.sql` 파일로 추가하고 앱을 재시작하면 자동 적용됩니다. 볼륨을 초기화해 처음부터 다시 돌리려면:

```bash
# 볼륨 삭제 후 재생성 (데이터 손실!)
docker compose down -v && docker compose up -d
```

### 앱 빌드 실패

```bash
# 캐시 없이 재빌드
docker compose build --no-cache app
```
