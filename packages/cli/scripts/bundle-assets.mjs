import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const srcAssets = join(here, "..", "src", "assets");
const distAssets = join(here, "..", "dist", "assets");
const root = join(here, "..", "..", "..");

mkdirSync(distAssets, { recursive: true });
rmSync(join(distAssets, "skills"), { recursive: true, force: true });
rmSync(join(distAssets, "mcp"), { recursive: true, force: true });
rmSync(join(distAssets, "app-runtime"), { recursive: true, force: true });
rmSync(join(distAssets, "index.ts"), { force: true });
cpSync(join(srcAssets, "skills"), join(distAssets, "skills"), {
  recursive: true,
});

const mcpDist = join(here, "..", "..", "..", "mcp", "dist");
if (existsSync(mcpDist)) {
  cpSync(mcpDist, join(distAssets, "mcp"), { recursive: true });
}

const standaloneDist = join(root, ".next", "standalone");
if (existsSync(join(standaloneDist, "server.js"))) {
  const appRuntimeDist = join(distAssets, "app-runtime");
  cpSync(standaloneDist, appRuntimeDist, { recursive: true });

  const nextStaticDist = join(root, ".next", "static");
  if (existsSync(nextStaticDist)) {
    mkdirSync(join(appRuntimeDist, ".next"), { recursive: true });
    cpSync(nextStaticDist, join(appRuntimeDist, ".next", "static"), {
      recursive: true,
    });
  }

  const publicDir = join(root, "public");
  if (existsSync(publicDir)) {
    cpSync(publicDir, join(appRuntimeDist, "public"), { recursive: true });
  }

  // Remove platform-specific native binaries — postinstall downloads the correct one
  const sqliteBuild = join(
    appRuntimeDist,
    "node_modules",
    "better-sqlite3",
    "build",
  );
  if (existsSync(sqliteBuild)) {
    rmSync(sqliteBuild, { recursive: true, force: true });
    console.log(
      "  Stripped better-sqlite3 native binary (postinstall will rebuild)",
    );
  }
}

console.log("Assets bundled → dist/assets");
