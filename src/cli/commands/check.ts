import { validateCommand } from './validate.js';

interface CheckOptions {
  config?: string;
  format?: string;
}

export async function checkCommand(path: string, options: CheckOptions): Promise<void> {
  // Check is just an alias for validate with quick defaults
  await validateCommand(path, {
    ...options,
    severity: 'error',
    failFast: false,
    summary: true,
  });
}
