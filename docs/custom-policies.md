# Custom Policy Authoring Guide

Learn how to create custom policies to extend the GitOps Compliance Engine with your organization's specific requirements.

## Table of Contents

- [Overview](#overview)
- [Policy Structure](#policy-structure)
- [File Formats](#file-formats)
- [Writing Policies](#writing-policies)
- [Using Custom Policies](#using-custom-policies)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

Custom policies allow you to:
- Enforce organization-specific compliance requirements
- Add industry-specific validations
- Override default policies with custom implementations
- Extend the built-in policy set

## Policy Structure

Every policy must have the following fields:

```typescript
interface PolicyRule {
  id: string;                    // Unique identifier (e.g., 'custom-team-tag')
  name: string;                  // Human-readable name
  description: string;           // What the policy checks
  category: PolicyCategory;      // 'cost' | 'security' | 'compliance' | 'tagging' | 'naming'
  severity: Severity;            // 'error' | 'warning' | 'info'
  enabled: boolean;              // Whether policy is active
  evaluate: (resource: IacResource) => PolicyViolation | null;
  metadata?: {                   // Optional documentation
    rationale?: string;
    references?: string[];
    frameworks?: string[];
  };
}
```

## File Formats

### JavaScript/TypeScript (Recommended)

**Advantages:**
- Full programmatic control
- Complex evaluation logic
- TypeScript type safety
- Import external modules

**File extensions:** `.js`, `.mjs`, `.ts`

**Export formats:**
```javascript
// Named export
export const policies = [/* ... */];

// Default export (array)
export default [/* ... */];

// Default export (object)
export default { policies: [/* ... */] };
```

### JSON

**Advantages:**
- Simple declarative format
- Easy to generate programmatically
- No code execution needed

**Limitations:**
- Cannot contain evaluation functions (for documentation only)
- Limited to metadata and structure

**File extension:** `.json`

## Writing Policies

### 1. Basic Policy Template

```javascript
export const policies = [
  {
    id: 'custom-my-policy',
    name: 'My Custom Policy',
    description: 'Describes what this policy validates',
    category: 'security',
    severity: 'error',
    enabled: true,
    
    evaluate: (resource) => {
      // Your validation logic here
      
      // Return null if policy passes
      if (policyPasses) {
        return null;
      }
      
      // Return violation if policy fails
      return {
        ruleId: 'custom-my-policy',
        ruleName: 'My Custom Policy',
        severity: 'error',
        category: 'security',
        message: 'Description of what went wrong',
        resource: {
          id: resource.id,
          type: resource.type,
          location: resource.location,
        },
        remediation: 'How to fix this issue',
      };
    },
  },
];
```

### 2. Accessing Resource Properties

```javascript
evaluate: (resource) => {
  // Resource metadata
  const resourceId = resource.id;        // e.g., 'my_instance'
  const resourceType = resource.type;    // e.g., 'aws_instance'
  const filePath = resource.location.file;
  const lineNumber = resource.location.line;
  
  // Resource properties (varies by resource type)
  const props = resource.properties;
  
  // Common patterns:
  const tags = props.tags;
  const instanceType = props.instance_type;
  const encrypted = props.encrypted;
  const publicAccess = props.publicly_accessible;
  
  // Check nested properties
  const versioning = props.versioning?.enabled;
  const securityGroups = props.security_groups;
  
  // Your logic...
}
```

### 3. Filtering by Resource Type

```javascript
evaluate: (resource) => {
  // Check specific resource type
  if (resource.type !== 'aws_s3_bucket') {
    return null; // Skip this resource
  }
  
  // Check multiple types
  const databaseTypes = ['aws_db_instance', 'aws_rds_cluster'];
  if (!databaseTypes.includes(resource.type)) {
    return null;
  }
  
  // Pattern matching
  if (!resource.type.includes('s3_bucket')) {
    return null;
  }
  
  // Your validation...
}
```

### 4. Tag Validation Example

```javascript
{
  id: 'custom-required-tags',
  name: 'Organization Required Tags',
  description: 'Ensures all resources have Team, CostCenter, and Application tags',
  category: 'tagging',
  severity: 'error',
  enabled: true,
  
  evaluate: (resource) => {
    const requiredTags = ['Team', 'CostCenter', 'Application'];
    const tags = resource.properties.tags || {};
    
    const missingTags = requiredTags.filter(tag => !tags[tag]);
    
    if (missingTags.length > 0) {
      return {
        ruleId: 'custom-required-tags',
        ruleName: 'Organization Required Tags',
        severity: 'error',
        category: 'tagging',
        message: `Missing required tags: ${missingTags.join(', ')}`,
        resource: {
          id: resource.id,
          type: resource.type,
          location: resource.location,
        },
        remediation: `Add the following tags: ${missingTags.join(', ')}`,
      };
    }
    
    return null;
  },
}
```

### 5. Security Policy Example

```javascript
{
  id: 'custom-tls-version',
  name: 'Minimum TLS Version',
  description: 'Ensures load balancers use TLS 1.2 or higher',
  category: 'security',
  severity: 'error',
  enabled: true,
  metadata: {
    rationale: 'TLS 1.0 and 1.1 are deprecated and vulnerable',
    references: [
      'https://datatracker.ietf.org/doc/rfc8996/',
    ],
    frameworks: ['PCI-DSS', 'HIPAA'],
  },
  
  evaluate: (resource) => {
    // Only check load balancers
    if (!resource.type.includes('load_balancer') && !resource.type.includes('lb')) {
      return null;
    }
    
    const sslPolicy = resource.properties.ssl_policy;
    const listeners = resource.properties.listener || [];
    
    // Check SSL policy
    const weakPolicies = ['ELBSecurityPolicy-TLS-1-0', 'ELBSecurityPolicy-TLS-1-1'];
    if (weakPolicies.includes(sslPolicy)) {
      return {
        ruleId: 'custom-tls-version',
        ruleName: 'Minimum TLS Version',
        severity: 'error',
        category: 'security',
        message: `Load balancer uses deprecated TLS policy: ${sslPolicy}`,
        resource: {
          id: resource.id,
          type: resource.type,
          location: resource.location,
        },
        remediation: 'Use ELBSecurityPolicy-TLS-1-2-2017-01 or newer',
      };
    }
    
    return null;
  },
}
```

### 6. Cost Optimization Example

```javascript
{
  id: 'custom-prevent-reserved-ip-waste',
  name: 'Prevent Unattached Elastic IPs',
  description: 'Elastic IPs cost money when not attached to instances',
  category: 'cost',
  severity: 'warning',
  enabled: true,
  metadata: {
    rationale: 'Unattached Elastic IPs incur hourly charges',
    references: [
      'https://aws.amazon.com/ec2/pricing/on-demand/#Elastic_IP_Addresses',
    ],
  },
  
  evaluate: (resource) => {
    if (resource.type !== 'aws_eip') {
      return null;
    }
    
    const attachedToInstance = resource.properties.instance;
    const attachedToNetworkInterface = resource.properties.network_interface;
    
    if (!attachedToInstance && !attachedToNetworkInterface) {
      return {
        ruleId: 'custom-prevent-reserved-ip-waste',
        ruleName: 'Prevent Unattached Elastic IPs',
        severity: 'warning',
        category: 'cost',
        message: 'Elastic IP is not attached to any instance or network interface',
        resource: {
          id: resource.id,
          type: resource.type,
          location: resource.location,
        },
        remediation: 'Attach to an instance or release if not needed',
      };
    }
    
    return null;
  },
}
```

## Using Custom Policies

### Command Line

```bash
# Single policy file
gce validate . --policies custom-policies.js

# Multiple policy files
gce validate . --policies custom-policies.js team-policies.js

# With other options
gce validate . --policies custom-policies.js --severity warning --verbose
```

### With Configuration File

```json
{
  "customPolicies": ["./policies/custom.js", "./policies/team.js"],
  "policies": {
    "enabled": ["custom-team-tag", "custom-tls-version"],
    "disabled": ["required-tags"]
  }
}
```

```bash
gce validate . --config gce.config.json
```

## Best Practices

### 1. Naming Conventions

- **Prefix custom IDs:** Use `custom-` prefix to avoid conflicts
- **Descriptive names:** Make it clear what the policy checks
- **Consistent casing:** Use kebab-case for IDs

```javascript
// Good
id: 'custom-team-tag-required'

// Avoid
id: 'myPolicy'
id: 'team_tag'
```

### 2. Performance Optimization

```javascript
// Good: Early return for irrelevant resources
evaluate: (resource) => {
  if (resource.type !== 'aws_s3_bucket') {
    return null;
  }
  // Expensive validation logic...
}

// Avoid: Checking every resource unnecessarily
evaluate: (resource) => {
  // Expensive logic that runs for all resources
  if (resource.type === 'aws_s3_bucket') {
    // Validation
  }
  return null;
}
```

### 3. Clear Error Messages

```javascript
// Good: Specific and actionable
message: 'S3 bucket missing versioning configuration'
remediation: 'Add versioning { enabled = true } to the bucket resource'

// Avoid: Vague or unhelpful
message: 'Bucket configuration error'
remediation: 'Fix the configuration'
```

### 4. Adding Metadata

Always include metadata for better documentation:

```javascript
metadata: {
  rationale: 'Why this policy exists',
  references: [
    'https://link-to-documentation.com',
    'https://compliance-framework.com/requirement',
  ],
  frameworks: ['SOC2', 'PCI-DSS', 'Internal Standards'],
}
```

### 5. Testing Custom Policies

Create test IaC files to validate your policies:

```bash
# Create test file
cat > test.tf << 'EOF'
resource "aws_s3_bucket" "test" {
  bucket = "test-bucket"
  # Missing versioning - should trigger policy
}
EOF

# Run validation
gce validate test.tf --policies custom-policies.js
```

## Examples

See the `/examples` directory for complete examples:

- **custom-policies.js** - Full JavaScript/TypeScript examples
- **custom-policies.json** - JSON format examples

## TypeScript Support

For TypeScript custom policies, you'll need to compile them first:

```typescript
// custom-policies.ts
import { PolicyRule, IacResource, PolicyViolation } from 'gitops-compliance-engine';

export const policies: PolicyRule[] = [
  {
    id: 'custom-typescript-policy',
    // ... policy definition with full type safety
    evaluate: (resource: IacResource): PolicyViolation | null => {
      // TypeScript will provide autocomplete and type checking
      return null;
    },
  },
];
```

Compile and use:

```bash
tsc custom-policies.ts
gce validate . --policies custom-policies.js
```

## Troubleshooting

### Policy Not Loading

1. Check file path is correct
2. Verify export format matches examples
3. Look for syntax errors in console output

### Policy Not Running

1. Ensure `enabled: true` is set
2. Check if policy ID conflicts with disabled policies in config
3. Verify resource type filtering logic

### Evaluation Errors

1. Check that `evaluate` function returns correct type
2. Add null checks for optional properties
3. Test with sample resources

## Need Help?

- See [README.md](../README.md) for general usage
- Check [examples/](../examples/) for working examples
- Review default policies in `src/policies/default-policies.ts`
