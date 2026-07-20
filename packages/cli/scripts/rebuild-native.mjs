/**
 * rebuild-native.mjs
 * Runs after `npm install -g bluekiwi` to download the correct
 * better-sqlite3 prebuilt binary for the user's platform.
 *
 * The npm tarball intentionally excludes the .node binary
 * (stripped by bundle-assets.mjs) so every platform gets
 * the right one via prebuild-install at install time.
 *
 * prebuild-install and node-gyp ship as regular dependencies of this
 * package and are invoked via their resolved bin paths with the current
 * node executable. Spawning `npx -y <tool>` here is NOT safe: npm 11.13+
 * (Node 24) creates ephemeral ~/.npm/_npx work dirs without a
 * package.json during a postinstall context, so npx itself dies with
 * ENOENT before the tool even runs. npx remains only as a last-resort
 * fallback for layouts where local resolution fails.
 */
import { execFileSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { createRequire } from "module";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
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
  process.exit(0);
}

mkdirSync(join(sqliteDir, "build", "Release"), { recursive: true });

const isWin = process.platform === "win32";

// Resolve a dependency's bin script to an absolute path so we can run it
// with process.execPath directly (no npx, no PATH, no .cmd shims).
function resolveBin(pkg, binName) {
  const pkgJsonPath = require.resolve(`${pkg}/package.json`);
  const pkgJson = require(pkgJsonPath);
  const bin =
    typeof pkgJson.bin === "string" ? pkgJson.bin : pkgJson.bin?.[binName];
  if (!bin) throw new Error(`no bin '${binName}' in ${pkg}`);
  return join(dirname(pkgJsonPath), bin);
}

// Try the locally-resolved bin first; fall back to npx only if the
// dependency cannot be resolved (unusual install layouts).
function runTool(pkg, binName, extraArgs, timeout) {
  let bin;
  try {
    bin = resolveBin(pkg, binName);
  } catch {
    console.log(`[bluekiwi] ${pkg} not resolvable locally, trying npx...`);
    execFileSync("npx", ["-y", binName, ...extraArgs], {
      cwd: sqliteDir,
      stdio: "inherit",
      shell: isWin,
      timeout,
    });
    return;
  }
  execFileSync(process.execPath, [bin, ...extraArgs], {
    cwd: sqliteDir,
    stdio: "inherit",
    timeout,
  });
}

console.log(
  `[bluekiwi] Installing better-sqlite3 for ${process.platform}-${process.arch}...`,
);

try {
  runTool("prebuild-install", "prebuild-install", [], 60_000);
  console.log("[bluekiwi] better-sqlite3 native binary ready.");
} catch {
  try {
    console.log(
      "[bluekiwi] No prebuilt binary for this platform/Node ABI, compiling from source...",
    );
    runTool("node-gyp", "node-gyp", ["rebuild", "--release"], 300_000);
    console.log("[bluekiwi] better-sqlite3 compiled successfully.");
  } catch (e) {
    console.error(
      "[bluekiwi] ERROR: Could not build better-sqlite3 native module.",
    );
    console.error("  'bluekiwi start' (local SQLite mode) will not work.");
    console.error(
      "  Retry with: cd $(npm root -g)/bluekiwi && node scripts/rebuild-native.mjs",
    );
    console.error("  Docker mode is unaffected.");
    console.error(`  Error: ${e.message ?? e}`);
    process.exit(1);
  }
}
