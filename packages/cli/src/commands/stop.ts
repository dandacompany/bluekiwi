import pc from "picocolors";
import { isLocalRuntimeRunning, stopLocalRuntime } from "../local-runtime.js";

export async function stopCommand(profile?: string): Promise<void> {
  const wasRunning = isLocalRuntimeRunning(profile);
  const record = stopLocalRuntime(profile);
  if (!record) {
    console.log(pc.yellow("Local runtime is not running."));
    return;
  }
  if (wasRunning) {
    console.log(pc.green("✓ BlueKiwi local runtime stopped"));
  } else {
    console.log(pc.yellow("✓ Removed stale local runtime record"));
  }
  console.log(`${pc.bold("Profile:")} ${record.profile}`);
  console.log(`${pc.bold("PID:")}     ${record.pid}`);
}
