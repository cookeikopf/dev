import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  X402PaymentManager,
  createX402PaymentManager,
  createX402Middleware,
  createPaymentProof,
  formatPaymentHeader,
  parsePaymentHeader,
  USDC_ADDRESSES,
} from '../src/x402/index.js';
import { createCapability } from '../src/core/agent.js';
import type { X402Config, Capability, X402PaymentProof } from '../src/types/index.js';

describe('x402 Payment', () => {
  describe('X402PaymentManager', () => {
    let config: X402Config;
    let manager: X402PaymentManager;

    beforeEach(() => {
      config = {
        usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        chainId: 84532,
        receiver: '0x1234567890abcdef1234567890abcdef12345678',
        timeout: 300,
      };
      manager = new X402PaymentManager(config);
    });

    describe('constructor', () => {
      it('should create with valid config', () => {
        expect(manager).toBeInstanceOf(X402PaymentManager);
        expect(manager.getConfig().receiver).toBe(config.receiver);
      });

      it('should throw without receiver', () => {
        expect(() => new X402PaymentManager({
          usdcAddress: '0x...',
          chainId: 84532,
          receiver: '',
        })).toThrow('receiver address');
      });

      it('should throw without chainId', () => {
        expect(() => new X402PaymentManager({
          usdcAddress: '0x...',
          chainId: 0,
          receiver: '0x...',
        })).toThrow('chainId');
      });

      it('should use default USDC address for known chain', () => {
        const m = new X402PaymentManager({
          chainId: 84532,
          receiver: '0x1234567890abcdef1234567890abcdef12345678',
          usdcAddress: '',
        });
        expect(m.getConfig().usdcAddress).toBe(USDC_ADDRESSES[84532]);
      });

      it('should throw for unknown chain without address', () => {
        expect(() => new X402PaymentManager({
          chainId: 999999,
          receiver: '0x...',
          usdcAddress: '',
        })).toThrow('No default USDC address');
      });
    });

    describe('createPaymentRequirement', () => {
      it('should create payment requirement', () => {
        const req = manager.createPaymentRequirement('cap-1', 1.5);
        expect(req.amount).toBe(1500000); // 1.5 USDC in 6 decimals
        expect(req.token).toBe(config.usdcAddress);
        expect(req.chainId).toBe(config.chainId);
        expect(req.receiver).toBe(config.receiver);
        expect(req.paymentId).toBeDefined();
        expect(req.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
      });

      it('should store pending payment', () => {
        const req = manager.createPaymentRequirement('cap-1', 1);
        expect(manager.getPendingPaymentCount()).toBe(1);
      });
    });

    describe('create402Response', () => {
      it('should create 402 response', () => {
        const req = manager.createPaymentRequirement('cap-1', 1);
        const response = manager.create402Response(req);
        expect(response.status).toBe(402);
        expect(response.paymentRequired).toEqual(req);
        expect(response.message).toContain('1 USDC');
      });
    });

    describe('verifyPayment', () => {
      it('should verify valid payment', async () => {
        const req = manager.createPaymentRequirement('cap-1', 1);
        const proof: X402PaymentProof = {
          txHash: '0xabc',
          amount: 1000000,
          payer: '0x9999999999999999999999999999999999999999',
          paymentId: req.paymentId,
          timestamp: Math.floor(Date.now() / 1000),
        };
        const verified = await manager.verifyPayment(proof);
        expect(verified).toBe(true);
        expect(manager.getVerifiedPaymentCount()).toBe(1);
        expect(manager.getPendingPaymentCount()).toBe(0);
      });

      it('should return true for already verified payment', async () => {
        const req = manager.createPaymentRequirement('cap-1', 1);
        const proof: X402PaymentProof = {
          txHash: '0xabc',
          amount: 1000000,
          payer: '0x9999999999999999999999999999999999999999',
          paymentId: req.paymentId,
          timestamp: Math.floor(Date.now() / 1000),
        };
        await manager.verifyPayment(proof);
        const verifiedAgain = await manager.verifyPayment(proof);
        expect(verifiedAgain).toBe(true);
      });

      it('should reject unknown payment ID', async () => {
        const proof: X402PaymentProof = {
          txHash: '0xabc',
          amount: 1000000,
          payer: '0x9999999999999999999999999999999999999999',
          paymentId: 'unknown',
          timestamp: Math.floor(Date.now() / 1000),
        };
        const verified = await manager.verifyPayment(proof);
        expect(verified).toBe(false);
      });

      it('should reject expired payment', async () => {
        const req = manager.createPaymentRequirement('cap-1', 1);
        // Manually expire the payment
        req.expiresAt = Math.floor(Date.now() / 1000) - 1;
        
        const proof: X402PaymentProof = {
          txHash: '0xabc',
          amount: 1000000,
          payer: '0x9999999999999999999999999999999999999999',
          paymentId: req.paymentId,
          timestamp: Math.floor(Date.now() / 1000),
        };
        const verified = await manager.verifyPayment(proof);
        expect(verified).toBe(false);
      });

      it('should reject insufficient amount', async () => {
        const req = manager.createPaymentRequirement('cap-1', 2);
        const proof: X402PaymentProof = {
          txHash: '0xabc',
          amount: 1000000, // Only 1 USDC
          payer: '0x9999999999999999999999999999999999999999',
          paymentId: req.paymentId,
          timestamp: Math.floor(Date.now() / 1000),
        };
        const verified = await manager.verifyPayment(proof);
        expect(verified).toBe(false);
      });

      it('should reject payment from receiver', async () => {
        const req = manager.createPaymentRequirement('cap-1', 1);
        const proof: X402PaymentProof = {
          txHash: '0xabc',
          amount: 1000000,
          payer: config.receiver, // Same as receiver
          paymentId: req.paymentId,
          timestamp: Math.floor(Date.now() / 1000),
        };
        const verified = await manager.verifyPayment(proof);
        expect(verified).toBe(false);
      });

      it('should use custom verification function', async () => {
        const verifyPayment = vi.fn().mockResolvedValue(true);
        const customManager = new X402PaymentManager({
          ...config,
          verifyPayment,
        });
        
        const req = customManager.createPaymentRequirement('cap-1', 1);
        const proof: X402PaymentProof = {
          txHash: '0xabc',
          amount: 1000000,
          payer: '0x9999999999999999999999999999999999999999',
          paymentId: req.paymentId,
          timestamp: Math.floor(Date.now() / 1000),
        };
        
        const verified = await customManager.verifyPayment(proof);
        expect(verified).toBe(true);
        expect(verifyPayment).toHaveBeenCalledWith('0xabc', 1000000);
      });

      it('should reject if custom verification fails', async () => {
        const verifyPayment = vi.fn().mockResolvedValue(false);
        const customManager = new X402PaymentManager({
          ...config,
          verifyPayment,
        });
        
        const req = customManager.createPaymentRequirement('cap-1', 1);
        const proof: X402PaymentProof = {
          txHash: '0xabc',
          amount: 1000000,
          payer: '0x9999999999999999999999999999999999999999',
          paymentId: req.paymentId,
          timestamp: Math.floor(Date.now() / 1000),
        };
        
        const verified = await customManager.verifyPayment(proof);
        expect(verified).toBe(false);
      });
    });

    describe('parsePaymentProof', () => {
      it('should parse from header', () => {
        const proof: X402PaymentProof = {
          txHash: '0xabc',
          amount: 1000000,
          payer: '0x123',
          paymentId: 'pay-1',
          timestamp: 1234567890,
        };
        const headers = { 'x-payment-proof': JSON.stringify(proof) };
        const result = manager.parsePaymentProof(headers);
        expect(result).toEqual(proof);
      });

      it('should parse from body', () => {
        const proof: X402PaymentProof = {
          txHash: '0xabc',
          amount: 1000000,
          payer: '0x123',
          paymentId: 'pay-1',
          timestamp: 1234567890,
        };
        const body = { paymentProof: proof };
        const result = manager.parsePaymentProof({}, body);
        expect(result).toEqual(proof);
      });

      it('should return null if not found', () => {
        const result = manager.parsePaymentProof({});
        expect(result).toBeNull();
      });

      it('should return null for invalid header JSON', () => {
        const headers = { 'x-payment-proof': 'invalid json' };
        const result = manager.parsePaymentProof(headers);
        expect(result).toBeNull();
      });
    });

    describe('requiresPayment', () => {
      it('should return true for paid capability', () => {
        const cap = createCapability()
          .id('paid-cap')
          .name('Paid')
          .description('Paid capability')
          .pricing(1)
          .handler(async () => ({}))
          .build();
        expect(manager.requiresPayment(cap)).toBe(true);
      });

      it('should return false for free capability', () => {
        const cap = createCapability()
          .id('free-cap')
          .name('Free')
          .description('Free capability')
          .handler(async () => ({}))
          .build();
        expect(manager.requiresPayment(cap)).toBe(false);
      });

      it('should return false for zero-priced capability', () => {
        const cap = createCapability()
          .id('zero-cap')
          .name('Zero')
          .description('Zero-priced capability')
          .pricing(0)
          .handler(async () => ({}))
          .build();
        expect(manager.requiresPayment(cap)).toBe(false);
      });
    });

    describe('getCapabilityPrice', () => {
      it('should return capability price', () => {
        const cap = createCapability()
          .id('paid-cap')
          .name('Paid')
          .description('Paid capability')
          .pricing(2.5)
          .handler(async () => ({}))
          .build();
        expect(manager.getCapabilityPrice(cap)).toBe(2.5);
      });

      it('should return 0 for free capability', () => {
        const cap = createCapability()
          .id('free-cap')
          .name('Free')
          .description('Free capability')
          .handler(async () => ({}))
          .build();
        expect(manager.getCapabilityPrice(cap)).toBe(0);
      });
    });

    describe('cleanupExpiredPayments', () => {
      it('should remove expired payments', () => {
        const req = manager.createPaymentRequirement('cap-1', 1);
        // Manually expire
        req.expiresAt = Math.floor(Date.now() / 1000) - 1;
        
        expect(manager.getPendingPaymentCount()).toBe(1);
        manager.cleanupExpiredPayments();
        expect(manager.getPendingPaymentCount()).toBe(0);
      });
    });
  });

  describe('createX402PaymentManager', () => {
    it('should create payment manager', () => {
      const pm = createX402PaymentManager(config);
      expect(pm).toBeInstanceOf(X402PaymentManager);
    });
  });

  describe('createX402Middleware', () => {
    it('should create middleware', () => {
      const getCapability = vi.fn();
      const middleware = createX402Middleware(manager, getCapability);
      expect(typeof middleware).toBe('function');
    });

    it('should return success for free capability', async () => {
      const cap = createCapability()
        .id('free-cap')
        .name('Free')
        .description('Free capability')
        .handler(async () => ({}))
        .build();
      
      const middleware = createX402Middleware(manager, () => cap);
      const result = await middleware('free-cap', {});
      
      expect(result.success).toBe(true);
    });

    it('should return 402 for paid capability without proof', async () => {
      const cap = createCapability()
        .id('paid-cap')
        .name('Paid')
        .description('Paid capability')
        .pricing(1)
        .handler(async () => ({}))
        .build();
      
      const middleware = createX402Middleware(manager, () => cap);
      const result = await middleware('paid-cap', {});
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(402);
      }
    });

    it('should verify payment proof', async () => {
      const cap = createCapability()
        .id('paid-cap')
        .name('Paid')
        .description('Paid capability')
        .pricing(1)
        .handler(async () => ({}))
        .build();
      
      const req = manager.createPaymentRequirement('paid-cap', 1);
      const proof: X402PaymentProof = {
        txHash: '0xabc',
        amount: 1000000,
        payer: '0x9999999999999999999999999999999999999999',
        paymentId: req.paymentId,
        timestamp: Math.floor(Date.now() / 1000),
      };
      
      const middleware = createX402Middleware(manager, () => cap);
      const result = await middleware('paid-cap', {
        'x-payment-proof': JSON.stringify(proof),
      });
      
      expect(result.success).toBe(true);
    });

    it('should throw for unknown capability', async () => {
      const middleware = createX402Middleware(manager, () => undefined);
      await expect(middleware('unknown', {})).rejects.toThrow('Capability not found');
    });
  });

  describe('createPaymentProof', () => {
    it('should create payment proof', () => {
      const proof = createPaymentProof('0xabc', 1.5, '0x123', 'pay-1');
      expect(proof.txHash).toBe('0xabc');
      expect(proof.amount).toBe(1500000);
      expect(proof.payer).toBe('0x123');
      expect(proof.paymentId).toBe('pay-1');
      expect(proof.timestamp).toBeGreaterThan(0);
    });

    it('should normalize payer address', () => {
      const proof = createPaymentProof('0xabc', 1, '0xABCDEF', 'pay-1');
      expect(proof.payer).toBe('0xabcdef');
    });
  });

  describe('formatPaymentHeader', () => {
    it('should format payment requirement', () => {
      const req = {
        amount: 1000000,
        token: '0x...',
        chainId: 84532,
        receiver: '0x...',
        paymentId: 'pay-1',
        expiresAt: 1234567890,
      };
      const header = formatPaymentHeader(req);
      expect(JSON.parse(header)).toEqual(req);
    });
  });

  describe('parsePaymentHeader', () => {
    it('should parse valid header', () => {
      const req = {
        amount: 1000000,
        token: '0x...',
        chainId: 84532,
        receiver: '0x...',
        paymentId: 'pay-1',
        expiresAt: 1234567890,
      };
      const parsed = parsePaymentHeader(JSON.stringify(req));
      expect(parsed).toEqual(req);
    });

    it('should return null for invalid JSON', () => {
      const parsed = parsePaymentHeader('invalid');
      expect(parsed).toBeNull();
    });
  });

  describe('USDC_ADDRESSES', () => {
    it('should have addresses for known chains', () => {
      expect(USDC_ADDRESSES[1]).toBeDefined();
      expect(USDC_ADDRESSES[8453]).toBeDefined();
      expect(USDC_ADDRESSES[84532]).toBeDefined();
      expect(USDC_ADDRESSES[11155111]).toBeDefined();
    });
  });
});
