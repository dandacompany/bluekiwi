import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const srcAssets = join(here, "..", "src", "assets");
const distAssets = join(here, "..", "dist", "assets");

mkdirSync(distAssets, { recursive: true });
rmSync(join(distAssets, "skills"), { recursive: true, force: true });
rmSync(join(distAssets, "mcp"), { recursive: true, force: true });
rmSync(join(distAssets, "index.ts"), { force: true });
cpSync(join(srcAssets, "skills"), join(distAssets, "skills"), {
  recursive: true,
});

const mcpDist = join(here, "..", "..", "..", "mcp", "dist");
if (existsSync(mcpDist)) {
  cpSync(mcpDist, join(distAssets, "mcp"), { recursive: true });
}

console.log("Assets bundled → dist/assets");
