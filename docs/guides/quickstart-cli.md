# BlueKiwi Quick Start CLI Guide

## 목적

BlueKiwi Quick Start는 Docker, PostgreSQL, Redis 없이 로컬 머신에서 바로 BlueKiwi 앱을 띄우는 실행 모드다.

현재 안정성 수준은 `Beta`다.

이 모드에서는 다음을 전제로 한다.

- 앱은 로컬 프로세스로 실행된다.
- 데이터베이스는 SQLite 파일 하나로 운영된다.
- 런타임 lifecycle은 `bluekiwi` CLI가 관리한다.
- 기본 대상은 단일 사용자 또는 소규모 로컬 사용이다.

## 현재 상태

현재 Quick Start 경로는 다음 두 가지 runtime source를 지원한다.

1. bundled runtime
2. source checkout

CLI는 아래 우선순위로 앱 runtime을 찾는다.

1. `BLUEKIWI_APP_ROOT`
2. `BLUEKIWI_APP_RUNTIME_PATH`
3. CLI 패키지에 포함된 bundled runtime
4. 현재 작업 디렉터리 기준으로 찾은 BlueKiwi source checkout

즉, 글로벌 설치만으로 완전히 독립 실행하려면 CLI 패키지 안에 standalone app runtime이 포함되어 있어야 한다. 개발 중에는 source checkout 기반 실행도 허용된다.

현재 기준으로는 다음 범위를 `Beta`로 본다.

- SQLite 기반 local runtime
- packaged CLI + bundled runtime
- core CRUD / task execution / HITL / visual selection
- admin-maintenance smoke 범위

다만 다음은 아직 `full parity` 범위로 보지 않는다.

- hosted/server 운영 환경과의 완전 동일성
- 장시간 soak test
- 모든 비핵심 endpoint 전수 검증
- 운영 환경 성능 특성 동일성

## 설치

### 글로벌 설치

```bash
npm install -g bluekiwi
```

### 개발 중 로컬 체크아웃에서 CLI 사용

프로젝트 루트에서:

```bash
npm install
npm run build:cli
```

이 경로는 다음을 수행한다.

1. Next app standalone build 생성
2. CLI build 수행
3. standalone runtime asset을 CLI dist 아래에 포함

## 가장 기본적인 시작 방법

```bash
bluekiwi start
```

기본 동작:

- profile: `default`
- host: `127.0.0.1`
- 시작 포트 후보: `3102`
- 포트 충돌 시 자동 증가
- SQLite 파일 자동 생성
- 첫 DB 접근 시 SQLite migration 자동 실행

성공 시 기대되는 정보:

- 실행 URL
- PID
- profile 이름
- runtime source 종류
- SQLite 파일 경로

## 주요 명령

### 시작

```bash
bluekiwi start
```

### 상태 확인

```bash
bluekiwi status
```

출력 개념:

- local runtime 실행 여부
- PID
- host / port
- runtime source
- sqlite path
- 기존 서버 연결 profile 정보

### 중지

```bash
bluekiwi stop
```

### 재시작

```bash
bluekiwi restart
```

## 주요 옵션

### 포트 지정

```bash
bluekiwi start --port 3200
```

지정한 포트가 이미 사용 중이면 CLI는 다음 사용 가능한 포트로 증가시켜 실행할 수 있다.

### 호스트 지정

```bash
bluekiwi start --host 0.0.0.0
```

### 프로필 분리

```bash
bluekiwi start --profile demo
bluekiwi status --profile demo
bluekiwi stop --profile demo
```

프로필별로 데이터 디렉터리와 PID 메타데이터가 분리된다.

### 데이터 디렉터리 지정

```bash
bluekiwi start --data-dir /path/to/bluekiwi-data
```

### SQLite 파일 위치 지정

```bash
bluekiwi start --sqlite-path /path/to/bluekiwi.sqlite
```

## 데이터 디렉터리 구조

기본 profile `default` 기준:

```text
~/.bluekiwi/quickstart/default/
├── config/
├── data/
│   └── bluekiwi.sqlite
├── logs/
└── run/
    └── app.json
```

핵심 파일:

- SQLite DB: `~/.bluekiwi/quickstart/default/data/bluekiwi.sqlite`
- runtime metadata: `~/.bluekiwi/quickstart/default/run/app.json`

## SQLite bootstrap 방식

Quick Start에서는 `DB_TYPE=sqlite`가 사용된다.

앱이 처음 DB에 접근하면 다음이 자동 수행된다.

1. SQLite 파일 경로 확인
2. 필요한 디렉터리 생성
3. SQLite schema migration 실행
4. 이후 일반 앱 흐름 진행

즉, 별도로 `migrate` 명령을 먼저 수동 실행할 필요는 없다.

## source checkout 기반 실행

bundled runtime이 없고 현재 소스 체크아웃이 있으면 CLI는 source runtime으로 실행할 수 있다.

대표적으로 다음 환경이 해당된다.

- BlueKiwi repo에서 개발 중인 경우
- 글로벌 설치 없이 workspace에서 CLI를 실행하는 경우
- bundled standalone artifact를 아직 publish하지 않은 경우

이 경우 내부적으로는 Next app 개발 실행 경로를 사용한다.

## bundled runtime 기반 실행

CLI 패키지 안에 standalone runtime asset이 포함되어 있으면 Quick Start는 source checkout 없이도 실행될 수 있다.

필요 asset 구조:

```text
packages/cli/dist/assets/app-runtime/
├── server.js
├── .next/static/
└── public/
```

이 구조는 `npm run build:cli` 경로에서 생성되도록 맞춰져 있다.

## 추천 사용 시나리오

### 1. 로컬에서 바로 써보기

```bash
npm install -g bluekiwi
bluekiwi start
```

### 2. 프로젝트 소스에서 개발하며 Quick Start 확인

```bash
npm install
npm run build:cli
node packages/cli/dist/index.js start
```

### 3. 별도 프로필로 데모 환경 분리

```bash
bluekiwi start --profile demo --port 3300
```

## 현재 범위와 제한

Quick Start v1은 전체 hosted/server 배포와 완전한 parity를 목표로 하지 않는다.

현재 가정:

- SQLite 기반 로컬 사용
- 단일 머신 실행
- 단일 사용자 또는 소규모 사용
- 분산 Redis 기반 realtime 동작은 대상 아님

## 권장 smoke flow

릴리스 전 최소 확인은 두 단계로 나눈다.

### 1. runtime smoke

```bash
bluekiwi start
bluekiwi status
bluekiwi stop
```

이 단계는 packaged runtime, SQLite bootstrap, lifecycle command, health check를 확인한다.

### 2. interactive UI smoke

```bash
bash tests/4/run-hitl-vs-ui-smoke.sh
```

이 단계는 다음을 확인한다.

- 로그인
- workflow 생성
- visual selection submit
- task response persistence
- HITL approval UI

관련 상세 절차:

- [quickstart-global-smoke-flow.md](/Users/dante/workspace/dante-code/projects/bluekiwi/docs/guides/quickstart-global-smoke-flow.md)
- [run-hitl-vs-ui-smoke.sh](/Users/dante/workspace/dante-code/projects/bluekiwi/tests/4/run-hitl-vs-ui-smoke.sh)
- 운영 서버 수준의 동시성/확장성은 대상 아님

즉, Quick Start는 다음 목적에 맞는다.

- 로컬 authoring
- 로컬 workflow 실행
- 기능 체험
- 소규모 테스트

## 문제 해결

### 앱 runtime을 찾지 못하는 경우

우선 아래를 확인한다.

1. bundled runtime이 CLI 패키지에 포함되어 있는지
2. 현재 작업 디렉터리에서 BlueKiwi source checkout을 찾을 수 있는지
3. 필요하면 명시적으로 경로를 지정했는지

예시:

```bash
BLUEKIWI_APP_ROOT=/absolute/path/to/bluekiwi bluekiwi start
```

또는

```bash
BLUEKIWI_APP_RUNTIME_PATH=/absolute/path/to/app-runtime bluekiwi start
```

### 포트가 이미 사용 중인 경우

CLI는 기본적으로 free port를 찾아 증가시켜 실행한다. 정확한 포트를 확인하려면:

```bash
bluekiwi status
```

### SQLite 파일 위치를 명시적으로 고정하고 싶은 경우

```bash
bluekiwi start --sqlite-path /absolute/path/to/bluekiwi.sqlite
```

## 구현/운영 관점 참고

관련 설계 문서:

- [quickstart-local-runtime.md](/Users/dante/workspace/dante-code/projects/bluekiwi/docs/spec/quickstart-local-runtime.md)
- [runtime-packaging-decision.md](/Users/dante/workspace/dante-code/projects/bluekiwi/docs/spec/runtime-packaging-decision.md)
- [quickstart-config-schema.md](/Users/dante/workspace/dante-code/projects/bluekiwi/docs/spec/quickstart-config-schema.md)
- [cli-quickstart-command-ux.md](/Users/dante/workspace/dante-code/projects/bluekiwi/docs/spec/cli-quickstart-command-ux.md)
- [quickstart-v1-feature-matrix.md](/Users/dante/workspace/dante-code/projects/bluekiwi/docs/spec/quickstart-v1-feature-matrix.md)

## 다음 권장 작업

1. publish/release 경로에서 `npm run build:cli`를 표준 경로로 고정
2. bundled runtime을 포함한 실제 글로벌 설치 smoke flow 정리
3. Quick Start 전용 health check와 stale-pid 정리를 더 강화
