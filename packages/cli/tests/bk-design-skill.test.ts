import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const skill = readFileSync(
  join(process.cwd(), "src", "assets", "skills", "bk-design", "SKILL.md"),
  "utf8",
);

describe("bk-design bundled skill", () => {
  it("requires AskUserQuestion gates for ambiguous and mutating operations", () => {
    expect(skill).toContain("Required Interaction Gate");
    expect(skill).toContain("ask an `AskUserQuestion` before using mutation tools");
    expect(skill).toContain("ask the intent question and");
    expect(skill).toContain("Do not call mutation tools");
    expect(skill).toContain("call `list_design_systems` before choosing");
    expect(skill).toContain("ask whether to create a new system or create a new version");
  });

  it("documents scoped category operations and component tool usage", () => {
    expect(skill).toContain("Category Operation Matrix");
    expect(skill).toContain("get_design_system_section");
    expect(skill).toContain("upsert_design_system_section_entry");
    expect(skill).toContain("get_design_component");
    expect(skill).toContain("upsert_design_component");
    expect(skill).toContain("delete_design_component");
    expect(skill).toContain("Treat the web UI as a read-only viewer");
  });

  it("preserves HiFi/LoFi recommendation and automatic generation rules", () => {
    expect(skill).toContain("Design Depth Gate");
    expect(skill).toContain("LoFi Fast Draft");
    expect(skill).toContain("HiFi Recommended Directions");
    expect(skill).toContain("show at least three recommended design directions");
    expect(skill).toContain("do not paste external skill instructions");
    expect(skill).toContain("custom user request");
  });

  it("keeps DESIGN.md and adapter export guidance available to agents", () => {
    expect(skill).toContain('format: "design"');
    expect(skill).toContain("bk://active/design-system/DESIGN.md");
    expect(skill).toContain('format: "package"');
    expect(skill).toContain("design-package.json");
    expect(skill).toContain("analyze_design_system_package");
    expect(skill).toContain("import_design_system_package");
    expect(skill).toContain('mode: "version"');
    expect(skill).toContain('format: "adapters"');
    expect(skill).toContain("React/Tailwind/shadcn/HTML");
    expect(skill).toContain("bundle");
  });
});
