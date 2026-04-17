import { homedir } from "os";
import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";

const BASE = join(homedir(), ".opencode");

export class OpenCodeAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "opencode",
      displayName: "OpenCode",
      baseDir: BASE,
      mcpConfigPath: join(BASE, "mcp.json"),
    });
  }
}
