# Example: Paid Research Agent

A complete, production-ready research agent that accepts payments for its services.

## Overview

This example demonstrates:
- Multi-tier pricing
- Input validation with Zod
- Rate limiting
- Identity verification
- Comprehensive error handling
- Webhook integration

## Project Structure

```
paid-research-agent/
├── src/
│   ├── agent.ts           # Main agent configuration
│   ├── capabilities/
│   │   ├── research.ts    # Research capability
│   │   ├── summarize.ts   # Summarize capability
│   │   └── analyze.ts     # Analyze capability
│   ├── utils/
│   │   ├── validation.ts  # Validation schemas
│   │   ├── research.ts    # Research logic
│   │   └── errors.ts      # Custom errors
│   └── types/
│       └── index.ts       # TypeScript types
├── tests/
│   └── agent.test.ts
├── .env
├── package.json
└── tsconfig.json
```

## Complete Implementation

### package.json

```json
{
  "name": "paid-research-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/agent.ts",
    "build": "tsc",
    "start": "node dist/agent.js",
    "test": "vitest"
  },
  "dependencies": {
    "@agentlink/sdk": "^1.0.0",
    "openai": "^4.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

### .env

```bash
AGENTLINK_API_KEY=your_api_key_here
AGENTLINK_ENV=development
OPENAI_API_KEY=your_openai_key_here
WEBHOOK_SECRET=your_webhook_secret
```

### src/types/index.ts

```typescript
// Research result types
export interface ResearchResult {
  summary: string;
  keyPoints: string[];
  sources: Source[];
  confidence: number;
  processingTime: number;
}

export interface Source {
  title: string;
  url: string;
  credibility: number;
}

export interface SummaryResult {
  summary: string;
  originalLength: number;
  summaryLength: number;
  compressionRatio: string;
  style: SummaryStyle;
}

export type SummaryStyle = 'concise' | 'detailed' | 'bullet';

export interface AnalysisResult {
  insights: Insight[];
  trends: Trend[];
  sentiment: SentimentAnalysis;
}

export interface Insight {
  description: string;
  confidence: number;
  supportingData: any;
}

export interface Trend {
  name: string;
  direction: 'up' | 'down' | 'stable';
  magnitude: number;
}

export interface SentimentAnalysis {
  overall: 'positive' | 'negative' | 'neutral';
  score: number;
  breakdown: Record<string, number>;
}
```

### src/utils/validation.ts

```typescript
import { z } from 'zod';

export const ResearchSchema = z.object({
  query: z.string()
    .min(1, 'Query must not be empty')
    .max(500, 'Query must be 500 characters or less'),
  depth: z.enum(['quick', 'standard', 'deep'])
    .default('standard'),
  sources: z.array(z.string().url())
    .max(10, 'Maximum 10 sources allowed')
    .optional(),
  focus: z.array(z.string())
    .max(5, 'Maximum 5 focus areas')
    .optional()
});

export const SummarizeSchema = z.object({
  text: z.string()
    .min(10, 'Text must be at least 10 characters')
    .max(50000, 'Text must be 50000 characters or less'),
  maxLength: z.number()
    .min(50, 'Minimum length is 50')
    .max(5000, 'Maximum length is 5000')
    .default(200),
  style: z.enum(['concise', 'detailed', 'bullet'])
    .default('concise'),
  preserveKeyPoints: z.boolean()
    .default(true)
});

export const AnalyzeSchema = z.object({
  data: z.any(),
  analysisType: z.enum(['trend', 'sentiment', 'correlation', 'comprehensive'])
    .default('comprehensive'),
  context: z.string()
    .max(1000)
    .optional()
});

export type ResearchInput = z.infer<typeof ResearchSchema>;
export type SummarizeInput = z.infer<typeof SummarizeSchema>;
export type AnalyzeInput = z.infer<typeof AnalyzeSchema>;
```

### src/utils/errors.ts

```typescript
export class ResearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ResearchError';
  }
}

export class ValidationError extends ResearchError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ResearchFailedError extends ResearchError {
  constructor(message: string, details?: any) {
    super(message, 'RESEARCH_FAILED', details);
    this.name = 'ResearchFailedError';
  }
}
```

### src/utils/research.ts

```typescript
import OpenAI from 'openai';
import type { ResearchResult, SummaryResult, AnalysisResult, SummaryStyle } from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function performResearch(
  query: string,
  depth: string,
  sources?: string[],
  focus?: string[]
): Promise<ResearchResult> {
  const startTime = Date.now();
  
  // Determine model based on depth
  const model = depth === 'deep' ? 'gpt-4' : 'gpt-3.5-turbo';
  const maxTokens = depth === 'deep' ? 4000 : 2000;
  
  // Build system prompt
  let systemPrompt = 'You are an expert research assistant. Provide comprehensive, well-sourced research.';
  
  if (focus && focus.length > 0) {
    systemPrompt += ` Focus on: ${focus.join(', ')}.`;
  }
  
  if (sources && sources.length > 0) {
    systemPrompt += ` Consider these sources: ${sources.join(', ')}.`;
  }
  
  // Perform research
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Research the following topic thoroughly: ${query}` }
    ],
    max_tokens: maxTokens
  });
  
  const content = completion.choices[0].message.content || '';
  
  // Parse results
  const result: ResearchResult = {
    summary: content.slice(0, 1000),
    keyPoints: extractKeyPoints(content),
    sources: extractSources(content, sources),
    confidence: calculateConfidence(content),
    processingTime: Date.now() - startTime
  };
  
  return result;
}

export async function summarizeText(
  text: string,
  maxLength: number,
  style: SummaryStyle
): Promise<SummaryResult> {
  let systemPrompt = 'Summarize the following text';
  
  switch (style) {
    case 'concise':
      systemPrompt += ' in a concise manner';
      break;
    case 'detailed':
      systemPrompt += ' with detailed explanations';
      break;
    case 'bullet':
      systemPrompt += ' as bullet points';
      break;
  }
  
  systemPrompt += `. Maximum length: ${maxLength} characters.`;
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    max_tokens: Math.ceil(maxLength / 2)
  });
  
  const summary = completion.choices[0].message.content || '';
  
  return {
    summary,
    originalLength: text.length,
    summaryLength: summary.length,
    compressionRatio: (summary.length / text.length).toFixed(2),
    style
  };
}

export async function analyzeData(
  data: any,
  analysisType: string
): Promise<AnalysisResult> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are a data analyst. Perform ${analysisType} analysis.`
      },
      {
        role: 'user',
        content: `Analyze this data: ${JSON.stringify(data)}`
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  const content = completion.choices[0].message.content || '{}';
  const parsed = JSON.parse(content);
  
  return {
    insights: parsed.insights || [],
    trends: parsed.trends || [],
    sentiment: parsed.sentiment || { overall: 'neutral', score: 0.5, breakdown: {} }
  };
}

// Helper functions
function extractKeyPoints(content: string): string[] {
  const points = content.match(/(?:^|\n)[\s]*[-•*][\s]*(.+?)(?=\n|$)/g);
  return points?.map(p => p.replace(/^[\s]*[-•*][\s]*/, '').trim()).slice(0, 10) || [];
}

function extractSources(content: string, providedSources?: string[]) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const foundUrls = content.match(urlRegex) || [];
  
  const sources = [...new Set([...foundUrls, ...(providedSources || [])])].slice(0, 10);
  
  return sources.map(url => ({
    title: extractTitleFromUrl(url),
    url,
    credibility: 0.8
  }));
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'Unknown Source';
  }
}

function calculateConfidence(content: string): number {
  const hasSources = /https?:\/\//.test(content);
  const hasData = /\d+%?|\$\d+/.test(content);
  const length = content.length;
  
  let confidence = 0.5;
  if (hasSources) confidence += 0.2;
  if (hasData) confidence += 0.15;
  if (length > 500) confidence += 0.15;
  
  return Math.min(confidence, 1.0);
}
```

### src/agent.ts

```typescript
import { createAgent } from '@agentlink/sdk';
import { ResearchSchema, SummarizeSchema, AnalyzeSchema } from './utils/validation.js';
import { performResearch, summarizeText, analyzeData } from './utils/research.js';
import { ValidationError, ResearchFailedError } from './utils/errors.js';

// Create the agent
const agent = createAgent({
  name: 'premium-research-agent',
  description: 'AI-powered research assistant with comprehensive analysis capabilities',
  capabilities: ['research', 'summarize', 'analyze'],
  
  // Multi-tier pricing
  pricing: {
    perRequest: 0.05,
    currency: 'USD',
    freeQuota: 2,
    tiers: [
      { requests: 5, price: 0.20 },    // $0.04 per request
      { requests: 20, price: 0.75 },   // $0.0375 per request
      { requests: 100, price: 3.00 }   // $0.03 per request
    ]
  },
  
  // Rate limiting
  rateLimit: {
    requestsPerMinute: 30,
    requestsPerHour: 500,
    requestsPerDay: 2000,
    perUser: true
  },
  
  // Identity verification
  identity: {
    did: 'did:agentlink:premium-research-agent',
    verifyCaller: false,
    trustedDIDs: []
  },
  
  // Webhooks
  webhooks: [
    {
      url: process.env.WEBHOOK_URL || '',
      events: ['payment.received', 'request.completed', 'request.failed'],
      secret: process.env.WEBHOOK_SECRET
    }
  ]
});

// Research capability
agent.handle('research', async (ctx, params) => {
  const startTime = Date.now();
  
  try {
    // Validate input
    const validation = ResearchSchema.safeParse(params);
    if (!validation.success) {
      throw new ValidationError(
        'Invalid research parameters',
        validation.error.errors
      );
    }
    
    const { query, depth, sources, focus } = validation.data;
    
    console.log(`[${ctx.requestId}] Research: "${query}" (${depth})`);
    console.log(`[${ctx.requestId}] User: ${ctx.user.walletAddress}`);
    
    // Perform research
    const result = await performResearch(query, depth, sources, focus);
    
    // Calculate credits used
    const creditsUsed = depth === 'deep' ? 3 : depth === 'standard' ? 2 : 1;
    
    console.log(`[${ctx.requestId}] Completed in ${result.processingTime}ms`);
    
    return {
      success: true,
      query,
      depth,
      result,
      creditsUsed,
      requestId: ctx.requestId,
      processedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime
    };
    
  } catch (error) {
    console.error(`[${ctx.requestId}] Research failed:`, error);
    
    if (error instanceof ValidationError) {
      throw error;
    }
    
    throw new ResearchFailedError(
      'Research operation failed',
      { originalError: error.message }
    );
  }
});

// Summarize capability
agent.handle('summarize', async (ctx, params) => {
  try {
    const validation = SummarizeSchema.safeParse(params);
    if (!validation.success) {
      throw new ValidationError(
        'Invalid summarize parameters',
        validation.error.errors
      );
    }
    
    const { text, maxLength, style, preserveKeyPoints } = validation.data;
    
    console.log(`[${ctx.requestId}] Summarize: ${text.length} chars -> ${maxLength} chars`);
    
    const result = await summarizeText(text, maxLength, style);
    
    return {
      success: true,
      result,
      creditsUsed: 1,
      requestId: ctx.requestId,
      processedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`[${ctx.requestId}] Summarize failed:`, error);
    throw error;
  }
});

// Analyze capability
agent.handle('analyze', async (ctx, params) => {
  try {
    const validation = AnalyzeSchema.safeParse(params);
    if (!validation.success) {
      throw new ValidationError(
        'Invalid analyze parameters',
        validation.error.errors
      );
    }
    
    const { data, analysisType, context } = validation.data;
    
    console.log(`[${ctx.requestId}] Analyze: ${analysisType}`);
    
    const result = await analyzeData(data, analysisType);
    
    return {
      success: true,
      data,
      analysisType,
      result,
      creditsUsed: 2,
      requestId: ctx.requestId,
      processedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`[${ctx.requestId}] Analyze failed:`, error);
    throw error;
  }
});

// Event listeners
agent.on('payment', (event) => {
  console.log('💰 Payment received:', {
    amount: event.amount,
    currency: event.currency,
    wallet: event.walletAddress,
    txHash: event.txHash
  });
});

agent.on('request', (event) => {
  console.log('📨 Request received:', {
    requestId: event.requestId,
    capability: event.capability
  });
});

agent.on('error', (event) => {
  console.error('❌ Error:', {
    requestId: event.requestId,
    error: event.error.message
  });
});

// Start the agent
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

agent.start({ port: PORT });

console.log(`🚀 Premium Research Agent running on port ${PORT}`);
console.log(`📊 Pricing: $0.05/request with volume discounts`);
console.log(`🎁 Free quota: 2 requests`);

export default agent;
```

### tests/agent.test.ts

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import agent from '../src/agent.js';

describe('Premium Research Agent', () => {
  let server: any;
  
  beforeAll(async () => {
    server = await agent.start({ port: 0 }); // Random port
  });
  
  afterAll(async () => {
    await agent.stop();
  });
  
  it('should handle research requests', async () => {
    const response = await fetch(`http://localhost:${server.port}/agent/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'AI agents in 2024',
        depth: 'quick'
      })
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.result).toBeDefined();
  });
  
  it('should validate input', async () => {
    const response = await fetch(`http://localhost:${server.port}/agent/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '', // Invalid: empty
        depth: 'invalid' // Invalid: not in enum
      })
    });
    
    expect(response.status).toBe(400);
  });
});
```

## Usage

### Start the Agent

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your API keys

# Run in development
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

### Make Requests

```bash
# Free request (within quota)
curl -X POST http://localhost:3000/agent/research \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Latest AI developments",
    "depth": "standard"
  }'

# With focus areas
curl -X POST http://localhost:3000/agent/research \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Quantum computing",
    "depth": "deep",
    "focus": ["commercial applications", "key players"]
  }'

# Summarize
curl -X POST http://localhost:3000/agent/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your long text here...",
    "maxLength": 300,
    "style": "bullet"
  }'

# Analyze
curl -X POST http://localhost:3000/agent/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "data": { "sales": [100, 150, 200] },
    "analysisType": "trend"
  }'
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

ENV NODE_ENV=production

CMD ["node", "dist/agent.js"]
```

### AgentLink Cloud

```bash
# Install CLI
npm install -g @agentlink/cli

# Login
agentlink login

# Deploy
agentlink deploy
```

## Monitoring

The agent emits events for:
- `payment` - Payment received
- `request` - Request received
- `error` - Error occurred

Configure webhooks to receive these events at your endpoint.
