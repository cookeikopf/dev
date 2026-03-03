/**
 * x402 Express Integration Example
 * 
 * This example shows how to use x402 middleware with Express
 */

import express, { Request, Response, NextFunction } from 'express';
import {
  x402Middleware,
  getX402Settlement,
  getX402Receipt,
  getX402Payload,
  X402Request,
  conditionalX402,
} from '../middleware/express';

// Create Express app
const app = express();

// Middleware
app.use(express.json());

// Configuration
const x402Config = {
  price: 0.01, // $0.01 per request
  receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' as `0x${string}`,
  network: 'eip155:84532' as const, // Base Sepolia
  description: 'Premium API access',
  
  // Optional: Lifecycle hooks
  onPaymentRequired: (req, res) => {
    console.log('Payment required for request');
  },
  onPaymentSettled: (settlement) => {
    console.log('Payment settled:', settlement.transactionHash);
  },
  onPaymentFailed: (error) => {
    console.error('Payment failed:', error.message);
  },
};

// Public endpoint (no payment required)
app.get('/public', (req: Request, res: Response) => {
  res.json({ message: 'This is free!' });
});

// Protected endpoint (payment required)
app.get('/premium', x402Middleware(x402Config), (req: X402Request, res: Response) => {
  // Access settlement info
  const settlement = getX402Settlement(req);
  const receipt = getX402Receipt(req);
  const payload = getX402Payload(req);
  
  res.json({
    message: 'This is premium content!',
    transactionHash: settlement?.transactionHash,
    paidBy: payload?.from,
    amount: payload?.amount,
  });
});

// Protected POST endpoint
app.post(
  '/api/data',
  x402Middleware({
    price: 0.05, // Higher price for write operations
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
  }),
  (req: X402Request, res: Response) => {
    const settlement = getX402Settlement(req);
    
    // Process the request
    const data = req.body;
    
    res.json({
      success: true,
      data,
      transactionHash: settlement?.transactionHash,
    });
  }
);

// Conditional payment based on request
app.get(
  '/conditional',
  conditionalX402(
    (req) => req.query.free !== 'true',
    x402Config
  ),
  (req: Request, res: Response) => {
    res.json({ message: 'Conditional access!' });
  }
);

// Custom validation example
app.get(
  '/vip-only',
  x402Middleware({
    ...x402Config,
    customValidator: async (payload) => {
      // Check if payer is in VIP list
      const vipAddresses = [
        '0x1234567890123456789012345678901234567890',
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      ];
      
      return vipAddresses.includes(payload.from.toLowerCase());
    },
  }),
  (req: X402Request, res: Response) => {
    res.json({ message: 'VIP content!' });
  }
);

// Rate-limited paid endpoint
import rateLimit from 'express-rate-limit';

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many payment attempts',
});

app.get(
  '/rate-limited',
  paymentLimiter,
  x402Middleware(x402Config),
  (req: Request, res: Response) => {
    res.json({ message: 'Rate-limited premium content!' });
  }
);

// Multiple pricing tiers
app.get(
  '/basic',
  x402Middleware({
    price: 0.001,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
  }),
  (req: Request, res: Response) => {
    res.json({ tier: 'basic', price: '$0.001' });
  }
);

app.get(
  '/standard',
  x402Middleware({
    price: 0.01,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
  }),
  (req: Request, res: Response) => {
    res.json({ tier: 'standard', price: '$0.01' });
  }
);

app.get(
  '/enterprise',
  x402Middleware({
    price: 0.1,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
  }),
  (req: Request, res: Response) => {
    res.json({ tier: 'enterprise', price: '$0.10' });
  }
);

// Webhook endpoint that processes payments
app.post(
  '/webhooks/process',
  x402Middleware({
    price: 0.02,
    receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
  }),
  (req: X402Request, res: Response) => {
    const settlement = getX402Settlement(req);
    const payload = getX402Payload(req);
    
    // Process webhook
    console.log('Processing webhook for:', payload?.from);
    console.log('Transaction:', settlement?.transactionHash);
    
    res.json({
      processed: true,
      transactionHash: settlement?.transactionHash,
    });
  }
);

// Health check (no payment)
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
