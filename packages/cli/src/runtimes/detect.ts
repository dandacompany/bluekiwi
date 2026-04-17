import type { RuntimeAdapter } from "./base.js";
import { AntigravityAdapter } from "./antigravity.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { ClaudeDesktopAdapter } from "./claude-desktop.js";
import { ClineAdapter } from "./cline.js";
import { CodexAdapter } from "./codex.js";
import { ContinueAdapter } from "./continue.js";
import { CursorAdapter } from "./cursor.js";
import { GeminiCliAdapter } from "./gemini-cli.js";
import { GooseAdapter } from "./goose.js";
import { JetbrainsAdapter } from "./jetbrains.js";
import { OpenCodeAdapter } from "./opencode.js";
import { OpenClawAdapter } from "./openclaw.js";
import { RooCodeAdapter } from "./roo-code.js";
import { TraeAdapter } from "./trae.js";
import { VscodeAdapter } from "./vscode.js";
import { WindsurfAdapter } from "./windsurf.js";
import { ZedAdapter } from "./zed.js";

export function getAllAdapters(): RuntimeAdapter[] {
  return [
    new ClaudeCodeAdapter(),
    new ClaudeDesktopAdapter(),
    new CodexAdapter(),
    new GeminiCliAdapter(),
    new OpenCodeAdapter(),
    new OpenClawAdapter(),
    new CursorAdapter(),
    new AntigravityAdapter(),
    new WindsurfAdapter(),
    new ClineAdapter(),
    new RooCodeAdapter(),
    new VscodeAdapter(),
    new ContinueAdapter(),
    new ZedAdapter(),
    new GooseAdapter(),
    new JetbrainsAdapter(),
    new TraeAdapter(),
  ];
}

export function detectInstalledAdapters(): RuntimeAdapter[] {
  return getAllAdapters().filter((adapter) => adapter.isInstalled());
}
