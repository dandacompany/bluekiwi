import prompts, { type PromptObject } from "prompts";
import pc from "picocolors";

import { BlueKiwiClient } from "../api-client.js";
import { BUNDLED_MCP_PATH, BUNDLED_SKILLS } from "../assets/index.js";
import { saveConfig } from "../config.js";
import { detectInstalledAdapters, getAllAdapters } from "../runtimes/detect.js";

export interface InitOptions {
  server?: string;
  apiKey?: string;
  runtimes?: string[];
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

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const isNonInteractive = options.yes === true || process.stdin.isTTY !== true;

  let server =
    normalizeEnvValue(options.server) ??
    normalizeEnvValue(process.env.BLUEKIWI_SERVER);
  let apiKey =
    normalizeEnvValue(options.apiKey) ??
    normalizeEnvValue(process.env.BLUEKIWI_API_KEY);

  if (!isNonInteractive && (server === undefined || apiKey === undefined)) {
    const questions: PromptObject[] = [];
    if (server === undefined) {
      questions.push({
        type: "text",
        name: "server",
        message: "BlueKiwi server URL",
      });
    }
    if (apiKey === undefined) {
      questions.push({
        type: "password",
        name: "apiKey",
        message: "API key (bk_...)",
      });
    }

    const answers = await prompts(questions);
    server ??= answers.server;
    apiKey ??= answers.apiKey;
  }

  if (server === undefined || apiKey === undefined) {
    if (isNonInteractive) {
      throw new Error(
        "Non-interactive mode: --server and --api-key (or BLUEKIWI_SERVER/BLUEKIWI_API_KEY) are required",
      );
    }
    throw new Error("BlueKiwi server URL and API key are required");
  }

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

  let selectedRuntimeNames: string[] = [];

  if (requestedRuntimeNames.length > 0) {
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

  for (const name of selectedRuntimeNames) {
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
    runtimes: selectedRuntimeNames,
    installed_at: new Date().toISOString(),
    last_used: new Date().toISOString(),
  });
  console.log(pc.green("✓ BlueKiwi connected"));
}
