/**
 * Example custom policies for GitOps Compliance Engine
 * 
 * This file demonstrates how to write custom policies that extend
 * the default policy set. Policies can be written in JavaScript,
 * TypeScript, or JSON format.
 * 
 * To use custom policies:
 *   gce validate . --policies custom-policies.js
 */

const policies = [
  {
    id: 'custom-require-description',
    name: 'Require Resource Description',
    description: 'All resources must have a description tag for documentation',
    category: 'tagging',
    severity: 'warning',
    enabled: true,
    metadata: {
      rationale: 'Resource descriptions improve team collaboration and documentation',
      references: ['https://docs.example.com/best-practices'],
      frameworks: ['Internal Standards'],
    },
    evaluate: (resource) => {
      const tags = resource.properties.tags;
      
      if (!tags || !tags.Description) {
        return {
          ruleId: 'custom-require-description',
          ruleName: 'Require Resource Description',
          severity: 'warning',
          category: 'tagging',
          message: 'Resource missing Description tag',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Add a Description tag explaining the purpose of this resource',
        };
      }

      return null;
    },
  },

  {
    id: 'custom-prevent-s3-lifecycle',
    name: 'Prevent S3 Without Lifecycle',
    description: 'S3 buckets must have lifecycle policies for cost optimization',
    category: 'cost',
    severity: 'error',
    enabled: true,
    metadata: {
      rationale: 'Lifecycle policies help automatically manage object retention and reduce storage costs',
      references: [
        'https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html',
      ],
      frameworks: ['FinOps', 'AWS Well-Architected'],
    },
    evaluate: (resource) => {
      // Only check S3 buckets
      if (!resource.type.includes('s3_bucket') && !resource.type.includes('S3')) {
        return null;
      }

      const hasLifecycle = 
        resource.properties.lifecycle_rule ||
        resource.properties.lifecycle_configuration ||
        resource.properties.LifecycleConfiguration;

      if (!hasLifecycle) {
        return {
          ruleId: 'custom-prevent-s3-lifecycle',
          ruleName: 'Prevent S3 Without Lifecycle',
          severity: 'error',
          category: 'cost',
          message: 'S3 bucket does not have lifecycle policy configured',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Add lifecycle rules to transition or expire objects automatically',
        };
      }

      return null;
    },
  },

  {
    id: 'custom-team-tag-required',
    name: 'Team Tag Required',
    description: 'All resources must have a Team tag for ownership tracking',
    category: 'tagging',
    severity: 'error',
    enabled: true,
    evaluate: (resource) => {
      const tags = resource.properties.tags;

      if (!tags || !tags.Team) {
        return {
          ruleId: 'custom-team-tag-required',
          ruleName: 'Team Tag Required',
          severity: 'error',
          category: 'tagging',
          message: 'Resource missing required Team tag',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Add Team tag with your team name (e.g., platform, backend, frontend)',
        };
      }

      return null;
    },
  },

  {
    id: 'custom-prevent-large-ebs',
    name: 'Prevent Very Large EBS Volumes',
    description: 'Warns about EBS volumes larger than 2TB to prevent cost overruns',
    category: 'cost',
    severity: 'warning',
    enabled: true,
    evaluate: (resource) => {
      if (!resource.type.includes('ebs_volume') && !resource.type.includes('EBS')) {
        return null;
      }

      const size = resource.properties.size || resource.properties.VolumeSize;

      if (typeof size === 'number' && size > 2000) {
        return {
          ruleId: 'custom-prevent-large-ebs',
          ruleName: 'Prevent Very Large EBS Volumes',
          severity: 'warning',
          category: 'cost',
          message: `EBS volume size ${size}GB exceeds recommended maximum of 2000GB`,
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Consider using multiple smaller volumes or S3 for object storage',
        };
      }

      return null;
    },
  },

  {
    id: 'custom-database-backup-window',
    name: 'Database Backup Window Required',
    description: 'Database instances must specify backup windows',
    category: 'compliance',
    severity: 'error',
    enabled: true,
    metadata: {
      rationale: 'Backup windows ensure databases are backed up during low-traffic periods',
      frameworks: ['SOC2', 'Internal Standards'],
    },
    evaluate: (resource) => {
      const isDatabaseResource =
        resource.type.includes('db_instance') ||
        resource.type.includes('rds_cluster') ||
        resource.type.includes('DBInstance');

      if (!isDatabaseResource) {
        return null;
      }

      const hasBackupWindow =
        resource.properties.backup_window ||
        resource.properties.PreferredBackupWindow;

      if (!hasBackupWindow) {
        return {
          ruleId: 'custom-database-backup-window',
          ruleName: 'Database Backup Window Required',
          severity: 'error',
          category: 'compliance',
          message: 'Database missing backup window configuration',
          resource: {
            id: resource.id,
            type: resource.type,
            location: resource.location,
          },
          remediation: 'Specify preferred_backup_window (e.g., "03:00-04:00")',
        };
      }

      return null;
    },
  },
];

// Export for ES modules
export { policies };
export default policies;

// Also support CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { policies, default: policies };
}
