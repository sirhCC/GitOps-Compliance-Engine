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
  verbose?: boolean;
  showMetadata?: boolean;
  policies?: string[];
  framework?: string[];
  listFrameworks?: boolean;
}

export async function validateCommand(path: string, options: ValidateOptions): Promise<void> {
  try {
    // Initialize policy engine
    const config: ValidationConfig = options.config ? await loadConfig(options.config) : {};
    const policyEngine = new PolicyEngine(config);

    // Load custom policies if provided
    if (options.policies && options.policies.length > 0) {
      console.log(`Loading custom policies from ${options.policies.length} file(s)...`);
      await policyEngine.loadCustomPoliciesFromFiles(options.policies);
      console.log();
    }

    // List available frameworks if requested
    if (options.listFrameworks) {
      const frameworks = policyEngine.getAvailableFrameworks();
      console.log('Available Compliance Frameworks:\n');
      for (const framework of frameworks) {
        console.log(`  • ${framework}`);
      }
      console.log(`\nTotal: ${frameworks.length} frameworks`);
      console.log('\nUsage: gce validate . --framework HIPAA,PCI-DSS');
      process.exit(0);
    }

    // Set framework filter if specified
    if (options.framework && options.framework.length > 0) {
      policyEngine.setFrameworkFilter(options.framework);
      console.log(`Filtering by frameworks: ${options.framework.join(', ')}\n`);
    }

    // Find IaC files
    const files = await findIacFiles(path, options.format || 'terraform');

    if (files.length === 0) {
      displayError(`No IaC files found in ${path}`);
      process.exit(1);
    }

    console.log(`Found ${files.length} file(s) to validate...\n`);

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

    // Process files in parallel for better performance
    const validationPromises = files.map(async (file) => {
      const parseResult = await parseIacFile(file, options.format);
      const violations = policyEngine.validateResources(parseResult.resources);

      return {
        file,
        format: parseResult.format,
        violations,
        resourceCount: parseResult.resources.length,
        passed: violations.length === 0,
      };
    });

    const results = await Promise.all(validationPromises);

    // Aggregate results
    for (const fileResult of results) {
      summary.results.push(fileResult);
      summary.totalResources += fileResult.resourceCount;
      summary.totalViolations += fileResult.violations.length;

      // Update severity and category counts
      for (const violation of fileResult.violations) {
        summary.violationsBySeverity[violation.severity]++;
        summary.violationsByCategory[violation.category]++;
      }

      // Check fail-fast
      if (options.failFast && fileResult.violations.length > 0) {
        break;
      }
    }

    // Determine if validation passed
    const failOnSeverity: Severity = (options.severity as Severity) || 'error';
    summary.passed = shouldPass(summary.violationsBySeverity, failOnSeverity);

    // Display results
    displayResults(summary, options.summary !== false, {
      verbose: options.verbose,
      showMetadata: options.showMetadata || options.verbose,
    });

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
