import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  chmodSync,
  unlinkSync,
} from "fs";
import { homedir } from "os";
import { join, dirname } from "path";

export interface BluekiwiConfig {
  version: string;
  server_url: string;
  api_key: string;
  user: { id: number; username: string; email: string; role: string };
  runtimes: string[];
  installed_at: string;
  last_used: string;
}

export const CONFIG_PATH = join(homedir(), ".bluekiwi", "config.json");

export function loadConfig(): BluekiwiConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function saveConfig(config: BluekiwiConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  chmodSync(CONFIG_PATH, 0o600);
}

export function clearConfig(): void {
  if (existsSync(CONFIG_PATH)) unlinkSync(CONFIG_PATH);
}

export function requireConfig(): BluekiwiConfig {
  const config = loadConfig();
  if (!config) {
    throw new Error(
      "Not authenticated. Run `npx bluekiwi accept <token> --server <url>` first.",
    );
  }
  return config;
}
