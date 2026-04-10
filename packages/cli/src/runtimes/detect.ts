import type { RuntimeAdapter } from "./base.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CodexAdapter } from "./codex.js";
import { GeminiCliAdapter } from "./gemini-cli.js";
import { OpenCodeAdapter } from "./opencode.js";
import { OpenClawAdapter } from "./openclaw.js";

export function getAllAdapters(): RuntimeAdapter[] {
  return [
    new ClaudeCodeAdapter(),
    new CodexAdapter(),
    new GeminiCliAdapter(),
    new OpenCodeAdapter(),
    new OpenClawAdapter(),
  ];
}

export function detectInstalledAdapters(): RuntimeAdapter[] {
  return getAllAdapters().filter((adapter) => adapter.isInstalled());
}
