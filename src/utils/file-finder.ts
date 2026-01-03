import { glob } from 'fast-glob';
import { resolve } from 'path';

/**
 * Find IaC files in the given path based on format
 */
export async function findIacFiles(path: string, format: string): Promise<string[]> {
  const patterns = getGlobPatterns(format);
  
  const files = await glob(patterns, {
    cwd: resolve(path),
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/.terraform/**',
      '**/dist/**',
      '**/build/**',
    ],
  });

  return files;
}

function getGlobPatterns(format: string): string[] {
  switch (format.toLowerCase()) {
    case 'terraform':
      return ['**/*.tf', '**/*.tfvars'];
    case 'pulumi':
      return ['**/Pulumi.yaml', '**/Pulumi.*.yaml', '**/*.pulumi.ts'];
    case 'cloudformation':
      return ['**/*.template.{json,yaml,yml}', '**/cloudformation.{json,yaml,yml}'];
    default:
      return ['**/*.{tf,yaml,yml,json}'];
  }
}
