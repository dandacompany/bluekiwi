#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "node:module";

import { acceptCommand } from "./commands/accept.js";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { logoutCommand } from "./commands/logout.js";
import { runtimesCommand } from "./commands/runtimes.js";
import { devLinkCommand } from "./commands/dev-link.js";
import { profileCommand } from "./commands/profile.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

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
  .version(pkg.version);

program
  .command("accept <token>")
  .requiredOption("--server <url>", "BlueKiwi server URL")
  .option("--profile <name>", "Profile name (default: default)")
  .option("--username <name>", "Username (non-interactive)")
  .option("--password <pass>", "Password (non-interactive)")
  .action(acceptCommand);

program
  .command("init")
  .option("--server <url>", "BlueKiwi server URL")
  .option("--api-key <key>", "API key (bk_...)")
  .option("--profile <name>", "Profile name (default: default)")
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
      profile?: string;
      yes?: boolean;
    }) =>
      initCommand({
        server: opts.server,
        apiKey: opts.apiKey,
        runtimes: opts.runtime?.length ? opts.runtime : undefined,
        profile: opts.profile,
        yes: opts.yes,
      }),
  );
program
  .command("status")
  .option("--profile <name>", "Profile name (default: active profile)")
  .action((opts: { profile?: string }) => statusCommand(opts.profile));
program.command("upgrade").action(upgradeCommand);
program
  .command("logout")
  .option("--profile <name>", "Remove only one profile")
  .action((opts: { profile?: string }) => logoutCommand(opts.profile));
program.command("runtimes").action(runtimesCommand.list);
program
  .command("runtimes:add <name>")
  .option("--profile <name>", "Profile to install into runtimes and set active")
  .action((name: string, opts: { profile?: string }) =>
    runtimesCommand.add(name, opts.profile),
  );
program.command("runtimes:remove <name>").action(runtimesCommand.remove);
program.command("profile").action(profileCommand.list);
program.command("profile:list").action(profileCommand.list);
program.command("profile:use <name>").action(profileCommand.use);
program.command("profile:remove <name>").action(profileCommand.remove);
program.command("dev-link").action(devLinkCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
