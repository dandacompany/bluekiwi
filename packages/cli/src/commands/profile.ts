import pc from "picocolors";

import {
  clearConfig,
  loadConfig,
  removeProfile,
  requireConfig,
  requireProfile,
  saveConfig,
} from "../config.js";
import { getAllAdapters } from "../runtimes/detect.js";
import { applyProfileToRuntimes } from "../runtime-sync.js";

async function list(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg) {
    console.log(pc.yellow("No profiles configured."));
    return;
  }

  for (const [name, profile] of Object.entries(cfg.profiles)) {
    const marker = name === cfg.active_profile ? pc.green("●") : pc.dim("○");
    console.log(
      `${marker} ${name}  ${pc.dim(profile.server_url)}  ${profile.user.username} (${profile.user.role})`,
    );
  }
}

async function use(name: string): Promise<void> {
  const cfg = requireConfig();
  requireProfile(cfg, name);

  const next = {
    ...cfg,
    active_profile: name,
  };
  if (next.runtimes.length > 0) {
    applyProfileToRuntimes(next, name);
  }
  saveConfig(next);
  console.log(pc.green(`✓ Active profile switched to '${name}'`));
}

async function remove(name: string): Promise<void> {
  const cfg = requireConfig();
  requireProfile(cfg, name);
  const next = removeProfile(cfg, name);

  if (!next) {
    for (const adapter of getAllAdapters()) {
      if (cfg.runtimes.includes(adapter.name)) {
        adapter.uninstall();
        console.log(pc.dim(`  removed ${adapter.displayName}`));
      }
    }
    clearConfig();
    console.log(pc.green(`✓ Removed profile '${name}' and cleared config.`));
    return;
  }

  saveConfig(next);
  if (cfg.active_profile === name && next.runtimes.length > 0) {
    applyProfileToRuntimes(next, next.active_profile);
  }
  console.log(pc.green(`✓ Removed profile '${name}'`));
}

export const profileCommand = { list, use, remove };
