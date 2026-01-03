# GitOps Compliance Engine - Development Guide

## Project Overview
CLI tool that validates Infrastructure-as-Code (Terraform, Pulumi, CloudFormation) against organizational policies before deployment.

## Progress Tracking
- [x] Verify copilot-instructions.md created
- [x] Clarify project requirements
- [ ] Scaffold the project structure
- [ ] Implement core functionality
- [ ] Install dependencies
- [ ] Compile and test
- [ ] Documentation complete

## Tech Stack
- TypeScript (strict mode)
- Node.js 20+
- Commander.js (CLI framework)
- Zod (schema validation)
- Vitest (testing)
- ESLint + Prettier

## Architecture
- CLI layer: Command parsing and orchestration
- Parsers: IaC format parsers (HCL, YAML, JSON)
- Policies: Rule definitions and evaluation engine
- Validators: Policy execution against parsed IaC
- Reporters: Multi-format output generation
