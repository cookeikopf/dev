#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { createCommand } from './commands/create.js';
import { devCommand } from './commands/dev.js';
import { identityCommand } from './commands/identity.js';
import { deployCommand } from './commands/deploy.js';
import { generateBadgeCommand } from './commands/generate-badge.js';
import { checkNodeVersion, checkForUpdates } from './utils/checks.js';

const program = new Command();

// Display banner
console.log(
  chalk.cyan(
    figlet.textSync('AgentLink', {
      font: 'Small',
      horizontalLayout: 'default'
    })
  )
);
console.log(chalk.gray('  Build and deploy AI agents with AgentLink\n'));

// Check requirements
await checkNodeVersion();
await checkForUpdates();

program
  .name('agentlink')
  .description('CLI for creating, managing, and deploying AgentLink agents')
  .version('0.1.0', '-v, --version', 'Display version number')
  .helpOption('-h, --help', 'Display help for command')
  .configureHelp({
    sortSubcommands: true,
    subcommandTerm: (cmd) => chalk.cyan(cmd.name()),
  });

// Register commands
program.addCommand(createCommand);
program.addCommand(devCommand);
program.addCommand(identityCommand);
program.addCommand(deployCommand);
program.addCommand(generateBadgeCommand);

// Global error handler
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error: any) {
  if (error.code !== 'commander.help' && error.code !== 'commander.version') {
    console.error(chalk.red('\n✖ Error:'), error.message || error);
    process.exit(1);
  }
}
