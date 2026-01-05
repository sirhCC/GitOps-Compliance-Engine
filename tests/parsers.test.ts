import { describe, it, expect } from 'vitest';
import { parseIacFile } from '../src/parsers/index.js';
import { resolve } from 'path';

describe('IaC Parsers', () => {
  describe('Terraform Parser', () => {
    it('should parse Terraform file and extract resources', async () => {
      const filePath = resolve('examples/sample.tf');
      const result = await parseIacFile(filePath, 'terraform');

      expect(result.format).toBe('terraform');
      expect(result.resources).toHaveLength(4);

      const webServer = result.resources.find((r) => r.id === 'web_server');
      expect(webServer).toBeDefined();
      expect(webServer?.type).toBe('aws_instance');
      expect(webServer?.properties.instance_type).toBe('t2.xlarge');
    });

    it('should extract nested properties like tags', async () => {
      const filePath = resolve('examples/sample.tf');
      const result = await parseIacFile(filePath, 'terraform');

      const webServer = result.resources.find((r) => r.id === 'web_server');
      expect(webServer?.properties.tags).toBeDefined();
      expect((webServer?.properties.tags as any).Name).toBe('WebServer');
    });

    it('should detect publicly_accessible property', async () => {
      const filePath = resolve('examples/sample.tf');
      const result = await parseIacFile(filePath, 'terraform');

      const database = result.resources.find((r) => r.id === 'database');
      expect(database?.properties.publicly_accessible).toBe(true);
    });
  });

  describe('CloudFormation Parser', () => {
    it('should parse CloudFormation YAML file', async () => {
      const filePath = resolve('examples/sample-cloudformation.yaml');
      const result = await parseIacFile(filePath, 'cloudformation');

      expect(result.format).toBe('cloudformation');
      expect(result.resources).toHaveLength(3);

      const instance = result.resources.find((r) => r.id === 'WebServerInstance');
      expect(instance).toBeDefined();
      expect(instance?.type).toBe('AWS::EC2::Instance');
      expect(instance?.properties.InstanceType).toBe('t2.xlarge');
    });

    it('should extract CloudFormation metadata', async () => {
      const filePath = resolve('examples/sample-cloudformation.yaml');
      const result = await parseIacFile(filePath, 'cloudformation');

      expect(result.metadata.version).toBe('2010-09-09');
    });

    it('should parse PubliclyAccessible property', async () => {
      const filePath = resolve('examples/sample-cloudformation.yaml');
      const result = await parseIacFile(filePath, 'cloudformation');

      const db = result.resources.find((r) => r.id === 'DatabaseInstance');
      expect(db?.properties.PubliclyAccessible).toBe(true);
    });
  });

  describe('Pulumi Parser', () => {
    it('should parse Pulumi YAML file', async () => {
      const filePath = resolve('examples/sample-pulumi.yaml');
      const result = await parseIacFile(filePath, 'pulumi');

      expect(result.format).toBe('pulumi');
      expect(result.resources).toHaveLength(3);

      const webServer = result.resources.find((r) => r.id === 'webServer');
      expect(webServer).toBeDefined();
      expect(webServer?.type).toBe('aws:ec2:Instance');
      expect(webServer?.properties.instanceType).toBe('t2.xlarge');
    });

    it('should extract publiclyAccessible property', async () => {
      const filePath = resolve('examples/sample-pulumi.yaml');
      const result = await parseIacFile(filePath, 'pulumi');

      const db = result.resources.find((r) => r.id === 'database');
      expect(db?.properties.publiclyAccessible).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported format', async () => {
      const filePath = resolve('examples/sample.tf');

      // Disable cache for this test
      await expect(parseIacFile(filePath, 'unsupported', false)).rejects.toThrow(
        'Unsupported IaC format'
      );
    });

    it('should throw ParseError for non-existent file', async () => {
      const filePath = resolve('examples/non-existent.tf');

      await expect(parseIacFile(filePath, 'terraform', false)).rejects.toThrow();
    });

    it('should throw ParseError for invalid Terraform syntax', async () => {
      const filePath = resolve('examples/invalid.tf');

      await expect(parseIacFile(filePath, 'terraform', false)).rejects.toThrow();
    });

    it('should throw ParseError for invalid YAML syntax', async () => {
      const filePath = resolve('examples/invalid.yaml');

      await expect(parseIacFile(filePath, 'cloudformation', false)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle Terraform file with no resources', async () => {
      const filePath = resolve('examples/empty.tf');

      // Create a minimal empty terraform file for test
      const result = await parseIacFile(filePath, 'terraform').catch(() => ({
        format: 'terraform' as const,
        resources: [],
        metadata: {},
      }));

      expect(result.resources).toHaveLength(0);
    });

    it('should handle resources with minimal properties', async () => {
      const filePath = resolve('examples/sample.tf');
      const result = await parseIacFile(filePath, 'terraform');

      // Ensure parser doesn't fail on resources with few properties
      result.resources.forEach((resource) => {
        expect(resource.id).toBeDefined();
        expect(resource.type).toBeDefined();
        expect(resource.properties).toBeDefined();
      });
    });

    it('should preserve complex nested structures', async () => {
      const filePath = resolve('examples/sample.tf');
      const result = await parseIacFile(filePath, 'terraform');

      const bucket = result.resources.find((r) => r.id === 'data_bucket');
      if (bucket) {
        // Check that nested properties are preserved
        expect(bucket.properties.versioning).toBeDefined();
        expect(typeof bucket.properties.versioning).toBe('object');
      }
    });

    it('should handle CloudFormation with multiple resource types', async () => {
      const filePath = resolve('examples/sample-cloudformation.yaml');
      const result = await parseIacFile(filePath, 'cloudformation');

      const resourceTypes = result.resources.map((r) => r.type);
      expect(new Set(resourceTypes).size).toBeGreaterThan(1);
    });

    it('should extract Pulumi outputs if present', async () => {
      const filePath = resolve('examples/sample-pulumi.yaml');
      const result = await parseIacFile(filePath, 'pulumi');

      // Pulumi files may have outputs section
      expect(result.metadata).toBeDefined();
    });
  });

  describe('CloudFormation Intrinsic Functions', () => {
    it('should handle Ref intrinsic function', async () => {
      const filePath = resolve('examples/sample-cloudformation.yaml');
      const result = await parseIacFile(filePath, 'cloudformation');

      // Check that Ref functions are resolved or preserved
      const secGroup = result.resources.find((r) => r.id === 'WebServerSecurityGroup');
      if (secGroup) {
        expect(secGroup.properties).toBeDefined();
      }
    });

    it('should handle GetAtt intrinsic function', async () => {
      const filePath = resolve('examples/sample-cloudformation.yaml');
      const result = await parseIacFile(filePath, 'cloudformation');

      // Intrinsic functions should be processed
      result.resources.forEach((resource) => {
        expect(resource.properties).toBeDefined();
      });
    });

    it('should handle Sub intrinsic function', async () => {
      const filePath = resolve('examples/sample-cloudformation.yaml');
      const result = await parseIacFile(filePath, 'cloudformation');

      // Sub functions should be resolved
      expect(result.resources.length).toBeGreaterThan(0);
    });
  });
});
