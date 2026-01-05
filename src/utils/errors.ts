/**
 * Enhanced error handling utilities
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly file: string,
    public readonly line?: number
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly configPath: string
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Format error messages with helpful context
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    return `Validation Error [${error.code}]: ${error.message}${
      error.details ? `\nDetails: ${JSON.stringify(error.details, null, 2)}` : ''
    }`;
  }

  if (error instanceof ParseError) {
    return `Parse Error in ${error.file}${error.line ? ` at line ${error.line}` : ''}: ${error.message}`;
  }

  if (error instanceof ConfigError) {
    return `Config Error in ${error.configPath}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Suggest fixes for common errors
 */
export function suggestFix(error: unknown): string | null {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('no such file') || message.includes('enoent')) {
      return 'Check that the file path is correct and the file exists';
    }

    if (message.includes('permission denied') || message.includes('eacces')) {
      return 'Check file permissions and ensure you have read access';
    }

    if (message.includes('invalid json')) {
      return 'Verify the JSON syntax is correct (use a JSON validator)';
    }

    if (message.includes('no iac files found')) {
      return 'Ensure you are in the correct directory and the files have the expected extensions (.tf, .yaml, etc.)';
    }

    if (message.includes('unsupported iac format')) {
      return 'Supported formats are: terraform, pulumi, cloudformation';
    }

    if (message.includes('unresolved tag')) {
      return 'CloudFormation short-form tags (!Ref, !GetAtt) should use long form (Fn::Ref, Fn::GetAtt) for best compatibility';
    }
  }

  return null;
}
