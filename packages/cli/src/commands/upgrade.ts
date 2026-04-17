import { execFileSync } from "child_process";
import { createRequire } from "node:module";
import pc from "picocolors";

import { formatVersionLine, printLogo } from "../branding.js";
import { loadConfig, saveConfig } from "../config.js";
import { getLatestVersion, getReleaseNotes } from "../release-notes.js";
import { applyProfileToRuntimes, pruneBundledSkills } from "../runtime-sync.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

function printReleaseSection(
  notes: Awaited<ReturnType<typeof getReleaseNotes>>,
) {
  if (!notes) return;
  console.log("");
  console.log(pc.bold(`📦 What's new in ${notes.tag}`));
  console.log(pc.dim("─".repeat(50)));

  if (notes.body) {
    console.log(notes.body);
  } else if (notes.commits && notes.commits.length > 0) {
    for (const commit of notes.commits) {
      console.log(`  ${pc.dim(commit.sha)}  ${commit.message}`);
    }
  }

  console.log(pc.dim("─".repeat(50)));
  console.log(pc.dim(`Full changelog: ${notes.compareUrl}`));
}

export async function upgradeCommand(): Promise<void> {
  printLogo({ subtitle: "Upgrade" });

  const currentVersion = pkg.version;
  console.log(pc.cyan("→ Checking for updates..."));
  const latestVersion = await getLatestVersion();

  console.log(formatVersionLine(currentVersion, latestVersion));

  if (latestVersion && latestVersion === currentVersion) {
    console.log("");
    console.log(pc.green("✓ Already on the latest version."));
    syncConfig();
    return;
  }

  console.log("");
  console.log(pc.cyan("→ Installing latest bluekiwi..."));
  execFileSync("npm", ["install", "-g", "bluekiwi@latest"], {
    stdio: "inherit",
  });

  syncConfig();

  if (latestVersion && latestVersion !== currentVersion) {
    const notes = await getReleaseNotes(currentVersion, latestVersion);
    printReleaseSection(notes);
  }

  console.log("");
  console.log(
    pc.green(
      `✓ Upgraded${latestVersion ? ` to v${latestVersion}` : ""} and reinstalled assets.`,
    ),
  );
}

function syncConfig(): void {
  const cfg = loadConfig();
  if (!cfg) {
    console.log(
      pc.yellow(
        "No config found. Run `bluekiwi accept` or `bluekiwi init` next.",
      ),
    );
    return;
  }

  pruneBundledSkills(cfg);
  applyProfileToRuntimes(cfg, cfg.active_profile);
  const active = cfg.profiles[cfg.active_profile];

  saveConfig({
    ...cfg,
    profiles: active
      ? {
          ...cfg.profiles,
          [cfg.active_profile]: {
            ...active,
            last_used: new Date().toISOString(),
          },
        }
      : cfg.profiles,
  });
}
