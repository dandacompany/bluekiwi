import prompts from "prompts";
import pc from "picocolors";

import { BlueKiwiClient } from "../api-client.js";
import { BUNDLED_MCP_PATH, BUNDLED_SKILLS } from "../assets/index.js";
import { saveConfig } from "../config.js";
import { detectInstalledAdapters, getAllAdapters } from "../runtimes/detect.js";

export async function acceptCommand(
  token: string,
  opts: { server: string; username?: string; password?: string },
): Promise<void> {
  console.log(pc.cyan("→ Validating invite..."));
  const validateRes = await fetch(`${opts.server}/api/invites/accept/${token}`);
  if (!validateRes.ok) {
    const err = (await validateRes.json().catch(() => ({}))) as {
      error?: string;
    };
    console.error(
      pc.red(`Invite invalid: ${err.error ?? validateRes.statusText}`),
    );
    process.exit(1);
  }
  const invite = (await validateRes.json()) as { email: string; role: string };
  console.log(pc.green(`✓ Invited as ${invite.email} (${invite.role})`));

  const answers =
    opts.username && opts.password
      ? { username: opts.username, password: opts.password }
      : await prompts([
          { type: "text", name: "username", message: "Choose a username" },
          { type: "password", name: "password", message: "Set a password" },
        ]);

  console.log(pc.cyan("→ Creating account..."));
  const acceptRes = await fetch(`${opts.server}/api/invites/accept/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answers),
  });
  if (!acceptRes.ok) {
    console.error(pc.red(`Accept failed: ${await acceptRes.text()}`));
    process.exit(1);
  }
  const result = (await acceptRes.json()) as {
    api_key: string;
    user: { id: number; username: string; email: string; role: string };
  };
  console.log(pc.green(`✓ Account created: ${result.user.username}`));

  const client = new BlueKiwiClient(opts.server, result.api_key);
  await client.request("GET", "/api/workflows");

  const detected = detectInstalledAdapters();
  const all = getAllAdapters();
  const choices = all.map((adapter) => ({
    title: adapter.displayName,
    value: adapter.name,
    selected: detected.some(
      (detectedAdapter) => detectedAdapter.name === adapter.name,
    ),
    disabled: !adapter.isInstalled(),
  }));

  const { selected } = (await prompts({
    type: "multiselect",
    name: "selected",
    message: "Install BlueKiwi into which runtimes?",
    choices,
    hint: "- Space to toggle. Return to submit",
  })) as { selected?: string[] };

  const chosen = selected ?? [];
  for (const name of chosen) {
    const adapter = all.find((item) => item.name === name);
    if (!adapter) continue;
    console.log(pc.cyan(`→ Installing to ${adapter.displayName}...`));
    adapter.installSkills(BUNDLED_SKILLS);
    adapter.installMcp({
      command: "node",
      args: [BUNDLED_MCP_PATH],
      env: {
        BLUEKIWI_API_URL: opts.server,
        BLUEKIWI_API_KEY: result.api_key,
      },
    });
  }

  saveConfig({
    version: "1.0.0",
    server_url: opts.server,
    api_key: result.api_key,
    user: result.user,
    runtimes: chosen,
    installed_at: new Date().toISOString(),
    last_used: new Date().toISOString(),
  });

  console.log(pc.green("\n✓ BlueKiwi installed successfully!"));
  console.log(pc.dim("Try /bk-start in your agent runtime to begin."));
}
