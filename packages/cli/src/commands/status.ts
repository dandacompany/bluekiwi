import pc from "picocolors";

import { BlueKiwiClient } from "../api-client.js";
import { CONFIG_PATH, loadConfig, requireProfile } from "../config.js";

export async function statusCommand(profileName?: string): Promise<void> {
  const cfg = loadConfig();
  if (!cfg) {
    console.log(pc.yellow(`Not authenticated. No config at ${CONFIG_PATH}.`));
    process.exit(1);
  }

  const { name, profile } = requireProfile(cfg, profileName);

  console.log(`${pc.bold("Profile:")}  ${name}${name === cfg.active_profile ? " (active)" : ""}`);
  console.log(`${pc.bold("Server:")}   ${profile.server_url}`);
  console.log(
    `${pc.bold("User:")}     ${profile.user.username} (${profile.user.role})`,
  );
  console.log(`${pc.bold("Runtimes:")} ${cfg.runtimes.join(", ") || "(none)"}`);

  try {
    const client = new BlueKiwiClient(profile.server_url, profile.api_key);
    await client.request("GET", "/api/workflows");
    console.log(pc.green("✓ Connection OK"));
  } catch (err) {
    console.log(pc.red(`✗ Connection failed: ${(err as Error).message}`));
    process.exit(1);
  }
}
