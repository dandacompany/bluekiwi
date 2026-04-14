import { execFileSync } from "child_process";
import pc from "picocolors";

import { BUNDLED_MCP_PATH, BUNDLED_SKILLS } from "../assets/index.js";
import { loadConfig, saveConfig } from "../config.js";
import { getAllAdapters } from "../runtimes/detect.js";

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

  const bundledNames = new Set(BUNDLED_SKILLS.map((s) => s.name));

  for (const adapter of getAllAdapters()) {
    if (!cfg.runtimes.includes(adapter.name)) continue;
    adapter.installSkills(BUNDLED_SKILLS);
    adapter.pruneSkills(bundledNames);
    adapter.installMcp({
      command: "node",
      args: [BUNDLED_MCP_PATH],
      env: { BLUEKIWI_API_URL: cfg.server_url, BLUEKIWI_API_KEY: cfg.api_key },
    });
  }

  saveConfig({ ...cfg, last_used: new Date().toISOString() });
  console.log(pc.green("✓ Upgraded and reinstalled assets."));
}
