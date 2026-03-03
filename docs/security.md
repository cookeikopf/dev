# Security Guide

Security considerations and best practices for AgentLink.

## Table of Contents

- [Threat Model](#threat-model)
- [Security Best Practices](#security-best-practices)
- [API Key Security](#api-key-security)
- [Payment Security](#payment-security)
- [Identity Verification](#identity-verification)
- [Rate Limiting](#rate-limiting)
- [Webhook Security](#webhook-security)
- [Known Limitations](#known-limitations)
- [Security Checklist](#security-checklist)
- [Reporting Vulnerabilities](#reporting-vulnerabilities)

## Threat Model

### Assets

| Asset | Value | Protection Level |
|-------|-------|------------------|
| API Keys | High | Critical |
| Private Keys | Critical | Critical |
| User Data | High | High |
| Payment Data | Critical | Critical |
| Agent Configurations | Medium | Medium |

### Threats

| Threat | Likelihood | Impact | Risk |
|--------|------------|--------|------|
| API key theft | Medium | High | High |
| Payment fraud | Low | High | Medium |
| DDoS attacks | Medium | Medium | Medium |
| Replay attacks | Low | High | Medium |
| Man-in-the-middle | Low | Critical | Medium |
| Rate limit bypass | Medium | Low | Low |

### Attack Vectors

1. **Network-based attacks**
   - Eavesdropping on unencrypted traffic
   - Man-in-the-middle attacks
   - DNS spoofing

2. **Application attacks**
   - API key exposure in code
   - Insufficient input validation
   - Replay attacks on webhooks

3. **Payment attacks**
   - Double-spending attempts
   - Payment verification bypass
   - Price manipulation

4. **Identity attacks**
   - DID spoofing
   - Signature forgery
   - Impersonation

## Security Best Practices

### 1. API Key Management

```typescript
// ❌ DON'T: Hardcode API keys
const agent = createAgent({
  apiKey: 'sk_live_abc123...'
});

// ✅ DO: Use environment variables
const agent = createAgent({
  apiKey: process.env.AGENTLINK_API_KEY
});
```

**Recommendations:**
- Never commit API keys to version control
- Use environment variables or secret management
- Rotate keys regularly (every 90 days)
- Use separate keys for development and production
- Monitor key usage for anomalies

### 2. Secure Configuration

```typescript
// ✅ DO: Use secure defaults
const agent = createAgent({
  name: 'secure-agent',
  apiKey: process.env.AGENTLINK_API_KEY,
  
  // Enable rate limiting
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    perUser: true
  },
  
  // Verify caller identity
  identity: {
    verifyCaller: true,
    trustedDIDs: process.env.TRUSTED_DIDS?.split(',') || []
  },
  
  // Use HTTPS webhooks
  webhooks: [{
    url: 'https://your-server.com/webhook',
    secret: process.env.WEBHOOK_SECRET
  }]
});
```

### 3. Input Validation

```typescript
import { z } from 'zod';

// ✅ DO: Validate all inputs
const ResearchSchema = z.object({
  query: z.string()
    .min(1)
    .max(500)
    .regex(/^[\w\s\-.,!?]+$/), // Sanitize input
  depth: z.enum(['quick', 'standard', 'deep'])
});

agent.handle('research', async (ctx, params) => {
  const result = ResearchSchema.safeParse(params);
  
  if (!result.success) {
    throw new Error('Invalid input parameters');
  }
  
  // Process validated input
  const { query, depth } = result.data;
  return await doResearch(query, depth);
});
```

### 4. Output Sanitization

```typescript
// ✅ DO: Sanitize outputs
import DOMPurify from 'isomorphic-dompurify';

agent.handle('research', async (ctx, params) => {
  const result = await doResearch(params.query);
  
  return {
    // Sanitize any user-generated content
    summary: DOMPurify.sanitize(result.summary),
    sources: result.sources.map(s => ({
      title: DOMPurify.sanitize(s.title),
      url: s.url // URLs should be validated separately
    }))
  };
});
```

## API Key Security

### Storage

```bash
# ✅ DO: Use .env files (not committed)
# .env
AGENTLINK_API_KEY=sk_live_...

# ✅ DO: Use secret management in production
# AWS Secrets Manager, HashiCorp Vault, etc.
```

```typescript
// ✅ DO: Load from secure storage
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const secrets = new SecretsManager();
const apiKey = await secrets.getSecretValue({
  SecretId: 'agentlink/api-key'
});
```

### Rotation

```typescript
// ✅ DO: Support key rotation
class AgentLinkClient {
  private apiKey: string;
  private keyRotationDate: Date;
  
  constructor() {
    this.apiKey = process.env.AGENTLINK_API_KEY!;
    this.keyRotationDate = new Date();
    
    // Check for key rotation every hour
    setInterval(() => this.checkKeyRotation(), 3600000);
  }
  
  private async checkKeyRotation() {
    const daysSinceRotation = 
      (Date.now() - this.keyRotationDate.getTime()) / 86400000;
    
    if (daysSinceRotation > 90) {
      console.warn('API key rotation recommended');
      // Alert or auto-rotate
    }
  }
}
```

## Payment Security

### x402 Payment Verification

```typescript
// ✅ DO: Always verify payments
import { verifyPayment } from '@agentlink/sdk/payments';

agent.handle('premium-service', async (ctx, params) => {
  // Payment is verified by middleware
  // But you can double-check if needed
  if (ctx.payment) {
    const isValid = await verifyPayment({
      txHash: ctx.payment.txHash,
      amount: ctx.payment.amount,
      recipient: ctx.agent.walletAddress
    });
    
    if (!isValid) {
      throw new Error('Payment verification failed');
    }
  }
  
  return await processPremiumService(params);
});
```

### Price Integrity

```typescript
// ✅ DO: Use server-side pricing
const agent = createAgent({
  name: 'secure-pricing-agent',
  pricing: {
    perRequest: 0.05,  // Server controls price
    currency: 'USD',
    // Don't trust client-side pricing
  }
});

// ❌ DON'T: Accept price from client
agent.handle('service', async (ctx, params) => {
  // ❌ DON'T: Trust client price
  const price = params.price; // Dangerous!
  
  // ✅ DO: Use server-defined price
  const price = ctx.agent.pricing.perRequest;
});
```

### Double-Spend Prevention

```typescript
// ✅ DO: Track processed payments
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

async function processPayment(txHash: string, amount: number) {
  // Check if already processed
  const { data } = await supabase
    .from('payments')
    .select('tx_hash')
    .eq('tx_hash', txHash)
    .single();
  
  if (data) {
    throw new Error('Payment already processed');
  }
  
  // Process payment
  await supabase
    .from('payments')
    .insert({ tx_hash: txHash, amount });
}
```

## Identity Verification

### DID Verification

```typescript
// ✅ DO: Verify caller DID
const agent = createAgent({
  name: 'verified-agent',
  identity: {
    did: 'did:agentlink:verified-agent',
    verifyCaller: true,
    trustedDIDs: [
      'did:agentlink:partner-1',
      'did:agentlink:partner-2'
    ]
  }
});

agent.handle('sensitive-operation', async (ctx, params) => {
  // Caller DID is verified by middleware
  console.log('Verified caller:', ctx.user.did);
  
  // Check if in trusted list
  if (!ctx.agent.identity?.trustedDIDs?.includes(ctx.user.did!)) {
    throw new Error('Unauthorized caller');
  }
  
  return await processSensitiveOperation(params);
});
```

### Signature Verification

```typescript
import { verifySignature } from '@agentlink/sdk/identity';

// ✅ DO: Verify signatures on sensitive operations
async function verifyRequestSignature(
  did: string,
  message: string,
  signature: string
): Promise<boolean> {
  return await verifySignature({
    did,
    message,
    signature
  });
}
```

## Rate Limiting

### Configuration

```typescript
// ✅ DO: Configure rate limits
const agent = createAgent({
  name: 'rate-limited-agent',
  rateLimit: {
    requestsPerMinute: 60,    // Per-user limit
    requestsPerHour: 1000,
    requestsPerDay: 5000,
    perUser: true  // Track per wallet/DID
  }
});
```

### Custom Rate Limiting

```typescript
// ✅ DO: Implement custom rate limiting for specific capabilities
import { RateLimiter } from 'limiter';

const expensiveLimiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 'hour'
});

agent.handle('expensive-operation', async (ctx, params) => {
  // Check custom rate limit
  if (!await expensiveLimiter.tryRemoveTokens(1)) {
    throw new Error('Rate limit exceeded for expensive operations');
  }
  
  return await processExpensiveOperation(params);
});
```

## Webhook Security

### Signature Verification

```typescript
import crypto from 'crypto';

// ✅ DO: Verify webhook signatures
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-agentlink-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
});
```

### Replay Protection

```typescript
// ✅ DO: Prevent replay attacks
const processedEvents = new Set<string>();

app.post('/webhook', async (req, res) => {
  const eventId = req.headers['x-agentlink-event-id'];
  const timestamp = parseInt(req.headers['x-agentlink-timestamp']);
  
  // Check for duplicate
  if (processedEvents.has(eventId)) {
    return res.json({ received: true, duplicate: true });
  }
  
  // Check timestamp (5 minute window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    return res.status(401).json({ error: 'Timestamp expired' });
  }
  
  // Process and mark as processed
  await processWebhook(req.body);
  processedEvents.add(eventId);
  
  // Clean up old entries periodically
  if (processedEvents.size > 10000) {
    processedEvents.clear();
  }
  
  res.json({ received: true });
});
```

## Known Limitations

### Current Limitations

1. **Webhook Delivery**
   - Webhooks are delivered at-most-once
   - No guaranteed ordering
   - Implement idempotency on your end

2. **Rate Limiting**
   - Rate limits are approximate
   - Burst traffic may exceed limits briefly
   - Implement client-side rate limiting as backup

3. **Payment Verification**
   - On-chain verification has latency
   - Network congestion may delay confirmations
   - Consider payment pending state

4. **Identity Verification**
   - DID resolution depends on external services
   - Resolution failures may block requests
   - Implement fallback strategies

### Mitigation Strategies

```typescript
// ✅ DO: Handle webhook failures gracefully
async function processWebhookWithRetry(event: any, retries = 3): Promise<void> {
  try {
    await processWebhook(event);
  } catch (error) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      await processWebhookWithRetry(event, retries - 1);
    } else {
      // Log to dead letter queue
      await logFailedEvent(event, error);
    }
  }
}

// ✅ DO: Implement circuit breaker for DID resolution
class DIDResolverWithCircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000;
  
  async resolve(did: string): Promise<any> {
    if (this.failures >= this.threshold) {
      if (Date.now() - this.lastFailure < this.timeout) {
        throw new Error('DID resolver circuit breaker open');
      }
      this.failures = 0;
    }
    
    try {
      const result = await resolveDID(did);
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      throw error;
    }
  }
}
```

## Security Checklist

### Pre-Deployment

- [ ] API keys stored in environment variables
- [ ] No secrets in code or git history
- [ ] Rate limiting configured
- [ ] Input validation implemented
- [ ] Output sanitization implemented
- [ ] HTTPS enforced for webhooks
- [ ] Webhook signatures verified
- [ ] Error messages don't leak sensitive info
- [ ] Logging doesn't include sensitive data
- [ ] Dependencies are up to date

### Runtime

- [ ] Monitor for unusual traffic patterns
- [ ] Set up alerts for payment failures
- [ ] Track rate limit violations
- [ ] Monitor webhook delivery failures
- [ ] Log security events
- [ ] Regular security audits

### Incident Response

- [ ] Document incident response plan
- [ ] Have key rotation procedure ready
- [ ] Know how to disable agents quickly
- [ ] Have contact info for security team

## Reporting Vulnerabilities

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email security@agentlink.dev with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

3. Allow 90 days for disclosure

We offer bug bounties for verified vulnerabilities:

| Severity | Bounty |
|----------|--------|
| Critical | $5,000+ |
| High | $2,000 |
| Medium | $500 |
| Low | $100 |

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [Crypto Best Practices](https://cryptobestpractices.org/)

---

For security questions, contact: security@agentlink.dev
