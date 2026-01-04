import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

describe('Integration Tests', () => {
  const testDir = join(process.cwd(), 'tests', 'fixtures');
  const cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');

  beforeAll(async () => {
    // Ensure test fixtures directory exists
    await mkdir(testDir, { recursive: true });

    // Create test Terraform file
    await writeFile(
      join(testDir, 'test.tf'),
      `
resource "aws_instance" "test-server" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"
  
  tags = {
    Environment = "test"
    Owner       = "devops"
    Project     = "testing"
  }
}

resource "aws_s3_bucket" "test-bucket" {
  bucket = "test-bucket"
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
  
  tags = {
    Environment = "test"
    Owner       = "devops"
    Project     = "testing"
  }
}
`
    );

    // Create test config file
    await writeFile(
      join(testDir, 'test-config.json'),
      JSON.stringify({
        policies: {
          disabled: ['naming-convention'],
        },
        severity: {
          failOn: 'error',
        },
      })
    );
  });

  describe('validate command', () => {
    it('should validate Terraform files successfully', async () => {
      const { stdout, stderr } = await execAsync(`node "${cliPath}" validate "${testDir}"`);

      expect(stderr).toBe('');
      expect(stdout).toContain('Validation Summary');
      expect(stdout).toContain('Files scanned');
    });

    it('should respect config file settings', async () => {
      const configPath = join(testDir, 'test-config.json');
      const { stdout } = await execAsync(
        `node "${cliPath}" validate "${testDir}" --config "${configPath}"`
      );

      // naming-convention is disabled in config, so it shouldn't appear
      expect(stdout).not.toContain('naming-convention');
    });

    it('should fail with errors when violations exist', async () => {
      // Create a file with security violations
      await writeFile(
        join(testDir, 'bad.tf'),
        `
resource "aws_db_instance" "bad_db" {
  publicly_accessible = true
  encrypted = false
}
`
      );

      try {
        await execAsync(`node "${cliPath}" validate "${testDir}" --severity error`);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: unknown) {
        const err = error as { code: number; stdout: string };
        expect(err.code).toBe(1);
        expect(err.stdout).toContain('FAILED');
      }

      // Clean up
      await rm(join(testDir, 'bad.tf'));
    });

    it('should handle fail-fast option', async () => {
      const { stdout } = await execAsync(`node "${cliPath}" validate "${testDir}" --fail-fast`);

      expect(stdout).toContain('Validation Summary');
    });
  });

  describe('check command', () => {
    it('should run quick validation', async () => {
      const { stdout } = await execAsync(`node "${cliPath}" check "${testDir}"`);

      expect(stdout).toContain('Validation Summary');
      expect(stdout).toContain('Resources checked');
    });
  });

  describe('report command', () => {
    it('should generate JSON report', async () => {
      const outputPath = join(testDir, 'report.json');
      const { stdout } = await execAsync(
        `node "${cliPath}" report "${testDir}" --format json --output "${outputPath}"`
      );

      expect(stdout).toContain('Report saved');

      // Verify file was created
      const { stdout: catOutput } = await execAsync(`type "${outputPath}"`);
      const report = JSON.parse(catOutput);
      expect(report).toHaveProperty('totalFiles');
      expect(report).toHaveProperty('totalResources');

      // Clean up
      await rm(outputPath);
    });

    it('should generate Markdown report', async () => {
      const outputPath = join(testDir, 'report.md');
      const { stdout } = await execAsync(
        `node "${cliPath}" report "${testDir}" --format markdown --output "${outputPath}"`
      );

      expect(stdout).toContain('Report saved');

      // Verify file was created
      const { stdout: catOutput } = await execAsync(`type "${outputPath}"`);
      expect(catOutput).toContain('# GitOps Compliance Report');

      // Clean up
      await rm(outputPath);
    });

    it('should generate HTML report', async () => {
      const outputPath = join(testDir, 'report.html');
      const { stdout } = await execAsync(
        `node "${cliPath}" report "${testDir}" --format html --output "${outputPath}"`
      );

      expect(stdout).toContain('Report saved');

      // Verify file was created
      const { stdout: catOutput } = await execAsync(`type "${outputPath}"`);
      expect(catOutput).toContain('<!DOCTYPE html>');
      expect(catOutput).toContain('GitOps Compliance Report');

      // Clean up
      await rm(outputPath);
    });
  });

  describe('format auto-detection', () => {
    it('should detect Terraform format from .tf extension', async () => {
      const { stdout } = await execAsync(`node "${cliPath}" validate "${testDir}"`);

      expect(stdout).toContain('Validation Summary');
    });

    it('should handle multiple file formats', async () => {
      // Create a CloudFormation template
      await writeFile(
        join(testDir, 'cloudformation.yaml'),
        `
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  TestBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: test-cf-bucket
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      Tags:
        - Key: Environment
          Value: test
        - Key: Owner
          Value: devops
        - Key: Project
          Value: testing
`
      );

      const { stdout } = await execAsync(
        `node "${cliPath}" validate "${testDir}" --format cloudformation`
      );

      expect(stdout).toContain('Validation Summary');

      // Clean up
      await rm(join(testDir, 'cloudformation.yaml'));
    });
  });

  afterAll(async () => {
    // Clean up test fixtures directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }
  });
});
