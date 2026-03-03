/**
 * Tests for x402 types
 */

import {
  SupportedNetworks,
  USDC_ADDRESSES,
  USDC_DECIMALS,
  DEFAULT_CONFIG,
  X402_HEADERS,
  X402Error,
  X402ErrorCode,
} from './index';

describe('Types', () => {
  describe('SupportedNetworks', () => {
    it('should have correct network IDs', () => {
      expect(SupportedNetworks.BASE_MAINNET).toBe('eip155:8453');
      expect(SupportedNetworks.BASE_SEPOLIA).toBe('eip155:84532');
      expect(SupportedNetworks.ETHEREUM_MAINNET).toBe('eip155:1');
      expect(SupportedNetworks.ETHEREUM_SEPOLIA).toBe('eip155:11155111');
    });
  });

  describe('USDC_ADDRESSES', () => {
    it('should have USDC addresses for all supported networks', () => {
      expect(USDC_ADDRESSES[SupportedNetworks.BASE_MAINNET]).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(USDC_ADDRESSES[SupportedNetworks.BASE_SEPOLIA]).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should have valid Ethereum addresses', () => {
      Object.values(USDC_ADDRESSES).forEach((address) => {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });
  });

  describe('USDC_DECIMALS', () => {
    it('should be 6', () => {
      expect(USDC_DECIMALS).toBe(6);
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have default values', () => {
      expect(DEFAULT_CONFIG.network).toBe(SupportedNetworks.BASE_SEPOLIA);
      expect(DEFAULT_CONFIG.scheme).toBe('exact');
      expect(DEFAULT_CONFIG.maxTimeoutSeconds).toBe(60);
      expect(DEFAULT_CONFIG.facilitatorUrl).toBe('https://x402.org/facilitator');
    });
  });

  describe('X402_HEADERS', () => {
    it('should have correct header names', () => {
      expect(X402_HEADERS.PAYMENT_REQUIRED).toBe('X-PAYMENT-REQUIRED');
      expect(X402_HEADERS.PAYMENT_SIGNATURE).toBe('X-PAYMENT-SIGNATURE');
      expect(X402_HEADERS.PAYMENT_RESPONSE).toBe('X-PAYMENT-RESPONSE');
    });

    it('should have legacy header names', () => {
      expect(X402_HEADERS.PAYMENT_REQUIRED_LEGACY).toBe('PAYMENT-REQUIRED');
      expect(X402_HEADERS.PAYMENT_SIGNATURE_LEGACY).toBe('PAYMENT-SIGNATURE');
      expect(X402_HEADERS.PAYMENT_RESPONSE_LEGACY).toBe('PAYMENT-RESPONSE');
    });
  });

  describe('X402Error', () => {
    it('should create error with correct properties', () => {
      const error = new X402Error(
        'Test error',
        X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
        400,
        { detail: 'test' }
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(X402ErrorCode.INVALID_PAYMENT_PAYLOAD);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('X402Error');
    });

    it('should have all error codes', () => {
      const codes = Object.values(X402ErrorCode);
      expect(codes).toContain('INVALID_PAYMENT_PAYLOAD');
      expect(codes).toContain('PAYMENT_EXPIRED');
      expect(codes).toContain('PAYMENT_ALREADY_USED');
      expect(codes).toContain('INSUFFICIENT_AMOUNT');
      expect(codes).toContain('INVALID_SIGNATURE');
      expect(codes).toContain('SETTLEMENT_FAILED');
      expect(codes).toContain('NETWORK_MISMATCH');
      expect(codes).toContain('ASSET_MISMATCH');
      expect(codes).toContain('FACILITATOR_ERROR');
    });
  });
});
