/**
 * x402 Client-Side Integration Example
 * 
 * This example shows how to use x402 from a client application
 */

import {
  createX402Client,
  X402Client,
  PaymentReceipt,
} from '../challenge';
import {
  encodeBase64,
  decodeBase64,
  X402_HEADERS,
} from '../utils';
import { PaymentPayload, SettlementResponse } from '../types';

// ============================================================================
// Basic Client Setup
// ============================================================================

/**
 * Create an x402 client with a wallet
 */
export function createClient(wallet: {
  address: `0x${string}`;
  signMessage: (message: string) => Promise<`0x${string}`>;
}) {
  return createX402Client({
    address: wallet.address,
    signMessage: wallet.signMessage,
  });
}

// ============================================================================
// Fetch with Payment
// ============================================================================

/**
 * Fetch data from a paid endpoint
 */
export async function fetchPaidData(
  client: X402Client,
  url: string,
  options?: {
    maxPayment?: number;
    method?: string;
    body?: unknown;
  }
) {
  const response = await client.fetch(url, {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    maxPayment: options?.maxPayment,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

// ============================================================================
// Manual Payment Flow
// ============================================================================

/**
 * Manual payment flow for more control
 */
export async function manualPaymentFlow(
  wallet: {
    address: `0x${string}`;
    signMessage: (message: string) => Promise<`0x${string}`>;
  },
  url: string
) {
  // Step 1: Make initial request
  const firstResponse = await fetch(url);

  // Step 2: Check if payment is required
  if (firstResponse.status !== 402) {
    return firstResponse.json();
  }

  // Step 3: Extract payment requirements
  const paymentRequiredHeader = firstResponse.headers.get(X402_HEADERS.PAYMENT_REQUIRED);
  if (!paymentRequiredHeader) {
    throw new Error('No payment requirements found');
  }

  const paymentRequired = decodeBase64<{
    x402Version: number;
    accepts: Array<{
      scheme: string;
      network: string;
      amount: string;
      asset: string;
      payTo: string;
      maxTimeoutSeconds: number;
    }>;
  }>(paymentRequiredHeader);

  console.log('Payment required:', paymentRequired);

  // Step 4: Select payment requirement
  const requirement = paymentRequired.accepts[0];

  // Step 5: Create payment payload
  const paymentId = `payment-${Date.now()}`;
  const authorizedAt = Math.floor(Date.now() / 1000);
  const expiresAt = authorizedAt + requirement.maxTimeoutSeconds;

  const payload: Omit<PaymentPayload, 'signature'> = {
    scheme: requirement.scheme as 'exact',
    network: requirement.network as `eip155:${number}`,
    amount: requirement.amount,
    asset: requirement.asset as `0x${string}`,
    payTo: requirement.payTo as `0x${string}`,
    paymentId,
    authorizedAt,
    expiresAt,
    from: wallet.address,
  };

  // Step 6: Sign the payload
  const message = JSON.stringify(payload);
  const signature = await wallet.signMessage(message);

  const signedPayload: PaymentPayload = {
    ...payload,
    signature,
  };

  // Step 7: Retry request with payment
  const secondResponse = await fetch(url, {
    headers: {
      [X402_HEADERS.PAYMENT_SIGNATURE]: encodeBase64(signedPayload),
    },
  });

  // Step 8: Extract settlement info
  if (secondResponse.ok) {
    const settlementHeader = secondResponse.headers.get(X402_HEADERS.PAYMENT_RESPONSE);
    if (settlementHeader) {
      const settlement = decodeBase64<SettlementResponse>(settlementHeader);
      console.log('Payment settled:', settlement.transactionHash);
    }
  }

  return secondResponse.json();
}

// ============================================================================
// React Hook Example
// ============================================================================

import { useState, useCallback } from 'react';

interface UseX402PaymentOptions {
  wallet: {
    address: `0x${string}`;
    signMessage: (message: string) => Promise<`0x${string}`>;
  };
  maxPayment?: number;
}

interface UseX402PaymentResult {
  fetchWithPayment: (url: string, options?: RequestInit) => Promise<Response>;
  isLoading: boolean;
  error: string | null;
  lastReceipt: PaymentReceipt | null;
}

/**
 * React hook for x402 payments
 */
export function useX402Payment(options: UseX402PaymentOptions): UseX402PaymentResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<PaymentReceipt | null>(null);

  const client = createClient(options.wallet);

  const fetchWithPayment = useCallback(
    async (url: string, fetchOptions?: RequestInit) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await client.fetch(url, {
          ...fetchOptions,
          maxPayment: options.maxPayment,
        });

        // Store receipt if payment was made
        if (response.ok) {
          const receipts = await client.getReceipts();
          if (receipts.length > 0) {
            setLastReceipt(receipts[receipts.length - 1]);
          }
        }

        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client, options.maxPayment]
  );

  return {
    fetchWithPayment,
    isLoading,
    error,
    lastReceipt,
  };
}

// ============================================================================
// Vue Composable Example
 * ============================================================================

import { ref, computed } from 'vue';

interface UseX402PaymentVueOptions {
  wallet: {
    address: `0x${string}`;
    signMessage: (message: string) => Promise<`0x${string}`>;
  };
  maxPayment?: number;
}

/**
 * Vue composable for x402 payments
 */
export function useX402PaymentVue(options: UseX402PaymentVueOptions) {
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastReceipt = ref<PaymentReceipt | null>(null);

  const client = createClient(options.wallet);

  const fetchWithPayment = async (url: string, fetchOptions?: RequestInit) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await client.fetch(url, {
        ...fetchOptions,
        maxPayment: options.maxPayment,
      });

      // Store receipt if payment was made
      if (response.ok) {
        const receipts = await client.getReceipts();
        if (receipts.length > 0) {
          lastReceipt.value = receipts[receipts.length - 1];
        }
      }

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      error.value = message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    fetchWithPayment,
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    lastReceipt: computed(() => lastReceipt.value),
  };
}

// ============================================================================
// Receipt Management
// ============================================================================

/**
 * Store receipts in localStorage
 */
export class LocalStorageReceiptStore {
  private key = 'x402-receipts';

  async store(receipt: PaymentReceipt): Promise<void> {
    const receipts = this.getAll();
    receipts.push(receipt);
    localStorage.setItem(this.key, JSON.stringify(receipts));
  }

  async get(receiptId: string): Promise<PaymentReceipt | null> {
    const receipts = this.getAll();
    return receipts.find((r) => r.receiptId === receiptId) || null;
  }

  async getByPaymentId(paymentId: string): Promise<PaymentReceipt[]> {
    const receipts = this.getAll();
    return receipts.filter((r) => r.paymentId === paymentId);
  }

  async isPaymentIdUsed(paymentId: string): Promise<boolean> {
    const receipts = await this.getByPaymentId(paymentId);
    return receipts.length > 0;
  }

  private getAll(): PaymentReceipt[] {
    const data = localStorage.getItem(this.key);
    return data ? JSON.parse(data) : [];
  }
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example: Fetch premium content
 */
export async function exampleFetchPremiumContent() {
  // Setup wallet (example with ethers.js)
  // const wallet = new ethers.Wallet(privateKey);
  
  const mockWallet = {
    address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
    signMessage: async (message: string) => '0xSignature' as `0x${string}`,
  };

  const client = createClient(mockWallet);

  try {
    const data = await fetchPaidData(client, 'https://api.example.com/premium', {
      maxPayment: 0.02, // Don't pay more than $0.02
    });

    console.log('Premium content:', data);
  } catch (error) {
    console.error('Failed to fetch:', error);
  }
}

/**
 * Example: React component
 */
export function ExampleReactComponent() {
  const mockWallet = {
    address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
    signMessage: async (message: string) => '0xSignature' as `0x${string}`,
  };

  const { fetchWithPayment, isLoading, error, lastReceipt } = useX402Payment({
    wallet: mockWallet,
    maxPayment: 0.02,
  });

  const handleFetch = async () => {
    try {
      const response = await fetchWithPayment('https://api.example.com/premium');
      const data = await response.json();
      console.log('Data:', data);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return {
    isLoading,
    error,
    lastReceipt,
    handleFetch,
  };
}
