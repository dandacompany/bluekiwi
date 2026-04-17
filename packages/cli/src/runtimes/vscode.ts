import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";
import { vscodeUserDir } from "./platform-paths.js";

// VS Code native MCP support uses the top-level `servers` key (not
// `mcpServers`). Each entry must declare a `type` to distinguish stdio from
// HTTP transports.
const BASE = vscodeUserDir();

export class VscodeAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "vscode",
      displayName: "VS Code",
      baseDir: BASE,
      mcpConfigPath: join(BASE, "mcp.json"),
      serversKey: "servers",
      buildEntry: (config) => ({ type: "stdio", ...config }),
    });
  }
}
