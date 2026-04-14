export interface SkillBundle {
  name: string;
  content: string;
}

export interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface RuntimeAdapter {
  readonly name: string;
  readonly displayName: string;
  isInstalled(): boolean;
  getSkillsDir(): string;
  getMcpConfigPath(): string;
  installSkills(skills: SkillBundle[]): void;
  pruneSkills(keep: Set<string>): void;
  installMcp(config: McpServerConfig): void;
  uninstall(): void;
}
