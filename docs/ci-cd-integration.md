# CI/CD Integration Guide

This guide demonstrates how to integrate the GitOps Compliance Engine into your CI/CD pipelines to automate infrastructure compliance validation.

## Table of Contents

- [GitHub Actions](#github-actions)
- [GitLab CI/CD](#gitlab-cicd)
- [Jenkins](#jenkins)
- [Azure DevOps](#azure-devops)
- [CircleCI](#circleci)
- [Configuration Best Practices](#configuration-best-practices)

## GitHub Actions

### Basic Integration

Create `.github/workflows/compliance-check.yml`:

```yaml
name: IaC Compliance Check

on:
  pull_request:
    paths:
      - '**/*.tf'
      - 'infrastructure/**'

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install GCE
        run: npm install -g gitops-compliance-engine
      
      - name: Validate Infrastructure
        run: gce validate ./infrastructure --severity error
```

### Advanced Integration with Reports

```yaml
name: Infrastructure Compliance

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Dependencies
        run: npm install -g gitops-compliance-engine
      
      - name: Run Validation
        id: validate
        run: gce validate ./infra --config gce.config.json
        continue-on-error: true
      
      - name: Generate Report
        if: always()
        run: |
          gce report ./infra --output report.html --format html
          gce report ./infra --output report.json --format json
      
      - name: Upload Artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: compliance-reports
          path: |
            report.html
            report.json
      
      - name: Comment on PR
        if: github.event_name == 'pull_request' && always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('report.json', 'utf8'));
            
            let comment = '## 🔍 Compliance Report\n\n';
            comment += `**Total Violations:** ${report.totalViolations}\n`;
            comment += `**Status:** ${report.passed ? '✅ Passed' : '❌ Failed'}\n\n`;
            
            if (report.totalViolations > 0) {
              comment += '### Violations by Severity\n';
              comment += `- Errors: ${report.violationsBySeverity.error || 0}\n`;
              comment += `- Warnings: ${report.violationsBySeverity.warning || 0}\n`;
              comment += `- Info: ${report.violationsBySeverity.info || 0}\n`;
            }
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
      
      - name: Fail on violations
        if: steps.validate.outcome == 'failure'
        run: exit 1
```

## GitLab CI/CD

### Basic Pipeline

Create `.gitlab-ci.yml`:

```yaml
stages:
  - validate
  - report

variables:
  GCE_VERSION: "latest"

compliance_check:
  stage: validate
  image: node:20-alpine
  before_script:
    - npm install -g gitops-compliance-engine@${GCE_VERSION}
  script:
    - gce validate ./infrastructure --severity error
  only:
    changes:
      - "**/*.tf"
      - "infrastructure/**"

compliance_report:
  stage: report
  image: node:20-alpine
  before_script:
    - npm install -g gitops-compliance-engine
  script:
    - gce report ./infrastructure --output report.html --format html
    - gce report ./infrastructure --output report.json --format json
  artifacts:
    paths:
      - report.html
      - report.json
    expire_in: 30 days
  when: always
```

### Advanced Pipeline with Multiple Environments

```yaml
stages:
  - validate
  - security
  - report

.compliance_base:
  image: node:20-alpine
  before_script:
    - npm install -g gitops-compliance-engine

validate_dev:
  extends: .compliance_base
  stage: validate
  script:
    - gce validate ./infrastructure/dev --severity warning
  only:
    - merge_requests
    - develop

validate_staging:
  extends: .compliance_base
  stage: validate
  script:
    - gce validate ./infrastructure/staging --severity error
  only:
    - merge_requests
    - main

validate_prod:
  extends: .compliance_base
  stage: validate
  script:
    - |
      cat > prod-strict.config.json << EOF
      {
        "policies": {
          "enabled": ["*"]
        },
        "severity": {
          "failOn": "warning"
        }
      }
      EOF
      gce validate ./infrastructure/prod --config prod-strict.config.json
  only:
    - main
  allow_failure: false

security_scan:
  extends: .compliance_base
  stage: security
  script:
    - |
      cat > security.config.json << EOF
      {
        "policies": {
          "enabled": [
            "no-public-access",
            "encryption-at-rest",
            "encryption-in-transit",
            "no-hardcoded-secrets",
            "security-group-unrestricted"
          ]
        },
        "severity": {
          "failOn": "error"
        }
      }
      EOF
      gce validate ./infrastructure --config security.config.json

generate_report:
  extends: .compliance_base
  stage: report
  script:
    - gce report ./infrastructure --output compliance-report.html --format html
    - gce report ./infrastructure --output compliance-report.md --format markdown
  artifacts:
    paths:
      - compliance-report.html
      - compliance-report.md
    reports:
      junit: compliance-report.json
  when: always
```

## Jenkins

### Declarative Pipeline

Create `Jenkinsfile`:

```groovy
pipeline {
    agent {
        docker {
            image 'node:20-alpine'
            args '-u root'
        }
    }
    
    environment {
        INFRA_PATH = 'infrastructure'
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g gitops-compliance-engine'
            }
        }
        
        stage('Validate Infrastructure') {
            steps {
                script {
                    try {
                        sh """
                            gce validate ${INFRA_PATH} \
                                --config gce.config.json \
                                --severity error
                        """
                    } catch (Exception e) {
                        currentBuild.result = 'UNSTABLE'
                        error "Compliance violations found"
                    }
                }
            }
        }
        
        stage('Generate Reports') {
            steps {
                sh """
                    gce report ${INFRA_PATH} --output report.html --format html
                    gce report ${INFRA_PATH} --output report.json --format json
                """
            }
        }
    }
    
    post {
        always {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: '.',
                reportFiles: 'report.html',
                reportName: 'Compliance Report'
            ])
            
            archiveArtifacts artifacts: 'report.*', allowEmptyArchive: true
        }
        
        failure {
            emailext(
                subject: "Infrastructure Compliance Failed: ${env.JOB_NAME}",
                body: "Compliance check failed. View the report at ${env.BUILD_URL}Compliance_20Report/",
                to: "${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
    }
}
```

### Scripted Pipeline with Multi-Environment

```groovy
node {
    def environments = ['dev', 'staging', 'prod']
    
    stage('Checkout') {
        checkout scm
    }
    
    stage('Setup') {
        docker.image('node:20-alpine').inside {
            sh 'npm install -g gitops-compliance-engine'
        }
    }
    
    environments.each { env ->
        stage("Validate ${env}") {
            docker.image('node:20-alpine').inside {
                def severity = (env == 'prod') ? 'warning' : 'error'
                
                sh """
                    gce validate infrastructure/${env} \
                        --severity ${severity} \
                        --config configs/${env}-gce.config.json
                """
            }
        }
    }
    
    stage('Generate Reports') {
        docker.image('node:20-alpine').inside {
            environments.each { env ->
                sh """
                    gce report infrastructure/${env} \
                        --output ${env}-report.html \
                        --format html
                """
            }
        }
        
        publishHTML([
            allowMissing: false,
            alwaysLinkToLastBuild: true,
            keepAll: true,
            reportDir: '.',
            reportFiles: '*-report.html',
            reportName: 'Environment Reports'
        ])
    }
}
```

## Azure DevOps

### Pipeline YAML

Create `azure-pipelines.yml`:

```yaml
trigger:
  branches:
    include:
      - main
      - develop
  paths:
    include:
      - infrastructure/**
      - '**/*.tf'

pool:
  vmImage: 'ubuntu-latest'

variables:
  infraPath: 'infrastructure'

stages:
  - stage: Validate
    displayName: 'Validate Infrastructure Compliance'
    jobs:
      - job: ComplianceCheck
        displayName: 'Run Compliance Validation'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '20.x'
            displayName: 'Install Node.js'
          
          - script: |
              npm install -g gitops-compliance-engine
            displayName: 'Install GitOps Compliance Engine'
          
          - script: |
              gce validate $(infraPath) --config gce.config.json --severity error
            displayName: 'Validate Compliance'
            continueOnError: true
          
          - script: |
              gce report $(infraPath) --output $(Build.ArtifactStagingDirectory)/report.html --format html
              gce report $(infraPath) --output $(Build.ArtifactStagingDirectory)/report.json --format json
            displayName: 'Generate Reports'
            condition: always()
          
          - task: PublishBuildArtifacts@1
            inputs:
              pathToPublish: '$(Build.ArtifactStagingDirectory)'
              artifactName: 'compliance-reports'
            displayName: 'Publish Reports'
            condition: always()
          
          - task: PublishTestResults@2
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: '$(Build.ArtifactStagingDirectory)/report.json'
              testRunTitle: 'Compliance Tests'
            condition: always()

  - stage: SecurityAudit
    displayName: 'Security Compliance Audit'
    dependsOn: Validate
    condition: succeeded()
    jobs:
      - job: SecurityCheck
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '20.x'
          
          - script: npm install -g gitops-compliance-engine
            displayName: 'Install GCE'
          
          - script: |
              cat > security-only.json << EOF
              {
                "policies": {
                  "enabled": [
                    "no-public-access",
                    "encryption-at-rest",
                    "no-hardcoded-secrets"
                  ]
                },
                "severity": { "failOn": "error" }
              }
              EOF
              
              gce validate $(infraPath) --config security-only.json
            displayName: 'Security Scan'
```

## CircleCI

### Configuration

Create `.circleci/config.yml`:

```yaml
version: 2.1

orbs:
  node: circleci/node@5.1

jobs:
  validate-compliance:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      
      - node/install-packages:
          pkg-manager: npm
      
      - run:
          name: Install GitOps Compliance Engine
          command: npm install -g gitops-compliance-engine
      
      - run:
          name: Validate Infrastructure
          command: |
            gce validate ./infrastructure \
              --config gce.config.json \
              --severity error
      
      - run:
          name: Generate Reports
          command: |
            gce report ./infrastructure --output report.html --format html
            gce report ./infrastructure --output report.json --format json
          when: always
      
      - store_artifacts:
          path: report.html
          destination: compliance-report.html
      
      - store_artifacts:
          path: report.json
          destination: compliance-report.json
      
      - store_test_results:
          path: report.json

  security-scan:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      
      - run:
          name: Install GCE
          command: npm install -g gitops-compliance-engine
      
      - run:
          name: Security Policies Check
          command: |
            cat > security.config.json << EOF
            {
              "policies": {
                "enabled": [
                  "no-public-access",
                  "encryption-at-rest",
                  "encryption-in-transit",
                  "no-hardcoded-secrets",
                  "security-group-unrestricted"
                ]
              },
              "severity": { "failOn": "error" }
            }
            EOF
            
            gce validate ./infrastructure --config security.config.json

workflows:
  version: 2
  compliance-check:
    jobs:
      - validate-compliance:
          filters:
            branches:
              only:
                - main
                - develop
      
      - security-scan:
          requires:
            - validate-compliance
```

## Configuration Best Practices

### Environment-Specific Configurations

#### Development Environment
```json
{
  "policies": {
    "enabled": ["*"],
    "disabled": ["cost-large-instance", "cost-multi-az"]
  },
  "severity": {
    "failOn": "warning"
  },
  "exclude": {
    "patterns": ["**/test/**", "**/experimental/**"]
  }
}
```

#### Staging Environment
```json
{
  "policies": {
    "enabled": ["*"]
  },
  "severity": {
    "failOn": "error"
  },
  "exclude": {
    "patterns": ["**/test/**"]
  }
}
```

#### Production Environment
```json
{
  "policies": {
    "enabled": ["*"]
  },
  "severity": {
    "failOn": "warning"
  },
  "exclude": {
    "patterns": []
  }
}
```

### Security-Focused Configuration
```json
{
  "policies": {
    "enabled": [
      "no-public-access",
      "encryption-at-rest",
      "encryption-in-transit",
      "no-hardcoded-secrets",
      "security-group-unrestricted",
      "iam-wildcard-actions"
    ]
  },
  "severity": {
    "failOn": "error"
  }
}
```

### Cost-Optimization Configuration
```json
{
  "policies": {
    "enabled": [
      "cost-large-instance",
      "cost-unattached-volumes",
      "cost-gp2-to-gp3",
      "cost-oversized-volume",
      "cost-multi-az",
      "cost-nat-gateway"
    ]
  },
  "severity": {
    "failOn": "info"
  }
}
```

### Compliance Configuration (HIPAA)
```json
{
  "policies": {
    "enabled": [
      "hipaa-encryption-required",
      "hipaa-audit-logging",
      "hipaa-backup-required",
      "encryption-at-rest",
      "encryption-in-transit",
      "compliance-logging",
      "no-public-access"
    ]
  },
  "severity": {
    "failOn": "error"
  }
}
```

## Tips and Best Practices

### 1. Fail Fast for Critical Violations
Use `--fail-fast` flag to stop at the first critical violation:
```bash
gce validate ./infra --severity error --fail-fast
```

### 2. Generate Multiple Report Formats
```bash
gce report ./infra --output report.html --format html
gce report ./infra --output report.md --format markdown
gce report ./infra --output report.json --format json
```

### 3. Cache Dependencies
In CI/CD pipelines, cache npm packages to speed up builds:

**GitHub Actions:**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

**GitLab CI:**
```yaml
cache:
  paths:
    - node_modules/
```

### 4. Parallel Validation for Multiple Directories
```bash
gce validate ./infra/network &
gce validate ./infra/compute &
gce validate ./infra/storage &
wait
```

### 5. Custom Exit Codes
The tool returns exit codes based on validation results:
- `0`: Success (no violations)
- `1`: Violations found
- `2`: Parsing or runtime errors

Use these in your CI/CD logic:
```bash
if gce validate ./infra --severity error; then
  echo "✅ Compliance check passed"
else
  echo "❌ Compliance check failed"
  exit 1
fi
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/sirhCC/gitops-compliance-engine/issues
- Documentation: https://github.com/sirhCC/gitops-compliance-engine/docs
