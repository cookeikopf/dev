import { describe, it, expect } from 'vitest';
import { 
  validateProjectName, 
  validateEndpointPath,
  checkGitInstallation 
} from '../../src/utils/checks.js';

describe('validateProjectName', () => {
  it('should accept valid project names', () => {
    const validNames = [
      'my-agent',
      'my_agent',
      'myAgent',
      'agent123',
      '@scope/agent',
      'a'
    ];

    for (const name of validNames) {
      const result = validateProjectName(name);
      expect(result.valid, `Expected "${name}" to be valid`).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it('should reject invalid project names', () => {
    const invalidNames = [
      { name: '', error: 'Project name is required' },
      { name: '  ', error: 'Project name is required' },
      { name: 'my agent', error: 'Invalid project name' },
      { name: 'my@agent', error: 'Invalid project name' },
      { name: '-agent', error: 'Invalid project name' },
      { name: '_agent', error: 'Invalid project name' }
    ];

    for (const { name, error } of invalidNames) {
      const result = validateProjectName(name);
      expect(result.valid, `Expected "${name}" to be invalid`).toBe(false);
      expect(result.error).toBeDefined();
    }
  });

  it('should reject names that are too long', () => {
    const longName = 'a'.repeat(215);
    const result = validateProjectName(longName);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('214');
  });
});

describe('validateEndpointPath', () => {
  it('should accept valid endpoint paths', () => {
    const validPaths = [
      '/chat',
      '/api/v1/chat',
      '/tools/list',
      '/premium-features',
      '/v1/test_endpoint'
    ];

    for (const path of validPaths) {
      const result = validateEndpointPath(path);
      expect(result.valid, `Expected "${path}" to be valid`).toBe(true);
    }
  });

  it('should reject invalid endpoint paths', () => {
    const invalidPaths = [
      { path: 'chat', error: 'must start with "/"' },
      { path: '/chat with spaces', error: 'invalid characters' },
      { path: '/chat@special', error: 'invalid characters' },
      { path: '', error: 'must start with "/"' }
    ];

    for (const { path, error } of invalidPaths) {
      const result = validateEndpointPath(path);
      expect(result.valid, `Expected "${path}" to be invalid`).toBe(false);
      expect(result.error?.toLowerCase()).toContain(error);
    }
  });
});

describe('checkGitInstallation', () => {
  it('should return a boolean', () => {
    const result = checkGitInstallation();
    expect(typeof result).toBe('boolean');
  });
});
