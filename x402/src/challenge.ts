/**
 * x402 Payment Protocol - Challenge/Response Handlers
 * 
 * This module implements the core x402 challenge/response flow:
 * 1. Server returns 402 with payment requirements (challenge)
 * 2. Client submits payment proof (response)
 * 3. Server verifies and processes
 */

import {
  PaymentRequired,
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
  X402Config,
  X402Error,
  X402ErrorCode,
  X402_HEADERS,
  ReceiptStore,
} from './types';
import {
  buildPaymentRequired,
  encodeBase64,
  decodeBase64,
  validatePaymentPayload,
  validatePaymentAgainstRequirements,
  generatePaymentId,
  nowSeconds,
  calculateExpiry,
  createReceipt,
  createLogger,
  getEvmChainId,
} from './utils';
import { createPaymentProcessor, PaymentProcessor, MemoryReceiptStore } from './verify';

const logger = createLogger();

// ============================================================================
// Challenge Handler (Server-side)
// ============================================================================

/**
 * Result of handling a challenge
 */
export interface ChallengeResult {
  /** Whether to proceed with the request */
  proceed: boolean;
  /** HTTP status code to return (if not proceeding) */
  statusCode?: number;
  /** Response body (if not proceeding) */
  body?: unknown;
  /** Response headers (if not proceeding) */
  headers?: Record<string, string>;
  /** Payment payload (if proceeding) */
  payload?: PaymentPayload;
  /** Settlement info (if processed) */
  settlement?: SettlementResponse;
}

/**
 * Handle a payment challenge
 * This is the core function that processes incoming requests with potential payments
 */
export async function handleChallenge(
  config: X402Config,
  request: {
    url: string;
    headers: Record<string, string | string[] | undefined>;
    body?: unknown;
  },
  processor: PaymentProcessor
): Promise<ChallengeResult> {
  const url = request.url;

  // Extract payment signature from headers
  const signatureHeader =
    request.headers[X402_HEADERS.PAYMENT_SIGNATURE] ||
    request.headers[X402_HEADERS.PAYMENT_SIGNATURE.toLowerCase()] ||
    request.headers[X402_HEADERS.PAYMENT_SIGNATURE_LEGACY] ||
    request.headers[X402_HEADERS.PAYMENT_SIGNATURE_LEGACY.toLowerCase()];

  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  // No payment provided - return 402 challenge
  if (!signature) {
    logger.debug('No payment signature, issuing challenge');

    const paymentRequired = buildPaymentRequired(config, url);

    return {
      proceed: false,
      statusCode: 402,
      body: {
        error: 'Payment Required',
        ...paymentRequired,
      },
      headers: {
        [X402_HEADERS.PAYMENT_REQUIRED]: encodeBase64(paymentRequired),
        'Content-Type': 'application/json',
      },
    };
  }

  // Parse payment payload
  let payload: PaymentPayload;
  try {
    payload = decodeBase64<PaymentPayload>(signature);
  } catch (error) {
    logger.error('Failed to decode payment payload', error);
    return {
      proceed: false,
      statusCode: 400,
      body: {
        error: 'Invalid payment payload',
        code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  // Validate payload structure
  if (!validatePaymentPayload(payload)) {
    return {
      proceed: false,
      statusCode: 400,
      body: {
        error: 'Invalid payment payload structure',
        code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  // Build requirements for verification
  const requirements = buildPaymentRequired(config, url).accepts[0];

  // Validate payment against requirements
  const validation = validatePaymentAgainstRequirements(payload, requirements);
  if (!validation.valid) {
    logger.warn('Payment validation failed', validation.error);
    return {
      proceed: false,
      statusCode: 402,
      body: {
        error: 'Payment validation failed',
        message: validation.error,
        code: X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  // Process payment
  const result = await processor.process(payload, requirements, {
    settle: true,
    resourceUrl: url,
  });

  if (!result.success) {
    logger.error('Payment processing failed', result.error);
    return {
      proceed: false,
      statusCode: 402,
      body: {
        error: 'Payment processing failed',
        message: result.error,
        code: X402ErrorCode.SETTLEMENT_FAILED,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  // Payment successful
  logger.debug('Payment processed successfully', {
    txHash: result.settlement?.transactionHash,
  });

  return {
    proceed: true,
    payload,
    settlement: result.settlement,
  };
}

// ============================================================================
// Response Handler (Client-side)
// ============================================================================

/**
 * Options for creating a payment response
 */
export interface CreatePaymentResponseOptions {
  /** Client wallet address */
  from: `0x${string}`;
  /** Payment requirements from server */
  requirements: PaymentRequirements;
  /** Custom payment ID (default: auto-generated) */
  paymentId?: string;
  /** Custom expiry time (default: based on maxTimeoutSeconds) */
  expiresAt?: number;
  /** Sign function for EIP-712 signature */
  signMessage: (message: string) => Promise<`0x${string}`>;
}

/**
 * Create a payment payload in response to a challenge
 */
export async function createPaymentResponse(
  options: CreatePaymentResponseOptions
): Promise<PaymentPayload> {
  const { from, requirements, signMessage } = options;

  const paymentId = options.paymentId || generatePaymentId();
  const authorizedAt = nowSeconds();
  const expiresAt =
    options.expiresAt || calculateExpiry(requirements.maxTimeoutSeconds);

  // Create unsigned payload
  const payload: Omit<PaymentPayload, 'signature'> = {
    scheme: requirements.scheme,
    network: requirements.network,
    amount: requirements.amount,
    asset: requirements.asset as `0x${string}`,
    payTo: requirements.payTo,
    paymentId,
    authorizedAt,
    expiresAt,
    from,
  };

  // Create message for signing
  const message = JSON.stringify(payload);

  // Sign the message
  const signature = await signMessage(message);

  // Return complete payload
  return {
    ...payload,
    signature,
  };
}

// ============================================================================
// Client-side Payment Flow
// ============================================================================

/**
 * Client for handling x402 payments
 */
export class X402Client {
  private receiptStore: ReceiptStore;

  constructor(
    private config: {
      /** Client wallet address */
      address: `0x${string}`;
      /** Sign function */
      signMessage: (message: string) => Promise<`0x${string}`>;
      /** Optional receipt store */
      receiptStore?: ReceiptStore;
    }
  ) {
    this.receiptStore = config.receiptStore || new MemoryReceiptStore();
  }

  /**
   * Fetch with automatic payment handling
   */
  async fetch(
    input: RequestInfo | URL,
    init?: RequestInit & {
      /** Maximum payment amount willing to pay */
      maxPayment?: number;
      /** Auto-approve payments up to this amount */
      autoApprove?: boolean;
    }
  ): Promise<Response> {
    const url = input.toString();

    // First attempt without payment
    const firstResponse = await fetch(input, init);

    // If not 402, return response as-is
    if (firstResponse.status !== 402) {
      return firstResponse;
    }

    // Extract payment requirements from response
    const paymentRequiredHeader =
      firstResponse.headers.get(X402_HEADERS.PAYMENT_REQUIRED) ||
      firstResponse.headers.get(X402_HEADERS.PAYMENT_REQUIRED_LEGACY);

    if (!paymentRequiredHeader) {
      throw new X402Error(
        'Server returned 402 but no payment requirements',
        X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
        402
      );
    }

    // Parse payment requirements
    let paymentRequired: PaymentRequired;
    try {
      paymentRequired = decodeBase64<PaymentRequired>(paymentRequiredHeader);
    } catch (error) {
      throw new X402Error(
        'Invalid payment requirements from server',
        X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
        402
      );
    }

    // Select first acceptable payment requirement
    const requirements = paymentRequired.accepts[0];
    if (!requirements) {
      throw new X402Error(
        'No acceptable payment requirements from server',
        X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
        402
      );
    }

    // Check max payment if specified
    if (init?.maxPayment !== undefined) {
      const paymentAmount = parseFloat(requirements.amount) / 1e6; // USDC decimals
      if (paymentAmount > init.maxPayment) {
        throw new X402Error(
          `Payment amount ${paymentAmount} exceeds max ${init.maxPayment}`,
          X402ErrorCode.INSUFFICIENT_AMOUNT,
          402
        );
      }
    }

    // Create payment payload
    const payload = await createPaymentResponse({
      from: this.config.address,
      requirements,
      signMessage: this.config.signMessage,
    });

    // Retry request with payment
    const headers = new Headers(init?.headers);
    headers.set(X402_HEADERS.PAYMENT_SIGNATURE, encodeBase64(payload));

    const secondResponse = await fetch(input, {
      ...init,
      headers,
    });

    // Store receipt if payment was successful
    if (secondResponse.ok) {
      const settlementHeader =
        secondResponse.headers.get(X402_HEADERS.PAYMENT_RESPONSE) ||
        secondResponse.headers.get(X402_HEADERS.PAYMENT_RESPONSE_LEGACY);

      if (settlementHeader) {
        try {
          const settlement = decodeBase64<SettlementResponse>(settlementHeader);
          const receipt = createReceipt(payload, settlement, url);
          await this.receiptStore.store(receipt);
        } catch (error) {
          logger.error('Failed to store receipt', error);
        }
      }
    }

    return secondResponse;
  }

  /**
   * Get stored receipts
   */
  async getReceipts(): Promise<PaymentReceipt[]> {
    // This is a simplified version - in production you'd want pagination
    if (this.receiptStore instanceof MemoryReceiptStore) {
      return this.receiptStore.getAll();
    }
    return [];
  }
}

// ============================================================================
// Server-side Payment Gate
// ============================================================================

/**
 * Payment gate for protecting resources
 */
export class PaymentGate {
  private processor: PaymentProcessor;

  constructor(
    private config: X402Config,
    options?: {
      receiptStore?: ReceiptStore;
    }
  ) {
    this.processor = createPaymentProcessor(config);
  }

  /**
   * Check if a request has valid payment
   */
  async check(request: {
    url: string;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<{
    valid: boolean;
    payload?: PaymentPayload;
    settlement?: SettlementResponse;
    error?: string;
  }> {
    const result = await handleChallenge(this.config, request, this.processor);

    if (result.proceed) {
      return {
        valid: true,
        payload: result.payload,
        settlement: result.settlement,
      };
    }

    return {
      valid: false,
      error: result.body && typeof result.body === 'object'
        ? (result.body as { message?: string }).message || 'Payment required'
        : 'Payment required',
    };
  }

  /**
   * Create a challenge response (402)
   */
  challenge(url: string): {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  } {
    const paymentRequired = buildPaymentRequired(this.config, url);

    return {
      statusCode: 402,
      body: {
        error: 'Payment Required',
        ...paymentRequired,
      },
      headers: {
        [X402_HEADERS.PAYMENT_REQUIRED]: encodeBase64(paymentRequired),
        'Content-Type': 'application/json',
      },
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a payment gate from config
 */
export function createPaymentGate(config: X402Config): PaymentGate {
  return new PaymentGate(config);
}

/**
 * Create an x402 client
 */
export function createX402Client(config: {
  address: `0x${string}`;
  signMessage: (message: string) => Promise<`0x${string}`>;
}): X402Client {
  return new X402Client(config);
}
