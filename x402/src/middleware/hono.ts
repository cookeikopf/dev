/**
 * x402 Payment Protocol - Hono Middleware
 * 
 * Usage:
 * ```typescript
 * import { Hono } from 'hono';
 * import { x402Middleware } from '@agentlink/x402/middleware/hono';
 * 
 * const app = new Hono();
 * 
 * app.use('/paid-endpoint', x402Middleware({
 *   price: 0.01,
 *   receiverAddress: '0x...',
 * }));
 * 
 * app.get('/paid-endpoint', (c) => {
 *   return c.json({ data: 'premium content' });
 * });
 * ```
 */

import { MiddlewareHandler, Context } from 'hono';
import {
  X402Config,
  PaymentPayload,
  SettlementResponse,
  X402Error,
  X402ErrorCode,
  X402_HEADERS,
} from '../types';
import {
  buildPaymentRequired,
  encodeBase64,
  decodeBase64,
  extractPaymentSignature,
  createPaymentResponseHeaders,
  createLogger,
} from '../utils';
import { createPaymentProcessor, PaymentProcessor } from '../verify';

/**
 * x402 middleware options for Hono
 */
export interface HonoX402Options extends X402Config {
  /** Skip payment check for certain requests */
  skip?: (c: Context) => boolean | Promise<boolean>;
}

/**
 * Create x402 middleware for Hono
 */
export function x402Middleware(options: HonoX402Options): MiddlewareHandler {
  const logger = createLogger();
  const processor = createPaymentProcessor(options);

  // Validate required options
  if (!options.receiverAddress) {
    throw new Error('receiverAddress is required');
  }
  if (options.price <= 0) {
    throw new Error('price must be greater than 0');
  }

  return async (c, next) => {
    const url = c.req.url;

    // Check if we should skip payment check
    if (options.skip) {
      const shouldSkip = await options.skip(c);
      if (shouldSkip) {
        return next();
      }
    }

    try {
      // Extract payment signature from headers
      const headers: Record<string, string | string[] | undefined> = {};
      c.req.raw.headers.forEach((value, key) => {
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
          await options.onPaymentRequired(c.req, c.res);
        }

        const paymentRequired = buildPaymentRequired(options, url);

        return c.json(
          {
            error: 'Payment Required',
            ...paymentRequired,
          },
          402,
          {
            [X402_HEADERS.PAYMENT_REQUIRED]: encodeBase64(paymentRequired),
          }
        );
      }

      // Parse payment payload
      let payload: PaymentPayload;
      try {
        payload = decodeBase64<PaymentPayload>(signatureHeader);
      } catch (error) {
        logger.error('Failed to decode payment payload', error);
        return c.json(
          {
            error: 'Invalid payment payload',
            code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
          },
          400
        );
      }

      // Build requirements for verification
      const requirements = buildPaymentRequired(options, url).accepts[0];

      // Run custom validator if provided
      if (options.customValidator) {
        const isValid = await options.customValidator(payload);
        if (!isValid) {
          return c.json(
            {
              error: 'Payment validation failed',
              code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
            },
            400
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
          await options.onPaymentFailed(new Error(result.error || 'Payment failed'));
        }

        return c.json(
          {
            error: 'Payment verification failed',
            message: result.error,
            code: X402ErrorCode.SETTLEMENT_FAILED,
          },
          402
        );
      }

      // Payment successful - attach settlement info to context
      c.set('x402Settlement', result.settlement);
      c.set('x402Receipt', result.receipt);

      // Call onPaymentSettled hook if provided
      if (options.onPaymentSettled && result.settlement) {
        await options.onPaymentSettled(result.settlement);
      }

      logger.debug('Payment processed successfully', {
        txHash: result.settlement?.transactionHash,
      });

      // Continue to the handler
      await next();

      // Add payment response header to successful response
      if (result.settlement) {
        c.header(X402_HEADERS.PAYMENT_RESPONSE, encodeBase64(result.settlement));
      }

      return;
    } catch (error) {
      logger.error('Unexpected error in x402 middleware', error);

      // Call onPaymentFailed hook if provided
      if (options.onPaymentFailed) {
        await options.onPaymentFailed(
          error instanceof Error ? error : new Error(String(error))
        );
      }

      return c.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  };
}

/**
 * Get settlement info from Hono context
 * Use this in your route handler to access payment details
 */
export function getX402Settlement(c: Context): SettlementResponse | undefined {
  return c.get('x402Settlement');
}

/**
 * Get receipt from Hono context
 */
export function getX402Receipt(c: Context) {
  return c.get('x402Receipt');
}

/**
 * Create a simple paid endpoint helper
 */
export function createPaidEndpoint<T>(
  app: {
    use: (path: string, middleware: MiddlewareHandler) => void;
    on: (method: string, path: string, handler: (c: Context) => T | Promise<T>) => void;
  },
  path: string,
  options: HonoX402Options,
  handler: (c: Context) => T | Promise<T>
): void {
  app.use(path, x402Middleware(options));
  app.on('ALL', path, handler);
}
