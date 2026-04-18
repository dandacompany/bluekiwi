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
      `bk-cli-custom-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    ),
  };
});

vi.mock("os", async () => {
  const actual = await vi.importActual<typeof import("os")>("os");
  return { ...actual, homedir: () => TMP_HOME };
});

import { CodexAdapter } from "../src/runtimes/codex.js";
import { ContinueAdapter } from "../src/runtimes/continue.js";
import { GooseAdapter } from "../src/runtimes/goose.js";
import { JetbrainsAdapter } from "../src/runtimes/jetbrains.js";

beforeAll(() => {
  mkdirSync(TMP_HOME, { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true, force: true });
});

const SAMPLE = {
  command: "node",
  args: ["/app.js", "--flag"],
  env: { API_KEY: "bk_x", API_URL: "https://ex.io" },
};

// -------- Codex (TOML) --------
describe("CodexAdapter (TOML)", () => {
  const CFG = join(TMP_HOME, ".codex", "config.toml");
  let adapter: CodexAdapter;

  beforeEach(() => {
    if (existsSync(join(TMP_HOME, ".codex"))) {
      rmSync(join(TMP_HOME, ".codex"), { recursive: true, force: true });
    }
    adapter = new CodexAdapter();
  });

  it("installMcp writes TOML section with command/args/env", () => {
    adapter.installMcp(SAMPLE);
    const toml = readFileSync(CFG, "utf8");
    expect(toml).toContain("[mcp_servers.bluekiwi]");
    expect(toml).toContain('command = "node"');
    expect(toml).toContain('args = ["/app.js","--flag"]');
    expect(toml).toContain("[mcp_servers.bluekiwi.env]");
    expect(toml).toContain('API_KEY = "bk_x"');
  });

  it("installMcp preserves unrelated TOML sections", () => {
    mkdirSync(join(TMP_HOME, ".codex"), { recursive: true });
    writeFileSync(
      CFG,
      '[profile]\nname = "dev"\n\n[mcp_servers.other]\ncommand = "foo"\n',
    );
    adapter.installMcp(SAMPLE);
    const toml = readFileSync(CFG, "utf8");
    expect(toml).toContain("[profile]");
    expect(toml).toContain("[mcp_servers.other]");
    expect(toml).toContain("[mcp_servers.bluekiwi]");
  });

  it("installMcp is idempotent: re-install replaces without duplicating", () => {
    adapter.installMcp(SAMPLE);
    adapter.installMcp({ ...SAMPLE, command: "python" });
    const toml = readFileSync(CFG, "utf8");
    const matches = toml.match(/\[mcp_servers\.bluekiwi\]/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(toml).toContain('command = "python"');
  });

  it("uninstall removes bluekiwi sections but keeps siblings", () => {
    mkdirSync(join(TMP_HOME, ".codex"), { recursive: true });
    writeFileSync(
      CFG,
      '[profile]\nname = "dev"\n\n[mcp_servers.other]\ncommand = "foo"\n',
    );
    adapter.installMcp(SAMPLE);
    adapter.uninstall();
    const toml = readFileSync(CFG, "utf8");
    expect(toml).not.toContain("[mcp_servers.bluekiwi]");
    expect(toml).toContain("[mcp_servers.other]");
    expect(toml).toContain("[profile]");
  });
});

// -------- Continue.dev (standalone YAML) --------
describe("ContinueAdapter (YAML standalone)", () => {
  const CFG = join(TMP_HOME, ".continue", "mcpServers", "bluekiwi.yaml");
  let adapter: ContinueAdapter;

  beforeEach(() => {
    if (existsSync(join(TMP_HOME, ".continue"))) {
      rmSync(join(TMP_HOME, ".continue"), { recursive: true, force: true });
    }
    adapter = new ContinueAdapter();
  });

  it("installMcp writes BlueKiwi-owned YAML with schema v1 metadata", () => {
    adapter.installMcp(SAMPLE);
    const yaml = readFileSync(CFG, "utf8");
    expect(yaml).toContain("name: bluekiwi");
    expect(yaml).toContain("schema: v1");
    expect(yaml).toContain("- name: bluekiwi");
    expect(yaml).toContain('command: "node"');
    expect(yaml).toContain('- "/app.js"');
    expect(yaml).toContain('"API_KEY": "bk_x"');
  });

  it("uninstall removes the YAML file entirely", () => {
    adapter.installMcp(SAMPLE);
    expect(existsSync(CFG)).toBe(true);
    adapter.uninstall();
    expect(existsSync(CFG)).toBe(false);
  });

  it("does NOT touch other files under mcpServers/ directory", () => {
    mkdirSync(join(TMP_HOME, ".continue", "mcpServers"), { recursive: true });
    const other = join(TMP_HOME, ".continue", "mcpServers", "other.yaml");
    writeFileSync(other, "name: other\nschema: v1\n");
    adapter.installMcp(SAMPLE);
    adapter.uninstall();
    expect(existsSync(other)).toBe(true);
    expect(readFileSync(other, "utf8")).toContain("name: other");
  });
});

// -------- Goose (YAML sentinel block) --------
describe("GooseAdapter (YAML sentinel)", () => {
  const CFG = join(TMP_HOME, ".config", "goose", "config.yaml");
  let adapter: GooseAdapter;

  beforeEach(() => {
    if (existsSync(join(TMP_HOME, ".config", "goose"))) {
      rmSync(join(TMP_HOME, ".config", "goose"), {
        recursive: true,
        force: true,
      });
    }
    adapter = new GooseAdapter();
  });

  it("fresh install creates extensions: block with sentinel markers", () => {
    adapter.installMcp(SAMPLE);
    const yaml = readFileSync(CFG, "utf8");
    expect(yaml).toContain("extensions:");
    expect(yaml).toContain("# bluekiwi:begin");
    expect(yaml).toContain("# bluekiwi:end");
    expect(yaml).toContain("type: stdio");
    expect(yaml).toContain('cmd: "node"');
    expect(yaml).toContain('"API_KEY": "bk_x"');
  });

  it("install preserves existing extensions and top-level keys", () => {
    mkdirSync(join(TMP_HOME, ".config", "goose"), { recursive: true });
    writeFileSync(
      CFG,
      [
        "GOOSE_PROVIDER: openai",
        "",
        "extensions:",
        "  developer:",
        "    enabled: true",
        "    type: builtin",
        "",
        "other_top_key: hello",
        "",
      ].join("\n"),
    );
    adapter.installMcp(SAMPLE);
    const yaml = readFileSync(CFG, "utf8");
    expect(yaml).toContain("GOOSE_PROVIDER: openai");
    expect(yaml).toContain("other_top_key: hello");
    expect(yaml).toContain("developer:");
    expect(yaml).toContain("# bluekiwi:begin");
  });

  it("install is idempotent: re-install replaces sentinel block, no duplication", () => {
    adapter.installMcp(SAMPLE);
    adapter.installMcp({ ...SAMPLE, command: "python" });
    const yaml = readFileSync(CFG, "utf8");
    const beginMatches = yaml.match(/# bluekiwi:begin/g) ?? [];
    expect(beginMatches).toHaveLength(1);
    expect(yaml).toContain('cmd: "python"');
  });

  it("uninstall removes sentinel block and keeps siblings", () => {
    mkdirSync(join(TMP_HOME, ".config", "goose"), { recursive: true });
    writeFileSync(
      CFG,
      "extensions:\n  developer:\n    enabled: true\n    type: builtin\n",
    );
    adapter.installMcp(SAMPLE);
    adapter.uninstall();
    const yaml = readFileSync(CFG, "utf8");
    expect(yaml).not.toContain("# bluekiwi:begin");
    expect(yaml).toContain("developer:");
  });

  it("uninstall is idempotent when nothing installed", () => {
    mkdirSync(join(TMP_HOME, ".config", "goose"), { recursive: true });
    writeFileSync(CFG, "GOOSE_PROVIDER: openai\n");
    expect(() => adapter.uninstall()).not.toThrow();
    const yaml = readFileSync(CFG, "utf8");
    expect(yaml).toContain("GOOSE_PROVIDER: openai");
  });

  // Regression for Codex finding bfdvg840k: real Goose configs with
  // children under `extensions:` used to fall through to the append path
  // when the header line had a trailing comment, producing a duplicate
  // top-level `extensions:` key.
  it("install detects `extensions:` header even with a trailing comment", () => {
    mkdirSync(join(TMP_HOME, ".config", "goose"), { recursive: true });
    writeFileSync(
      CFG,
      [
        "extensions: # user note",
        "  developer:",
        "    enabled: true",
        "    type: builtin",
        "",
      ].join("\n"),
    );
    adapter.installMcp(SAMPLE);
    const yaml = readFileSync(CFG, "utf8");
    // Exactly one `extensions:` header — no duplicate top-level key.
    const headerMatches = yaml.match(/^extensions:/gm) ?? [];
    expect(headerMatches).toHaveLength(1);
    // Trailing comment preserved.
    expect(yaml).toContain("extensions: # user note");
    // Existing child stays, our block is injected under the same mapping.
    expect(yaml).toContain("developer:");
    expect(yaml).toContain("# bluekiwi:begin");
    // Our block appears between the header and the existing `developer`
    // entry (first child position, preserving the user's structure).
    expect(yaml.indexOf("# bluekiwi:begin")).toBeLessThan(
      yaml.indexOf("developer:"),
    );
  });

  it("install throws on a flow-style `extensions:` mapping instead of corrupting it", () => {
    mkdirSync(join(TMP_HOME, ".config", "goose"), { recursive: true });
    writeFileSync(CFG, "extensions: {developer: {enabled: true}}\n");
    expect(() => adapter.installMcp(SAMPLE)).toThrow(/BlueKiwi cannot merge/);
    // File preserved exactly as the user wrote it.
    expect(readFileSync(CFG, "utf8")).toBe(
      "extensions: {developer: {enabled: true}}\n",
    );
  });
});

// -------- JetBrains (multi-path fan-out) --------
describe("JetbrainsAdapter (fan-out)", () => {
  const JB_BASE = join(TMP_HOME, "Library", "Application Support", "JetBrains");
  let adapter: JetbrainsAdapter;

  beforeEach(() => {
    if (existsSync(JB_BASE)) rmSync(JB_BASE, { recursive: true, force: true });
    adapter = new JetbrainsAdapter();
  });

  it("isInstalled is false when no IDE directories exist", () => {
    expect(adapter.isInstalled()).toBe(false);
  });

  it("isInstalled is false when only non-IDE directories exist", () => {
    mkdirSync(join(JB_BASE, "consentOptions"), { recursive: true });
    mkdirSync(join(JB_BASE, "bl"), { recursive: true });
    expect(adapter.isInstalled()).toBe(false);
  });

  it("isInstalled is true when a known IDE directory exists", () => {
    mkdirSync(join(JB_BASE, "IntelliJIdea2025.2"), { recursive: true });
    expect(adapter.isInstalled()).toBe(true);
  });

  it("installMcp writes to every discovered IDE directory", () => {
    mkdirSync(join(JB_BASE, "IntelliJIdea2025.2"), { recursive: true });
    mkdirSync(join(JB_BASE, "PyCharm2024.1"), { recursive: true });
    mkdirSync(join(JB_BASE, "WebStorm2025.2"), { recursive: true });
    mkdirSync(join(JB_BASE, "consentOptions"), { recursive: true });

    adapter.installMcp(SAMPLE);

    for (const ide of [
      "IntelliJIdea2025.2",
      "PyCharm2024.1",
      "WebStorm2025.2",
    ]) {
      const p = join(JB_BASE, ide, "mcp.json");
      expect(existsSync(p)).toBe(true);
      const cfg = JSON.parse(readFileSync(p, "utf8")) as {
        mcpServers?: Record<string, { command: string }>;
      };
      expect(cfg.mcpServers?.bluekiwi.command).toBe("node");
    }
    // Non-IDE directory must not receive mcp.json.
    expect(existsSync(join(JB_BASE, "consentOptions", "mcp.json"))).toBe(false);
  });

  it("installMcp preserves sibling mcpServers entries in each IDE", () => {
    mkdirSync(join(JB_BASE, "IntelliJIdea2025.2"), { recursive: true });
    writeFileSync(
      join(JB_BASE, "IntelliJIdea2025.2", "mcp.json"),
      JSON.stringify({
        mcpServers: { existing: { command: "x", args: [], env: {} } },
      }),
    );
    adapter.installMcp(SAMPLE);
    const cfg = JSON.parse(
      readFileSync(join(JB_BASE, "IntelliJIdea2025.2", "mcp.json"), "utf8"),
    ) as { mcpServers: Record<string, unknown> };
    expect(cfg.mcpServers.existing).toBeDefined();
    expect(cfg.mcpServers.bluekiwi).toBeDefined();
  });

  it("uninstall removes bluekiwi from every IDE dir", () => {
    mkdirSync(join(JB_BASE, "IntelliJIdea2025.2"), { recursive: true });
    mkdirSync(join(JB_BASE, "PyCharm2024.1"), { recursive: true });
    adapter.installMcp(SAMPLE);
    adapter.uninstall();
    for (const ide of ["IntelliJIdea2025.2", "PyCharm2024.1"]) {
      const cfg = JSON.parse(
        readFileSync(join(JB_BASE, ide, "mcp.json"), "utf8"),
      ) as { mcpServers?: Record<string, unknown> };
      expect(cfg.mcpServers?.bluekiwi).toBeUndefined();
    }
  });

  it("discovery ignores directories not starting with a known IDE prefix", () => {
    mkdirSync(join(JB_BASE, "bluetooth-junk"), { recursive: true });
    mkdirSync(join(JB_BASE, "some-plugin-backup"), { recursive: true });
    mkdirSync(join(JB_BASE, "PyCharm2024.1"), { recursive: true });
    adapter.installMcp(SAMPLE);
    expect(existsSync(join(JB_BASE, "bluetooth-junk", "mcp.json"))).toBe(false);
    expect(existsSync(join(JB_BASE, "some-plugin-backup", "mcp.json"))).toBe(
      false,
    );
    expect(existsSync(join(JB_BASE, "PyCharm2024.1", "mcp.json"))).toBe(true);
  });
});
