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

const BASE = join(homedir(), ".claude");
const SKILLS_DIR = join(BASE, "skills");
// Claude Code reads MCP config from ~/.claude.json (top-level mcpServers key)
const MCP_CONFIG = join(homedir(), ".claude.json");

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

  pruneSkills(keep: Set<string>): void {
    if (!existsSync(SKILLS_DIR)) return;
    for (const entry of readdirSync(SKILLS_DIR)) {
      if (entry.startsWith("bk-") && !keep.has(entry)) {
        rmSync(join(SKILLS_DIR, entry), { recursive: true, force: true });
      }
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
    if (existsSync(SKILLS_DIR)) {
      for (const entry of readdirSync(SKILLS_DIR)) {
        if (entry.startsWith("bk-")) {
          rmSync(join(SKILLS_DIR, entry), { recursive: true, force: true });
        }
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
