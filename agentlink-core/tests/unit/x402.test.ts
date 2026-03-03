/**
 * AgentLink Core - x402 Payment Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPaymentRequirement,
  createPaymentRequiredResponse,
  parsePaymentProof,
  verifyPayment,
  requiresPayment,
  formatPaymentAmount,
  getUsdcAddress,
  validateX402Config,
  storePendingPayment,
  getPendingPayment,
  removePendingPayment,
  clearPendingPayments,
  DEFAULT_USDC_ADDRESSES,
} from '../../src/x402/index.js';
import type { X402Config, PaymentProof } from '../../src/types/index.js';

describe('x402 Payment Module', () => {
  const validConfig: X402Config = {
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    chainId: 84532,
    receiver: '0x1234567890123456789012345678901234567890',
  };

  beforeEach(() => {
    clearPendingPayments();
  });

  describe('createPaymentRequirement', () => {
    it('should create valid payment requirement', () => {
      const requirement = createPaymentRequirement(1000000, validConfig);

      expect(requirement.amount).toBe(1000000);
      expect(requirement.token).toBe(validConfig.usdcAddress);
      expect(requirement.chainId).toBe(validConfig.chainId);
      expect(requirement.receiver).toBe(validConfig.receiver);
      expect(requirement.paymentId).toBeDefined();
      expect(requirement.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should use default USDC address when not specified', () => {
      const configWithoutUsdc: X402Config = {
        chainId: 84532,
        receiver: validConfig.receiver,
      };

      const requirement = createPaymentRequirement(1000000, configWithoutUsdc);
      expect(requirement.token).toBe(DEFAULT_USDC_ADDRESSES[84532]);
    });

    it('should use custom timeout when specified', () => {
      const configWithTimeout: X402Config = {
        ...validConfig,
        timeout: 600, // 10 minutes
      };

      const requirement = createPaymentRequirement(1000000, configWithTimeout);
      const expectedExpiry = Math.floor(Date.now() / 1000) + 600;
      expect(requirement.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1);
      expect(requirement.expiresAt).toBeLessThanOrEqual(expectedExpiry + 1);
    });

    it('should throw error for unsupported chain without USDC address', () => {
      const configUnsupported: X402Config = {
        chainId: 999999,
        receiver: validConfig.receiver,
      };

      expect(() => createPaymentRequirement(1000000, configUnsupported)).toThrow(
        'No USDC address configured for chain 999999'
      );
    });

    it('should generate unique payment IDs', () => {
      const req1 = createPaymentRequirement(1000000, validConfig);
      const req2 = createPaymentRequirement(1000000, validConfig);

      expect(req1.paymentId).not.toBe(req2.paymentId);
    });
  });

  describe('createPaymentRequiredResponse', () => {
    it('should create 402 response with default message', () => {
      const requirement = createPaymentRequirement(1000000, validConfig);
      const response = createPaymentRequiredResponse(requirement);

      expect(response.status).toBe(402);
      expect(response.paymentRequired).toBe(requirement);
      expect(response.message).toBe('Payment required: 1.000000 USDC');
    });

    it('should create 402 response with custom message', () => {
      const requirement = createPaymentRequirement(500000, validConfig);
      const response = createPaymentRequiredResponse(requirement, 'Custom payment message');

      expect(response.status).toBe(402);
      expect(response.message).toBe('Custom payment message');
    });

    it('should format amount correctly for fractional USDC', () => {
      const requirement = createPaymentRequirement(1500000, validConfig);
      const response = createPaymentRequiredResponse(requirement);

      expect(response.message).toBe('Payment required: 1.500000 USDC');
    });

    it('should format small amounts correctly', () => {
      const requirement = createPaymentRequirement(1000, validConfig);
      const response = createPaymentRequiredResponse(requirement);

      expect(response.message).toBe('Payment required: 0.001000 USDC');
    });
  });

  describe('parsePaymentProof', () => {
    const validProof: PaymentProof = {
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      amount: 1000000,
      token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      chainId: 84532,
      receiver: '0x1234567890123456789012345678901234567890',
      paymentId: 'test-payment-id',
    };

    it('should parse valid payment proof', () => {
      const proof = parsePaymentProof(JSON.stringify(validProof));
      expect(proof).toEqual(validProof);
    });

    it('should throw error for missing txHash', () => {
      const invalidProof = { ...validProof, txHash: undefined };
      expect(() => parsePaymentProof(JSON.stringify(invalidProof))).toThrow(
        'Missing txHash in payment proof'
      );
    });

    it('should throw error for missing amount', () => {
      const invalidProof = { ...validProof, amount: undefined };
      expect(() => parsePaymentProof(JSON.stringify(invalidProof))).toThrow(
        'Missing or invalid amount in payment proof'
      );
    });

    it('should throw error for invalid amount type', () => {
      const invalidProof = { ...validProof, amount: 'not-a-number' };
      expect(() => parsePaymentProof(JSON.stringify(invalidProof))).toThrow(
        'Missing or invalid amount in payment proof'
      );
    });

    it('should throw error for missing token', () => {
      const invalidProof = { ...validProof, token: undefined };
      expect(() => parsePaymentProof(JSON.stringify(invalidProof))).toThrow(
        'Missing token in payment proof'
      );
    });

    it('should throw error for missing chainId', () => {
      const invalidProof = { ...validProof, chainId: undefined };
      expect(() => parsePaymentProof(JSON.stringify(invalidProof))).toThrow(
        'Missing or invalid chainId in payment proof'
      );
    });

    it('should throw error for missing receiver', () => {
      const invalidProof = { ...validProof, receiver: undefined };
      expect(() => parsePaymentProof(JSON.stringify(invalidProof))).toThrow(
        'Missing receiver in payment proof'
      );
    });

    it('should throw error for missing paymentId', () => {
      const invalidProof = { ...validProof, paymentId: undefined };
      expect(() => parsePaymentProof(JSON.stringify(invalidProof))).toThrow(
        'Missing paymentId in payment proof'
      );
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parsePaymentProof('not valid json')).toThrow('Invalid payment proof');
    });
  });

  describe('verifyPayment', () => {
    const validProof: PaymentProof = {
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      amount: 1000000,
      token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      chainId: 84532,
      receiver: '0x1234567890123456789012345678901234567890',
      paymentId: 'test-payment-id',
    };

    it('should verify valid payment proof', async () => {
      const result = await verifyPayment(validProof, 1000000, validConfig);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail verification for amount mismatch', async () => {
      const result = await verifyPayment(validProof, 2000000, validConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Amount mismatch: expected 2000000, got 1000000');
    });

    it('should fail verification for receiver mismatch', async () => {
      const wrongReceiver = { ...validProof, receiver: '0x0000000000000000000000000000000000000000' };
      const result = await verifyPayment(wrongReceiver, 1000000, validConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Receiver address mismatch');
    });

    it('should fail verification for chain ID mismatch', async () => {
      const wrongChain = { ...validProof, chainId: 1 };
      const result = await verifyPayment(wrongChain, 1000000, validConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Chain ID mismatch: expected 84532, got 1');
    });

    it('should fail verification for token mismatch', async () => {
      const wrongToken = { ...validProof, token: '0x0000000000000000000000000000000000000000' };
      const result = await verifyPayment(wrongToken, 1000000, validConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token address mismatch');
    });

    it('should use custom verification function when provided', async () => {
      const customConfig: X402Config = {
        ...validConfig,
        verifyPayment: async (txHash, amount) => {
          return txHash === validProof.txHash && amount === 1000000;
        },
      };

      const result = await verifyPayment(validProof, 1000000, customConfig);
      expect(result.valid).toBe(true);
    });

    it('should handle custom verification failure', async () => {
      const customConfig: X402Config = {
        ...validConfig,
        verifyPayment: async () => false,
      };

      const result = await verifyPayment(validProof, 1000000, customConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Payment verification failed');
    });

    it('should handle custom verification error', async () => {
      const customConfig: X402Config = {
        ...validConfig,
        verifyPayment: async () => {
          throw new Error('Blockchain query failed');
        },
      };

      const result = await verifyPayment(validProof, 1000000, customConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Blockchain query failed');
    });
  });

  describe('formatPaymentAmount', () => {
    it('should format whole USDC amounts', () => {
      expect(formatPaymentAmount(1000000)).toBe('1.000000 USDC');
    });

    it('should format fractional USDC amounts', () => {
      expect(formatPaymentAmount(1500000)).toBe('1.500000 USDC');
    });

    it('should format small amounts', () => {
      expect(formatPaymentAmount(1000)).toBe('0.001000 USDC');
    });

    it('should format zero', () => {
      expect(formatPaymentAmount(0)).toBe('0.000000 USDC');
    });
  });

  describe('getUsdcAddress', () => {
    it('should return custom address when provided', () => {
      const custom = '0xCustomAddress0000000000000000000000000000';
      expect(getUsdcAddress(84532, custom)).toBe(custom);
    });

    it('should return default address for known chains', () => {
      expect(getUsdcAddress(1)).toBe(DEFAULT_USDC_ADDRESSES[1]);
      expect(getUsdcAddress(8453)).toBe(DEFAULT_USDC_ADDRESSES[8453]);
      expect(getUsdcAddress(84532)).toBe(DEFAULT_USDC_ADDRESSES[84532]);
      expect(getUsdcAddress(11155111)).toBe(DEFAULT_USDC_ADDRESSES[11155111]);
    });

    it('should throw error for unknown chain without custom address', () => {
      expect(() => getUsdcAddress(999999)).toThrow(
        'No default USDC address for chain 999999'
      );
    });
  });

  describe('validateX402Config', () => {
    it('should return empty array for valid config', () => {
      const errors = validateX402Config(validConfig);
      expect(errors).toEqual([]);
    });

    it('should detect missing receiver', () => {
      const errors = validateX402Config({ ...validConfig, receiver: '' });
      expect(errors).toContain('Receiver address is required');
    });

    it('should detect invalid receiver format', () => {
      const errors = validateX402Config({ ...validConfig, receiver: 'invalid' });
      expect(errors).toContain('Invalid receiver address format');
    });

    it('should detect missing chain ID', () => {
      const errors = validateX402Config({ ...validConfig, chainId: 0 });
      expect(errors).toContain('Valid chain ID is required');
    });

    it('should detect negative chain ID', () => {
      const errors = validateX402Config({ ...validConfig, chainId: -1 });
      expect(errors).toContain('Valid chain ID is required');
    });

    it('should detect invalid USDC address format', () => {
      const errors = validateX402Config({ ...validConfig, usdcAddress: 'invalid' });
      expect(errors).toContain('Invalid USDC address format');
    });

    it('should detect negative timeout', () => {
      const errors = validateX402Config({ ...validConfig, timeout: -1 });
      expect(errors).toContain('Timeout must be non-negative');
    });

    it('should return multiple errors', () => {
      const errors = validateX402Config({
        receiver: '',
        chainId: 0,
        usdcAddress: 'invalid',
        timeout: -1,
      });

      expect(errors).toHaveLength(4);
      expect(errors).toContain('Receiver address is required');
      expect(errors).toContain('Valid chain ID is required');
      expect(errors).toContain('Invalid USDC address format');
      expect(errors).toContain('Timeout must be non-negative');
    });
  });

  describe('Pending Payment Store', () => {
    it('should store and retrieve pending payment', () => {
      const requirement = createPaymentRequirement(1000000, validConfig);
      storePendingPayment(requirement);

      const retrieved = getPendingPayment(requirement.paymentId);
      expect(retrieved).toEqual(requirement);
    });

    it('should return undefined for non-existent payment', () => {
      const retrieved = getPendingPayment('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should remove pending payment', () => {
      const requirement = createPaymentRequirement(1000000, validConfig);
      storePendingPayment(requirement);

      const removed = removePendingPayment(requirement.paymentId);
      expect(removed).toBe(true);

      const retrieved = getPendingPayment(requirement.paymentId);
      expect(retrieved).toBeUndefined();
    });

    it('should return false when removing non-existent payment', () => {
      const removed = removePendingPayment('non-existent');
      expect(removed).toBe(false);
    });

    it('should clear all pending payments', () => {
      const req1 = createPaymentRequirement(1000000, validConfig);
      const req2 = createPaymentRequirement(2000000, validConfig);
      storePendingPayment(req1);
      storePendingPayment(req2);

      clearPendingPayments();

      expect(getPendingPayment(req1.paymentId)).toBeUndefined();
      expect(getPendingPayment(req2.paymentId)).toBeUndefined();
    });

    it('should expire payments after timeout', async () => {
      const configWithShortTimeout: X402Config = {
        ...validConfig,
        timeout: 1, // 1 second
      };

      const requirement = createPaymentRequirement(1000000, configWithShortTimeout);
      storePendingPayment(requirement);

      // Should exist immediately
      expect(getPendingPayment(requirement.paymentId)).toBeDefined();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      expect(getPendingPayment(requirement.paymentId)).toBeUndefined();
    });
  });
});
