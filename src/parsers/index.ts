import { IacFormat, ParseResult, IacResource } from '../types.js';
import { readFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';

/**
 * Parse an IaC file and extract resources
 */
export async function parseIacFile(filePath: string, format: string): Promise<ParseResult> {
  const content = await readFile(filePath, 'utf-8');
  const iacFormat = format as IacFormat;

  switch (iacFormat) {
    case 'terraform':
      return parseTerraform(content, filePath);
    case 'pulumi':
      return parsePulumi(content, filePath);
    case 'cloudformation':
      return parseCloudFormation(content, filePath);
    default:
      throw new Error(`Unsupported IaC format: ${format}`);
  }
}

/**
 * Parse Terraform HCL files
 * Simplified parser - extracts resources with key properties
 */
function parseTerraform(content: string, filePath: string): ParseResult {
  const resources: IacResource[] = [];

  // Find resource blocks with enhanced property extraction
  const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
  let match;

  while ((match = resourceRegex.exec(content)) !== null) {
    const [, type, name] = match;
    const startLine = content.substring(0, match.index).split('\n').length;
    const startPos = match.index + match[0].length;

    // Extract properties from the resource block
    const properties = extractTerraformProperties(content, startPos);

    resources.push({
      id: name,
      type,
      properties,
      location: {
        file: filePath,
        line: startLine,
      },
    });
  }

  return {
    format: 'terraform',
    resources,
    metadata: {},
  };
}

/**
 * Extract properties from a Terraform resource block
 */
function extractTerraformProperties(content: string, startPos: number): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  let braceDepth = 1;
  let currentPos = startPos;
  let blockContent = '';

  // Extract content until matching closing brace
  while (braceDepth > 0 && currentPos < content.length) {
    const char = content[currentPos];
    if (char === '{') braceDepth++;
    if (char === '}') braceDepth--;
    if (braceDepth > 0) blockContent += char;
    currentPos++;
  }

  // Parse line by line
  const lines = blockContent.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    // Match nested blocks like: tags { ... } or tags = { ... }
    const blockMatch = trimmed.match(/^(\w+)\s*=?\s*\{/);
    if (blockMatch) {
      const [, key] = blockMatch;
      const nestedBlock: Record<string, unknown> = {};
      i++;

      // Parse content inside the nested block
      let nestedBraceDepth = 1;
      while (i < lines.length && nestedBraceDepth > 0) {
        const nestedLine = lines[i].trim();

        if (nestedLine.includes('{')) nestedBraceDepth++;
        if (nestedLine.includes('}')) {
          nestedBraceDepth--;
          if (nestedBraceDepth === 0) break;
        }

        // Parse key = value in nested block
        const nestedKvMatch = nestedLine.match(/^(\w+)\s*=\s*(.+?)(?:\s*#.*)?$/);
        if (nestedKvMatch) {
          const [, nestedKey, nestedValue] = nestedKvMatch;
          nestedBlock[nestedKey] = parseValue(nestedValue.trim());
        }

        i++;
      }

      properties[key] = nestedBlock;
      i++;
      continue;
    }

    // Match: key = value or key = "value"
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+?)(?:\s*#.*)?$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      properties[key] = parseValue(value.trim());
    }

    i++;
  }

  return properties;
}

/**
 * Parse a Terraform value (string, number, boolean)
 */
function parseValue(value: string): unknown {
  // Remove quotes from strings
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  // Parse booleans
  if (value === 'true') return true;
  if (value === 'false') return false;
  // Parse numbers
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  // Return as string for other cases
  return value;
}

/**
 * Parse Pulumi YAML configuration
 */
function parsePulumi(content: string, filePath: string): ParseResult {
  let config: unknown;

  try {
    config = parseYaml(content);
  } catch (error) {
    throw new Error(
      `Failed to parse Pulumi configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const resources: IacResource[] = [];

  // Pulumi YAML resources are under "resources" key
  if (
    config &&
    typeof config === 'object' &&
    'resources' in config &&
    config.resources &&
    typeof config.resources === 'object'
  ) {
    for (const [resourceId, resourceDef] of Object.entries(config.resources)) {
      const resource = resourceDef as Record<string, unknown>;

      resources.push({
        id: resourceId,
        type: typeof resource.type === 'string' ? resource.type : 'Unknown',
        properties:
          resource.properties && typeof resource.properties === 'object'
            ? (resource.properties as Record<string, unknown>)
            : {},
        location: {
          file: filePath,
        },
      });
    }
  }

  const configObj = config as Record<string, unknown>;
  return {
    format: 'pulumi',
    resources,
    metadata: {
      version: configObj && typeof configObj.version === 'string' ? configObj.version : undefined,
    },
  };
}

/**
 * Parse CloudFormation templates (JSON or YAML)
 */
function parseCloudFormation(content: string, filePath: string): ParseResult {
  let template: unknown;

  try {
    // Try JSON first
    template = JSON.parse(content) as unknown;
  } catch {
    // Fall back to YAML
    try {
      template = parseYaml(content);
    } catch (error) {
      throw new Error(
        `Failed to parse CloudFormation template: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const resources: IacResource[] = [];

  // CloudFormation resources are under "Resources" key
  if (
    template &&
    typeof template === 'object' &&
    'Resources' in template &&
    template.Resources &&
    typeof template.Resources === 'object'
  ) {
    for (const [resourceId, resourceDef] of Object.entries(template.Resources)) {
      const resource = resourceDef as Record<string, unknown>;

      resources.push({
        id: resourceId,
        type: typeof resource.Type === 'string' ? resource.Type : 'Unknown',
        properties:
          resource.Properties && typeof resource.Properties === 'object'
            ? (resource.Properties as Record<string, unknown>)
            : {},
        location: {
          file: filePath,
        },
      });
    }
  }

  const templateObj = template as Record<string, unknown>;
  return {
    format: 'cloudformation',
    resources,
    metadata: {
      version:
        templateObj && typeof templateObj.AWSTemplateFormatVersion === 'string'
          ? templateObj.AWSTemplateFormatVersion
          : undefined,
    },
  };
}
