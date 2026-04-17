import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";
import { traeUserDir } from "./platform-paths.js";

// Trae (ByteDance) is a VS Code fork; the global mcp.json path is best-effort
// and only the adapter activates when the user data directory exists.
const BASE = traeUserDir();

export class TraeAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "trae",
      displayName: "Trae",
      baseDir: BASE,
      mcpConfigPath: join(BASE, "mcp.json"),
    });
  }
}
