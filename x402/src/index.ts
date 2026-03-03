/**
 * x402 Payment Protocol - AgentLink MVP Implementation
 * 
 * This is the main entry point for the x402 module.
 * 
 * @example
 * ```typescript
 * // Server-side (Hono)
 * import { Hono } from 'hono';
 * import { x402Middleware } from '@agentlink/x402/middleware/hono';
 * 
 * const app = new Hono();
 * app.use('/paid', x402Middleware({ price: 0.01, receiverAddress: '0x...' }));
 * 
 * // Client-side
 * import { createX402Client } from '@agentlink/x402';
 * 
 * const client = createX402Client({
 *   address: '0x...',
 *   signMessage: async (msg) => wallet.signMessage(msg),
 * });
 * 
 * const response = await client.fetch('https://api.example.com/paid');
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export {
  // Core types
  ChainId,
  PaymentScheme,
  ResourceInfo,
  PaymentRequirements,
  PaymentRequired,
  PaymentPayload,
  SettlementResponse,
  FacilitatorClient,
  FacilitatorVerifyRequest,
  FacilitatorVerifyResponse,
  FacilitatorSettleRequest,
  FacilitatorSettleResponse,
  X402Config,
  X402Error,
  X402ErrorCode,
  PaymentReceipt,
  ReceiptStore,
  EIP712Domain,
  X402_HEADERS,
  
  // Constants
  SupportedNetworks,
  USDC_ADDRESSES,
  USDC_DECIMALS,
  DEFAULT_CONFIG,
  DEFAULT_SCHEME,
} from './types';

// ============================================================================
// Utilities
// ============================================================================

export {
  // Amount conversion
  usdToAtomic,
  atomicToUsd,
  
  // ID generation
  generatePaymentId,
  generateReceiptId,
  
  // Time utilities
  nowSeconds,
  isExpired,
  calculateExpiry,
  
  // Encoding
  encodeBase64,
  decodeBase64,
  
  // Payment building
  buildPaymentRequirements,
  buildPaymentRequired,
  
  // Validation
  validatePaymentPayload,
  validatePaymentAgainstRequirements,
  
  // EIP-712
  X402_EIP712_DOMAIN,
  X402_PAYMENT_TYPES,
  createPaymentTypedData,
  
  // Headers
  extractPaymentSignature,
  createPaymentRequiredHeaders,
  createPaymentResponseHeaders,
  
  // Receipts
  createReceipt,
  
  // Chain ID
  parseChainId,
  getEvmChainId,
  
  // Logging
  createLogger,
  
  // Retry
  withRetry,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
} from './utils';

// ============================================================================
// Verification & Settlement
// ============================================================================

export {
  // Receipt stores
  MemoryReceiptStore,
  
  // Facilitator client
  HTTPFacilitatorClient,
  
  // Local verifier
  LocalPaymentVerifier,
  
  // Payment processor
  PaymentProcessor,
  createPaymentProcessor,
  
  // Payment router
  PAYMENT_ROUTER_ADDRESSES,
  buildPaymentRouterCallData,
} from './verify';

// ============================================================================
// Challenge/Response
// ============================================================================

export {
  // Challenge handling
  handleChallenge,
  ChallengeResult,
  
  // Response creation
  createPaymentResponse,
  CreatePaymentResponseOptions,
  
  // Client
  X402Client,
  createX402Client,
  
  // Payment gate
  PaymentGate,
  createPaymentGate,
} from './challenge';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
export const X402_VERSION = 2;
