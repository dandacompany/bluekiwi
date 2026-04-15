import { startCommand, type StartOptions } from "./start.js";
import { stopCommand } from "./stop.js";

export async function restartCommand(options: StartOptions = {}): Promise<void> {
  await stopCommand(options.profile);
  await startCommand(options);
}
