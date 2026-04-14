"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

function buildVsFrame(content: string): string {
  return `<!doctype html>
<html data-theme="light" data-lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/vs/components.css">
<style>body{margin:0;padding:0;} .bk-vs-container{min-height:unset;}</style>
</head>
<body>
<div class="bk-vs-container">
  <div class="bk-vs-content">${content}</div>
  <div class="bk-vs-footer">
    <div class="bk-vs-status"></div>
    <button class="bk-vs-submit" disabled>Submit</button>
  </div>
</div>
<script src="/vs/helper.js"><\/script>
</body>
</html>`;
}

const VS_DEMO_OPTIONS = buildVsFrame(
  `<div class="bk-options">
  <div class="bk-option" data-value="a"><span class="bk-option-letter">A</span><div class="bk-option-body"><h3>Plan A</h3><p>Keep current UI — color improvements only</p></div></div>
  <div class="bk-option" data-value="b" data-recommended><span class="bk-option-letter">B</span><div class="bk-option-body"><h3>Plan B</h3><p>Full layout redesign (recommended)</p></div></div>
  <div class="bk-option" data-value="c"><span class="bk-option-letter">C</span><div class="bk-option-body"><h3>Plan C</h3><p>Incremental 3-phase approach</p></div></div>
</div>`,
);

const VS_DEMO_CHECKLIST = buildVsFrame(
  `<div class="bk-checklist">
  <div class="bk-check-item" data-value="a11y">Accessibility improvements</div>
  <div class="bk-check-item" data-value="perf">Loading speed optimization</div>
  <div class="bk-check-item" data-value="mobile">Mobile responsiveness</div>
  <div class="bk-check-item" data-value="dark">Dark mode support</div>
</div>`,
);

const VS_DEMO_SLIDER = buildVsFrame(
  `<div class="bk-slider" data-value="5">
  <label>Priority score (1–10)</label>
  <div class="bk-slider-controls">
    <input type="range" min="1" max="10" value="5" step="1">
    <span class="bk-slider-value">5</span>
  </div>
</div>`,
);

interface GuideMeta {
  slug: string;
  title: string;
  description: string;
}

function GuidesTab() {
  const { t } = useTranslation();
  const [guides, setGuides] = useState<GuideMeta[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/guides")
      .then((r) => r.json())
      .then((data: GuideMeta[]) => setGuides(data))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeSlug) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContent("");
    void fetch(`/api/guides/${activeSlug}`)
      .then((r) => r.json())
      .then((data: { content?: string }) => setContent(data.content ?? ""))
      .catch(() => setContent(""));
  }, [activeSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        {t("tutorial.guidesLoading")}
      </div>
    );
  }

  if (activeSlug && content) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-8">
        <button
          onClick={() => {
            setActiveSlug(null);
            setContent("");
          }}
          className="mb-6 text-sm text-brand-blue-600 hover:underline"
        >
          {t("tutorial.guidesBack")}
        </button>
        <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-bold prose-code:rounded prose-code:bg-brand-blue-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-brand-blue-700 prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:bg-surface-soft prose-img:rounded-xl prose-img:border prose-img:border-border">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              img: ({ src, alt }) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={alt ?? ""}
                  className="my-4 rounded-xl border border-border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </article>
      </div>
    );
  }

  if (guides.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        {t("tutorial.guidesEmpty")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <div className="space-y-3">
        {guides.map((guide, i) => (
          <button
            key={guide.slug}
            onClick={() => setActiveSlug(guide.slug)}
            className="group w-full rounded-2xl border border-border bg-background/80 px-5 py-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-brand-blue-300 hover:bg-brand-blue-50/40"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-snug text-foreground group-hover:text-brand-blue-700">
                  {guide.title}
                </p>
                {guide.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {guide.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TutorialPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"overview" | "guides">("overview");

  const navItems = [
    { id: "start", label: t("tutorial.navStart") },
    { id: "instructions", label: t("tutorial.navInstructions") },
    { id: "workflows", label: t("tutorial.navWorkflows") },
    { id: "vs", label: t("tutorial.navVS") },
    { id: "skills", label: t("tutorial.navSkills") },
    { id: "execute", label: t("tutorial.navExecute") },
    { id: "monitor", label: t("tutorial.navMonitor") },
    { id: "example", label: t("tutorial.navExample") },
    { id: "mcp-loop", label: t("tutorial.navMcpLoop") },
    { id: "tips", label: t("tutorial.navTips") },
  ];

  return (
    <div className="min-h-screen">
      {/* Top-level tab switcher */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2">
          {(["overview", "guides"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-brand-blue-600 text-white"
                  : "text-muted-foreground hover:bg-brand-blue-100 hover:text-foreground"
              }`}
            >
              {tab === "overview"
                ? t("tutorial.tabOverview")
                : t("tutorial.tabGuides")}
            </button>
          ))}
        </div>
      </div>

      {/* Guides tab */}
      {activeTab === "guides" && <GuidesTab />}

      {/* Overview tab */}
      {activeTab === "overview" && (
        <>
          <div className="sticky top-[41px] z-10 border-b border-border bg-background/80 backdrop-blur">
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
                    <p className="text-sm font-semibold">
                      {t("tutorial.s1Order")}
                    </p>
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
                      { Icon: Lock, text: t("tutorial.s1VisPersonal") },
                      { Icon: Users, text: t("tutorial.s1VisGroup") },
                      { Icon: Shield, text: t("tutorial.s1VisPublic") },
                      { Icon: FolderOpen, text: t("tutorial.s1VisInherit") },
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
              <Section
                id="workflows"
                num={3}
                title={t("tutorial.navWorkflows")}
              >
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
                      <p className="text-sm text-muted-foreground">
                        {node.desc}
                      </p>
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

                <h3 className={S.subheading}>
                  {t("tutorial.s1AttachmentsTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("tutorial.s1AttachmentsDesc")}
                </p>
              </Section>

              {/* Section 4: Visual Selection */}
              <Section id="vs" num={4} title={t("tutorial.navVS")}>
                <p className="mb-4 leading-relaxed text-muted-foreground">
                  {t("tutorial.sVsIntro")}
                </p>

                <h3 className={S.subheading}>{t("tutorial.sVsHowTitle")}</h3>
                <div className={`${S.panel} mb-6`}>
                  <ol className="space-y-2 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue-600 text-xs font-bold text-white">
                        1
                      </span>
                      <span className="text-muted-foreground">
                        {t("tutorial.sVsHow1")}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue-600 text-xs font-bold text-white">
                        2
                      </span>
                      <span className="text-muted-foreground">
                        {t("tutorial.sVsHow2")}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue-600 text-xs font-bold text-white">
                        3
                      </span>
                      <span className="text-muted-foreground">
                        {t("tutorial.sVsHow3")}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue-600 text-xs font-bold text-white">
                        4
                      </span>
                      <span className="text-muted-foreground">
                        {t("tutorial.sVsHow4")}
                      </span>
                    </li>
                  </ol>
                </div>

                <h3 className={S.subheading}>{t("tutorial.sVsCompTitle")}</h3>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t("tutorial.sVsDemoOptionsLabel")}
                    </p>
                    <iframe
                      srcDoc={VS_DEMO_OPTIONS}
                      className="h-72 w-full rounded-2xl border border-border/80 bg-background"
                      sandbox="allow-scripts allow-same-origin"
                      title="bk-options demo"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t("tutorial.sVsDemoChecklistLabel")}
                    </p>
                    <iframe
                      srcDoc={VS_DEMO_CHECKLIST}
                      className="h-72 w-full rounded-2xl border border-border/80 bg-background"
                      sandbox="allow-scripts allow-same-origin"
                      title="bk-checklist demo"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t("tutorial.sVsDemoSliderLabel")}
                    </p>
                    <iframe
                      srcDoc={VS_DEMO_SLIDER}
                      className="h-72 w-full rounded-2xl border border-border/80 bg-background"
                      sandbox="allow-scripts allow-same-origin"
                      title="bk-slider demo"
                    />
                  </div>
                </div>

                <h3 className={S.subheading}>{t("tutorial.sVsMoreTitle")}</h3>
                <BulletList
                  items={[
                    t("tutorial.sVsMore1"),
                    t("tutorial.sVsMore2"),
                    t("tutorial.sVsMore3"),
                    t("tutorial.sVsMore4"),
                    t("tutorial.sVsMore5"),
                  ]}
                />

                <div className="mt-5 rounded-2xl border border-kiwi-200 bg-kiwi-50/60 p-4">
                  <p className="text-sm text-muted-foreground">
                    💡 {t("tutorial.sVsTip")}
                  </p>
                </div>
              </Section>

              {/* Section 5: Skill Commands */}
              <Section id="skills" num={5} title={t("tutorial.navSkills")}>
                <p className="mb-4 leading-relaxed text-muted-foreground">
                  {t("tutorial.sSkIntro")}
                </p>

                <h3 className={S.subheading}>{t("tutorial.sSkTableTitle")}</h3>
                <div className="mb-6 overflow-x-auto">
                  <table className={S.table}>
                    <thead>
                      <tr>
                        <th className={S.th}>Skill</th>
                        <th className={S.th}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["/bk-start", t("tutorial.sSkBkStart")],
                          ["/bk-next", t("tutorial.sSkBkNext")],
                          ["/bk-design", t("tutorial.sSkBkDesign")],
                          ["/bk-approve", t("tutorial.sSkBkApprove")],
                          ["/bk-improve", t("tutorial.sSkBkImprove")],
                          ["/bk-report", t("tutorial.sSkBkReport")],
                          ["/bk-instruction", t("tutorial.sSkBkInstruction")],
                          ["/bk-help", t("tutorial.sSkBkHelp")],
                        ] as const
                      ).map(([skill, desc]) => (
                        <tr key={skill}>
                          <td className={S.td}>
                            <code className={S.code}>{skill}</code>
                          </td>
                          <td className={`${S.td} ${S.muted}`}>{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 className={S.subheading}>
                  {t("tutorial.sSkSessionTitle")}
                </h3>
                <BulletList
                  items={[
                    t("tutorial.sSkSession1"),
                    t("tutorial.sSkSession2"),
                    t("tutorial.sSkSession3"),
                  ]}
                />

                <h3 className={S.subheading}>
                  {t("tutorial.sSkInterruptTitle")}
                </h3>
                <BulletList
                  items={[
                    t("tutorial.sSkInterrupt1"),
                    t("tutorial.sSkInterrupt2"),
                    t("tutorial.sSkInterrupt3"),
                  ]}
                />
              </Section>

              {/* Section 6: Execute */}
              <Section id="execute" num={6} title={t("tutorial.navExecute")}>
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
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {[
                    [t("tutorial.s4Running"), t("tutorial.s4RunningDesc")],
                    [t("tutorial.s4Waiting"), t("tutorial.s4WaitingDesc")],
                    [t("tutorial.s4Failed"), t("tutorial.s4FailedDesc")],
                    [t("tutorial.s4TimedOut"), t("tutorial.s4TimedOutDesc")],
                  ].map(([title, desc]) => (
                    <div key={title} className={S.panel}>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {desc}
                      </p>
                    </div>
                  ))}
                </div>

                <h3 className={S.subheading}>
                  {t("tutorial.s4FeedbackTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("tutorial.s4FeedbackDesc")}
                </p>
              </Section>

              {/* Section 7: Check Tasks */}
              <Section id="monitor" num={7} title={t("tutorial.navMonitor")}>
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

                <h3 className={S.subheading}>{t("tutorial.s5RewindTitle")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("tutorial.s5RewindDesc")}
                </p>

                <h3 className={S.subheading}>{t("tutorial.s5CommentTitle")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("tutorial.s5CommentDesc")}
                </p>

                <h3 className={S.subheading}>
                  {t("tutorial.s5TimedOutTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("tutorial.s5TimedOutDesc")}
                </p>
              </Section>

              {/* Section 8: Practical Example */}
              <Section id="example" num={8} title={t("tutorial.navExample")}>
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

              {/* Section 9: MCP Integration */}
              <Section id="mcp-loop" num={9} title={t("tutorial.s7Title")}>
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
                        {t("tutorial.s7Setup4").replace(
                          "bluekiwi init 으로 ",
                          "",
                        )}
                      </span>
                    </li>
                    <li>
                      5. <Code>bluekiwi status</Code>{" "}
                      <span className="text-muted-foreground">
                        {t("tutorial.s7Setup5").replace(
                          "bluekiwi status 로 ",
                          "",
                        )}
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
                          [
                            "request_approval",
                            t("tutorial.s7ToolRequestApproval"),
                          ],
                          ["complete_task", t("tutorial.s7ToolCompleteTask")],
                          ["rewind", t("tutorial.s7ToolRewind")],
                          ["heartbeat", t("tutorial.s7ToolHeartbeat")],
                          ["list_tasks", t("tutorial.s7ToolListTasks")],
                          ["list_workflows", t("tutorial.s7ToolListWorkflows")],
                          ["list_my_groups", t("tutorial.s7ToolListMyGroups")],
                          [
                            "set_visual_html",
                            t("tutorial.s7ToolSetVisualHtml"),
                          ],
                          [
                            "get_web_response",
                            t("tutorial.s7ToolGetWebResponse"),
                          ],
                          ["save_feedback", t("tutorial.s7ToolSaveFeedback")],
                          ["submit_report", t("tutorial.s7ToolSubmitReport")],
                          [
                            "list_attachments",
                            t("tutorial.s7ToolListAttachments"),
                          ],
                          ["get_attachment", t("tutorial.s7ToolGetAttachment")],
                          [
                            "upload_attachment",
                            t("tutorial.s7ToolUploadAttachment"),
                          ],
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

                <h3 className={S.subheading}>
                  {t("tutorial.s7FeedbackTitle")}
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  {t("tutorial.s7FeedbackDesc")}
                </p>

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

              {/* Section 10: Tips */}
              <Section id="tips" num={10} title={t("tutorial.navTips")}>
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
        </>
      )}
    </div>
  );
}
