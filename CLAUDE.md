@AGENTS.md

## Commit Convention

All commit messages must be in **English** using [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add built-in seed workflows
fix: resolve lightningcss binary mismatch in Docker dev
chore: bump version to 0.3.2
refactor: extract seed logic into shared module
docs: update README with self-hosting guide
test: add e2e tests for workflow seeding
```

- Type: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `ci`
- Scope (optional): `feat(seed):`, `fix(editor):`, `chore(deps):`
- Body/footer: English preferred, Korean acceptable for internal context

## Dev Environment

로컬 개발은 **Docker Compose**로 프로덕션과 동일한 4개 컨테이너를 띄운다. `next dev`를 직접 실행하지 않는다.

```bash
# 시작
docker compose -f docker/docker-compose.dev.yml up -d --build

# 중지
docker compose -f docker/docker-compose.dev.yml down

# 상태
docker compose -f docker/docker-compose.dev.yml ps
```

| 서비스 | 포트 | 설명 |
|--------|------|------|
| app | 3100→3000 | Next.js dev (hot-reload, webpack) |
| ws-relay | 3001 | WebSocket 실시간 알림 중계 |
| db | 5433→5432 | PostgreSQL 16 |
| redis | 6379 | Redis 7 |

- App은 `/ws/*` 요청을 ws-relay로 프록시 (next.config.ts rewrites)
- 소스 볼륨 마운트로 hot-reload 동작
- DB 접속: `docker exec docker-db-1 psql -U bluekiwi -d bluekiwi`

## DB Migration

- 프로덕션: app 시작 시 `scripts/migrate.js`가 자동 실행 (`schema_migrations` 테이블로 추적)
- 로컬 dev: `npx tsx scripts/migrate.ts` 수동 실행
- 새 마이그레이션: `docker/migrations/NNN_name.sql` 추가 후 `docker/init.sql`에도 반영

### ⚠️ SQL 마이그레이션 작성 주의사항

- **`ADD CONSTRAINT IF NOT EXISTS` 금지**: PostgreSQL은 이 문법을 지원하지 않음. 대신:
  ```sql
  DO $$ BEGIN
    ALTER TABLE t ADD CONSTRAINT fk_name FOREIGN KEY (...) REFERENCES ...;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
  ```
- `ADD COLUMN IF NOT EXISTS`는 사용 가능 (PostgreSQL 9.6+)

## 프로덕션 배포 (DanteServer)

### 인스턴스 현황

| 도메인 | 용도 | 포트(app/ws) | 디렉토리 (DanteServer) |
|--------|------|-------------|----------------------|
| dantelabs.bluekiwi.work | 단테랩스 전용 | 3101 / 3001 | `/home/dante/projects/bluekiwi` |
| gcex.bluekiwi.work | 여기어때 전용 | 3104 / 3005 | `/home/dante/projects/gcex` |

### Docker 이미지 빌드 & 배포

로컬 Mac(ARM64)에서 빌드 후 Linux 서버(x86_64)에 배포할 때 **반드시 `--platform linux/amd64`** 지정:

```bash
# ❌ 잘못된 방법 — Mac ARM64 이미지가 올라가서 서버에서 "exec format error" 발생
docker build -t ghcr.io/dandacompany/bluekiwi:latest .
docker push ghcr.io/dandacompany/bluekiwi:latest

# ✅ 올바른 방법
docker buildx build --platform linux/amd64 \
  -t ghcr.io/dandacompany/bluekiwi:latest --push .
```

### 배포 절차

```bash
# 1. 이미지 빌드 & 푸시 (amd64)
docker buildx build --platform linux/amd64 -t ghcr.io/dandacompany/bluekiwi:latest --push .

# 2. 서버에서 이미지 갱신 & 재시작
ssh DanteServer "cd /home/dante/projects/bluekiwi && docker compose pull && docker compose up -d"
```

### 초기화 (데이터 포함 완전 리셋)

```bash
ssh DanteServer "cd /home/dante/projects/bluekiwi && docker compose down -v && docker compose up -d"
```

> ⚠️ `-v` 없이 `down`하면 PostgreSQL 볼륨(`pgdata`)이 유지되어 기존 계정·데이터가 남음

### Caddy + Cloudflare 연동

- Caddy: `/etc/caddy/Caddyfile` 수정 후 `sudo caddy reload --config /etc/caddy/Caddyfile`
- DNS: Cloudflare API로 A 레코드 추가 (Proxied=true), Zone ID는 `~/.claude/auth/cloudflare.env` 참조
- `bluekiwi.work` Zone ID: `aeac1b8435da38cff7511431b96283bb`
