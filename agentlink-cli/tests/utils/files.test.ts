import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  ensureDir,
  writeFile,
  fileExists,
  readJson,
  writeJson,
  loadEnvFile,
  formatBytes,
  formatDuration
} from '../../src/utils/files.js';

describe('File Utilities', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlink-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('ensureDir', () => {
    it('should create directory if it does not exist', async () => {
      const newDir = path.join(tempDir, 'new-directory');
      await ensureDir(newDir);
      const exists = await fs.pathExists(newDir);
      expect(exists).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      const existingDir = path.join(tempDir, 'existing');
      await fs.ensureDir(existingDir);
      await expect(ensureDir(existingDir)).resolves.not.toThrow();
    });
  });

  describe('writeFile', () => {
    it('should write file content', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Hello, World!';
      
      await writeFile(filePath, content);
      
      const readContent = await fs.readFile(filePath, 'utf-8');
      expect(readContent).toBe(content);
    });

    it('should create parent directories', async () => {
      const filePath = path.join(tempDir, 'nested', 'deep', 'file.txt');
      
      await writeFile(filePath, 'content');
      
      const exists = await fs.pathExists(filePath);
      expect(exists).toBe(true);
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = path.join(tempDir, 'exists.txt');
      await fs.writeFile(filePath, 'content');
      
      const exists = await fileExists(filePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const filePath = path.join(tempDir, 'does-not-exist.txt');
      
      const exists = await fileExists(filePath);
      expect(exists).toBe(false);
    });
  });

  describe('readJson', () => {
    it('should read and parse JSON file', async () => {
      const filePath = path.join(tempDir, 'config.json');
      const data = { name: 'test', version: '1.0.0' };
      await fs.writeJson(filePath, data);
      
      const result = await readJson(filePath);
      expect(result).toEqual(data);
    });

    it('should return null for non-existing file', async () => {
      const filePath = path.join(tempDir, 'non-existing.json');
      
      const result = await readJson(filePath);
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      const filePath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(filePath, 'not valid json');
      
      const result = await readJson(filePath);
      expect(result).toBeNull();
    });
  });

  describe('writeJson', () => {
    it('should write JSON with formatting', async () => {
      const filePath = path.join(tempDir, 'data.json');
      const data = { key: 'value', nested: { a: 1 } };
      
      await writeJson(filePath, data);
      
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('"key": "value"');
      expect(content).toContain('{\n');
    });
  });

  describe('loadEnvFile', () => {
    it('should parse env file correctly', async () => {
      const envPath = path.join(tempDir, '.env');
      const envContent = `
PORT=3000
NODE_ENV=development
API_KEY=secret123
# This is a comment
EMPTY_VAR=
QUOTED="value with spaces"
`;
      await fs.writeFile(envPath, envContent);
      
      const env = await loadEnvFile(envPath);
      
      expect(env.PORT).toBe('3000');
      expect(env.NODE_ENV).toBe('development');
      expect(env.API_KEY).toBe('secret123');
      expect(env.QUOTED).toBe('value with spaces');
    });

    it('should return empty object for non-existing file', async () => {
      const envPath = path.join(tempDir, 'non-existing.env');
      
      const env = await loadEnvFile(envPath);
      expect(env).toEqual({});
    });
  });
});

describe('Format Utilities', () => {
  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(90000)).toBe('1.5m');
    });
  });
});
