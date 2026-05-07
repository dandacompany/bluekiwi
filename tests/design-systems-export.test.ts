import { describe, expect, it } from "vitest";
import {
  buildDesignSystemComponentDocs,
  buildDesignSystemDesignMarkdownExport,
  buildDesignSystemJsonExport,
  buildDesignSystemSkillExport,
  type DesignSystemDetail,
} from "../src/lib/db/repositories/design-systems";

const detail: DesignSystemDetail = {
  id: 7,
  title: "Acme Design",
  slug: "acme-design",
  description: "Acme product design system",
  version: "1.0",
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
    expect(exported.tokens).toEqual({ color: { brand: "#0055ff" } });
    expect(exported.token_sections.color).toEqual({ brand: "#0055ff" });
    expect(exported.component_documents[0].framework).toBe("shadcn");
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
    expect(exported).toContain("| `brand` | `#0055ff` |");
    expect(exported).toContain("## Component Documents");
    expect(exported).toContain("### LessonCard");
    expect(exported).toContain("#### React");
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
      sourceAssets: ["LessonCard.tsx", "lesson-card.css"],
    });
    expect(docs[0].html).toContain("lesson-card");
    expect(docs[0].dependencies).toContain("lucide-react");
    expect(docs[0].install).toContain("npx shadcn@latest add card button");
  });
});
