import { existsSync, readdirSync } from "fs";
import { join } from "path";

import { JsonMcpAdapter } from "./json-mcp.js";
import { jetbrainsConfigDir } from "./platform-paths.js";

// JetBrains stores per-IDE config under ~/Library/Application Support/JetBrains/
// (mac) and equivalents on Linux/Windows. Each IDE × version is its own
// directory (e.g. IntelliJIdea2025.2, PyCharm2023.3). MCP config goes in
// `mcp.json` inside that dir, so this adapter fans out across all installed
// JetBrains IDE config dirs.
const BASE = jetbrainsConfigDir();

const KNOWN_IDE_PREFIXES = [
  "IntelliJ",
  "PyCharm",
  "WebStorm",
  "PhpStorm",
  "RubyMine",
  "GoLand",
  "CLion",
  "Rider",
  "DataGrip",
  "DataSpell",
  "AppCode",
  "Aqua",
  "RustRover",
  "MPS",
  "Junie",
];

function discoverIdeDirs(): string[] {
  if (!existsSync(BASE)) return [];
  return readdirSync(BASE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) =>
      KNOWN_IDE_PREFIXES.some((prefix) => entry.name.startsWith(prefix)),
    )
    .map((entry) => join(BASE, entry.name));
}

export class JetbrainsAdapter extends JsonMcpAdapter {
  constructor() {
    super({
      name: "jetbrains",
      displayName: "JetBrains AI",
      baseDir: BASE,
      // Skills sit under the parent dir rather than duplicating across each
      // IDE; JetBrains does not natively load them either way.
      skillsDir: join(BASE, "skills"),
      mcpConfigPath: () =>
        discoverIdeDirs().map((dir) => join(dir, "mcp.json")),
      displayPath: join(BASE, "<each-ide>/mcp.json"),
      isInstalled: () => discoverIdeDirs().length > 0,
    });
  }
}
