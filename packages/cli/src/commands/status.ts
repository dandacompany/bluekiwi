import pc from "picocolors";

import { BlueKiwiClient } from "../api-client.js";
import { CONFIG_PATH, loadConfig, requireProfile } from "../config.js";
import { getLocalRuntimeStatus } from "../local-runtime.js";

export async function statusCommand(profileName?: string): Promise<void> {
  const local = await getLocalRuntimeStatus(profileName);
  if (local.record) {
    console.log(
      `${pc.bold("Local runtime:")} ${local.running ? pc.green("running") : pc.red("stopped")}`,
    );
    console.log(`${pc.bold("Local URL:")}     ${local.record.url}`);
    console.log(`${pc.bold("Local PID:")}     ${local.record.pid}`);
    console.log(
      `${pc.bold("Local runtime kind:")} ${local.record.runtimeKind} (${local.record.runtimeSource})`,
    );
    console.log(`${pc.bold("Local SQLite:")}  ${local.record.sqlitePath}`);
    console.log(`${pc.bold("Local data dir:")} ${local.record.dataDir}`);
    if (local.stale) {
      console.log(
        `${pc.bold("Local record:")}  ${pc.yellow("stale pid cleaned up")}`,
      );
    } else {
      console.log(
        `${pc.bold("Local health:")}  ${
          local.healthy
            ? pc.green(
                `ok${local.healthStatus ? ` (${local.healthStatus})` : ""}`,
              )
            : pc.red(
                local.healthStatus
                  ? `unhealthy (${local.healthStatus})`
                  : `unreachable${local.healthError ? `: ${local.healthError}` : ""}`,
              )
        }`,
      );
    }
    console.log("");
  }

  const cfg = loadConfig();
  if (!cfg) {
    if (!local.record) {
      console.log(pc.yellow(`Not authenticated. No config at ${CONFIG_PATH}.`));
      process.exit(1);
    }
    return;
  }

  const { name, profile } = requireProfile(cfg, profileName);

  console.log(
    `${pc.bold("Profile:")}  ${name}${name === cfg.active_profile ? " (active)" : ""}`,
  );
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
    if (!local.record) process.exit(1);
  }
}
