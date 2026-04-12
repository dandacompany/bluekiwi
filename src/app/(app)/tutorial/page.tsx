"use client";

import Link from "next/link";
import {
  FolderOpen,
  Lock,
  MessageSquare,
  Repeat,
  Shield,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

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

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((text) => (
        <li key={text} className={S.li}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue-600" />
          <span className="text-sm">{text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TutorialPage() {
  const { t } = useTranslation();

  const navItems = [
    { id: "start", label: t("tutorial.navStart") },
    { id: "instructions", label: t("tutorial.navInstructions") },
    { id: "workflows", label: t("tutorial.navWorkflows") },
    { id: "execute", label: t("tutorial.navExecute") },
    { id: "monitor", label: t("tutorial.navMonitor") },
    { id: "example", label: t("tutorial.navExample") },
    { id: "mcp-loop", label: t("tutorial.navMcpLoop") },
    { id: "tips", label: t("tutorial.navTips") },
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
            <p className={`${S.muted} mb-2`}>{t("tutorial.heroEyebrow")}</p>
            <h1 className="mb-3 text-4xl font-bold tracking-tight">
              {t("tutorial.heroTitle")}
            </h1>
            <p className="mx-auto max-w-2xl leading-relaxed text-muted-foreground">
              {t("tutorial.heroDesc")}
            </p>
          </div>

          {/* Section 1: Getting Started */}
          <Section id="start" num={1} title={t("tutorial.navStart")}>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              {t("tutorial.s1Intro")}
            </p>

            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  {t("tutorial.s1Screens")}
                </p>
                <table className={`${S.table} mt-3`}>
                  <tbody>
                    {(
                      [
                        ["/instructions", t("tutorial.s1InstructionsDesc")],
                        ["/workflows", t("tutorial.s1WorkflowsDesc")],
                        ["/tasks", t("tutorial.s1TasksDesc")],
                        ["/credentials", t("tutorial.s1CredentialsDesc")],
                      ] as const
                    ).map(([url, desc]) => (
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
                <p className="text-sm font-semibold">{t("tutorial.s1Order")}</p>
                <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>{t("tutorial.s1Order1")}</li>
                  <li>{t("tutorial.s1Order2")}</li>
                  <li>{t("tutorial.s1Order3")}</li>
                  <li>{t("tutorial.s1Order4")}</li>
                </ol>
              </div>
            </div>

            <h3 className={S.subheading}>{t("tutorial.s1WhenToUse")}</h3>
            <BulletList
              items={[
                t("tutorial.s1Use1"),
                t("tutorial.s1Use2"),
                t("tutorial.s1Use3"),
              ]}
            />

            <h3 className={S.subheading}>{t("tutorial.s1FoldersTitle")}</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {t("tutorial.s1FoldersDesc")}
            </p>
            <div className="mb-3 grid gap-2 md:grid-cols-2">
              {(
                [
                  {
                    Icon: Lock,
                    text: t("tutorial.s1VisPersonal"),
                  },
                  {
                    Icon: Users,
                    text: t("tutorial.s1VisGroup"),
                  },
                  {
                    Icon: Shield,
                    text: t("tutorial.s1VisPublic"),
                  },
                  {
                    Icon: FolderOpen,
                    text: t("tutorial.s1VisInherit"),
                  },
                ] as const
              ).map((item) => (
                <div
                  key={item.text}
                  className="flex items-start gap-2.5 rounded-xl border border-border/60 px-3.5 py-2.5"
                >
                  <item.Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("tutorial.s1VisTip")}
            </p>
          </Section>

          {/* Section 2: Create Instructions */}
          <Section
            id="instructions"
            num={2}
            title={t("tutorial.navInstructions")}
          >
            <p className="mb-4 leading-relaxed text-muted-foreground">
              {t("tutorial.s2Intro")}
            </p>

            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-brand-blue-100 p-4">
                <p className="mb-2 text-sm font-semibold">
                  {t("tutorial.s2Good")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("tutorial.s2GoodText")}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="mb-2 text-sm font-semibold">
                  {t("tutorial.s2Bad")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("tutorial.s2BadText")}
                </p>
              </div>
            </div>

            <h3 className={S.subheading}>{t("tutorial.s2Tips")}</h3>
            <BulletList
              items={[
                t("tutorial.s2Tip1"),
                t("tutorial.s2Tip2"),
                t("tutorial.s2Tip3"),
              ]}
            />
          </Section>

          {/* Section 3: Create Workflows */}
          <Section id="workflows" num={3} title={t("tutorial.navWorkflows")}>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              {t("tutorial.s3Intro")}
            </p>

            <h3 className={S.subheading}>{t("tutorial.s3NodeTypes")}</h3>
            <div className="mb-6 grid gap-3 md:grid-cols-3">
              {[
                {
                  type: "Action",
                  color: "blue" as const,
                  Icon: Zap,
                  desc: t("tutorial.s3ActionDesc"),
                },
                {
                  type: "Gate",
                  color: "kiwi" as const,
                  Icon: MessageSquare,
                  desc: t("tutorial.s3GateDesc"),
                },
                {
                  type: "Loop",
                  color: "neutral" as const,
                  Icon: Repeat,
                  desc: t("tutorial.s3LoopDesc"),
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

            <h3 className={S.subheading}>{t("tutorial.s3Recommended")}</h3>
            <div className={S.panel}>
              <ol className="space-y-3 text-sm">
                <li>{t("tutorial.s3Rec1")}</li>
                <li>{t("tutorial.s3Rec2")}</li>
                <li>{t("tutorial.s3Rec3")}</li>
                <li>{t("tutorial.s3Rec4")}</li>
              </ol>
            </div>
          </Section>

          {/* Section 4: Execute */}
          <Section id="execute" num={4} title={t("tutorial.navExecute")}>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              {t("tutorial.s4Intro")}
            </p>

            <h3 className={S.subheading}>{t("tutorial.s4PreCheck")}</h3>
            <BulletList
              items={[
                t("tutorial.s4Pre1"),
                t("tutorial.s4Pre2"),
                t("tutorial.s4Pre3"),
              ]}
            />

            <h3 className={S.subheading}>{t("tutorial.s4HitlTitle")}</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("tutorial.s4HitlDesc")}
            </p>
            <BulletList
              items={[
                t("tutorial.s4Hitl1"),
                t("tutorial.s4Hitl2"),
                t("tutorial.s4Hitl3"),
              ]}
            />

            <h3 className={S.subheading}>{t("tutorial.s4StatusTitle")}</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                [t("tutorial.s4Running"), t("tutorial.s4RunningDesc")],
                [t("tutorial.s4Waiting"), t("tutorial.s4WaitingDesc")],
                [t("tutorial.s4Failed"), t("tutorial.s4FailedDesc")],
              ].map(([title, desc]) => (
                <div key={title} className={S.panel}>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Section 5: Check Tasks */}
          <Section id="monitor" num={5} title={t("tutorial.navMonitor")}>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              {t("tutorial.s5Intro")}
            </p>

            <h3 className={S.subheading}>{t("tutorial.s5ListTitle")}</h3>
            <BulletList
              items={[
                t("tutorial.s5List1"),
                t("tutorial.s5List2"),
                t("tutorial.s5List3"),
              ]}
            />

            <h3 className={S.subheading}>{t("tutorial.s5DetailTitle")}</h3>
            <BulletList
              items={[
                t("tutorial.s5Detail1"),
                t("tutorial.s5Detail2"),
                t("tutorial.s5Detail3"),
              ]}
            />
          </Section>

          {/* Section 6: Practical Example */}
          <Section id="example" num={6} title={t("tutorial.navExample")}>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              {t("tutorial.s6Intro")}
            </p>

            <h3 className={S.subheading}>{t("tutorial.s6Title")}</h3>
            <div className="space-y-4">
              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  {t("tutorial.s6Step1Title")}
                </p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>
                    1. <Code>{t("tutorial.s6Step1_1")}</Code>
                  </p>
                  <p>
                    2. <Code>{t("tutorial.s6Step1_2")}</Code>
                  </p>
                  <p>
                    3. <Code>{t("tutorial.s6Step1_3")}</Code>
                  </p>
                </div>
              </div>

              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  {t("tutorial.s6Step2Title")}
                </p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>{t("tutorial.s6Step2_1")}</p>
                  <p>{t("tutorial.s6Step2_2")}</p>
                  <p>{t("tutorial.s6Step2_3")}</p>
                  <p>{t("tutorial.s6Step2_4")}</p>
                </div>
              </div>

              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  {t("tutorial.s6Step3Title")}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("tutorial.s6Step3Desc")}
                </p>
                <div className="mt-3 rounded-2xl border border-border bg-surface-soft/50 p-4 text-sm">
                  {t("tutorial.s6Step3Example")}
                </div>
              </div>

              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  {t("tutorial.s6Step4Title")}
                </p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>{t("tutorial.s6Step4_1")}</p>
                  <p>{t("tutorial.s6Step4_2")}</p>
                  <p>{t("tutorial.s6Step4_3")}</p>
                  <p>{t("tutorial.s6Step4_4")}</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Section 7: MCP Integration */}
          <Section id="mcp-loop" num={7} title={t("tutorial.s7Title")}>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              {t("tutorial.s7Intro")}
            </p>

            <h3 className={S.subheading}>{t("tutorial.s7SetupTitle")}</h3>
            <div className={S.panel}>
              <ol className="space-y-3 text-sm">
                <li>
                  1. <Code>npm install -g bluekiwi</Code>{" "}
                  <span className="text-muted-foreground">
                    {t("tutorial.s7Setup1").replace(
                      "npm install -g bluekiwi 로 ",
                      "",
                    )}
                  </span>
                </li>
                <li>
                  2.{" "}
                  <span className="text-muted-foreground">
                    {t("tutorial.s7Setup2")}
                  </span>
                </li>
                <li>
                  3. <Code>{"bluekiwi accept <token> --server <url>"}</Code>
                </li>
                <li>
                  4. <Code>bluekiwi init</Code>{" "}
                  <span className="text-muted-foreground">
                    {t("tutorial.s7Setup4").replace("bluekiwi init 으로 ", "")}
                  </span>
                </li>
                <li>
                  5. <Code>bluekiwi status</Code>{" "}
                  <span className="text-muted-foreground">
                    {t("tutorial.s7Setup5").replace("bluekiwi status 로 ", "")}
                  </span>
                </li>
              </ol>
            </div>

            <h3 className={S.subheading}>{t("tutorial.s7ToolsTitle")}</h3>
            <div className="overflow-x-auto">
              <table className={S.table}>
                <thead>
                  <tr>
                    <th className={S.th}>
                      <Terminal className="mr-1.5 inline h-3.5 w-3.5" />
                      Tool
                    </th>
                    <th className={S.th}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["start_workflow", t("tutorial.s7ToolStartWorkflow")],
                      ["advance", t("tutorial.s7ToolAdvance")],
                      ["execute_step", t("tutorial.s7ToolExecuteStep")],
                      ["request_approval", t("tutorial.s7ToolRequestApproval")],
                      ["complete_task", t("tutorial.s7ToolCompleteTask")],
                      ["rewind", t("tutorial.s7ToolRewind")],
                      ["heartbeat", t("tutorial.s7ToolHeartbeat")],
                    ] as const
                  ).map(([tool, desc]) => (
                    <tr key={tool}>
                      <td className={S.td}>
                        <code className={S.code}>{tool}</code>
                      </td>
                      <td className={`${S.td} ${S.muted}`}>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className={S.subheading}>{t("tutorial.s7FlowTitle")}</h3>
            <div className={S.panel}>
              <ol className="space-y-3 text-sm">
                <li>{t("tutorial.s7Flow1")}</li>
                <li>{t("tutorial.s7Flow2")}</li>
                <li>{t("tutorial.s7Flow3")}</li>
                <li>{t("tutorial.s7Flow4")}</li>
                <li>{t("tutorial.s7Flow5")}</li>
              </ol>
            </div>

            <h3 className={S.subheading}>{t("tutorial.s7AutoTitle")}</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("tutorial.s7AutoDesc")}
            </p>
            <BulletList
              items={[
                t("tutorial.s7Auto1"),
                t("tutorial.s7Auto2"),
                t("tutorial.s7Auto3"),
              ]}
            />
          </Section>

          {/* Section 8: Tips */}
          <Section id="tips" num={8} title={t("tutorial.navTips")}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  {t("tutorial.s8Tip1Title")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("tutorial.s8Tip1Desc")}
                </p>
              </div>
              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  {t("tutorial.s8Tip2Title")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("tutorial.s8Tip2Desc")}
                </p>
              </div>
              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  {t("tutorial.s8Tip3Title")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("tutorial.s8Tip3Desc")}
                </p>
              </div>
              <div className={S.panel}>
                <p className="text-sm font-semibold">
                  {t("tutorial.s8Tip4Title")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("tutorial.s8Tip4Desc")}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-brand-blue-200 bg-brand-blue-100/60 p-5">
              <p className="text-sm font-semibold">
                {t("tutorial.s8CtaTitle")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("tutorial.s8CtaDesc")}
              </p>
              <p className="mt-4 text-sm">
                {t("tutorial.s8CtaGoal")}{" "}
                <Code>{t("tutorial.s8CtaGoal1")}</Code>{" "}
                <Code>{t("tutorial.s8CtaGoal2")}</Code>
              </p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
