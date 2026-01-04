# GitOps Compliance Engine

Enterprise-grade CLI tool that validates Infrastructure-as-Code (Terraform, Pulumi, CloudFormation) against organizational policies before deployment.

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run validation on current directory
node dist/cli/index.js validate .

# Or use the CLI alias (after npm link)
gce validate ./infrastructure
```

## Features

- ✅ **Multi-IaC Support**: Terraform, Pulumi, CloudFormation
- ✅ **Policy Categories**: Cost, Security, Compliance, Tagging, Naming
- ✅ **Severity Levels**: Error, Warning, Info
- ✅ **Flexible Configuration**: Enable/disable policies, set fail thresholds
- ✅ **Rich Output**: Color-coded CLI output with remediation suggestions
- ✅ **CI/CD Ready**: Exit codes for pipeline integration

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
```

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

### Compliance (3 policies)
- **compliance-logging** (error): Requires audit logging
- **compliance-versioning** (warning): Requires S3 versioning
- **compliance-mfa-delete** (info): MFA delete for production S3 buckets

**Total: 22 policies** (13 enabled by default)

## Configuration

Create a `gce.config.json` file:

```json
{
  "policies": {
    "enabled": ["required-tags", "no-public-access"],
    "disabled": ["naming-convention"]
  },
  "severity": {
    "failOn": "warning"
  },
  "exclude": {
    "files": ["**/test/**"],
    "resources": ["aws_s3_bucket_public_access_block"]
  }
}
```

## Examples

### Validate Terraform
```bash
gce validate ./terraform --format terraform --severity error
```

### Validate with Config
```bash
gce validate ./infrastructure -c gce.config.json
```

### Generate HTML Report
```bash
gce report ./terraform -o compliance-report.html --format html
```

## Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Run tests
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

### Phase 1 (Current)
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
