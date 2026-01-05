# GitOps Compliance Engine

Enterprise-grade CLI tool that validates Infrastructure-as-Code (Terraform, Pulumi, CloudFormation) against organizational policies before deployment.

[![CI](https://github.com/sirhCC/GitOps-Compliance-Engine/actions/workflows/ci.yml/badge.svg)](https://github.com/sirhCC/GitOps-Compliance-Engine/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-59%20passing-success)]()
[![Policies](https://img.shields.io/badge/policies-38%20total-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)]()
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run validation on current directory
node dist/cli/index.js validate .

# Show policy metadata for violations
node dist/cli/index.js validate . --show-metadata

# Or link globally and use the CLI alias
npm link
gce validate ./infrastructure --verbose
```

## Features

- ✅ **Multi-IaC Support**: Terraform, Pulumi, CloudFormation with auto-detection
- ✅ **38 Built-in Policies**: Across Cost, Security, Compliance, Tagging, and Naming
- ✅ **Custom Policy API**: Write and load your own policies (JS/TS/JSON)
- ✅ **Framework Filtering**: Run only HIPAA, PCI-DSS, GDPR, SOC2, or other framework policies
- ✅ **Policy Metadata**: Rationale, references, and frameworks for each policy
- ✅ **CloudFormation Intrinsics**: Full support for Ref, GetAtt, Sub, Join, and more
- ✅ **Compliance Frameworks**: GDPR, HIPAA, PCI-DSS, SOC2 policies built-in
- ✅ **Severity Levels**: Error, Warning, Info with configurable thresholds
- ✅ **Flexible Configuration**: Enable/disable policies, exclude patterns
- ✅ **Rich Output**: Color-coded CLI output with remediation suggestions
- ✅ **Multiple Report Formats**: JSON, YAML, Markdown, HTML
- ✅ **CI/CD Ready**: Exit codes for pipeline integration with examples
- ✅ **Exclude Patterns**: Skip specific files or resources
- ✅ **File Caching**: Improved performance for repeated validations
- ✅ **Comprehensive Tests**: 65+ tests with integration coverage

## Commands

### Validate
```bash
gce validate [path] [options]

Options:
  -c, --config <file>      Path to config file
  -f, --format <format>    IaC format (terraform|pulumi|cloudformation)
  -s, --severity <level>   Fail on severity level (error|warning|info)
  --fail-fast              Stop on first violation
  --no-summary             Skip summary output
  -v, --verbose            Show detailed output with policy metadata
  --show-metadata          Show policy rationale and references for violations
  -p, --policies <files...> Load custom policy files (.js, .ts, or .json)
  --framework <frameworks...> Filter by compliance frameworks (HIPAA, PCI-DSS, GDPR, SOC2)
  --list-frameworks        List all available compliance frameworks
```

### Custom Policies
Write your own policies to extend the built-in set:

```bash
# Create custom-policies.js
cat > custom-policies.js << 'EOF'
export const policies = [{
  id: 'custom-team-tag',
  name: 'Team Tag Required',
  description: 'All resources must have a Team tag',
  category: 'tagging',
  severity: 'error',
  enabled: true,
  evaluate: (resource) => {
    if (!resource.properties.tags?.Team) {
      return {
        ruleId: 'custom-team-tag',
        ruleName: 'Team Tag Required',
        severity: 'error',
        category: 'tagging',
        message: 'Missing Team tag',
        resource: { id: resource.id, type: resource.type, location: resource.location },
        remediation: 'Add Team tag with your team name'
      };
    }
    return null;
  }
}];
EOF

# Use custom policies
gce validate . --policies custom-policies.js

# Load multiple policy files
gce validate . --policies team-policies.js security-policies.js
```

See [Custom Policy Guide](docs/custom-policies.md) for complete documentation.

### Framework Filtering
Run only policies from specific compliance frameworks:

```bash
# List available frameworks
gce validate . --list-frameworks

# Validate HIPAA compliance only
gce validate . --framework HIPAA

# Multiple frameworks
gce validate . --framework HIPAA,PCI-DSS,SOC2

# Combine with custom policies
gce validate . --policies ./custom-hipaa.js --framework HIPAA
```

Built-in frameworks include: HIPAA, PCI-DSS, GDPR, SOC2, ISO 27001, NIST 800-53, FedRAMP, CIS Benchmarks, OWASP Top 10, AWS Well-Architected, and more. See [Framework Filtering Guide](docs/framework-filtering.md) for details.

### Check
Quick validation with defaults:
```bash
gce check [path] [options]
```

### Report
Generate compliance reports:
```bash
gce report [path] [options]

Options:
  -o, --output <file>      Output file path
  --format <format>        Report format (json|yaml|markdown|html)
```

## Default Policies

### Tagging (6 policies)
- **required-tags** (warning): Ensures resources have Environment, Owner, Project tags
- **cost-center-tag** (warning): Cost center tags for billing allocation
- **expiration-tag** (info): Expiration dates for temporary resources
- **backup-tag** (warning): Backup policy tags for data resources

### Security (6 policies)
- **no-public-access** (error): Prevents publicly accessible resources
- **encryption-at-rest** (error): Requires encryption for data storage
- **encryption-in-transit** (error): Requires HTTPS/TLS for data transmission
- **no-hardcoded-secrets** (error): Detects hardcoded secrets in configuration
- **security-group-unrestricted** (error): Prevents overly permissive security groups
- **iam-wildcard-actions** (warning): Warns about wildcard IAM permissions

### Naming (1 policy)
- **naming-convention** (info): Enforces lowercase-with-hyphens pattern

### Cost (6 policies)
- **cost-large-instance** (warning): Warns about expensive instance types
- **cost-unattached-volumes** (warning): Detects unused EBS volumes
- **cost-gp2-to-gp3** (info): Suggests cheaper GP3 volumes
- **cost-oversized-volume** (warning): Warns about large storage allocations
- **cost-multi-az** (info): Alerts about Multi-AZ cost implications
- **cost-nat-gateway** (info): NAT Gateway cost awareness

### Compliance (6 policies)
- **compliance-logging** (error): Requires audit logging
- **compliance-versioning** (warning): Requires S3 versioning
- **compliance-mfa-delete** (info): MFA delete for production S3 buckets

### GDPR Compliance (3 policies)
- **gdpr-data-residency** (error): Ensures EU data stays in EU regions
- **gdpr-encryption-required** (error): Encryption for personal data
- **gdpr-data-retention** (warning): Data retention policies required

### HIPAA Compliance (3 policies)
- **hipaa-encryption-required** (error): PHI data encryption
- **hipaa-audit-logging** (error): Comprehensive audit logging
- **hipaa-backup-required** (error): Automated backups for PHI

### PCI-DSS Compliance (4 policies)
- **pci-network-segmentation** (error): Network segmentation for cardholder data
- **pci-encryption-transit** (error): TLS 1.2+ for data transmission
- **pci-access-control** (error): Strict access controls
- **pci-logging-monitoring** (error): Comprehensive logging

### SOC2 Compliance (4 policies)
- **soc2-change-management** (warning): Change tracking tags
- **soc2-monitoring-alerting** (error): Monitoring for critical resources
- **soc2-data-backup** (error): Backup procedures required
- **soc2-access-logging** (error): Access logging for audit trail

## CI/CD Integration

The tool is designed for seamless CI/CD integration. We provide examples for:

- **GitHub Actions** - Automated PR checks and reports
- **GitLab CI/CD** - Multi-environment pipelines
- **Jenkins** - Declarative and scripted pipelines
- **Azure DevOps** - Complete pipeline configuration
- **CircleCI** - Workflow automation

See [docs/ci-cd-integration.md](docs/ci-cd-integration.md) for detailed examples and best practices.

### Quick GitHub Actions Example

```yaml
name: IaC Compliance

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g gitops-compliance-engine
      - run: gce validate ./infrastructure --severity error
```
- **compliance-mfa-delete** (info): MFA delete for production S3 buckets

**Total: 22 policies** (13 enabled by default)

## Configuration

Create a `gce.config.json` file:

```json
{
  "policies": {
    "enabled": ["required-tags", "no-public-access", "encryption-at-rest"],
    "disabled": ["naming-convention", "cost-nat-gateway"]
  },
  "severity": {
    "failOn": "warning"
  },
  "exclude": {
    "files": ["**/test/**", "**/*.test.tf"],
    "resources": ["aws_s3_bucket_public_access_block", "data.*"]
  }
}
```

### Configuration Options

**`policies.enabled`**: Array of policy IDs to enable (overrides defaults)
**`policies.disabled`**: Array of policy IDs to disable
**`severity.failOn`**: Minimum severity to fail validation (`error`, `warning`, `info`)
**`exclude.files`**: Glob patterns for files to skip
**`exclude.resources`**: Patterns for resource types/IDs to skip

## Examples

### Validate Terraform
```bash
gce validate ./terraform --format terraform --severity error
```

###

### Exclude Specific Resources
```bash
# Using config file with exclude patterns
gce validate ./infrastructure -c gce.config.json
```

### Enable Optional Policies
```bash
# Create config to enable compliance policies
cat > compliance-config.json << EOF
{
  "policies": {
    "enabled": [
      "cost-center-tag",
      "backup-tag",
      "expiration-tag",
      "compliance-logging",
      "compliance-versioning"
    ]
  }
}
EOF

gce validate ./infrastructure -c compliance-config.json
```

### Enable Compliance Frameworks

Enable GDPR compliance policies:
```bash
cat > gdpr-compliance.json << EOF
{
  "policies": {
    "enabled": [
      "gdpr-data-residency",
      "gdpr-encryption-required",
      "gdpr-data-retention",
      "encryption-at-rest",
      "encryption-in-transit",
      "compliance-logging"
    ]
  },
  "severity": { "failOn": "error" }
}
EOF

gce validate ./infrastructure -c gdpr-compliance.json
```

Enable HIPAA compliance:
```bash
cat > hipaa-compliance.json << EOF
{
  "policies": {
    "enabled": [
      "hipaa-encryption-required",
      "hipaa-audit-logging",
      "hipaa-backup-required",
      "encryption-at-rest",
      "no-public-access"
    ]
  }
}
EOF

gce validate ./infrastructure -c hipaa-compliance.json
```

### Tag Resources for Compliance

Tag resources to indicate compliance requirements:

```hcl
resource "aws_s3_bucket" "patient_data" {
  bucket = "patient-records"
  
  tags = {
    DataClassification = "PHI"
    HIPAA-Applicable   = "true"
    Environment        = "production"
  }
}
```

The compliance policies will automatically detect and enforce requirements based on tags.

## Development

```bash
# Watch mode for TypeScript compilation
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Full validation (typecheck + lint + test)
npm run validate
```

## Testing

The project includes comprehensive test coverage:

- **Unit Tests**: Parser and policy engine tests
- **Integration Tests**: Full CLI workflow tests
- **25 Total Tests**: All passing with coverage tracking

```bash
# Run specific test file
npm test -- tests/parsers.test.ts

# Watch mode for development
npm run test:watch
## Development

│   ├── commands/        # validate, check, report commands
│   ├── display.ts       # Color-coded output formatting
│   └── index.ts         # CLI entry point
├── parsers/
│   └── index.ts         # IaC format parsers (Terraform, Pulumi, CF)
├── policies/
│   ├── engine.ts        # Policy evaluation engine
│   └── default-policies.ts  # 22 built-in policies
├── ✅ Phase 1 (Complete)
- [x] CLI structure with Commander.js
- [x] Terraform, Pulumi, CloudFormation parsing
- [x] Format auto-detection
- [x] Policy engine with 22 rules
- [x] Rich console output with colors
- [x] Config file loading with Zod validation
- [x] Report generation (JSON, YAML, Markdown, HTML)
- [x] Exclude patterns support
- [x] Comprehensive test suite (25 tests)

### 🚧 Phase 2 (In Progress)
- [ ] Enhanced HCL parsing with @hashicorp/hcl2-parser
- [ ] Pulumi TypeScript program parsing
- [ ] CloudFormation intrinsic functions
- [ ] Custom policy authoring API
- [ ] Watch mode for development
- [ ] Performance optimizations

### 📋 Phase 3 (Planned)
- [ ] Policy marketplace/sharing
- [ ] Cost estimation integration
- [ ] GitHub Action + GitLab CI templates
- [ ] VS Code extension
- [ ] Additional compliance frameworks (SOC2, PCI-DSS, HIPAA)

### 🔮 Phase 4 (Future)
- [ ] Team approval workflows
- [ ] Policy history and versioning
- [ ] Web dashboard
- [ ] API server mode
- [ ] Terraform/Pulumi provider integration
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## Architecture

```
src/
├── cli/              # CLI commands and display
├── parsers/          # IaC format parsers
├── policies/         # Policy engine and rules
├── utils/            # Helper utilities
└── types.ts          # TypeScript definitions
```

## Roadmap
### CI/CD Pipelines

**GitHub Actions:**
```yaml
- name: Validate Infrastructure
  run: |
    npm install
    npm run build
    node dist/cli/index.js validate ./terraform --severity error
```

**GitLab CI:**
```yaml
validate:
  script:
    - npm install && npm run build
    - node dist/cli/index.js validate ./infrastructure -c .gce.config.json
  artifacts:
    reports:
      - compliance-report.json
```

### Pre-commit Hooks

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
gce validate ./terraform --fail-fast --severity error
```

### Integration Points

- **Infrastructure-Drift-Detector**: Validate before `terraform apply`, detect drift after
- **Zero-Trust-Scanner**: Run security scans on proposed infrastructure
- **Terraform Cloud**: Pre-apply policy validation
- **AWS CodePipeline**: Stage for compliance checks

## Contributing

Contributions are welcome! Areas for contribution:

- Additional policies for AWS, Azure, GCP
- Improved HCL parsing
- New report formats
- Documentation improvements
- Bug fixes and performance improvements

## License

MIT

## Author

sirhCC

---

**Status**: Production Ready | **Version**: 0.1.0 | **Tests**: 25 Passing
- [x] Basic CLI structure
- [x] Terraform parsing (simplified)
- [x] Core policy engine
- [x] Default policies (4 rules)
- [x] Rich console output

### Phase 2
- [ ] Proper HCL parsing with @hashicorp/hcl2-parser
- [ ] Pulumi YAML/TypeScript parsing
- [ ] CloudFormation JSON/YAML parsing
- [ ] Config file loading (JSON/YAML)
- [ ] Report generation (Markdown, HTML, JSON)

### Phase 3
- [ ] Custom policy authoring
- [ ] Policy marketplace/sharing
- [ ] Cost estimation integration
- [ ] Drift detection integration
- [ ] GitHub Action
- [ ] GitLab CI template

### Phase 4
- [ ] Team approval workflows
- [ ] Policy history and versioning
- [ ] Compliance framework templates (SOC2, PCI-DSS, HIPAA)
- [ ] Web dashboard
- [ ] API server mode

## Integration with Your Existing Tools

- **Infrastructure-Drift-Detector**: Validate before `terraform apply`, detect drift after
- **Zero-Trust-Scanner**: Run security scans on proposed infrastructure
- **IQC**: Query infrastructure using SQL after validation passes
- **CICD-Pipeline-Analyzer**: Track validation metrics in CI/CD

## Contributing

This is a personal project but PRs are welcome! Key areas:

1. **Parsers**: Improve Terraform/Pulumi/CloudFormation parsing
2. **Policies**: Add more real-world policy rules
3. **Reporters**: Implement report generation
4. **Tests**: Increase coverage

## License

MIT © sirhCC

---

**Status**: Alpha - Core functionality working, parsers need enhancement
