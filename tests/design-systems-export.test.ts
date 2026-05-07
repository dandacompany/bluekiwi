import { describe, expect, it } from "vitest";
import {
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
});

