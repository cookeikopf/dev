/**
 * AgentLink Core - Main Entry Point
 * 
 * A TypeScript SDK for building agentic services with:
 * - A2A Protocol - Agent-to-Agent communication standard
 * - x402 Payments - HTTP 402 payment protection for endpoints
 * - ERC-8004 Identity - Blockchain-based agent identity
 * - Framework Adapters - First-class support for Hono, Express, and Next.js
 */

// ============================================================================
// Core Exports
// ============================================================================

export { createAgent } from './agent.js';
export { createCapability, CapabilityBuilder } from './capability.js';
export { createTelemetryEmitter } from './telemetry.js';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Agent Types
  Agent,
  AgentConfig,
  AgentCard,
  AgentCapabilities,
  AgentSkill,
  ProviderInfo,
  
  // Capability Types
  Capability,
  CapabilityInfo,
  CapabilityHandler,
  CapabilityContext,
  CapabilityExample,
  InputSchema,
  OutputSchema,
  
  // Context Types
  RequestContext,
  PaymentContext,
  
  // A2A Types
  A2AConfig,
  
  // x402 Types
  X402Config,
  PaymentRequirement,
  PaymentProof,
  
  // Telemetry Types
  TelemetryConfig,
  TelemetryHooks,
  TelemetryEmitter,
  CapabilityInvokeEvent,
  PaymentReceivedEvent,
  ErrorEvent,
  
  // Adapter Types
  AdapterOptions,
  CorsConfig,
  HTTPRequest,
  HTTPResponse,
  
  // Utility Types
  RetryOptions,
  IdentityReference,
} from './types/index.js';

// ============================================================================
// x402 Payment Exports
// ============================================================================

export {
  createPaymentRequirement,
  createPaymentRequiredResponse,
  parsePaymentProof,
  verifyPayment,
  requiresPayment,
  formatPaymentAmount,
  getUsdcAddress,
  validateX402Config,
  storePendingPayment,
  getPendingPayment,
  removePendingPayment,
  clearPendingPayments,
  DEFAULT_USDC_ADDRESSES,
} from './x402/index.js';

export type { PaymentVerificationResult } from './x402/index.js';

// ============================================================================
// Utility Exports
// ============================================================================

export {
  // ID Generation
  generateId,
  generateUUID,
  
  // Identity Utilities
  parseIdentityReference,
  isValidIdentityReference,
  createIdentityReference,
  
  // USDC Utilities
  formatUsdcAmount,
  parseUsdcAmount,
  
  // Logging Utilities
  sanitizeForLogging,
  
  // Retry Utilities
  withRetry,
  sleep,
  
  // Object Utilities
  deepMerge,
  pick,
  omit,
  
  // Validation Utilities
  isNonEmptyString,
  isPositiveNumber,
  isValidEthereumAddress,
  isValidUrl,
} from './utils/index.js';

// ============================================================================
// Adapter Exports
// ============================================================================

export { honoAdapter, createCapabilityHandler } from './adapters/hono.js';
export type { HonoAdapterOptions } from './adapters/hono.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';

/**
 * Get SDK version information
 */
export function getVersion(): { version: string; name: string } {
  return {
    version: VERSION,
    name: '@agentlink/core',
  };
}
