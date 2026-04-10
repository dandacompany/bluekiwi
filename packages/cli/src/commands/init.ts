import prompts from "prompts";
import pc from "picocolors";

import { BlueKiwiClient } from "../api-client.js";
import { BUNDLED_MCP_PATH, BUNDLED_SKILLS } from "../assets/index.js";
import { saveConfig } from "../config.js";
import { detectInstalledAdapters, getAllAdapters } from "../runtimes/detect.js";

export async function initCommand(): Promise<void> {
  const { server, apiKey } = await prompts([
    { type: "text", name: "server", message: "BlueKiwi server URL" },
    { type: "password", name: "apiKey", message: "API key (bk_...)" },
  ]);

  const client = new BlueKiwiClient(server, apiKey);
  await client.request("GET", "/api/workflows");
  const me = {
    id: 0,
    username: "unknown",
    email: "",
    role: "viewer",
  };

  const detected = detectInstalledAdapters();
  const all = getAllAdapters();
  const { selected } = (await prompts({
    type: "multiselect",
    name: "selected",
    message: "Install into which runtimes?",
    choices: all.map((adapter) => ({
      title: adapter.displayName,
      value: adapter.name,
      selected: detected.some((item) => item.name === adapter.name),
      disabled: !adapter.isInstalled(),
    })),
  })) as { selected?: string[] };

  for (const name of selected ?? []) {
    const adapter = all.find((item) => item.name === name);
    if (!adapter) continue;
    adapter.installSkills(BUNDLED_SKILLS);
    adapter.installMcp({
      command: "node",
      args: [BUNDLED_MCP_PATH],
      env: { BLUEKIWI_API_URL: server, BLUEKIWI_API_KEY: apiKey },
    });
  }

  saveConfig({
    version: "1.0.0",
    server_url: server,
    api_key: apiKey,
    user: me,
    runtimes: selected ?? [],
    installed_at: new Date().toISOString(),
    last_used: new Date().toISOString(),
  });
  console.log(pc.green("✓ BlueKiwi connected"));
}
