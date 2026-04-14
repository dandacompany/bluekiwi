import { getAllAdapters } from "../runtimes/detect.js";
import pc from "picocolors";

import {
  loadConfig,
  requireConfig,
  requireProfile,
  saveConfig,
} from "../config.js";
import { applyProfileToRuntimes } from "../runtime-sync.js";

async function list() {
  const cfg = loadConfig();
  const installed = new Set(cfg?.runtimes ?? []);
  for (const adapter of getAllAdapters()) {
    const detected = adapter.isInstalled()
      ? pc.green("detected")
      : pc.dim("not installed");
    const active = installed.has(adapter.name)
      ? pc.green("● active")
      : pc.dim("○ inactive");
    console.log(`${adapter.displayName.padEnd(14)} ${detected}  ${active}`);
  }
}

async function add(name: string, profileName?: string) {
  const cfg = requireConfig();
  const { name: resolvedProfile } = requireProfile(cfg, profileName);
  const adapter = getAllAdapters().find((item) => item.name === name);
  if (!adapter) {
    console.error(`Unknown runtime: ${name}`);
    process.exit(1);
  }
  const next = {
    ...cfg,
    active_profile: resolvedProfile,
    runtimes: Array.from(new Set([...cfg.runtimes, name])),
  };
  applyProfileToRuntimes(next, resolvedProfile, [name]);
  saveConfig(next);
  console.log(pc.green(`✓ Installed to ${adapter.displayName}`));
}

async function remove(name: string) {
  const cfg = requireConfig();
  const adapter = getAllAdapters().find((item) => item.name === name);
  if (!adapter) {
    console.error(`Unknown runtime: ${name}`);
    process.exit(1);
  }
  adapter.uninstall();
  saveConfig({
    ...cfg,
    runtimes: cfg.runtimes.filter((runtime) => runtime !== name),
  });
  console.log(pc.green(`✓ Removed ${adapter.displayName}`));
}

export const runtimesCommand = { list, add, remove };
