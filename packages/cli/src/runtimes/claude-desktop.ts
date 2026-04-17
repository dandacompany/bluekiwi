import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";
import { claudeDesktopConfigDir } from "./platform-paths.js";

// Claude Desktop natively scans the `Skills/` (capital S) subdirectory.
const BASE = claudeDesktopConfigDir();

export class ClaudeDesktopAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "claude-desktop",
      displayName: "Claude Desktop",
      baseDir: BASE,
      skillsDir: join(BASE, "Skills"),
      mcpConfigPath: join(BASE, "claude_desktop_config.json"),
    });
  }
}
