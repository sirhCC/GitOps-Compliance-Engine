import { ValidationConfig, ValidationSummary, Severity } from '../../types.js';
import { findIacFiles } from '../../utils/file-finder.js';
import { parseIacFile } from '../../parsers/index.js';
import { PolicyEngine } from '../../policies/engine.js';
import { displayResults, displayError } from '../display.js';
import { formatErrorMessage, suggestFix, ConfigError } from '../../utils/errors.js';
import { readFile } from 'fs/promises';
import { z } from 'zod';

// Zod schema for config validation
const ValidationConfigSchema = z.object({
  policies: z
    .object({
      enabled: z.array(z.string()).optional(),
      disabled: z.array(z.string()).optional(),
    })
    .optional(),
  severity: z
    .object({
      failOn: z.enum(['error', 'warning', 'info']).optional(),
    })
    .optional(),
  exclude: z
    .object({
      files: z.array(z.string()).optional(),
      resources: z.array(z.string()).optional(),
    })
    .optional(),
});

interface ValidateOptions {
  config?: string;
  format?: string;
  severity?: string;
  failFast?: boolean;
  summary?: boolean;
}

export async function validateCommand(path: string, options: ValidateOptions): Promise<void> {
  try {
    // Load configuration
    const config: ValidationConfig = options.config ? await loadConfig(options.config) : {};

    // Find IaC files
    const files = await findIacFiles(path, options.format || 'terraform');

    if (files.length === 0) {
      displayError(`No IaC files found in ${path}`);
      process.exit(1);
    }

    // Initialize policy engine
    const policyEngine = new PolicyEngine(config);

    // Validate each file
    const summary: ValidationSummary = {
      totalFiles: files.length,
      totalResources: 0,
      totalViolations: 0,
      violationsBySeverity: { error: 0, warning: 0, info: 0 },
      violationsByCategory: { cost: 0, security: 0, compliance: 0, tagging: 0, naming: 0 },
      passed: true,
      results: [],
    };

    for (const file of files) {
      const parseResult = await parseIacFile(file, options.format || 'terraform');
      const violations = policyEngine.validateResources(parseResult.resources);

      const fileResult = {
        file,
        format: parseResult.format,
        violations,
        resourceCount: parseResult.resources.length,
        passed: violations.length === 0,
      };

      summary.results.push(fileResult);
      summary.totalResources += parseResult.resources.length;
      summary.totalViolations += violations.length;

      // Update severity and category counts
      for (const violation of violations) {
        summary.violationsBySeverity[violation.severity]++;
        summary.violationsByCategory[violation.category]++;
      }

      // Check fail-fast
      if (options.failFast && violations.length > 0) {
        break;
      }
    }

    // Determine if validation passed
    const failOnSeverity: Severity = (options.severity as Severity) || 'error';
    summary.passed = shouldPass(summary.violationsBySeverity, failOnSeverity);

    // Display results
    displayResults(summary, options.summary !== false);

    // Exit with appropriate code
    process.exit(summary.passed ? 0 : 1);
  } catch (error) {
    const errorMsg = formatErrorMessage(error);
    displayError(errorMsg);

    const suggestion = suggestFix(error);
    if (suggestion) {
      console.log(`\n💡 Suggestion: ${suggestion}\n`);
    }

    process.exit(1);
  }
}

async function loadConfig(configPath: string): Promise<ValidationConfig> {
  try {
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content) as unknown;

    // Validate config with Zod
    const validated = ValidationConfigSchema.parse(parsed);

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new ConfigError(`Invalid config structure: ${messages}`, configPath);
    }

    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        throw new ConfigError('File not found', configPath);
      }
      if (error instanceof SyntaxError) {
        throw new ConfigError('Invalid JSON syntax', configPath);
      }
      throw error;
    }

    throw new ConfigError('Failed to load config', configPath);
  }
}

function shouldPass(violations: Record<Severity, number>, failOn: Severity): boolean {
  switch (failOn) {
    case 'error':
      return violations.error === 0;
    case 'warning':
      return violations.error === 0 && violations.warning === 0;
    case 'info':
      return violations.error === 0 && violations.warning === 0 && violations.info === 0;
    default:
      return false;
  }
}
