# Next.js Integration Guide

Set up AgentLink with Next.js App Router.

## Overview

AgentLink provides seamless Next.js integration with:
- App Router API routes
- Edge runtime support
- Automatic payment verification
- TypeScript support

## Installation

```bash
npm install @agentlink/sdk next
npm install -D @types/node typescript
```

## Basic Setup

### 1. Create API Route Handler

```typescript
// app/api/agent/[...path]/route.ts
import { AgentLinkHandler } from '@agentlink/sdk/adapters/nextjs';

const handler = new AgentLinkHandler({
  agentName: 'my-nextjs-agent',
  apiKey: process.env.AGENTLINK_API_KEY!,
  capabilities: {
    research: async (ctx, params) => {
      const { query, depth = 'standard' } = params;
      
      console.log(`[${ctx.requestId}] Research: ${query}`);
      
      const result = await performResearch(query, depth);
      
      return {
        result,
        creditsUsed: depth === 'deep' ? 3 : 1,
        requestId: ctx.requestId
      };
    },
    
    summarize: async (ctx, params) => {
      const { text, maxLength = 200 } = params;
      
      const summary = await summarizeText(text, maxLength);
      
      return {
        summary,
        originalLength: text.length,
        summaryLength: summary.length,
        requestId: ctx.requestId
      };
    }
  },
  pricing: {
    perRequest: 0.01,
    currency: 'USD',
    freeQuota: 5
  }
});

export const POST = handler.handle.bind(handler);

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
```

### 2. Environment Variables

```bash
# .env.local
AGENTLINK_API_KEY=your_api_key_here
AGENTLINK_ENV=development
```

### 3. Test Your Agent

```bash
# Start development server
npm run dev

# Test the agent
curl -X POST http://localhost:3000/api/agent/research \
  -H "Content-Type: application/json" \
  -d '{"query": "AI agents", "depth": "standard"}'
```

## Advanced Configuration

### Full Configuration Options

```typescript
// app/api/agent/[...path]/route.ts
import { AgentLinkHandler } from '@agentlink/sdk/adapters/nextjs';
import { z } from 'zod';

// Validation schemas
const ResearchSchema = z.object({
  query: z.string().min(1).max(500),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard')
});

const SummarizeSchema = z.object({
  text: z.string().min(10).max(10000),
  maxLength: z.number().min(50).max(1000).default(200)
});

const handler = new AgentLinkHandler({
  agentName: 'advanced-nextjs-agent',
  apiKey: process.env.AGENTLINK_API_KEY!,
  
  // Capabilities with validation
  capabilities: {
    research: {
      handler: async (ctx, params) => {
        const { query, depth } = ResearchSchema.parse(params);
        
        console.log(`[${ctx.requestId}] Research: ${query}`);
        
        const result = await performResearch(query, depth);
        
        return {
          query,
          depth,
          result,
          creditsUsed: depth === 'deep' ? 3 : 1,
          requestId: ctx.requestId,
          processedAt: new Date().toISOString()
        };
      },
      pricing: {
        perRequest: 0.05
      }
    },
    
    summarize: {
      handler: async (ctx, params) => {
        const { text, maxLength } = SummarizeSchema.parse(params);
        
        const summary = await summarizeText(text, maxLength);
        
        return {
          summary,
          originalLength: text.length,
          summaryLength: summary.length,
          compressionRatio: (summary.length / text.length).toFixed(2),
          requestId: ctx.requestId
        };
      },
      pricing: {
        perRequest: 0.02
      }
    },
    
    analyze: {
      handler: async (ctx, params) => {
        const { data, analysisType } = params;
        
        const analysis = await analyzeData(data, analysisType);
        
        return {
          analysis,
          analysisType,
          requestId: ctx.requestId
        };
      },
      pricing: {
        perRequest: 0.03
      }
    }
  },
  
  // Global pricing
  pricing: {
    perRequest: 0.05,
    currency: 'USD',
    freeQuota: 3,
    tiers: [
      { requests: 10, price: 0.40 },
      { requests: 50, price: 1.75 }
    ]
  },
  
  // Rate limiting
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 1000
  },
  
  // Identity verification
  identity: {
    verifyCaller: true,
    trustedDIDs: ['did:agentlink:partner-1', 'did:agentlink:partner-2']
  },
  
  // Webhooks
  webhooks: [
    {
      url: 'https://my-server.com/webhooks',
      events: ['payment.received', 'request.completed']
    }
  ],
  
  // Custom middleware
  middleware: [
    async (ctx, next) => {
      console.log(`[Middleware] Request: ${ctx.capability}`);
      await next();
      console.log(`[Middleware] Response sent`);
    }
  ]
});

export const POST = handler.handle.bind(handler);
```

### Edge Runtime

```typescript
// app/api/agent/[...path]/route.ts
import { AgentLinkHandler } from '@agentlink/sdk/adapters/nextjs';

export const runtime = 'edge';

const handler = new AgentLinkHandler({
  agentName: 'edge-agent',
  apiKey: process.env.AGENTLINK_API_KEY!,
  capabilities: {
    greet: async (ctx, params) => {
      const { name } = params;
      return { message: `Hello, ${name}!` };
    }
  },
  pricing: {
    perRequest: 0.001,
    currency: 'USD'
  }
});

export const POST = handler.handle.bind(handler);
```

## Separate Capability Routes

### Route-Specific Handlers

```typescript
// app/api/agent/research/route.ts
import { AgentLinkHandler } from '@agentlink/sdk/adapters/nextjs';

const handler = new AgentLinkHandler({
  agentName: 'research-agent',
  apiKey: process.env.AGENTLINK_API_KEY!,
  capabilities: {
    default: async (ctx, params) => {
      const { query, depth = 'standard' } = params;
      
      const result = await performResearch(query, depth);
      
      return {
        result,
        creditsUsed: depth === 'deep' ? 3 : 1,
        requestId: ctx.requestId
      };
    }
  },
  pricing: {
    perRequest: 0.05,
    currency: 'USD',
    freeQuota: 3
  }
});

export const POST = handler.handle.bind(handler);

async function performResearch(query: string, depth: string) {
  return {
    summary: `Research on "${query}" completed`,
    confidence: 0.95
  };
}
```

```typescript
// app/api/agent/summarize/route.ts
import { AgentLinkHandler } from '@agentlink/sdk/adapters/nextjs';

const handler = new AgentLinkHandler({
  agentName: 'summarize-agent',
  apiKey: process.env.AGENTLINK_API_KEY!,
  capabilities: {
    default: async (ctx, params) => {
      const { text, maxLength = 200 } = params;
      
      const summary = text.slice(0, maxLength) + '...';
      
      return {
        summary,
        originalLength: text.length,
        requestId: ctx.requestId
      };
    }
  },
  pricing: {
    perRequest: 0.02,
    currency: 'USD',
    freeQuota: 5
  }
});

export const POST = handler.handle.bind(handler);
```

## Context Access

### Available Properties

```typescript
const handler = new AgentLinkHandler({
  agentName: 'context-demo',
  apiKey: process.env.AGENTLINK_API_KEY!,
  capabilities: {
    demo: async (ctx, params) => {
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
      
      return { success: true };
    }
  }
});
```

## Error Handling

### Custom Error Handler

```typescript
// app/api/agent/[...path]/route.ts
import { AgentLinkHandler } from '@agentlink/sdk/adapters/nextjs';
import { NextResponse } from 'next/server';

const handler = new AgentLinkHandler({
  agentName: 'error-handling-agent',
  apiKey: process.env.AGENTLINK_API_KEY!,
  capabilities: {
    research: async (ctx, params) => {
      const { query } = params;
      
      if (!query) {
        throw new Error('Query is required');
      }
      
      return { result: `Research on ${query}` };
    }
  },
  
  // Custom error handler
  onError: (error, ctx) => {
    console.error('Agent error:', error);
    
    if (error.message === 'Query is required') {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        requestId: ctx?.requestId 
      },
      { status: 500 }
    );
  }
});

export const POST = handler.handle.bind(handler);
```

## Webhook Handling

### Webhook Route

```typescript
// app/api/webhooks/agentlink/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('X-AgentLink-Signature');
  const body = await request.text();
  
  // Verify signature
  const isValid = verifyWebhookSignature(body, signature, process.env.WEBHOOK_SECRET!);
  
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const event = JSON.parse(body);
  
  // Handle events
  switch (event.type) {
    case 'payment.received':
      await handlePaymentReceived(event.data);
      break;
    case 'request.completed':
      await handleRequestCompleted(event.data);
      break;
    case 'agent.stopped':
      await handleAgentStopped(event.data);
      break;
  }
  
  return NextResponse.json({ received: true });
}

function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === expected;
}

async function handlePaymentReceived(data: any) {
  console.log('Payment received:', data);
  // Update database, send notifications, etc.
}

async function handleRequestCompleted(data: any) {
  console.log('Request completed:', data);
}

async function handleAgentStopped(data: any) {
  console.log('Agent stopped:', data);
}
```

## Health Check

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: '1.0.0',
    uptime: process.uptime()
  });
}
```

## Complete Example

```typescript
// app/api/agent/[...path]/route.ts
import { AgentLinkHandler } from '@agentlink/sdk/adapters/nextjs';
import { z } from 'zod';
import { NextResponse } from 'next/server';

// Validation schemas
const ResearchSchema = z.object({
  query: z.string().min(1).max(500),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard')
});

const SummarizeSchema = z.object({
  text: z.string().min(10).max(10000),
  maxLength: z.number().min(50).max(1000).default(200),
  style: z.enum(['concise', 'detailed', 'bullet']).default('concise')
});

const AnalyzeSchema = z.object({
  data: z.any(),
  analysisType: z.enum(['trend', 'sentiment', 'correlation']).default('trend')
});

// Create handler
const handler = new AgentLinkHandler({
  agentName: 'research-assistant',
  apiKey: process.env.AGENTLINK_API_KEY!,
  
  capabilities: {
    research: {
      handler: async (ctx, params) => {
        const { query, depth } = ResearchSchema.parse(params);
        
        console.log(`[${ctx.requestId}] Research: ${query}`);
        
        const result = await performResearch(query, depth);
        
        return {
          query,
          depth,
          result,
          creditsUsed: depth === 'deep' ? 3 : 1,
          requestId: ctx.requestId,
          processedAt: new Date().toISOString()
        };
      },
      pricing: { perRequest: 0.05 }
    },
    
    summarize: {
      handler: async (ctx, params) => {
        const { text, maxLength, style } = SummarizeSchema.parse(params);
        
        const summary = await summarizeText(text, maxLength, style);
        
        return {
          summary,
          style,
          originalLength: text.length,
          summaryLength: summary.length,
          compressionRatio: (summary.length / text.length).toFixed(2),
          requestId: ctx.requestId
        };
      },
      pricing: { perRequest: 0.02 }
    },
    
    analyze: {
      handler: async (ctx, params) => {
        const { data, analysisType } = AnalyzeSchema.parse(params);
        
        const analysis = await analyzeData(data, analysisType);
        
        return {
          analysis,
          analysisType,
          requestId: ctx.requestId
        };
      },
      pricing: { perRequest: 0.03 }
    }
  },
  
  pricing: {
    perRequest: 0.05,
    currency: 'USD',
    freeQuota: 3
  },
  
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 1000
  },
  
  onError: (error, ctx) => {
    console.error('Agent error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        requestId: ctx?.requestId 
      },
      { status: 500 }
    );
  }
});

export const POST = handler.handle.bind(handler);

// Helper functions
async function performResearch(query: string, depth: string) {
  // Your research implementation
  return {
    summary: `Research on "${query}" completed`,
    sources: ['https://example.com'],
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
```

## Deployment

### Vercel

```json
// vercel.json
{
  "functions": {
    "app/api/agent/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### Environment Variables

```bash
# Set in Vercel dashboard
AGENTLINK_API_KEY=your_api_key
AGENTLINK_ENV=production
```

### Build Configuration

```json
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@agentlink/sdk']
  }
};

module.exports = nextConfig;
```
