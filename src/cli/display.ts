import chalk from 'chalk';
import { ValidationSummary, ValidationResult, Severity, PolicyViolation } from '../types.js';

/**
 * Formats and displays validation results to the console
 */
export function displayResults(summary: ValidationSummary, showSummary = true): void {
  console.log();

  // Display per-file results
  for (const result of summary.results) {
    displayFileResult(result);
  }

  // Display summary
  if (showSummary) {
    console.log();
    displaySummary(summary);
  }
}

function displayFileResult(result: ValidationResult): void {
  const statusIcon = result.passed ? chalk.green('✓') : chalk.red('✗');
  const fileName = chalk.bold(result.file);

  console.log(`${statusIcon} ${fileName} (${result.resourceCount} resources)`);

  if (result.violations.length > 0) {
    for (const violation of result.violations) {
      const severityColor = getSeverityColor(violation.severity);
      const severityBadge = severityColor(`[${violation.severity.toUpperCase()}]`);
      const location = `${violation.resource.location.file}:${violation.resource.location.line || 0}`;

      console.log(`  ${severityBadge} ${violation.message}`);
      console.log(
        `    ${chalk.gray(`└─ ${violation.resource.type} "${violation.resource.id}" at ${location}`)}`
      );

      if (violation.remediation) {
        console.log(`    ${chalk.cyan(`💡 ${violation.remediation}`)}`);
      }
    }
    console.log();
  }
}

function displaySummary(summary: ValidationSummary): void {
  console.log(chalk.bold('═══ Validation Summary ═══'));
  console.log();

  console.log(`Files scanned:     ${summary.totalFiles}`);
  console.log(`Resources checked: ${summary.totalResources}`);
  console.log(`Total violations:  ${summary.totalViolations}`);
  console.log();

  // Violations by severity
  console.log(chalk.bold('By Severity:'));
  for (const [severity, count] of Object.entries(summary.violationsBySeverity)) {
    if (typeof count === 'number' && count > 0) {
      const color = getSeverityColor(severity as Severity);
      console.log(`  ${color(`${severity}:`)} ${count}`);
    }
  }
  console.log();

  // Final result
  if (summary.passed) {
    console.log(chalk.green.bold('✓ Validation PASSED'));
  } else {
    console.log(chalk.red.bold('✗ Validation FAILED'));
  }
  console.log();
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'error':
      return chalk.red;
    case 'warning':
      return chalk.yellow;
    case 'info':
      return chalk.blue;
    default:
      return chalk.white;
  }
}

/**
 * Display error message
 */
export function displayError(message: string): void {
  console.error(chalk.red(`✗ Error: ${message}`));
}

/**
 * Display success message
 */
export function displaySuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Display a single violation (for detailed output)
 */
export function displayViolation(violation: PolicyViolation): void {
  const severityColor = getSeverityColor(violation.severity);
  const severityBadge = severityColor(`[${violation.severity.toUpperCase()}]`);
  const location = `${violation.resource.location.file}:${violation.resource.location.line || 0}`;

  console.log(`${severityBadge} ${violation.ruleName}: ${violation.message}`);
  console.log(`  Resource: ${violation.resource.type} "${violation.resource.id}"`);
  console.log(`  Location: ${chalk.gray(location)}`);
  console.log(`  Category: ${chalk.cyan(violation.category)}`);

  if (violation.remediation) {
    console.log(`  ${chalk.cyan(`💡 Remediation: ${violation.remediation}`)}`);
  }
  console.log();
}
