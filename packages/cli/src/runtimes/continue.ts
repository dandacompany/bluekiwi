import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import type { RuntimeAdapter, SkillBundle, McpServerConfig } from "./base.js";
import {
  installSkills,
  pruneSkills,
  uninstallSkills,
} from "./skills-helper.js";

// Continue.dev loads MCP server "blocks" from ~/.continue/mcpServers/.
// We install a BlueKiwi-owned YAML file so uninstall is a single unlink and
// the user's other MCP servers stay untouched. YAML 1.2 is a superset of
// JSON, so we emit JSON-flavored values to avoid needing a YAML parser.
const BASE = join(homedir(), ".continue");
const SKILLS_DIR = join(BASE, "skills");
const MCP_DIR = join(BASE, "mcpServers");
const MCP_CONFIG = join(MCP_DIR, "bluekiwi.yaml");

function quote(value: string): string {
  return JSON.stringify(value);
}

function buildYaml(config: McpServerConfig): string {
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
    "# Managed by BlueKiwi CLI — do not edit manually.",
    "name: bluekiwi",
    "version: 0.0.1",
    "schema: v1",
    "mcpServers:",
    "  - name: bluekiwi",
    `    command: ${quote(config.command)}`,
    ...argsLines,
    ...envLines,
    "",
  ].join("\n");
}

export class ContinueAdapter implements RuntimeAdapter {
  readonly name = "continue";
  readonly displayName = "Continue.dev";

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
    mkdirSync(MCP_DIR, { recursive: true });
    writeFileSync(MCP_CONFIG, buildYaml(config));
  }

  uninstall(): void {
    uninstallSkills(SKILLS_DIR);
    if (existsSync(MCP_CONFIG)) {
      rmSync(MCP_CONFIG, { force: true });
    }
  }
}
