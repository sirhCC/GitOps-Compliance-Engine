# GitOps Compliance Report

## Summary

- **Files Scanned:** 1
- **Resources Checked:** 4
- **Total Violations:** 6
- **Status:** ❌ FAILED

## Violations by Severity

| Severity | Count |
|----------|-------|
| Error    | 1 |
| Warning  | 3 |
| Info     | 2 |

## Violations by Category

| Category   | Count |
|------------|-------|
| Cost | 1 |
| Security | 1 |
| Tagging | 2 |
| Naming | 2 |

## Detailed Violations

### D:/GitOps Compliance Engine/examples/sample.tf

🟡 **Required Tags** (warning)

- **Resource:** aws_instance `web_server`
- **Location:** D:/GitOps Compliance Engine/examples/sample.tf:3
- **Category:** tagging
- **Message:** Resource is missing tags: Environment, Owner, Project
- **Remediation:** Add missing tags: Environment, Owner, Project

🔵 **Naming Convention** (info)

- **Resource:** aws_instance `web_server`
- **Location:** D:/GitOps Compliance Engine/examples/sample.tf:3
- **Category:** naming
- **Message:** Resource name "web_server" does not follow naming convention
- **Remediation:** Use lowercase letters, numbers, and hyphens only

🟡 **Large Instance Warning** (warning)

- **Resource:** aws_instance `web_server`
- **Location:** D:/GitOps Compliance Engine/examples/sample.tf:3
- **Category:** cost
- **Message:** Instance type "t2.xlarge" may incur high costs
- **Remediation:** Consider using a smaller instance type or verify this is necessary

🟡 **Required Tags** (warning)

- **Resource:** aws_s3_bucket `PublicBucket`
- **Location:** D:/GitOps Compliance Engine/examples/sample.tf:13
- **Category:** tagging
- **Message:** Resource is missing required tags
- **Remediation:** Add tags: Environment, Owner, Project

🔵 **Naming Convention** (info)

- **Resource:** aws_s3_bucket `PublicBucket`
- **Location:** D:/GitOps Compliance Engine/examples/sample.tf:13
- **Category:** naming
- **Message:** Resource name "PublicBucket" does not follow naming convention
- **Remediation:** Use lowercase letters, numbers, and hyphens only

🔴 **No Public Access** (error)

- **Resource:** aws_db_instance `database`
- **Location:** D:/GitOps Compliance Engine/examples/sample.tf:17
- **Category:** security
- **Message:** Resource is configured for public access
- **Remediation:** Set public access to false and use VPN or private networking

---

*Generated on 2026-01-04T05:19:14.685Z*
