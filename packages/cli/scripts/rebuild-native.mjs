/**
 * rebuild-native.mjs
 * Runs after `npm install -g bluekiwi` to rebuild better-sqlite3
 * for the user's current platform (macOS/Linux/Windows).
 *
 * The npm tarball ships Next.js standalone which includes better-sqlite3
 * JS files but the .node binary may be missing or for the wrong platform.
 * This script downloads the correct prebuilt binary via prebuild-install,
 * falling back to node-gyp if no prebuilt is available.
 */
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const sqliteDir = join(
  here,
  "..",
  "dist",
  "assets",
  "app-runtime",
  "node_modules",
  "better-sqlite3",
);

if (!existsSync(sqliteDir)) {
  // No app-runtime bundled (e.g. MCP-only install) — nothing to do
  process.exit(0);
}

const binaryPath = join(sqliteDir, "build", "Release", "better_sqlite3.node");

// Check if a valid binary already exists for this platform
if (existsSync(binaryPath)) {
  try {
    // Quick sanity: try to dlopen it
    process.dlopen({ exports: {} }, binaryPath);
    // Binary loads fine — skip rebuild
    process.exit(0);
  } catch {
    // Binary exists but wrong platform — rebuild
  }
}

console.log("[bluekiwi] Rebuilding better-sqlite3 for your platform...");

try {
  execFileSync("npx", ["-y", "prebuild-install"], {
    cwd: sqliteDir,
    stdio: "pipe",
    timeout: 60_000,
  });
  console.log("[bluekiwi] better-sqlite3 native binary installed.");
} catch {
  // prebuild-install failed — try node-gyp as fallback
  try {
    execFileSync("npx", ["node-gyp", "rebuild", "--release"], {
      cwd: sqliteDir,
      stdio: "pipe",
      timeout: 120_000,
    });
    console.log("[bluekiwi] better-sqlite3 built from source.");
  } catch (e) {
    console.warn(
      "[bluekiwi] Warning: Could not build better-sqlite3 native module.",
    );
    console.warn(
      "  The 'bluekiwi start' command (local SQLite mode) may not work.",
    );
    console.warn("  Docker mode is unaffected.");
    console.warn(`  Error: ${e.message ?? e}`);
    // Don't fail the install — CLI commands other than `start` still work
  }
}
