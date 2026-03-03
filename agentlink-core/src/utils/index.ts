/**
 * AgentLink Core - Utility Functions
 */

import type { IdentityReference, RetryOptions } from '../types/index.js';

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique ID with timestamp and random component
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Identity Reference Utilities
// ============================================================================

/**
 * Parse an ERC-8004 identity reference
 */
export function parseIdentityReference(
  identity: string
): IdentityReference {
  const pattern = /^(eip155):(\d+)\/(0x[a-fA-F0-9]{40})$/;
  const match = identity.match(pattern);
  
  if (!match) {
    throw new Error(`Invalid identity reference format: ${identity}`);
  }
  
  return {
    chainNamespace: match[1],
    chainId: parseInt(match[2], 10),
    address: match[3].toLowerCase(),
  };
}

/**
 * Validate identity reference format
 */
export function isValidIdentityReference(identity: string): boolean {
  try {
    parseIdentityReference(identity);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create an identity reference string
 */
export function createIdentityReference(
  chainNamespace: string,
  chainId: number,
  address: string
): string {
  return `${chainNamespace}:${chainId}/${address.toLowerCase()}`;
}

// ============================================================================
// USDC Amount Utilities
// ============================================================================

const USDC_DECIMALS = 6;

/**
 * Format USDC amount (in base units) to decimal string
 */
export function formatUsdcAmount(amount: number | bigint): string {
  const amountBigInt = BigInt(amount);
  const divisor = BigInt(10 ** USDC_DECIMALS);
  const whole = amountBigInt / divisor;
  const fractional = amountBigInt % divisor;
  
  const fractionalStr = fractional.toString().padStart(USDC_DECIMALS, '0');
  return `${whole}.${fractionalStr}`;
}

/**
 * Parse decimal USDC amount to base units
 */
export function parseUsdcAmount(amount: number): number {
  return Math.round(amount * 10 ** USDC_DECIMALS);
}

// ============================================================================
// Logging Utilities
// ============================================================================

const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'authorization',
  'cookie',
  'session',
];

/**
 * Sanitize object for logging by redacting sensitive values
 */
export function sanitizeForLogging<T extends Record<string, unknown>>(
  obj: T,
  additionalSensitiveKeys?: string[]
): T {
  const keysToRedact = new Set([
    ...SENSITIVE_KEYS,
    ...(additionalSensitiveKeys || []),
  ]);
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (keysToRedact.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(
        value as Record<string, unknown>,
        additionalSensitiveKeys
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

// ============================================================================
// Retry Utilities
// ============================================================================

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
};

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      if (opts.retryableErrors && !opts.retryableErrors.includes(lastError.message)) {
        throw lastError;
      }
      
      // Don't retry after last attempt
      if (attempt === opts.maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = opts.delayMs * Math.pow(opts.backoffMultiplier, attempt);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Object Utilities
// ============================================================================

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>
): T {
  const result: Record<string, unknown> = { ...target };
  
  for (const [key, value] of Object.entries(source)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }
  
  return result as T;
}

/**
 * Pick specific keys from an object
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}

/**
 * Omit specific keys from an object
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Check if value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

/**
 * Check if value is a valid Ethereum address
 */
export function isValidEthereumAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

/**
 * Check if value is a valid URL
 */
export function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
