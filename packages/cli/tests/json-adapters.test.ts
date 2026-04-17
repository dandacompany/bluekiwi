import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
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

// The adapter modules capture homedir() at import-time for module-level
// constants (e.g. `const BASE = join(homedir(), ".claude")`). We therefore
// mock `os.homedir` BEFORE importing any adapter, so every BASE resolves to
// our tmp home.
const { TMP_HOME } = vi.hoisted(() => {
  // Require inside hoisted so it runs before ESM imports.
  const path: typeof import("path") = require("path");
  const osLib: typeof import("os") = require("os");
  return {
    TMP_HOME: path.join(
      osLib.tmpdir(),
      `bk-cli-json-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    ),
  };
});

vi.mock("os", async () => {
  const actual = await vi.importActual<typeof import("os")>("os");
  return { ...actual, homedir: () => TMP_HOME };
});

import { AntigravityAdapter } from "../src/runtimes/antigravity.js";
import { ClaudeCodeAdapter } from "../src/runtimes/claude-code.js";
import { ClaudeDesktopAdapter } from "../src/runtimes/claude-desktop.js";
import { ClineAdapter } from "../src/runtimes/cline.js";
import { CursorAdapter } from "../src/runtimes/cursor.js";
import { GeminiCliAdapter } from "../src/runtimes/gemini-cli.js";
import { OpenClawAdapter } from "../src/runtimes/openclaw.js";
import { OpenCodeAdapter } from "../src/runtimes/opencode.js";
import { RooCodeAdapter } from "../src/runtimes/roo-code.js";
import { TraeAdapter } from "../src/runtimes/trae.js";
import { VscodeAdapter } from "../src/runtimes/vscode.js";
import { WindsurfAdapter } from "../src/runtimes/windsurf.js";
import { ZedAdapter } from "../src/runtimes/zed.js";
import type { RuntimeAdapter } from "../src/runtimes/base.js";

beforeAll(() => {
  mkdirSync(TMP_HOME, { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true, force: true });
});

interface Spec {
  name: string;
  make: () => RuntimeAdapter;
  /** Expected top-level JSON key holding the server map. */
  serversKey: string;
  /** Whether installed entries get a `type` field auto-injected. */
  hasTypeField?: boolean;
}

const SPECS: Spec[] = [
  {
    name: "ClaudeCode",
    make: () => new ClaudeCodeAdapter(),
    serversKey: "mcpServers",
  },
  {
    name: "GeminiCli",
    make: () => new GeminiCliAdapter(),
    serversKey: "mcpServers",
  },
  {
    name: "OpenCode",
    make: () => new OpenCodeAdapter(),
    serversKey: "mcpServers",
  },
  {
    name: "OpenClaw",
    make: () => new OpenClawAdapter(),
    serversKey: "mcpServers",
  },
  { name: "Cursor", make: () => new CursorAdapter(), serversKey: "mcpServers" },
  {
    name: "Antigravity",
    make: () => new AntigravityAdapter(),
    serversKey: "mcpServers",
  },
  {
    name: "Windsurf",
    make: () => new WindsurfAdapter(),
    serversKey: "mcpServers",
  },
  {
    name: "ClaudeDesktop",
    make: () => new ClaudeDesktopAdapter(),
    serversKey: "mcpServers",
  },
  { name: "Cline", make: () => new ClineAdapter(), serversKey: "mcpServers" },
  {
    name: "RooCode",
    make: () => new RooCodeAdapter(),
    serversKey: "mcpServers",
  },
  { name: "Trae", make: () => new TraeAdapter(), serversKey: "mcpServers" },
  {
    name: "VsCode",
    make: () => new VscodeAdapter(),
    serversKey: "servers",
    hasTypeField: true,
  },
  { name: "Zed", make: () => new ZedAdapter(), serversKey: "context_servers" },
];

const SAMPLE_CONFIG = {
  command: "node",
  args: ["/path/to/bluekiwi-mcp.js"],
  env: { BLUEKIWI_API_KEY: "bk_test", BLUEKIWI_API_URL: "https://x.io" },
};

function readAdapterJson(adapter: RuntimeAdapter): Record<string, unknown> {
  const p = adapter.getMcpConfigPath();
  expect(existsSync(p)).toBe(true);
  return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
}

describe.each(SPECS)("$name adapter", (spec) => {
  let adapter: RuntimeAdapter;

  beforeEach(() => {
    adapter = spec.make();
    // Wipe only this adapter's subtree so adapters don't interfere with
    // each other across tests (they all share TMP_HOME).
    if (existsSync(adapter.getMcpConfigPath())) {
      rmSync(adapter.getMcpConfigPath(), { force: true });
    }
  });

  it("reports `not installed` when base directory is missing", () => {
    const baseGuess = adapter.getSkillsDir().replace(/\/skills$/i, "");
    if (existsSync(baseGuess))
      rmSync(baseGuess, { recursive: true, force: true });
    expect(adapter.isInstalled()).toBe(false);
  });

  it("installMcp creates config with correct top-level key and entry", () => {
    adapter.installMcp(SAMPLE_CONFIG);
    const cfg = readAdapterJson(adapter);
    const servers = cfg[spec.serversKey] as Record<string, unknown>;
    expect(servers).toBeDefined();
    const entry = servers.bluekiwi as Record<string, unknown>;
    expect(entry.command).toBe(SAMPLE_CONFIG.command);
    expect(entry.args).toEqual(SAMPLE_CONFIG.args);
    expect(entry.env).toEqual(SAMPLE_CONFIG.env);
    if (spec.hasTypeField) {
      expect(entry.type).toBe("stdio");
    }
  });

  it("installMcp preserves user's unrelated top-level keys and sibling servers", () => {
    // Seed existing config the way a user might have it.
    const p = adapter.getMcpConfigPath();
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(
      p,
      JSON.stringify({
        userPref: "hello",
        [spec.serversKey]: {
          existingServer: { command: "other", args: [], env: {} },
        },
      }),
    );

    adapter.installMcp(SAMPLE_CONFIG);
    const cfg = readAdapterJson(adapter);
    expect(cfg.userPref).toBe("hello");
    const servers = cfg[spec.serversKey] as Record<string, unknown>;
    expect(servers.existingServer).toBeDefined();
    expect(servers.bluekiwi).toBeDefined();
  });

  it("installMcp is idempotent: re-install replaces, does not duplicate", () => {
    adapter.installMcp(SAMPLE_CONFIG);
    adapter.installMcp({ ...SAMPLE_CONFIG, args: ["updated"] });
    const cfg = readAdapterJson(adapter);
    const servers = cfg[spec.serversKey] as Record<string, unknown>;
    const entry = servers.bluekiwi as Record<string, unknown>;
    expect(entry.args).toEqual(["updated"]);
    // No duplicate keys possible in JSON; sanity-check there's exactly one.
    expect(Object.keys(servers).filter((k) => k === "bluekiwi")).toHaveLength(
      1,
    );
  });

  it("uninstall removes the bluekiwi entry but keeps sibling servers", () => {
    const p = adapter.getMcpConfigPath();
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(
      p,
      JSON.stringify({
        [spec.serversKey]: {
          keepMe: { command: "x", args: [], env: {} },
        },
      }),
    );
    adapter.installMcp(SAMPLE_CONFIG);
    adapter.uninstall();
    const cfg = readAdapterJson(adapter);
    const servers = cfg[spec.serversKey] as Record<string, unknown>;
    expect(servers.bluekiwi).toBeUndefined();
    expect(servers.keepMe).toBeDefined();
  });

  it("uninstall is a no-op when no config file exists", () => {
    if (existsSync(adapter.getMcpConfigPath())) {
      rmSync(adapter.getMcpConfigPath(), { force: true });
    }
    expect(() => adapter.uninstall()).not.toThrow();
  });

  it("skills install + prune round-trip", () => {
    adapter.installSkills([
      { name: "bk-a", content: "A" },
      { name: "bk-b", content: "B" },
    ]);
    adapter.pruneSkills(new Set(["bk-a"]));
    expect(existsSync(join(adapter.getSkillsDir(), "bk-a"))).toBe(true);
    expect(existsSync(join(adapter.getSkillsDir(), "bk-b"))).toBe(false);
  });
});

// Regression for Codex finding bfdvg840k: JsonMcpAdapter.readJson used to
// swallow JSON.parse failures and return `{}`. installMcp/uninstall would
// then rewrite `{}` back to disk, silently erasing every other key (theme,
// unrelated MCP servers, editor preferences) in malformed config files.
// The fail-closed behavior is verified against one representative adapter
// because the logic lives in the shared base class.
describe("JsonMcpAdapter.readJson — fail-closed on parse errors", () => {
  const adapter = new CursorAdapter();
  const cfg = adapter.getMcpConfigPath();
  const corrupt = '{"mcpServers": { "other": { "command": "x",}\n// cut off';

  beforeEach(() => {
    mkdirSync(join(cfg, ".."), { recursive: true });
    writeFileSync(cfg, corrupt);
  });

  it("installMcp throws when the existing config is malformed JSON", () => {
    expect(() =>
      adapter.installMcp({
        command: "node",
        args: [],
        env: {},
      }),
    ).toThrow(/cannot parse existing MCP config/);
  });

  it("installMcp leaves the malformed file byte-identical", () => {
    try {
      adapter.installMcp({ command: "node", args: [], env: {} });
    } catch {
      /* expected */
    }
    expect(readFileSync(cfg, "utf8")).toBe(corrupt);
  });

  it("uninstall throws and preserves the file rather than erasing it", () => {
    expect(() => adapter.uninstall()).toThrow(
      /cannot parse existing MCP config/,
    );
    expect(readFileSync(cfg, "utf8")).toBe(corrupt);
  });
});
