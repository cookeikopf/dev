# Hono Integration Guide

Set up AgentLink with the Hono web framework.

## Overview

AgentLink provides first-class support for Hono with:
- Middleware for automatic payment verification
- Type-safe handler context
- Built-in validation
- Webhook support

## Installation

```bash
npm install @agentlink/sdk hono
npm install -D @types/node
```

## Basic Setup

### 1. Create Hono App with AgentLink

```typescript
import { Hono } from 'hono';
import { agentLinkMiddleware } from '@agentlink/sdk/adapters/hono';

const app = new Hono();

// Add AgentLink middleware
app.use('/agent/*', agentLinkMiddleware({
  agentName: 'my-hono-agent',
  apiKey: process.env.AGENTLINK_API_KEY!,
  capabilities: ['research', 'summarize'],
  pricing: {
    perRequest: 0.01,
    currency: 'USD',
    freeQuota: 5
  }
}));

// Define capability handlers
app.post('/agent/research', async (c) => {
  const { query, depth = 'standard' } = await c.req.json();
  const ctx = c.get('agentlink');
  
  // Payment already verified by middleware
  console.log(`Research request from ${ctx.user.walletAddress}`);
  
  const result = await performResearch(query, depth);
  
  return c.json({
    result,
    requestId: ctx.requestId,
    creditsUsed: depth === 'deep' ? 3 : 1
  });
});

app.post('/agent/summarize', async (c) => {
  const { text, maxLength = 200 } = await c.req.json();
  const ctx = c.get('agentlink');
  
  const summary = await summarizeText(text, maxLength);
  
  return c.json({
    summary,
    requestId: ctx.requestId,
    originalLength: text.length,
    summaryLength: summary.length
  });
});

// Health check (no payment required)
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: Date.now() });
});

export default app;
```

### 2. Start Server

```typescript
// server.ts
import app from './app';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Starting AgentLink Hono server on port ${port}`);

export default {
  port,
  fetch: app.fetch
};
```

```bash
# Run with tsx
npx tsx server.ts

# Or with Deno
deno run --allow-all server.ts

# Or with Bun
bun run server.ts
```

## Advanced Configuration

### Custom Middleware Chain

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { agentLinkMiddleware } from '@agentlink/sdk/adapters/hono';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors());

// AgentLink middleware with custom options
app.use('/agent/*', agentLinkMiddleware({
  agentName: 'advanced-agent',
  apiKey: process.env.AGENTLINK_API_KEY!,
  capabilities: ['research', 'analyze', 'generate'],
  pricing: {
    perRequest: 0.05,
    currency: 'USD',
    freeQuota: 3,
    tiers: [
      { requests: 10, price: 0.40 },
      { requests: 50, price: 1.75 }
    ]
  },
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 1000
  },
  identity: {
    verifyCaller: true,
    trustedDIDs: ['did:agentlink:trusted-1']
  }
}));

// Custom validation middleware
app.use('/agent/*', async (c, next) => {
  if (c.req.method === 'POST') {
    const body = await c.req.json();
    
    // Validate request
    if (!body || Object.keys(body).length === 0) {
      return c.json({ error: 'Request body required' }, 400);
    }
  }
  
  await next();
});

// Capability handlers
app.post('/agent/research', async (c) => {
  const ctx = c.get('agentlink');
  const params = await c.req.json();
  
  // Access user info
  console.log('User:', ctx.user.walletAddress);
  console.log('Quota remaining:', ctx.user.quotaRemaining);
  
  // Process request
  const result = await doResearch(params);
  
  return c.json(result);
});
```

### Dynamic Capability Registration

```typescript
import { Hono } from 'hono';
import { AgentLinkHono } from '@agentlink/sdk/adapters/hono';

const app = new Hono();

// Create AgentLink Hono instance
const agentLink = new AgentLinkHono({
  agentName: 'dynamic-agent',
  apiKey: process.env.AGENTLINK_API_KEY!
});

// Register capabilities dynamically
agentLink.register('research', {
  handler: async (ctx, params) => {
    const { query } = params;
    return { result: await research(query) };
  },
  pricing: { perRequest: 0.05 },
  validation: {
    query: { type: 'string', required: true }
  }
});

agentLink.register('analyze', {
  handler: async (ctx, params) => {
    const { data } = params;
    return { analysis: await analyze(data) };
  },
  pricing: { perRequest: 0.03 }
});

// Apply to Hono app
app.route('/agent', agentLink.router);

export default app;
```

### Webhook Handlers

```typescript
import { Hono } from 'hono';
import { agentLinkMiddleware } from '@agentlink/sdk/adapters/hono';

const app = new Hono();

// Webhook endpoint
app.post('/webhooks/agentlink', async (c) => {
  const signature = c.req.header('X-AgentLink-Signature');
  const payload = await c.req.json();
  
  // Verify webhook signature
  const isValid = verifyWebhook(payload, signature, process.env.WEBHOOK_SECRET!);
  
  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }
  
  // Handle event
  switch (payload.event) {
    case 'payment.received':
      console.log('Payment received:', payload.data);
      break;
    case 'request.completed':
      console.log('Request completed:', payload.data);
      break;
    case 'agent.stopped':
      console.log('Agent stopped:', payload.data);
      break;
  }
  
  return c.json({ received: true });
});

function verifyWebhook(payload: any, signature: string, secret: string): boolean {
  // Implement signature verification
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return signature === expected;
}
```

## Context Access

### Available Context Properties

```typescript
app.post('/agent/example', async (c) => {
  const ctx = c.get('agentlink');
  
  // Request info
  console.log(ctx.requestId);        // Unique request ID
  console.log(ctx.capability);       // Current capability
  console.log(ctx.params);           // Request parameters
  
  // User info
  console.log(ctx.user.walletAddress);   // User's wallet
  console.log(ctx.user.did);             // User's DID
  console.log(ctx.user.quotaUsed);       // Quota used
  console.log(ctx.user.quotaRemaining);  // Quota remaining
  
  // Agent info
  console.log(ctx.agent.name);       // Agent name
  console.log(ctx.agent.did);        // Agent DID
  
  // Payment info (if paid request)
  console.log(ctx.payment?.amount);   // Payment amount
  console.log(ctx.payment?.currency); // Currency
  console.log(ctx.payment?.txHash);   // Transaction hash
  
  // Request metadata
  console.log(ctx.headers);          // Request headers
  console.log(ctx.timestamp);        // Request timestamp
  console.log(ctx.ip);               // Client IP
  
  return c.json({ success: true });
});
```

## Error Handling

### Global Error Handler

```typescript
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

const app = new Hono();

// AgentLink middleware
app.use('/agent/*', agentLinkMiddleware({
  agentName: 'my-agent',
  apiKey: process.env.AGENTLINK_API_KEY!
}));

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  
  // Handle AgentLink errors
  if (err.code === 'PAYMENT_REQUIRED') {
    return c.json({
      error: 'Payment required',
      payment: err.paymentDetails
    }, 402);
  }
  
  if (err.code === 'RATE_LIMITED') {
    return c.json({
      error: 'Rate limit exceeded',
      retryAfter: err.retryAfter
    }, 429);
  }
  
  return c.json({
    error: 'Internal server error',
    requestId: c.get('agentlink')?.requestId
  }, 500);
});
```

### Capability-Level Error Handling

```typescript
app.post('/agent/research', async (c) => {
  try {
    const ctx = c.get('agentlink');
    const params = await c.req.json();
    
    const result = await doResearch(params);
    
    return c.json({ success: true, result });
  } catch (error) {
    console.error('Research failed:', error);
    
    return c.json({
      error: 'Research failed',
      message: error.message,
      requestId: c.get('agentlink').requestId
    }, 500);
  }
});
```

## Complete Example

```typescript
// app.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { agentLinkMiddleware } from '@agentlink/sdk/adapters/hono';
import { z } from 'zod';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());
app.use('*', prettyJSON());

// Validation schemas
const ResearchSchema = z.object({
  query: z.string().min(1).max(500),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard'),
  sources: z.array(z.string().url()).optional()
});

const SummarizeSchema = z.object({
  text: z.string().min(10).max(10000),
  maxLength: z.number().min(50).max(1000).default(200),
  style: z.enum(['concise', 'detailed', 'bullet']).default('concise')
});

// AgentLink middleware
app.use('/agent/*', agentLinkMiddleware({
  agentName: 'research-assistant',
  apiKey: process.env.AGENTLINK_API_KEY!,
  capabilities: ['research', 'summarize', 'analyze'],
  pricing: {
    perRequest: 0.05,
    currency: 'USD',
    freeQuota: 3
  },
  rateLimit: {
    requestsPerMinute: 30,
    requestsPerHour: 500
  }
}));

// Research capability
app.post('/agent/research', async (c) => {
  const ctx = c.get('agentlink');
  const body = await c.req.json();
  
  // Validate input
  const result = ResearchSchema.safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Invalid input',
      details: result.error.errors
    }, 400);
  }
  
  const { query, depth, sources } = result.data;
  
  // Perform research
  const researchResult = await performResearch(query, depth, sources);
  
  return c.json({
    query,
    depth,
    result: researchResult,
    creditsUsed: depth === 'deep' ? 3 : 1,
    requestId: ctx.requestId,
    processedAt: new Date().toISOString()
  });
});

// Summarize capability
app.post('/agent/summarize', async (c) => {
  const ctx = c.get('agentlink');
  const body = await c.req.json();
  
  const result = SummarizeSchema.safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Invalid input',
      details: result.error.errors
    }, 400);
  }
  
  const { text, maxLength, style } = result.data;
  
  const summary = await summarizeText(text, maxLength, style);
  
  return c.json({
    summary,
    style,
    originalLength: text.length,
    summaryLength: summary.length,
    compressionRatio: (summary.length / text.length).toFixed(2),
    requestId: ctx.requestId
  });
});

// Analyze capability
app.post('/agent/analyze', async (c) => {
  const ctx = c.get('agentlink');
  const { data, analysisType } = await c.req.json();
  
  const analysis = await analyzeData(data, analysisType);
  
  return c.json({
    analysis,
    analysisType,
    requestId: ctx.requestId
  });
});

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: '1.0.0'
  });
});

// Agent info
app.get('/agent/info', (c) => {
  const ctx = c.get('agentlink');
  
  return c.json({
    name: ctx.agent.name,
    capabilities: ['research', 'summarize', 'analyze'],
    pricing: {
      perRequest: 0.05,
      currency: 'USD',
      freeQuota: 3
    }
  });
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  
  return c.json({
    error: 'Internal server error',
    message: err.message,
    requestId: c.get('agentlink')?.requestId
  }, 500);
});

// Helper functions
async function performResearch(query: string, depth: string, sources?: string[]) {
  // Your research implementation
  return {
    summary: `Research on "${query}" completed`,
    sources: sources || ['https://example.com'],
    confidence: 0.95
  };
}

async function summarizeText(text: string, maxLength: number, style: string) {
  // Your summarization implementation
  return text.slice(0, maxLength) + '...';
}

async function analyzeData(data: any, type: string) {
  // Your analysis implementation
  return { insights: ['Insight 1', 'Insight 2'] };
}

export default app;
```

## Deployment

### Deploy to Cloudflare Workers

```typescript
// worker.ts
import app from './app';

export default app;
```

```toml
# wrangler.toml
name = "agentlink-hono-agent"
main = "worker.ts"
compatibility_date = "2024-01-01"

[vars]
AGENTLINK_API_KEY = "your_api_key"
```

### Deploy to Deno Deploy

```typescript
// main.ts
import app from './app';

Deno.serve(app.fetch);
```

```bash
deployctl deploy --project=agentlink-agent --include=main.ts,app.ts
```

### Deploy to Vercel

```typescript
// api/index.ts
import app from '../app';

export const config = {
  runtime: 'edge'
};

export default app.fetch;
```
