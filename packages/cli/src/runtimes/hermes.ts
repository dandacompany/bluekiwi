import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";

import type { RuntimeAdapter, SkillBundle, McpServerConfig } from "./base.js";
import {
  installSkills,
  pruneSkills,
  uninstallSkills,
} from "./skills-helper.js";

// Hermes keeps per-instance config in <base>/config.yaml with a top-level
// `mcp_servers:` mapping (stdio keys: command/args/env). We merge into it
// using sentinel-marker blocks so install/uninstall are idempotent and
// leave the user's other servers untouched (mirrors the Goose strategy).
// Profiles under ~/.hermes/profiles/<name>/ are full instance trees, so the
// same adapter works for both by parameterizing baseDir.

const SENTINEL_BEGIN = "  # bluekiwi:begin — managed by BlueKiwi CLI";
const SENTINEL_END = "  # bluekiwi:end";
const SENTINEL_REGEX =
  /\n?[ \t]*# bluekiwi:begin[^\n]*\n[\s\S]*?[ \t]*# bluekiwi:end[^\n]*\n?/;

function quote(value: string): string {
  return JSON.stringify(value);
}

function buildBlock(config: McpServerConfig): string {
  const argsLines =
    config.args.length === 0
      ? ["    args: []"]
      : ["    args:", ...config.args.map((a) => `      - ${quote(a)}`)];
  const envEntries = Object.entries(config.env);
  const envLines =
    envEntries.length === 0
      ? ["    env: {}"]
      : [
          "    env:",
          ...envEntries.map(([k, v]) => `      ${quote(k)}: ${quote(v)}`),
        ];
  return [
    SENTINEL_BEGIN,
    "  bluekiwi:",
    `    command: ${quote(config.command)}`,
    ...argsLines,
    ...envLines,
    SENTINEL_END,
    "",
  ].join("\n");
}

// Block-style `mcp_servers:` header: alone on a line, optionally followed
// by whitespace and/or a trailing `# comment`.
const BLOCK_HEADER_REGEX = /^mcp_servers:[ \t]*(?:#[^\n]*)?$/m;
// An EMPTY flow mapping (`mcp_servers: {}`) merges unambiguously — we can
// rewrite it to block style and take the header. Hermes writes this shape
// into fresh configs, so it must not fail closed.
const EMPTY_FLOW_REGEX = /^mcp_servers:[ \t]*\{[ \t]*\}[ \t]*(#[^\n]*)?$/m;
// NON-empty flow-style header: `mcp_servers: {...}` or `[...]` — cannot
// merge safely without a YAML parser.
const FLOW_HEADER_REGEX = /^mcp_servers:[ \t]*[[{]/m;
// Catch-all so unrecognized header shapes fail closed instead of appending
// a duplicate top-level key.
const ANY_HEADER_REGEX = /^mcp_servers:/m;

function injectBlock(existing: string, block: string): string {
  let stripped = existing.replace(SENTINEL_REGEX, "\n");
  const emptyFlow = stripped.match(EMPTY_FLOW_REGEX);
  if (emptyFlow && emptyFlow.index !== undefined) {
    const comment = emptyFlow[1] ? ` ${emptyFlow[1]}` : "";
    stripped =
      stripped.slice(0, emptyFlow.index) +
      `mcp_servers:${comment}` +
      stripped.slice(emptyFlow.index + emptyFlow[0].length);
  }
  const blockMatch = stripped.match(BLOCK_HEADER_REGEX);
  if (blockMatch && blockMatch.index !== undefined) {
    const insertAt = blockMatch.index + blockMatch[0].length;
    return (
      stripped.slice(0, insertAt) +
      "\n" +
      block.replace(/\n$/, "") +
      stripped.slice(insertAt)
    );
  }
  if (FLOW_HEADER_REGEX.test(stripped) || ANY_HEADER_REGEX.test(stripped)) {
    throw new Error(
      "Hermes config has an `mcp_servers:` mapping that BlueKiwi cannot merge safely. " +
        "Convert it to block style (e.g. `mcp_servers:` on its own line) or remove " +
        "it before running this command.",
    );
  }
  const separator = stripped.length > 0 && !stripped.endsWith("\n") ? "\n" : "";
  return `${stripped}${separator}mcp_servers:\n${block}`;
}

export interface HermesAdapterOptions {
  name: string;
  displayName: string;
  baseDir: string;
}

export class HermesAdapter implements RuntimeAdapter {
  readonly name: string;
  readonly displayName: string;
  private readonly baseDir: string;

  constructor(options: HermesAdapterOptions) {
    this.name = options.name;
    this.displayName = options.displayName;
    this.baseDir = options.baseDir;
  }

  isInstalled(): boolean {
    return existsSync(this.baseDir);
  }

  getSkillsDir(): string {
    return join(this.baseDir, "skills");
  }

  getMcpConfigPath(): string {
    return join(this.baseDir, "config.yaml");
  }

  installSkills(skills: SkillBundle[]): void {
    installSkills(this.getSkillsDir(), skills);
  }

  pruneSkills(keep: Set<string>): void {
    pruneSkills(this.getSkillsDir(), keep);
  }

  installMcp(config: McpServerConfig): void {
    mkdirSync(this.baseDir, { recursive: true });
    const configPath = this.getMcpConfigPath();
    const existing = existsSync(configPath)
      ? readFileSync(configPath, "utf8")
      : "";
    writeFileSync(configPath, injectBlock(existing, buildBlock(config)));
  }

  uninstall(): void {
    uninstallSkills(this.getSkillsDir());
    const configPath = this.getMcpConfigPath();
    if (existsSync(configPath)) {
      const existing = readFileSync(configPath, "utf8");
      writeFileSync(configPath, existing.replace(SENTINEL_REGEX, "\n"));
    }
  }
}

const HERMES_BASE = join(homedir(), ".hermes");
const PROFILES_DIR = join(HERMES_BASE, "profiles");

export function getHermesAdapters(): RuntimeAdapter[] {
  const adapters: RuntimeAdapter[] = [
    new HermesAdapter({
      name: "hermes",
      displayName: "Hermes",
      baseDir: HERMES_BASE,
    }),
  ];
  if (!existsSync(PROFILES_DIR)) return adapters;
  const profiles = readdirSync(PROFILES_DIR)
    .filter((entry) => {
      try {
        return statSync(join(PROFILES_DIR, entry)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
  for (const profile of profiles) {
    adapters.push(
      new HermesAdapter({
        name: `hermes:${profile}`,
        displayName: `Hermes (${profile})`,
        baseDir: join(PROFILES_DIR, profile),
      }),
    );
  }
  return adapters;
}
