import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import type { RuntimeAdapter, SkillBundle, McpServerConfig } from "./base.js";
import {
  installSkills,
  pruneSkills,
  uninstallSkills,
} from "./skills-helper.js";

// Goose keeps all config in a single ~/.config/goose/config.yaml file.
// We merge into the `extensions:` mapping using sentinel-marker blocks so
// install/uninstall are idempotent and leave the user's other extensions
// untouched (mirrors the Codex TOML strategy).
const BASE = join(homedir(), ".config", "goose");
const SKILLS_DIR = join(BASE, "skills");
const MCP_CONFIG = join(BASE, "config.yaml");

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
      ? ["    envs: {}"]
      : [
          "    envs:",
          ...envEntries.map(([k, v]) => `      ${quote(k)}: ${quote(v)}`),
        ];
  return [
    SENTINEL_BEGIN,
    "  bluekiwi:",
    "    enabled: true",
    "    name: bluekiwi",
    "    type: stdio",
    `    cmd: ${quote(config.command)}`,
    ...argsLines,
    ...envLines,
    "    timeout: 300",
    "    bundled: false",
    "    description: BlueKiwi MCP client",
    SENTINEL_END,
    "",
  ].join("\n");
}

// Block-style `extensions:` header: "extensions:" alone on a line, optionally
// followed by whitespace and/or a trailing `# comment`. Children may appear
// on subsequent lines — this only matches the header itself.
const BLOCK_HEADER_REGEX = /^extensions:[ \t]*(?:#[^\n]*)?$/m;
// Flow-style header: `extensions: {...}` or `extensions: [...]`. We cannot
// merge into these safely without a YAML parser.
const FLOW_HEADER_REGEX = /^extensions:[ \t]*[[{]/m;
// Catch-all: any top-of-line `extensions:`, used to detect headers our
// block-style regex missed so we fail closed instead of appending a
// duplicate top-level key.
const ANY_HEADER_REGEX = /^extensions:/m;

function injectBlock(existing: string, block: string): string {
  const stripped = existing.replace(SENTINEL_REGEX, "\n");
  const blockMatch = stripped.match(BLOCK_HEADER_REGEX);
  if (blockMatch && blockMatch.index !== undefined) {
    // Insert our sentinel block as the first child so existing entries below
    // stay intact. Preserving the trailing comment (if any) means the line
    // stays byte-for-byte as the user wrote it.
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
      "Goose config has an `extensions:` mapping that BlueKiwi cannot merge safely. " +
        "Convert it to block style (e.g. `extensions:` on its own line) or remove " +
        "it before running this command.",
    );
  }
  const separator = stripped.length > 0 && !stripped.endsWith("\n") ? "\n" : "";
  return `${stripped}${separator}extensions:\n${block}`;
}

export class GooseAdapter implements RuntimeAdapter {
  readonly name = "goose";
  readonly displayName = "Goose";

  isInstalled(): boolean {
    return existsSync(BASE);
  }

  getSkillsDir(): string {
    return SKILLS_DIR;
  }

  getMcpConfigPath(): string {
    return MCP_CONFIG;
  }

  installSkills(skills: SkillBundle[]): void {
    installSkills(SKILLS_DIR, skills);
  }

  pruneSkills(keep: Set<string>): void {
    pruneSkills(SKILLS_DIR, keep);
  }

  installMcp(config: McpServerConfig): void {
    mkdirSync(BASE, { recursive: true });
    const existing = existsSync(MCP_CONFIG)
      ? readFileSync(MCP_CONFIG, "utf8")
      : "";
    writeFileSync(MCP_CONFIG, injectBlock(existing, buildBlock(config)));
  }

  uninstall(): void {
    uninstallSkills(SKILLS_DIR);
    if (existsSync(MCP_CONFIG)) {
      const existing = readFileSync(MCP_CONFIG, "utf8");
      writeFileSync(MCP_CONFIG, existing.replace(SENTINEL_REGEX, "\n"));
    }
  }
}
