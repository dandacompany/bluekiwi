import { homedir } from "os";
import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";

// Zed uses XDG-style paths on macOS too. Top-level key is `context_servers`.
const BASE = join(homedir(), ".config", "zed");

export class ZedAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "zed",
      displayName: "Zed",
      baseDir: BASE,
      mcpConfigPath: join(BASE, "settings.json"),
      serversKey: "context_servers",
    });
  }
}
