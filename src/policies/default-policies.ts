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

  // Security policies - Encryption
  {
    id: 'encryption-at-rest',
    name: 'Encryption at Rest Required',
    description: 'Ensures resources have encryption enabled',
    category: 'security',
    severity: 'error',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      const props = resource.properties;

      // Check for encryption settings
      const hasEncryption =
        props.encrypted === true ||
        props.encryption === true ||
        props.encryption_enabled === true ||
        props.server_side_encryption_configuration !== undefined ||
        props.kms_key_id !== undefined;

      // Resources that should have encryption
      const needsEncryption = [
        'aws_db_instance',
        'aws_rds_cluster',
        'aws_ebs_volume',
        'aws_s3_bucket',
        'aws_efs_file_system',
        'aws_dynamodb_table',
        'aws_sqs_queue',
        'aws_kinesis_stream',
      ];

      if (needsEncryption.includes(resource.type) && !hasEncryption) {
        return {
          ruleId: 'encryption-at-rest',
          ruleName: 'Encryption at Rest Required',
          severity: 'error',
          category: 'security',
          message: 'Resource does not have encryption at rest enabled',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Enable encryption at rest using KMS or default encryption',
        };
      }

      return null;
    },
  },

  {
    id: 'no-hardcoded-secrets',
    name: 'No Hardcoded Secrets',
    description: 'Detects potential hardcoded secrets in configuration',
    category: 'security',
    severity: 'error',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      const props = resource.properties;
      const sensitiveKeys = ['password', 'secret', 'api_key', 'token', 'private_key'];

      for (const [key, value] of Object.entries(props)) {
        const lowerKey = key.toLowerCase();

        // Check if key name suggests sensitive data
        if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
          // Check if value looks hardcoded (not a reference/variable)
          if (
            typeof value === 'string' &&
            !value.startsWith('var.') &&
            !value.startsWith('${') &&
            !value.startsWith('data.') &&
            !value.includes('aws_secretsmanager') &&
            !value.includes('vault') &&
            value.length > 0
          ) {
            return {
              ruleId: 'no-hardcoded-secrets',
              ruleName: 'No Hardcoded Secrets',
              severity: 'error',
              category: 'security',
              message: `Potential hardcoded secret detected in property "${key}"`,
              resource: {
                id: resource.id,
                type: resource.type,
                location: resource.location,
              },
              remediation: 'Use variables, secrets manager, or vault for sensitive values',
            };
          }
        }
      }

      return null;
    },
  },

  {
    id: 'security-group-unrestricted',
    name: 'No Unrestricted Security Groups',
    description: 'Prevents overly permissive security group rules',
    category: 'security',
    severity: 'error',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      if (!resource.type.includes('security_group') && !resource.type.includes('SecurityGroup')) {
        return null;
      }

      const props = resource.properties;
      const ingress = props.ingress as
        | Array<Record<string, unknown>>
        | Record<string, unknown>
        | undefined;

      // Check ingress rules
      const rules = Array.isArray(ingress) ? ingress : ingress ? [ingress] : [];

      for (const rule of rules) {
        const cidrBlocks = rule.cidr_blocks as string[] | undefined;
        const ipv6Cidr = rule.ipv6_cidr_blocks as string[] | undefined;

        // Check for 0.0.0.0/0 (all traffic)
        if (cidrBlocks?.includes('0.0.0.0/0') || ipv6Cidr?.includes('::/0')) {
          const fromPort = rule.from_port;

          // Allow common restricted ports but warn on wide open access
          if (fromPort === 80 || fromPort === 443) {
            continue;
          }

          return {
            ruleId: 'security-group-unrestricted',
            ruleName: 'No Unrestricted Security Groups',
            severity: 'error',
            category: 'security',
            message: 'Security group allows unrestricted access (0.0.0.0/0)',
            resource: {
              id: resource.id,
              type: resource.type,
              location: resource.location,
            },
            remediation:
              'Restrict CIDR blocks to specific IP ranges or use security group references',
          };
        }
      }

      return null;
    },
  },

  {
    id: 'encryption-in-transit',
    name: 'Encryption in Transit Required',
    description: 'Ensures data is encrypted during transmission',
    category: 'security',
    severity: 'error',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      const props = resource.properties;

      // Check load balancers for HTTPS
      if (resource.type.includes('load_balancer') || resource.type.includes('elb')) {
        const protocol = props.protocol as string | undefined;
        const listeners = props.listener as Array<Record<string, unknown>> | undefined;

        if (protocol && protocol.toLowerCase() === 'http') {
          return {
            ruleId: 'encryption-in-transit',
            ruleName: 'Encryption in Transit Required',
            severity: 'error',
            category: 'security',
            message: 'Load balancer uses unencrypted HTTP protocol',
            resource: {
              id: resource.id,
              type: resource.type,
              location: resource.location,
            },
            remediation: 'Use HTTPS protocol with valid SSL/TLS certificates',
          };
        }

        // Check listeners
        if (Array.isArray(listeners)) {
          for (const listener of listeners) {
            const listenerProtocol = listener.protocol as string | undefined;
            if (listenerProtocol?.toLowerCase() === 'http') {
              return {
                ruleId: 'encryption-in-transit',
                ruleName: 'Encryption in Transit Required',
                severity: 'error',
                category: 'security',
                message: 'Listener configured with unencrypted HTTP',
                resource: {
                  id: resource.id,
                  type: resource.type,
                  location: resource.location,
                },
                remediation: 'Configure listener with HTTPS protocol',
              };
            }
          }
        }
      }

      return null;
    },
  },

  {
    id: 'iam-wildcard-actions',
    name: 'No IAM Wildcard Actions',
    description: 'Prevents overly permissive IAM policies',
    category: 'security',
    severity: 'warning',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      if (!resource.type.includes('iam_') && !resource.type.includes('IAM')) {
        return null;
      }

      const props = resource.properties;
      const policy = props.policy as string | Record<string, unknown> | undefined;

      let policyObj: Record<string, unknown> | undefined;

      if (typeof policy === 'string') {
        try {
          policyObj = JSON.parse(policy) as Record<string, unknown>;
        } catch {
          return null;
        }
      } else if (typeof policy === 'object') {
        policyObj = policy;
      }

      if (policyObj && policyObj.Statement) {
        const statements = Array.isArray(policyObj.Statement)
          ? policyObj.Statement
          : [policyObj.Statement];

        for (const statement of statements) {
          const stmt = statement as Record<string, unknown>;
          const actions = stmt.Action as string | string[] | undefined;
          const actionList = Array.isArray(actions) ? actions : actions ? [actions] : [];

          // Check for wildcard actions
          if (actionList.some((a) => a === '*' || a.endsWith(':*'))) {
            return {
              ruleId: 'iam-wildcard-actions',
              ruleName: 'No IAM Wildcard Actions',
              severity: 'warning',
              category: 'security',
              message: 'IAM policy contains wildcard actions',
              resource: {
                id: resource.id,
                type: resource.type,
                location: resource.location,
              },
              remediation: 'Use specific IAM actions following least privilege principle',
            };
          }
        }
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

  {
    id: 'cost-unattached-volumes',
    name: 'Unused EBS Volumes',
    description: 'Detects unattached EBS volumes that incur costs',
    category: 'cost',
    severity: 'warning',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      if (!resource.type.includes('ebs_volume') && !resource.type.includes('EBS')) {
        return null;
      }

      const props = resource.properties;
      const attachedInstance = props.instance || props.attached_instance;

      if (!attachedInstance) {
        return {
          ruleId: 'cost-unattached-volumes',
          ruleName: 'Unused EBS Volumes',
          severity: 'warning',
          category: 'cost',
          message: 'EBS volume is not attached to any instance',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Attach volume to an instance or delete if no longer needed',
        };
      }

      return null;
    },
  },

  {
    id: 'cost-gp2-to-gp3',
    name: 'GP2 to GP3 Migration',
    description: 'Suggests migrating GP2 volumes to more cost-effective GP3',
    category: 'cost',
    severity: 'info',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      if (!resource.type.includes('ebs_volume')) {
        return null;
      }

      const props = resource.properties;
      const volumeType = props.type || props.volume_type;

      if (volumeType === 'gp2') {
        return {
          ruleId: 'cost-gp2-to-gp3',
          ruleName: 'GP2 to GP3 Migration',
          severity: 'info',
          category: 'cost',
          message: 'Consider migrating from gp2 to gp3 for cost savings',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'GP3 volumes are up to 20% cheaper and offer better performance',
        };
      }

      return null;
    },
  },

  {
    id: 'cost-oversized-volume',
    name: 'Oversized Volume Warning',
    description: 'Warns about very large storage volumes',
    category: 'cost',
    severity: 'warning',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      const props = resource.properties;
      const size = props.size || props.allocated_storage;

      if (typeof size === 'number' && size > 1000) {
        return {
          ruleId: 'cost-oversized-volume',
          ruleName: 'Oversized Volume Warning',
          severity: 'warning',
          category: 'cost',
          message: `Volume size ${size} GB may incur significant costs`,
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Review storage requirements and consider using lifecycle policies',
        };
      }

      return null;
    },
  },

  {
    id: 'cost-multi-az',
    name: 'Multi-AZ Cost Warning',
    description: 'Warns about increased costs for Multi-AZ deployments',
    category: 'cost',
    severity: 'info',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      const props = resource.properties;
      const multiAz = props.multi_az || props.multi_availability_zone;

      if (multiAz === true) {
        return {
          ruleId: 'cost-multi-az',
          ruleName: 'Multi-AZ Cost Warning',
          severity: 'info',
          category: 'cost',
          message: 'Multi-AZ deployment doubles infrastructure costs',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Verify Multi-AZ is required for this environment',
        };
      }

      return null;
    },
  },

  {
    id: 'cost-nat-gateway',
    name: 'NAT Gateway Cost Warning',
    description: 'Warns about NAT Gateway costs',
    category: 'cost',
    severity: 'info',
    enabled: true,
    evaluate: (resource: IacResource): PolicyViolation | null => {
      if (resource.type === 'aws_nat_gateway') {
        return {
          ruleId: 'cost-nat-gateway',
          ruleName: 'NAT Gateway Cost Warning',
          severity: 'info',
          category: 'cost',
          message: 'NAT Gateways incur significant hourly and data transfer costs',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Consider NAT instances for dev/test environments or VPC endpoints',
        };
      }

      return null;
    },
  },

  // Additional tagging policies
  {
    id: 'cost-center-tag',
    name: 'Cost Center Tag Required',
    description: 'Ensures resources have cost center tags for billing',
    category: 'tagging',
    severity: 'warning',
    enabled: false, // Disabled by default
    evaluate: (resource: IacResource): PolicyViolation | null => {
      const tags = resource.properties.tags as Record<string, string> | undefined;

      if (!tags || !tags['CostCenter']) {
        return {
          ruleId: 'cost-center-tag',
          ruleName: 'Cost Center Tag Required',
          severity: 'warning',
          category: 'tagging',
          message: 'Resource is missing CostCenter tag for billing allocation',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Add CostCenter tag with appropriate billing code',
        };
      }

      return null;
    },
  },

  {
    id: 'expiration-tag',
    name: 'Expiration Date Tag',
    description: 'Ensures temporary resources have expiration dates',
    category: 'tagging',
    severity: 'info',
    enabled: false, // Disabled by default
    evaluate: (resource: IacResource): PolicyViolation | null => {
      const tags = resource.properties.tags as Record<string, string> | undefined;
      const env = tags?.Environment || tags?.environment;

      // Only check dev/test/staging environments
      if (env && ['dev', 'test', 'staging', 'sandbox'].includes(env.toLowerCase())) {
        if (!tags || !tags['ExpirationDate']) {
          return {
            ruleId: 'expiration-tag',
            ruleName: 'Expiration Date Tag',
            severity: 'info',
            category: 'tagging',
            message: 'Non-production resource missing ExpirationDate tag',
            resource: {
              id: resource.id,
              type: resource.type,
              location: resource.location,
            },
            remediation: 'Add ExpirationDate tag (YYYY-MM-DD) for resource cleanup tracking',
          };
        }
      }

      return null;
    },
  },

  {
    id: 'backup-tag',
    name: 'Backup Policy Tag',
    description: 'Ensures data resources have backup policy tags',
    category: 'tagging',
    severity: 'warning',
    enabled: false, // Disabled by default
    evaluate: (resource: IacResource): PolicyViolation | null => {
      // Resources that typically need backups
      const dataResources = [
        'aws_db_instance',
        'aws_rds_cluster',
        'aws_ebs_volume',
        'aws_efs_file_system',
        'aws_dynamodb_table',
      ];

      if (dataResources.includes(resource.type)) {
        const tags = resource.properties.tags as Record<string, string> | undefined;

        if (!tags || !tags['BackupPolicy']) {
          return {
            ruleId: 'backup-tag',
            ruleName: 'Backup Policy Tag',
            severity: 'warning',
            category: 'tagging',
            message: 'Data resource missing BackupPolicy tag',
            resource: {
              id: resource.id,
              type: resource.type,
              location: resource.location,
            },
            remediation: 'Add BackupPolicy tag (e.g., "daily", "weekly", "none")',
          };
        }
      }

      return null;
    },
  },

  // Compliance policies
  {
    id: 'compliance-logging',
    name: 'Audit Logging Required',
    description: 'Ensures resources have audit logging enabled',
    category: 'compliance',
    severity: 'error',
    enabled: false, // Disabled by default
    evaluate: (resource: IacResource): PolicyViolation | null => {
      const props = resource.properties;

      // Resources that should have logging
      const needsLogging = [
        'aws_s3_bucket',
        'aws_cloudtrail',
        'aws_db_instance',
        'aws_rds_cluster',
        'aws_api_gateway',
        'aws_lb',
      ];

      if (needsLogging.includes(resource.type)) {
        const hasLogging =
          props.logging !== undefined ||
          props.enabled_cloudwatch_logs_exports !== undefined ||
          props.access_logs !== undefined ||
          props.logging_config !== undefined;

        if (!hasLogging) {
          return {
            ruleId: 'compliance-logging',
            ruleName: 'Audit Logging Required',
            severity: 'error',
            category: 'compliance',
            message: 'Resource does not have audit logging enabled',
            resource: {
              id: resource.id,
              type: resource.type,
              location: resource.location,
            },
            remediation: 'Enable CloudWatch logs or access logging for compliance',
          };
        }
      }

      return null;
    },
  },

  {
    id: 'compliance-versioning',
    name: 'Versioning Required',
    description: 'Ensures S3 buckets have versioning enabled',
    category: 'compliance',
    severity: 'warning',
    enabled: false, // Disabled by default
    evaluate: (resource: IacResource): PolicyViolation | null => {
      if (resource.type === 'aws_s3_bucket') {
        const props = resource.properties;
        const versioning = props.versioning as Record<string, unknown> | undefined;

        if (!versioning || versioning.enabled !== true) {
          return {
            ruleId: 'compliance-versioning',
            ruleName: 'Versioning Required',
            severity: 'warning',
            category: 'compliance',
            message: 'S3 bucket does not have versioning enabled',
            resource: {
              id: resource.id,
              type: resource.type,
              location: resource.location,
            },
            remediation: 'Enable versioning for data protection and compliance',
          };
        }
      }

      return null;
    },
  },

  {
    id: 'compliance-mfa-delete',
    name: 'MFA Delete for S3',
    description: 'Ensures critical S3 buckets require MFA for deletion',
    category: 'compliance',
    severity: 'info',
    enabled: false, // Disabled by default
    evaluate: (resource: IacResource): PolicyViolation | null => {
      if (resource.type === 'aws_s3_bucket') {
        const props = resource.properties;
        const tags = props.tags as Record<string, string> | undefined;
        const env = tags?.Environment;

        // Only check production buckets
        if (env?.toLowerCase() === 'production') {
          const versioning = props.versioning as Record<string, unknown> | undefined;

          if (!versioning || versioning.mfa_delete !== true) {
            return {
              ruleId: 'compliance-mfa-delete',
              ruleName: 'MFA Delete for S3',
              severity: 'info',
              category: 'compliance',
              message: 'Production S3 bucket should require MFA for deletion',
              resource: {
                id: resource.id,
                type: resource.type,
                location: resource.location,
              },
              remediation: 'Enable MFA delete in versioning configuration for production buckets',
            };
          }
        }
      }

      return null;
    },
  },
];
