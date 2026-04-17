import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";
import { vscodeGlobalStorage } from "./platform-paths.js";

// Roo Code is a Cline fork distributed as `rooveterinaryinc.roo-cline`.
const BASE = vscodeGlobalStorage("rooveterinaryinc.roo-cline");

export class RooCodeAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "roo-code",
      displayName: "Roo Code (VS Code)",
      baseDir: BASE,
      mcpConfigPath: join(BASE, "settings", "mcp_settings.json"),
    });
  }
}
