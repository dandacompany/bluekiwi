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

function injectBlock(existing: string, block: string): string {
  const stripped = existing.replace(SENTINEL_REGEX, "\n");
  if (/^extensions:\s*$/m.test(stripped)) {
    return stripped.replace(/^extensions:\s*$/m, `extensions:\n${block}`);
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
