import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../src/policies/engine';
import type { IacResource } from '../src/types';

describe('PolicyEngine', () => {
  it('should validate resources against enabled policies', () => {
    const engine = new PolicyEngine();

    const resource: IacResource = {
      id: 'test-resource',
      type: 'aws_instance',
      properties: {
        instance_type: 't2.micro',
      },
      location: {
        file: 'test.tf',
        line: 1,
      },
    };

    const violations = engine.validateResources([resource]);

    // Should have at least one violation (missing tags)
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should detect missing required tags', () => {
    const engine = new PolicyEngine();

    const resource: IacResource = {
      id: 'untagged-instance',
      type: 'aws_instance',
      properties: {},
      location: {
        file: 'test.tf',
        line: 1,
      },
    };

    const violations = engine.validateResources([resource]);
    const tagViolation = violations.find((v) => v.ruleId === 'required-tags');

    expect(tagViolation).toBeDefined();
    expect(tagViolation?.severity).toBe('warning');
  });

  it('should detect public access violations', () => {
    const engine = new PolicyEngine();

    const resource: IacResource = {
      id: 'public-db',
      type: 'aws_db_instance',
      properties: {
        publicly_accessible: true,
      },
      location: {
        file: 'test.tf',
        line: 10,
      },
    };

    const violations = engine.validateResources([resource]);
    const publicViolation = violations.find((v) => v.ruleId === 'no-public-access');

    expect(publicViolation).toBeDefined();
    expect(publicViolation?.severity).toBe('error');
  });

  it('should detect large instance types', () => {
    const engine = new PolicyEngine();

    const resource: IacResource = {
      id: 'large-instance',
      type: 'aws_instance',
      properties: {
        instance_type: 't2.xlarge',
      },
      location: {
        file: 'test.tf',
        line: 5,
      },
    };

    const violations = engine.validateResources([resource]);
    const costViolation = violations.find((v) => v.ruleId === 'cost-large-instance');

    expect(costViolation).toBeDefined();
    expect(costViolation?.category).toBe('cost');
  });

  it('should validate naming conventions', () => {
    const engine = new PolicyEngine();

    const badResource: IacResource = {
      id: 'MyBadName',
      type: 'aws_s3_bucket',
      properties: {},
      location: {
        file: 'test.tf',
        line: 15,
      },
    };

    const violations = engine.validateResources([badResource]);
    const namingViolation = violations.find((v) => v.ruleId === 'naming-convention');

    expect(namingViolation).toBeDefined();
  });

  it('should allow disabling policies', () => {
    const engine = new PolicyEngine({
      policies: {
        disabled: ['naming-convention'],
      },
    });

    const resource: IacResource = {
      id: 'MyBadName',
      type: 'aws_s3_bucket',
      properties: {},
      location: {
        file: 'test.tf',
        line: 1,
      },
    };

    const violations = engine.validateResources([resource]);
    const namingViolation = violations.find((v) => v.ruleId === 'naming-convention');

    expect(namingViolation).toBeUndefined();
  });

  it('should detect encryption violations', () => {
    const engine = new PolicyEngine();

    const unencryptedDb: IacResource = {
      id: 'unencrypted-db',
      type: 'aws_db_instance',
      properties: {
        encrypted: false,
      },
      location: {
        file: 'test.tf',
        line: 20,
      },
    };

    const violations = engine.validateResources([unencryptedDb]);
    const encryptionViolation = violations.find((v) => v.ruleId === 'encryption-at-rest');

    expect(encryptionViolation).toBeDefined();
    expect(encryptionViolation?.severity).toBe('error');
  });

  it('should detect hardcoded secrets', () => {
    const engine = new PolicyEngine();

    const resourceWithSecret: IacResource = {
      id: 'app-config',
      type: 'aws_instance',
      properties: {
        password: 'hardcoded-password-123',
        api_key: 'sk-1234567890abcdef',
      },
      location: {
        file: 'test.tf',
        line: 30,
      },
    };

    const violations = engine.validateResources([resourceWithSecret]);
    const secretViolation = violations.find((v) => v.ruleId === 'no-hardcoded-secrets');

    expect(secretViolation).toBeDefined();
    expect(secretViolation?.severity).toBe('error');
  });

  it('should detect unrestricted security groups', () => {
    const engine = new PolicyEngine();

    const openSecurityGroup: IacResource = {
      id: 'open-sg',
      type: 'aws_security_group',
      properties: {
        ingress: [
          {
            from_port: 22,
            to_port: 22,
            protocol: 'tcp',
            cidr_blocks: ['0.0.0.0/0'],
          },
        ],
      },
      location: {
        file: 'test.tf',
        line: 40,
      },
    };

    const violations = engine.validateResources([openSecurityGroup]);
    const sgViolation = violations.find((v) => v.ruleId === 'security-group-unrestricted');

    expect(sgViolation).toBeDefined();
    expect(sgViolation?.message).toContain('0.0.0.0/0');
  });

  it('should validate IAM wildcard actions', () => {
    const engine = new PolicyEngine();

    const iamPolicy: IacResource = {
      id: 'overly-permissive-policy',
      type: 'aws_iam_policy',
      properties: {
        policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: '*',
              Resource: '*',
            },
          ],
        }),
      },
      location: {
        file: 'test.tf',
        line: 50,
      },
    };

    const violations = engine.validateResources([iamPolicy]);
    const iamViolation = violations.find((v) => v.ruleId === 'iam-wildcard-actions');

    expect(iamViolation).toBeDefined();
    expect(iamViolation?.category).toBe('security');
  });

  it('should handle resources with metadata', () => {
    const engine = new PolicyEngine();

    const resource: IacResource = {
      id: 'tagged-resource',
      type: 'aws_instance',
      properties: {
        tags: {
          Environment: 'production',
          Owner: 'team@example.com',
          Project: 'web-app',
        },
      },
      location: {
        file: 'test.tf',
        line: 60,
      },
    };

    const violations = engine.validateResources([resource]);
    const tagViolation = violations.find((v) => v.ruleId === 'required-tags');

    // Should not have tag violations
    expect(tagViolation).toBeUndefined();
  });

  it('should respect severity levels', () => {
    const engine = new PolicyEngine();

    const resources: IacResource[] = [
      {
        id: 'error-resource',
        type: 'aws_db_instance',
        properties: { publicly_accessible: true },
        location: { file: 'test.tf', line: 1 },
      },
      {
        id: 'warning-resource',
        type: 'aws_instance',
        properties: {},
        location: { file: 'test.tf', line: 10 },
      },
    ];

    const violations = engine.validateResources(resources);
    const errors = violations.filter((v) => v.severity === 'error');
    const warnings = violations.filter((v) => v.severity === 'warning');

    expect(errors.length).toBeGreaterThan(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('should handle multiple violations per resource', () => {
    const engine = new PolicyEngine();

    const problematicResource: IacResource = {
      id: 'bad-db',
      type: 'aws_db_instance',
      properties: {
        publicly_accessible: true,
        encrypted: false,
        // Missing tags
      },
      location: {
        file: 'test.tf',
        line: 70,
      },
    };

    const violations = engine.validateResources([problematicResource]);
    const resourceViolations = violations.filter((v) => v.resource.id === 'bad-db');

    // Should have multiple violations (public access, no encryption, missing tags)
    expect(resourceViolations.length).toBeGreaterThanOrEqual(3);
  });

  it('should provide remediation guidance', () => {
    const engine = new PolicyEngine();

    const resource: IacResource = {
      id: 'test-resource',
      type: 'aws_instance',
      properties: {},
      location: {
        file: 'test.tf',
        line: 1,
      },
    };

    const violations = engine.validateResources([resource]);

    violations.forEach((violation) => {
      expect(violation.remediation).toBeDefined();
      expect(typeof violation.remediation).toBe('string');
      expect(violation.remediation.length).toBeGreaterThan(0);
    });
  });

  it('should validate across different resource types', () => {
    const engine = new PolicyEngine();

    const resources: IacResource[] = [
      {
        id: 'instance',
        type: 'aws_instance',
        properties: { instance_type: 't2.micro' },
        location: { file: 'test.tf', line: 1 },
      },
      {
        id: 'bucket',
        type: 'aws_s3_bucket',
        properties: {},
        location: { file: 'test.tf', line: 10 },
      },
      {
        id: 'database',
        type: 'aws_db_instance',
        properties: {},
        location: { file: 'test.tf', line: 20 },
      },
    ];

    const violations = engine.validateResources(resources);

    // Should have violations for different resource types
    const types: string[] = [];
    for (const violation of violations) {
      const resourceType: string = violation.resource.type;
      types.push(resourceType);
    }
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBeGreaterThan(1);
  });
});
