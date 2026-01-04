import { IacFormat, ParseResult, IacResource } from '../types.js';
import { readFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';

/**
 * Parse an IaC file and extract resources
 */
export async function parseIacFile(filePath: string, format?: string): Promise<ParseResult> {
  const content = await readFile(filePath, 'utf-8');
  
  // Auto-detect format if not provided
  const iacFormat = format ? (format as IacFormat) : detectFormat(filePath, content);

  switch (iacFormat) {
    case 'terraform':
      return parseTerraform(content, filePath);
    case 'pulumi':
      return parsePulumi(content, filePath);
    case 'cloudformation':
      return parseCloudFormation(content, filePath);
    default:
      throw new Error(`Unsupported IaC format: ${iacFormat}`);
  }
}

/**
 * Auto-detect IaC format from file path and content
 */
function detectFormat(filePath: string, content: string): IacFormat {
  const fileName = filePath.toLowerCase();
  
  // Detect by file extension
  if (fileName.endsWith('.tf') || fileName.endsWith('.tfvars')) {
    return 'terraform';
  }
  
  if (fileName.includes('pulumi') && (fileName.endsWith('.yaml') || fileName.endsWith('.yml'))) {
    return 'pulumi';
  }
  
  if (fileName.includes('cloudformation') || fileName.endsWith('.template.json') || 
      fileName.endsWith('.template.yaml') || fileName.endsWith('.template.yml')) {
    return 'cloudformation';
  }
  
  // Detect by content
  if (content.includes('resource "') || content.includes('provider "') || content.includes('terraform {')) {
    return 'terraform';
  }
  
  if (content.includes('AWSTemplateFormatVersion') || content.includes('Resources:')) {
    return 'cloudformation';
  }
  
  if (content.includes('runtime:') && content.includes('name:')) {
    return 'pulumi';
  }
  
  // Default to terraform as fallback
  return 'terraform';
}

/**
 * Parse Terraform HCL files
 * Enhanced parser - extracts resources, data sources with improved property extraction
 */
function parseTerraform(content: string, filePath: string): ParseResult {
  const resources: IacResource[] = [];

  // Find resource blocks
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

  // Find data blocks (treated as resources for validation)
  const dataRegex = /data\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
  while ((match = dataRegex.exec(content)) !== null) {
    const [, type, name] = match;
    const startLine = content.substring(0, match.index).split('\n').length;
    const startPos = match.index + match[0].length;

    const properties = extractTerraformProperties(content, startPos);

    resources.push({
      id: `data.${name}`,
      type: `data.${type}`,
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
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      i++;
      continue;
    }

    // Match arrays: key = [...]
    const arrayMatch = trimmed.match(/^(\w+)\s*=\s*\[/);
    if (arrayMatch) {
      const [, key] = arrayMatch;
      const arrayValue = extractArrayValue(blockContent, i, lines);
      properties[key] = arrayValue.value;
      i = arrayValue.nextIndex;
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
        const nestedKvMatch = nestedLine.match(/^(\w+)\s*=\s*(.+?)(?:\s*[#/].*)?$/);
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
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+?)(?:\s*[#/].*)?$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      properties[key] = parseValue(value.trim());
    }

    i++;
  }

  return properties;
}

/**
 * Extract array value from Terraform
 */
function extractArrayValue(
  _blockContent: string,
  startLine: number,
  lines: string[]
): { value: unknown[]; nextIndex: number } {
  let i = startLine;
  let bracketDepth = 0;
  let currentValue = '';

  // Find the opening bracket
  const startLineContent = lines[i];
  const bracketIndex = startLineContent.indexOf('[');
  if (bracketIndex !== -1) {
    currentValue = startLineContent.substring(bracketIndex + 1);
    bracketDepth = 1;
  }

  // If bracket closes on same line
  if (currentValue.includes(']')) {
    const closingIndex = currentValue.indexOf(']');
    const arrayContent = currentValue.substring(0, closingIndex);
    
    // Split by comma and parse values
    const values = arrayContent.split(',').map((v) => v.trim()).filter((v) => v);
    return {
      value: values.map((v) => parseValue(v)),
      nextIndex: i + 1,
    };
  }

  i++;

  // Multi-line array
  while (i < lines.length && bracketDepth > 0) {
    const line = lines[i].trim();
    
    if (line.includes('[')) bracketDepth++;
    if (line.includes(']')) {
      bracketDepth--;
      if (bracketDepth === 0) {
        const closingIndex = line.indexOf(']');
        currentValue += ' ' + line.substring(0, closingIndex);
        break;
      }
    }
    
    currentValue += ' ' + line;
    i++;
  }

  // Parse array content
  const values = currentValue
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v && v !== ']');
  
  return {
    value: values.map((v) => parseValue(v)),
    nextIndex: i + 1,
  };
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
