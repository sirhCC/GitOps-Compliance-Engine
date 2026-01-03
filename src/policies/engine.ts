import { PolicyRule, IacResource, PolicyViolation, ValidationConfig } from '../types.js';
import { defaultPolicies } from './default-policies.js';

/**
 * Policy evaluation engine
 */
export class PolicyEngine {
  private policies: PolicyRule[];

  constructor(config: ValidationConfig = {}) {
    this.policies = this.loadPolicies(config);
  }

  /**
   * Validate a list of resources against all policies
   */
  validateResources(resources: IacResource[]): PolicyViolation[] {
    const violations: PolicyViolation[] = [];

    for (const resource of resources) {
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
   * Load and configure policies
   */
  private loadPolicies(config: ValidationConfig): PolicyRule[] {
    let policies = [...defaultPolicies];

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
