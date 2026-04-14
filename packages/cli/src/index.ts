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
  .helpOption("-h, --help", "display help for command")
  .version(pkg.version, "-v, --version", "display version number");

program
  .command("accept <token>")
  .requiredOption("-s, --server <url>", "BlueKiwi server URL")
  .option("-p, --profile <name>", "Profile name (default: default)")
  .option("-u, --username <name>", "Username (non-interactive)")
  .option("-w, --password <pass>", "Password (non-interactive)")
  .action(acceptCommand);

program
  .command("init")
  .option("-s, --server <url>", "BlueKiwi server URL")
  .option("-k, --api-key <key>", "API key (bk_...)")
  .option("--apikey <key>", "Alias for --api-key")
  .option("-p, --profile <name>", "Profile name (default: default)")
  .option(
    "-r, --runtime <name>",
    "Runtime to install into (repeatable, or comma-separated)",
    collectRuntimes,
    [],
  )
  .option("-y, --yes", "Suppress all prompts (non-interactive)")
  .action(
    (opts: {
      server?: string;
      apiKey?: string;
      apikey?: string;
      runtime?: string[];
      profile?: string;
      yes?: boolean;
    }) =>
      initCommand({
        server: opts.server,
        apiKey: opts.apiKey ?? opts.apikey,
        runtimes: opts.runtime?.length ? opts.runtime : undefined,
        profile: opts.profile,
        yes: opts.yes,
      }),
  );
program
  .command("status")
  .option("-p, --profile <name>", "Profile name (default: active profile)")
  .action((opts: { profile?: string }) => statusCommand(opts.profile));
program.command("upgrade").action(upgradeCommand);
program
  .command("logout")
  .option("-p, --profile <name>", "Remove only one profile")
  .action((opts: { profile?: string }) => logoutCommand(opts.profile));
program.command("runtimes").action(runtimesCommand.list);
program
  .command("runtimes:add <name>")
  .option(
    "-p, --profile <name>",
    "Profile to install into runtimes and set active",
  )
  .action((name: string, opts: { profile?: string }) =>
    runtimesCommand.add(name, opts.profile),
  );
program.command("runtimes:remove <name>").action(runtimesCommand.remove);
program.command("profile").action(profileCommand.list);
program.command("profile:list").action(profileCommand.list);
program.command("profile:use <name>").action(profileCommand.use);
program.command("profile:remove <name>").action(profileCommand.remove);
program.command("dev-link").action(devLinkCommand);
program.command("help [command]").action((command?: string) => {
  if (!command) {
    program.outputHelp();
    return;
  }

  const target = program.commands.find(
    (cmd) => cmd.name() === command || cmd.aliases().includes(command),
  );
  if (!target) {
    console.error(`Unknown command '${command}'`);
    process.exit(1);
  }
  target.outputHelp();
});

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
