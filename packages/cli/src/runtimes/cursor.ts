import { homedir } from "os";
import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";

const BASE = join(homedir(), ".cursor");

export class CursorAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "cursor",
      displayName: "Cursor",
      baseDir: BASE,
      mcpConfigPath: join(BASE, "mcp.json"),
    });
  }
}
