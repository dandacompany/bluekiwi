import Link from "next/link";

import { MessageSquare, Repeat, Zap } from "@/components/icons/lucide";

const S = {
  card: "py-10 border-b border-[var(--border)] last:border-b-0",
  heading: "text-2xl font-bold tracking-tight text-[var(--foreground)]",
  subheading: "text-lg font-semibold text-[var(--foreground)] mt-8 mb-3",
  muted: "text-sm text-[var(--muted)]",
  accent: "text-[var(--accent)]",
  code: "bg-[var(--accent-light)] text-[var(--accent)] px-1.5 py-0.5 rounded text-sm font-mono",
  codeBlock:
    "bg-[#1e1e1e] text-[#d4d4d4] rounded-[var(--radius)] p-4 text-sm font-mono overflow-x-auto leading-relaxed",
  badge:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
  table: "w-full text-sm border-collapse",
  th: "text-left px-4 py-2.5 border-b-2 border-[var(--border)] font-semibold text-[var(--foreground)]",
  td: "px-4 py-2.5 border-b border-[var(--border)]",
  li: "flex gap-3 items-start py-1",
} as const;

function Section({
  id,
  num,
  title,
  children,
}: {
  id: string;
  num: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`${S.card} scroll-mt-20`}>
      <div className="flex items-center gap-3 mb-5">
        <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-sm font-bold shrink-0">
          {num}
        </span>
        <h2 className={S.heading}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return <code className={S.code}>{children}</code>;
}

function CodeBlock({ children }: { children: string }) {
  return <pre className={S.codeBlock}>{children}</pre>;
}

function Badge({
  color,
  children,
}: {
  color: "blue" | "amber" | "purple" | "green" | "red" | "gray";
  children: React.ReactNode;
}) {
  const colors = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    purple:
      "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    green: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return <span className={`${S.badge} ${colors[color]}`}>{children}</span>;
}

export default function TutorialPage() {
  const navItems = [
    { id: "start", label: "시작하기" },
    { id: "instructions", label: "지침 만들기" },
    { id: "chains", label: "체인 만들기" },
    { id: "execute", label: "실행하기" },
    { id: "monitor", label: "모니터링" },
    { id: "architecture", label: "아키텍처" },
  ];

  return (
    <div className="min-h-screen bg-[var(--card)]">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 backdrop-blur bg-[var(--background)]/80 border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">
            OmegaRod
          </Link>
          <nav className="hidden md:flex gap-1">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="px-3 py-1.5 text-sm rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <Link
            href="/"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            &larr; 홈
          </Link>
        </div>
      </header>

      {/* 콘텐츠 */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <div className="px-8 md:px-12">
          {/* 히어로 */}
          <div className="pt-16 pb-10 text-center">
            <p className={`${S.muted} mb-2`}>Tutorial</p>
            <h1 className="text-4xl font-bold tracking-tight mb-3">
              OmegaRod 사용 가이드
            </h1>
            <p className="text-[var(--muted)] max-w-xl mx-auto leading-relaxed">
              에이전트 지침을 서버에 등록하고, Claude Code에서 체인 형태로
              단계별 실행하는 시스템입니다.
            </p>
          </div>
          {/* 1. 시작하기 */}
          <Section id="start" num={1} title="시작하기">
            <h3 className={S.subheading}>서버 실행</h3>
            <CodeBlock>{`# 터미널 1: 웹서버 (포트 3000)
npm run dev

# 터미널 2: WebSocket Relay (포트 3001, 실시간 모니터링용)
npm run ws`}</CodeBlock>

            <h3 className={S.subheading}>접속 URL</h3>
            <table className={S.table}>
              <thead>
                <tr>
                  <th className={S.th}>페이지</th>
                  <th className={S.th}>URL</th>
                  <th className={S.th}>설명</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["/instructions", "지침 관리", "재사용 지침 블록 CRUD"],
                  ["/chains", "체인 관리", "체인 편집기"],
                  ["/tasks", "태스크 모니터링", "실행 상태 실시간 확인"],
                  ["/docs", "API 문서", "Swagger UI"],
                ].map(([url, name, desc]) => (
                  <tr key={url}>
                    <td className={S.td}>
                      <Link href={url} className={S.accent}>
                        {name}
                      </Link>
                    </td>
                    <td className={S.td}>
                      <Code>{`localhost:3000${url}`}</Code>
                    </td>
                    <td className={`${S.td} ${S.muted}`}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className={S.subheading}>샘플 데이터</h3>
            <CodeBlock>{`bash scripts/seed.sh
# → 재사용 지침 5개 + 체인 3개 생성`}</CodeBlock>
          </Section>

          {/* 2. 지침 만들기 */}
          <Section id="instructions" num={2} title="지침 만들기">
            <p className="text-[var(--muted)] mb-4 leading-relaxed">
              지침(Instruction)은 에이전트에게 주는{" "}
              <strong>재사용 가능한 행동 블록</strong>입니다. 하나의 지침을 여러
              체인에서 참조할 수 있습니다.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="bg-[var(--accent-light)] rounded-[var(--radius)] p-4">
                <p className="font-semibold text-sm mb-2">좋은 지침</p>
                <p className="text-sm text-[var(--muted)]">
                  &quot;OWASP Top 10 기준으로 SQL Injection, XSS를 중점
                  검토하세요. 발견된 이슈를 severity별로 분류하여
                  보고하세요.&quot;
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded-[var(--radius)] p-4">
                <p className="font-semibold text-sm mb-2">나쁜 지침</p>
                <p className="text-sm text-[var(--muted)]">
                  &quot;코드를 검토하세요.&quot;
                </p>
              </div>
            </div>

            <h3 className={S.subheading}>지침 설계 팁</h3>
            <ul className="space-y-2">
              {[
                ["하나의 행동", '"분석하고 수정하세요"보다 별도 지침으로 분리'],
                ["구체적 기준", "어떤 기준으로, 무엇을 중점적으로 할지 명시"],
                ["출력 형식", "결과를 어떤 형태로 보고할지 지정"],
              ].map(([title, desc]) => (
                <li key={title} className={S.li}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-2 shrink-0" />
                  <span>
                    <strong>{title}</strong>{" "}
                    <span className="text-[var(--muted)]">— {desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <h3 className={S.subheading}>API 예시</h3>
            <CodeBlock>{`curl -X POST http://localhost:3000/api/instructions \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "보안 코드 리뷰",
    "content": "OWASP Top 10 기준으로 코드를 검토하세요...",
    "agent_type": "coding",
    "tags": ["보안", "리뷰"],
    "priority": 10
  }'`}</CodeBlock>
          </Section>

          {/* 3. 체인 만들기 */}
          <Section id="chains" num={3} title="체인 만들기">
            <p className="text-[var(--muted)] mb-4 leading-relaxed">
              체인(Chain)은 지침 노드를{" "}
              <strong>순서대로 연결한 워크플로</strong>입니다. 각 노드는 타입에
              따라 다르게 동작합니다.
            </p>

            <h3 className={S.subheading}>노드 타입</h3>
            <div className="grid md:grid-cols-3 gap-3 mb-6">
              {[
                {
                  type: "Action",
                  color: "blue" as const,
                  Icon: Zap,
                  desc: "지침을 자율적으로 수행하고 결과를 보고합니다.",
                  example: "프로젝트 구조를 분석하세요",
                },
                {
                  type: "Gate",
                  color: "amber" as const,
                  Icon: MessageSquare,
                  desc: "사용자에게 질문하고 답변을 기다립니다.",
                  example: "어떤 기능을 만들고 싶으신가요?",
                },
                {
                  type: "Loop",
                  color: "purple" as const,
                  Icon: Repeat,
                  desc: "조건이 충족될 때까지 반복 실행합니다.",
                  example: "추가 질문이 필요하면 계속 물어보세요",
                },
              ].map((node) => (
                <div
                  key={node.type}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge color={node.color}>
                      <node.Icon className="h-3.5 w-3.5" />
                    </Badge>
                    <span className="font-semibold text-sm">{node.type}</span>
                  </div>
                  <p className="text-sm text-[var(--muted)] mb-2">
                    {node.desc}
                  </p>
                  <p className="text-xs italic text-[var(--muted)]">
                    &quot;{node.example}&quot;
                  </p>
                </div>
              ))}
            </div>

            <h3 className={S.subheading}>체인 편집기 사용법</h3>
            <ol className="space-y-2">
              {[
                ["/chains", "체인 관리 페이지에서 ", "+ 새 체인", " 클릭"],
                ["", "체인 제목, 설명 입력"],
                ["", "+ 노드 추가 버튼으로 단계를 하나씩 추가"],
                [
                  "",
                  "각 노드: 제목 입력 → 타입 선택 → 직접 작성 또는 기존 지침 참조",
                ],
                ["", "위/아래 버튼으로 노드 순서 조정"],
                ["", "하단 파이프라인 미리보기 확인 후 생성"],
              ].map(([, text], i) => (
                <li key={i} className={S.li}>
                  <span className="w-5 h-5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm">{text}</span>
                </li>
              ))}
            </ol>

            <h3 className={S.subheading}>설계 패턴</h3>
            <div className="space-y-3">
              {[
                {
                  name: "수집 → 분석 → 보고",
                  flow: [
                    { type: "A", label: "데이터 수집" },
                    { type: "A", label: "분석" },
                    { type: "G", label: "결과 확인" },
                    { type: "A", label: "보고서" },
                  ],
                },
                {
                  name: "대화형 설계",
                  flow: [
                    { type: "G", label: "목표 확인" },
                    { type: "L", label: "요구사항 수집" },
                    { type: "A", label: "설계" },
                    { type: "G", label: "검토" },
                  ],
                },
                {
                  name: "자동 파이프라인",
                  flow: [
                    { type: "A", label: "빌드" },
                    { type: "A", label: "테스트" },
                    { type: "A", label: "보안 검토" },
                    { type: "A", label: "배포" },
                  ],
                },
              ].map((pattern) => (
                <div
                  key={pattern.name}
                  className="flex items-center gap-3 bg-[var(--background)] rounded-lg p-3"
                >
                  <span className="text-sm font-medium w-32 shrink-0">
                    {pattern.name}
                  </span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {pattern.flow.map((node, j) => {
                      const c =
                        node.type === "G"
                          ? ("amber" as const)
                          : node.type === "L"
                            ? ("purple" as const)
                            : ("blue" as const);
                      const Icon =
                        node.type === "G"
                          ? MessageSquare
                          : node.type === "L"
                            ? Repeat
                            : Zap;
                      return (
                        <div key={j} className="flex items-center gap-1">
                          <Badge color={c as "blue" | "amber" | "purple"}>
                            <Icon className="h-3.5 w-3.5" />
                            {node.label}
                          </Badge>
                          {j < pattern.flow.length - 1 && (
                            <span className="text-[var(--muted)] text-xs">
                              &rarr;
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 4. Claude Code에서 실행 */}
          <Section id="execute" num={4} title="Claude Code에서 실행하기">
            <p className="text-[var(--muted)] mb-4 leading-relaxed">
              OmegaRod 프로젝트 디렉토리에서 Claude Code 세션을 시작하면 MCP
              서버가 자동으로 로드됩니다.
            </p>

            <h3 className={S.subheading}>스킬로 실행</h3>
            <div className="bg-[#1e1e1e] rounded-[var(--radius)] p-5 text-sm font-mono space-y-4">
              <div>
                <span className="text-green-400">사용자:</span>{" "}
                <span className="text-[#d4d4d4]">/omegarod:start</span>
              </div>
              <div>
                <span className="text-blue-400">Claude:</span>{" "}
                <span className="text-[#d4d4d4]">
                  실행 가능한 체인 목록을 조회합니다...
                </span>
                <div className="mt-2 pl-4 text-[#999] space-y-1">
                  <div>
                    1. 기능 브레인스토밍 — 새 기능 아이디어를 탐색 (8단계)
                  </div>
                  <div>2. PR 보안 리뷰 — PR의 보안 취약점 검토 (4단계)</div>
                  <div>
                    3. 데이터 분석 파이프라인 — 데이터 수집/분석/시각화 (6단계)
                  </div>
                </div>
                <div className="mt-2 text-[#d4d4d4]">
                  어떤 체인을 실행하시겠습니까?
                </div>
              </div>
              <div>
                <span className="text-green-400">사용자:</span>{" "}
                <span className="text-[#d4d4d4]">1</span>
              </div>
              <div>
                <span className="text-blue-400">Claude:</span>{" "}
                <span className="text-[#d4d4d4]">
                  체인 &quot;기능 브레인스토밍&quot; 실행을 시작합니다. (Task
                  #1)
                </span>
                <div className="mt-1 text-[#999]">
                  Step 1/8: 프로젝트 컨텍스트 파악 ...
                </div>
              </div>
            </div>

            <h3 className={S.subheading}>MCP 도구 목록</h3>
            <table className={S.table}>
              <thead>
                <tr>
                  <th className={S.th}>도구</th>
                  <th className={S.th}>설명</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["list_chains", "실행 가능한 체인 목록 조회"],
                  [
                    "start_chain",
                    "체인 실행 시작 (태스크 생성 + 첫 노드 반환)",
                  ],
                  ["report_step", "현재 스텝 결과 저장"],
                  ["get_next_step", "다음 스텝 지침 요청"],
                  ["heartbeat", "중간 진행 상황 업데이트"],
                  ["complete_task", "태스크 최종 완료 처리"],
                ].map(([tool, desc]) => (
                  <tr key={tool}>
                    <td className={S.td}>
                      <Code>{tool}</Code>
                    </td>
                    <td className={`${S.td} text-[var(--muted)]`}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* 5. 태스크 모니터링 */}
          <Section id="monitor" num={5} title="태스크 모니터링">
            <p className="text-[var(--muted)] mb-4 leading-relaxed">
              Claude Code가 체인을 실행하는 동안 브라우저에서
              <strong> 실시간으로</strong> 진행 상황을 확인할 수 있습니다.
              WebSocket으로 즉시 업데이트됩니다.
            </p>

            <div className="grid md:grid-cols-3 gap-3 mb-4">
              {[
                {
                  step: "1",
                  title: "WS Relay 실행",
                  desc: "npm run ws (포트 3001)",
                },
                {
                  step: "2",
                  title: "태스크 페이지 열기",
                  desc: "localhost:3000/tasks",
                },
                {
                  step: "3",
                  title: "체인 실행",
                  desc: "프로그레스 바가 실시간 업데이트",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="bg-[var(--accent-light)] rounded-[var(--radius)] p-4 text-center"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-sm font-bold mx-auto mb-2">
                    {item.step}
                  </div>
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            <h3 className={S.subheading}>데이터 흐름</h3>
            <CodeBlock>{`Claude Code ──MCP──> MCP Server ──DB write──> SQLite
                        │
                        └──notify──> WS Relay (3001) ──push──> Browser`}</CodeBlock>
          </Section>

          {/* 6. 아키텍처 */}
          <Section id="architecture" num={6} title="아키텍처">
            <h3 className={S.subheading}>데이터 모델</h3>
            <div className="grid md:grid-cols-2 gap-3 mb-6">
              {[
                {
                  name: "instructions",
                  desc: "재사용 지침 블록",
                  fields: "title, content, agent_type, tags, priority",
                },
                {
                  name: "chains",
                  desc: "워크플로 정의",
                  fields: "title, description",
                },
                {
                  name: "chain_nodes",
                  desc: "체인 내 노드",
                  fields:
                    "chain_id, instruction_id, step_order, node_type, loop_back_to",
                },
                {
                  name: "tasks",
                  desc: "실행 인스턴스",
                  fields: "chain_id, status, current_step",
                },
                {
                  name: "task_logs",
                  desc: "스텝별 실행 기록",
                  fields: "task_id, node_id, status, output",
                },
              ].map((model) => (
                <div
                  key={model.name}
                  className="border border-[var(--border)] rounded-[var(--radius)] p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Code>{model.name}</Code>
                    <span className="text-xs text-[var(--muted)]">
                      {model.desc}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[var(--muted)]">
                    {model.fields}
                  </p>
                </div>
              ))}
            </div>

            <h3 className={S.subheading}>파일 구조</h3>
            <CodeBlock>{`OmegaRod/
├── .mcp.json                 # Claude Code MCP 등록
├── .claude/skills/start.md   # /omegarod:start 스킬
├── mcp/src/server.ts         # MCP 서버 (6개 도구 + WS notify)
├── scripts/
│   ├── seed.sh               # 더미 데이터 시드
│   └── ws-relay.ts           # WebSocket Relay 서버
├── src/
│   ├── lib/                  # DB, OpenAPI, WS 훅
│   └── app/
│       ├── api/              # REST API
│       ├── instructions/     # 지침 관리 UI
│       ├── chains/           # 체인 편집기 UI
│       ├── tasks/            # 태스크 모니터링 UI
│       ├── tutorial/         # 이 페이지
│       └── docs/             # Swagger UI
└── data/omega-rod.db         # SQLite (gitignore)`}</CodeBlock>
          </Section>
        </div>
      </div>
    </div>
  );
}
