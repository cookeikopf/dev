# Express Integration Guide

Set up AgentLink with Express.js.

## Overview

AgentLink provides seamless Express.js integration with:
- Middleware for automatic payment verification
- TypeScript support
- Built-in validation
- Webhook handling

## Installation

```bash
npm install @agentlink/sdk express
npm install -D @types/express typescript tsx
```

## Basic Setup

### 1. Create Express App

```typescript
import express from 'express';
import { agentLinkMiddleware } from '@agentlink/sdk/adapters/express';

const app = express();

// Parse JSON body
app.use(express.json());

// Add AgentLink middleware
app.use('/agent', agentLinkMiddleware({
  agentName: 'my-express-agent',
  apiKey: process.env.AGENTLINK_API_KEY!,
  capabilities: ['research', 'summarize'],
  pricing: {
    perRequest: 0.01,
    currency: 'USD',
    freeQuota: 5
  }
}));

// Capability handlers
app.post('/agent/research', async (req, res) => {
  const { query, depth = 'standard' } = req.body;
  const ctx = req.agentlink;
  
  // Payment already verified
  console.log(`Research from ${ctx.user.walletAddress}`);
  
  const result = await performResearch(query, depth);
  
  res.json({
    result,
    requestId: ctx.requestId,
    creditsUsed: depth === 'deep' ? 3 : 1
  });
});

app.post('/agent/summarize', async (req, res) => {
  const { text, maxLength = 200 } = req.body;
  const ctx = req.agentlink;
  
  const summary = await summarizeText(text, maxLength);
  
  res.json({
    summary,
    requestId: ctx.requestId
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AgentLink Express agent running on port ${PORT}`);
});
```

### 2. TypeScript Declaration

```typescript
// types/agentlink.d.ts
import { Context } from '@agentlink/sdk';

declare global {
  namespace Express {
    interface Request {
      agentlink: Context;
    }
  }
}

export {};
```

## Advanced Configuration

### Custom Middleware Stack

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { agentLinkMiddleware } from '@agentlink/sdk/adapters/express';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// AgentLink middleware with full configuration
app.use('/agent', agentLinkMiddleware({
  agentName: 'advanced-express-agent',
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
    trustedDIDs: ['did:agentlink:partner-1']
  },
  webhooks: [
    {
      url: 'https://my-server.com/webhooks',
      events: ['payment.received', 'request.completed']
    }
  ]
}));

// Custom validation middleware
app.use('/agent', (req, res, next) => {
  if (req.method === 'POST' && !req.body) {
    return res.status(400).json({ error: 'Request body required' });
  }
  next();
});

// Capability routes
app.post('/agent/research', handleResearch);
app.post('/agent/analyze', handleAnalyze);
app.post('/agent/generate', handleGenerate);
```

### Route Controllers

```typescript
// controllers/researchController.ts
import { Request, Response } from 'express';
import { z } from 'zod';

const ResearchSchema = z.object({
  query: z.string().min(1).max(500),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard')
});

export async function handleResearch(req: Request, res: Response) {
  try {
    const ctx = req.agentlink;
    
    // Validate input
    const result = ResearchSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: result.error.errors
      });
    }
    
    const { query, depth } = result.data;
    
    console.log(`[${ctx.requestId}] Research: ${query}`);
    
    // Perform research
    const researchResult = await performResearch(query, depth);
    
    res.json({
      query,
      depth,
      result: researchResult,
      creditsUsed: depth === 'deep' ? 3 : 1,
      requestId: ctx.requestId,
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Research error:', error);
    res.status(500).json({
      error: 'Research failed',
      requestId: req.agentlink?.requestId
    });
  }
}

async function performResearch(query: string, depth: string) {
  // Your research logic
  return {
    summary: `Research on "${query}" completed`,
    sources: ['https://example.com'],
    confidence: 0.95
  };
}
```

```typescript
// controllers/analyzeController.ts
import { Request, Response } from 'express';

export async function handleAnalyze(req: Request, res: Response) {
  const ctx = req.agentlink;
  const { data, analysisType } = req.body;
  
  const analysis = await analyzeData(data, analysisType);
  
  res.json({
    analysis,
    analysisType,
    requestId: ctx.requestId
  });
}

async function analyzeData(data: any, type: string) {
  // Your analysis logic
  return { insights: ['Insight 1', 'Insight 2'] };
}
```

### Dynamic Agent Registration

```typescript
import express from 'express';
import { AgentLinkExpress } from '@agentlink/sdk/adapters/express';

const app = express();
app.use(express.json());

// Create AgentLink Express instance
const agentLink = new AgentLinkExpress({
  agentName: 'dynamic-agent',
  apiKey: process.env.AGENTLINK_API_KEY!
});

// Register capabilities
agentLink.register('research', {
  handler: async (ctx, params) => {
    const { query } = params;
    return { result: await research(query) };
  },
  pricing: { perRequest: 0.05 },
  validation: {
    query: { type: 'string', required: true, min: 1, max: 500 }
  }
});

agentLink.register('summarize', {
  handler: async (ctx, params) => {
    const { text } = params;
    return { summary: await summarize(text) };
  },
  pricing: { perRequest: 0.02 }
});

// Apply router
app.use('/agent', agentLink.router);

export default app;
```

## Context Access

### Available Properties

```typescript
app.post('/agent/example', (req, res) => {
  const ctx = req.agentlink;
  
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
  
  // Payment info
  console.log(ctx.payment?.amount);   // Payment amount
  console.log(ctx.payment?.currency); // Currency
  console.log(ctx.payment?.txHash);   // Transaction hash
  
  // Request metadata
  console.log(ctx.headers);          // Request headers
  console.log(ctx.timestamp);        // Request timestamp
  console.log(ctx.ip);               // Client IP
  
  res.json({ success: true });
});
```

## Error Handling

### Global Error Handler

```typescript
import express, { ErrorRequestHandler } from 'express';
import { PaymentError, RateLimitError } from '@agentlink/sdk';

const app = express();

// ... routes ...

// Global error handler
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle AgentLink errors
  if (err instanceof PaymentError) {
    return res.status(402).json({
      error: 'Payment required',
      payment: err.paymentDetails
    });
  }
  
  if (err instanceof RateLimitError) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: err.retryAfter
    });
  }
  
  // Generic error
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    requestId: req.agentlink?.requestId
  });
};

app.use(errorHandler);
```

### Async Handler Wrapper

```typescript
// utils/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

```typescript
// Usage
import { asyncHandler } from './utils/asyncHandler';

app.post('/agent/research', asyncHandler(async (req, res) => {
  const ctx = req.agentlink;
  const result = await performResearch(req.body);
  res.json(result);
}));
```

## Webhook Handling

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();

// Webhook endpoint
app.post('/webhooks/agentlink', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-agentlink-signature'] as string;
  const payload = req.body;
  
  // Verify signature
  const isValid = verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET!);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const event = JSON.parse(payload.toString());
  
  // Handle events
  switch (event.type) {
    case 'payment.received':
      handlePaymentReceived(event.data);
      break;
    case 'request.completed':
      handleRequestCompleted(event.data);
      break;
    case 'agent.stopped':
      handleAgentStopped(event.data);
      break;
  }
  
  res.json({ received: true });
});

function verifyWebhookSignature(payload: Buffer, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return signature === expected;
}

function handlePaymentReceived(data: any) {
  console.log('Payment received:', data);
}

function handleRequestCompleted(data: any) {
  console.log('Request completed:', data);
}

function handleAgentStopped(data: any) {
  console.log('Agent stopped:', data);
}
```

## Complete Example

```typescript
// app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { agentLinkMiddleware } from '@agentlink/sdk/adapters/express';
import { z } from 'zod';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Validation schemas
const ResearchSchema = z.object({
  query: z.string().min(1).max(500),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard')
});

const SummarizeSchema = z.object({
  text: z.string().min(10).max(10000),
  maxLength: z.number().min(50).max(1000).default(200)
});

// AgentLink middleware
app.use('/agent', agentLinkMiddleware({
  agentName: 'research-assistant',
  apiKey: process.env.AGENTLINK_API_KEY!,
  capabilities: ['research', 'summarize', 'analyze'],
  pricing: {
    perRequest: 0.05,
    currency: 'USD',
    freeQuota: 3
  },
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 1000
  }
}));

// Routes
app.post('/agent/research', async (req, res) => {
  try {
    const ctx = req.agentlink;
    
    const result = ResearchSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: result.error.errors
      });
    }
    
    const { query, depth } = result.data;
    const researchResult = await performResearch(query, depth);
    
    res.json({
      query,
      depth,
      result: researchResult,
      creditsUsed: depth === 'deep' ? 3 : 1,
      requestId: ctx.requestId
    });
  } catch (error) {
    console.error('Research error:', error);
    res.status(500).json({ error: 'Research failed' });
  }
});

app.post('/agent/summarize', async (req, res) => {
  try {
    const ctx = req.agentlink;
    
    const result = SummarizeSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: result.error.errors
      });
    }
    
    const { text, maxLength } = result.data;
    const summary = await summarizeText(text, maxLength);
    
    res.json({
      summary,
      originalLength: text.length,
      summaryLength: summary.length,
      requestId: ctx.requestId
    });
  } catch (error) {
    console.error('Summarize error:', error);
    res.status(500).json({ error: 'Summarization failed' });
  }
});

app.post('/agent/analyze', async (req, res) => {
  const ctx = req.agentlink;
  const { data, analysisType } = req.body;
  
  const analysis = await analyzeData(data, analysisType);
  
  res.json({
    analysis,
    analysisType,
    requestId: ctx.requestId
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

// Agent info
app.get('/agent/info', (req, res) => {
  res.json({
    name: 'research-assistant',
    capabilities: ['research', 'summarize', 'analyze'],
    pricing: {
      perRequest: 0.05,
      currency: 'USD',
      freeQuota: 3
    }
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.agentlink?.requestId
  });
});

// Helper functions
async function performResearch(query: string, depth: string) {
  return {
    summary: `Research on "${query}" completed`,
    sources: ['https://example.com'],
    confidence: 0.95
  };
}

async function summarizeText(text: string, maxLength: number) {
  return text.slice(0, maxLength) + '...';
}

async function analyzeData(data: any, type: string) {
  return { insights: ['Insight 1', 'Insight 2'] };
}

export default app;
```

```typescript
// server.ts
import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AgentLink Express agent running on port ${PORT}`);
});
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### Railway/Render

```yaml
# railway.yaml
build:
  builder: DOCKERFILE

deploy:
  startCommand: node dist/server.js
  healthcheckPath: /health
  healthcheckTimeout: 100
```

### AWS Lambda

```typescript
// lambda.ts
import serverless from 'serverless-http';
import app from './app';

export const handler = serverless(app);
```
