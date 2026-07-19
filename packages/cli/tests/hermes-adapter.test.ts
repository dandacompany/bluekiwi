import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// vi.hoisted runs before ESM imports resolve, so we use CommonJS
// `require` for `path`/`os` here — a dynamic `import()` is async and
// cannot feed a synchronous vi.mock factory.
const { TMP_HOME } = vi.hoisted(() => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const path: typeof import("path") = require("path");
  const osLib: typeof import("os") = require("os");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    TMP_HOME: path.join(
      osLib.tmpdir(),
      `bk-cli-hermes-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    ),
  };
});

vi.mock("os", async () => {
  const actual = await vi.importActual<typeof import("os")>("os");
  return { ...actual, homedir: () => TMP_HOME };
});

import { HermesAdapter, getHermesAdapters } from "../src/runtimes/hermes.js";

const HERMES = join(TMP_HOME, ".hermes");
const CFG = join(HERMES, "config.yaml");

const SAMPLE = {
  command: "node",
  args: ["/app.js", "--flag"],
  env: { API_KEY: "bk_x", API_URL: "https://ex.io" },
};

beforeAll(() => {
  mkdirSync(TMP_HOME, { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true, force: true });
});

beforeEach(() => {
  if (existsSync(HERMES)) rmSync(HERMES, { recursive: true, force: true });
});

function globalAdapter(): HermesAdapter {
  return new HermesAdapter({
    name: "hermes",
    displayName: "Hermes",
    baseDir: HERMES,
  });
}

describe("HermesAdapter (YAML sentinel)", () => {
  it("isInstalled reflects baseDir existence", () => {
    expect(globalAdapter().isInstalled()).toBe(false);
    mkdirSync(HERMES, { recursive: true });
    expect(globalAdapter().isInstalled()).toBe(true);
  });

  it("fresh install creates config.yaml with mcp_servers sentinel block", () => {
    globalAdapter().installMcp(SAMPLE);
    const yaml = readFileSync(CFG, "utf8");
    expect(yaml).toContain("mcp_servers:");
    expect(yaml).toContain("# bluekiwi:begin");
    expect(yaml).toContain("# bluekiwi:end");
    expect(yaml).toContain("  bluekiwi:");
    expect(yaml).toContain('command: "node"');
    expect(yaml).toContain('- "/app.js"');
    expect(yaml).toContain("    env:");
    expect(yaml).toContain('"API_KEY": "bk_x"');
  });

  it("install preserves existing mcp_servers entries and top-level keys", () => {
    mkdirSync(HERMES, { recursive: true });
    writeFileSync(
      CFG,
      [
        "agent:",
        "  name: sophie",
        "",
        "mcp_servers:",
        "  inflearn:",
        '    url: "https://mcp.inflearn.com/mcp"',
        "",
        "plugins:",
        "  enabled: []",
        "",
      ].join("\n"),
    );
    globalAdapter().installMcp(SAMPLE);
    const yaml = readFileSync(CFG, "utf8");
    expect(yaml).toContain("agent:");
    expect(yaml).toContain("inflearn:");
    expect(yaml).toContain("plugins:");
    expect(yaml).toContain("# bluekiwi:begin");
    // Exactly one mcp_servers header — merged, not duplicated.
    expect(yaml.match(/^mcp_servers:/gm) ?? []).toHaveLength(1);
    // Our block is injected as the first child, before user entries.
    expect(yaml.indexOf("# bluekiwi:begin")).toBeLessThan(
      yaml.indexOf("inflearn:"),
    );
  });

  it("install detects mcp_servers header with a trailing comment", () => {
    mkdirSync(HERMES, { recursive: true });
    writeFileSync(
      CFG,
      ["mcp_servers: # user note", "  other:", '    command: "x"', ""].join(
        "\n",
      ),
    );
    globalAdapter().installMcp(SAMPLE);
    const yaml = readFileSync(CFG, "utf8");
    expect(yaml.match(/^mcp_servers:/gm) ?? []).toHaveLength(1);
    expect(yaml).toContain("mcp_servers: # user note");
    expect(yaml).toContain("other:");
    expect(yaml).toContain("# bluekiwi:begin");
  });

  it("install is idempotent: re-install replaces sentinel block", () => {
    globalAdapter().installMcp(SAMPLE);
    globalAdapter().installMcp({ ...SAMPLE, command: "python" });
    const yaml = readFileSync(CFG, "utf8");
    expect(yaml.match(/# bluekiwi:begin/g) ?? []).toHaveLength(1);
    expect(yaml).toContain('command: "python"');
    expect(yaml).not.toContain('command: "node"');
  });

  it("install throws on flow-style mcp_servers without touching the file", () => {
    mkdirSync(HERMES, { recursive: true });
    const flow = "mcp_servers: {other: {command: x}}\n";
    writeFileSync(CFG, flow);
    expect(() => globalAdapter().installMcp(SAMPLE)).toThrow(
      /BlueKiwi cannot merge/,
    );
    expect(readFileSync(CFG, "utf8")).toBe(flow);
  });

  it("uninstall removes sentinel block and keeps user entries", () => {
    mkdirSync(HERMES, { recursive: true });
    writeFileSync(
      CFG,
      ["mcp_servers:", "  inflearn:", '    url: "https://x"', ""].join("\n"),
    );
    const adapter = globalAdapter();
    adapter.installMcp(SAMPLE);
    adapter.uninstall();
    const yaml = readFileSync(CFG, "utf8");
    expect(yaml).not.toContain("# bluekiwi:begin");
    expect(yaml).toContain("inflearn:");
  });

  it("uninstall is a no-op when nothing installed", () => {
    expect(() => globalAdapter().uninstall()).not.toThrow();
    expect(existsSync(CFG)).toBe(false);
  });

  it("installs and prunes skills under <baseDir>/skills", () => {
    const adapter = globalAdapter();
    adapter.installSkills([
      { name: "bk-alpha", content: "# alpha" },
      { name: "bk-beta", content: "# beta" },
    ]);
    const skillsDir = join(HERMES, "skills");
    expect(readFileSync(join(skillsDir, "bk-alpha", "SKILL.md"), "utf8")).toBe(
      "# alpha",
    );
    adapter.pruneSkills(new Set(["bk-alpha"]));
    expect(existsSync(join(skillsDir, "bk-alpha"))).toBe(true);
    expect(existsSync(join(skillsDir, "bk-beta"))).toBe(false);
    adapter.uninstall();
    expect(existsSync(join(skillsDir, "bk-alpha"))).toBe(false);
  });
});
