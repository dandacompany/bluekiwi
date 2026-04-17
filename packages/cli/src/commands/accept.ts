import prompts from "prompts";
import pc from "picocolors";

import { BlueKiwiClient } from "../api-client.js";
import { printLogo } from "../branding.js";
import {
  createEmptyConfig,
  loadConfig,
  normalizeProfileName,
  saveConfig,
  upsertProfile,
  type BluekiwiProfile,
} from "../config.js";
import { applyProfileToRuntimes } from "../runtime-sync.js";
import { detectInstalledAdapters, getAllAdapters } from "../runtimes/detect.js";

export async function acceptCommand(
  token: string,
  opts: {
    server: string;
    username?: string;
    password?: string;
    profile?: string;
  },
): Promise<void> {
  if (process.stdin.isTTY) printLogo({ subtitle: "Accepting invite" });
  let profileName = normalizeProfileName(opts.profile);
  const currentConfig = loadConfig() ?? createEmptyConfig();

  if (process.stdin.isTTY && opts.profile === undefined) {
    const profileAnswer = await prompts({
      type: "text",
      name: "profile",
      message: "Profile name",
      initial: profileName,
    });
    profileName = normalizeProfileName(profileAnswer.profile);
  }

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
  const invite = (await validateRes.json()) as {
    email: string;
    role: string;
    already_accepted?: boolean;
  };
  console.log(pc.green(`✓ Invited as ${invite.email} (${invite.role})`));

  // If account already exists (e.g. signed up via web), only need password to re-link
  const answers = invite.already_accepted
    ? opts.password
      ? { username: "", password: opts.password }
      : await prompts([
          {
            type: "password",
            name: "password",
            message: "Enter your existing password to link this CLI",
          },
        ])
    : opts.username && opts.password
      ? { username: opts.username, password: opts.password }
      : await prompts([
          { type: "text", name: "username", message: "Choose a username" },
          { type: "password", name: "password", message: "Set a password" },
        ]);

  console.log(
    pc.cyan(
      invite.already_accepted
        ? "→ Linking account..."
        : "→ Creating account...",
    ),
  );
  const acceptRes = await fetch(`${opts.server}/api/invites/accept/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      invite.already_accepted
        ? { password: (answers as { password: string }).password }
        : answers,
    ),
  });
  if (!acceptRes.ok) {
    console.error(pc.red(`Accept failed: ${await acceptRes.text()}`));
    process.exit(1);
  }
  const result = (await acceptRes.json()) as {
    api_key: string;
    user: { id: number; username: string; email: string; role: string };
  };
  console.log(
    pc.green(
      invite.already_accepted
        ? `✓ Linked to account: ${result.user.username}`
        : `✓ Account created: ${result.user.username}`,
    ),
  );

  const client = new BlueKiwiClient(opts.server, result.api_key);
  await client.request("GET", "/api/workflows");

  // Skip runtime installation in non-interactive (CI/script) mode
  const isInteractive = process.stdin.isTTY;
  let chosen: string[] = [];

  if (isInteractive) {
    const detected = detectInstalledAdapters();
    const all = getAllAdapters();
    const choices = all.map((adapter) => ({
      title: adapter.displayName,
      value: adapter.name,
      selected:
        currentConfig.runtimes.includes(adapter.name) ||
        detected.some(
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

    chosen = selected ?? [];
  }

  const now = new Date().toISOString();
  const targetProfile: BluekiwiProfile = {
    name: profileName,
    server_url: opts.server,
    api_key: result.api_key,
    user: result.user,
    installed_at: now,
    last_used: now,
  };
  const nextConfig = upsertProfile(
    {
      ...currentConfig,
      runtimes: Array.from(new Set([...currentConfig.runtimes, ...chosen])),
    },
    targetProfile,
    {
      activate:
        chosen.length > 0 || Object.keys(currentConfig.profiles).length === 0,
    },
  );

  if (chosen.length > 0) {
    applyProfileToRuntimes(nextConfig, profileName, chosen);
  }

  saveConfig(nextConfig);

  console.log(pc.green("\n✓ BlueKiwi installed successfully!"));
  console.log(pc.dim(`Profile: ${profileName}`));
  console.log(pc.dim("Try /bk-start in your agent runtime to begin."));
}
