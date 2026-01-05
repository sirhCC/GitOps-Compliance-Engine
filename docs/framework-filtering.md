# Framework Filtering

Filter policy validation by specific compliance frameworks like HIPAA, PCI-DSS, GDPR, and more.

## Overview

Framework filtering allows you to run only policies that belong to specific compliance frameworks. This is useful when:

- Your organization needs to comply with specific regulatory frameworks
- You want to generate compliance reports for specific standards
- Different teams need different compliance checks
- You're implementing compliance in phases (e.g., start with HIPAA, add PCI-DSS later)

## Available Frameworks

Use `--list-frameworks` to see all available frameworks:

```bash
gce validate . --list-frameworks
```

Built-in frameworks include:

| Framework | Description |
|-----------|-------------|
| **HIPAA** | Health Insurance Portability and Accountability Act |
| **PCI-DSS** | Payment Card Industry Data Security Standard |
| **GDPR** | General Data Protection Regulation |
| **SOC2** | Service Organization Control 2 |
| **ISO 27001** | Information Security Management Standard |
| **NIST 800-53** | NIST Security and Privacy Controls |
| **FedRAMP** | Federal Risk and Authorization Management Program |
| **CIS Benchmarks** | Center for Internet Security Benchmarks |
| **CIS AWS Foundations** | CIS Amazon Web Services Foundations Benchmark |
| **OWASP Top 10** | Open Web Application Security Project Top 10 |
| **AWS Well-Architected** | AWS Well-Architected Framework |
| **AWS Well-Architected Cost Optimization** | Cost Optimization Pillar |
| **Cloud Governance** | General cloud governance best practices |
| **FinOps** | Financial Operations and cloud cost management |

## Usage

### Filter by Single Framework

Run only HIPAA-related policies:

```bash
gce validate . --framework HIPAA
```

### Filter by Multiple Frameworks

Run policies from multiple frameworks:

```bash
gce validate . --framework HIPAA,PCI-DSS,SOC2
```

### Combine with Other Options

Framework filtering works with all other validation options:

```bash
# HIPAA validation with custom policies and JSON output
gce validate . --framework HIPAA \
  --policies ./custom-hipaa-policies.js \
  --format json \
  --severity error

# PCI-DSS and SOC2 validation with verbose output
gce validate examples/ \
  --framework PCI-DSS,SOC2 \
  --verbose \
  --show-metadata
```

### Configuration File

You can specify frameworks in your configuration file:

```json
{
  "frameworks": ["HIPAA", "PCI-DSS"],
  "policies": {
    "enabled": ["encryption-at-rest", "no-public-access"]
  }
}
```

Then run:

```bash
gce validate . --config gce.config.json
```

## How Framework Filtering Works

### Policy Metadata

Each policy includes framework metadata:

```javascript
{
  id: 'encryption-at-rest',
  name: 'Encryption at Rest',
  category: 'security',
  severity: 'error',
  frameworks: ['HIPAA', 'PCI-DSS', 'GDPR', 'SOC2', 'ISO 27001'],
  metadata: {
    frameworks: ['HIPAA', 'PCI-DSS', 'GDPR', 'SOC2', 'ISO 27001'],
    compliance: {
      'HIPAA': '§164.312(a)(2)(iv)',
      'PCI-DSS': 'Requirement 3.4',
      'GDPR': 'Article 32',
      'SOC2': 'CC6.1'
    }
  },
  evaluate: (resource) => { /* ... */ }
}
```

### Filtering Logic

When you specify `--framework HIPAA,PCI-DSS`:

1. **Inclusion**: Only policies with `frameworks` containing HIPAA or PCI-DSS are executed
2. **Exclusion**: Policies without any framework metadata are excluded
3. **Case-Insensitive**: Framework names are matched case-insensitively
4. **Partial Matching**: "PCI" matches "PCI-DSS"

### Examples

```bash
# Only encryption and access control (HIPAA policies)
gce validate . --framework HIPAA
# Output: 2 violations from HIPAA policies

# Security and privacy policies (GDPR)
gce validate . --framework GDPR
# Output: 4 violations from GDPR policies

# Payment security (PCI-DSS)
gce validate . --framework PCI-DSS
# Output: 3 violations from PCI-DSS policies

# Comprehensive compliance (multiple frameworks)
gce validate . --framework HIPAA,PCI-DSS,SOC2,ISO-27001
# Output: 12 violations from all four frameworks
```

## Framework-Specific Policies

### HIPAA (Health Insurance Portability and Accountability Act)

Focuses on protecting health information (PHI):

- **Encryption at Rest**: All data stores must be encrypted
- **Encryption in Transit**: Data transmission must use TLS/SSL
- **Access Controls**: Implement least privilege access
- **Audit Logging**: Enable comprehensive audit trails
- **Backup and Recovery**: Regular backups and disaster recovery plans

**Example Resource Tagging:**

```hcl
resource "aws_db_instance" "patient_db" {
  identifier = "patient-database"
  engine     = "postgres"
  encrypted  = true
  
  tags = {
    DataClassification = "PHI"
    HIPAA-Applicable   = "true"
    ComplianceFramework = "HIPAA"
  }
}
```

### PCI-DSS (Payment Card Industry Data Security Standard)

Protects cardholder data:

- **Network Security**: Firewalls and network segmentation
- **Data Encryption**: Protect stored and transmitted cardholder data
- **Access Control**: Restrict access to cardholder data
- **Monitoring**: Track and monitor network access
- **Regular Testing**: Security testing and updates

**Example:**

```hcl
resource "aws_lb" "payment_api" {
  name               = "payment-gateway"
  load_balancer_type = "application"
  
  # PCI-DSS requires HTTPS
  listener {
    protocol = "HTTPS"
    port     = 443
    ssl_policy = "ELBSecurityPolicy-TLS-1-2-2017-01"
  }
  
  tags = {
    DataClassification = "PCI"
    PCIScope           = "in-scope"
  }
}
```

### GDPR (General Data Protection Regulation)

European data protection and privacy:

- **Data Encryption**: Protect personal data
- **Data Minimization**: Collect only necessary data
- **Data Residency**: Store data in appropriate regions
- **Access Controls**: Control who can access personal data
- **Audit Trails**: Log data access and modifications

**Example:**

```hcl
resource "aws_s3_bucket" "user_data" {
  bucket = "eu-user-data"
  region = "eu-west-1"  # EU region for GDPR
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
  
  tags = {
    DataClassification = "GDPR"
    DataSubject        = "EU-Users"
    RetentionPolicy    = "7-years"
  }
}
```

### SOC2 (Service Organization Control 2)

Trust services criteria (security, availability, confidentiality):

- **Security**: Protect against unauthorized access
- **Availability**: System availability commitments
- **Processing Integrity**: System processing is complete and accurate
- **Confidentiality**: Protect confidential information
- **Privacy**: Personal information handling

**Example:**

```hcl
resource "aws_cloudwatch_log_group" "audit_logs" {
  name              = "/aws/audit/application"
  retention_in_days = 365  # SOC2 requires 1-year retention
  
  tags = {
    ComplianceFramework = "SOC2"
    AuditCategory       = "Security"
  }
}
```

## Custom Policies with Frameworks

Add framework metadata to your custom policies:

```javascript
// custom-compliance-policies.js
export const policies = [
  {
    id: 'custom-phi-encryption',
    name: 'PHI Data Encryption',
    category: 'compliance',
    severity: 'error',
    frameworks: ['HIPAA', 'HITRUST'],
    metadata: {
      frameworks: ['HIPAA', 'HITRUST'],
      compliance: {
        'HIPAA': '§164.312(a)(2)(iv) - Encryption and Decryption',
        'HITRUST': '01.m - Encryption of PHI'
      },
      rationale: 'All PHI must be encrypted per HIPAA Security Rule',
      references: [
        'https://www.hhs.gov/hipaa/for-professionals/security/'
      ]
    },
    evaluate: (resource) => {
      if (resource.properties?.tags?.DataClassification === 'PHI') {
        if (!resource.properties.encrypted) {
          return {
            compliant: false,
            message: 'PHI data must be encrypted per HIPAA requirements'
          };
        }
      }
      return { compliant: true };
    }
  },
  
  {
    id: 'custom-pci-network-segmentation',
    name: 'PCI Network Segmentation',
    category: 'security',
    severity: 'error',
    frameworks: ['PCI-DSS'],
    metadata: {
      frameworks: ['PCI-DSS'],
      compliance: {
        'PCI-DSS': 'Requirement 1.3 - Network Segmentation'
      }
    },
    evaluate: (resource) => {
      if (resource.type === 'aws_security_group') {
        if (resource.properties?.tags?.PCIScope === 'in-scope') {
          // Check for proper network segmentation
          const hasPublicAccess = resource.properties.ingress?.some(
            rule => rule.cidr_blocks?.includes('0.0.0.0/0')
          );
          
          if (hasPublicAccess) {
            return {
              compliant: false,
              message: 'PCI in-scope resources must not allow public access'
            };
          }
        }
      }
      return { compliant: true };
    }
  }
];
```

Use with framework filtering:

```bash
# Run only HIPAA policies (including custom ones)
gce validate . \
  --policies ./custom-compliance-policies.js \
  --framework HIPAA

# Run PCI-DSS policies
gce validate . \
  --policies ./custom-compliance-policies.js \
  --framework PCI-DSS
```

## CI/CD Integration

### GitHub Actions - HIPAA Compliance

```yaml
name: HIPAA Compliance Check

on: [push, pull_request]

jobs:
  hipaa-compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install GCE
        run: npm install -g gitops-compliance-engine
      
      - name: Run HIPAA Validation
        run: |
          gce validate infrastructure/ \
            --framework HIPAA \
            --format json \
            --output hipaa-report.json
      
      - name: Upload HIPAA Report
        uses: actions/upload-artifact@v3
        with:
          name: hipaa-compliance-report
          path: hipaa-report.json
```

### GitLab CI - Multi-Framework Compliance

```yaml
compliance-check:
  stage: validate
  image: node:20
  script:
    - npm install -g gitops-compliance-engine
    
    # HIPAA Compliance
    - gce validate . --framework HIPAA --format json --output hipaa.json
    
    # PCI-DSS Compliance
    - gce validate . --framework PCI-DSS --format json --output pci.json
    
    # SOC2 Compliance
    - gce validate . --framework SOC2 --format json --output soc2.json
  
  artifacts:
    reports:
      compliance: ['hipaa.json', 'pci.json', 'soc2.json']
    paths:
      - '*.json'
```

### Jenkins - Compliance Gates

```groovy
pipeline {
    agent any
    
    stages {
        stage('Compliance Validation') {
            parallel {
                stage('HIPAA') {
                    steps {
                        sh '''
                            gce validate . --framework HIPAA \
                              --severity error \
                              --fail-fast
                        '''
                    }
                }
                
                stage('PCI-DSS') {
                    steps {
                        sh '''
                            gce validate . --framework PCI-DSS \
                              --severity error \
                              --fail-fast
                        '''
                    }
                }
                
                stage('SOC2') {
                    steps {
                        sh '''
                            gce validate . --framework SOC2 \
                              --severity warning
                        '''
                    }
                }
            }
        }
    }
}
```

## Best Practices

### 1. Start with One Framework

Begin with your most critical compliance requirement:

```bash
# Start with HIPAA if handling health data
gce validate . --framework HIPAA --fail-fast
```

### 2. Progressive Compliance

Add frameworks incrementally:

```bash
# Week 1: HIPAA only
gce validate . --framework HIPAA

# Week 2: Add PCI-DSS
gce validate . --framework HIPAA,PCI-DSS

# Week 3: Add SOC2
gce validate . --framework HIPAA,PCI-DSS,SOC2
```

### 3. Tag Resources for Framework Scope

Use tags to indicate which resources are in-scope for frameworks:

```hcl
resource "aws_db_instance" "app_db" {
  # ... configuration ...
  
  tags = {
    DataClassification  = "PHI"
    HIPAA-Applicable    = "true"
    PCI-Scope          = "out-of-scope"
    ComplianceFrameworks = "HIPAA,SOC2"
  }
}
```

### 4. Create Framework-Specific Validation Scripts

```bash
#!/bin/bash
# validate-hipaa.sh

echo "Running HIPAA Compliance Validation..."
gce validate . \
  --framework HIPAA \
  --policies ./policies/hipaa-custom.js \
  --format json \
  --output reports/hipaa-$(date +%Y%m%d).json \
  --severity error

if [ $? -eq 0 ]; then
  echo "✓ HIPAA Compliance: PASSED"
else
  echo "✗ HIPAA Compliance: FAILED"
  exit 1
fi
```

### 5. Combine with Policy Enable/Disable

```json
{
  "frameworks": ["HIPAA"],
  "policies": {
    "enabled": [
      "encryption-at-rest",
      "encryption-in-transit",
      "no-public-access",
      "require-backups"
    ]
  }
}
```

## Troubleshooting

### No Violations Found

If framework filtering returns no violations:

1. **Check framework spelling**: Use `--list-frameworks` to see exact names
2. **Verify policy metadata**: Policies must have framework metadata
3. **Check resource scope**: Ensure resources match policy criteria

```bash
# List frameworks to verify spelling
gce validate . --list-frameworks

# Run without framework filter to see all violations
gce validate . --verbose
```

### Too Many Violations

If you get overwhelming results:

1. **Start with one framework**: Focus on most critical compliance
2. **Use fail-fast**: Stop on first violation for faster feedback
3. **Filter by severity**: Show only errors initially

```bash
# Focus on errors only
gce validate . --framework HIPAA --severity error --fail-fast

# Then add warnings
gce validate . --framework HIPAA --severity warning
```

### Framework Not Working with Custom Policies

Ensure your custom policies include framework metadata:

```javascript
// ✗ WRONG - No framework metadata
{
  id: 'my-policy',
  evaluate: (resource) => { /* ... */ }
}

// ✓ CORRECT - Includes framework metadata
{
  id: 'my-policy',
  frameworks: ['HIPAA', 'Custom'],
  metadata: {
    frameworks: ['HIPAA', 'Custom']
  },
  evaluate: (resource) => { /* ... */ }
}
```

## Advanced Use Cases

### Framework Coverage Report

Generate reports showing which frameworks are covered:

```bash
# Get list of frameworks
gce validate . --list-frameworks > frameworks.txt

# Run validation for each framework
for framework in HIPAA PCI-DSS GDPR SOC2; do
  echo "Validating $framework..."
  gce validate . \
    --framework $framework \
    --format json \
    --output reports/$framework.json
done
```

### Conditional Framework Validation

Validate different frameworks based on branch or environment:

```bash
#!/bin/bash
# validate-by-environment.sh

ENVIRONMENT=$1

case $ENVIRONMENT in
  production)
    FRAMEWORKS="HIPAA,PCI-DSS,SOC2,ISO-27001"
    ;;
  staging)
    FRAMEWORKS="HIPAA,PCI-DSS"
    ;;
  development)
    FRAMEWORKS="HIPAA"
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

echo "Validating $ENVIRONMENT with frameworks: $FRAMEWORKS"
gce validate . --framework $FRAMEWORKS
```

## Related Documentation

- [Custom Policies Guide](./custom-policies.md) - Creating custom compliance policies
- [Configuration Reference](./configuration.md) - Full configuration options
- [CI/CD Integration](./ci-cd-integration.md) - Setting up compliance gates

## Compliance Mapping

For detailed compliance control mappings, see:

- **HIPAA**: https://www.hhs.gov/hipaa/for-professionals/security/
- **PCI-DSS**: https://www.pcisecuritystandards.org/
- **GDPR**: https://gdpr.eu/
- **SOC2**: https://www.aicpa.org/soc2
- **NIST 800-53**: https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
- **CIS Benchmarks**: https://www.cisecurity.org/cis-benchmarks/
