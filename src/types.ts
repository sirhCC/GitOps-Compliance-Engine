/**
 * Core types for the GitOps Compliance Engine
 */

export type Severity = 'error' | 'warning' | 'info';
export type IacFormat = 'terraform' | 'pulumi' | 'cloudformation';
export type PolicyCategory = 'cost' | 'security' | 'compliance' | 'tagging' | 'naming';

/**
 * Parsed Infrastructure-as-Code resource
 */
export interface IacResource {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  location: {
    file: string;
    line?: number;
    column?: number;
  };
}

/**
 * Result of parsing an IaC file
 */
export interface ParseResult {
  format: IacFormat;
  resources: IacResource[];
  metadata: {
    provider?: string;
    version?: string;
    contentHash?: string;
  };
}

/**
 * Alias for ParseResult used by cache
 */
export type ParsedIacFile = ParseResult;

/**
 * A compliance policy rule
 */
export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  severity: Severity;
  enabled: boolean;
  evaluate: (resource: IacResource) => PolicyViolation | null;
  metadata?: {
    rationale?: string;
    references?: string[];
    frameworks?: string[];
  };
}

/**
 * A violation found during validation
 */
export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  category: PolicyCategory;
  message: string;
  resource: {
    id: string;
    type: string;
    location: IacResource['location'];
  };
  remediation?: string;
}

/**
 * Validation result for a single file
 */
export interface ValidationResult {
  file: string;
  format: IacFormat;
  violations: PolicyViolation[];
  resourceCount: number;
  passed: boolean;
}

/**
 * Overall validation summary
 */
export interface ValidationSummary {
  totalFiles: number;
  totalResources: number;
  totalViolations: number;
  violationsBySeverity: Record<Severity, number>;
  violationsByCategory: Record<PolicyCategory, number>;
  passed: boolean;
  results: ValidationResult[];
}

/**
 * Configuration for validation
 */
export interface ValidationConfig {
  policies?: {
    enabled?: string[]; // Policy IDs to enable
    disabled?: string[]; // Policy IDs to disable
  };
  severity?: {
    failOn?: Severity; // Fail validation if violations at this level or higher
  };
  exclude?: {
    files?: string[]; // Glob patterns to exclude
    resources?: string[]; // Resource types to exclude
  };
}
