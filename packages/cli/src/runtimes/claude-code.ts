import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import type { RuntimeAdapter, SkillBundle, McpServerConfig } from "./base.js";

const BASE = join(homedir(), ".claude");
const SKILLS_DIR = join(BASE, "skills");
const MCP_CONFIG = join(BASE, "mcp.json");

export class ClaudeCodeAdapter implements RuntimeAdapter {
  readonly name = "claude-code";
  readonly displayName = "Claude Code";

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
    let existing: { mcpServers?: Record<string, McpServerConfig> } = {};
    if (existsSync(MCP_CONFIG)) {
      try {
        existing = JSON.parse(readFileSync(MCP_CONFIG, "utf8"));
      } catch {}
    }
    existing.mcpServers = existing.mcpServers ?? {};
    existing.mcpServers.bluekiwi = config;
    mkdirSync(BASE, { recursive: true });
    writeFileSync(MCP_CONFIG, JSON.stringify(existing, null, 2));
  }

  uninstall(): void {
    for (const name of ["bk-start", "bk-next", "bk-status", "bk-rewind"]) {
      const dir = join(SKILLS_DIR, name);
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    if (existsSync(MCP_CONFIG)) {
      try {
        const config = JSON.parse(readFileSync(MCP_CONFIG, "utf8")) as {
          mcpServers?: Record<string, unknown>;
        };
        delete config.mcpServers?.bluekiwi;
        writeFileSync(MCP_CONFIG, JSON.stringify(config, null, 2));
      } catch {}
    }
  }
}
