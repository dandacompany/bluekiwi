# BlueKiwi Quick Start Global Install Smoke Flow

## 목적

이 문서는 글로벌 설치된 `bluekiwi` CLI가 Quick Start 로컬 런타임을 정상적으로 띄우는지 빠르게 확인하는 절차를 정의한다.

이 문서가 검증하는 안정성 수준은 `Beta`다.

목표는 다음 네 가지다.

1. CLI가 설치된다.
2. local runtime이 시작된다.
3. HTTP 응답과 `status`가 정상이다.
4. local runtime이 정상적으로 중지된다.

이 smoke flow를 통과하면 `Quick Start Beta`의 지원 범위 안에서는 정상 동작으로 간주한다.

## 전제 조건

- Node.js 22 이상
- macOS 또는 Linux
- `bluekiwi`가 글로벌 설치 가능해야 함
- packaged runtime이 포함된 CLI 빌드 또는 설치본이어야 함

## 설치

```bash
npm install -g bluekiwi
```

설치 확인:

```bash
bluekiwi --version
bluekiwi help
```

기대 결과:

- 버전 문자열 출력
- `start`, `stop`, `restart`, `status` 명령 확인 가능

## 1. 시작

가장 기본 smoke flow:

```bash
bluekiwi start
```

기대 결과:

- `BlueKiwi local runtime started`
- `Profile: default`
- `URL: http://127.0.0.1:<port>`
- `Runtime: bundle (...)` 또는 `Runtime: source (...)`
- `SQLite: .../bluekiwi.sqlite`

확인 포인트:

- 기본 시작 포트 후보는 `3102`
- 포트가 이미 사용 중이면 자동으로 증가된 포트가 선택될 수 있음
- 이 경우 실제 포트는 출력값이나 `status`에서 확인

## 2. 상태 확인

```bash
bluekiwi status
```

기대 결과:

- `Local runtime: running`
- `Local URL: http://127.0.0.1:<port>`
- `Local PID: <pid>`
- `Local health: ok (...)`
- `Local SQLite: <absolute path>`

추가 확인 포인트:

- `Local health`는 `/login` 기준 HTTP 응답으로 판단됨
- stale pid record가 있으면 자동 정리될 수 있음

## 3. 브라우저 확인

브라우저에서 아래 URL 접속:

```text
http://127.0.0.1:<port>
```

기대 결과:

- 로그인 페이지 또는 로그인으로의 리다이렉트
- 서버 500 없이 페이지 응답

## 4. 데이터 파일 확인

기본 profile `default` 기준 주요 경로:

```text
~/.bluekiwi/quickstart/default/data/bluekiwi.sqlite
~/.bluekiwi/quickstart/default/run/app.json
```

기대 결과:

- SQLite 파일 생성됨
- runtime metadata 파일 생성됨

## 5. 중지

```bash
bluekiwi stop
```

기대 결과:

- `BlueKiwi local runtime stopped`
- 또는 stale record만 남아 있었다면 `Removed stale local runtime record`

중지 후 재확인:

```bash
bluekiwi status
```

기대 결과:

- local runtime이 더 이상 running으로 표시되지 않음

## 6. interactive UI smoke

Quick Start 런타임이 실제 interactive flow까지 정상인지 확인하려면 아래 스모크를 추가로 실행한다.

```bash
bash tests/4/run-hitl-vs-ui-smoke.sh
```

기대 결과:

- 로그인 성공
- 테스트 workflow 생성 성공
- visual selection iframe submit 성공
- persisted web response 확인 성공
- HITL approval request 생성 성공
- 브라우저 승인 버튼 클릭 성공
- approval complete UI 확인 성공

이 스크립트는 다음도 지원한다.

- 대상 서버가 없으면 local SQLite app을 자동 기동
- headless browser 실행
- fresh SQLite에서 first-user setup 자동 수행

## 7. packaged CLI smoke

packaged runtime이 실제 install artifact 안에서 뜨는지 확인하려면 아래 스모크를 사용한다.

```bash
bash tests/4/run-packaged-cli-smoke.sh
```

기대 결과:

- `npm pack` 기반 설치 성공
- packaged `bluekiwi` 바이너리 실행 성공
- `bluekiwi status`가 `bundle` runtime으로 표시
- `/login` 응답 성공
- SQLite 파일 생성 성공
- `bluekiwi stop` 성공

## 8. admin / maintenance smoke

SQLite runtime에서 위험도가 높은 maintenance endpoint를 확인하려면 아래 스모크를 사용한다.

```bash
bash tests/4/run-admin-maintenance-sqlite-smoke.sh
```

기대 결과:

- `cleanup-visual-html` 성공
- `timeout-stale` 성공
- `delete-user transfer` 성공
- `delete-user delete_all` 성공

기본값:

- `TARGET_URL=http://127.0.0.1:3510`
- `SQLITE_PATH=/tmp/bluekiwi-sqlite-smoke/data/bluekiwi.sqlite`
- `LOGIN_EMAIL=sqlite-smoke@example.com`
- `LOGIN_PASSWORD=Passw0rd!`

필요 시 명시적으로 지정:

```bash
TARGET_URL=http://127.0.0.1:3102 \
SQLITE_PATH=/tmp/bluekiwi.sqlite \
LOGIN_EMAIL=sqlite-smoke@example.com \
LOGIN_PASSWORD=Passw0rd! \
bash tests/4/run-hitl-vs-ui-smoke.sh
```

## 옵션 포함 smoke flow

### 포트 지정

```bash
bluekiwi start --port 3200
```

### 프로필 분리

```bash
bluekiwi start --profile demo
bluekiwi status --profile demo
bluekiwi stop --profile demo
```

### 데이터 경로 지정

```bash
bluekiwi start --data-dir /tmp/bluekiwi-demo
```

### SQLite 파일 직접 지정

```bash
bluekiwi start --sqlite-path /tmp/bluekiwi-demo.sqlite
```

## 실패 시 우선 확인할 것

### runtime을 찾지 못하는 경우

우선순위:

1. CLI 패키지에 bundled runtime이 포함되어 있는지
2. source checkout fallback을 찾을 수 있는지
3. 명시적 env가 필요한지

예시:

```bash
BLUEKIWI_APP_ROOT=/absolute/path/to/bluekiwi bluekiwi start
```

또는

```bash
BLUEKIWI_APP_RUNTIME_PATH=/absolute/path/to/app-runtime bluekiwi start
```

### 포트 충돌

`start`는 free port를 찾으므로, 실제 포트는 항상 `bluekiwi status`로 확인한다.

### stale pid

`status` 또는 `stop`가 stale record를 자동 정리한다. 즉 pid file만 남은 상태는 수동 정리가 필요 없게 설계되어 있다.

## release gate 관점 최소 체크리스트

릴리스 전에 최소한 아래는 통과해야 한다.

1. `npm install -g bluekiwi` 성공
2. `bluekiwi start` 성공
3. `bluekiwi status`에서 `Local health: ok` 확인
4. 브라우저에서 `/login` 응답 확인
5. SQLite 파일 생성 확인
6. `bash tests/4/run-hitl-vs-ui-smoke.sh` 성공
7. `bash tests/4/run-admin-maintenance-sqlite-smoke.sh` 성공
8. `bash tests/4/run-packaged-cli-smoke.sh` 성공
9. `bluekiwi stop` 성공

## 관련 문서

- [quickstart-cli.md](/Users/dante/workspace/dante-code/projects/bluekiwi/docs/guides/quickstart-cli.md)
- [tests/4/run-hitl-vs-ui-smoke.sh](/Users/dante/workspace/dante-code/projects/bluekiwi/tests/4/run-hitl-vs-ui-smoke.sh)
- [tests/4/run-admin-maintenance-sqlite-smoke.sh](/Users/dante/workspace/dante-code/projects/bluekiwi/tests/4/run-admin-maintenance-sqlite-smoke.sh)
- [tests/4/run-packaged-cli-smoke.sh](/Users/dante/workspace/dante-code/projects/bluekiwi/tests/4/run-packaged-cli-smoke.sh)
- [quickstart-local-runtime.md](/Users/dante/workspace/dante-code/projects/bluekiwi/docs/spec/quickstart-local-runtime.md)
- [cli-quickstart-command-ux.md](/Users/dante/workspace/dante-code/projects/bluekiwi/docs/spec/cli-quickstart-command-ux.md)
