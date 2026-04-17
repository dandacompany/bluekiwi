import { homedir } from "os";
import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";

const BASE = join(homedir(), ".gemini");

export class GeminiCliAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "gemini-cli",
      displayName: "Gemini CLI",
      baseDir: BASE,
      mcpConfigPath: join(BASE, "settings.json"),
    });
  }
}
