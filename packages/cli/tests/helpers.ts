import { existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";

/**
 * Recursively clean a directory if it exists. Used in beforeEach to reset
 * each adapter's subtree between tests without touching the shared tmp home.
 */
export function wipe(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
  }
}

export function readJson<T = Record<string, unknown>>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export { join };
