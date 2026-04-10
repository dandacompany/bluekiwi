#!/usr/bin/env node
import { Command } from "commander";

import { acceptCommand } from "./commands/accept.js";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { logoutCommand } from "./commands/logout.js";
import { runtimesCommand } from "./commands/runtimes.js";
import { devLinkCommand } from "./commands/dev-link.js";

function splitCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function collectRuntimes(value: string, previous: string[]): string[] {
  return previous.concat(splitCommaSeparatedList(value));
}

const program = new Command();

program
  .name("bluekiwi")
  .description("BlueKiwi CLI — connect your agent runtime to a BlueKiwi server")
  .version("0.0.0");

program
  .command("accept <token>")
  .requiredOption("--server <url>", "BlueKiwi server URL")
  .action(acceptCommand);

program
  .command("init")
  .option("--server <url>", "BlueKiwi server URL")
  .option("--api-key <key>", "API key (bk_...)")
  .option(
    "--runtime <name>",
    "Runtime to install into (repeatable, or comma-separated)",
    collectRuntimes,
    [],
  )
  .option("--yes", "Suppress all prompts (non-interactive)")
  .action(
    (opts: {
      server?: string;
      apiKey?: string;
      runtime?: string[];
      yes?: boolean;
    }) =>
      initCommand({
        server: opts.server,
        apiKey: opts.apiKey,
        runtimes: opts.runtime?.length ? opts.runtime : undefined,
        yes: opts.yes,
      }),
  );
program.command("status").action(statusCommand);
program.command("upgrade").action(upgradeCommand);
program.command("logout").action(logoutCommand);
program.command("runtimes").action(runtimesCommand.list);
program.command("runtimes:add <name>").action(runtimesCommand.add);
program.command("runtimes:remove <name>").action(runtimesCommand.remove);
program.command("dev-link").action(devLinkCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
