import { describe, it, expect } from 'vitest';
import { loadCustomPolicies, mergePolicies } from '../src/policies/custom-loader.js';
import { PolicyEngine } from '../src/policies/engine.js';
import { defaultPolicies } from '../src/policies/default-policies.js';
import type { IacResource, PolicyRule } from '../src/types.js';
import { resolve } from 'path';

describe('Custom Policy Loading', () => {
  describe('loadCustomPolicies', () => {
    it.skip('should load policies from JavaScript file', async () => {
      const filePath = resolve('examples/custom-policies.js');
      const policies = await loadCustomPolicies(filePath);

      expect(policies).toBeDefined();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThan(0);

      // Verify policy structure
      const firstPolicy = policies[0];
      expect(firstPolicy.id).toBeDefined();
      expect(firstPolicy.name).toBeDefined();
      expect(firstPolicy.description).toBeDefined();
      expect(firstPolicy.category).toBeDefined();
      expect(firstPolicy.severity).toBeDefined();
      expect(typeof firstPolicy.evaluate).toBe('function');
    });

    it.skip('should validate required policy fields', async () => {
      const filePath = resolve('examples/custom-policies.js');
      const policies = await loadCustomPolicies(filePath);

      for (const policy of policies) {
        expect(policy.id).toBeTruthy();
        expect(policy.name).toBeTruthy();
        expect(policy.description).toBeTruthy();
        expect(['cost', 'security', 'compliance', 'tagging', 'naming']).toContain(
          policy.category
        );
        expect(['error', 'warning', 'info']).toContain(policy.severity);
      }
    });

    it('should throw error for unsupported file format', async () => {
      const filePath = resolve('examples/sample.tf');

      await expect(loadCustomPolicies(filePath)).rejects.toThrow('Unsupported policy file format');
    });

    it('should throw error for non-existent file', async () => {
      const filePath = resolve('examples/non-existent-policies.js');

      await expect(loadCustomPolicies(filePath)).rejects.toThrow();
    });
  });

  describe('mergePolicies', () => {
    it('should merge custom policies with default policies', () => {
      const customPolicy: PolicyRule = {
        id: 'custom-test-policy',
        name: 'Test Policy',
        description: 'A test policy',
        category: 'security',
        severity: 'error',
        enabled: true,
        evaluate: () => null,
      };

      const merged = mergePolicies(defaultPolicies, [customPolicy]);

      expect(merged.length).toBe(defaultPolicies.length + 1);
      expect(merged.find((p) => p.id === 'custom-test-policy')).toBeDefined();
    });

    it('should override default policy with custom one when IDs match', () => {
      const customPolicy: PolicyRule = {
        id: 'required-tags', // Exists in default policies
        name: 'Custom Required Tags',
        description: 'Overridden policy',
        category: 'tagging',
        severity: 'error',
        enabled: true,
        evaluate: () => null,
      };

      const merged = mergePolicies(defaultPolicies, [customPolicy]);

      expect(merged.length).toBe(defaultPolicies.length); // Same count
      const overriddenPolicy = merged.find((p) => p.id === 'required-tags');
      expect(overriddenPolicy?.name).toBe('Custom Required Tags');
    });
  });

  describe('PolicyEngine with Custom Policies', () => {
    it.skip('should evaluate custom policies', async () => {
      const engine = new PolicyEngine();

      // Load custom policies
      await engine.loadCustomPoliciesFromFiles([resolve('examples/custom-policies.js')]);

      // Test resource that should trigger custom policy
      const resource: IacResource = {
        id: 'test-bucket',
        type: 'aws_s3_bucket',
        properties: {
          bucket: 'my-bucket',
          // Missing lifecycle_rule - should trigger custom policy
        },
        location: {
          file: 'test.tf',
          line: 1,
        },
      };

      const violations = engine.validateResources([resource]);

      // Should have violations from both default and custom policies
      expect(violations.length).toBeGreaterThan(0);

      // Check if custom policy violations exist
      const customViolations = violations.filter((v) => v.ruleId.startsWith('custom-'));
      expect(customViolations.length).toBeGreaterThan(0);
    });

    it.skip('should combine default and custom policy violations', async () => {
      const engine = new PolicyEngine();
      await engine.loadCustomPoliciesFromFiles([resolve('examples/custom-policies.js')]);

      const resource: IacResource = {
        id: 'test-instance',
        type: 'aws_instance',
        properties: {
          instance_type: 't2.micro',
          // Missing tags - triggers both default and custom policies
        },
        location: {
          file: 'test.tf',
          line: 1,
        },
      };

      const violations = engine.validateResources([resource]);

      // Should have violations from default policies
      const defaultViolations = violations.filter((v) => !v.ruleId.startsWith('custom-'));
      expect(defaultViolations.length).toBeGreaterThan(0);

      // Should have violations from custom policies
      const customViolations = violations.filter((v) => v.ruleId.startsWith('custom-'));
      expect(customViolations.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Policy Evaluation', () => {
    it.skip('should correctly evaluate custom Team tag policy', async () => {
      const policies = await loadCustomPolicies(resolve('examples/custom-policies.js'));
      const teamTagPolicy = policies.find((p) => p.id === 'custom-team-tag-required');

      expect(teamTagPolicy).toBeDefined();

      // Resource without Team tag
      const resourceWithoutTag: IacResource = {
        id: 'test-resource',
        type: 'aws_instance',
        properties: {
          tags: {
            Environment: 'production',
          },
        },
        location: { file: 'test.tf', line: 1 },
      };

      const violation = teamTagPolicy!.evaluate(resourceWithoutTag);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('Team tag');

      // Resource with Team tag
      const resourceWithTag: IacResource = {
        id: 'test-resource',
        type: 'aws_instance',
        properties: {
          tags: {
            Team: 'platform',
          },
        },
        location: { file: 'test.tf', line: 1 },
      };

      const noViolation = teamTagPolicy!.evaluate(resourceWithTag);
      expect(noViolation).toBeNull();
    });

    it.skip('should correctly evaluate custom S3 lifecycle policy', async () => {
      const policies = await loadCustomPolicies(resolve('examples/custom-policies.js'));
      const lifecyclePolicy = policies.find((p) => p.id === 'custom-prevent-s3-lifecycle');

      expect(lifecyclePolicy).toBeDefined();

      // S3 bucket without lifecycle
      const bucketWithoutLifecycle: IacResource = {
        id: 'test-bucket',
        type: 'aws_s3_bucket',
        properties: {
          bucket: 'my-bucket',
        },
        location: { file: 'test.tf', line: 1 },
      };

      const violation = lifecyclePolicy!.evaluate(bucketWithoutLifecycle);
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe('error');

      // S3 bucket with lifecycle
      const bucketWithLifecycle: IacResource = {
        id: 'test-bucket',
        type: 'aws_s3_bucket',
        properties: {
          bucket: 'my-bucket',
          lifecycle_rule: [{ enabled: true }],
        },
        location: { file: 'test.tf', line: 1 },
      };

      const noViolation = lifecyclePolicy!.evaluate(bucketWithLifecycle);
      expect(noViolation).toBeNull();
    });
  });
});
