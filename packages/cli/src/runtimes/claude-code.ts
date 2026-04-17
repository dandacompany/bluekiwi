import { homedir } from "os";
import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";

const BASE = join(homedir(), ".claude");

export class ClaudeCodeAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "claude-code",
      displayName: "Claude Code",
      baseDir: BASE,
      // Claude Code reads MCP from ~/.claude.json (top-level mcpServers).
      mcpConfigPath: join(homedir(), ".claude.json"),
    });
  }
}
