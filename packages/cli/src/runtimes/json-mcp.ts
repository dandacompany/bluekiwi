import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { dirname, join } from "path";

import type { RuntimeAdapter, SkillBundle, McpServerConfig } from "./base.js";
import {
  installSkills,
  pruneSkills,
  uninstallSkills,
} from "./skills-helper.js";

export interface JsonMcpAdapterOptions {
  name: string;
  displayName: string;
  baseDir: string;
  /** Default: `<baseDir>/skills` */
  skillsDir?: string;
  /** Either a fixed path or a function returning N paths (fan-out). */
  mcpConfigPath: string | (() => string[]);
  /** Top-level JSON key holding the server map. Default: `"mcpServers"`. */
  serversKey?: string;
  /** Entry key under serversKey. Default: `"bluekiwi"`. */
  entryKey?: string;
  /** Transform McpServerConfig into the JSON entry shape. Default: identity. */
  buildEntry?: (config: McpServerConfig) => unknown;
  /** Override installation detection. Default: `existsSync(baseDir)`. */
  isInstalled?: () => boolean;
  /** Display string for `getMcpConfigPath()` when fan-out is used. */
  displayPath?: string;
}

export class JsonMcpAdapter implements RuntimeAdapter {
  readonly name: string;
  readonly displayName: string;
  protected readonly baseDir: string;
  protected readonly skillsDir: string;
  private readonly resolvePaths: () => string[];
  private readonly displayPath: string;
  private readonly serversKey: string;
  private readonly entryKey: string;
  private readonly buildEntry: (config: McpServerConfig) => unknown;
  private readonly isInstalledFn: () => boolean;

  constructor(opts: JsonMcpAdapterOptions) {
    this.name = opts.name;
    this.displayName = opts.displayName;
    this.baseDir = opts.baseDir;
    this.skillsDir = opts.skillsDir ?? join(opts.baseDir, "skills");
    if (typeof opts.mcpConfigPath === "function") {
      const fn = opts.mcpConfigPath;
      this.resolvePaths = fn;
      this.displayPath = opts.displayPath ?? "<multiple>";
    } else {
      const path = opts.mcpConfigPath;
      this.resolvePaths = () => [path];
      this.displayPath = path;
    }
    this.serversKey = opts.serversKey ?? "mcpServers";
    this.entryKey = opts.entryKey ?? "bluekiwi";
    this.buildEntry = opts.buildEntry ?? ((c) => c);
    this.isInstalledFn = opts.isInstalled ?? (() => existsSync(this.baseDir));
  }

  isInstalled(): boolean {
    return this.isInstalledFn();
  }

  getSkillsDir(): string {
    return this.skillsDir;
  }

  getMcpConfigPath(): string {
    return this.displayPath;
  }

  installSkills(skills: SkillBundle[]): void {
    installSkills(this.skillsDir, skills);
  }

  pruneSkills(keep: Set<string>): void {
    pruneSkills(this.skillsDir, keep);
  }

  installMcp(config: McpServerConfig): void {
    const entry = this.buildEntry(config);
    for (const path of this.resolvePaths()) {
      mkdirSync(dirname(path), { recursive: true });
      const existing = this.readJson(path);
      const servers =
        (existing[this.serversKey] as Record<string, unknown> | undefined) ??
        {};
      servers[this.entryKey] = entry;
      existing[this.serversKey] = servers;
      writeFileSync(path, JSON.stringify(existing, null, 2));
    }
  }

  uninstall(): void {
    uninstallSkills(this.skillsDir);
    for (const path of this.resolvePaths()) {
      if (!existsSync(path)) continue;
      const existing = this.readJson(path);
      const servers = existing[this.serversKey] as
        | Record<string, unknown>
        | undefined;
      if (servers) delete servers[this.entryKey];
      writeFileSync(path, JSON.stringify(existing, null, 2));
    }
  }

  private readJson(path: string): Record<string, unknown> {
    if (!existsSync(path)) return {};
    try {
      return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
