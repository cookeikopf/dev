/**
 * Tests for Express middleware
 */

import {
  x402Middleware,
  getX402Settlement,
  getX402Receipt,
  getX402Payload,
  X402Request,
  conditionalX402,
} from './express';
import { PaymentPayload, X402_HEADERS } from '../types';
import { encodeBase64, nowSeconds } from '../utils';

// Mock Express request/response
const createMockRequest = (options: {
  url?: string;
  headers?: Record<string, string | string[]>;
  protocol?: string;
  host?: string;
  originalUrl?: string;
} = {}): X402Request => {
  return {
    url: options.url || 'https://example.com/test',
    protocol: options.protocol || 'https',
    get: (name: string) => {
      if (name === 'host') return options.host || 'example.com';
      return options.headers?.[name] as string;
    },
    originalUrl: options.originalUrl || '/test',
    headers: options.headers || {},
  } as X402Request;
};

const createMockResponse = () => {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let jsonBody: unknown = null;

  return {
    status: jest.fn((code: number) => {
      statusCode = code;
      return res;
    }),
    json: jest.fn((body: unknown) => {
      jsonBody = body;
      return res;
    }),
    set: jest.fn((key: string | Record<string, string>, value?: string) => {
      if (typeof key === 'string') {
        headers[key] = value!;
      } else {
        Object.assign(headers, key);
      }
      return res;
    }),
    get headers() {
      return headers;
    },
    get statusCode() {
      return statusCode;
    },
    get jsonBody() {
      return jsonBody;
    },
  };
};

const res = createMockResponse();

describe('Express Middleware', () => {
  const mockConfig = {
    price: 0.01,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' as `0x${string}`,
    network: 'eip155:84532' as const,
    assetAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    const req = createMockRequest();
    const next = jest.fn();

    await middleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalled();
    const body = res.jsonBody as any;
    expect(body).toHaveProperty('error', 'Payment Required');
    expect(res.headers).toHaveProperty(X402_HEADERS.PAYMENT_REQUIRED);
  });

  it('should return 400 for invalid payment payload', async () => {
    const middleware = x402Middleware(mockConfig);
    const req = createMockRequest({
      headers: {
        [X402_HEADERS.PAYMENT_SIGNATURE]: 'invalid!!!',
      },
    });
    const next = jest.fn();

    await middleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.jsonBody as any;
    expect(body).toHaveProperty('error', 'Invalid payment payload');
  });

  it('should skip when skip function returns true', async () => {
    const middleware = x402Middleware({
      ...mockConfig,
      skip: () => true,
    });
    const req = createMockRequest();
    const next = jest.fn();

    await middleware(req, res as any, next);

    expect(next).toHaveBeenCalled();
  });

  it('should call onPaymentRequired hook', async () => {
    const onPaymentRequired = jest.fn();
    const middleware = x402Middleware({
      ...mockConfig,
      onPaymentRequired,
    });
    const req = createMockRequest();
    const next = jest.fn();

    await middleware(req, res as any, next);

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

    const req = createMockRequest({
      headers: {
        [X402_HEADERS.PAYMENT_SIGNATURE]: encodeBase64(payload),
      },
    });
    const next = jest.fn();

    await middleware(req, res as any, next);

    expect(onPaymentFailed).toHaveBeenCalled();
  });

  it('should store payload in request', async () => {
    const middleware = x402Middleware(mockConfig);

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

    const req = createMockRequest({
      headers: {
        [X402_HEADERS.PAYMENT_SIGNATURE]: encodeBase64(payload),
      },
    });
    const next = jest.fn();

    await middleware(req, res as any, next);

    expect(req.x402?.payload).toEqual(payload);
  });
});

describe('getX402Settlement', () => {
  it('should get settlement from request', () => {
    const settlement = { success: true, transactionHash: '0xtxhash', network: 'eip155:84532' };
    const req = createMockRequest();
    req.x402 = { settlement };

    expect(getX402Settlement(req)).toBe(settlement);
  });

  it('should return undefined if no settlement', () => {
    const req = createMockRequest();
    expect(getX402Settlement(req)).toBeUndefined();
  });
});

describe('getX402Receipt', () => {
  it('should get receipt from request', () => {
    const receipt = { receiptId: 'test' };
    const req = createMockRequest();
    req.x402 = { receipt };

    expect(getX402Receipt(req)).toBe(receipt);
  });

  it('should return undefined if no receipt', () => {
    const req = createMockRequest();
    expect(getX402Receipt(req)).toBeUndefined();
  });
});

describe('getX402Payload', () => {
  it('should get payload from request', () => {
    const payload = { paymentId: 'test' } as PaymentPayload;
    const req = createMockRequest();
    req.x402 = { payload };

    expect(getX402Payload(req)).toBe(payload);
  });

  it('should return undefined if no payload', () => {
    const req = createMockRequest();
    expect(getX402Payload(req)).toBeUndefined();
  });
});

describe('conditionalX402', () => {
  it('should apply middleware when condition is true', async () => {
    const condition = jest.fn().mockReturnValue(true);
    const conditionalMiddleware = conditionalX402(condition, mockConfig);

    const req = createMockRequest();
    const next = jest.fn();

    await conditionalMiddleware(req, res as any, next);

    expect(condition).toHaveBeenCalledWith(req);
    // Should have returned 402 since no payment
    expect(res.status).toHaveBeenCalledWith(402);
  });

  it('should skip middleware when condition is false', async () => {
    const condition = jest.fn().mockReturnValue(false);
    const conditionalMiddleware = conditionalX402(condition, mockConfig);

    const req = createMockRequest();
    const next = jest.fn();

    await conditionalMiddleware(req, res as any, next);

    expect(condition).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalled();
  });

  it('should handle async condition', async () => {
    const condition = jest.fn().mockResolvedValue(false);
    const conditionalMiddleware = conditionalX402(condition, mockConfig);

    const req = createMockRequest();
    const next = jest.fn();

    await conditionalMiddleware(req, res as any, next);

    expect(condition).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalled();
  });

  it('should call next with error on condition failure', async () => {
    const condition = jest.fn().mockRejectedValue(new Error('Condition error'));
    const conditionalMiddleware = conditionalX402(condition, mockConfig);

    const req = createMockRequest();
    const next = jest.fn();

    await conditionalMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
