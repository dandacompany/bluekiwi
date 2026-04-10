"use client";

import Link from "next/link";
import { MessageSquare, Repeat, Zap } from "lucide-react";

const S = {
  card: "border-b border-border py-10 last:border-b-0",
  heading: "text-2xl font-bold tracking-tight",
  subheading: "mb-3 mt-8 text-lg font-semibold",
  muted: "text-sm text-muted-foreground",
  accent: "text-brand-blue-600",
  code: "rounded bg-brand-blue-100 px-1.5 py-0.5 font-mono text-sm text-brand-blue-700",
  panel:
    "rounded-[1.5rem] border border-border/80 bg-background/80 p-5 shadow-[var(--shadow-soft)]",
  table: "w-full border-collapse text-sm",
  th: "border-b-2 border-border px-4 py-2.5 text-left font-semibold",
  td: "border-b border-border px-4 py-2.5",
  li: "flex items-start gap-3 py-1.5",
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
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue-600 text-sm font-bold text-white">
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

function TypeBadge({
  color,
  children,
}: {
  color: "blue" | "kiwi" | "neutral";
  children: React.ReactNode;
}) {
  const colors = {
    blue: "bg-brand-blue-100 text-brand-blue-700",
    kiwi: "bg-kiwi-100 text-kiwi-700",
    neutral: "bg-surface-soft text-ink-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[color]}`}
    >
      {children}
    </span>
  );
}

export default function TutorialPage() {
  const navItems = [
    { id: "start", label: "시작하기" },
    { id: "instructions", label: "지침 만들기" },
    { id: "workflows", label: "워크플로 만들기" },
    { id: "execute", label: "실행하기" },
    { id: "monitor", label: "태스크 확인" },
    { id: "example", label: "실전 예시" },
    { id: "mcp-loop", label: "MCP 자동화" },
    { id: "tips", label: "운영 팁" },
  ];

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="whitespace-nowrap rounded-xl px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-brand-blue-100 hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-20">
        <div className="px-8 md:px-12">
          <div className="pb-10 pt-16 text-center">
            <p className={`${S.muted} mb-2`}>
              Claude, Codex 등 AI 코딩 도구 사용자 매뉴얼
            </p>
            <h1 className="mb-3 text-4xl font-bold tracking-tight">
              작업 흐름을 만드는 가장 짧은 경로
            </h1>
            <p className="mx-auto max-w-2xl leading-relaxed text-muted-foreground">
              BlueKiwi에서{" "}
              <strong>지침 작성, 워크플로 조립, 실행, 결과 확인</strong>
              까지 실제 사용 흐름을 빠르게 익힐 수 있도록 구성한 안내서입니다.
            </p>
          </div>

          <Section id="start" num={1} title="시작하기">
            <p className="mb-4 leading-relaxed text-muted-foreground">
              BlueKiwi의 기본 흐름은 단순합니다. 먼저 지침을 만들고, 그 지침들을
              워크플로에 배치한 뒤, 실행 결과를 태스크 화면에서 확인합니다.
            </p>

            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <div className={S.panel}>
                <p className="text-sm font-semibold">주요 화면</p>
                <table className={`${S.table} mt-3`}>
                  <tbody>
                    {[
                      ["/instructions", "지침을 작성하고 관리합니다."],
                      ["/workflows", "실행 순서를 설계합니다."],
                      ["/tasks", "실행 결과와 상태를 확인합니다."],
                      ["/credentials", "외부 서비스 접근 정보를 관리합니다."],
                    ].map(([url, desc]) => (
                      <tr key={url}>
                        <td className={S.td}>
                          <Link href={url} className={S.accent}>
                            {url}
                          </Link>
                        </td>
                        <td className={`${S.td} ${S.muted}`}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={S.panel}>
                <p className="text-sm font-semibold">권장 사용 순서</p>
                <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>1. 지침에서 작업 단위를 먼저 정의합니다.</li>
                  <li>2. 워크플로에서 실행 순서를 조립합니다.</li>
                  <li>3. 필요하면 크리덴셜을 연결합니다.</li>
                  <li>4. 실행 후 태스크에서 진행 상황과 결과를 확인합니다.</li>
                </ol>
              </div>
            </div>

            <h3 className={S.subheading}>어떤 일을 BlueKiwi에 맡기면 좋은가</h3>
            <ul className="space-y-2">
              {[
                "반복적으로 같은 점검 절차를 수행해야 하는 일",
                "사람의 승인이나 응답이 중간에 필요한 다단계 작업",
                "실행 과정과 결과를 나중에 다시 추적해야 하는 작업",
              ].map((text) => (
                <li key={text} className={S.li}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue-600" />
                  <span className="text-sm">{text}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="instructions" num={2} title="지침 만들기">
            <p className="mb-4 leading-relaxed text-muted-foreground">
              지침은 워크플로의 최소 단위입니다. 한 지침에는 하나의 목적과
              하나의 기대 결과만 담는 편이 좋습니다.
            </p>

            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-brand-blue-100 p-4">
                <p className="mb-2 text-sm font-semibold">좋은 지침 예시</p>
                <p className="text-sm text-muted-foreground">
                  크리덴셜 카드 목록을 점검하고, 서비스명 중복 여부와 빈 설명이
                  있는 항목을 표로 정리합니다.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="mb-2 text-sm font-semibold">피해야 할 지침</p>
                <p className="text-sm text-muted-foreground">
                  전체 시스템을 알아서 검토하고 필요한 모든 걸 수정합니다.
                </p>
              </div>
            </div>

            <h3 className={S.subheading}>지침을 잘 쓰는 기준</h3>
            <ul className="space-y-2">
              {[
                "무엇을 판단해야 하는지보다 무엇을 산출해야 하는지를 먼저 씁니다.",
                "모호한 표현 대신 체크 기준을 적습니다. 예: 보기 좋게가 아니라 중복 서비스명 없음.",
                "결과 형식을 지정합니다. 예: bullet list, 표, 요약 문단, 파일 경로.",
              ].map((text) => (
                <li key={text} className={S.li}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue-600" />
                  <span className="text-sm">{text}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="workflows" num={3} title="워크플로 만들기">
            <p className="mb-4 leading-relaxed text-muted-foreground">
              워크플로는 지침을 순서대로 연결한 실행 설계도입니다. 노드 수를
              늘리기보다, 승인 지점과 반복 지점을 어디 둘지 결정하는 것이 더
              중요합니다.
            </p>

            <h3 className={S.subheading}>노드 유형 이해하기</h3>
            <div className="mb-6 grid gap-3 md:grid-cols-3">
              {[
                {
                  type: "Action",
                  color: "blue" as const,
                  Icon: Zap,
                  desc: "자동으로 바로 수행되는 일반 실행 단계입니다.",
                },
                {
                  type: "Gate",
                  color: "kiwi" as const,
                  Icon: MessageSquare,
                  desc: "사용자 확인이나 응답이 필요한 승인 단계입니다.",
                },
                {
                  type: "Loop",
                  color: "neutral" as const,
                  Icon: Repeat,
                  desc: "조건이 만족될 때까지 반복 점검하는 단계입니다.",
                },
              ].map((node) => (
                <div key={node.type} className={S.panel}>
                  <div className="mb-2 flex items-center gap-2">
                    <TypeBadge color={node.color}>
                      <node.Icon className="h-3.5 w-3.5" />
                      {node.type}
                    </TypeBadge>
                  </div>
                  <p className="text-sm text-muted-foreground">{node.desc}</p>
                </div>
              ))}
            </div>

            <h3 className={S.subheading}>처음 만드는 사람에게 권장하는 구조</h3>
            <div className={S.panel}>
              <ol className="space-y-3 text-sm">
                <li>1. Action: 현재 상태를 수집합니다.</li>
                <li>2. Action: 문제나 개선 포인트를 정리합니다.</li>
                <li>3. Gate: 사용자가 방향을 확정합니다.</li>
                <li>4. Action: 확정된 방향으로 결과물을 만듭니다.</li>
              </ol>
            </div>
          </Section>

          <Section id="execute" num={4} title="실행하기">
            <p className="mb-4 leading-relaxed text-muted-foreground">
              워크플로 상세에서 실행을 시작하면 태스크가 생성됩니다. 이후 흐름은
              워크플로 구조에 따라 자동으로 진행되거나, 중간에 사용자의 응답을
              기다립니다.
            </p>

            <h3 className={S.subheading}>실행 전에 확인할 것</h3>
            <ul className="space-y-2">
              {[
                "크리덴셜이 필요한 단계라면 연결 여부를 먼저 확인합니다.",
                "반복 단계가 있다면 종료 조건이 분명한지 확인합니다.",
                "승인 단계가 있다면 누가 응답할지 운영 방식을 정해둡니다.",
              ].map((text) => (
                <li key={text} className={S.li}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue-600" />
                  <span className="text-sm">{text}</span>
                </li>
              ))}
            </ul>

            <h3 className={S.subheading}>실행 중 자주 보는 상태</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["실행 중", "현재 단계가 진행 중이며 새 로그가 계속 쌓입니다."],
                ["대기", "사용자 응답 또는 외부 조건을 기다리는 상태입니다."],
                [
                  "실패",
                  "중단 원인을 확인하고 필요하면 다시 실행하거나 되감습니다.",
                ],
              ].map(([title, desc]) => (
                <div key={title} className={S.panel}>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="monitor" num={5} title="태스크 확인">
            <p className="mb-4 leading-relaxed text-muted-foreground">
              태스크 페이지에서는 목록과 상세 두 화면을 오가며 상태를 봅니다.
              목록은 현재 상황을 훑는 용도이고, 상세는 한 실행 건을 깊게 보는
              용도입니다.
            </p>

            <h3 className={S.subheading}>목록 화면에서 보는 것</h3>
            <ul className="space-y-2">
              {[
                "어떤 워크플로에서 생성된 태스크인지",
                "현재 상태와 진행률이 어느 정도인지",
                "가장 최근 단계에서 어떤 결과가 나왔는지",
              ].map((text) => (
                <li key={text} className={S.li}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue-600" />
                  <span className="text-sm">{text}</span>
                </li>
              ))}
            </ul>

            <h3 className={S.subheading}>상세 화면에서 보는 것</h3>
            <ul className="space-y-2">
              {[
                "왼쪽 타임라인: 어느 단계까지 완료됐는지",
                "오른쪽 결과 패널: 실제 산출물, 구조화 출력, 코멘트",
                "반복 단계인 경우: 이전 반복과 최신 반복의 차이",
              ].map((text) => (
                <li key={text} className={S.li}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue-600" />
                  <span className="text-sm">{text}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="example" num={6} title="실전 예시">
            <p className="mb-4 leading-relaxed text-muted-foreground">
              처음 써보는 사용자라면 추상적인 설명보다 실제 한 번의 운영 흐름을
              따라가 보는 편이 훨씬 쉽습니다. 아래는
              <strong> UI 점검 워크플로</strong>를 만드는 가장 현실적인
              예시입니다.
            </p>

            <h3 className={S.subheading}>
              직접 해보기: 크리덴셜 카드 점검 워크플로
            </h3>
            <div className="space-y-4">
              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  Step 1. 지침 3개를 만듭니다
                </p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>
                    1.{" "}
                    <Code>
                      현재 크리덴셜 카드 UI를 점검하고 문제를 목록화한다
                    </Code>
                  </p>
                  <p>
                    2.{" "}
                    <Code>
                      문제를 중요도 순으로 정리하고 수정 우선순위를 제안한다
                    </Code>
                  </p>
                  <p>
                    3. <Code>수정 후 다시 점검하고 남은 이슈를 요약한다</Code>
                  </p>
                </div>
              </div>

              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  Step 2. 워크플로를 조립합니다
                </p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>1. Action: 현재 상태 점검</p>
                  <p>2. Gate: 이 중 무엇을 먼저 고칠지 사용자 확인</p>
                  <p>3. Action: 선택된 방향으로 수정안 정리</p>
                  <p>4. Loop: 수정 후 다시 점검하고 종료 여부 결정</p>
                </div>
              </div>

              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  Step 3. 실행 시 이렇게 적습니다
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  태스크 컨텍스트에는 이렇게 구체적으로 적는 편이 좋습니다.
                </p>
                <div className="mt-3 rounded-2xl border border-border bg-surface-soft/50 p-4 text-sm">
                  크리덴셜 페이지의 카드 UI를 점검합니다. 서비스명 중복 표시,
                  액션 메뉴 위치, 설명 텍스트 밀도, 편집 진입 방식 중심으로 보고
                  수정 우선순위를 정리합니다.
                </div>
              </div>

              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  Step 4. 실행 후 태스크에서 확인할 것
                </p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>
                    1. 목록에서 어떤 워크플로가 어떤 상태인지 빠르게 확인합니다.
                  </p>
                  <p>2. 상세에서 각 단계 결과와 코멘트를 읽습니다.</p>
                  <p>3. Gate 단계가 나오면 바로 응답해서 흐름을 이어갑니다.</p>
                  <p>4. 결과가 마음에 들지 않으면 rewind 후 다시 진행합니다.</p>
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="mcp-loop"
            num={7}
            title="MCP로 자동 생성하고 자기개선하기"
          >
            <p className="mb-4 leading-relaxed text-muted-foreground">
              BlueKiwi는 사람이 직접 지침과 워크플로를 만드는 데서 끝나지
              않습니다. MCP를 이용하면 지침과 워크플로 자체를 자동으로 만들거나
              갱신하는 흐름도 설계할 수 있습니다.
            </p>

            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div className={S.panel}>
                <p className="text-sm font-semibold">자동 생성에 적합한 경우</p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>1. 비슷한 유형의 워크플로를 계속 새로 만들어야 할 때</p>
                  <p>2. 리뷰 결과를 기반으로 지침 문구를 반복 개선할 때</p>
                  <p>3. 특정 도메인용 템플릿 워크플로를 여러 개 파생할 때</p>
                </div>
              </div>

              <div className={S.panel}>
                <p className="text-sm font-semibold">기대할 수 있는 효과</p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>1. 사람이 초안을 쓰는 시간을 줄일 수 있습니다.</p>
                  <p>
                    2. 잘 동작한 패턴을 다음 워크플로에 재사용할 수 있습니다.
                  </p>
                  <p>
                    3. 실패 원인을 반영하며 점진적으로 품질을 높일 수 있습니다.
                  </p>
                </div>
              </div>
            </div>

            <h3 className={S.subheading}>점진적 자기개선 루프 예시</h3>
            <div className={S.panel}>
              <ol className="space-y-3 text-sm">
                <li>1. 현재 워크플로를 실행하고 태스크 로그를 수집합니다.</li>
                <li>
                  2. 어떤 단계에서 자주 막히는지, 어떤 응답이 반복되는지
                  분석합니다.
                </li>
                <li>
                  3. MCP로 지침 문구나 단계 순서를 수정한 새 버전을 만듭니다.
                </li>
                <li>4. 새 버전을 다시 실행해 이전 결과와 비교합니다.</li>
                <li>5. 더 나아진 패턴만 남기고 다음 루프에 반영합니다.</li>
              </ol>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              핵심은 처음부터 완벽한 워크플로를 만들려 하지 않는 것입니다.
              BlueKiwi에서는 사람이 직접 만든 초안을 시작점으로 삼고, MCP 기반
              자동 생성과 재조합을 통해 조금씩 더 나은 흐름으로 키워갈 수
              있습니다.
            </p>
          </Section>

          <Section id="tips" num={8} title="운영 팁">
            <div className="grid gap-4 md:grid-cols-2">
              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  처음에는 짧게 시작합니다
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  3~4단계 안에서 끝나는 짧은 워크플로를 먼저 성공시킨 뒤 점점
                  승인 단계나 반복 단계를 추가하는 편이 안정적입니다.
                </p>
              </div>
              <div className={S.panel}>
                <p className="text-sm font-semibold">결과 형식을 통일합니다</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  같은 유형의 지침은 항상 같은 형식으로 결과를 쓰게 하면, 나중에
                  태스크 로그를 읽고 비교하기가 훨씬 쉬워집니다.
                </p>
              </div>
              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  Gate는 꼭 필요한 곳에만 둡니다
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  사용자의 응답이 정말 의사결정에 필요한 단계가 아니라면
                  Action으로 끝내는 편이 실행 속도와 사용성이 좋습니다.
                </p>
              </div>
              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  이름을 구체적으로 짓습니다
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  워크플로 제목, 지침 제목, 태스크 컨텍스트가 구체적일수록
                  목록과 상세 breadcrumb에서 바로 맥락을 읽을 수 있습니다.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-brand-blue-200 bg-brand-blue-100/60 p-5">
              <p className="text-sm font-semibold">바로 시작하려면</p>
              <p className="mt-2 text-sm text-muted-foreground">
                먼저{" "}
                <Link href="/instructions" className={S.accent}>
                  지침
                </Link>
                에서 작업 단위를 만들고, 그다음{" "}
                <Link href="/workflows" className={S.accent}>
                  워크플로
                </Link>
                에서 순서를 조립해 보세요. 실행 결과는{" "}
                <Link href="/tasks" className={S.accent}>
                  태스크
                </Link>
                에서 바로 확인할 수 있습니다.
              </p>
              <p className="mt-4 text-sm">
                추천 첫 목표: <Code>UI 점검 워크플로</Code> 또는{" "}
                <Code>문서 검토 워크플로</Code>
              </p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
