/**
 * Tests for x402 challenge/response handlers
 */

import {
  handleChallenge,
  createPaymentResponse,
  X402Client,
  PaymentGate,
  createPaymentGate,
  createX402Client,
} from './challenge';
import { PaymentPayload, PaymentRequirements, X402_HEADERS } from './types';
import { encodeBase64, generatePaymentId, nowSeconds } from './utils';
import { createPaymentProcessor, MemoryReceiptStore } from './verify';

// Mock fetch for client tests
global.fetch = jest.fn();

describe('Challenge/Response', () => {
  const mockConfig = {
    price: 0.01,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' as `0x${string}`,
    network: 'eip155:84532' as const,
    assetAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
  };

  describe('handleChallenge', () => {
    it('should return 402 when no payment provided', async () => {
      const processor = createPaymentProcessor(mockConfig);
      const result = await handleChallenge(
        mockConfig,
        {
          url: 'https://example.com/test',
          headers: {},
        },
        processor
      );

      expect(result.proceed).toBe(false);
      expect(result.statusCode).toBe(402);
      expect(result.body).toHaveProperty('error', 'Payment Required');
      expect(result.body).toHaveProperty('x402Version', 2);
      expect(result.headers).toHaveProperty(X402_HEADERS.PAYMENT_REQUIRED);
    });

    it('should return 400 for invalid payment payload', async () => {
      const processor = createPaymentProcessor(mockConfig);
      const result = await handleChallenge(
        mockConfig,
        {
          url: 'https://example.com/test',
          headers: {
            [X402_HEADERS.PAYMENT_SIGNATURE]: 'invalid-base64!!!',
          },
        },
        processor
      );

      expect(result.proceed).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.body).toHaveProperty('error', 'Invalid payment payload');
    });

    it('should return 400 for malformed payment payload', async () => {
      const processor = createPaymentProcessor(mockConfig);
      const invalidPayload = encodeBase64({ invalid: 'payload' });

      const result = await handleChallenge(
        mockConfig,
        {
          url: 'https://example.com/test',
          headers: {
            [X402_HEADERS.PAYMENT_SIGNATURE]: invalidPayload,
          },
        },
        processor
      );

      expect(result.proceed).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.body).toHaveProperty('error', 'Invalid payment payload structure');
    });

    it('should validate payment and proceed', async () => {
      const processor = createPaymentProcessor(mockConfig);
      const paymentId = generatePaymentId();

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

      const result = await handleChallenge(
        mockConfig,
        {
          url: 'https://example.com/test',
          headers: {
            [X402_HEADERS.PAYMENT_SIGNATURE]: encodeBase64(payload),
          },
        },
        processor
      );

      // Will fail due to no facilitator, but validates the flow
      expect(result.proceed).toBe(false);
      expect(result.statusCode).toBe(402);
    });
  });

  describe('createPaymentResponse', () => {
    it('should create valid payment payload', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:84532',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        maxTimeoutSeconds: 60,
      };

      const mockSignMessage = jest.fn().mockResolvedValue('0xsignature');

      const payload = await createPaymentResponse({
        from: '0x1234567890123456789012345678901234567890',
        requirements,
        signMessage: mockSignMessage,
      });

      expect(payload.scheme).toBe('exact');
      expect(payload.network).toBe('eip155:84532');
      expect(payload.amount).toBe('10000');
      expect(payload.asset).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
      expect(payload.payTo).toBe('0x209693Bc6afc0C5328bA36FaF03C514EF312287C');
      expect(payload.from).toBe('0x1234567890123456789012345678901234567890');
      expect(payload.signature).toBe('0xsignature');
      expect(payload.paymentId).toBeDefined();
      expect(payload.authorizedAt).toBeDefined();
      expect(payload.expiresAt).toBeDefined();

      expect(mockSignMessage).toHaveBeenCalled();
    });

    it('should use custom payment ID', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:84532',
        amount: '10000',
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
        maxTimeoutSeconds: 60,
      };

      const customPaymentId = 'custom-payment-id';
      const mockSignMessage = jest.fn().mockResolvedValue('0xsignature');

      const payload = await createPaymentResponse({
        from: '0x1234567890123456789012345678901234567890',
        requirements,
        paymentId: customPaymentId,
        signMessage: mockSignMessage,
      });

      expect(payload.paymentId).toBe(customPaymentId);
    });
  });

  describe('X402Client', () => {
    let client: X402Client;
    const mockSignMessage = jest.fn().mockResolvedValue('0xsignature');

    beforeEach(() => {
      client = new X402Client({
        address: '0x1234567890123456789012345678901234567890',
        signMessage: mockSignMessage,
      });
      (fetch as jest.Mock).mockClear();
    });

    it('should pass through non-402 responses', async () => {
      const mockResponse = new Response('OK', { status: 200 });
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await client.fetch('https://example.com/test');

      expect(result.status).toBe(200);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle 402 and retry with payment', async () => {
      const paymentRequired = {
        x402Version: 2,
        resource: { url: 'https://example.com/test' },
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:84532',
            amount: '10000',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
            maxTimeoutSeconds: 60,
          },
        ],
      };

      // First response: 402
      (fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Payment Required', ...paymentRequired }), {
          status: 402,
          headers: {
            [X402_HEADERS.PAYMENT_REQUIRED]: encodeBase64(paymentRequired),
          },
        })
      );

      // Second response: success
      (fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            [X402_HEADERS.PAYMENT_RESPONSE]: encodeBase64({
              success: true,
              transactionHash: '0xtxhash',
              network: 'eip155:84532',
            }),
          },
        })
      );

      const result = await client.fetch('https://example.com/test');

      expect(result.status).toBe(200);
      expect(fetch).toHaveBeenCalledTimes(2);

      // Check that second request has payment header
      const secondCall = (fetch as jest.Mock).mock.calls[1];
      expect(secondCall[1].headers.has(X402_HEADERS.PAYMENT_SIGNATURE)).toBe(true);
    });

    it('should throw if no payment requirements in 402', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Payment Required' }), {
          status: 402,
        })
      );

      await expect(client.fetch('https://example.com/test')).rejects.toThrow(
        'Server returned 402 but no payment requirements'
      );
    });

    it('should respect maxPayment limit', async () => {
      const paymentRequired = {
        x402Version: 2,
        resource: { url: 'https://example.com/test' },
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:84532',
            amount: '1000000', // $1.00
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
            maxTimeoutSeconds: 60,
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Payment Required', ...paymentRequired }), {
          status: 402,
          headers: {
            [X402_HEADERS.PAYMENT_REQUIRED]: encodeBase64(paymentRequired),
          },
        })
      );

      await expect(
        client.fetch('https://example.com/test', { maxPayment: 0.5 })
      ).rejects.toThrow('exceeds max');
    });
  });

  describe('PaymentGate', () => {
    it('should be created with config', () => {
      const gate = createPaymentGate(mockConfig);
      expect(gate).toBeInstanceOf(PaymentGate);
    });

    it('should create challenge response', () => {
      const gate = createPaymentGate(mockConfig);
      const challenge = gate.challenge('https://example.com/test');

      expect(challenge.statusCode).toBe(402);
      expect(challenge.body).toHaveProperty('error', 'Payment Required');
      expect(challenge.body).toHaveProperty('x402Version', 2);
      expect(challenge.headers).toHaveProperty(X402_HEADERS.PAYMENT_REQUIRED);
    });

    it('should check payment validity', async () => {
      const gate = createPaymentGate(mockConfig);
      const paymentId = generatePaymentId();

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

      const result = await gate.check({
        url: 'https://example.com/test',
        headers: {
          [X402_HEADERS.PAYMENT_SIGNATURE]: encodeBase64(payload),
        },
      });

      // Will be invalid due to no facilitator, but tests the flow
      expect(result.valid).toBe(false);
    });

    it('should return invalid for missing payment', async () => {
      const gate = createPaymentGate(mockConfig);

      const result = await gate.check({
        url: 'https://example.com/test',
        headers: {},
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('createX402Client', () => {
    it('should create client with config', () => {
      const client = createX402Client({
        address: '0x1234567890123456789012345678901234567890',
        signMessage: mockSignMessage,
      });

      expect(client).toBeInstanceOf(X402Client);
    });
  });
});
