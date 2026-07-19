import { readdirSync, readFileSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, relative } from "path";

import type { SkillBundle } from "../runtimes/base.js";

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = join(here, "skills");

function readSkillFiles(
  name: string,
): Array<{ path: string; content: string }> {
  const root = join(SKILLS_ROOT, name);
  const files: Array<{ path: string; content: string }> = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!stat.isFile()) continue;
      const path = relative(root, fullPath);
      files.push({
        path,
        content: readFileSync(fullPath, "utf8"),
      });
    }
  }

  walk(root);
  return files;
}

export const BUNDLED_SKILLS: SkillBundle[] = [
  "bk-start",
  "bk-next",
  "bk-status",
  "bk-rewind",
  "bk-approve",
  "bk-instruction",
  "bk-credential",
  "bk-create",
  "bk-design",
  "bk-import",
  "bk-improve",
  "bk-report",
  "bk-scan",
  "bk-share",
  "bk-version",
  "bk-help",
].map((name) => ({
  name,
  content: readFileSync(join(SKILLS_ROOT, name, "SKILL.md"), "utf8"),
  files: readSkillFiles(name),
}));

export const BUNDLED_MCP_PATH = join(here, "mcp", "server.js");
