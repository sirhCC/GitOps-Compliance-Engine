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

      await expect(parseIacFile(filePath, 'unsupported')).rejects.toThrow('Unsupported IaC format');
    });
  });
});
