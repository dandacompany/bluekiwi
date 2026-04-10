import pc from "picocolors";

import { BlueKiwiClient } from "../api-client.js";
import { CONFIG_PATH, loadConfig } from "../config.js";

export async function statusCommand(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg) {
    console.log(pc.yellow(`Not authenticated. No config at ${CONFIG_PATH}.`));
    process.exit(1);
  }

  console.log(`${pc.bold("Server:")}   ${cfg.server_url}`);
  console.log(`${pc.bold("User:")}     ${cfg.user.username} (${cfg.user.role})`);
  console.log(`${pc.bold("Runtimes:")} ${cfg.runtimes.join(", ") || "(none)"}`);

  try {
    const client = new BlueKiwiClient(cfg.server_url, cfg.api_key);
    await client.request("GET", "/api/workflows");
    console.log(pc.green("✓ Connection OK"));
  } catch (err) {
    console.log(pc.red(`✗ Connection failed: ${(err as Error).message}`));
    process.exit(1);
  }
}
