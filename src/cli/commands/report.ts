import { ValidationConfig, ValidationSummary } from '../../types.js';
import { findIacFiles } from '../../utils/file-finder.js';
import { parseIacFile } from '../../parsers/index.js';
import { PolicyEngine } from '../../policies/engine.js';
import { displayError, displaySuccess } from '../display.js';
import { writeFile } from 'fs/promises';
import { stringify as stringifyYaml } from 'yaml';

interface ReportOptions {
  output?: string;
  format?: string;
  config?: string;
  iacFormat?: string;
}

export async function reportCommand(path: string, options: ReportOptions): Promise<void> {
  try {
    // Load configuration
    const config: ValidationConfig = options.config ? await loadConfig(options.config) : {};

    // Find IaC files
    const files = await findIacFiles(path, options.iacFormat || 'terraform');

    if (files.length === 0) {
      displayError(`No IaC files found in ${path}`);
      process.exit(1);
    }

    // Initialize policy engine
    const policyEngine = new PolicyEngine(config);

    // Validate each file
    const summary: ValidationSummary = {
      totalFiles: files.length,
      totalResources: 0,
      totalViolations: 0,
      violationsBySeverity: { error: 0, warning: 0, info: 0 },
      violationsByCategory: { cost: 0, security: 0, compliance: 0, tagging: 0, naming: 0 },
      passed: true,
      results: [],
    };

    for (const file of files) {
      const parseResult = await parseIacFile(file, options.iacFormat || 'terraform');
      const violations = policyEngine.validateResources(parseResult.resources);

      const fileResult = {
        file,
        format: parseResult.format,
        violations,
        resourceCount: parseResult.resources.length,
        passed: violations.length === 0,
      };

      summary.results.push(fileResult);
      summary.totalResources += parseResult.resources.length;
      summary.totalViolations += violations.length;

      // Update severity and category counts
      for (const violation of violations) {
        summary.violationsBySeverity[violation.severity]++;
        summary.violationsByCategory[violation.category]++;
      }
    }

    // Determine if validation passed
    summary.passed = summary.violationsBySeverity.error === 0;

    // Generate report
    const reportFormat = options.format || 'markdown';
    const reportContent = generateReport(summary, reportFormat);

    // Output report
    if (options.output) {
      await writeFile(options.output, reportContent, 'utf-8');
      displaySuccess(`Report saved to ${options.output}`);
    } else {
      console.log(reportContent);
    }
  } catch (error) {
    displayError(error instanceof Error ? error.message : 'Unknown error occurred');
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/require-await
async function loadConfig(_configPath: string): Promise<ValidationConfig> {
  // TODO: Implement config file loading
  return {};
}

function generateReport(summary: ValidationSummary, format: string): string {
  switch (format.toLowerCase()) {
    case 'json':
      return generateJsonReport(summary);
    case 'yaml':
      return generateYamlReport(summary);
    case 'markdown':
      return generateMarkdownReport(summary);
    case 'html':
      return generateHtmlReport(summary);
    default:
      throw new Error(`Unsupported report format: ${format}`);
  }
}

function generateJsonReport(summary: ValidationSummary): string {
  return JSON.stringify(summary, null, 2);
}

function generateYamlReport(summary: ValidationSummary): string {
  return stringifyYaml(summary);
}

function generateMarkdownReport(summary: ValidationSummary): string {
  let report = '# GitOps Compliance Report\n\n';

  // Summary section
  report += '## Summary\n\n';
  report += `- **Files Scanned:** ${summary.totalFiles}\n`;
  report += `- **Resources Checked:** ${summary.totalResources}\n`;
  report += `- **Total Violations:** ${summary.totalViolations}\n`;
  report += `- **Status:** ${summary.passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;

  // Violations by severity
  report += '## Violations by Severity\n\n';
  report += '| Severity | Count |\n';
  report += '|----------|-------|\n';
  report += `| Error    | ${summary.violationsBySeverity.error} |\n`;
  report += `| Warning  | ${summary.violationsBySeverity.warning} |\n`;
  report += `| Info     | ${summary.violationsBySeverity.info} |\n\n`;

  // Violations by category
  report += '## Violations by Category\n\n';
  report += '| Category   | Count |\n';
  report += '|------------|-------|\n';
  for (const [category, count] of Object.entries(summary.violationsByCategory)) {
    if (typeof count === 'number' && count > 0) {
      report += `| ${category.charAt(0).toUpperCase() + category.slice(1)} | ${count} |\n`;
    }
  }
  report += '\n';

  // Detailed violations
  if (summary.totalViolations > 0) {
    report += '## Detailed Violations\n\n';

    for (const result of summary.results) {
      if (result.violations.length > 0) {
        report += `### ${result.file}\n\n`;

        for (const violation of result.violations) {
          const severityEmoji =
            violation.severity === 'error' ? '🔴' : violation.severity === 'warning' ? '🟡' : '🔵';
          report += `${severityEmoji} **${violation.ruleName}** (${violation.severity})\n\n`;
          report += `- **Resource:** ${violation.resource.type} \`${violation.resource.id}\`\n`;
          report += `- **Location:** ${violation.resource.location.file}:${violation.resource.location.line || 0}\n`;
          report += `- **Category:** ${violation.category}\n`;
          report += `- **Message:** ${violation.message}\n`;

          if (violation.remediation) {
            report += `- **Remediation:** ${violation.remediation}\n`;
          }

          report += '\n';
        }
      }
    }
  }

  report += `---\n\n*Generated on ${new Date().toISOString()}*\n`;

  return report;
}

function generateHtmlReport(summary: ValidationSummary): string {
  const passedClass = summary.passed ? 'passed' : 'failed';
  const statusText = summary.passed ? 'PASSED ✅' : 'FAILED ❌';

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitOps Compliance Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
    }
    .status {
      font-size: 24px;
      font-weight: bold;
      margin-top: 10px;
    }
    .status.passed { color: #10b981; }
    .status.failed { color: #ef4444; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-card h3 {
      margin: 0 0 10px 0;
      color: #666;
      font-size: 14px;
      text-transform: uppercase;
    }
    .summary-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #333;
    }
    .violations-table {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background-color: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    .violation-item {
      background: white;
      border-left: 4px solid #3b82f6;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .violation-item.error { border-left-color: #ef4444; }
    .violation-item.warning { border-left-color: #f59e0b; }
    .violation-item.info { border-left-color: #3b82f6; }
    .violation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .violation-title {
      font-weight: bold;
      font-size: 16px;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge.error { background-color: #fee2e2; color: #991b1b; }
    .badge.warning { background-color: #fef3c7; color: #92400e; }
    .badge.info { background-color: #dbeafe; color: #1e40af; }
    .violation-details {
      color: #6b7280;
      font-size: 14px;
    }
    .remediation {
      background-color: #f0f9ff;
      border-left: 3px solid #0ea5e9;
      padding: 10px;
      margin-top: 10px;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      color: #6b7280;
      margin-top: 40px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>GitOps Compliance Report</h1>
    <div class="status ${passedClass}">${statusText}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <h3>Files Scanned</h3>
      <div class="value">${summary.totalFiles}</div>
    </div>
    <div class="summary-card">
      <h3>Resources Checked</h3>
      <div class="value">${summary.totalResources}</div>
    </div>
    <div class="summary-card">
      <h3>Total Violations</h3>
      <div class="value">${summary.totalViolations}</div>
    </div>
  </div>

  <div class="violations-table">
    <h2>Violations by Severity</h2>
    <table>
      <thead>
        <tr>
          <th>Severity</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="badge error">Error</span></td>
          <td>${summary.violationsBySeverity.error}</td>
        </tr>
        <tr>
          <td><span class="badge warning">Warning</span></td>
          <td>${summary.violationsBySeverity.warning}</td>
        </tr>
        <tr>
          <td><span class="badge info">Info</span></td>
          <td>${summary.violationsBySeverity.info}</td>
        </tr>
      </tbody>
    </table>
  </div>
`;

  if (summary.totalViolations > 0) {
    html += '<h2 style="margin-top: 40px;">Detailed Violations</h2>\n';

    for (const result of summary.results) {
      if (result.violations.length > 0) {
        html += `<h3 style="margin-top: 30px;">${result.file}</h3>\n`;

        for (const violation of result.violations) {
          html += `
  <div class="violation-item ${violation.severity}">
    <div class="violation-header">
      <div class="violation-title">${violation.ruleName}</div>
      <span class="badge ${violation.severity}">${violation.severity}</span>
    </div>
    <div class="violation-details">
      <p><strong>Resource:</strong> ${violation.resource.type} <code>${violation.resource.id}</code></p>
      <p><strong>Location:</strong> ${violation.resource.location.file}:${violation.resource.location.line || 0}</p>
      <p><strong>Category:</strong> ${violation.category}</p>
      <p><strong>Message:</strong> ${violation.message}</p>
    </div>
`;

          if (violation.remediation) {
            html += `
    <div class="remediation">
      <strong>💡 Remediation:</strong> ${violation.remediation}
    </div>
`;
          }

          html += '  </div>\n';
        }
      }
    }
  }

  html += `
  <div class="footer">
    Generated on ${new Date().toISOString()}
  </div>
</body>
</html>
`;

  return html;
}
