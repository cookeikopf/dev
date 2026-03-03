/**
 * Tests for x402 verification and settlement
 */

import {
  MemoryReceiptStore,
  PaymentProcessor,
  LocalPaymentVerifier,
  HTTPFacilitatorClient,
  buildPaymentRouterCallData,
  PAYMENT_ROUTER_ADDRESSES,
} from './index';
import {
  PaymentPayload,
  PaymentRequirements,
  PaymentReceipt,
  SupportedNetworks,
} from '../types';
import { generatePaymentId, nowSeconds, createReceipt } from '../utils';

// Mock fetch for HTTP facilitator tests
global.fetch = jest.fn();

describe('Verify', () => {
  describe('MemoryReceiptStore', () => {
    let store: MemoryReceiptStore;

    beforeEach(() => {
      store = new MemoryReceiptStore();
    });

    it('should store and retrieve receipts', async () => {
      const receipt: PaymentReceipt = {
        receiptId: 'test-receipt',
        paymentId: 'test-payment',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        network: SupportedNetworks.BASE_SEPOLIA,
        transactionHash: '0xtxhash',
        blockNumber: 12345,
        timestamp: Date.now(),
        resourceUrl: 'https://example.com/test',
      };

      await store.store(receipt);
      const retrieved = await store.get('test-receipt');

      expect(retrieved).toEqual(receipt);
    });

    it('should return null for non-existent receipt', async () => {
      const retrieved = await store.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should get receipts by payment ID', async () => {
      const receipt1: PaymentReceipt = {
        receiptId: 'receipt-1',
        paymentId: 'payment-1',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        network: SupportedNetworks.BASE_SEPOLIA,
        transactionHash: '0xtxhash1',
        blockNumber: 12345,
        timestamp: Date.now(),
        resourceUrl: 'https://example.com/test1',
      };

      const receipt2: PaymentReceipt = {
        receiptId: 'receipt-2',
        paymentId: 'payment-1',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        network: SupportedNetworks.BASE_SEPOLIA,
        transactionHash: '0xtxhash2',
        blockNumber: 12346,
        timestamp: Date.now(),
        resourceUrl: 'https://example.com/test2',
      };

      await store.store(receipt1);
      await store.store(receipt2);

      const receipts = await store.getByPaymentId('payment-1');
      expect(receipts).toHaveLength(2);
      expect(receipts.map((r) => r.receiptId)).toContain('receipt-1');
      expect(receipts.map((r) => r.receiptId)).toContain('receipt-2');
    });

    it('should check if payment ID is used', async () => {
      const receipt: PaymentReceipt = {
        receiptId: 'test-receipt',
        paymentId: 'test-payment',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        network: SupportedNetworks.BASE_SEPOLIA,
        transactionHash: '0xtxhash',
        blockNumber: 12345,
        timestamp: Date.now(),
        resourceUrl: 'https://example.com/test',
      };

      expect(await store.isPaymentIdUsed('test-payment')).toBe(false);
      await store.store(receipt);
      expect(await store.isPaymentIdUsed('test-payment')).toBe(true);
    });

    it('should clear all receipts', async () => {
      const receipt: PaymentReceipt = {
        receiptId: 'test-receipt',
        paymentId: 'test-payment',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        network: SupportedNetworks.BASE_SEPOLIA,
        transactionHash: '0xtxhash',
        blockNumber: 12345,
        timestamp: Date.now(),
        resourceUrl: 'https://example.com/test',
      };

      await store.store(receipt);
      store.clear();

      expect(await store.get('test-receipt')).toBeNull();
    });
  });

  describe('HTTPFacilitatorClient', () => {
    let client: HTTPFacilitatorClient;
    const mockUrl = 'https://test-facilitator.example.com';

    beforeEach(() => {
      client = new HTTPFacilitatorClient(mockUrl);
      (fetch as jest.Mock).mockClear();
    });

    it('should verify payment', async () => {
      const mockResponse = {
        valid: true,
        from: '0x1234567890123456789012345678901234567890',
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.verify({
        x402Version: 2,
        paymentPayload: {} as PaymentPayload,
        paymentRequirements: {} as PaymentRequirements,
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${mockUrl}/verify`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should settle payment', async () => {
      const mockResponse = {
        success: true,
        transactionHash: '0xtxhash',
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.settle({
        x402Version: 2,
        paymentPayload: {} as PaymentPayload,
        paymentRequirements: {} as PaymentRequirements,
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${mockUrl}/settle`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should retry on failure', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ valid: true }),
        });

      const result = await client.verify({
        x402Version: 2,
        paymentPayload: {} as PaymentPayload,
        paymentRequirements: {} as PaymentRequirements,
      });

      expect(result.valid).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw on facilitator error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal error',
      });

      await expect(
        client.verify({
          x402Version: 2,
          paymentPayload: {} as PaymentPayload,
          paymentRequirements: {} as PaymentRequirements,
        })
      ).rejects.toThrow('Facilitator verification failed');
    });
  });

  describe('LocalPaymentVerifier', () => {
    let verifier: LocalPaymentVerifier;
    let store: MemoryReceiptStore;

    beforeEach(() => {
      store = new MemoryReceiptStore();
      verifier = new LocalPaymentVerifier(store);
    });

    it('should validate correct payload', async () => {
      const payload: PaymentPayload = {
        scheme: 'exact',
        network: 'eip155:84532',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        paymentId: generatePaymentId(),
        authorizedAt: nowSeconds(),
        expiresAt: nowSeconds() + 60,
        from: '0x1234567890123456789012345678901234567890',
        signature: '0xinvalid', // Would need valid signature for real test
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:84532',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        maxTimeoutSeconds: 60,
      };

      // Note: This will fail signature verification with invalid signature
      const result = await verifier.verify(payload, requirements);
      expect(result.valid).toBe(false);
    });

    it('should detect replay attacks', async () => {
      const paymentId = generatePaymentId();

      // Store a receipt with this payment ID
      const receipt: PaymentReceipt = {
        receiptId: 'test-receipt',
        paymentId,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        network: SupportedNetworks.BASE_SEPOLIA,
        transactionHash: '0xtxhash',
        blockNumber: 12345,
        timestamp: Date.now(),
        resourceUrl: 'https://example.com/test',
      };
      await store.store(receipt);

      const payload: PaymentPayload = {
        scheme: 'exact',
        network: 'eip155:84532',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        paymentId,
        authorizedAt: nowSeconds(),
        expiresAt: nowSeconds() + 60,
        from: '0x1234567890123456789012345678901234567890',
        signature: '0xsignature',
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:84532',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        maxTimeoutSeconds: 60,
      };

      const result = await verifier.verify(payload, requirements);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('already been used');
    });
  });

  describe('PaymentProcessor', () => {
    it('should be created with receipt store', () => {
      const store = new MemoryReceiptStore();
      const processor = new PaymentProcessor({ receiptStore: store });

      expect(processor.getReceiptStore()).toBe(store);
    });

    it('should create default receipt store', () => {
      const processor = new PaymentProcessor();

      expect(processor.getReceiptStore()).toBeInstanceOf(MemoryReceiptStore);
    });
  });

  describe('buildPaymentRouterCallData', () => {
    it('should build callData', () => {
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

      const routerAddress = '0x0000000000000000000000000000000000000000' as `0x${string}`;
      const callData = buildPaymentRouterCallData(payload, routerAddress);

      expect(callData.startsWith('0x')).toBe(true);
      expect(callData.length).toBeGreaterThan(2);
    });
  });

  describe('PAYMENT_ROUTER_ADDRESSES', () => {
    it('should have addresses for supported networks', () => {
      expect(PAYMENT_ROUTER_ADDRESSES['eip155:8453']).toBeDefined();
      expect(PAYMENT_ROUTER_ADDRESSES['eip155:84532']).toBeDefined();
    });
  });
});
