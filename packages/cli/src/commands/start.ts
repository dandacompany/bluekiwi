import pc from "picocolors";
import { startLocalRuntime } from "../local-runtime.js";

export interface StartOptions {
  profile?: string;
  host?: string;
  port?: number;
  dataDir?: string;
  open?: boolean;
  foreground?: boolean;
}

export async function startCommand(options: StartOptions = {}): Promise<void> {
  const record = await startLocalRuntime(options);
  console.log(pc.green("✓ BlueKiwi local runtime started"));
  console.log(`${pc.bold("Profile:")}  ${record.profile}`);
  console.log(`${pc.bold("URL:")}      http://${record.host}:${record.port}`);
  console.log(`${pc.bold("PID:")}      ${record.pid}`);
  console.log(
    `${pc.bold("Runtime:")}  ${record.runtimeKind} (${record.runtimeSource})`,
  );
  console.log(`${pc.bold("SQLite:")}   ${record.sqlitePath}`);
  console.log(`${pc.bold("Data dir:")} ${record.dataDir}`);
}
