---
name: bk-status
description: BlueKiwi 태스크 상태 조회 스킬. 활성 태스크와 완료된 태스크의 진행 상황을 확인합니다. This skill should be used when the user says "/bk-status", "태스크 상태", "진행 상황", or wants to check BlueKiwi task status.
user_invocable: true
---

# BlueKiwi Task Status

활성 태스크와 완료된 태스크의 진행 상황을 조회하는 스킬.

## 실행 절차

### 1. 태스크 조회

`curl -s http://localhost:3000/api/tasks`로 태스크 목록을 조회한다.

### 2. 결과 표시

```
BlueKiwi 태스크 현황:
━━━━━━━━━━━━━━━━━━━━━━━━━
  #1  [완료] 기능 브레인스토밍     8/8 steps   2026-04-07
  #2  [실행중] PR 보안 리뷰       2/4 steps   2026-04-07  ← 활성
━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. 상세 조회

인자로 태스크 번호가 주어지면 (`/bk-status 2`) 해당 태스크의 스텝별 로그를 표시한다.

## 참고

- 웹 UI: http://localhost:3000/tasks
- 실시간 모니터링: WebSocket Relay (`npm run ws`) 실행 필요
