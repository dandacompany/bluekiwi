import prompts from "prompts";
import pc from "picocolors";

import { BlueKiwiClient } from "../api-client.js";
import { printLogo } from "../branding.js";
import {
  createEmptyConfig,
  getProfile,
  loadConfig,
  normalizeProfileName,
  saveConfig,
  upsertProfile,
  type BluekiwiProfile,
} from "../config.js";
import { applyProfileToRuntimes } from "../runtime-sync.js";
import { detectInstalledAdapters, getAllAdapters } from "../runtimes/detect.js";

export interface InitOptions {
  server?: string;
  apiKey?: string;
  runtimes?: string[];
  profile?: string;
  yes?: boolean;
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseCommaSeparatedList(values: string[] | undefined): string[] {
  const parsed: string[] = [];
  for (const value of values ?? []) {
    for (const item of value.split(",")) {
      const trimmed = item.trim();
      if (trimmed) parsed.push(trimmed);
    }
  }
  return parsed;
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return key;
  return key.slice(0, 8) + "***";
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const isNonInteractive = options.yes === true || process.stdin.isTTY !== true;
  if (!isNonInteractive) printLogo({ subtitle: "Connect your agent runtime" });
  let profileName = normalizeProfileName(options.profile);

  // Load existing config for pre-filling prompts
  const existingCfg = loadConfig() ?? createEmptyConfig();
  let existingProfile = getProfile(existingCfg, profileName);
  const activeProfile = getProfile(existingCfg, existingCfg.active_profile);

  let server =
    normalizeEnvValue(options.server) ??
    normalizeEnvValue(process.env.BLUEKIWI_API_URL) ??
    normalizeEnvValue(process.env.BLUEKIWI_SERVER);
  let apiKey =
    normalizeEnvValue(options.apiKey) ??
    normalizeEnvValue(process.env.BLUEKIWI_API_KEY);

  if (!isNonInteractive) {
    if (options.profile === undefined) {
      const profileAnswer = await prompts({
        type: "text",
        name: "profile",
        message: "Profile name",
        initial: profileName,
      });
      profileName = normalizeProfileName(profileAnswer.profile);
      existingProfile = getProfile(existingCfg, profileName);
    }
  }

  if (!isNonInteractive) {
    if (options.server === undefined) {
      const serverAnswer = await prompts({
        type: "text",
        name: "server",
        message: "BlueKiwi server URL",
        initial:
          existingProfile?.profile.server_url ??
          activeProfile?.profile.server_url ??
          server,
      });
      server = normalizeEnvValue(serverAnswer.server) ?? server;
    }

    if (apiKey === undefined) {
      const maskedKey = existingProfile?.profile.api_key
        ? maskApiKey(existingProfile.profile.api_key)
        : undefined;
      const apiKeyAnswer = await prompts({
        type: "text",
        name: "apiKey",
        message: maskedKey
          ? `API key (press Enter to keep ${maskedKey})`
          : "API key (bk_...)",
        initial: maskedKey,
      });

      const entered = apiKeyAnswer.apiKey as string | undefined;
      if (entered && maskedKey && entered === maskedKey) {
        apiKey = existingProfile!.profile.api_key;
      } else {
        apiKey = entered;
      }
    }
  }

  if (server === undefined || apiKey === undefined) {
    if (isNonInteractive) {
      throw new Error(
        "Non-interactive mode: --server and --api-key (or BLUEKIWI_API_URL/BLUEKIWI_API_KEY) are required",
      );
    }
    throw new Error("BlueKiwi server URL and API key are required");
  }

  const client = new BlueKiwiClient(server, apiKey);
  await client.request("GET", "/api/workflows");
  const me = existingProfile?.profile.user ?? {
    id: 0,
    username: "unknown",
    email: "",
    role: "viewer",
  };

  const detected = detectInstalledAdapters();
  const all = getAllAdapters();
  const adaptersByName = new Map(all.map((adapter) => [adapter.name, adapter]));
  const validRuntimeNames = all.map((adapter) => adapter.name);

  const requestedFromFlags = uniquePreserveOrder(
    parseCommaSeparatedList(options.runtimes),
  );
  const requestedFromEnv = uniquePreserveOrder(
    parseCommaSeparatedList([process.env.BLUEKIWI_RUNTIMES ?? ""]),
  );
  const requestedRuntimeNames =
    requestedFromFlags.length > 0 ? requestedFromFlags : requestedFromEnv;
  const hasExplicitRuntimeSelection = requestedRuntimeNames.length > 0;

  let selectedRuntimeNames: string[] = [];

  if (hasExplicitRuntimeSelection) {
    const unknown = requestedRuntimeNames.filter(
      (name) => !adaptersByName.has(name),
    );
    if (unknown.length > 0) {
      throw new Error(
        `Unknown runtime(s): ${unknown.join(", ")}. Valid runtimes: ${validRuntimeNames.join(", ")}`,
      );
    }

    for (const name of requestedRuntimeNames) {
      const adapter = adaptersByName.get(name);
      if (!adapter) continue;
      if (!adapter.isInstalled()) {
        throw new Error(`Runtime '${name}' is not installed on this system`);
      }
    }

    selectedRuntimeNames = requestedRuntimeNames;
  } else if (existingCfg.runtimes.length > 0) {
    selectedRuntimeNames = existingCfg.runtimes;
  } else if (isNonInteractive) {
    if (detected.length === 0) {
      throw new Error(
        "Non-interactive mode: at least one runtime is required (--runtime <name>) or install a supported runtime",
      );
    }
    selectedRuntimeNames = [detected[0].name];
  } else {
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
    selectedRuntimeNames = selected ?? [];
  }

  const now = new Date().toISOString();
  const targetProfile: BluekiwiProfile = {
    name: profileName,
    server_url: server,
    api_key: apiKey,
    user: me,
    installed_at: existingProfile?.profile.installed_at ?? now,
    last_used: now,
  };
  const shouldActivate =
    hasExplicitRuntimeSelection ||
    existingCfg.active_profile === profileName ||
    Object.keys(existingCfg.profiles).length === 0;
  const nextConfig = upsertProfile(
    {
      ...existingCfg,
      runtimes: Array.from(
        new Set([...existingCfg.runtimes, ...selectedRuntimeNames]),
      ),
    },
    targetProfile,
    { activate: shouldActivate },
  );

  if (shouldActivate && nextConfig.runtimes.length > 0) {
    applyProfileToRuntimes(nextConfig, profileName, nextConfig.runtimes);
  }

  saveConfig(nextConfig);
  console.log(pc.green("✓ BlueKiwi connected"));
  console.log(pc.dim(`Profile: ${profileName}`));
}
