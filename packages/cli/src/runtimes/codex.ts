import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";

import type { RuntimeAdapter, SkillBundle, McpServerConfig } from "./base.js";

const BASE = join(homedir(), ".codex");
const SKILLS_DIR = join(BASE, "skills");
const MCP_CONFIG = join(BASE, "config.toml");

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
    mkdirSync(SKILLS_DIR, { recursive: true });
    for (const skill of skills) {
      const dir = join(SKILLS_DIR, skill.name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "SKILL.md"), skill.content);
    }
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
    const stripped = existing.replace(
      /\n?\[mcp_servers\.bluekiwi\][\s\S]*?(?=\n\[|$)/g,
      "",
    );
    writeFileSync(MCP_CONFIG, stripped + snippet);
  }

  uninstall(): void {
    if (existsSync(MCP_CONFIG)) {
      const existing = readFileSync(MCP_CONFIG, "utf8");
      writeFileSync(
        MCP_CONFIG,
        existing.replace(/\n?\[mcp_servers\.bluekiwi\][\s\S]*?(?=\n\[|$)/g, ""),
      );
    }
    if (existsSync(SKILLS_DIR)) {
      for (const entry of readdirSync(SKILLS_DIR)) {
        if (entry.startsWith("bk-")) {
          rmSync(join(SKILLS_DIR, entry), { recursive: true, force: true });
        }
      }
    }
  }
}
