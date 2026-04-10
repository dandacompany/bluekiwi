import { cpSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const srcAssets = join(here, "..", "src", "assets");
const distAssets = join(here, "..", "dist", "assets");

mkdirSync(distAssets, { recursive: true });
cpSync(srcAssets, distAssets, { recursive: true });

const mcpDist = join(here, "..", "..", "..", "mcp", "dist");
if (existsSync(mcpDist)) {
  cpSync(mcpDist, join(distAssets, "mcp"), { recursive: true });
}

console.log("Assets bundled → dist/assets");
