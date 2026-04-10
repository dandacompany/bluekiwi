#!/usr/bin/env node
import { Command } from "commander";

import { acceptCommand } from "./commands/accept.js";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { logoutCommand } from "./commands/logout.js";
import { runtimesCommand } from "./commands/runtimes.js";
import { devLinkCommand } from "./commands/dev-link.js";

const program = new Command();

program
  .name("bluekiwi")
  .description("BlueKiwi CLI — connect your agent runtime to a BlueKiwi server")
  .version("0.0.0");

program
  .command("accept <token>")
  .requiredOption("--server <url>", "BlueKiwi server URL")
  .action(acceptCommand);

program.command("init").action(initCommand);
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
