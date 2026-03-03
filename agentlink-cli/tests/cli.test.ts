import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('AgentLink CLI Integration', () => {
  let tempDir: string;
  let cliPath: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlink-cli-test-'));
    cliPath = path.resolve(process.cwd(), 'dist/index.js');
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  describe('CLI Help', () => {
    it('should display help', () => {
      const output = execSync(`node ${cliPath} --help`, { encoding: 'utf-8' });
      expect(output).toContain('agentlink');
      expect(output).toContain('create');
      expect(output).toContain('dev');
      expect(output).toContain('identity');
      expect(output).toContain('deploy');
      expect(output).toContain('generate-badge');
    });

    it('should display version', () => {
      const output = execSync(`node ${cliPath} --version`, { encoding: 'utf-8' });
      expect(output.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('Create Command', () => {
    it('should show create help', () => {
      const output = execSync(`node ${cliPath} create --help`, { encoding: 'utf-8' });
      expect(output).toContain('Scaffold');
      expect(output).toContain('project-name');
    });
  });

  describe('Dev Command', () => {
    it('should show dev help', () => {
      const output = execSync(`node ${cliPath} dev --help`, { encoding: 'utf-8' });
      expect(output).toContain('development server');
      expect(output).toContain('--port');
    });
  });

  describe('Identity Command', () => {
    it('should show identity help', () => {
      const output = execSync(`node ${cliPath} identity --help`, { encoding: 'utf-8' });
      expect(output).toContain('mint');
      expect(output).toContain('info');
      expect(output).toContain('update');
    });

    it('should show identity mint help', () => {
      const output = execSync(`node ${cliPath} identity mint --help`, { encoding: 'utf-8' });
      expect(output).toContain('ERC-8004');
      expect(output).toContain('--key');
    });
  });

  describe('Deploy Command', () => {
    it('should show deploy help', () => {
      const output = execSync(`node ${cliPath} deploy --help`, { encoding: 'utf-8' });
      expect(output).toContain('deploy');
      expect(output).toContain('--platform');
    });
  });

  describe('Generate Badge Command', () => {
    it('should show generate-badge help', () => {
      const output = execSync(`node ${cliPath} generate-badge --help`, { encoding: 'utf-8' });
      expect(output).toContain('badge');
      expect(output).toContain('--format');
    });
  });
});

describe('CLI Error Handling', () => {
  let tempDir: string;
  let cliPath: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlink-cli-error-'));
    cliPath = path.resolve(process.cwd(), 'dist/index.js');
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  it('should handle invalid commands gracefully', () => {
    try {
      execSync(`node ${cliPath} invalid-command`, { encoding: 'utf-8' });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.status).not.toBe(0);
    }
  });
});
