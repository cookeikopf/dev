/**
 * AgentLink Core - x402 Payment Module
 */

import type {
  X402Config,
  PaymentRequirement,
  PaymentProof,
  CapabilityContext,
} from '../types/index.js';
import { generateUUID } from '../utils/index.js';

// Default USDC addresses by chain
export const DEFAULT_USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86a33E6441e0A421e56E4773C3C4b0Db7E5b0', // Ethereum
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
};

// Payment timeout in seconds (default: 5 minutes)
const DEFAULT_PAYMENT_TIMEOUT = 300;

export interface PaymentVerificationResult {
  valid: boolean;
  error?: string;
  amount?: number;
  payer?: string;
}

/**
 * Create a payment requirement for x402
 */
export function createPaymentRequirement(
  amount: number,
  config: X402Config
): PaymentRequirement {
  const usdcAddress = config.usdcAddress || DEFAULT_USDC_ADDRESSES[config.chainId];
  
  if (!usdcAddress) {
    throw new Error(`No USDC address configured for chain ${config.chainId}`);
  }

  const timeout = config.timeout || DEFAULT_PAYMENT_TIMEOUT;
  
  return {
    amount,
    token: usdcAddress,
    chainId: config.chainId,
    receiver: config.receiver,
    paymentId: generateUUID(),
    expiresAt: Math.floor(Date.now() / 1000) + timeout,
  };
}

/**
 * Create a 402 Payment Required response
 */
export function createPaymentRequiredResponse(
  requirement: PaymentRequirement,
  message?: string
): {
  status: 402;
  paymentRequired: PaymentRequirement;
  message: string;
} {
  const formattedAmount = (requirement.amount / 1_000_000).toFixed(6);
  
  return {
    status: 402,
    paymentRequired: requirement,
    message: message || `Payment required: ${formattedAmount} USDC`,
  };
}

/**
 * Parse payment proof from request header
 */
export function parsePaymentProof(headerValue: string): PaymentProof {
  try {
    const proof = JSON.parse(headerValue) as PaymentProof;
    
    // Validate required fields
    if (!proof.txHash) {
      throw new Error('Missing txHash in payment proof');
    }
    if (!proof.amount || typeof proof.amount !== 'number') {
      throw new Error('Missing or invalid amount in payment proof');
    }
    if (!proof.token) {
      throw new Error('Missing token in payment proof');
    }
    if (!proof.chainId || typeof proof.chainId !== 'number') {
      throw new Error('Missing or invalid chainId in payment proof');
    }
    if (!proof.receiver) {
      throw new Error('Missing receiver in payment proof');
    }
    if (!proof.paymentId) {
      throw new Error('Missing paymentId in payment proof');
    }
    
    return proof;
  } catch (error) {
    throw new Error(
      `Invalid payment proof: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Verify a payment proof
 */
export async function verifyPayment(
  proof: PaymentProof,
  expectedAmount: number,
  config: X402Config
): Promise<PaymentVerificationResult> {
  // Check if custom verification is provided
  if (config.verifyPayment) {
    try {
      const valid = await config.verifyPayment(proof.txHash, proof.amount);
      return {
        valid,
        error: valid ? undefined : 'Payment verification failed',
      };
    } catch (error) {
      return {
        valid: false,
        error: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Default verification logic
  // In production, this would query the blockchain
  // For now, we do basic validation
  
  // Validate amount matches
  if (proof.amount !== expectedAmount) {
    return {
      valid: false,
      error: `Amount mismatch: expected ${expectedAmount}, got ${proof.amount}`,
    };
  }
  
  // Validate receiver matches
  if (proof.receiver.toLowerCase() !== config.receiver.toLowerCase()) {
    return {
      valid: false,
      error: 'Receiver address mismatch',
    };
  }
  
  // Validate chain ID matches
  if (proof.chainId !== config.chainId) {
    return {
      valid: false,
      error: `Chain ID mismatch: expected ${config.chainId}, got ${proof.chainId}`,
    };
  }
  
  // Validate token address
  const expectedToken = config.usdcAddress || DEFAULT_USDC_ADDRESSES[config.chainId];
  if (proof.token.toLowerCase() !== expectedToken?.toLowerCase()) {
    return {
      valid: false,
      error: 'Token address mismatch',
    };
  }
  
  return { valid: true };
}

/**
 * Check if a capability requires payment
 */
export function requiresPayment(
  capabilityId: string,
  context: CapabilityContext
): { required: boolean; amount?: number } {
  const capability = context.agent.getCapability(capabilityId);
  
  if (!capability) {
    return { required: false };
  }
  
  if (capability.pricing && capability.pricing > 0) {
    return { required: true, amount: capability.pricing };
  }
  
  return { required: false };
}

/**
 * Format payment amount for display
 */
export function formatPaymentAmount(amount: number): string {
  return `${(amount / 1_000_000).toFixed(6)} USDC`;
}

/**
 * Get USDC address for a chain
 */
export function getUsdcAddress(chainId: number, customAddress?: string): string {
  if (customAddress) {
    return customAddress;
  }
  
  const address = DEFAULT_USDC_ADDRESSES[chainId];
  if (!address) {
    throw new Error(`No default USDC address for chain ${chainId}`);
  }
  
  return address;
}

/**
 * Validate x402 configuration
 */
export function validateX402Config(config: X402Config): string[] {
  const errors: string[] = [];
  
  if (!config.receiver) {
    errors.push('Receiver address is required');
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(config.receiver)) {
    errors.push('Invalid receiver address format');
  }
  
  if (!config.chainId || config.chainId <= 0) {
    errors.push('Valid chain ID is required');
  }
  
  if (config.usdcAddress && !/^0x[a-fA-F0-9]{40}$/.test(config.usdcAddress)) {
    errors.push('Invalid USDC address format');
  }
  
  if (config.timeout !== undefined && config.timeout < 0) {
    errors.push('Timeout must be non-negative');
  }
  
  return errors;
}

// Payment store for tracking pending payments (in-memory)
const pendingPayments = new Map<string, PaymentRequirement>();

/**
 * Store a pending payment requirement
 */
export function storePendingPayment(requirement: PaymentRequirement): void {
  pendingPayments.set(requirement.paymentId, requirement);
  
  // Auto-expire after timeout
  const timeoutMs = (requirement.expiresAt * 1000) - Date.now();
  if (timeoutMs > 0) {
    setTimeout(() => {
      pendingPayments.delete(requirement.paymentId);
    }, timeoutMs);
  }
}

/**
 * Get a pending payment requirement
 */
export function getPendingPayment(paymentId: string): PaymentRequirement | undefined {
  const payment = pendingPayments.get(paymentId);
  
  if (!payment) {
    return undefined;
  }
  
  // Check if expired
  if (Date.now() / 1000 > payment.expiresAt) {
    pendingPayments.delete(paymentId);
    return undefined;
  }
  
  return payment;
}

/**
 * Remove a pending payment
 */
export function removePendingPayment(paymentId: string): boolean {
  return pendingPayments.delete(paymentId);
}

/**
 * Clear all pending payments (mainly for testing)
 */
export function clearPendingPayments(): void {
  pendingPayments.clear();
}
