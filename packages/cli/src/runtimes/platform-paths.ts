import { homedir, platform } from "os";
import { join } from "path";

export function vscodeGlobalStorage(extensionId: string): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(
        home,
        "Library",
        "Application Support",
        "Code",
        "User",
        "globalStorage",
        extensionId,
      );
    case "win32":
      return join(
        process.env.APPDATA ?? join(home, "AppData", "Roaming"),
        "Code",
        "User",
        "globalStorage",
        extensionId,
      );
    default:
      return join(
        home,
        ".config",
        "Code",
        "User",
        "globalStorage",
        extensionId,
      );
  }
}

export function vscodeUserDir(): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "Code", "User");
    case "win32":
      return join(
        process.env.APPDATA ?? join(home, "AppData", "Roaming"),
        "Code",
        "User",
      );
    default:
      return join(home, ".config", "Code", "User");
  }
}

export function jetbrainsConfigDir(): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "JetBrains");
    case "win32":
      return join(
        process.env.APPDATA ?? join(home, "AppData", "Roaming"),
        "JetBrains",
      );
    default:
      return join(home, ".config", "JetBrains");
  }
}

export function traeUserDir(): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "Trae", "User");
    case "win32":
      return join(
        process.env.APPDATA ?? join(home, "AppData", "Roaming"),
        "Trae",
        "User",
      );
    default:
      return join(home, ".config", "Trae", "User");
  }
}

export function claudeDesktopConfigDir(): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "Claude");
    case "win32":
      return join(
        process.env.APPDATA ?? join(home, "AppData", "Roaming"),
        "Claude",
      );
    default:
      return join(home, ".config", "Claude");
  }
}
