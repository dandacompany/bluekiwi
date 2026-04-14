import { execFileSync } from "child_process";
import pc from "picocolors";

import { loadConfig, saveConfig } from "../config.js";
import { applyProfileToRuntimes, pruneBundledSkills } from "../runtime-sync.js";

export async function upgradeCommand(): Promise<void> {
  console.log(pc.cyan("→ Upgrading bluekiwi..."));
  execFileSync("npm", ["install", "-g", "bluekiwi@latest"], {
    stdio: "inherit",
  });

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
  console.log(pc.green("✓ Upgraded and reinstalled assets."));
}
