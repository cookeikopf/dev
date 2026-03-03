import { describe, it, expect } from 'vitest';
import {
  generateId,
  parseIdentityReference,
  isValidIdentityReference,
  createIdentityReference,
  createJsonRpcError,
  JsonRpcErrorCodes,
  createJsonRpcResponse,
  createJsonRpcErrorResponse,
  sanitizeForLogging,
  formatUsdcAmount,
  parseUsdcAmount,
  sleep,
  withRetry,
  deepMerge,
  getTimestamp,
  assertDefined,
} from '../src/utils/index.js';

describe('Utils', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should include timestamp', () => {
      const id = generateId();
      const timestamp = parseInt(id.split('-')[0]!);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
      expect(timestamp).toBeGreaterThan(Date.now() - 1000);
    });
  });

  describe('parseIdentityReference', () => {
    it('should parse valid identity reference', () => {
      const ref = 'eip155:84532/0x1234567890abcdef1234567890abcdef12345678';
      const result = parseIdentityReference(ref);
      expect(result.chainId).toBe('eip155:84532');
      expect(result.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
    });

    it('should normalize address to lowercase', () => {
      const ref = 'eip155:84532/0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const result = parseIdentityReference(ref);
      expect(result.address).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
    });

    it('should throw on invalid format', () => {
      expect(() => parseIdentityReference('invalid' as `eip155:${number}/${string}`)).toThrow();
      expect(() => parseIdentityReference('eip155:84532' as `eip155:${number}/${string}`)).toThrow();
      expect(() => parseIdentityReference('eip155:84532/invalid' as `eip155:${number}/${string}`)).toThrow();
    });
  });

  describe('isValidIdentityReference', () => {
    it('should return true for valid references', () => {
      expect(isValidIdentityReference('eip155:84532/0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
      expect(isValidIdentityReference('eip155:1/0x0000000000000000000000000000000000000000')).toBe(true);
    });

    it('should return false for invalid references', () => {
      expect(isValidIdentityReference('invalid')).toBe(false);
      expect(isValidIdentityReference('eip155:84532')).toBe(false);
      expect(isValidIdentityReference('')).toBe(false);
    });
  });

  describe('createIdentityReference', () => {
    it('should create valid identity reference', () => {
      const ref = createIdentityReference('eip155:84532', '0x1234567890abcdef1234567890abcdef12345678');
      expect(ref).toBe('eip155:84532/0x1234567890abcdef1234567890abcdef12345678');
    });

    it('should normalize address to lowercase', () => {
      const ref = createIdentityReference('eip155:84532', '0xABCDEF1234567890ABCDEF1234567890ABCDEF12');
      expect(ref).toBe('eip155:84532/0xabcdef1234567890abcdef1234567890abcdef12');
    });

    it('should throw on invalid address', () => {
      expect(() => createIdentityReference('eip155:84532', 'invalid')).toThrow();
      expect(() => createIdentityReference('eip155:84532', '0x123')).toThrow();
    });
  });

  describe('createJsonRpcError', () => {
    it('should create error object', () => {
      const error = createJsonRpcError(-32600, 'Invalid request');
      expect(error.code).toBe(-32600);
      expect(error.message).toBe('Invalid request');
    });

    it('should include data when provided', () => {
      const error = createJsonRpcError(-32600, 'Invalid request', { detail: 'test' });
      expect(error.data).toEqual({ detail: 'test' });
    });

    it('should not include data when undefined', () => {
      const error = createJsonRpcError(-32600, 'Invalid request', undefined);
      expect(error.data).toBeUndefined();
    });
  });

  describe('JsonRpcErrorCodes', () => {
    it('should have standard error codes', () => {
      expect(JsonRpcErrorCodes.PARSE_ERROR).toBe(-32700);
      expect(JsonRpcErrorCodes.INVALID_REQUEST).toBe(-32600);
      expect(JsonRpcErrorCodes.METHOD_NOT_FOUND).toBe(-32601);
      expect(JsonRpcErrorCodes.INVALID_PARAMS).toBe(-32602);
      expect(JsonRpcErrorCodes.INTERNAL_ERROR).toBe(-32603);
    });
  });

  describe('createJsonRpcResponse', () => {
    it('should create success response', () => {
      const response = createJsonRpcResponse('1', { result: 'test' });
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('1');
      expect(response.result).toEqual({ result: 'test' });
    });

    it('should handle null id', () => {
      const response = createJsonRpcResponse(null, { result: 'test' });
      expect(response.id).toBeNull();
    });
  });

  describe('createJsonRpcErrorResponse', () => {
    it('should create error response', () => {
      const error = createJsonRpcError(-32600, 'Invalid request');
      const response = createJsonRpcErrorResponse('1', error);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('1');
      expect(response.error).toEqual(error);
      expect(response.result).toBeUndefined();
    });
  });

  describe('sanitizeForLogging', () => {
    it('should pass through primitives', () => {
      expect(sanitizeForLogging('test')).toBe('test');
      expect(sanitizeForLogging(123)).toBe(123);
      expect(sanitizeForLogging(null)).toBeNull();
      expect(sanitizeForLogging(undefined)).toBeUndefined();
    });

    it('should sanitize sensitive keys', () => {
      const input = {
        username: 'test',
        password: 'secret123',
        apiKey: 'key123',
        token: 'token123',
        nested: {
          secret: 'nestedSecret',
        },
      };
      const result = sanitizeForLogging(input) as Record<string, unknown>;
      expect(result.username).toBe('test');
      expect(result.password).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect((result.nested as Record<string, unknown>).secret).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const input = [
        { password: 'secret1' },
        { password: 'secret2' },
      ];
      const result = sanitizeForLogging(input) as Array<Record<string, unknown>>;
      expect(result[0]!.password).toBe('[REDACTED]');
      expect(result[1]!.password).toBe('[REDACTED]');
    });
  });

  describe('formatUsdcAmount', () => {
    it('should format USDC amount correctly', () => {
      expect(formatUsdcAmount(1000000)).toBe('1.000000');
      expect(formatUsdcAmount(500000)).toBe('0.500000');
      expect(formatUsdcAmount(1234567)).toBe('1.234567');
    });
  });

  describe('parseUsdcAmount', () => {
    it('should parse USDC amount correctly', () => {
      expect(parseUsdcAmount(1)).toBe(1000000);
      expect(parseUsdcAmount(0.5)).toBe(500000);
      expect(parseUsdcAmount(1.234567)).toBe(1234567);
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });

  describe('withRetry', () => {
    it('should return result on success', async () => {
      const fn = async () => 'success';
      const result = await withRetry(fn);
      expect(result).toBe('success');
    });

    it('should retry on failure', async () => {
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
      await expect(withRetry(fn, { maxRetries: 2, delayMs: 10 })).rejects.toThrow('always fails');
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) throw new Error('fail');
        return 'success';
      };
      await withRetry(fn, { maxRetries: 2, delayMs: 10, onRetry });
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('deepMerge', () => {
    it('should merge objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      const result = deepMerge(target, source);
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should deeply merge nested objects', () => {
      const target = { a: { x: 1 }, b: 2 };
      const source = { a: { y: 2 }, c: 3 };
      const result = deepMerge(target, source);
      expect(result).toEqual({ a: { x: 1, y: 2 }, b: 2, c: 3 });
    });

    it('should handle multiple sources', () => {
      const result = deepMerge({ a: 1 }, { b: 2 }, { c: 3 });
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should not mutate target', () => {
      const target = { a: 1 };
      const result = deepMerge(target, { b: 2 });
      expect(target).toEqual({ a: 1 });
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe('getTimestamp', () => {
    it('should return ISO timestamp', () => {
      const timestamp = getTimestamp();
      expect(typeof timestamp).toBe('string');
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('assertDefined', () => {
    it('should return value if defined', () => {
      expect(assertDefined('test', 'message')).toBe('test');
      expect(assertDefined(0, 'message')).toBe(0);
      expect(assertDefined(false, 'message')).toBe(false);
    });

    it('should throw if null', () => {
      expect(() => assertDefined(null, 'value is required')).toThrow('value is required');
    });

    it('should throw if undefined', () => {
      expect(() => assertDefined(undefined, 'value is required')).toThrow('value is required');
    });
  });
});

// Mock for vi.fn
const vi = {
  fn: () => {
    const calls: unknown[][] = [];
    const mockFn = (...args: unknown[]) => {
      calls.push(args);
    };
    mockFn.mock = { calls };
    return mockFn;
  },
};
