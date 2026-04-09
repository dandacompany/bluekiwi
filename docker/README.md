# OmegaRod Docker Deployment

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  docker-compose                                      │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │ PostgreSQL│   │  Redis   │   │   Next.js App    │ │
│  │  :5432    │   │  :6379   │   │   :3000          │ │
│  │           │◄──┤          │◄──┤                  │ │
│  │  omegarod │   │  cache   │   │  API routes      │ │
│  │  database │   │  pub/sub │   │  Web UI          │ │
│  └──────────┘   └──────────┘   └──────────────────┘ │
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

| Service    | Image              | Port | Description                        |
| ---------- | ------------------ | ---- | ---------------------------------- |
| `db`       | postgres:16-alpine | 5432 | PostgreSQL 데이터베이스            |
| `redis`    | redis:7-alpine     | 6379 | 캐시/pub-sub (향후 WebSocket 중계) |
| `app`      | custom (Next.js)   | 3000 | Web UI + API                       |
| `ws-relay` | custom             | 3001 | WebSocket 실시간 중계              |

## Environment Variables

| Variable            | Default             | Description         |
| ------------------- | ------------------- | ------------------- |
| `POSTGRES_DB`       | omegarod            | DB 이름             |
| `POSTGRES_USER`     | omegarod            | DB 사용자           |
| `POSTGRES_PASSWORD` | omegarod_dev_2026   | DB 비밀번호         |
| `DB_PORT`           | 5432                | PostgreSQL 포트     |
| `REDIS_PASSWORD`    | omegarod_redis_2026 | Redis 비밀번호      |
| `REDIS_PORT`        | 6379                | Redis 포트          |
| `APP_PORT`          | 3000                | Next.js 앱 포트     |
| `WS_PORT`           | 3001                | WebSocket 중계 포트 |
| `DATABASE_URL`      | (auto)              | PostgreSQL 연결 URL |
| `REDIS_URL`         | (auto)              | Redis 연결 URL      |

## Development Mode

로컬 개발 시에는 DB와 Redis만 Docker로 실행하고, 앱은 호스트에서 실행합니다:

```bash
# DB + Redis만 실행
docker compose up db redis -d

# 호스트에서 앱 실행
cd ..
DATABASE_URL=postgresql://omegarod:omegarod_dev_2026@localhost:5432/omegarod npm run dev

# WS Relay
npm run ws
```

### MCP 서버 연결

`.mcp.json`에서 `DATABASE_URL` 환경변수를 설정합니다:

```json
{
  "mcpServers": {
    "omega-rod": {
      "command": "node",
      "args": ["/path/to/OmegaRod/mcp/dist/server.js"],
      "env": {
        "DATABASE_URL": "postgresql://omegarod:omegarod_dev_2026@localhost:5432/omegarod"
      }
    }
  }
}
```

## Database

### Schema

`init.sql`이 PostgreSQL 컨테이너 첫 실행 시 자동으로 실행됩니다.

7개 테이블:

- `instructions` — 에이전트 지침
- `chains` — 워크플로 정의
- `chain_nodes` — 워크플로 노드 (단계)
- `tasks` — 태스크 인스턴스
- `task_logs` — 단계별 실행 로그
- `task_artifacts` — 산출물 참조 (파일, git, URL)
- `task_comments` — 단계별 코멘트

### DB 접속

```bash
# psql로 직접 접속
docker compose exec db psql -U omegarod -d omegarod

# 외부에서 접속
psql postgresql://omegarod:omegarod_dev_2026@localhost:5432/omegarod
```

### 데이터 백업/복원

```bash
# 백업
docker compose exec db pg_dump -U omegarod omegarod > backup.sql

# 복원
cat backup.sql | docker compose exec -T db psql -U omegarod -d omegarod
```

### 초기화

```bash
docker compose down -v   # 볼륨 포함 삭제
docker compose up -d     # 재생성 (init.sql 재실행)
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
2. `POSTGRES_PASSWORD`, `REDIS_PASSWORD` 변경
3. 외부 접근이 필요 없으면 `DB_PORT`, `REDIS_PORT` 매핑 제거
4. 볼륨 백업 정책 수립

```bash
# 프로덕션 실행
docker compose --env-file .env.production up -d
```

## Troubleshooting

### DB 연결 실패

```bash
# PostgreSQL 상태 확인
docker compose exec db pg_isready -U omegarod

# 로그 확인
docker compose logs db --tail 50
```

### 마이그레이션 문제

init.sql은 첫 실행 시에만 적용됩니다. 스키마를 변경한 경우:

```bash
# 볼륨 삭제 후 재생성 (데이터 손실!)
docker compose down -v && docker compose up -d

# 또는 수동으로 ALTER TABLE 실행
docker compose exec db psql -U omegarod -d omegarod -c "ALTER TABLE ..."
```

### 앱 빌드 실패

```bash
# 캐시 없이 재빌드
docker compose build --no-cache app
```
