# x402 Payment Protocol - AgentLink MVP Implementation

A complete implementation of the [x402 Payment Protocol](https://x402.org/) for AgentLink MVP, enabling programmatic micropayments over HTTP using the 402 Payment Required status code.

## Features

- **402 Challenge/Response Flow**: Server returns 402 with payment requirements, client submits payment proof
- **Multi-Framework Support**: Middleware for Hono, Express, and Next.js
- **Payment Verification**: USDC transfer verification with EIP-712 signature validation
- **Security**: Replay protection, payment validation, timeout handling
- **Facilitator Support**: Works with x402.org and Coinbase CDP facilitators
- **TypeScript**: Fully typed with comprehensive type definitions

## Installation

```bash
npm install @agentlink/x402
```

## Quick Start

### Server-Side (Hono)

```typescript
import { Hono } from 'hono';
import { x402Middleware } from '@agentlink/x402/middleware/hono';

const app = new Hono();

// Protect an endpoint with x402
app.use('/premium', x402Middleware({
  price: 0.01, // $0.01 per request
  receiverAddress: '0xYourReceiverAddress',
}));

app.get('/premium', (c) => {
  return c.json({ data: 'Premium content!' });
});
```

### Server-Side (Express)

```typescript
import express from 'express';
import { x402Middleware } from '@agentlink/x402/middleware/express';

const app = express();

app.get('/premium', 
  x402Middleware({ price: 0.01, receiverAddress: '0xYourReceiverAddress' }),
  (req, res) => {
    res.json({ data: 'Premium content!' });
  }
);
```

### Server-Side (Next.js)

```typescript
// app/api/premium/route.ts
import { withX402 } from '@agentlink/x402/middleware/next';

export const GET = withX402(
  async (req) => {
    return Response.json({ data: 'Premium content!' });
  },
  { price: 0.01, receiverAddress: '0xYourReceiverAddress' }
);
```

### Client-Side

```typescript
import { createX402Client } from '@agentlink/x402';

const client = createX402Client({
  address: '0xYourWalletAddress',
  signMessage: async (message) => wallet.signMessage(message),
});

// Automatically handles 402 responses
const response = await client.fetch('https://api.example.com/premium');
const data = await response.json();
```

## Configuration

### Basic Options

```typescript
interface X402Config {
  /** Price per request in USD (e.g., 0.01 for $0.01) */
  price: number;
  
  /** Receiver wallet address */
  receiverAddress: `0x${string}`;
  
  /** Network (default: Base Sepolia) */
  network?: ChainId;
  
  /** Token contract address (default: USDC) */
  assetAddress?: `0x${string}`;
  
  /** Payment scheme (default: exact) */
  scheme?: 'exact' | 'upto';
  
  /** Maximum timeout for payment (seconds, default: 60) */
  maxTimeoutSeconds?: number;
  
  /** Facilitator URL (default: x402.org testnet) */
  facilitatorUrl?: string;
  
  /** Optional description for the resource */
  description?: string;
}
```

### Lifecycle Hooks

```typescript
x402Middleware({
  price: 0.01,
  receiverAddress: '0x...',
  
  // Called before returning 402
  onPaymentRequired: (req, res) => {
    console.log('Payment required');
  },
  
  // Called after successful settlement
  onPaymentSettled: (settlement) => {
    console.log('Paid:', settlement.transactionHash);
  },
  
  // Called on payment failure
  onPaymentFailed: (error) => {
    console.error('Payment failed:', error);
  },
})
```

### Custom Validation

```typescript
x402Middleware({
  price: 0.01,
  receiverAddress: '0x...',
  customValidator: async (payload) => {
    // Custom validation logic
    return isAllowedAddress(payload.from);
  },
})
```

## Supported Networks

| Network | Chain ID | USDC Address |
|---------|----------|--------------|
| Base Mainnet | eip155:8453 | 0x8335...02913 |
| Base Sepolia | eip155:84532 | 0x036C...dCF7e |
| Ethereum Mainnet | eip155:1 | 0xA0b8...6C8a |
| Ethereum Sepolia | eip155:11155111 | 0x1c7D...C7238 |

## How It Works

### Payment Flow

1. **Client Request**: Client makes request to protected endpoint
2. **402 Response**: Server returns 402 with payment requirements
3. **Payment Creation**: Client creates and signs payment payload
4. **Retry with Payment**: Client retries request with payment signature
5. **Verification**: Server verifies payment via facilitator
6. **Settlement**: Facilitator settles payment on-chain
7. **Success**: Server returns requested resource

```
Client                    Server                  Facilitator
  |                         |                         |
  |---- GET /premium ----->|                         |
  |                         |                         |
  |<--- 402 + Requirements-|                         |
  |                         |                         |
  |---- Sign Payment ------|                         |
  |                         |                         |
  |---- GET /premium ----->|                         |
  |    + Payment Signature  |                         |
  |                         |---- Verify ----------->|
  |                         |<--- Valid -------------|
  |                         |                         |
  |                         |---- Settle ----------->|
  |                         |<--- Tx Hash -----------|
  |                         |                         |
  |<--- 200 + Resource -----|                         |
```

## Security

See [SECURITY.md](./SECURITY.md) for detailed security considerations.

### Key Security Features

- **Replay Protection**: Unique payment IDs prevent reuse
- **EIP-712 Signatures**: Structured signing prevents cross-context attacks
- **Expiration Times**: Payments have limited lifetime
- **Amount Validation**: Server validates payment amounts
- **Signature Verification**: All signatures are cryptographically verified

## Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Examples

See the `src/examples/` directory for complete examples:

- [Hono Example](./src/examples/hono-example.ts)
- [Express Example](./src/examples/express-example.ts)
- [Next.js Example](./src/examples/nextjs-example.ts)
- [Client Example](./src/examples/client-example.ts)

## API Reference

### Core Functions

#### `createX402Client(config)`

Create an x402 client for making paid requests.

```typescript
const client = createX402Client({
  address: '0x...',
  signMessage: async (msg) => signWithWallet(msg),
});
```

#### `createPaymentGate(config)`

Create a payment gate for manual payment handling.

```typescript
const gate = createPaymentGate({
  price: 0.01,
  receiverAddress: '0x...',
});

const result = await gate.check({ url, headers });
if (!result.valid) {
  return gate.challenge(url);
}
```

### Utilities

#### `usdToAtomic(usdAmount, decimals?)`

Convert USD amount to atomic token units.

```typescript
const atomic = usdToAtomic(0.01); // '10000' (USDC)
```

#### `atomicToUsd(atomicAmount, decimals?)`

Convert atomic units to USD.

```typescript
const usd = atomicToUsd('10000'); // 0.01
```

#### `encodeBase64(obj)` / `decodeBase64(str)`

Encode/decode objects for header transmission.

```typescript
const encoded = encodeBase64({ test: 'value' });
const decoded = decodeBase64(encoded);
```

## Facilitators

### x402.org (Testnet)

```typescript
{
  facilitatorUrl: 'https://x402.org/facilitator',
}
```

### Coinbase CDP (Mainnet + Testnet)

```typescript
{
  facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
}
```

## Troubleshooting

### Common Issues

**Payment rejected with "Invalid signature"**
- Ensure the wallet address matches the `from` field
- Verify EIP-712 domain matches the chain and token

**Payment rejected with "Payment ID already used"**
- Each payment must have a unique `paymentId`
- Use `generatePaymentId()` to create unique IDs

**Payment rejected with "Payment expired"**
- Increase `maxTimeoutSeconds` in config
- Client should submit payment before `expiresAt`

**Settlement fails**
- Check facilitator URL is correct
- Verify network is supported by facilitator
- Ensure receiver address is valid

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Resources

- [x402 Specification](https://docs.x402.org/)
- [x402 GitHub](https://github.com/coinbase/x402)
- [x402.org](https://x402.org/)
- [Coinbase CDP Documentation](https://docs.cdp.coinbase.com/x402/welcome)

## Support

For issues and questions:
- GitHub Issues: [github.com/agentlink/x402/issues](https://github.com/agentlink/x402/issues)
- Discord: [AgentLink Discord](https://discord.gg/agentlink)
