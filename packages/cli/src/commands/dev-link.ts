import { symlinkSync, rmSync, existsSync, mkdirSync } from "fs";
import { dirname, join, resolve } from "path";
import pc from "picocolors";

import { detectInstalledAdapters } from "../runtimes/detect.js";

export async function devLinkCommand(): Promise<void> {
  const skillsSrc = findSkillsSource(process.cwd());
  if (!skillsSrc) {
    console.error(pc.red(`Not inside BlueKiwi repo: ${skillsSrc} not found`));
    process.exit(1);
  }

  for (const adapter of detectInstalledAdapters()) {
    const target = adapter.getSkillsDir();
    mkdirSync(target, { recursive: true });
    for (const skill of ["bk-start", "bk-status", "bk-rewind"]) {
      const link = join(target, skill);
      if (existsSync(link)) {
        rmSync(link, { recursive: true, force: true });
      }
      symlinkSync(join(skillsSrc, skill), link, "dir");
    }
    console.log(pc.green(`✓ Linked skills to ${adapter.displayName}`));
  }
}

function findSkillsSource(from: string): string | null {
  let current = resolve(from);

  while (true) {
    const candidate = join(
      current,
      "packages",
      "cli",
      "src",
      "assets",
      "skills",
    );
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
