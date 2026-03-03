# x402 Payment Protocol - Security Considerations

This document outlines security considerations for implementing and deploying the x402 Payment Protocol in the AgentLink MVP.

## Table of Contents

1. [Overview](#overview)
2. [Threat Model](#threat-model)
3. [Replay Attack Prevention](#replay-attack-prevention)
4. [Signature Verification](#signature-verification)
5. [Payment Validation](#payment-validation)
6. [Timeout Handling](#timeout-handling)
7. [Network Security](#network-security)
8. [Facilitator Security](#facilitator-security)
9. [Client Security](#client-security)
10. [Deployment Security](#deployment-security)
11. [Incident Response](#incident-response)

## Overview

The x402 protocol enables programmatic payments over HTTP using the 402 Payment Required status code. While the protocol is designed with security in mind, proper implementation is crucial to prevent attacks.

### Security Principles

1. **Trust Minimization**: No party should need to trust another beyond cryptographic verification
2. **Non-Custodial**: Facilitators never hold user funds
3. **Atomic Operations**: Payment verification and settlement are atomic
4. **Transparency**: All payment data is signed and verifiable

## Threat Model

### Threat Actors

| Actor | Motivation | Capabilities |
|-------|-----------|--------------|
| Malicious Client | Get free access | Can forge payments, replay old payments |
| Malicious Server | Steal funds | Can claim unearned payments |
| Malicious Facilitator | Steal funds | Can censor or misroute payments |
| Network Attacker | Disrupt service | Can intercept/modify requests |

### Attack Vectors

1. **Replay Attacks**: Reusing old payment signatures
2. **Signature Forgery**: Creating fake signatures
3. **Amount Manipulation**: Paying less than required
4. **Timing Attacks**: Exploiting race conditions
5. **Man-in-the-Middle**: Intercepting payment data

## Replay Attack Prevention

### The Problem

An attacker could capture a valid payment and replay it to access resources multiple times without paying.

### Mitigation Strategies

#### 1. Unique Payment IDs (Nonces)

Every payment must have a unique `paymentId` that can only be used once:

```typescript
const paymentId = generatePaymentId(); // timestamp + random
```

#### 2. Receipt Store

Store used payment IDs to prevent reuse:

```typescript
const store = new MemoryReceiptStore();

// Before processing
if (await store.isPaymentIdUsed(paymentId)) {
  throw new Error('Payment ID already used');
}

// After successful settlement
await store.store(receipt);
```

#### 3. Expiration Times

Payments have a limited lifetime:

```typescript
const expiresAt = nowSeconds() + maxTimeoutSeconds;
```

### Implementation

```typescript
// In PaymentProcessor
async verify(payload: PaymentPayload, requirements: PaymentRequirements) {
  // Check if payment ID already used
  const isUsed = await this.receiptStore.isPaymentIdUsed(payload.paymentId);
  if (isUsed) {
    return { valid: false, error: 'Payment ID already used' };
  }
  
  // Check expiration
  if (isExpired(payload.expiresAt)) {
    return { valid: false, error: 'Payment has expired' };
  }
  
  // ... rest of verification
}
```

## Signature Verification

### EIP-712 Typed Data Signing

x402 uses EIP-712 for structured data signing:

```typescript
const domain = {
  name: 'x402 Payment Protocol',
  version: '2',
  chainId: 84532,
  verifyingContract: assetAddress,
};

const types = {
  Payment: [
    { name: 'scheme', type: 'string' },
    { name: 'network', type: 'string' },
    { name: 'amount', type: 'string' },
    { name: 'asset', type: 'address' },
    { name: 'payTo', type: 'address' },
    { name: 'paymentId', type: 'string' },
    { name: 'authorizedAt', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
  ],
};
```

### Verification Process

```typescript
import { verifyMessage } from 'viem';

async function verifySignature(payload: PaymentPayload): Promise<boolean> {
  const message = JSON.stringify({
    scheme: payload.scheme,
    network: payload.network,
    amount: payload.amount,
    asset: payload.asset,
    payTo: payload.payTo,
    paymentId: payload.paymentId,
    authorizedAt: payload.authorizedAt,
    expiresAt: payload.expiresAt,
  });

  return verifyMessage({
    address: payload.from,
    message,
    signature: payload.signature,
  });
}
```

### Security Considerations

1. **Always verify the signer**: Ensure the signature matches the `from` address
2. **Use EIP-712**: Structured signing prevents signature reuse across different contexts
3. **Verify domain separator**: Ensure the signature is for the correct chain and contract

## Payment Validation

### Required Checks

1. **Scheme Match**: Payment scheme must match requirements
2. **Network Match**: Chain ID must be supported
3. **Asset Match**: Token contract must be expected
4. **Recipient Match**: `payTo` must match server's address
5. **Amount Check**: Paid amount must be >= required amount
6. **Expiration Check**: Payment must not be expired
7. **Signature Validity**: Signature must be valid

### Implementation

```typescript
function validatePayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): { valid: boolean; error?: string } {
  // Scheme
  if (payload.scheme !== requirements.scheme) {
    return { valid: false, error: 'Scheme mismatch' };
  }
  
  // Network
  if (payload.network !== requirements.network) {
    return { valid: false, error: 'Network mismatch' };
  }
  
  // Asset
  if (payload.asset.toLowerCase() !== requirements.asset.toLowerCase()) {
    return { valid: false, error: 'Asset mismatch' };
  }
  
  // Recipient
  if (payload.payTo.toLowerCase() !== requirements.payTo.toLowerCase()) {
    return { valid: false, error: 'Recipient mismatch' };
  }
  
  // Amount
  if (BigInt(payload.amount) < BigInt(requirements.amount)) {
    return { valid: false, error: 'Insufficient amount' };
  }
  
  // Expiration
  if (isExpired(payload.expiresAt)) {
    return { valid: false, error: 'Payment expired' };
  }
  
  return { valid: true };
}
```

## Timeout Handling

### Payment Expiration

Payments must expire to prevent indefinite replay:

```typescript
const maxTimeoutSeconds = 60; // 1 minute default
const expiresAt = nowSeconds() + maxTimeoutSeconds;
```

### Request Timeout

Server should timeout waiting for payment:

```typescript
const requestTimeout = 30000; // 30 seconds
```

### Settlement Timeout

Facilitator settlement should have a timeout:

```typescript
const settlementTimeout = 60000; // 1 minute
```

## Network Security

### HTTPS Required

Always use HTTPS in production:

```typescript
// Reject HTTP requests in production
if (process.env.NODE_ENV === 'production' && !req.secure) {
  return res.status(400).json({ error: 'HTTPS required' });
}
```

### Header Security

Protect against header injection:

```typescript
// Validate header format
const signature = extractPaymentSignature(headers);
if (!signature) {
  return res.status(402).json({ error: 'Payment required' });
}

// Validate base64 encoding
try {
  const payload = decodeBase64<PaymentPayload>(signature);
} catch {
  return res.status(400).json({ error: 'Invalid payment format' });
}
```

### CORS Configuration

Configure CORS properly:

```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-PAYMENT-SIGNATURE'],
  exposedHeaders: ['X-PAYMENT-REQUIRED', 'X-PAYMENT-RESPONSE'],
}));
```

## Facilitator Security

### Facilitator Selection

Choose reputable facilitators:

| Facilitator | URL | Networks |
|------------|-----|----------|
| x402.org | https://x402.org/facilitator | Testnet only |
| Coinbase CDP | https://api.cdp.coinbase.com/platform/v2/x402 | Mainnet + Testnet |

### Facilitator Verification

Verify facilitator responses:

```typescript
const facilitator = new HTTPFacilitatorClient(facilitatorUrl);

// Verify settlement
const settlement = await facilitator.settle({
  x402Version: 2,
  paymentPayload,
  paymentRequirements,
});

if (!settlement.success) {
  throw new Error(`Settlement failed: ${settlement.error}`);
}

// Verify transaction on-chain
const receipt = await publicClient.waitForTransactionReceipt({
  hash: settlement.transactionHash!,
});

if (receipt.status !== 'success') {
  throw new Error('Transaction failed on-chain');
}
```

### Fallback Facilitators

Configure multiple facilitators for redundancy:

```typescript
const facilitators = [
  'https://x402.org/facilitator',
  'https://backup-facilitator.example.com',
];

async function settleWithFallback(request: FacilitatorSettleRequest) {
  for (const url of facilitators) {
    try {
      const client = new HTTPFacilitatorClient(url);
      return await client.settle(request);
    } catch (error) {
      console.warn(`Facilitator ${url} failed, trying next...`);
    }
  }
  throw new Error('All facilitators failed');
}
```

## Client Security

### Wallet Security

1. **Private Key Protection**: Never expose private keys in client-side code
2. **Secure Signing**: Use hardware wallets or secure enclaves when possible
3. **Transaction Review**: Show users what they're paying for

### Payment Approval

Implement payment approval UI:

```typescript
async function approvePayment(requirements: PaymentRequirements): Promise<boolean> {
  const amount = atomicToUsd(requirements.amount);
  
  // Show confirmation dialog
  const confirmed = await showPaymentDialog({
    amount,
    asset: 'USDC',
    recipient: requirements.payTo,
    description: 'Access premium API endpoint',
  });
  
  return confirmed;
}
```

### Receipt Storage

Store receipts securely:

```typescript
const client = new X402Client({
  address: walletAddress,
  signMessage,
  receiptStore: new SecureReceiptStore(), // Encrypted storage
});
```

## Deployment Security

### Environment Variables

Secure configuration:

```bash
# .env
X402_RECEIVER_ADDRESS=0x...
X402_NETWORK=eip155:8453
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_PRICE_USD=0.01
```

### Rate Limiting

Prevent abuse:

```typescript
import rateLimit from 'express-rate-limit';

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many payment attempts',
});

app.use('/paid-endpoint', paymentLimiter, x402Middleware(config));
```

### Monitoring

Log payment events:

```typescript
app.use('/paid-endpoint', x402Middleware({
  ...config,
  onPaymentSettled: (settlement) => {
    logger.info('Payment settled', {
      txHash: settlement.transactionHash,
      amount: settlement.amount,
      timestamp: new Date().toISOString(),
    });
  },
  onPaymentFailed: (error) => {
    logger.error('Payment failed', {
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  },
}));
```

## Incident Response

### Suspicious Activity Detection

Monitor for:

1. **Multiple failed payments** from same address
2. **Rapid payment attempts** (possible brute force)
3. **Invalid signatures** (possible forgery attempts)
4. **Replay attempts** (duplicate payment IDs)

### Response Procedures

```typescript
// Block suspicious addresses
const blockedAddresses = new Set<string>();

app.use((req, res, next) => {
  const payload = extractPaymentPayload(req);
  if (payload && blockedAddresses.has(payload.from)) {
    return res.status(403).json({ error: 'Address blocked' });
  }
  next();
});

// Auto-block on repeated failures
const failureCounts = new Map<string, number>();

function recordFailure(address: string) {
  const count = (failureCounts.get(address) || 0) + 1;
  failureCounts.set(address, count);
  
  if (count > 10) {
    blockedAddresses.add(address);
    logger.warn(`Auto-blocked address: ${address}`);
  }
}
```

### Emergency Shutdown

```typescript
let paymentsEnabled = true;

app.use('/paid-endpoint', (req, res, next) => {
  if (!paymentsEnabled) {
    return res.status(503).json({ error: 'Payments temporarily disabled' });
  }
  next();
}, x402Middleware(config));

// Emergency shutdown endpoint (protected)
app.post('/admin/disable-payments', authenticateAdmin, (req, res) => {
  paymentsEnabled = false;
  res.json({ status: 'payments disabled' });
});
```

## Security Checklist

- [ ] HTTPS enabled in production
- [ ] Payment IDs are unique and stored
- [ ] Signatures are verified using EIP-712
- [ ] Payment amounts are validated
- [ ] Expiration times are enforced
- [ ] Replay attacks are prevented
- [ ] Facilitator responses are verified
- [ ] Rate limiting is implemented
- [ ] Monitoring and logging are enabled
- [ ] Incident response plan is documented
- [ ] Private keys are securely stored
- [ ] CORS is properly configured

## References

- [x402 Specification](https://docs.x402.org/)
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712)
- [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
