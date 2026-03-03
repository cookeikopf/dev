# x402 Middleware Security Analysis

**Version:** 1.0.0  
**Date:** March 2024  
**Scope:** x402 Payment Protocol Implementation

---

## Executive Summary

The x402 protocol enables HTTP-based micropayments for agent services. This document analyzes the security of the middleware implementation that bridges HTTP requests with on-chain payment verification.

---

## 1. Protocol Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         x402 PROTOCOL FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: Client requests service
  GET /api/research HTTP/1.1
  
Step 2: Server responds with 402 + payment requirements
  HTTP/1.1 402 Payment Required
  X-Payment-Required: {
    "scheme": "x402",
    "network": "base-sepolia",
    "amount": "1000000",
    "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "receiver": "0x...",
    "deadline": 1709836800,
    "payload": "0x..."
  }

Step 3: Client creates and signs payment transaction
  → Submits to blockchain
  → Receives transaction hash

Step 4: Client retries with payment proof
  GET /api/research HTTP/1.1
  Authorization: X402 {
    "txHash": "0x...",
    "signature": "0x...",
    "nonce": "..."
  }

Step 5: Server verifies payment on-chain
  → Calls PaymentRouter.verify()
  → Returns service response
```

---

## 2. Security Requirements

### 2.1 Core Security Properties

| Property | Description | Priority |
|----------|-------------|----------|
| **Unforgeability** | Payment proofs cannot be forged | Critical |
| **Non-replayability** | Same proof cannot be used twice | Critical |
| **Timeliness** | Payments expire after deadline | High |
| **Atomicity** | Payment verification is all-or-nothing | High |
| **Authenticity** | Payer identity is verifiable | High |
| **Integrity** | Payment amount cannot be altered | High |

### 2.2 Threat Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THREAT ACTORS                                        │
└─────────────────────────────────────────────────────────────────────────────┘

1. EXTERNAL ATTACKER (No credentials)
   ├── Forge payment signatures
   ├── Replay captured payments
   ├── Manipulate payment amounts
   └── Bypass deadline checks

2. COMPROMISED CLIENT (Has valid credentials)
   ├── Reuse own payments
   ├── Share payment proofs
   └── Manipulate request parameters

3. MALICIOUS SERVER (Controls verification)
   ├── False verification results
   ├── Payment withholding
   └── Replay client payments

4. NETWORK ATTACKER (MITM position)
   ├── Intercept payment proofs
   ├── Modify payment requests
   └── Replay valid payments
```

---

## 3. Attack Vectors

### 3.1 Replay Attacks (CRITICAL)

**Description:**
An attacker captures a valid payment proof and reuses it for multiple service requests.

**Attack Scenario:**
```
1. Legitimate user pays for service A
   → Payment proof P created
   
2. Attacker intercepts/sniffs proof P

3. Attacker sends request for service B with proof P
   → Server accepts (if no replay protection)
   
4. Attacker repeats for services C, D, E...
   → Same payment used multiple times
```

**Current Implementation Status:**
- Server-side nonce tracking: NOT IMPLEMENTED
- Payment proof binding to request: NOT IMPLEMENTED
- Used-payment registry: NOT IMPLEMENTED

**Required Mitigation:**
```typescript
interface PaymentVerificationService {
  // Track used payment nonces
  private usedNonces: Set<string>;
  
  async verifyPayment(proof: PaymentProof): Promise<boolean> {
    // 1. Check nonce hasn't been used
    if (this.usedNonces.has(proof.nonce)) {
      throw new PaymentError('PAYMENT_ALREADY_USED');
    }
    
    // 2. Verify on-chain
    const isValid = await this.contract.verify(proof);
    if (!isValid) {
      throw new PaymentError('INVALID_PAYMENT');
    }
    
    // 3. Mark nonce as used
    this.usedNonces.add(proof.nonce);
    
    // 4. Persist to database for cross-instance protection
    await this.db.markNonceUsed(proof.nonce, proof.txHash);
    
    return true;
  }
}
```

**Risk Rating:** CRITICAL

---

### 3.2 Deadline Bypass (HIGH)

**Description:**
Client or attacker uses a payment after its expiration deadline.

**Attack Scenario:**
```
1. Server issues payment request with deadline: T+300s

2. Client delays payment beyond deadline

3. Client submits expired payment
   → Server accepts (if deadline not checked)
   
4. Client gets service with expired/stale payment
```

**Current Implementation Status:**
- On-chain deadline check: IMPLEMENTED in PaymentRouter
- Server-side deadline validation: NOT IMPLEMENTED

**Required Mitigation:**
```typescript
function verifyPaymentDeadline(proof: PaymentProof, deadline: number): void {
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (currentTime > deadline) {
    throw new PaymentError('PAYMENT_DEADLINE_EXPIRED', {
      deadline,
      currentTime,
      expiredBy: currentTime - deadline
    });
  }
  
  // Additional: Check deadline is not too far in future
  const MAX_FUTURE_DEADLINE = 600; // 10 minutes
  if (deadline > currentTime + MAX_FUTURE_DEADLINE) {
    throw new PaymentError('INVALID_DEADLINE');
  }
}
```

**Risk Rating:** HIGH

---

### 3.3 Amount Manipulation (MEDIUM)

**Description:**
Client pays a different amount than requested by the server.

**Attack Scenario:**
```
1. Server requests payment: 10 USDC

2. Client creates transaction for: 1 USDC

3. Client submits proof of 1 USDC payment
   → Server accepts (if amount not verified)
   
4. Client gets service at 90% discount
```

**Current Implementation Status:**
- Amount verification: PARTIAL
- On-chain amount check: NOT IMPLEMENTED

**Required Mitigation:**
```typescript
async function verifyPaymentAmount(
  proof: PaymentProof, 
  expectedAmount: bigint
): Promise<void> {
  // Get actual transfer amount from transaction receipt
  const receipt = await provider.getTransactionReceipt(proof.txHash);
  const transferEvent = receipt.logs.find(log => 
    log.topics[0] === TRANSFER_EVENT_SIGNATURE
  );
  
  if (!transferEvent) {
    throw new PaymentError('NO_TRANSFER_FOUND');
  }
  
  const actualAmount = BigInt(transferEvent.data);
  
  if (actualAmount < expectedAmount) {
    throw new PaymentError('INSUFFICIENT_PAYMENT', {
      expected: expectedAmount.toString(),
      actual: actualAmount.toString()
    });
  }
}
```

**Risk Rating:** MEDIUM

---

### 3.4 Signature Forgery (MEDIUM)

**Description:**
Attacker forges payment signatures to create invalid payment proofs.

**Attack Scenario:**
```
1. Attacker constructs fake payment proof
   → Invalid txHash
   → Invalid signature
   
2. Attacker submits forged proof
   → Server accepts (if signature not verified)
   
3. Attacker gets free service
```

**Current Implementation Status:**
- Signature verification: IMPLEMENTED (via on-chain verify)
- Off-chain pre-validation: NOT IMPLEMENTED

**Required Mitigation:**
```typescript
async function verifySignature(proof: PaymentProof): Promise<boolean> {
  // 1. Recover signer from signature
  const messageHash = keccak256(
    encodePacked(
      ['address', 'uint256', 'uint256'],
      [proof.receiver, proof.amount, proof.nonce]
    )
  );
  
  const recoveredSigner = recoverAddress(messageHash, proof.signature);
  
  // 2. Verify signer is transaction sender
  const tx = await provider.getTransaction(proof.txHash);
  if (tx.from.toLowerCase() !== recoveredSigner.toLowerCase()) {
    throw new PaymentError('SIGNER_MISMATCH');
  }
  
  return true;
}
```

**Risk Rating:** MEDIUM

---

### 3.5 Network Spoofing (MEDIUM)

**Description:**
Attacker tricks client into paying on wrong network.

**Attack Scenario:**
```
1. Server requests payment on: Base Mainnet

2. Attacker intercepts and modifies to: Base Sepolia

3. Client pays on testnet (worthless)

4. Server rejects (if network verified)
   OR Server accepts (if network not verified)
```

**Required Mitigation:**
```typescript
const SUPPORTED_NETWORKS = {
  'base': 8453,
  'base-sepolia': 84532
};

function verifyNetwork(proof: PaymentProof, expectedNetwork: string): void {
  const chainId = proof.chainId;
  const expectedChainId = SUPPORTED_NETWORKS[expectedNetwork];
  
  if (chainId !== expectedChainId) {
    throw new PaymentError('WRONG_NETWORK', {
      expected: expectedNetwork,
      expectedChainId,
      actualChainId: chainId
    });
  }
}
```

**Risk Rating:** MEDIUM

---

## 4. Middleware Implementation

### 4.1 Required Middleware Structure

```typescript
// x402Middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { PaymentRouterABI } from './abis';

interface X402Config {
  paymentRouterAddress: string;
  provider: ethers.Provider;
  requiredAmount: bigint;
  tokenAddress: string;
  network: string;
}

interface PaymentProof {
  txHash: string;
  signature: string;
  nonce: string;
  deadline: number;
}

class X402Middleware {
  private config: X402Config;
  private usedNonces: Set<string>;
  private contract: ethers.Contract;
  
  constructor(config: X402Config) {
    this.config = config;
    this.usedNonces = new Set();
    this.contract = new ethers.Contract(
      config.paymentRouterAddress,
      PaymentRouterABI,
      config.provider
    );
  }
  
  // Main middleware function
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // 1. Check for payment proof
        const paymentProof = this.extractPaymentProof(req);
        
        if (!paymentProof) {
          // Return 402 with payment requirements
          return this.sendPaymentRequired(res);
        }
        
        // 2. Verify payment
        await this.verifyPayment(paymentProof);
        
        // 3. Attach payment info to request
        req.payment = {
          verified: true,
          txHash: paymentProof.txHash,
          amount: this.config.requiredAmount
        };
        
        next();
      } catch (error) {
        if (error instanceof PaymentError) {
          return res.status(402).json({
            error: error.code,
            message: error.message,
            details: error.details
          });
        }
        next(error);
      }
    };
  }
  
  private extractPaymentProof(req: Request): PaymentProof | null {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('X402 ')) {
      return null;
    }
    
    try {
      const proofJson = authHeader.substring(5); // Remove 'X402 '
      return JSON.parse(proofJson);
    } catch {
      return null;
    }
  }
  
  private async verifyPayment(proof: PaymentProof): Promise<void> {
    // 1. Check nonce not used
    if (this.usedNonces.has(proof.nonce)) {
      throw new PaymentError('PAYMENT_ALREADY_USED');
    }
    
    // 2. Verify deadline
    this.verifyDeadline(proof.deadline);
    
    // 3. Verify on-chain
    const isValid = await this.verifyOnChain(proof);
    if (!isValid) {
      throw new PaymentError('INVALID_PAYMENT');
    }
    
    // 4. Verify amount
    await this.verifyAmount(proof);
    
    // 5. Mark nonce as used
    this.usedNonces.add(proof.nonce);
  }
  
  private verifyDeadline(deadline: number): void {
    const now = Math.floor(Date.now() / 1000);
    if (now > deadline) {
      throw new PaymentError('DEADLINE_EXPIRED');
    }
  }
  
  private async verifyOnChain(proof: PaymentProof): Promise<boolean> {
    // Get transaction receipt
    const receipt = await this.config.provider.getTransactionReceipt(proof.txHash);
    if (!receipt || receipt.status !== 1) {
      return false;
    }
    
    // Verify transaction was to PaymentRouter
    if (receipt.to?.toLowerCase() !== this.config.paymentRouterAddress.toLowerCase()) {
      return false;
    }
    
    return true;
  }
  
  private async verifyAmount(proof: PaymentProof): Promise<void> {
    // Get transaction details
    const tx = await this.config.provider.getTransaction(proof.txHash);
    if (!tx) {
      throw new PaymentError('TRANSACTION_NOT_FOUND');
    }
    
    // Decode transaction data to verify amount
    // This requires parsing the PaymentRouter.pay() call
    const decoded = this.contract.interface.parseTransaction({ data: tx.data });
    if (!decoded) {
      throw new PaymentError('INVALID_TRANSACTION_DATA');
    }
    
    const amount = decoded.args.amount;
    if (amount < this.config.requiredAmount) {
      throw new PaymentError('INSUFFICIENT_AMOUNT');
    }
  }
  
  private sendPaymentRequired(res: Response): Response {
    const nonce = this.generateNonce();
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    
    return res.status(402).json({
      error: 'PAYMENT_REQUIRED',
      payment: {
        scheme: 'x402',
        network: this.config.network,
        amount: this.config.requiredAmount.toString(),
        token: this.config.tokenAddress,
        receiver: this.config.paymentRouterAddress,
        deadline,
        nonce,
        payload: this.generatePayload(nonce, deadline)
      }
    });
  }
  
  private generateNonce(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }
  
  private generatePayload(nonce: string, deadline: number): string {
    // Generate encoded payload for client to sign
    return ethers.solidityPackedKeccak256(
      ['string', 'uint256', 'uint256'],
      [nonce, deadline, this.config.requiredAmount]
    );
  }
}

class PaymentError extends Error {
  constructor(
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(`Payment error: ${code}`);
    this.name = 'PaymentError';
  }
}
```

---

## 5. Security Checklist

### 5.1 Implementation Checklist

| # | Requirement | Status | Priority |
|---|-------------|--------|----------|
| 5.1.1 | Nonce generation | NOT IMPLEMENTED | Critical |
| 5.1.2 | Nonce tracking | NOT IMPLEMENTED | Critical |
| 5.1.3 | Deadline validation | NOT IMPLEMENTED | High |
| 5.1.4 | Amount verification | NOT IMPLEMENTED | High |
| 5.1.5 | Network validation | NOT IMPLEMENTED | Medium |
| 5.1.6 | Signature verification | NOT IMPLEMENTED | High |
| 5.1.7 | Transaction receipt validation | NOT IMPLEMENTED | High |
| 5.1.8 | Contract address verification | NOT IMPLEMENTED | High |
| 5.1.9 | Event emission for payments | NOT IMPLEMENTED | Medium |
| 5.1.10 | Rate limiting | NOT IMPLEMENTED | High |

### 5.2 Testing Checklist

| # | Test Case | Status |
|---|-----------|--------|
| 5.2.1 | Valid payment accepted | NOT TESTED |
| 5.2.2 | Replayed payment rejected | NOT TESTED |
| 5.2.3 | Expired payment rejected | NOT TESTED |
| 5.2.4 | Insufficient amount rejected | NOT TESTED |
| 5.2.5 | Invalid signature rejected | NOT TESTED |
| 5.2.6 | Wrong network rejected | NOT TESTED |
| 5.2.7 | Concurrent payment handling | NOT TESTED |
| 5.2.8 | High load performance | NOT TESTED |

---

## 6. Deployment Security

### 6.1 Environment Configuration

```typescript
// config.ts
import { z } from 'zod';

const ConfigSchema = z.object({
  PAYMENT_ROUTER_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  RPC_URL: z.string().url(),
  CHAIN_ID: z.number().int().positive(),
  REQUIRED_AMOUNT: z.string().regex(/^\d+$/),
  TOKEN_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  NETWORK_NAME: z.enum(['base', 'base-sepolia']),
  RATE_LIMIT_REQUESTS: z.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.number().int().positive().default(60000),
});

export const config = ConfigSchema.parse(process.env);
```

### 6.2 Secrets Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| RPC URL | Environment variable | Monthly |
| Private keys | Hardware wallet / KMS | Quarterly |
| API keys | Secret manager | Monthly |

---

## 7. Monitoring & Alerting

### 7.1 Required Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| payment_verification_rate | Successful verifications/min | < 50% success rate |
| payment_replay_attempts | Rejected replay attempts | > 10/min |
| expired_payment_attempts | Rejected expired payments | > 20/min |
| average_verification_time | Time to verify payment | > 5 seconds |
| failed_verifications | Failed verifications | > 5% of total |

### 7.2 Security Alerts

| Alert | Condition | Response |
|-------|-----------|----------|
| REPLAY_ATTACK_DETECTED | > 10 replay attempts from single IP | Block IP, notify security |
| RATE_LIMIT_EXCEEDED | > 100 requests/min from single source | Throttle, notify admin |
| INVALID_PAYMENT_SPIKE | > 50% invalid payments | Investigate, potential attack |
| CONTRACT_CALL_FAILED | PaymentRouter call fails | Check contract, notify dev |

---

## 8. Recommendations

### 8.1 Immediate (Before Production)

1. **Implement nonce tracking** - Critical for replay protection
2. **Add deadline validation** - Prevent expired payment acceptance
3. **Implement amount verification** - Ensure correct payment amounts
4. **Add rate limiting** - Prevent DoS attacks
5. **Write comprehensive tests** - All test cases in 5.2

### 8.2 Short-term (Within 1 Month)

1. **Add signature pre-validation** - Fail fast on invalid signatures
2. **Implement network validation** - Prevent cross-network attacks
3. **Add monitoring & alerting** - Real-time security monitoring
4. **Create incident response plan** - Document procedures
5. **Performance optimization** - Cache verification results

### 8.3 Long-term (Within 3 Months)

1. **Distributed nonce storage** - Redis/database for multi-instance
2. **Payment batching** - Reduce on-chain calls
3. **Zero-knowledge proofs** - Privacy-preserving verification
4. **Multi-sig requirements** - High-value payment approvals
5. **Insurance integration** - Coverage for payment disputes

---

*This document should be updated as the x402 implementation evolves.*
