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
- 새 마이그레이션: `docker/migrations/NNN_name.sql` 추가 — 앱 시작 시 `scripts/migrate.js`가 `schema_migrations`로 추적하며 순서대로 자동 적용

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

이미지는 **멀티아치**(`linux/amd64,linux/arm64`)로 빌드해 GHCR에 푸시한다. Linux 서버(amd64)와 Apple Silicon Mac(arm64) 모두 동일한 태그로 네이티브 구동 — Rosetta/qemu 에뮬 없음.

빌드는 **GitHub Actions** (`.github/workflows/release-docker.yml`)에서 amd64 (`ubuntu-latest`)와 arm64 (`ubuntu-24.04-arm`) 네이티브 러너 병렬로 처리한다. `local/bk-release.sh`(또는 `/bk-deploy`)는 `gh workflow run release-docker.yml`로 트리거 후 `gh run watch`로 완료 대기. Mac 로컬은 lint + Next.js build + MCP build + `git push`만 담당.

수동으로 트리거하려면:

```bash
gh workflow run release-docker.yml --ref main \
  -f version=1.2.3 -f tag_latest=true
```

`git tag v1.2.3 && git push origin v1.2.3`로도 같은 워크플로가 자동 트리거된다(release-docker.yml은 `push: tags: ["v*"]` 트리거 보유).

❌ 로컬에서 맨손으로 `docker build`만 돌리면 단일 아치 이미지가 올라가 반대편 플랫폼에서 `exec format error`가 발생한다. GHA 경로를 통해야 멀티아치 매니페스트가 나옴.

Mac에서 최신 이미지를 로컬로 스모크 테스트하려면 (버그 신고 재현 등):

```bash
mkdir /tmp/bk-smoke && cd /tmp/bk-smoke
curl -fsSL https://raw.githubusercontent.com/dandacompany/bluekiwi/main/docker-compose.yml -o docker-compose.yml
printf 'DB_PASSWORD=%s\nJWT_SECRET=%s\nAPP_PORT=3180\nWS_PORT=3181\n' "$(openssl rand -hex 16)" "$(openssl rand -hex 32)" > .env
docker compose pull && docker compose up -d
docker compose logs app | grep "\[migrate\]"   # fresh DB에 migrate.js가 순서대로 적용
```

### 배포 절차

```bash
# 1. 이미지 빌드 & 푸시 (GHA 멀티아치)
gh workflow run release-docker.yml --ref main \
  -f version=$(node -p "require('./package.json').version") -f tag_latest=true
gh run watch  # 완료 확인

# 2. 서버에서 이미지 갱신 & 재시작
ssh DanteServer "cd /home/dante/projects/bluekiwi && docker compose pull && docker compose up -d"
```

`/bk-deploy all with patch bump`이 위 두 단계를 포함한 전체 릴리스를 자동 처리한다.

### 초기화 (데이터 포함 완전 리셋)

```bash
ssh DanteServer "cd /home/dante/projects/bluekiwi && docker compose down -v && docker compose up -d"
```

> ⚠️ `-v` 없이 `down`하면 PostgreSQL 볼륨(`pgdata`)이 유지되어 기존 계정·데이터가 남음

### Caddy + Cloudflare 연동

- Caddy: `/etc/caddy/Caddyfile` 수정 후 `sudo caddy reload --config /etc/caddy/Caddyfile`
- DNS: Cloudflare API로 A 레코드 추가 (Proxied=true), Zone ID는 `~/.claude/auth/cloudflare.env` 참조
- `bluekiwi.work` Zone ID: `aeac1b8435da38cff7511431b96283bb`
