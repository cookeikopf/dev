# SDK Reference

Complete API reference for the AgentLink SDK.

## Table of Contents

- [Core API](#core-api)
- [createAgent](#createagent)
- [Agent Methods](#agent-methods)
- [Context Object](#context-object)
- [Framework Adapters](#framework-adapters)
- [A2A Protocol](#a2a-protocol)
- [x402 Middleware](#x402-middleware)
- [Identity Integration](#identity-integration)
- [Types](#types)

## Core API

### createAgent

Creates a new AgentLink agent instance.

```typescript
import { createAgent } from '@agentlink/sdk';

const agent = createAgent(config: AgentConfig): Agent
```

#### AgentConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Unique agent name (slug format) |
| `description` | `string` | No | Human-readable description |
| `capabilities` | `string[]` | Yes | List of supported capabilities |
| `pricing` | `PricingConfig` | No | Payment configuration |
| `identity` | `IdentityConfig` | No | DID identity settings |
| `rateLimit` | `RateLimitConfig` | No | Rate limiting rules |
| `webhooks` | `WebhookConfig[]` | No | Webhook endpoints |

#### PricingConfig

```typescript
interface PricingConfig {
  perRequest: number;           // Price per request
  currency: 'USD' | 'ETH' | 'USDC';  // Currency code
  freeQuota?: number;           // Free requests before payment required
  tiers?: PricingTier[];        // Volume pricing tiers
}

interface PricingTier {
  requests: number;             // Number of requests
  price: number;                // Total price for tier
}
```

#### IdentityConfig

```typescript
interface IdentityConfig {
  did?: string;                 // Agent's DID
  verifyCaller?: boolean;       // Require caller verification
  trustedDIDs?: string[];       // List of trusted caller DIDs
}
```

#### RateLimitConfig

```typescript
interface RateLimitConfig {
  requestsPerMinute?: number;   // Max requests per minute
  requestsPerHour?: number;     // Max requests per hour
  requestsPerDay?: number;      // Max requests per day
  perUser?: boolean;            // Apply per user (default: true)
}
```

## Agent Methods

### handle

Register a capability handler.

```typescript
agent.handle<TInput, TOutput>(
  capability: string,
  handler: (ctx: Context, params: TInput) => Promise<TOutput>
): Agent
```

**Example:**

```typescript
agent.handle('research', async (ctx, params) => {
  const { query } = params;
  // Process request
  return { result: `Research on ${query}` };
});
```

### use

Add middleware to the agent.

```typescript
agent.use(middleware: Middleware): Agent
```

**Example:**

```typescript
agent.use(async (ctx, next) => {
  console.log(`Request: ${ctx.capability}`);
  await next();
  console.log(`Response sent`);
});
```

### start

Start the agent server.

```typescript
agent.start(options?: StartOptions): Promise<Server>
```

#### StartOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `port` | `number` | `3000` | Server port |
| `host` | `string` | `'0.0.0.0'` | Server host |
| `path` | `string` | `'/agent'` | Base path for endpoints |

**Example:**

```typescript
await agent.start({ port: 3000, host: '127.0.0.1' });
```

### stop

Stop the agent server.

```typescript
agent.stop(): Promise<void>
```

### discover

Register agent with discovery service.

```typescript
agent.discover(options?: DiscoverOptions): Promise<void>
```

### on

Listen for events.

```typescript
agent.on(event: AgentEvent, handler: Function): void
```

**Events:**
- `request` - Incoming request received
- `payment` - Payment processed
- `error` - Error occurred
- `ready` - Agent started

**Example:**

```typescript
agent.on('payment', (event) => {
  console.log(`Received $${event.amount} from ${event.walletAddress}`);
});
```

## Context Object

The context object is passed to all handlers and middleware.

```typescript
interface Context {
  // Request info
  requestId: string;
  capability: string;
  params: Record<string, any>;
  
  // User info
  user: {
    walletAddress?: string;
    did?: string;
    quotaUsed: number;
    quotaRemaining: number;
  };
  
  // Agent info
  agent: {
    name: string;
    did?: string;
  };
  
  // Payment info
  payment?: {
    amount: number;
    currency: string;
    txHash?: string;
  };
  
  // Request metadata
  headers: Record<string, string>;
  timestamp: Date;
  ip?: string;
}
```

## Framework Adapters

### LangChain Adapter

```typescript
import { AgentLinkToolkit } from '@agentlink/sdk/adapters/langchain';
import { OpenAI } from '@langchain/openai';

const toolkit = new AgentLinkToolkit({
  apiKey: process.env.AGENTLINK_API_KEY,
  agentName: 'my-agent'
});

// Create LangChain tools
const tools = toolkit.getTools();

// Use with an agent
const agent = new OpenAI({});
const executor = AgentExecutor.fromAgentAndTools({
  agent: createOpenAIFunctionsAgent({ llm, tools }),
  tools
});
```

#### AgentLinkToolkit Methods

| Method | Description |
|--------|-------------|
| `getTools()` | Get LangChain-compatible tools |
| `getAgentTool(name)` | Get a specific agent tool |
| `registerCapability(name, handler)` | Register custom capability |

### CrewAI Adapter

```python
from agentlink.adapters.crewai import AgentLinkAdapter
from crewai import Agent, Task, Crew

# Initialize adapter
adapter = AgentLinkAdapter(
    api_key="your_api_key",
    agent_name="research-agent"
)

# Create CrewAI agent with AgentLink capabilities
researcher = Agent(
    role='Researcher',
    goal='Conduct thorough research',
    tools=adapter.get_tools()
)

# Create task
task = Task(
    description='Research AI agents',
    agent=researcher
)

# Run crew
crew = Crew(agents=[researcher], tasks=[task])
result = crew.kickoff()
```

### Hono Adapter

```typescript
import { Hono } from 'hono';
import { agentLinkMiddleware } from '@agentlink/sdk/adapters/hono';

const app = new Hono();

// Add AgentLink middleware
app.use('/agent/*', agentLinkMiddleware({
  agentName: 'my-agent',
  apiKey: process.env.AGENTLINK_API_KEY
}));

// Define capabilities
app.post('/agent/research', async (c) => {
  const { query } = await c.req.json();
  const ctx = c.get('agentlink');
  
  // Process with payment already verified
  const result = await doResearch(query);
  
  return c.json({ result });
});

export default app;
```

### Express Adapter

```typescript
import express from 'express';
import { agentLinkMiddleware } from '@agentlink/sdk/adapters/express';

const app = express();
app.use(express.json());

// Add AgentLink middleware
app.use('/agent', agentLinkMiddleware({
  agentName: 'my-agent',
  apiKey: process.env.AGENTLINK_API_KEY,
  capabilities: ['research', 'summarize']
}));

// Handle requests
app.post('/agent/research', async (req, res) => {
  const { query } = req.body;
  const ctx = req.agentlink;
  
  // Payment verified automatically
  const result = await doResearch(query);
  
  res.json({ result });
});

app.listen(3000);
```

### Next.js Adapter

```typescript
// app/api/agent/[...path]/route.ts
import { AgentLinkHandler } from '@agentlink/sdk/adapters/nextjs';

const handler = new AgentLinkHandler({
  agentName: 'my-agent',
  apiKey: process.env.AGENTLINK_API_KEY,
  capabilities: {
    research: async (ctx, params) => {
      const { query } = params;
      return { result: await doResearch(query) };
    },
    summarize: async (ctx, params) => {
      const { text } = params;
      return { summary: await doSummarize(text) };
    }
  }
});

export const POST = handler.handle.bind(handler);
```

## A2A Protocol

AgentLink implements the Google A2A (Agent-to-Agent) protocol.

### A2A Server

```typescript
import { A2AServer } from '@agentlink/sdk/a2a';

const server = new A2AServer({
  agentCard: {
    name: 'research-agent',
    description: 'AI research assistant',
    url: 'https://my-agent.agentlink.dev',
    capabilities: [
      { name: 'research', description: 'Research any topic' }
    ],
    authentication: {
      schemes: ['payment']
    }
  }
});

server.start({ port: 3000 });
```

### A2A Client

```typescript
import { A2AClient } from '@agentlink/sdk/a2a';

const client = new A2AClient();

// Discover agent
const agentCard = await client.discover('https://other-agent.dev');

// Send task
const task = await client.sendTask({
  agentUrl: agentCard.url,
  capability: 'research',
  params: { query: 'AI agents' },
  payment: {
    maxAmount: 0.05,
    currency: 'USD'
  }
});

console.log(task.result);
```

### A2A Types

```typescript
interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: Capability[];
  authentication: AuthConfig;
  pricing?: PricingInfo;
}

interface Capability {
  name: string;
  description: string;
  parameters?: ParameterSchema;
}

interface Task {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  capability: string;
  params: Record<string, any>;
  result?: any;
  error?: string;
}
```

## x402 Middleware

The x402 middleware handles payment verification.

### Configuration

```typescript
import { x402Middleware } from '@agentlink/sdk/payments';

const middleware = x402Middleware({
  // Required
  price: 0.01,
  currency: 'USD',
  
  // Optional
  address: '0x...',           // Payment recipient
  freeQuota: 5,               // Free requests
  verifyOnChain: true,        // Verify on-chain
  network: 'base',            // Blockchain network
  
  // Custom logic
  shouldCharge: (req) => {
    // Return false for health checks
    return req.path !== '/health';
  }
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `price` | `number` | Required | Price per request |
| `currency` | `string` | Required | Currency code |
| `address` | `string` | Auto | Payment recipient address |
| `freeQuota` | `number` | `0` | Free requests per user |
| `verifyOnChain` | `boolean` | `true` | Verify payments on-chain |
| `network` | `string` | `'base'` | Blockchain network |
| `shouldCharge` | `function` | All | Custom charge logic |

### Payment Response

When payment is required, the middleware returns:

```http
HTTP/1.1 402 Payment Required
X-402-Version: 1.0
X-402-Amount: 0.01
X-402-Currency: USD
X-402-Address: 0x...
X-402-Network: base
X-402-Expires: 3600

{
  "error": "Payment required",
  "payment": {
    "amount": 0.01,
    "currency": "USD",
    "address": "0x..."
  }
}
```

## Identity Integration

### DID Resolution

```typescript
import { DIDResolver } from '@agentlink/sdk/identity';

const resolver = new DIDResolver();

// Resolve DID
const doc = await resolver.resolve('did:agentlink:my-agent');
console.log(doc.verificationMethod);
```

### DID Creation

```typescript
import { createDID } from '@agentlink/sdk/identity';

const did = await createDID({
  method: 'agentlink',
  controller: 'did:agentlink:parent'
});

console.log(did.id);  // did:agentlink:...
```

### Verify Signature

```typescript
import { verifySignature } from '@agentlink/sdk/identity';

const isValid = await verifySignature({
  did: 'did:agentlink:caller',
  message: 'request-payload',
  signature: '0x...'
});
```

## Types

### Complete Type Definitions

```typescript
// Agent Types
interface Agent {
  name: string;
  description?: string;
  capabilities: string[];
  config: AgentConfig;
  handle: <T, R>(cap: string, handler: Handler<T, R>) => Agent;
  use: (middleware: Middleware) => Agent;
  start: (opts?: StartOptions) => Promise<Server>;
  stop: () => Promise<void>;
  on: (event: string, handler: Function) => void;
}

interface AgentConfig {
  name: string;
  description?: string;
  capabilities: string[];
  pricing?: PricingConfig;
  identity?: IdentityConfig;
  rateLimit?: RateLimitConfig;
  webhooks?: WebhookConfig[];
}

// Payment Types
interface PricingConfig {
  perRequest: number;
  currency: Currency;
  freeQuota?: number;
  tiers?: PricingTier[];
}

type Currency = 'USD' | 'ETH' | 'USDC' | 'USDT';

interface Payment {
  amount: number;
  currency: string;
  txHash?: string;
  from: string;
  to: string;
  timestamp: Date;
}

// Context Types
interface Context {
  requestId: string;
  capability: string;
  params: Record<string, any>;
  user: UserContext;
  agent: AgentContext;
  payment?: Payment;
  headers: Record<string, string>;
  timestamp: Date;
  ip?: string;
}

interface UserContext {
  walletAddress?: string;
  did?: string;
  quotaUsed: number;
  quotaRemaining: number;
}

interface AgentContext {
  name: string;
  did?: string;
}

// Handler Types
type Handler<TInput, TOutput> = (
  ctx: Context,
  params: TInput
) => Promise<TOutput>;

type Middleware = (
  ctx: Context,
  next: () => Promise<void>
) => Promise<void>;

// Event Types
type AgentEvent = 
  | 'request' 
  | 'payment' 
  | 'error' 
  | 'ready' 
  | 'stop';

interface RequestEvent {
  requestId: string;
  capability: string;
  params: Record<string, any>;
}

interface PaymentEvent {
  requestId: string;
  amount: number;
  currency: string;
  walletAddress: string;
  txHash?: string;
}

interface ErrorEvent {
  requestId: string;
  error: Error;
  capability?: string;
}
```

## Error Handling

### SDK Errors

```typescript
import { AgentLinkError, PaymentError, RateLimitError } from '@agentlink/sdk';

try {
  await agent.start();
} catch (error) {
  if (error instanceof PaymentError) {
    console.log('Payment failed:', error.message);
  } else if (error instanceof RateLimitError) {
    console.log('Rate limited:', error.retryAfter);
  } else if (error instanceof AgentLinkError) {
    console.log('AgentLink error:', error.code);
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `PAYMENT_REQUIRED` | Payment needed |
| `PAYMENT_FAILED` | Payment verification failed |
| `RATE_LIMITED` | Too many requests |
| `INVALID_CAPABILITY` | Capability not found |
| `UNAUTHORIZED` | Authentication failed |
| `INVALID_PARAMS` | Invalid request parameters |

## Utilities

### Validation

```typescript
import { validateParams, ValidationSchema } from '@agentlink/sdk/utils';

const schema: ValidationSchema = {
  query: { type: 'string', required: true, min: 1, max: 500 },
  depth: { type: 'string', enum: ['quick', 'standard', 'deep'] }
};

const result = validateParams(params, schema);
```

### Logging

```typescript
import { createLogger } from '@agentlink/sdk/utils';

const logger = createLogger({
  level: 'info',
  format: 'json'
});

logger.info('Agent started', { agent: 'my-agent' });
logger.error('Request failed', { error });
```

### Webhook Helpers

```typescript
import { verifyWebhook, createWebhookHandler } from '@agentlink/sdk/utils';

// Verify webhook signature
const isValid = verifyWebhook(payload, signature, secret);

// Create handler
const handler = createWebhookHandler({
  secret: process.env.WEBHOOK_SECRET,
  onPayment: (event) => console.log('Payment:', event),
  onError: (event) => console.log('Error:', event)
});
```
