import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  installSkills,
  pruneSkills,
  uninstallSkills,
} from "../src/runtimes/skills-helper.js";

describe("skills-helper", () => {
  let dir: string;

  beforeEach(() => {
    dir = join(
      tmpdir(),
      `bk-skills-${process.pid}-${Date.now()}-${Math.random()}`,
    );
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it("installSkills writes SKILL.md per bundle", () => {
    installSkills(dir, [
      { name: "bk-a", content: "# A" },
      { name: "bk-b", content: "# B" },
    ]);
    expect(readFileSync(join(dir, "bk-a", "SKILL.md"), "utf8")).toBe("# A");
    expect(readFileSync(join(dir, "bk-b", "SKILL.md"), "utf8")).toBe("# B");
  });

  it("installSkills creates missing parent directory", () => {
    expect(existsSync(dir)).toBe(false);
    installSkills(dir, [{ name: "bk-a", content: "x" }]);
    expect(existsSync(join(dir, "bk-a"))).toBe(true);
  });

  it("pruneSkills removes bk-* entries not in keep set", () => {
    installSkills(dir, [
      { name: "bk-a", content: "x" },
      { name: "bk-b", content: "y" },
    ]);
    // A non-bluekiwi user skill should survive.
    mkdirSync(join(dir, "user-custom"), { recursive: true });
    writeFileSync(join(dir, "user-custom", "SKILL.md"), "mine");

    pruneSkills(dir, new Set(["bk-a"]));

    const remaining = readdirSync(dir).sort();
    expect(remaining).toEqual(["bk-a", "user-custom"]);
  });

  it("pruneSkills is a no-op when the directory doesn't exist", () => {
    expect(() => pruneSkills(dir, new Set())).not.toThrow();
  });

  it("uninstallSkills removes every bk-* entry but leaves non-bk files intact", () => {
    installSkills(dir, [{ name: "bk-a", content: "x" }]);
    mkdirSync(join(dir, "user-custom"), { recursive: true });
    writeFileSync(join(dir, "user-custom", "SKILL.md"), "mine");

    uninstallSkills(dir);

    expect(existsSync(join(dir, "bk-a"))).toBe(false);
    expect(existsSync(join(dir, "user-custom"))).toBe(true);
  });
});
