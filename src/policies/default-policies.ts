import { PolicyRule, IacResource, PolicyViolation } from '../types.js';

/**
 * Default compliance policies
 */
export const defaultPolicies: PolicyRule[] = [
  // Tagging policies
  {
    id: 'required-tags',
    name: 'Required Tags',
    description: 'Ensures all resources have required tags',
    category: 'tagging',
    severity: 'warning',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      const requiredTags = ['Environment', 'Owner', 'Project'];
      const tags = resource.properties.tags as Record<string, string> | undefined;

      if (!tags) {
        return {
          ruleId: 'required-tags',
          ruleName: 'Required Tags',
          severity: 'warning',
          category: 'tagging',
          message: 'Resource is missing required tags',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: `Add tags: ${requiredTags.join(', ')}`,
        };
      }

      const missingTags = requiredTags.filter((tag) => !tags[tag]);
      if (missingTags.length > 0) {
        return {
          ruleId: 'required-tags',
          ruleName: 'Required Tags',
          severity: 'warning',
          category: 'tagging',
          message: `Resource is missing tags: ${missingTags.join(', ')}`,
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: `Add missing tags: ${missingTags.join(', ')}`,
        };
      }

      return null;
    },
  },

  // Security policies
  {
    id: 'no-public-access',
    name: 'No Public Access',
    description: 'Prevents resources from being publicly accessible',
    category: 'security',
    severity: 'error',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      // Check for public access patterns
      const props = resource.properties;
      
      if (props.public === true || props.publicly_accessible === true) {
        return {
          ruleId: 'no-public-access',
          ruleName: 'No Public Access',
          severity: 'error',
          category: 'security',
          message: 'Resource is configured for public access',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Set public access to false and use VPN or private networking',
        };
      }

      return null;
    },
  },

  // Naming conventions
  {
    id: 'naming-convention',
    name: 'Naming Convention',
    description: 'Enforces standard naming patterns',
    category: 'naming',
    severity: 'info',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      // Simple naming check: lowercase with hyphens
      const validNamePattern = /^[a-z0-9-]+$/;
      
      if (!validNamePattern.test(resource.id)) {
        return {
          ruleId: 'naming-convention',
          ruleName: 'Naming Convention',
          severity: 'info',
          category: 'naming',
          message: `Resource name "${resource.id}" does not follow naming convention`,
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Use lowercase letters, numbers, and hyphens only',
        };
      }

      return null;
    },
  },

  // Cost policies
  {
    id: 'cost-large-instance',
    name: 'Large Instance Warning',
    description: 'Warns about expensive instance types',
    category: 'cost',
    severity: 'warning',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      const instanceType = resource.properties.instance_type as string | undefined;
      
      // Simplified check for large instance types
      if (instanceType && (instanceType.includes('xlarge') || instanceType.includes('metal'))) {
        return {
          ruleId: 'cost-large-instance',
          ruleName: 'Large Instance Warning',
          severity: 'warning',
          category: 'cost',
          message: `Instance type "${instanceType}" may incur high costs`,
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Consider using a smaller instance type or verify this is necessary',
        };
      }

      return null;
    },
  },
];
