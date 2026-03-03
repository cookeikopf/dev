/**
 * x402 Hono Integration Example
 * 
 * This example shows how to use x402 middleware with Hono
 */

import { Hono } from 'hono';
import { x402Middleware, getX402Settlement } from '../middleware/hono';

// Create Hono app
const app = new Hono();

// Configuration
const x402Config = {
  price: 0.01, // $0.01 per request
  receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' as `0x${string}`,
  network: 'eip155:84532' as const, // Base Sepolia
  description: 'Premium API access',
  // Optional: Use custom facilitator
  // facilitatorUrl: 'https://x402.org/facilitator',
  
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
app.get('/public', (c) => {
  return c.json({ message: 'This is free!' });
});

// Protected endpoint (payment required)
app.use('/premium', x402Middleware(x402Config));

app.get('/premium', (c) => {
  // Access settlement info if needed
  const settlement = getX402Settlement(c);
  
  return c.json({
    message: 'This is premium content!',
    transactionHash: settlement?.transactionHash,
  });
});

// Protected endpoint with custom validation
app.use('/custom-validation', x402Middleware({
  ...x402Config,
  customValidator: async (payload) => {
    // Custom validation logic
    console.log('Validating payment from:', payload.from);
    
    // Example: Check if address is in allowlist
    const allowlist = ['0x1234...', '0x5678...'];
    return allowlist.includes(payload.from);
  },
}));

app.get('/custom-validation', (c) => {
  return c.json({ message: 'Custom validation passed!' });
});

// Conditional payment (skip for certain requests)
app.use('/conditional', x402Middleware({
  ...x402Config,
  skip: (c) => {
    // Skip payment for requests with special header
    return c.req.header('X-Skip-Payment') === 'true';
  },
}));

app.get('/conditional', (c) => {
  return c.json({ message: 'Conditional access!' });
});

// Multiple pricing tiers
const basicConfig = {
  price: 0.001,
  receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' as `0x${string}`,
};

const premiumConfig = {
  price: 0.01,
  receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' as `0x${string}`,
};

const enterpriseConfig = {
  price: 0.1,
  receiverAddress: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' as `0x${string}`,
};

app.use('/basic', x402Middleware(basicConfig));
app.use('/premium-tier', x402Middleware(premiumConfig));
app.use('/enterprise', x402Middleware(enterpriseConfig));

app.get('/basic', (c) => c.json({ tier: 'basic' }));
app.get('/premium-tier', (c) => c.json({ tier: 'premium' }));
app.get('/enterprise', (c) => c.json({ tier: 'enterprise' }));

// Error handling
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Start server
const port = process.env.PORT || 3000;
console.log(`Server running on port ${port}`);

export default app;
