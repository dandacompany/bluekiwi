import pc from "picocolors";

import { clearConfig, loadConfig, removeProfile, saveConfig } from "../config.js";
import { getAllAdapters } from "../runtimes/detect.js";
import { applyProfileToRuntimes } from "../runtime-sync.js";

export async function logoutCommand(profileName?: string): Promise<void> {
  const cfg = loadConfig();
  if (!cfg) {
    console.log(pc.yellow("Already logged out."));
    return;
  }

  if (profileName) {
    const next = removeProfile(cfg, profileName);
    if (!next) {
      for (const adapter of getAllAdapters()) {
        if (cfg.runtimes.includes(adapter.name)) {
          adapter.uninstall();
          console.log(pc.dim(`  removed ${adapter.displayName}`));
        }
      }
      clearConfig();
      console.log(pc.green(`✓ Removed profile '${profileName}' and logged out.`));
      return;
    }

    saveConfig(next);
    if (profileName === cfg.active_profile && next.runtimes.length > 0) {
      applyProfileToRuntimes(next, next.active_profile);
    }
    console.log(
      pc.green(
        `✓ Removed profile '${profileName}'. Active profile: ${next.active_profile}`,
      ),
    );
    return;
  }

  for (const adapter of getAllAdapters()) {
    if (cfg.runtimes.includes(adapter.name)) {
      adapter.uninstall();
      console.log(pc.dim(`  removed ${adapter.displayName}`));
    }
  }

  clearConfig();
  console.log(pc.green("✓ Logged out and uninstalled."));
}
