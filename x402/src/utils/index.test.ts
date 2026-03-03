/**
 * Tests for x402 utilities
 */

import {
  usdToAtomic,
  atomicToUsd,
  generatePaymentId,
  generateReceiptId,
  nowSeconds,
  isExpired,
  calculateExpiry,
  encodeBase64,
  decodeBase64,
  validatePaymentPayload,
  validatePaymentAgainstRequirements,
  extractPaymentSignature,
  createPaymentRequiredHeaders,
  createPaymentResponseHeaders,
  parseChainId,
  getEvmChainId,
  withRetry,
  X402Error,
  X402ErrorCode,
} from './index';
import { PaymentPayload, PaymentRequirements, SupportedNetworks } from '../types';

describe('Utils', () => {
  describe('usdToAtomic', () => {
    it('should convert USD to atomic units', () => {
      expect(usdToAtomic(0.01)).toBe('10000');
      expect(usdToAtomic(1)).toBe('1000000');
      expect(usdToAtomic(0.001)).toBe('1000');
    });

    it('should handle custom decimals', () => {
      expect(usdToAtomic(0.01, 18)).toBe('10000000000000000');
    });
  });

  describe('atomicToUsd', () => {
    it('should convert atomic units to USD', () => {
      expect(atomicToUsd('10000')).toBe(0.01);
      expect(atomicToUsd('1000000')).toBe(1);
      expect(atomicToUsd('1000')).toBe(0.001);
    });

    it('should handle custom decimals', () => {
      expect(atomicToUsd('10000000000000000', 18)).toBe(0.01);
    });
  });

  describe('generatePaymentId', () => {
    it('should generate unique IDs', () => {
      const id1 = generatePaymentId();
      const id2 = generatePaymentId();
      expect(id1).not.toBe(id2);
    });

    it('should be a string', () => {
      const id = generatePaymentId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('generateReceiptId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateReceiptId();
      const id2 = generateReceiptId();
      expect(id1).not.toBe(id2);
    });

    it('should start with receipt-', () => {
      const id = generateReceiptId();
      expect(id.startsWith('receipt-')).toBe(true);
    });
  });

  describe('nowSeconds', () => {
    it('should return current time in seconds', () => {
      const before = Math.floor(Date.now() / 1000);
      const now = nowSeconds();
      const after = Math.floor(Date.now() / 1000);

      expect(now).toBeGreaterThanOrEqual(before);
      expect(now).toBeLessThanOrEqual(after);
    });
  });

  describe('isExpired', () => {
    it('should return true for past timestamps', () => {
      const past = nowSeconds() - 100;
      expect(isExpired(past)).toBe(true);
    });

    it('should return false for future timestamps', () => {
      const future = nowSeconds() + 100;
      expect(isExpired(future)).toBe(false);
    });
  });

  describe('calculateExpiry', () => {
    it('should calculate expiry correctly', () => {
      const timeout = 60;
      const expiry = calculateExpiry(timeout);
      const expected = nowSeconds() + timeout;

      expect(expiry).toBe(expected);
    });
  });

  describe('encodeBase64 / decodeBase64', () => {
    it('should encode and decode objects', () => {
      const obj = { test: 'value', number: 123 };
      const encoded = encodeBase64(obj);
      const decoded = decodeBase64<typeof obj>(encoded);

      expect(decoded).toEqual(obj);
    });

    it('should handle complex objects', () => {
      const obj = {
        nested: { key: 'value' },
        array: [1, 2, 3],
        bool: true,
        null: null,
      };
      const encoded = encodeBase64(obj);
      const decoded = decodeBase64<typeof obj>(encoded);

      expect(decoded).toEqual(obj);
    });

    it('should throw on invalid base64', () => {
      expect(() => decodeBase64('invalid!!!')).toThrow(X402Error);
    });
  });

  describe('validatePaymentPayload', () => {
    it('should return true for valid payload', () => {
      const payload: PaymentPayload = {
        scheme: 'exact',
        network: 'eip155:84532',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        paymentId: 'test-id',
        authorizedAt: 1234567890,
        expiresAt: 1234567950,
        from: '0x1234567890123456789012345678901234567890',
        signature: '0xsignature',
      };

      expect(validatePaymentPayload(payload)).toBe(true);
    });

    it('should return false for missing fields', () => {
      const payload = {
        scheme: 'exact',
        // missing other fields
      };

      expect(validatePaymentPayload(payload)).toBe(false);
    });

    it('should return false for null', () => {
      expect(validatePaymentPayload(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(validatePaymentPayload('string')).toBe(false);
    });
  });

  describe('validatePaymentAgainstRequirements', () => {
    const requirements: PaymentRequirements = {
      scheme: 'exact',
      network: 'eip155:84532',
      amount: '10000',
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
      maxTimeoutSeconds: 60,
    };

    it('should validate matching payload', () => {
      const payload: PaymentPayload = {
        scheme: 'exact',
        network: 'eip155:84532',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        paymentId: 'test-id',
        authorizedAt: nowSeconds(),
        expiresAt: nowSeconds() + 60,
        from: '0x1234567890123456789012345678901234567890',
        signature: '0xsignature',
      };

      const result = validatePaymentAgainstRequirements(payload, requirements);
      expect(result.valid).toBe(true);
    });

    it('should fail on scheme mismatch', () => {
      const payload: PaymentPayload = {
        scheme: 'upto' as any,
        network: 'eip155:84532',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        paymentId: 'test-id',
        authorizedAt: nowSeconds(),
        expiresAt: nowSeconds() + 60,
        from: '0x1234567890123456789012345678901234567890',
        signature: '0xsignature',
      };

      const result = validatePaymentAgainstRequirements(payload, requirements);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Scheme mismatch');
    });

    it('should fail on network mismatch', () => {
      const payload: PaymentPayload = {
        scheme: 'exact',
        network: 'eip155:1',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        paymentId: 'test-id',
        authorizedAt: nowSeconds(),
        expiresAt: nowSeconds() + 60,
        from: '0x1234567890123456789012345678901234567890',
        signature: '0xsignature',
      };

      const result = validatePaymentAgainstRequirements(payload, requirements);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Network mismatch');
    });

    it('should fail on insufficient amount', () => {
      const payload: PaymentPayload = {
        scheme: 'exact',
        network: 'eip155:84532',
        amount: '5000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        paymentId: 'test-id',
        authorizedAt: nowSeconds(),
        expiresAt: nowSeconds() + 60,
        from: '0x1234567890123456789012345678901234567890',
        signature: '0xsignature',
      };

      const result = validatePaymentAgainstRequirements(payload, requirements);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient amount');
    });

    it('should fail on expired payment', () => {
      const payload: PaymentPayload = {
        scheme: 'exact',
        network: 'eip155:84532',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        paymentId: 'test-id',
        authorizedAt: nowSeconds() - 120,
        expiresAt: nowSeconds() - 60,
        from: '0x1234567890123456789012345678901234567890',
        signature: '0xsignature',
      };

      const result = validatePaymentAgainstRequirements(payload, requirements);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  describe('extractPaymentSignature', () => {
    it('should extract signature from headers', () => {
      const headers = {
        'X-PAYMENT-SIGNATURE': 'test-signature',
      };

      expect(extractPaymentSignature(headers)).toBe('test-signature');
    });

    it('should extract signature from lowercase headers', () => {
      const headers = {
        'x-payment-signature': 'test-signature',
      };

      expect(extractPaymentSignature(headers)).toBe('test-signature');
    });

    it('should extract signature from legacy headers', () => {
      const headers = {
        'PAYMENT-SIGNATURE': 'test-signature',
      };

      expect(extractPaymentSignature(headers)).toBe('test-signature');
    });

    it('should handle array headers', () => {
      const headers = {
        'X-PAYMENT-SIGNATURE': ['sig1', 'sig2'],
      };

      expect(extractPaymentSignature(headers)).toBe('sig1');
    });

    it('should return null for missing header', () => {
      const headers = {};

      expect(extractPaymentSignature(headers)).toBeNull();
    });
  });

  describe('parseChainId', () => {
    it('should parse valid CAIP-2 chain ID', () => {
      const result = parseChainId('eip155:84532');
      expect(result.namespace).toBe('eip155');
      expect(result.reference).toBe('84532');
    });

    it('should throw on invalid chain ID', () => {
      expect(() => parseChainId('invalid')).toThrow(X402Error);
    });
  });

  describe('getEvmChainId', () => {
    it('should extract EVM chain ID', () => {
      expect(getEvmChainId('eip155:84532')).toBe(84532);
      expect(getEvmChainId('eip155:1')).toBe(1);
    });

    it('should throw on non-EVM chain', () => {
      expect(() => getEvmChainId('solana:mainnet')).toThrow(X402Error);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(fn, { maxRetries: 3, retryDelay: 10 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3, retryDelay: 10 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('always fails'));

      await expect(withRetry(fn, { maxRetries: 3, retryDelay: 10 })).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});
