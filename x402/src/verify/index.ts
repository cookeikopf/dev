/**
 * x402 Payment Protocol - Verification and Settlement
 */

import {
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
  FacilitatorClient,
  FacilitatorVerifyRequest,
  FacilitatorVerifyResponse,
  FacilitatorSettleRequest,
  FacilitatorSettleResponse,
  ReceiptStore,
  PaymentReceipt,
  X402Error,
  X402ErrorCode,
  X402Config,
} from '../types';
import {
  validatePaymentPayload,
  validatePaymentAgainstRequirements,
  createReceipt,
  generateReceiptId,
  withRetry,
  createLogger,
  getEvmChainId,
} from '../utils';
import { verifyMessage } from 'viem';

// ============================================================================
// In-Memory Receipt Store (for development/testing)
// ============================================================================

/**
 * Simple in-memory receipt store
 */
export class MemoryReceiptStore implements ReceiptStore {
  private receipts: Map<string, PaymentReceipt> = new Map();
  private paymentIdIndex: Map<string, Set<string>> = new Map();

  async store(receipt: PaymentReceipt): Promise<void> {
    this.receipts.set(receipt.receiptId, receipt);

    // Index by payment ID
    if (!this.paymentIdIndex.has(receipt.paymentId)) {
      this.paymentIdIndex.set(receipt.paymentId, new Set());
    }
    this.paymentIdIndex.get(receipt.paymentId)!.add(receipt.receiptId);
  }

  async get(receiptId: string): Promise<PaymentReceipt | null> {
    return this.receipts.get(receiptId) || null;
  }

  async getByPaymentId(paymentId: string): Promise<PaymentReceipt[]> {
    const receiptIds = this.paymentIdIndex.get(paymentId);
    if (!receiptIds) return [];

    return Array.from(receiptIds)
      .map((id) => this.receipts.get(id))
      .filter((r): r is PaymentReceipt => r !== undefined);
  }

  async isPaymentIdUsed(paymentId: string): Promise<boolean> {
    const receipts = this.paymentIdIndex.get(paymentId);
    return receipts !== undefined && receipts.size > 0;
  }

  /** Clear all receipts (for testing) */
  clear(): void {
    this.receipts.clear();
    this.paymentIdIndex.clear();
  }

  /** Get all receipts (for debugging) */
  getAll(): PaymentReceipt[] {
    return Array.from(this.receipts.values());
  }
}

// ============================================================================
// HTTP Facilitator Client
// ============================================================================

/**
 * HTTP-based facilitator client
 */
export class HTTPFacilitatorClient implements FacilitatorClient {
  private logger = createLogger();

  constructor(private url: string) {}

  async verify(request: FacilitatorVerifyRequest): Promise<FacilitatorVerifyResponse> {
    return withRetry(async () => {
      this.logger.debug('Verifying payment with facilitator', { url: this.url });

      const response = await fetch(`${this.url}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new X402Error(
          `Facilitator verification failed: ${error}`,
          X402ErrorCode.FACILITATOR_ERROR,
          response.status
        );
      }

      return response.json();
    });
  }

  async settle(request: FacilitatorSettleRequest): Promise<FacilitatorSettleResponse> {
    return withRetry(async () => {
      this.logger.debug('Settling payment with facilitator', { url: this.url });

      const response = await fetch(`${this.url}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new X402Error(
          `Facilitator settlement failed: ${error}`,
          X402ErrorCode.FACILITATOR_ERROR,
          response.status
        );
      }

      return response.json();
    });
  }
}

// ============================================================================
// Local Payment Verifier (without facilitator)
// ============================================================================

/**
 * Local payment verifier using direct signature verification
 * This can be used for testing or when you don't want to use a facilitator
 */
export class LocalPaymentVerifier {
  private logger = createLogger();

  constructor(private receiptStore: ReceiptStore = new MemoryReceiptStore()) {}

  /**
   * Verify payment locally using EIP-712 signature verification
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<{ valid: boolean; from?: `0x${string}`; error?: string }> {
    try {
      // Validate payload structure
      if (!validatePaymentPayload(payload)) {
        return { valid: false, error: 'Invalid payment payload structure' };
      }

      // Validate against requirements
      const validation = validatePaymentAgainstRequirements(payload, requirements);
      if (!validation.valid) {
        return { valid: false, error: validation.error };
      }

      // Check for replay attacks
      const isUsed = await this.receiptStore.isPaymentIdUsed(payload.paymentId);
      if (isUsed) {
        return {
          valid: false,
          error: 'Payment ID has already been used',
        };
      }

      // Verify signature
      const isValidSignature = await this.verifySignature(payload);
      if (!isValidSignature) {
        return { valid: false, error: 'Invalid signature' };
      }

      return { valid: true, from: payload.from };
    } catch (error) {
      this.logger.error('Verification error', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
      };
    }
  }

  /**
   * Verify EIP-712 signature
   */
  private async verifySignature(payload: PaymentPayload): Promise<boolean> {
    try {
      const chainId = getEvmChainId(payload.network);

      // Recreate the message that was signed
      const message = {
        scheme: payload.scheme,
        network: payload.network,
        amount: payload.amount,
        asset: payload.asset,
        payTo: payload.payTo,
        paymentId: payload.paymentId,
        authorizedAt: payload.authorizedAt,
        expiresAt: payload.expiresAt,
      };

      // Verify the signature
      const isValid = await verifyMessage({
        address: payload.from,
        message: JSON.stringify(message),
        signature: payload.signature,
      });

      return isValid;
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      return false;
    }
  }
}

// ============================================================================
// Payment Processor
// ============================================================================

/**
 * Payment processor that handles verification and settlement
 */
export class PaymentProcessor {
  private logger = createLogger();
  private receiptStore: ReceiptStore;
  private facilitator?: FacilitatorClient;
  private localVerifier: LocalPaymentVerifier;

  constructor(
    config: {
      receiptStore?: ReceiptStore;
      facilitator?: FacilitatorClient;
    } = {}
  ) {
    this.receiptStore = config.receiptStore || new MemoryReceiptStore();
    this.facilitator = config.facilitator;
    this.localVerifier = new LocalPaymentVerifier(this.receiptStore);
  }

  /**
   * Process a payment - verify and optionally settle
   */
  async process(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    options: {
      settle?: boolean;
      resourceUrl?: string;
    } = {}
  ): Promise<{
    success: boolean;
    settlement?: SettlementResponse;
    receipt?: PaymentReceipt;
    error?: string;
  }> {
    try {
      // Step 1: Verify the payment
      const verification = await this.verify(payload, requirements);
      if (!verification.valid) {
        return { success: false, error: verification.error };
      }

      // Step 2: Settle if requested
      if (options.settle) {
        const settlement = await this.settle(payload, requirements);

        if (settlement.success) {
          // Create and store receipt
          const receipt = createReceipt(
            payload,
            settlement,
            options.resourceUrl || 'unknown'
          );
          await this.receiptStore.store(receipt);

          return { success: true, settlement, receipt };
        } else {
          return { success: false, error: settlement.error };
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Payment processing error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error',
      };
    }
  }

  /**
   * Verify a payment
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<FacilitatorVerifyResponse> {
    // If facilitator is available, use it
    if (this.facilitator) {
      return this.facilitator.verify({
        x402Version: 2,
        paymentPayload: payload,
        paymentRequirements: requirements,
      });
    }

    // Otherwise use local verification
    const result = await this.localVerifier.verify(payload, requirements);
    return {
      valid: result.valid,
      error: result.error,
      from: result.from,
    };
  }

  /**
   * Settle a payment on-chain
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettlementResponse> {
    // If facilitator is available, use it
    if (this.facilitator) {
      const result = await this.facilitator.settle({
        x402Version: 2,
        paymentPayload: payload,
        paymentRequirements: requirements,
      });

      return {
        success: result.success,
        transactionHash: result.transactionHash,
        error: result.error,
        network: payload.network,
      };
    }

    // Without facilitator, we can't settle on-chain
    // This is a limitation of local-only mode
    return {
      success: false,
      error: 'No facilitator configured for on-chain settlement',
      network: payload.network,
    };
  }

  /**
   * Get the receipt store
   */
  getReceiptStore(): ReceiptStore {
    return this.receiptStore;
  }
}

// ============================================================================
// Payment Router Contract Interface (for direct settlement)
// ============================================================================

/**
 * PaymentRouter contract addresses by network
 */
export const PAYMENT_ROUTER_ADDRESSES: Record<string, `0x${string}`> = {
  'eip155:8453': '0x0000000000000000000000000000000000000000', // Base Mainnet - placeholder
  'eip155:84532': '0x0000000000000000000000000000000000000000', // Base Sepolia - placeholder
};

/**
 * Build PaymentRouter callData for direct settlement
 */
export function buildPaymentRouterCallData(
  payload: PaymentPayload,
  routerAddress: `0x${string}`
): `0x${string}` {
  // This is a simplified version - in production, you'd use the actual contract ABI
  // to encode the function call for the PaymentRouter

  // Function signature: executePayment(PaymentPayload calldata payload)
  // This would be properly encoded using viem's encodeFunctionData

  // For now, return a placeholder that indicates this is PaymentRouter mode
  return `0x${Buffer.from(JSON.stringify({
    mode: 'paymentRouter',
    routerAddress,
    payload,
  })).toString('hex')}` as `0x${string}`;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a payment processor from config
 */
export function createPaymentProcessor(
  config: X402Config
): PaymentProcessor {
  const receiptStore = new MemoryReceiptStore();

  // Create facilitator client if URL is provided
  const facilitator = config.facilitatorUrl
    ? new HTTPFacilitatorClient(config.facilitatorUrl)
    : undefined;

  return new PaymentProcessor({ receiptStore, facilitator });
}
