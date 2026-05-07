import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("MCP design-system resources", () => {
  it("documents every agent-readable design-system resource URI in the MCP server", () => {
    const source = readFileSync(
      join(process.cwd(), "mcp", "src", "server.ts"),
      "utf8",
    );

    for (const resourcePath of [
      "DESIGN.md",
      "SKILL.md",
      "tokens/schema.json",
      "tokens/colors.json",
      "tokens/typography.json",
      "tokens/components.json",
      "guidelines.md",
      "adapters.json",
    ]) {
      expect(source).toContain(`path: "${resourcePath}"`);
    }

    expect(source).toContain("bk://active/design-system/");
    expect(source).toContain("bk://design-systems/");
    expect(source).toContain("readDesignSystemResource");
  });
});
