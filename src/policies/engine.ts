import { PolicyRule, IacResource, PolicyViolation, ValidationConfig } from '../types.js';
import { defaultPolicies } from './default-policies.js';
import { loadCustomPolicies, mergePolicies } from './custom-loader.js';
import { minimatch } from 'minimatch';

/**
 * Policy evaluation engine
 */
export class PolicyEngine {
  private policies: PolicyRule[];
  private config: ValidationConfig;
  private customPoliciesLoaded: PolicyRule[] = [];
  private frameworkFilter?: string[];

  constructor(config: ValidationConfig = {}) {
    this.config = config;
    this.policies = this.loadPolicies(config);
  }

  /**
   * Set framework filter to only run policies from specific frameworks
   */
  setFrameworkFilter(frameworks: string[]): void {
    this.frameworkFilter = frameworks.map((f) => f.toUpperCase());
    this.policies = this.loadPolicies(this.config);
  }

  /**
   * Get list of available frameworks from all policies
   */
  getAvailableFrameworks(): string[] {
    const frameworks = new Set<string>();
    const allPolicies =
      this.customPoliciesLoaded.length > 0
        ? mergePolicies(defaultPolicies, this.customPoliciesLoaded)
        : defaultPolicies;

    for (const policy of allPolicies) {
      if (policy.metadata?.frameworks) {
        for (const framework of policy.metadata.frameworks) {
          frameworks.add(framework);
        }
      }
    }

    return Array.from(frameworks).sort();
  }

  /**
   * Load custom policies from file(s)
   */
  async loadCustomPoliciesFromFiles(policyPaths: string[]): Promise<void> {
    const allCustomPolicies: PolicyRule[] = [];

    for (const path of policyPaths) {
      const policies = await loadCustomPolicies(path);
      allCustomPolicies.push(...policies);
    }

    this.customPoliciesLoaded = allCustomPolicies;
    // Reload policies with custom ones included
    this.policies = this.loadPolicies(this.config);
  }

  /**
   * Validate a list of resources against all policies
   */
  validateResources(resources: IacResource[]): PolicyViolation[] {
    const violations: PolicyViolation[] = [];

    for (const resource of resources) {
      // Check if resource should be excluded
      if (this.shouldExcludeResource(resource)) {
        continue;
      }

      for (const policy of this.policies) {
        if (!policy.enabled) continue;

        const violation = policy.evaluate(resource);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    return violations;
  }

  /**
   * Check if a resource should be excluded from validation
   */
  private shouldExcludeResource(resource: IacResource): boolean {
    const excludePatterns = this.config.exclude;

    if (!excludePatterns) {
      return false;
    }

    // Check file exclusions
    if (excludePatterns.files && excludePatterns.files.length > 0) {
      for (const pattern of excludePatterns.files) {
        if (minimatch(resource.location.file, pattern, { matchBase: true })) {
          return true;
        }
      }
    }

    // Check resource type exclusions
    if (excludePatterns.resources && excludePatterns.resources.length > 0) {
      for (const pattern of excludePatterns.resources) {
        if (minimatch(resource.type, pattern)) {
          return true;
        }
        // Also check against resource ID
        if (minimatch(resource.id, pattern)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Load and configure policies
   */
  private loadPolicies(config: ValidationConfig): PolicyRule[] {
    // Merge custom policies with default ones
    let policies =
      this.customPoliciesLoaded.length > 0
        ? mergePolicies(defaultPolicies, this.customPoliciesLoaded)
        : [...defaultPolicies];

    // Filter by framework if specified
    if (this.frameworkFilter && this.frameworkFilter.length > 0) {
      policies = policies.filter((p) => {
        if (!p.metadata?.frameworks || p.metadata.frameworks.length === 0) {
          return false; // Exclude policies without framework metadata
        }
        // Check if policy belongs to any of the requested frameworks
        return p.metadata.frameworks.some((f) =>
          this.frameworkFilter!.some((filter) => f.toUpperCase().includes(filter))
        );
      });
    }

    // Filter by enabled/disabled lists
    if (config.policies?.enabled) {
      const enabled = config.policies.enabled;
      policies = policies.filter((p) => enabled.includes(p.id));
    }

    if (config.policies?.disabled) {
      const disabled = config.policies.disabled;
      policies = policies.filter((p) => !disabled.includes(p.id));
    }

    return policies;
  }
}
