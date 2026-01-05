import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import { PolicyRule } from '../types.js';
import { ConfigError } from '../utils/errors.js';

/**
 * Load custom policies from a file
 */
export async function loadCustomPolicies(filePath: string): Promise<PolicyRule[]> {
  try {
    // Determine file type
    const isTypeScript = filePath.endsWith('.ts');
    const isJavaScript = filePath.endsWith('.js') || filePath.endsWith('.mjs');
    const isJSON = filePath.endsWith('.json');

    if (isJSON) {
      return await loadJSONPolicies(filePath);
    } else if (isJavaScript || isTypeScript) {
      return await loadJSPolicies(filePath);
    } else {
      throw new ConfigError(
        'Unsupported policy file format. Use .js, .mjs, .ts, or .json',
        filePath
      );
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new ConfigError(`Failed to load custom policies: ${error.message}`, filePath);
    }
    throw new ConfigError('Unknown error loading custom policies', filePath);
  }
}

/**
 * Load policies from a JSON file
 */
async function loadJSONPolicies(filePath: string): Promise<PolicyRule[]> {
  const content = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(content);

  // Validate structure
  if (!Array.isArray(parsed) && !parsed.policies) {
    throw new ConfigError('JSON must contain an array of policies or a "policies" key', filePath);
  }

  const policies = Array.isArray(parsed) ? parsed : parsed.policies;

  // Validate each policy has required fields
  for (const policy of policies) {
    validatePolicyStructure(policy, filePath);
  }

  return policies;
}

/**
 * Load policies from a JavaScript/TypeScript module
 */
async function loadJSPolicies(filePath: string): Promise<PolicyRule[]> {
  // Convert to file URL for ES module import
  const fileUrl = pathToFileURL(filePath).href;

  // Dynamic import
  const module = (await import(fileUrl)) as {
    default?: PolicyRule[] | { policies: PolicyRule[] };
    policies?: PolicyRule[];
  };

  // Extract policies from various export formats
  let policies: PolicyRule[] | undefined;

  if (Array.isArray(module.default)) {
    policies = module.default;
  } else if (module.default && 'policies' in module.default) {
    policies = module.default.policies;
  } else if (Array.isArray(module.policies)) {
    policies = module.policies;
  }

  if (!policies || policies.length === 0) {
    throw new ConfigError(
      'Module must export default array or { policies: [] } or named export "policies"',
      filePath
    );
  }

  // Validate each policy
  for (const policy of policies) {
    validatePolicyStructure(policy, filePath);
  }

  return policies;
}

/**
 * Validate policy structure
 */
function validatePolicyStructure(policy: unknown, filePath: string): asserts policy is PolicyRule {
  if (typeof policy !== 'object' || policy === null) {
    throw new ConfigError('Each policy must be an object', filePath);
  }

  const p = policy as Record<string, unknown>;

  const requiredFields = ['id', 'name', 'description', 'category', 'severity', 'evaluate'];
  for (const field of requiredFields) {
    if (!(field in p)) {
      throw new ConfigError(`Policy missing required field: ${field}`, filePath);
    }
  }

  // Validate types
  if (typeof p.id !== 'string') {
    throw new ConfigError(`Policy id must be a string, got ${typeof p.id}`, filePath);
  }

  if (typeof p.name !== 'string') {
    throw new ConfigError(`Policy name must be a string, got ${typeof p.name}`, filePath);
  }

  if (typeof p.evaluate !== 'function') {
    throw new ConfigError(`Policy evaluate must be a function, got ${typeof p.evaluate}`, filePath);
  }

  const validSeverities = ['error', 'warning', 'info'];
  if (!validSeverities.includes(p.severity as string)) {
    throw new ConfigError(
      `Policy severity must be one of: ${validSeverities.join(', ')}`,
      filePath
    );
  }

  const validCategories = ['cost', 'security', 'compliance', 'tagging', 'naming'];
  if (!validCategories.includes(p.category as string)) {
    throw new ConfigError(
      `Policy category must be one of: ${validCategories.join(', ')}`,
      filePath
    );
  }
}

/**
 * Merge custom policies with default policies
 */
export function mergePolicies(
  defaultPolicies: PolicyRule[],
  customPolicies: PolicyRule[]
): PolicyRule[] {
  const merged = [...defaultPolicies];
  const defaultIds = new Set(defaultPolicies.map((p) => p.id));

  for (const customPolicy of customPolicies) {
    if (defaultIds.has(customPolicy.id)) {
      // Replace default policy with custom one
      const index = merged.findIndex((p) => p.id === customPolicy.id);
      merged[index] = customPolicy;
    } else {
      // Add new custom policy
      merged.push(customPolicy);
    }
  }

  return merged;
}
