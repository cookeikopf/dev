/**
 * x402 Payment Protocol - Next.js Middleware
 * 
 * Usage:
 * ```typescript
 * // app/api/paid-endpoint/route.ts
 * import { withX402 } from '@agentlink/x402/middleware/next';
 * 
 * export const GET = withX402(
 *   async (req) => {
 *     return Response.json({ data: 'premium content' });
 *   },
 *   {
 *     price: 0.01,
 *     receiverAddress: '0x...',
 *   }
 * );
 * ```
 * 
 * Or using middleware.ts for route matching:
 * ```typescript
 * // middleware.ts
 * import { createX402Middleware } from '@agentlink/x402/middleware/next';
 * 
 * export const middleware = createX402Middleware({
 *   price: 0.01,
 *   receiverAddress: '0x...',
 *   matcher: ['/api/paid/:path*'],
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  X402Config,
  PaymentPayload,
  SettlementResponse,
  X402ErrorCode,
  X402_HEADERS,
} from '../types';
import {
  buildPaymentRequired,
  encodeBase64,
  decodeBase64,
  extractPaymentSignature,
  createLogger,
} from '../utils';
import { createPaymentProcessor } from '../verify';

/**
 * x402 middleware options for Next.js
 */
export interface NextX402Options extends X402Config {
  /** Route matcher pattern (for middleware.ts usage) */
  matcher?: string | string[];
  /** Skip payment check for certain requests */
  skip?: (req: NextRequest) => boolean | Promise<boolean>;
}

/**
 * Extended NextRequest with x402 data
 */
export interface X402NextRequest extends NextRequest {
  x402?: {
    settlement?: SettlementResponse;
    receipt?: unknown;
    payload?: PaymentPayload;
  };
}

const logger = createLogger();

/**
 * Create x402 middleware for Next.js (middleware.ts pattern)
 */
export function createX402Middleware(options: NextX402Options) {
  // Validate required options
  if (!options.receiverAddress) {
    throw new Error('receiverAddress is required');
  }
  if (options.price <= 0) {
    throw new Error('price must be greater than 0');
  }

  const processor = createPaymentProcessor(options);

  return async function x402Middleware(request: NextRequest) {
    const url = request.url;

    // Check if we should skip payment check
    if (options.skip) {
      const shouldSkip = await options.skip(request);
      if (shouldSkip) {
        return NextResponse.next();
      }
    }

    try {
      // Extract payment signature from headers
      const headers: Record<string, string | string[] | undefined> = {};
      request.headers.forEach((value, key) => {
        const existing = headers[key];
        if (existing) {
          headers[key] = Array.isArray(existing)
            ? [...existing, value]
            : [existing, value];
        } else {
          headers[key] = value;
        }
      });

      const signatureHeader = extractPaymentSignature(headers);

      // No payment provided - return 402 with requirements
      if (!signatureHeader) {
        logger.debug('No payment signature found, returning 402');

        // Call onPaymentRequired hook if provided
        if (options.onPaymentRequired) {
          try {
            // Create minimal req/res objects for hook
            const minimalReq = { url, headers };
            const minimalRes = {};
            await options.onPaymentRequired(minimalReq, minimalRes);
          } catch (hookError) {
            logger.error('Error in onPaymentRequired hook', hookError);
          }
        }

        const paymentRequired = buildPaymentRequired(options, url);

        return NextResponse.json(
          {
            error: 'Payment Required',
            ...paymentRequired,
          },
          {
            status: 402,
            headers: {
              [X402_HEADERS.PAYMENT_REQUIRED]: encodeBase64(paymentRequired),
            },
          }
        );
      }

      // Parse payment payload
      let payload: PaymentPayload;
      try {
        payload = decodeBase64<PaymentPayload>(signatureHeader);
      } catch (error) {
        logger.error('Failed to decode payment payload', error);
        return NextResponse.json(
          {
            error: 'Invalid payment payload',
            code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
          },
          { status: 400 }
        );
      }

      // Build requirements for verification
      const requirements = buildPaymentRequired(options, url).accepts[0];

      // Run custom validator if provided
      if (options.customValidator) {
        const isValid = await options.customValidator(payload);
        if (!isValid) {
          return NextResponse.json(
            {
              error: 'Payment validation failed',
              code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
            },
            { status: 400 }
          );
        }
      }

      // Process payment (verify and settle)
      const result = await processor.process(payload, requirements, {
        settle: true,
        resourceUrl: url,
      });

      if (!result.success) {
        logger.error('Payment processing failed', result.error);

        // Call onPaymentFailed hook if provided
        if (options.onPaymentFailed) {
          try {
            await options.onPaymentFailed(new Error(result.error || 'Payment failed'));
          } catch (hookError) {
            logger.error('Error in onPaymentFailed hook', hookError);
          }
        }

        return NextResponse.json(
          {
            error: 'Payment verification failed',
            message: result.error,
            code: X402ErrorCode.SETTLEMENT_FAILED,
          },
          { status: 402 }
        );
      }

      // Payment successful - add settlement info to headers for downstream use
      const response = NextResponse.next();

      if (result.settlement) {
        response.headers.set(
          'x-x402-settlement',
          encodeBase64(result.settlement)
        );
      }
      if (result.receipt) {
        response.headers.set(
          'x-x402-receipt',
          encodeBase64(result.receipt)
        );
      }

      // Call onPaymentSettled hook if provided
      if (options.onPaymentSettled && result.settlement) {
        try {
          await options.onPaymentSettled(result.settlement);
        } catch (hookError) {
          logger.error('Error in onPaymentSettled hook', hookError);
        }
      }

      logger.debug('Payment processed successfully', {
        txHash: result.settlement?.transactionHash,
      });

      return response;
    } catch (error) {
      logger.error('Unexpected error in x402 middleware', error);

      // Call onPaymentFailed hook if provided
      if (options.onPaymentFailed) {
        try {
          await options.onPaymentFailed(
            error instanceof Error ? error : new Error(String(error))
          );
        } catch (hookError) {
          logger.error('Error in onPaymentFailed hook', hookError);
        }
      }

      return NextResponse.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Higher-order function to wrap a Next.js route handler with x402
 */
export function withX402<T extends (req: X402NextRequest) => Promise<Response> | Response>(
  handler: T,
  options: NextX402Options
): (req: X402NextRequest) => Promise<Response> {
  // Validate required options
  if (!options.receiverAddress) {
    throw new Error('receiverAddress is required');
  }
  if (options.price <= 0) {
    throw new Error('price must be greater than 0');
  }

  const processor = createPaymentProcessor(options);

  return async function x402WrappedHandler(request: X402NextRequest) {
    const url = request.url;

    // Check if we should skip payment check
    if (options.skip) {
      const shouldSkip = await options.skip(request);
      if (shouldSkip) {
        return handler(request);
      }
    }

    try {
      // Extract payment signature from headers
      const headers: Record<string, string | string[] | undefined> = {};
      request.headers.forEach((value, key) => {
        const existing = headers[key];
        if (existing) {
          headers[key] = Array.isArray(existing)
            ? [...existing, value]
            : [existing, value];
        } else {
          headers[key] = value;
        }
      });

      const signatureHeader = extractPaymentSignature(headers);

      // No payment provided - return 402 with requirements
      if (!signatureHeader) {
        logger.debug('No payment signature found, returning 402');

        // Call onPaymentRequired hook if provided
        if (options.onPaymentRequired) {
          try {
            const minimalReq = { url, headers };
            const minimalRes = {};
            await options.onPaymentRequired(minimalReq, minimalRes);
          } catch (hookError) {
            logger.error('Error in onPaymentRequired hook', hookError);
          }
        }

        const paymentRequired = buildPaymentRequired(options, url);

        return NextResponse.json(
          {
            error: 'Payment Required',
            ...paymentRequired,
          },
          {
            status: 402,
            headers: {
              [X402_HEADERS.PAYMENT_REQUIRED]: encodeBase64(paymentRequired),
            },
          }
        );
      }

      // Parse payment payload
      let payload: PaymentPayload;
      try {
        payload = decodeBase64<PaymentPayload>(signatureHeader);
      } catch (error) {
        logger.error('Failed to decode payment payload', error);
        return NextResponse.json(
          {
            error: 'Invalid payment payload',
            code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
          },
          { status: 400 }
        );
      }

      // Store in request for handler access
      if (!request.x402) {
        request.x402 = {};
      }
      request.x402.payload = payload;

      // Build requirements for verification
      const requirements = buildPaymentRequired(options, url).accepts[0];

      // Run custom validator if provided
      if (options.customValidator) {
        const isValid = await options.customValidator(payload);
        if (!isValid) {
          return NextResponse.json(
            {
              error: 'Payment validation failed',
              code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
            },
            { status: 400 }
          );
        }
      }

      // Process payment (verify and settle)
      const result = await processor.process(payload, requirements, {
        settle: true,
        resourceUrl: url,
      });

      if (!result.success) {
        logger.error('Payment processing failed', result.error);

        // Call onPaymentFailed hook if provided
        if (options.onPaymentFailed) {
          try {
            await options.onPaymentFailed(new Error(result.error || 'Payment failed'));
          } catch (hookError) {
            logger.error('Error in onPaymentFailed hook', hookError);
          }
        }

        return NextResponse.json(
          {
            error: 'Payment verification failed',
            message: result.error,
            code: X402ErrorCode.SETTLEMENT_FAILED,
          },
          { status: 402 }
        );
      }

      // Payment successful - attach settlement info to request
      request.x402.settlement = result.settlement;
      request.x402.receipt = result.receipt;

      // Call onPaymentSettled hook if provided
      if (options.onPaymentSettled && result.settlement) {
        try {
          await options.onPaymentSettled(result.settlement);
        } catch (hookError) {
          logger.error('Error in onPaymentSettled hook', hookError);
        }
      }

      logger.debug('Payment processed successfully', {
        txHash: result.settlement?.transactionHash,
      });

      // Call the actual handler
      const response = await handler(request);

      // Add payment response header to successful response
      if (result.settlement && response instanceof NextResponse) {
        response.headers.set(
          X402_HEADERS.PAYMENT_RESPONSE,
          encodeBase64(result.settlement)
        );
      }

      return response;
    } catch (error) {
      logger.error('Unexpected error in x402 handler', error);

      // Call onPaymentFailed hook if provided
      if (options.onPaymentFailed) {
        try {
          await options.onPaymentFailed(
            error instanceof Error ? error : new Error(String(error))
          );
        } catch (hookError) {
          logger.error('Error in onPaymentFailed hook', hookError);
        }
      }

      return NextResponse.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Get settlement info from NextRequest
 */
export function getX402Settlement(req: X402NextRequest): SettlementResponse | undefined {
  return req.x402?.settlement;
}

/**
 * Get receipt from NextRequest
 */
export function getX402Receipt(req: X402NextRequest) {
  return req.x402?.receipt;
}

/**
 * Get payment payload from NextRequest
 */
export function getX402Payload(req: X402NextRequest): PaymentPayload | undefined {
  return req.x402?.payload;
}

/**
 * Create a route config for Next.js App Router
 */
export function createX402RouteConfig(options: NextX402Options) {
  return {
    runtime: 'edge' as const,
    // Add any other Next.js route config options here
  };
}
