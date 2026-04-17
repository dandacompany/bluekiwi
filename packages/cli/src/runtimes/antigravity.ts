import { homedir } from "os";
import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";

const BASE = join(homedir(), ".antigravity");

export class AntigravityAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "antigravity",
      displayName: "Antigravity",
      baseDir: BASE,
      mcpConfigPath: join(BASE, "mcp.json"),
    });
  }
}
