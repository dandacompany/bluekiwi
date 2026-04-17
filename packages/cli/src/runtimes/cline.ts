import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";
import { vscodeGlobalStorage } from "./platform-paths.js";

// Cline is the VS Code extension `saoudrizwan.claude-dev`. Its MCP settings
// file lives in the extension's globalStorage under settings/.
const BASE = vscodeGlobalStorage("saoudrizwan.claude-dev");

export class ClineAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "cline",
      displayName: "Cline (VS Code)",
      baseDir: BASE,
      mcpConfigPath: join(BASE, "settings", "cline_mcp_settings.json"),
    });
  }
}
