import { createHash } from 'crypto';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ParsedIacFile } from '../types.js';

/**
 * Simple file-based cache for parsed IaC files
 * Uses content hash to detect changes
 */
export class IacFileCache {
  private cacheDir: string;
  private enabled: boolean;

  constructor(enabled = true) {
    this.cacheDir = join(tmpdir(), 'gce-cache');
    this.enabled = enabled;
  }

  /**
   * Get cached parse result if available and fresh
   */
  async get(filePath: string): Promise<ParsedIacFile | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const hash = this.hashContent(content);
      const cacheKey = this.getCacheKey(filePath, hash);
      const cachePath = join(this.cacheDir, cacheKey);

      // Check if cache file exists and is valid
      const cachedContent = await readFile(cachePath, 'utf-8');
      const cached = JSON.parse(cachedContent) as ParsedIacFile;

      // Verify hash matches
      if (cached.metadata.contentHash === hash) {
        return cached;
      }

      return null;
    } catch {
      // Cache miss or error reading cache
      return null;
    }
  }

  /**
   * Store parsed result in cache
   */
  async set(filePath: string, parsed: ParsedIacFile): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const hash = this.hashContent(content);

      // Add hash to metadata
      const cachedData = {
        ...parsed,
        metadata: {
          ...parsed.metadata,
          contentHash: hash,
        },
      };

      const cacheKey = this.getCacheKey(filePath, hash);
      const cachePath = join(this.cacheDir, cacheKey);

      // Ensure cache directory exists
      await mkdir(this.cacheDir, { recursive: true });

      // Write cache file
      await writeFile(cachePath, JSON.stringify(cachedData), 'utf-8');
    } catch {
      // Silently fail on cache write errors
    }
  }

  /**
   * Check if file has been modified since last cache
   */
  async isStale(filePath: string, cached: ParsedIacFile): Promise<boolean> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const currentHash = this.hashContent(content);
      return cached.metadata.contentHash !== currentHash;
    } catch {
      return true;
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    // TODO: Implement cache clearing
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ size: number; fileCount: number }> {
    try {
      await stat(this.cacheDir);
      // TODO: Calculate actual cache size and file count
      return { size: 0, fileCount: 0 };
    } catch {
      return { size: 0, fileCount: 0 };
    }
  }

  /**
   * Generate content hash
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Generate cache key from file path and hash
   */
  private getCacheKey(filePath: string, hash: string): string {
    const pathHash = createHash('sha256').update(filePath).digest('hex').substring(0, 16);
    return `${pathHash}-${hash}.json`;
  }
}

/**
 * Global cache instance
 */
export const iacCache = new IacFileCache();
