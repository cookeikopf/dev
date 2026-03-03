/**
 * x402 Payment Protocol - Core Types
 * Based on x402 Specification v2
 * https://github.com/coinbase/x402
 */

// ============================================================================
// Network Identifiers (CAIP-2)
// ============================================================================

/**
 * CAIP-2 Chain Identifier
 * Format: namespace:reference
 * Examples:
 *   - eip155:8453 (Base Mainnet)
 *   - eip155:84532 (Base Sepolia)
 *   - eip155:1 (Ethereum Mainnet)
 */
export type ChainId = `eip155:${number}` | string;

/**
 * Supported networks for AgentLink MVP
 */
export const SupportedNetworks = {
  BASE_MAINNET: 'eip155:8453' as ChainId,
  BASE_SEPOLIA: 'eip155:84532' as ChainId,
  ETHEREUM_MAINNET: 'eip155:1' as ChainId,
  ETHEREUM_SEPOLIA: 'eip155:11155111' as ChainId,
} as const;

// ============================================================================
// Payment Schemes
// ============================================================================

/**
 * Payment scheme types
 * - exact: Exact amount payment
 * - upto: Up to a maximum amount (for variable pricing)
 */
export type PaymentScheme = 'exact' | 'upto';

/**
 * Default scheme for AgentLink MVP
 */
export const DEFAULT_SCHEME: PaymentScheme = 'exact';

// ============================================================================
// Token Addresses
// ============================================================================

/**
 * USDC contract addresses by network
 */
export const USDC_ADDRESSES: Record<ChainId, `0x${string}`> = {
  [SupportedNetworks.BASE_MAINNET]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [SupportedNetworks.BASE_SEPOLIA]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  [SupportedNetworks.ETHEREUM_MAINNET]: '0xA0b86a33E6441E6C7D3D4B4f6c7B8a9D2E4F6C8a',
  [SupportedNetworks.ETHEREUM_SEPOLIA]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
};

/**
 * Token decimals (USDC has 6 decimals)
 */
export const USDC_DECIMALS = 6;

// ============================================================================
// Core Payment Types
// ============================================================================

/**
 * Resource information describing the protected resource
 */
export interface ResourceInfo {
  /** URL of the protected resource */
  url: string;
  /** Human-readable description */
  description?: string;
  /** MIME type of the resource */
  mimeType?: string;
}

/**
 * Payment requirements for a specific scheme/network combination
 */
export interface PaymentRequirements {
  /** Payment scheme identifier */
  scheme: PaymentScheme;
  /** Blockchain network identifier (CAIP-2) */
  network: ChainId;
  /** Required payment amount in atomic token units */
  amount: string;
  /** Token contract address or currency code */
  asset: `0x${string}` | string;
  /** Recipient wallet address */
  payTo: `0x${string}`;
  /** Maximum time allowed for payment completion (seconds) */
  maxTimeoutSeconds: number;
  /** Scheme-specific additional information */
  extra?: Record<string, unknown>;
}

/**
 * Payment required response (server -> client)
 */
export interface PaymentRequired {
  /** Protocol version identifier */
  x402Version: number;
  /** Human-readable error message */
  error?: string;
  /** Resource information */
  resource: ResourceInfo;
  /** Array of acceptable payment requirements */
  accepts: PaymentRequirements[];
  /** Protocol extensions */
  extensions?: Record<string, unknown>;
}

/**
 * EIP-712 Domain for payment signing
 */
export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
}

/**
 * Payment payload (client -> server)
 */
export interface PaymentPayload {
  /** Payment scheme identifier */
  scheme: PaymentScheme;
  /** Blockchain network identifier (CAIP-2) */
  network: ChainId;
  /** Payment amount in atomic token units */
  amount: string;
  /** Token contract address */
  asset: `0x${string}`;
  /** Recipient wallet address */
  payTo: `0x${string}`;
  /** Unique payment identifier (nonce) */
  paymentId: string;
  /** Timestamp when payment was authorized */
  authorizedAt: number;
  /** Payment expiry timestamp */
  expiresAt: number;
  /** Client wallet address */
  from: `0x${string}`;
  /** EIP-712 signature */
  signature: `0x${string}`;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Settlement response (server -> client after payment)
 */
export interface SettlementResponse {
  /** Whether the payment was successfully settled */
  success: boolean;
  /** On-chain transaction hash */
  transactionHash?: `0x${string}`;
  /** Block number where transaction was included */
  blockNumber?: number;
  /** Timestamp of settlement */
  settledAt?: number;
  /** Error message if settlement failed */
  error?: string;
  /** Network identifier */
  network: ChainId;
}

// ============================================================================
// Facilitator Types
// ============================================================================

/**
 * Facilitator verification request
 */
export interface FacilitatorVerifyRequest {
  /** x402 protocol version */
  x402Version: number;
  /** Payment payload from client */
  paymentPayload: PaymentPayload;
  /** Payment requirements from server */
  paymentRequirements: PaymentRequirements;
}

/**
 * Facilitator verification response
 */
export interface FacilitatorVerifyResponse {
  /** Whether the payment is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Client address derived from signature */
  from?: `0x${string}`;
}

/**
 * Facilitator settlement request
 */
export interface FacilitatorSettleRequest {
  /** x402 protocol version */
  x402Version: number;
  /** Payment payload from client */
  paymentPayload: PaymentPayload;
  /** Payment requirements from server */
  paymentRequirements: PaymentRequirements;
}

/**
 * Facilitator settlement response
 */
export interface FacilitatorSettleResponse {
  /** Whether settlement was successful */
  success: boolean;
  /** On-chain transaction hash */
  transactionHash?: `0x${string}`;
  /** Error message if settlement failed */
  error?: string;
}

/**
 * Facilitator client interface
 */
export interface FacilitatorClient {
  /** Verify a payment payload */
  verify(request: FacilitatorVerifyRequest): Promise<FacilitatorVerifyResponse>;
  /** Settle a payment on-chain */
  settle(request: FacilitatorSettleRequest): Promise<FacilitatorSettleResponse>;
}

// ============================================================================
// Middleware Configuration
// ============================================================================

/**
 * x402 middleware configuration options
 */
export interface X402Config {
  /** Price per request in USD (e.g., 0.01 for $0.01) */
  price: number;
  /** Receiver wallet address */
  receiverAddress: `0x${string}`;
  /** Network identifier (default: Base Sepolia) */
  network?: ChainId;
  /** Token contract address (default: USDC) */
  assetAddress?: `0x${string}`;
  /** Payment scheme (default: exact) */
  scheme?: PaymentScheme;
  /** Maximum timeout for payment (seconds, default: 60) */
  maxTimeoutSeconds?: number;
  /** Facilitator URL (default: x402.org testnet facilitator) */
  facilitatorUrl?: string;
  /** Optional description for the resource */
  description?: string;
  /** Custom payment validator function */
  customValidator?: (payload: PaymentPayload) => Promise<boolean> | boolean;
  /** Called before processing payment-required response */
  onPaymentRequired?: (req: unknown, res: unknown) => void | Promise<void>;
  /** Called after successful payment settlement */
  onPaymentSettled?: (settlement: SettlementResponse) => void | Promise<void>;
  /** Called on payment verification failure */
  onPaymentFailed?: (error: Error) => void | Promise<void>;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<X402Config> = {
  network: SupportedNetworks.BASE_SEPOLIA,
  scheme: 'exact',
  maxTimeoutSeconds: 60,
  facilitatorUrl: 'https://x402.org/facilitator',
};

// ============================================================================
// HTTP Headers
// ============================================================================

/**
 * x402 HTTP headers
 */
export const X402_HEADERS = {
  /** Payment requirements header (base64 encoded JSON) */
  PAYMENT_REQUIRED: 'X-PAYMENT-REQUIRED',
  /** Payment signature header (base64 encoded JSON) */
  PAYMENT_SIGNATURE: 'X-PAYMENT-SIGNATURE',
  /** Payment response header (base64 encoded JSON) */
  PAYMENT_RESPONSE: 'X-PAYMENT-RESPONSE',
  /** Legacy headers for compatibility */
  PAYMENT_REQUIRED_LEGACY: 'PAYMENT-REQUIRED',
  PAYMENT_SIGNATURE_LEGACY: 'PAYMENT-SIGNATURE',
  PAYMENT_RESPONSE_LEGACY: 'PAYMENT-RESPONSE',
} as const;

// ============================================================================
// Error Types
// ============================================================================

/**
 * x402 error codes
 */
export enum X402ErrorCode {
  INVALID_PAYMENT_PAYLOAD = 'INVALID_PAYMENT_PAYLOAD',
  PAYMENT_EXPIRED = 'PAYMENT_EXPIRED',
  PAYMENT_ALREADY_USED = 'PAYMENT_ALREADY_USED',
  INSUFFICIENT_AMOUNT = 'INSUFFICIENT_AMOUNT',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  SETTLEMENT_FAILED = 'SETTLEMENT_FAILED',
  NETWORK_MISMATCH = 'NETWORK_MISMATCH',
  ASSET_MISMATCH = 'ASSET_MISMATCH',
  FACILITATOR_ERROR = 'FACILITATOR_ERROR',
}

/**
 * x402 error class
 */
export class X402Error extends Error {
  constructor(
    message: string,
    public code: X402ErrorCode,
    public statusCode: number = 402,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'X402Error';
  }
}

// ============================================================================
// Receipt Types
// ============================================================================

/**
 * Payment receipt for client storage
 */
export interface PaymentReceipt {
  /** Unique receipt identifier */
  receiptId: string;
  /** Payment ID from payload */
  paymentId: string;
  /** Client wallet address */
  from: `0x${string}`;
  /** Server wallet address */
  to: `0x${string}`;
  /** Payment amount in atomic units */
  amount: string;
  /** Token contract address */
  asset: `0x${string}`;
  /** Network identifier */
  network: ChainId;
  /** Transaction hash */
  transactionHash: `0x${string}`;
  /** Block number */
  blockNumber: number;
  /** Timestamp of payment */
  timestamp: number;
  /** Resource URL that was paid for */
  resourceUrl: string;
  /** Receipt signature (for verification) */
  signature?: `0x${string}`;
}

/**
 * Receipt store interface
 */
export interface ReceiptStore {
  /** Store a receipt */
  store(receipt: PaymentReceipt): Promise<void>;
  /** Get a receipt by ID */
  get(receiptId: string): Promise<PaymentReceipt | null>;
  /** Get all receipts for a payment ID */
  getByPaymentId(paymentId: string): Promise<PaymentReceipt[]>;
  /** Check if a payment ID has been used */
  isPaymentIdUsed(paymentId: string): Promise<boolean>;
}
