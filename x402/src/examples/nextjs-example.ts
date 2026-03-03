/**
 * x402 Next.js Integration Example
 * 
 * This example shows how to use x402 with Next.js App Router
 */

// ============================================================================
// Route Handler Example (app/api/premium/route.ts)
// ============================================================================

import { withX402, getX402Settlement, NextX402Options } from '../middleware/next';
import { NextRequest } from 'next/server';

// Configuration
const x402Config: NextX402Options = {
  price: 0.01,
  receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
  network: 'eip155:84532',
  description: 'Premium API access',
};

// Protected GET endpoint
export const GET = withX402(
  async (req) => {
    const settlement = getX402Settlement(req);
    
    return Response.json({
      message: 'This is premium content!',
      transactionHash: settlement?.transactionHash,
    });
  },
  x402Config
);

// Protected POST endpoint
export const POST = withX402(
  async (req) => {
    const settlement = getX402Settlement(req);
    const body = await req.json();
    
    // Process the data
    return Response.json({
      success: true,
      data: body,
      transactionHash: settlement?.transactionHash,
    });
  },
  {
    ...x402Config,
    price: 0.05, // Higher price for write operations
  }
);

// ============================================================================
// Middleware.ts Example (middleware.ts)
// ============================================================================

import { createX402Middleware } from '../middleware/next';

export const middleware = createX402Middleware({
  price: 0.01,
  receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
  network: 'eip155:84532',
  // Only apply to API routes matching this pattern
  matcher: ['/api/paid/:path*'],
  // Skip for certain requests
  skip: (req) => {
    // Skip if has valid API key
    return req.headers.get('X-API-Key') === process.env.INTERNAL_API_KEY;
  },
});

export const config = {
  matcher: ['/api/paid/:path*'],
};

// ============================================================================
// Client Component Example (app/components/PaidContent.tsx)
// ============================================================================

'use client';

import { useState } from 'react';
import { createX402Client } from '../challenge';

export function PaidContent() {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPremiumContent = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create x402 client with wallet
      const client = createX402Client({
        address: '0xYourWalletAddress',
        signMessage: async (message) => {
          // Use your wallet to sign
          // return await walletClient.signMessage({ message });
          return '0xSignature' as `0x${string}`;
        },
      });

      // Fetch with automatic payment handling
      const response = await client.fetch('/api/premium', {
        maxPayment: 0.02, // Don't pay more than $0.02
      });

      if (response.ok) {
        const data = await response.json();
        setContent(data.message);
      } else {
        setError('Failed to fetch content');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={fetchPremiumContent} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Premium Content ($0.01)'}
      </button>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {content && <p>{content}</p>}
    </div>
  );
}

// ============================================================================
// Server Action Example (app/actions/paidAction.ts)
// ============================================================================

'use server';

import { createPaymentGate } from '../challenge';

const paymentGate = createPaymentGate({
  price: 0.01,
  receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
});

export async function paidServerAction(
  paymentSignature: string,
  data: unknown
) {
  // Check payment
  const result = await paymentGate.check({
    url: 'https://your-app.com/api/action',
    headers: {
      'X-PAYMENT-SIGNATURE': paymentSignature,
    },
  });

  if (!result.valid) {
    return {
      error: 'Payment required',
      challenge: paymentGate.challenge('https://your-app.com/api/action'),
    };
  }

  // Process the action
  console.log('Processing paid action with data:', data);
  console.log('Transaction:', result.settlement?.transactionHash);

  return {
    success: true,
    transactionHash: result.settlement?.transactionHash,
  };
}

// ============================================================================
// Dynamic Pricing Example
// ============================================================================

import { withX402 } from '../middleware/next';

// Price based on request parameters
export const dynamicPricingExample = withX402(
  async (req) => {
    return Response.json({ message: 'Dynamic pricing content!' });
  },
  {
    price: 0.01,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
    // You can make price dynamic by using a custom validator
    customValidator: async (payload) => {
      // Validate based on custom logic
      return true;
    },
  }
);

// ============================================================================
// Multi-tier API Example
// ============================================================================

// Basic tier - $0.001
export const basicTier = withX402(
  async (req) => Response.json({ tier: 'basic', data: [] }),
  {
    price: 0.001,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
  }
);

// Pro tier - $0.01
export const proTier = withX402(
  async (req) => Response.json({ tier: 'pro', data: [] }),
  {
    price: 0.01,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
  }
);

// Enterprise tier - $0.10
export const enterpriseTier = withX402(
  async (req) => Response.json({ tier: 'enterprise', data: [] }),
  {
    price: 0.1,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
  }
);

// ============================================================================
// Webhook Handler Example
// ============================================================================

export const webhookHandler = withX402(
  async (req) => {
    const body = await req.json();
    const settlement = getX402Settlement(req);
    
    // Process webhook
    console.log('Webhook received:', body);
    console.log('Paid via transaction:', settlement?.transactionHash);
    
    return Response.json({
      received: true,
      transactionHash: settlement?.transactionHash,
    });
  },
  {
    price: 0.02,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
  }
);

// ============================================================================
// Error Handling Example
// ============================================================================

export const errorHandlingExample = withX402(
  async (req) => {
    try {
      // Your logic here
      return Response.json({ success: true });
    } catch (error) {
      return Response.json(
        { error: 'Processing failed' },
        { status: 500 }
      );
    }
  },
  {
    price: 0.01,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
    onPaymentFailed: async (error) => {
      // Log to your error tracking service
      console.error('Payment failed:', error);
    },
  }
);
