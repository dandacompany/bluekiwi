import { BUNDLED_MCP_PATH, BUNDLED_SKILLS } from "./assets/index.js";
import {
  type BluekiwiConfig,
  requireProfile,
} from "./config.js";
import { getAllAdapters } from "./runtimes/detect.js";

export function applyProfileToRuntimes(
  config: BluekiwiConfig,
  profileName?: string | null,
  runtimeNames?: string[],
): string[] {
  const { profile } = requireProfile(config, profileName);
  const targetNames = runtimeNames ?? config.runtimes;
  const allAdapters = getAllAdapters();
  const installed: string[] = [];

  for (const name of targetNames) {
    const adapter = allAdapters.find((item) => item.name === name);
    if (!adapter) continue;
    adapter.installSkills(BUNDLED_SKILLS);
    adapter.installMcp({
      command: "node",
      args: [BUNDLED_MCP_PATH],
      env: {
        BLUEKIWI_API_URL: profile.server_url,
        BLUEKIWI_API_KEY: profile.api_key,
      },
    });
    installed.push(name);
  }

  return installed;
}

export function pruneBundledSkills(config: BluekiwiConfig): void {
  const bundledNames = new Set(BUNDLED_SKILLS.map((skill) => skill.name));
  for (const adapter of getAllAdapters()) {
    if (!config.runtimes.includes(adapter.name)) continue;
    adapter.installSkills(BUNDLED_SKILLS);
    adapter.pruneSkills(bundledNames);
  }
}
