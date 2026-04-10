import pc from "picocolors";

import { clearConfig, loadConfig } from "../config.js";
import { getAllAdapters } from "../runtimes/detect.js";

export async function logoutCommand(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg) {
    console.log(pc.yellow("Already logged out."));
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
