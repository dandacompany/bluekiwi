import { describe, expect, it } from "vitest";
import {
  buildDesignSystemAdapterExport,
  buildDesignSystemBundleExport,
  buildDesignSystemComponentDocs,
  buildDesignSystemDesignMarkdownExport,
  buildDesignSystemJsonExport,
  buildDesignSystemSkillExport,
  getDesignSystemComponentValue,
  getDesignSystemSectionEntryValue,
  getDesignSystemSectionValue,
  lintDesignSystem,
  type DesignSystemDetail,
} from "../src/lib/db/repositories/design-systems";

const detail: DesignSystemDetail = {
  id: 7,
  title: "Acme Design",
  slug: "acme-design",
  description: "Acme product design system",
  version: "1.0",
  category: "Developer Tools",
  surface: "web",
  parent_design_system_id: null,
  family_root_id: 7,
  is_active: true,
  status: "draft",
  owner_id: 1,
  folder_id: 1,
  visibility_override: null,
  created_at: "2026-05-07T00:00:00.000Z",
  updated_at: "2026-05-07T00:00:00.000Z",
  content: {
    id: 11,
    design_system_id: 7,
    schema_json: "{\"mediums\":[\"web\"]}",
    tokens_json: "{\"color\":{\"brand\":\"#0055ff\"}}",
    color_tokens_json: "{\"brand\":\"#0055ff\"}",
    typography_tokens_json: "{\"body\":\"Inter\"}",
    component_tokens_json: JSON.stringify({
      LessonCard: {
        framework: "shadcn",
        style_system: "shadcn/ui + Tailwind CSS",
        description: "Compact lesson module card.",
        dependencies: ["@radix-ui/react-slot", "class-variance-authority"],
        install: ["npx shadcn@latest add card button"],
        tailwind: {
          classes: ["rounded-lg", "border", "bg-card", "text-card-foreground"],
          theme_tokens: ["--card", "--card-foreground"],
        },
        shadcn: {
          registry_items: ["card", "button"],
          dependencies: ["lucide-react"],
        },
        props: [
          {
            name: "title",
            type: "string",
            description: "Lesson title",
          },
        ],
        variants: ["default", "active"],
        states: ["default", "hover", "focus-visible", "disabled"],
        preview: {
          html: "<article class=\"lesson-card\"><h3>Prompt Design</h3></article>",
          css: ".lesson-card{border:1px solid #D8CCB8;padding:16px}",
        },
        source: {
          react:
            "export function LessonCard({ title }) { return <article>{title}</article>; }",
        },
        usage: "Use inside workshop outlines.",
        assets: ["LessonCard.tsx", "lesson-card.css"],
      },
    }),
    guidelines_markdown: "## Use\n\nUse brand blue.",
    skill_markdown: "Apply Acme tokens.",
    export_manifest_json: "{\"formats\":[\"skill\"]}",
    created_at: "2026-05-07T00:00:00.000Z",
    updated_at: "2026-05-07T00:00:00.000Z",
  },
  assets: [
    {
      id: 21,
      design_system_id: 7,
      version_id: 11,
      kind: "css",
      filename: "tokens.css",
      mime_type: "text/css",
      content_text: ":root { --brand: #0055ff; }",
      content_base64: null,
      size_bytes: 27,
      created_at: "2026-05-07T00:00:00.000Z",
      updated_at: "2026-05-07T00:00:00.000Z",
    },
  ],
};

describe("design system exports", () => {
  it("builds stable json export shape", () => {
    const exported = buildDesignSystemJsonExport(detail);
    expect(exported.design_system.slug).toBe("acme-design");
    expect(exported.design_system.category).toBe("Developer Tools");
    expect(exported.design_system.surface).toBe("web");
    expect(exported.tokens).toEqual({ color: { brand: "#0055ff" } });
    expect(exported.token_sections.color).toEqual({ brand: "#0055ff" });
    expect(exported.component_documents[0].framework).toBe("shadcn");
    expect(exported.component_documents[0].states).toContain("focus-visible");
    expect(exported.component_documents[0].classes).toContain("rounded-lg");
    expect(exported.design_markdown).toContain("## Color Palette");
    expect(exported.assets).toHaveLength(1);
    expect(exported.assets[0].filename).toBe("tokens.css");
  });

  it("builds SKILL.md-compatible markdown", () => {
    const exported = buildDesignSystemSkillExport(detail);
    expect(exported).toContain("name: acme-design");
    expect(exported).toContain("# Acme Design");
    expect(exported).toContain("Apply Acme tokens.");
    expect(exported).toContain("tokens.css");
  });

  it("builds DESIGN.md documentation", () => {
    const exported = buildDesignSystemDesignMarkdownExport(detail);
    expect(exported).toContain("# Acme Design DESIGN.md");
    expect(exported).toContain("- Category: `Developer Tools`");
    expect(exported).toContain("- Surface: `web`");
    expect(exported).toContain("| `brand` | `#0055ff` |");
    expect(exported).toContain("## Component Documents");
    expect(exported).toContain("### LessonCard");
    expect(exported).toContain("#### React");
    expect(exported).toContain("#### States");
    expect(exported).toContain("#### Tailwind");
    expect(exported).toContain("#### shadcn/ui");
  });

  it("normalizes component documents for UI and agents", () => {
    const docs = buildDesignSystemComponentDocs(detail);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      name: "LessonCard",
      framework: "shadcn",
      styleSystem: "shadcn/ui + Tailwind CSS",
      variants: ["default", "active"],
      states: ["default", "hover", "focus-visible", "disabled"],
      sourceAssets: ["LessonCard.tsx", "lesson-card.css"],
    });
    expect(docs[0].html).toContain("lesson-card");
    expect(docs[0].dependencies).toContain("lucide-react");
    expect(docs[0].install).toContain("npx shadcn@latest add card button");
  });

  it("loads section and keyed values for category-level agents", () => {
    expect(getDesignSystemSectionValue(detail, "colors")).toEqual({
      brand: "#0055ff",
    });
    expect(getDesignSystemSectionValue(detail, "fonts")).toEqual({
      body: "Inter",
    });
    expect(getDesignSystemSectionEntryValue(detail, "components", "LessonCard"))
      .toMatchObject({
        framework: "shadcn",
        description: "Compact lesson module card.",
      });
  });

  it("loads a normalized component by name", () => {
    const component = getDesignSystemComponentValue(detail, "LessonCard");
    expect(component?.name).toBe("LessonCard");
    expect(component?.value).toMatchObject({ framework: "shadcn" });
    expect(component?.document?.classes).toContain("rounded-lg");
    expect(getDesignSystemComponentValue(detail, "Missing")).toBeNull();
  });

  it("lints design-system quality gaps", () => {
    const result = lintDesignSystem(detail);
    expect(result.ok).toBe(true);
    expect(result.score).toBeLessThan(100);
    expect(
      result.issues.some((issue) => issue.code === "DS_COLOR_ROLES_SPARSE"),
    ).toBe(true);
  });

  it("builds bundle export", () => {
    const bundle = buildDesignSystemBundleExport(detail);
    const paths = bundle.files.map((file) => file.path);
    expect(bundle.format).toBe("bundle");
    expect(paths).toContain("DESIGN.md");
    expect(paths).toContain("tokens/colors.json");
    expect(paths).toContain("adapters/tailwind.config.js");
    expect(paths).toContain("adapters/shadcn-registry.json");
    expect(bundle.lint.issues.length).toBeGreaterThan(0);
  });

  it("builds implementation adapter export", () => {
    const adapters = buildDesignSystemAdapterExport(detail);
    const files = Object.fromEntries(
      adapters.files.map((file) => [file.path, file.content]),
    );

    expect(adapters.format).toBe("adapters");
    expect(adapters.adapters.tailwind).toBe("adapters/tailwind.config.js");
    expect(files["adapters/tokens.css"]).toContain("--bk-color-brand");
    expect(files["adapters/tailwind.config.js"]).toContain("brand");
    expect(files["adapters/shadcn-registry.json"]).toContain("LessonCard");
    expect(files["adapters/react/LessonCard.tsx"]).toContain(
      "export function LessonCard",
    );
    expect(files["adapters/html/index.html"]).toContain("LessonCard");
    expect(files["adapters/html/styles.css"]).toContain(".lesson-card");
  });
});
