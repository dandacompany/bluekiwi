import { homedir } from "os";
import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";

const BASE = join(homedir(), ".openclaw");

export class OpenClawAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "openclaw",
      displayName: "OpenClaw",
      baseDir: BASE,
      mcpConfigPath: join(BASE, "mcp.json"),
    });
  }
}
