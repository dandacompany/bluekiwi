import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

type SeedDesignSystem = {
  title: string;
  slug: string;
  color_tokens?: Record<string, unknown>;
  typography_tokens?: Record<string, unknown>;
  component_tokens?: Record<string, { states?: string[]; install?: string[] }>;
};

const seedDir = join(process.cwd(), "docker", "seed-design-systems");

function readSeeds(): SeedDesignSystem[] {
  return readdirSync(seedDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .flatMap((file) => {
      const parsed = JSON.parse(
        readFileSync(join(seedDir, file), "utf8"),
      ) as SeedDesignSystem | SeedDesignSystem[];
      return Array.isArray(parsed) ? parsed : [parsed];
    });
}

describe("design-system seeds", () => {
  it("keeps every built-in seed parseable and agent-ready", () => {
    const seeds = readSeeds();

    expect(seeds.length).toBeGreaterThanOrEqual(5);
    for (const seed of seeds) {
      expect(seed.title).toBeTruthy();
      expect(seed.slug).toMatch(/^[a-z0-9-]+$/);
      expect(Object.keys(seed.color_tokens ?? {}).length).toBeGreaterThan(4);
      expect(Object.keys(seed.typography_tokens ?? {}).length).toBeGreaterThan(2);
      expect(Object.keys(seed.component_tokens ?? {}).length).toBeGreaterThan(0);
    }
  });

  it("includes a broad shadcn reference kit for component-heavy generation", () => {
    const kit = readSeeds().find(
      (seed) => seed.slug === "shadcn-product-ui-kit",
    );

    expect(kit).toBeDefined();
    const components = kit?.component_tokens ?? {};
    expect(Object.keys(components)).toEqual(
      expect.arrayContaining([
        "Button",
        "Input",
        "Textarea",
        "Select",
        "Checkbox",
        "RadioGroup",
        "Switch",
        "Card",
        "Dialog",
        "DropdownMenu",
        "Tabs",
        "Table",
        "Badge",
        "Alert",
        "Toast",
      ]),
    );
    expect(components.Button.install).toContain("npx shadcn@latest add button");
    expect(components.Table.states).toEqual(
      expect.arrayContaining(["loading", "empty", "error"]),
    );
  });
});
