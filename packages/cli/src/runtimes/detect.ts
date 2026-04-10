import type { RuntimeAdapter } from "./base.js";
import { ClaudeCodeAdapter } from "./claude-code.js";

export function getAllAdapters(): RuntimeAdapter[] {
  return [new ClaudeCodeAdapter()];
}

export function detectInstalledAdapters(): RuntimeAdapter[] {
  return getAllAdapters().filter((adapter) => adapter.isInstalled());
}
