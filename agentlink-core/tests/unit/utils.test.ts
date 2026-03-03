/**
 * AgentLink Core - Utility Functions Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateId,
  generateUUID,
  parseIdentityReference,
  isValidIdentityReference,
  createIdentityReference,
  formatUsdcAmount,
  parseUsdcAmount,
  sanitizeForLogging,
  withRetry,
  sleep,
  deepMerge,
  pick,
  omit,
  isNonEmptyString,
  isPositiveNumber,
  isValidEthereumAddress,
  isValidUrl,
} from '../../src/utils/index.js';

describe('Utility Functions', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with correct format', () => {
      const id = generateId();
      expect(id).toMatch(/^\w+-\w+$/);
    });

    it('should generate IDs with timestamp component', () => {
      const before = Date.now();
      const id = generateId();
      const after = Date.now();

      const timestampPart = parseInt(id.split('-')[0], 36);
      expect(timestampPart).toBeGreaterThanOrEqual(before);
      expect(timestampPart).toBeLessThanOrEqual(after + 1000);
    });
  });

  describe('generateUUID', () => {
    it('should generate valid UUID v4 format', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should generate unique UUIDs', () => {
      const uuids = new Set();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      expect(uuids.size).toBe(100);
    });
  });

  describe('parseIdentityReference', () => {
    it('should parse valid identity reference', () => {
      const result = parseIdentityReference(
        'eip155:84532/0x1234567890123456789012345678901234567890'
      );

      expect(result.chainNamespace).toBe('eip155');
      expect(result.chainId).toBe(84532);
      expect(result.address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should normalize address to lowercase', () => {
      const result = parseIdentityReference(
        'eip155:1/0xABCDEF1234567890ABCDEF1234567890ABCDEF12'
      );

      expect(result.address).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
    });

    it('should throw error for invalid format', () => {
      expect(() => parseIdentityReference('invalid')).toThrow(
        'Invalid identity reference format'
      );
    });

    it('should throw error for missing chain namespace', () => {
      expect(() =>
        parseIdentityReference('84532/0x1234567890123456789012345678901234567890')
      ).toThrow('Invalid identity reference format');
    });

    it('should throw error for invalid chain ID', () => {
      expect(() =>
        parseIdentityReference('eip155:abc/0x1234567890123456789012345678901234567890')
      ).toThrow('Invalid identity reference format');
    });

    it('should throw error for invalid address', () => {
      expect(() =>
        parseIdentityReference('eip155:1/0xinvalid')
      ).toThrow('Invalid identity reference format');
    });
  });

  describe('isValidIdentityReference', () => {
    it('should return true for valid reference', () => {
      expect(
        isValidIdentityReference('eip155:84532/0x1234567890123456789012345678901234567890')
      ).toBe(true);
    });

    it('should return false for invalid reference', () => {
      expect(isValidIdentityReference('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidIdentityReference('')).toBe(false);
    });
  });

  describe('createIdentityReference', () => {
    it('should create valid identity reference', () => {
      const result = createIdentityReference(
        'eip155',
        84532,
        '0x1234567890123456789012345678901234567890'
      );

      expect(result).toBe('eip155:84532/0x1234567890123456789012345678901234567890');
    });

    it('should normalize address to lowercase', () => {
      const result = createIdentityReference(
        'eip155',
        1,
        '0xABCDEF1234567890ABCDEF1234567890ABCDEF12'
      );

      expect(result).toBe('eip155:1/0xabcdef1234567890abcdef1234567890abcdef12');
    });
  });

  describe('formatUsdcAmount', () => {
    it('should format whole USDC', () => {
      expect(formatUsdcAmount(1000000)).toBe('1.000000');
    });

    it('should format fractional USDC', () => {
      expect(formatUsdcAmount(1500000)).toBe('1.500000');
    });

    it('should format small amounts', () => {
      expect(formatUsdcAmount(1)).toBe('0.000001');
    });

    it('should format zero', () => {
      expect(formatUsdcAmount(0)).toBe('0.000000');
    });

    it('should handle bigint', () => {
      expect(formatUsdcAmount(BigInt(1000000))).toBe('1.000000');
    });

    it('should format large amounts', () => {
      expect(formatUsdcAmount(1000000000000)).toBe('1000000.000000');
    });
  });

  describe('parseUsdcAmount', () => {
    it('should parse whole USDC', () => {
      expect(parseUsdcAmount(1)).toBe(1000000);
    });

    it('should parse fractional USDC', () => {
      expect(parseUsdcAmount(1.5)).toBe(1500000);
    });

    it('should parse small amounts', () => {
      expect(parseUsdcAmount(0.000001)).toBe(1);
    });

    it('should parse zero', () => {
      expect(parseUsdcAmount(0)).toBe(0);
    });
  });

  describe('sanitizeForLogging', () => {
    it('should redact sensitive keys', () => {
      const input = {
        username: 'test',
        password: 'secret123',
        apiKey: 'key123',
        data: 'safe',
      };

      const result = sanitizeForLogging(input);

      expect(result.username).toBe('test');
      expect(result.password).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.data).toBe('safe');
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: 'test',
          password: 'secret',
        },
        token: 'abc123',
      };

      const result = sanitizeForLogging(input);

      expect(result.user.name).toBe('test');
      expect(result.user.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
    });

    it('should handle custom sensitive keys', () => {
      const input = {
        customSecret: 'value',
        normal: 'data',
      };

      const result = sanitizeForLogging(input, ['customsecret']);

      expect(result.customSecret).toBe('[REDACTED]');
      expect(result.normal).toBe('data');
    });

    it('should handle null values', () => {
      const input = {
        data: null,
        password: 'secret',
      };

      const result = sanitizeForLogging(input);

      expect(result.data).toBeNull();
      expect(result.password).toBe('[REDACTED]');
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const fn = async () => 'success';
      const result = await withRetry(fn);
      expect(result).toBe('success');
    });

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'success';
      };

      const result = await withRetry(fn, { maxRetries: 3, delayMs: 10 });
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max retries', async () => {
      const fn = async () => {
        throw new Error('always fails');
      };

      await expect(
        withRetry(fn, { maxRetries: 2, delayMs: 10 })
      ).rejects.toThrow('always fails');
    });

    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      let lastTime = Date.now();

      const fn = async () => {
        const now = Date.now();
        delays.push(now - lastTime);
        lastTime = now;
        throw new Error('fail');
      };

      try {
        await withRetry(fn, { maxRetries: 3, delayMs: 50, backoffMultiplier: 2 });
      } catch {
        // Expected
      }

      // First attempt has no delay
      expect(delays[0]).toBeLessThan(10);
      // Second attempt should have ~50ms delay
      expect(delays[1]).toBeGreaterThanOrEqual(40);
      // Third attempt should have ~100ms delay
      expect(delays[2]).toBeGreaterThanOrEqual(80);
    });

    it('should not retry non-retryable errors', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        throw new Error('non-retryable');
      };

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          delayMs: 10,
          retryableErrors: ['retryable'],
        })
      ).rejects.toThrow('non-retryable');

      expect(attempts).toBe(1);
    });
  });

  describe('sleep', () => {
    it('should delay for specified time', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });

  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const result = deepMerge({ a: 1 }, { b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should override existing keys', () => {
      const result = deepMerge({ a: 1 }, { a: 2 });
      expect(result).toEqual({ a: 2 });
    });

    it('should deep merge nested objects', () => {
      const result = deepMerge(
        { a: { b: 1, c: 2 } },
        { a: { c: 3, d: 4 } }
      );
      expect(result).toEqual({ a: { b: 1, c: 3, d: 4 } });
    });

    it('should not merge arrays', () => {
      const result = deepMerge({ a: [1, 2] }, { a: [3, 4] });
      expect(result).toEqual({ a: [3, 4] });
    });

    it('should handle null values', () => {
      const result = deepMerge({ a: 1 }, { a: null });
      expect(result).toEqual({ a: null });
    });
  });

  describe('pick', () => {
    it('should pick specified keys', () => {
      const result = pick({ a: 1, b: 2, c: 3 }, ['a', 'c']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should return empty object for no keys', () => {
      const result = pick({ a: 1, b: 2 }, []);
      expect(result).toEqual({});
    });
  });

  describe('omit', () => {
    it('should omit specified keys', () => {
      const result = omit({ a: 1, b: 2, c: 3 }, ['b']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should return same object for no keys', () => {
      const input = { a: 1, b: 2 };
      const result = omit(input, []);
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty string', () => {
      expect(isNonEmptyString('hello')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isNonEmptyString('')).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('should return true for positive number', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.5)).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isPositiveNumber(0)).toBe(false);
    });

    it('should return false for negative number', () => {
      expect(isPositiveNumber(-1)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isPositiveNumber(NaN)).toBe(false);
    });

    it('should return false for non-number', () => {
      expect(isPositiveNumber('1')).toBe(false);
    });
  });

  describe('isValidEthereumAddress', () => {
    it('should return true for valid address', () => {
      expect(
        isValidEthereumAddress('0x1234567890123456789012345678901234567890')
      ).toBe(true);
    });

    it('should return true for mixed case', () => {
      expect(
        isValidEthereumAddress('0xAbCdEf1234567890123456789012345678901234')
      ).toBe(true);
    });

    it('should return false for invalid length', () => {
      expect(isValidEthereumAddress('0x123')).toBe(false);
    });

    it('should return false for missing 0x', () => {
      expect(isValidEthereumAddress('1234567890123456789012345678901234567890')).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(isValidEthereumAddress(123)).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('should return false for invalid URL', () => {
      expect(isValidUrl('not a url')).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(isValidUrl(123)).toBe(false);
    });
  });
});
