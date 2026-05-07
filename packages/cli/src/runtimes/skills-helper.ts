import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "fs";
import { dirname, isAbsolute, join, normalize, sep } from "path";

import type { SkillBundle } from "./base.js";

// All BlueKiwi-installed skills are prefixed with "bk-" so we can safely
// prune or uninstall them without touching the user's other skill files.
const SKILL_PREFIX = "bk-";

export function installSkills(skillsDir: string, skills: SkillBundle[]): void {
  mkdirSync(skillsDir, { recursive: true });
  for (const skill of skills) {
    const dir = join(skillsDir, skill.name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const files =
      skill.files && skill.files.length > 0
        ? skill.files
        : [{ path: "SKILL.md", content: skill.content }];
    for (const file of files) {
      const path = normalize(file.path);
      if (isAbsolute(path) || path === ".." || path.startsWith(`..${sep}`)) {
        throw new Error(`Invalid skill file path for ${skill.name}: ${file.path}`);
      }
      const target = join(dir, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content);
    }
  }
}

export function pruneSkills(skillsDir: string, keep: Set<string>): void {
  if (!existsSync(skillsDir)) return;
  for (const entry of readdirSync(skillsDir)) {
    if (entry.startsWith(SKILL_PREFIX) && !keep.has(entry)) {
      rmSync(join(skillsDir, entry), { recursive: true, force: true });
    }
  }
}

export function uninstallSkills(skillsDir: string): void {
  if (!existsSync(skillsDir)) return;
  for (const entry of readdirSync(skillsDir)) {
    if (entry.startsWith(SKILL_PREFIX)) {
      rmSync(join(skillsDir, entry), { recursive: true, force: true });
    }
  }
}
