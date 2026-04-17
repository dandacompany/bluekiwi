import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import type { RuntimeAdapter, SkillBundle, McpServerConfig } from "./base.js";
import {
  installSkills,
  pruneSkills,
  uninstallSkills,
} from "./skills-helper.js";

const BASE = join(homedir(), ".codex");
const SKILLS_DIR = join(BASE, "skills");
const MCP_CONFIG = join(BASE, "config.toml");

const SECTION_REGEX =
  /\n?\[mcp_servers\.bluekiwi[\s\S]*?(?=\n\[(?!mcp_servers\.bluekiwi)|$)/g;

export class CodexAdapter implements RuntimeAdapter {
  readonly name = "codex";
  readonly displayName = "Codex CLI";

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
    const envLines = Object.entries(config.env)
      .map(([key, value]) => `${key} = "${value}"`)
      .join("\n");
    const snippet =
      `\n[mcp_servers.bluekiwi]\n` +
      `command = "${config.command}"\n` +
      `args = ${JSON.stringify(config.args)}\n\n` +
      `[mcp_servers.bluekiwi.env]\n${envLines}\n`;
    const existing = existsSync(MCP_CONFIG)
      ? readFileSync(MCP_CONFIG, "utf8")
      : "";
    writeFileSync(MCP_CONFIG, existing.replace(SECTION_REGEX, "") + snippet);
  }

  uninstall(): void {
    if (existsSync(MCP_CONFIG)) {
      const existing = readFileSync(MCP_CONFIG, "utf8");
      writeFileSync(MCP_CONFIG, existing.replace(SECTION_REGEX, ""));
    }
    uninstallSkills(SKILLS_DIR);
  }
}
