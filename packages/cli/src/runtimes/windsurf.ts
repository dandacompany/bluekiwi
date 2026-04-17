import { homedir } from "os";
import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";

// Windsurf nests user data under ~/.codeium/windsurf (shared Codeium namespace).
const BASE = join(homedir(), ".codeium", "windsurf");

export class WindsurfAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "windsurf",
      displayName: "Windsurf",
      baseDir: BASE,
      mcpConfigPath: join(BASE, "mcp_config.json"),
    });
  }
}
