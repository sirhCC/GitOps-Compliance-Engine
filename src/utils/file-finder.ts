import fg from 'fast-glob';
import { resolve } from 'path';
import { stat } from 'fs/promises';

/**
 * Find IaC files in the given path based on format
 */
export async function findIacFiles(path: string, format: string): Promise<string[]> {
  // Validate path exists
  try {
    const pathStat = await stat(resolve(path));
    if (!pathStat.isDirectory() && !pathStat.isFile()) {
      throw new Error(`Path is neither a file nor a directory: ${path}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Path does not exist: ${path}`);
    }
    throw error;
  }

  const patterns = getGlobPatterns(format);

  const files = await fg(patterns, {
    cwd: resolve(path),
    absolute: true,
    ignore: ['**/node_modules/**', '**/.terraform/**', '**/dist/**', '**/build/**'],
    onlyFiles: true,
  });

  if (files.length === 0) {
    throw new Error(
      `No ${format} files found in ${path}. Patterns searched: ${patterns.join(', ')}`
    );
  }

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
