/**
 * x402 Payment Protocol - Utility Functions
 */

import {
  ChainId,
  PaymentPayload,
  PaymentRequirements,
  PaymentRequired,
  SettlementResponse,
  X402Config,
  DEFAULT_CONFIG,
  USDC_DECIMALS,
  USDC_ADDRESSES,
  X402_HEADERS,
  PaymentReceipt,
  X402Error,
  X402ErrorCode,
} from '../types';

// ============================================================================
// Amount Conversion
// ============================================================================

/**
 * Convert USD amount to atomic token units
 * @param usdAmount - Amount in USD (e.g., 0.01 for $0.01)
 * @param decimals - Token decimals (default: 6 for USDC)
 * @returns Amount in atomic units as string
 */
export function usdToAtomic(usdAmount: number, decimals: number = USDC_DECIMALS): string {
  const atomic = Math.floor(usdAmount * Math.pow(10, decimals));
  return atomic.toString();
}

/**
 * Convert atomic token units to USD amount
 * @param atomicAmount - Amount in atomic units
 * @param decimals - Token decimals (default: 6 for USDC)
 * @returns Amount in USD
 */
export function atomicToUsd(atomicAmount: string, decimals: number = USDC_DECIMALS): number {
  return Number(atomicAmount) / Math.pow(10, decimals);
}

// ============================================================================
// Payment ID / Nonce Generation
// ============================================================================

/**
 * Generate a unique payment ID (nonce)
 * Uses timestamp + random bytes for uniqueness
 */
export function generatePaymentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Generate a unique receipt ID
 */
export function generateReceiptId(): string {
  return `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// ============================================================================
// Timestamp Utilities
// ============================================================================

/**
 * Get current timestamp in seconds
 */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Check if a timestamp has expired
 */
export function isExpired(timestamp: number): boolean {
  return nowSeconds() > timestamp;
}

/**
 * Calculate expiry timestamp
 */
export function calculateExpiry(timeoutSeconds: number): number {
  return nowSeconds() + timeoutSeconds;
}

// ============================================================================
// Base64 Encoding/Decoding
// ============================================================================

/**
 * Encode object to base64 string
 */
export function encodeBase64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

/**
 * Decode base64 string to object
 */
export function decodeBase64<T>(str: string): T {
  try {
    const decoded = Buffer.from(str, 'base64').toString('utf-8');
    return JSON.parse(decoded) as T;
  } catch (error) {
    throw new X402Error(
      'Invalid base64 encoded data',
      X402ErrorCode.INVALID_PAYMENT_PAYLOAD,
      400,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

// ============================================================================
// Payment Requirements Building
// ============================================================================

/**
 * Build payment requirements from config
 */
export function buildPaymentRequirements(
  config: X402Config,
  resourceUrl: string
): PaymentRequirements {
  const network = config.network || DEFAULT_CONFIG.network!;
  const assetAddress = config.assetAddress || USDC_ADDRESSES[network];
  const scheme = config.scheme || DEFAULT_CONFIG.scheme!;
  const maxTimeoutSeconds = config.maxTimeoutSeconds || DEFAULT_CONFIG.maxTimeoutSeconds!;

  return {
    scheme,
    network,
    amount: usdToAtomic(config.price),
    asset: assetAddress,
    payTo: config.receiverAddress,
    maxTimeoutSeconds,
    extra: {
      name: 'USDC',
      version: '2',
    },
  };
}

/**
 * Build payment required response
 */
export function buildPaymentRequired(
  config: X402Config,
  resourceUrl: string,
  errorMessage?: string
): PaymentRequired {
  const requirements = buildPaymentRequirements(config, resourceUrl);

  return {
    x402Version: 2,
    error: errorMessage || 'Payment required to access this resource',
    resource: {
      url: resourceUrl,
      description: config.description,
    },
    accepts: [requirements],
    extensions: {},
  };
}

// ============================================================================
// Payment Validation
// ============================================================================

/**
 * Validate payment payload structure
 */
export function validatePaymentPayload(payload: unknown): payload is PaymentPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const p = payload as Record<string, unknown>;

  const requiredFields = [
    'scheme',
    'network',
    'amount',
    'asset',
    'payTo',
    'paymentId',
    'authorizedAt',
    'expiresAt',
    'from',
    'signature',
  ];

  for (const field of requiredFields) {
    if (!(field in p)) {
      return false;
    }
  }

  // Validate field types
  if (typeof p.scheme !== 'string') return false;
  if (typeof p.network !== 'string') return false;
  if (typeof p.amount !== 'string') return false;
  if (typeof p.asset !== 'string') return false;
  if (typeof p.payTo !== 'string') return false;
  if (typeof p.paymentId !== 'string') return false;
  if (typeof p.authorizedAt !== 'number') return false;
  if (typeof p.expiresAt !== 'number') return false;
  if (typeof p.from !== 'string') return false;
  if (typeof p.signature !== 'string') return false;

  return true;
}

/**
 * Validate payment against requirements
 */
export function validatePaymentAgainstRequirements(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): { valid: boolean; error?: string } {
  // Check scheme match
  if (payload.scheme !== requirements.scheme) {
    return {
      valid: false,
      error: `Scheme mismatch: expected ${requirements.scheme}, got ${payload.scheme}`,
    };
  }

  // Check network match
  if (payload.network !== requirements.network) {
    return {
      valid: false,
      error: `Network mismatch: expected ${requirements.network}, got ${payload.network}`,
    };
  }

  // Check asset match
  if (payload.asset.toLowerCase() !== requirements.asset.toLowerCase()) {
    return {
      valid: false,
      error: `Asset mismatch: expected ${requirements.asset}, got ${payload.asset}`,
    };
  }

  // Check recipient match
  if (payload.payTo.toLowerCase() !== requirements.payTo.toLowerCase()) {
    return {
      valid: false,
      error: `Recipient mismatch: expected ${requirements.payTo}, got ${payload.payTo}`,
    };
  }

  // Check amount (must be >= required amount for exact scheme)
  const requiredAmount = BigInt(requirements.amount);
  const paidAmount = BigInt(payload.amount);

  if (paidAmount < requiredAmount) {
    return {
      valid: false,
      error: `Insufficient amount: required ${requirements.amount}, got ${payload.amount}`,
    };
  }

  // Check expiry
  if (isExpired(payload.expiresAt)) {
    return {
      valid: false,
      error: 'Payment has expired',
    };
  }

  return { valid: true };
}

// ============================================================================
// EIP-712 Signature Utilities
// ============================================================================

/**
 * EIP-712 Domain Separator for x402 payments
 */
export const X402_EIP712_DOMAIN = {
  name: 'x402 Payment Protocol',
  version: '2',
} as const;

/**
 * EIP-712 Types for payment payload
 */
export const X402_PAYMENT_TYPES = {
  Payment: [
    { name: 'scheme', type: 'string' },
    { name: 'network', type: 'string' },
    { name: 'amount', type: 'string' },
    { name: 'asset', type: 'address' },
    { name: 'payTo', type: 'address' },
    { name: 'paymentId', type: 'string' },
    { name: 'authorizedAt', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
  ],
} as const;

/**
 * Create EIP-712 typed data for payment signing
 */
export function createPaymentTypedData(
  payload: Omit<PaymentPayload, 'signature'>,
  chainId: number
) {
  return {
    domain: {
      ...X402_EIP712_DOMAIN,
      chainId,
      verifyingContract: payload.asset,
    },
    types: X402_PAYMENT_TYPES,
    primaryType: 'Payment' as const,
    message: {
      scheme: payload.scheme,
      network: payload.network,
      amount: payload.amount,
      asset: payload.asset,
      payTo: payload.payTo,
      paymentId: payload.paymentId,
      authorizedAt: payload.authorizedAt,
      expiresAt: payload.expiresAt,
    },
  };
}

// ============================================================================
// HTTP Header Utilities
// ============================================================================

/**
 * Extract payment signature from headers
 */
export function extractPaymentSignature(headers: Record<string, string | string[] | undefined>): string | null {
  const signature =
    headers[X402_HEADERS.PAYMENT_SIGNATURE] ||
    headers[X402_HEADERS.PAYMENT_SIGNATURE.toLowerCase()] ||
    headers[X402_HEADERS.PAYMENT_SIGNATURE_LEGACY] ||
    headers[X402_HEADERS.PAYMENT_SIGNATURE_LEGACY.toLowerCase()];

  if (Array.isArray(signature)) {
    return signature[0];
  }
  return signature || null;
}

/**
 * Create payment required headers
 */
export function createPaymentRequiredHeaders(paymentRequired: PaymentRequired): Record<string, string> {
  return {
    [X402_HEADERS.PAYMENT_REQUIRED]: encodeBase64(paymentRequired),
    'Content-Type': 'application/json',
  };
}

/**
 * Create payment response headers
 */
export function createPaymentResponseHeaders(settlement: SettlementResponse): Record<string, string> {
  return {
    [X402_HEADERS.PAYMENT_RESPONSE]: encodeBase64(settlement),
  };
}

// ============================================================================
// Receipt Utilities
// ============================================================================

/**
 * Create a payment receipt
 */
export function createReceipt(
  payload: PaymentPayload,
  settlement: SettlementResponse,
  resourceUrl: string
): PaymentReceipt {
  return {
    receiptId: generateReceiptId(),
    paymentId: payload.paymentId,
    from: payload.from,
    to: payload.payTo,
    amount: payload.amount,
    asset: payload.asset,
    network: payload.network,
    transactionHash: settlement.transactionHash!,
    blockNumber: settlement.blockNumber!,
    timestamp: Date.now(),
    resourceUrl,
  };
}

// ============================================================================
// Chain ID Parsing
// ============================================================================

/**
 * Parse CAIP-2 chain ID to extract namespace and reference
 */
export function parseChainId(chainId: ChainId): { namespace: string; reference: string } {
  const parts = chainId.split(':');
  if (parts.length !== 2) {
    throw new X402Error(
      `Invalid CAIP-2 chain ID: ${chainId}`,
      X402ErrorCode.NETWORK_MISMATCH,
      400
    );
  }
  return { namespace: parts[0], reference: parts[1] };
}

/**
 * Extract EVM chain ID from CAIP-2 identifier
 */
export function getEvmChainId(chainId: ChainId): number {
  const { namespace, reference } = parseChainId(chainId);
  if (namespace !== 'eip155') {
    throw new X402Error(
      `Unsupported chain namespace: ${namespace}. Only eip155 is supported.`,
      X402ErrorCode.NETWORK_MISMATCH,
      400
    );
  }
  return parseInt(reference, 10);
}

// ============================================================================
// Logging Utilities
// ============================================================================

/**
 * Safe logger that respects config
 */
export function createLogger(enabled: boolean = true) {
  return {
    debug: (message: string, ...args: unknown[]) => {
      if (enabled) console.debug(`[x402] ${message}`, ...args);
    },
    info: (message: string, ...args: unknown[]) => {
      if (enabled) console.info(`[x402] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      if (enabled) console.warn(`[x402] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      if (enabled) console.error(`[x402] ${message}`, ...args);
    },
  };
}

// ============================================================================
// Retry Utilities
// ============================================================================

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
};

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, retryDelay, backoffMultiplier } = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delay = retryDelay * Math.pow(backoffMultiplier, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
