import { getAllAdapters } from "../runtimes/detect.js";
import pc from "picocolors";

import { BUNDLED_MCP_PATH, BUNDLED_SKILLS } from "../assets/index.js";
import { loadConfig, requireConfig, saveConfig } from "../config.js";

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

async function add(name: string) {
  const cfg = requireConfig();
  const adapter = getAllAdapters().find((item) => item.name === name);
  if (!adapter) {
    console.error(`Unknown runtime: ${name}`);
    process.exit(1);
  }
  adapter.installSkills(BUNDLED_SKILLS);
  adapter.installMcp({
    command: "node",
    args: [BUNDLED_MCP_PATH],
    env: { BLUEKIWI_API_URL: cfg.server_url, BLUEKIWI_API_KEY: cfg.api_key },
  });
  saveConfig({
    ...cfg,
    runtimes: Array.from(new Set([...cfg.runtimes, name])),
  });
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
