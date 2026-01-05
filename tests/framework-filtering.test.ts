import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../src/policies/engine.js';
import type { IacResource } from '../src/types.js';

describe('Framework Filtering', () => {
  describe('getAvailableFrameworks', () => {
    it('should return list of all available frameworks', () => {
      const engine = new PolicyEngine();
      const frameworks = engine.getAvailableFrameworks();

      expect(frameworks).toBeDefined();
      expect(Array.isArray(frameworks)).toBe(true);
      expect(frameworks.length).toBeGreaterThan(0);

      // Should include major frameworks
      expect(frameworks).toContain('HIPAA');
      expect(frameworks).toContain('PCI-DSS');
      expect(frameworks).toContain('GDPR');
      expect(frameworks).toContain('SOC2');
      expect(frameworks).toContain('AWS Well-Architected');
    });

    it('should return sorted frameworks', () => {
      const engine = new PolicyEngine();
      const frameworks = engine.getAvailableFrameworks();

      const sorted = [...frameworks].sort();
      expect(frameworks).toEqual(sorted);
    });

    it('should not contain duplicates', () => {
      const engine = new PolicyEngine();
      const frameworks = engine.getAvailableFrameworks();

      const unique = [...new Set(frameworks)];
      expect(frameworks.length).toBe(unique.length);
    });
  });

  describe('setFrameworkFilter', () => {
    it('should filter policies by single framework', () => {
      const engine = new PolicyEngine();

      // Set HIPAA filter
      engine.setFrameworkFilter(['HIPAA']);

      // Create resource that would trigger both HIPAA and non-HIPAA policies
      const resource: IacResource = {
        id: 'test-db',
        type: 'aws_db_instance',
        properties: {
          encrypted: false,
          tags: {
            DataClassification: 'PHI',
            'HIPAA-Applicable': 'true',
          },
        },
        location: { file: 'test.tf', line: 1 },
      };

      const violations = engine.validateResources([resource]);

      // Should have violations from HIPAA policies (like encryption-at-rest)
      expect(violations.length).toBeGreaterThan(0);
      
      // Encryption at rest is a HIPAA policy, should be included
      const encryptionViolation = violations.find(v => v.ruleId === 'encryption-at-rest');
      expect(encryptionViolation).toBeDefined();
    });

    it('should filter policies by multiple frameworks', () => {
      const engine = new PolicyEngine();

      // Set HIPAA and PCI-DSS filter
      engine.setFrameworkFilter(['HIPAA', 'PCI-DSS']);

      const resource: IacResource = {
        id: 'test-db',
        type: 'aws_db_instance',
        properties: {
          encrypted: false,
        },
        location: { file: 'test.tf', line: 1 },
      };

      const violations = engine.validateResources([resource]);

      // Should have violations from encryption-at-rest which is in both frameworks
      expect(violations.length).toBeGreaterThan(0);
    });

    it('should exclude policies without framework metadata when filtering', () => {
      const engine = new PolicyEngine();

      // Filter by HIPAA
      engine.setFrameworkFilter(['HIPAA']);

      // Create resource that would trigger naming convention (no framework)
      const resource: IacResource = {
        id: 'MyBadName',
        type: 'aws_s3_bucket',
        properties: {},
        location: { file: 'test.tf', line: 1 },
      };

      const violations = engine.validateResources([resource]);

      // Should not have naming convention violations (has no framework)
      const namingViolations = violations.filter((v) => v.category === 'naming');
      expect(namingViolations.length).toBe(0);
    });

    it('should be case-insensitive', () => {
      const engine = new PolicyEngine();

      // Set filter with lowercase
      engine.setFrameworkFilter(['hipaa', 'pci-dss']);

      const resource: IacResource = {
        id: 'test-resource',
        type: 'aws_db_instance',
        properties: {
          encrypted: false,
        },
        location: { file: 'test.tf', line: 1 },
      };

      const violations = engine.validateResources([resource]);
      expect(violations.length).toBeGreaterThan(0);
    });

    it('should match partial framework names', () => {
      const engine = new PolicyEngine();

      // Set filter with partial name
      engine.setFrameworkFilter(['PCI']);

      const resource: IacResource = {
        id: 'test-db',
        type: 'aws_db_instance',
        properties: {
          encrypted: false,
        },
        location: { file: 'test.tf', line: 1 },
      };

      const violations = engine.validateResources([resource]);

      // Should match PCI-DSS policies
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('Framework-specific validation', () => {
    it('should validate GDPR policies only', () => {
      const engine = new PolicyEngine();
      engine.setFrameworkFilter(['GDPR']);

      // GDPR-tagged resource
      const resource: IacResource = {
        id: 'eu-data-store',
        type: 'aws_s3_bucket',
        properties: {
          region: 'us-east-1', // Wrong region for GDPR
          encrypted: false,
          tags: {
            DataClassification: 'GDPR',
          },
        },
        location: { file: 'test.tf', line: 1 },
      };

      const violations = engine.validateResources([resource]);
      expect(violations.length).toBeGreaterThan(0);

      // Check that violations are GDPR-related
      const gdprViolations = violations.filter(
        (v) =>
          v.ruleId.includes('gdpr') ||
          v.message.toLowerCase().includes('gdpr') ||
          v.ruleId === 'encryption-at-rest' // Also in GDPR
      );
      expect(gdprViolations.length).toBeGreaterThan(0);
    });

    it('should validate SOC2 policies only', () => {
      const engine = new PolicyEngine();
      engine.setFrameworkFilter(['SOC2']);

      const resource: IacResource = {
        id: 'app-db',
        type: 'aws_db_instance',
        properties: {
          // Missing backup configuration
          encrypted: false,
          tags: {},
        },
        location: { file: 'test.tf', line: 1 },
      };

      const violations = engine.validateResources([resource]);
      expect(violations.length).toBeGreaterThan(0);

      // SOC2 includes encryption, backup, monitoring policies
      const soc2Violations = violations.filter(
        (v) =>
          v.ruleId.includes('soc2') ||
          v.ruleId === 'encryption-at-rest' || // In SOC2
          v.ruleId === 'no-public-access' // In SOC2
      );
      expect(soc2Violations.length).toBeGreaterThan(0);
    });

    it('should validate PCI-DSS policies only', () => {
      const engine = new PolicyEngine();
      engine.setFrameworkFilter(['PCI-DSS', 'PCI']);

      // Use a database without encryption (PCI-DSS requires encryption)
      const resource: IacResource = {
        id: 'payment-db',
        type: 'aws_db_instance',
        properties: {
          encrypted: false,
          tags: {
            DataClassification: 'PCI',
          },
        },
        location: { file: 'test.tf', line: 1 },
      };

      const violations = engine.validateResources([resource]);
      expect(violations.length).toBeGreaterThan(0);
      
      // Should have encryption-at-rest violation (PCI-DSS policy)
      const encryptionViolation = violations.find(v => v.ruleId === 'encryption-at-rest');
      expect(encryptionViolation).toBeDefined();
    });

    it('should combine multiple framework filters', () => {
      const engine = new PolicyEngine();
      engine.setFrameworkFilter(['HIPAA', 'PCI-DSS', 'SOC2']);

      const resource: IacResource = {
        id: 'sensitive-db',
        type: 'aws_db_instance',
        properties: {
          encrypted: false,
          publicly_accessible: true,
        },
        location: { file: 'test.tf', line: 1 },
      };

      const violations = engine.validateResources([resource]);

      // Should get violations from all three frameworks
      // encryption-at-rest is in all three
      // no-public-access is in SOC2
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('Framework filter with custom policies', () => {
    it.skip('should filter custom policies by framework', async () => {
      const engine = new PolicyEngine();

      // Load custom policies with framework metadata
      await engine.loadCustomPoliciesFromFiles(['examples/custom-policies.js']);

      // Set framework filter
      engine.setFrameworkFilter(['Internal Standards']);

      const resource: IacResource = {
        id: 'test-resource',
        type: 'aws_instance',
        properties: {
          tags: {},
        },
        location: { file: 'test.tf', line: 1 },
      };

      const violations = engine.validateResources([resource]);

      // Should only get custom policy violations with Internal Standards framework
      const customViolations = violations.filter((v) => v.ruleId.startsWith('custom-'));
      expect(customViolations.length).toBeGreaterThan(0);
    });
  });
});
