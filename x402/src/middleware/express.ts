/**
 * x402 Payment Protocol - Express Middleware
 * 
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { x402Middleware } from '@agentlink/x402/middleware/express';
 * 
 * const app = express();
 * 
 * app.use('/paid-endpoint', x402Middleware({
 *   price: 0.01,
 *   receiverAddress: '0x...',
 * }));
 * 
 * app.get('/paid-endpoint', (req, res) => {
 *   res.json({ data: 'premium content' });
 * });
 * ```
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
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
 * Extended Express request with x402 data
 */
export interface X402Request extends Request {
  x402?: {
    settlement?: SettlementResponse;
    receipt?: unknown;
    payload?: PaymentPayload;
  };
}

/**
 * x402 middleware options for Express
 */
export interface ExpressX402Options extends X402Config {
  /** Skip payment check for certain requests */
  skip?: (req: X402Request) => boolean | Promise<boolean>;
}

/**
 * Create x402 middleware for Express
 */
export function x402Middleware(options: ExpressX402Options): RequestHandler {
  const logger = createLogger();
  const processor = createPaymentProcessor(options);

  // Validate required options
  if (!options.receiverAddress) {
    throw new Error('receiverAddress is required');
  }
  if (options.price <= 0) {
    throw new Error('price must be greater than 0');
  }

  return async (req: X402Request, res: Response, next: NextFunction) => {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    // Check if we should skip payment check
    if (options.skip) {
      try {
        const shouldSkip = await options.skip(req);
        if (shouldSkip) {
          return next();
        }
      } catch (error) {
        logger.error('Error in skip function', error);
        return next(error);
      }
    }

    try {
      // Extract payment signature from headers
      const signatureHeader = extractPaymentSignature(req.headers);

      // No payment provided - return 402 with requirements
      if (!signatureHeader) {
        logger.debug('No payment signature found, returning 402');

        // Call onPaymentRequired hook if provided
        if (options.onPaymentRequired) {
          try {
            await options.onPaymentRequired(req, res);
          } catch (hookError) {
            logger.error('Error in onPaymentRequired hook', hookError);
          }
        }

        const paymentRequired = buildPaymentRequired(options, url);

        return res.status(402).set({
          [X402_HEADERS.PAYMENT_REQUIRED]: encodeBase64(paymentRequired),
          'Content-Type': 'application/json',
        }).json({
          error: 'Payment Required',
          ...paymentRequired,
        });
      }

      // Parse payment payload
      let payload: PaymentPayload;
      try {
        payload = decodeBase64<PaymentPayload>(signatureHeader);
      } catch (error) {
        logger.error('Failed to decode payment payload', error);
        return res.status(400).json({
          error: 'Invalid payment payload',
          code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
        });
      }

      // Store payload in request for later use
      if (!req.x402) {
        req.x402 = {};
      }
      req.x402.payload = payload;

      // Build requirements for verification
      const requirements = buildPaymentRequired(options, url).accepts[0];

      // Run custom validator if provided
      if (options.customValidator) {
        try {
          const isValid = await options.customValidator(payload);
          if (!isValid) {
            return res.status(400).json({
              error: 'Payment validation failed',
              code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
            });
          }
        } catch (validationError) {
          logger.error('Custom validator error', validationError);
          return res.status(400).json({
            error: 'Payment validation error',
            message: validationError instanceof Error ? validationError.message : 'Unknown error',
            code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
          });
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

        return res.status(402).json({
          error: 'Payment verification failed',
          message: result.error,
          code: X402ErrorCode.SETTLEMENT_FAILED,
        });
      }

      // Payment successful - attach settlement info to request
      req.x402.settlement = result.settlement;
      req.x402.receipt = result.receipt;

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

      // Override res.json to add payment response header
      const originalJson = res.json.bind(res);
      res.json = function(body: unknown) {
        if (result.settlement) {
          res.set(X402_HEADERS.PAYMENT_RESPONSE, encodeBase64(result.settlement));
        }
        return originalJson(body);
      };

      // Continue to the handler
      next();
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

      return res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * Get settlement info from Express request
 * Use this in your route handler to access payment details
 */
export function getX402Settlement(req: X402Request): SettlementResponse | undefined {
  return req.x402?.settlement;
}

/**
 * Get receipt from Express request
 */
export function getX402Receipt(req: X402Request) {
  return req.x402?.receipt;
}

/**
 * Get payment payload from Express request
 */
export function getX402Payload(req: X402Request): PaymentPayload | undefined {
  return req.x402?.payload;
}

/**
 * Create a router-level middleware that applies x402 to specific routes
 */
export function createX402Router(
  options: ExpressX402Options,
  routes: Array<{
    method: 'get' | 'post' | 'put' | 'delete' | 'patch' | 'all';
    path: string;
    handler: (req: X402Request, res: Response, next: NextFunction) => void | Promise<void>;
  }>
): Array<{
  method: string;
  path: string;
  middleware: RequestHandler[];
  handler: (req: X402Request, res: Response, next: NextFunction) => void | Promise<void>;
}> {
  const middleware = x402Middleware(options);

  return routes.map((route) => ({
    method: route.method,
    path: route.path,
    middleware: [middleware],
    handler: route.handler,
  }));
}

/**
 * Helper to conditionally apply x402 middleware
 */
export function conditionalX402(
  condition: (req: Request) => boolean | Promise<boolean>,
  options: ExpressX402Options
): RequestHandler {
  const middleware = x402Middleware(options);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shouldApply = await condition(req);
      if (shouldApply) {
        return middleware(req, res, next);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
