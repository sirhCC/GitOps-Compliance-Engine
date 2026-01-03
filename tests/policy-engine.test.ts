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
});
