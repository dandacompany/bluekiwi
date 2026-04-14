import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import type { SkillBundle } from "../runtimes/base.js";

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = join(here, "skills");

export const BUNDLED_SKILLS: SkillBundle[] = [
  "bk-start",
  "bk-next",
  "bk-status",
  "bk-rewind",
  "bk-approve",
  "bk-instruction",
  "bk-credential",
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
}));

export const BUNDLED_MCP_PATH = join(here, "mcp", "server.js");
