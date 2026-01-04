# GitOps Compliance Engine - TODO List

## 🔴 Critical (Blocking Core Functionality)

### CLI Commands
- [x] **Implement `check` command** (`src/cli/commands/check.ts`)
  - ✅ Simplified wrapper around validate with sensible defaults
  - ✅ Uses error severity and shows summary

- [x] **Implement `report` command** (`src/cli/commands/report.ts`)
  - ✅ Generate JSON reports
  - ✅ Generate YAML reports
  - ✅ Generate Markdown reports
  - ✅ Generate HTML reports
  - ✅ Save to specified output file

- [x] **Implement display module** (`src/cli/display.ts`)
  - ✅ `displayResults()` - Show validation results with colors
  - ✅ `displayError()` - Show error messages
  - ✅ `displayViolation()` - Format individual violations
  - ✅ `displaySummary()` - Show validation summary
  - ✅ Use chalk for colored output
  - ✅ Show file paths, line numbers, severity badges

### Configuration
- [x] **Config file loading** (`src/cli/commands/validate.ts`)
  - ✅ Load and parse `gce.config.json`
  - ✅ Validate config schema with Zod
  - ✅ Support for policy enable/disable
  - ✅ Support for severity thresholds
  - ✅ Support for exclude patterns
  - ✅ Handle missing config gracefully

- [x] **Config type validation**
  - ✅ Create Zod schema for `ValidationConfig`
  - ✅ Add config validation to ensure correctness

## 🟡 High Priority (Essential Features)

### Parsers
- [ ] **Complete Terraform parser** (`src/parsers/index.ts`)
  - Improve property extraction for nested blocks
  - Handle arrays and complex data structures
  - Parse `data` blocks
  - Parse `variable` and `output` blocks
  - Better handling of interpolations

- [ ] **Enhance Pulumi parser**
  - Parse TypeScript Pulumi programs
  - Extract resource definitions from code
  - Handle async resource creation

- [ ] **Enhance CloudFormation parser**
  - Parse intrinsic functions (Ref, GetAtt, etc.)
  - Handle conditions and parameters
  - Support nested stacks

- [ ] **Add parser auto-detection**
  - Detect format from file extension
  - Detect format from file content
  - Smart fallback mechanism

### Policies
- [ ] **Add more security policies**
  - Encryption at rest required
  - Encryption in transit required
  - No hardcoded secrets
  - IAM role least privilege
  - Network security group rules validation

- [ ] **Add more cost policies**
  - Unused resources detection
  - Reserved instance recommendations
  - Budget threshold warnings
  - Resource right-sizing

- [ ] **Add compliance policies**
  - GDPR compliance checks
  - HIPAA compliance checks
  - PCI-DSS compliance checks
  - SOC2 compliance checks

- [ ] **Add tagging policies**
  - Cost center tags
  - Department tags
  - Expiration date tags
  - Backup policy tags

- [ ] **Policy metadata**
  - Add policy documentation links
  - Add severity justification
  - Add category descriptions

## 🟢 Medium Priority (Quality of Life)

### Testing
- [ ] **Add integration tests**
  - Test full CLI workflows
  - Test with real IaC files
  - Test error scenarios

- [ ] **Add parser tests**
  - Test with complex Terraform files
  - Test with nested structures
  - Test edge cases

- [ ] **Add policy tests**
  - Test each policy independently
  - Test policy combinations
  - Test policy configuration

- [ ] **Increase test coverage**
  - Target 80%+ coverage
  - Cover error paths
  - Cover edge cases

### Error Handling
- [ ] **Better error messages**
  - User-friendly error descriptions
  - Suggestions for fixing errors
  - Context-aware error messages

- [ ] **Validation error handling**
  - Graceful handling of malformed IaC
  - Better parse error messages
  - File access error handling

- [ ] **Configuration error handling**
  - Clear messages for invalid config
  - Schema validation errors
  - Missing file handling

### File Operations
- [ ] **Exclude patterns**
  - Implement file/resource exclusion from config
  - Test exclude patterns
  - Document exclude pattern syntax

- [ ] **File watching** (optional)
  - Watch mode for development
  - Auto-revalidate on file changes

## 🔵 Low Priority (Nice to Have)

### Documentation
- [ ] **Fix README.md Markdown linting issues**
  - Add blank lines around headings
  - Add blank lines around code blocks
  - Add blank lines around lists
  - Add language to code blocks

- [ ] **Add comprehensive examples**
  - Real-world Terraform examples
  - Real-world Pulumi examples
  - Real-world CloudFormation examples
  - Complex multi-file projects

- [ ] **API documentation**
  - Document all exported functions
  - Add JSDoc comments
  - Generate API docs with TypeDoc

- [ ] **Usage guides**
  - Getting started guide
  - Policy authoring guide
  - Configuration guide
  - CI/CD integration guide

### Features
- [ ] **Custom policy support**
  - Load policies from external files
  - Policy plugin system
  - JavaScript/TypeScript policy DSL

- [ ] **Interactive mode**
  - Interactive violation review
  - Skip/accept violations
  - Generate suppression rules

- [ ] **Fix/remediation mode**
  - Auto-fix certain violations
  - Generate patches for issues
  - Apply fixes with confirmation

- [ ] **Diff mode**
  - Compare before/after changes
  - Validate only changed files
  - Show impact of changes

### Output Formats
- [ ] **JUnit XML output**
  - For CI/CD integration
  - Test result format

- [ ] **SARIF output**
  - For security tools integration
  - GitHub code scanning

- [ ] **CSV output**
  - For spreadsheet analysis
  - Bulk reporting

### Performance
- [ ] **Parallel file processing**
  - Process multiple files concurrently
  - Performance benchmarking
  - Memory optimization

- [ ] **Caching**
  - Cache parse results
  - Cache policy evaluations
  - Incremental validation

## 📋 Future Enhancements (Phase 2+)

### Advanced Features
- [ ] **Remote policy repositories**
  - Fetch policies from Git
  - Fetch policies from HTTP
  - Policy versioning

- [ ] **Team workflows**
  - Policy exceptions/waivers
  - Approval workflows
  - Audit logging

- [ ] **Dashboard/UI**
  - Web-based dashboard
  - Compliance metrics
  - Historical tracking

- [ ] **Integrations**
  - GitHub Actions
  - GitLab CI
  - Azure DevOps
  - Jenkins
  - Terraform Cloud
  - AWS CodePipeline

### Parser Improvements
- [ ] **Use proper HCL parser**
  - Integrate @hashicorp/hcl2-parser
  - Full Terraform HCL2 support
  - Module resolution

- [ ] **Bicep support**
  - Parse Azure Bicep files
  - Bicep-specific policies

- [ ] **CDK support**
  - AWS CDK (TypeScript/Python)
  - Terraform CDK

- [ ] **Kubernetes support**
  - Kubernetes manifests
  - Helm charts
  - Kustomize

### AI/ML Features
- [ ] **Smart policy suggestions**
  - ML-based policy recommendations
  - Pattern detection
  - Anomaly detection

- [ ] **Auto-remediation suggestions**
  - AI-generated fix suggestions
  - Context-aware remediation

## 🐛 Known Issues

- [ ] Terraform parser doesn't handle all HCL syntax (simplified implementation)
- [ ] No support for Terraform modules yet
- [ ] Pulumi parser only handles YAML, not TypeScript programs
- [ ] CloudFormation intrinsic functions not fully parsed
- [ ] Config file loading is stubbed
- [ ] Display functions not implemented
- [ ] No exclude pattern support yet

## 📝 Technical Debt

- [ ] Add proper logging system
- [ ] Improve type safety in parsers
- [ ] Refactor parser extraction logic
- [ ] Add dependency injection for testability
- [ ] Standardize error handling patterns
- [ ] Add telemetry/analytics (opt-in)

---

## Progress Legend
- 🔴 Critical - Blocking core functionality
- 🟡 High Priority - Essential features
- 🟢 Medium Priority - Quality of life improvements
- 🔵 Low Priority - Nice to have features

**Last Updated:** January 4, 2026
