import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type AppRuntimeKind = "source" | "bundle";

export interface AppRuntimeResolution {
  kind: AppRuntimeKind;
  root: string;
  entry: string;
  source:
    | "env-app-root"
    | "env-runtime-path"
    | "bundled-runtime"
    | "workspace-source";
}

const here = dirname(fileURLToPath(import.meta.url));

function hasPackageJson(root: string): boolean {
  return existsSync(join(root, "package.json"));
}

function hasBundledServer(root: string): boolean {
  return existsSync(join(root, "server.js"));
}

function resolveSourceRoot(candidate: string): AppRuntimeResolution | null {
  const root = resolve(candidate);
  if (!hasPackageJson(root)) return null;
  return {
    kind: "source",
    root,
    entry: join(root, "package.json"),
    source: "workspace-source",
  };
}

function resolveBundledRoot(candidate: string): AppRuntimeResolution | null {
  const root = resolve(candidate);
  if (!hasBundledServer(root)) return null;
  return {
    kind: "bundle",
    root,
    entry: join(root, "server.js"),
    source: "bundled-runtime",
  };
}

export function resolveAppRuntime(): AppRuntimeResolution {
  const envAppRoot = process.env.BLUEKIWI_APP_ROOT?.trim();
  if (envAppRoot && hasPackageJson(envAppRoot)) {
    return {
      kind: "source",
      root: resolve(envAppRoot),
      entry: join(resolve(envAppRoot), "package.json"),
      source: "env-app-root",
    };
  }

  const envRuntimePath = process.env.BLUEKIWI_APP_RUNTIME_PATH?.trim();
  if (envRuntimePath && hasBundledServer(envRuntimePath)) {
    return {
      kind: "bundle",
      root: resolve(envRuntimePath),
      entry: join(resolve(envRuntimePath), "server.js"),
      source: "env-runtime-path",
    };
  }

  const bundledCandidate = join(here, "assets", "app-runtime");
  const bundled = resolveBundledRoot(bundledCandidate);
  if (bundled) return bundled;

  let current = process.cwd();
  while (true) {
    const resolved = resolveSourceRoot(current);
    if (resolved) return resolved;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error(
    "BlueKiwi app runtime not found. Set BLUEKIWI_APP_ROOT or BLUEKIWI_APP_RUNTIME_PATH.",
  );
}
