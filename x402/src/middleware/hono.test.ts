/**
 * Tests for Hono middleware
 */

import { x402Middleware, getX402Settlement, getX402Receipt } from './hono';
import { X402Config, PaymentPayload, X402_HEADERS } from '../types';
import { encodeBase64, nowSeconds } from '../utils';

// Mock Hono Context
const createMockContext = (options: {
  url?: string;
  headers?: Record<string, string>;
} = {}) => {
  const store = new Map();
  const headers = new Map();

  return {
    req: {
      url: options.url || 'https://example.com/test',
      raw: {
        headers: new Map(Object.entries(options.headers || {})),
      },
    },
    res: {},
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => store.set(key, value),
    json: jest.fn((body: unknown, status?: number, responseHeaders?: Record<string, string>) => {
      return {
        body,
        status,
        headers: responseHeaders,
      };
    }),
    header: jest.fn((key: string, value: string) => {
      headers.set(key, value);
    }),
  };
};

describe('Hono Middleware', () => {
  const mockConfig: X402Config = {
    price: 0.01,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
    network: 'eip155:84532',
    assetAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  };

  it('should throw if receiverAddress is missing', () => {
    expect(() =>
      x402Middleware({
        price: 0.01,
        receiverAddress: '' as `0x${string}`,
      })
    ).toThrow('receiverAddress is required');
  });

  it('should throw if price is invalid', () => {
    expect(() =>
      x402Middleware({
        price: 0,
        receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
      })
    ).toThrow('price must be greater than 0');
  });

  it('should return 402 when no payment provided', async () => {
    const middleware = x402Middleware(mockConfig);
    const c = createMockContext();
    const next = jest.fn();

    const result = await middleware(c, next);

    expect(next).not.toHaveBeenCalled();
    expect(result.status).toBe(402);
    expect(result.body).toHaveProperty('error', 'Payment Required');
    expect(result.headers).toHaveProperty(X402_HEADERS.PAYMENT_REQUIRED);
  });

  it('should return 400 for invalid payment payload', async () => {
    const middleware = x402Middleware(mockConfig);
    const c = createMockContext({
      headers: {
        [X402_HEADERS.PAYMENT_SIGNATURE]: 'invalid!!!',
      },
    });
    const next = jest.fn();

    const result = await middleware(c, next);

    expect(next).not.toHaveBeenCalled();
    expect(result.status).toBe(400);
    expect(result.body).toHaveProperty('error', 'Invalid payment payload');
  });

  it('should skip when skip function returns true', async () => {
    const middleware = x402Middleware({
      ...mockConfig,
      skip: () => true,
    });
    const c = createMockContext();
    const next = jest.fn();

    await middleware(c, next);

    expect(next).toHaveBeenCalled();
  });

  it('should call onPaymentRequired hook', async () => {
    const onPaymentRequired = jest.fn();
    const middleware = x402Middleware({
      ...mockConfig,
      onPaymentRequired,
    });
    const c = createMockContext();
    const next = jest.fn();

    await middleware(c, next);

    expect(onPaymentRequired).toHaveBeenCalled();
  });

  it('should call onPaymentFailed hook on error', async () => {
    const onPaymentFailed = jest.fn();
    const middleware = x402Middleware({
      ...mockConfig,
      customValidator: () => {
        throw new Error('Test error');
      },
      onPaymentFailed,
    });

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

    const c = createMockContext({
      headers: {
        [X402_HEADERS.PAYMENT_SIGNATURE]: encodeBase64(payload),
      },
    });
    const next = jest.fn();

    await middleware(c, next);

    expect(onPaymentFailed).toHaveBeenCalled();
  });

  it('should validate with custom validator', async () => {
    const customValidator = jest.fn().mockReturnValue(false);
    const middleware = x402Middleware({
      ...mockConfig,
      customValidator,
    });

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

    const c = createMockContext({
      headers: {
        [X402_HEADERS.PAYMENT_SIGNATURE]: encodeBase64(payload),
      },
    });
    const next = jest.fn();

    const result = await middleware(c, next);

    expect(customValidator).toHaveBeenCalled();
    expect(result.status).toBe(400);
    expect(result.body).toHaveProperty('error', 'Payment validation failed');
  });
});

describe('getX402Settlement', () => {
  it('should get settlement from context', () => {
    const c = createMockContext();
    const settlement = { success: true, transactionHash: '0xtxhash', network: 'eip155:84532' };
    c.set('x402Settlement', settlement);

    expect(getX402Settlement(c)).toBe(settlement);
  });

  it('should return undefined if no settlement', () => {
    const c = createMockContext();
    expect(getX402Settlement(c)).toBeUndefined();
  });
});

describe('getX402Receipt', () => {
  it('should get receipt from context', () => {
    const c = createMockContext();
    const receipt = { receiptId: 'test' };
    c.set('x402Receipt', receipt);

    expect(getX402Receipt(c)).toBe(receipt);
  });

  it('should return undefined if no receipt', () => {
    const c = createMockContext();
    expect(getX402Receipt(c)).toBeUndefined();
  });
});
