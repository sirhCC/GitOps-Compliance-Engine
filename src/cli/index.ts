#!/usr/bin/env node
import { Command } from 'commander';
import { validateCommand } from './commands/validate.js';
import { checkCommand } from './commands/check.js';
import { reportCommand } from './commands/report.js';

const program = new Command();

program
  .name('gce')
  .description('GitOps Compliance Engine - Validate IaC before deployment')
  .version('0.1.0');

program
  .command('validate')
  .description('Validate IaC files against policies')
  .argument('[path]', 'Path to IaC files or directory', '.')
  .option('-c, --config <file>', 'Path to config file')
  .option('-f, --format <format>', 'IaC format (terraform|pulumi|cloudformation)', 'terraform')
  .option('-s, --severity <level>', 'Fail on severity level (error|warning|info)', 'error')
  .option('--fail-fast', 'Stop on first violation', false)
  .option('--no-summary', 'Skip summary output')
  .action(validateCommand);

program
  .command('check')
  .description('Quick policy check (alias for validate)')
  .argument('[path]', 'Path to IaC files or directory', '.')
  .option('-c, --config <file>', 'Path to config file')
  .option('-f, --format <format>', 'IaC format', 'terraform')
  .action(checkCommand);

program
  .command('report')
  .description('Generate compliance report')
  .argument('[path]', 'Path to IaC files or directory', '.')
  .option('-o, --output <file>', 'Output file path')
  .option('--format <format>', 'Report format (json|yaml|markdown|html)', 'markdown')
  .action(reportCommand);

program.parse();
