# @agentlink/core

[![npm version](https://badge.fury.io/js/@agentlink%2Fcore.svg)](https://www.npmjs.com/package/@agentlink/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AgentLink is a TypeScript SDK for building agentic services with:

- **A2A Protocol** - Agent-to-Agent communication standard
- **x402 Payments** - HTTP 402 payment protection for endpoints
- **ERC-8004 Identity** - Blockchain-based agent identity
- **Framework Adapters** - First-class support for Hono, Express, and Next.js

## Installation

```bash
npm install @agentlink/core
```

### Peer Dependencies

The SDK has optional peer dependencies for framework adapters:

```bash
# For Hono
npm install hono

# For Express
npm install express

# For Next.js
npm install next
```

## Quick Start

```typescript
import { createAgent, createCapability } from '@agentlink/core';

const agent = createAgent({
  name: 'ResearchAgent',
  identity: 'eip155:84532/0x1234567890abcdef1234567890abcdef12345678',
  description: 'An agent that researches topics',
  capabilities: [
    createCapability()
      .id('research')
      .name('Research Topic')
      .description('Research a given topic and return findings')
      .pricing(0.01) // 0.01 USDC per request
      .input({
        schema: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            depth: { type: 'number', default: 3 },
          },
          required: ['topic'],
        },
      })
      .handler(async (input, context) => {
        // Your research logic here
        return {
          findings: [`Result for: ${input.topic}`],
          sources: ['source1', 'source2'],
        };
      })
      .build(),
  ],
  x402: {
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    chainId: 84532, // Base Sepolia
    receiver: '0xYourReceiverAddress',
  },
});
```

## Framework Integration

### Hono

```typescript
import { Hono } from 'hono';
import { honoAdapter } from '@agentlink/core/adapters/hono';

const app = new Hono();

// Mount agent with all A2A endpoints
app.use('/agent', honoAdapter(agent, { enableSse: true }));

// Or mount specific capability
import { createCapabilityHandler } from '@agentlink/core/adapters/hono';
app.post('/research', createCapabilityHandler(agent, 'research'));

export default app;
```

### Express

```typescript
import express from 'express';
import { expressAdapter } from '@agentlink/core/adapters/express';

const app = express();
app.use(express.json());

// Mount agent with all A2A endpoints
app.use('/agent', expressAdapter(agent, { enableSse: true }));

// Or mount specific capability
import { createCapabilityHandler } from '@agentlink/core/adapters/express';
app.post('/research', createCapabilityHandler(agent, 'research'));

app.listen(3000);
```

### Next.js (App Router)

```typescript
// app/api/agent/route.ts
import { createRouteHandlers } from '@agentlink/core/adapters/next';

const agent = createAgent({ /* ... */ });

export const { GET, POST } = createRouteHandlers(agent, {
  enableSse: true,
  cors: { origin: '*' },
});
```

```typescript
// app/api/agent/[...path]/route.ts (Edge Runtime)
export const runtime = 'edge';

import { edgeHandler } from '@agentlink/core/adapters/next';

const agent = createAgent({ /* ... */ });

export default edgeHandler(agent);
```

## Core API

### `createAgent(config)`

Creates a new agent instance.

```typescript
interface AgentConfig {
  name: string;
  identity: `eip155:${number}/${string}`;
  description?: string;
  capabilities: Capability[];
  pricing?: Record<string, number>;
  x402?: X402Config;
  telemetry?: TelemetryConfig;
  a2a?: A2AConfig;
  version?: string;
  url?: string;
  documentationUrl?: string;
  provider?: ProviderInfo;
}
```

### `createCapability()`

Builder for creating capabilities.

```typescript
const capability = createCapability()
  .id('unique-id')
  .name('Display Name')
  .description('What this capability does')
  .pricing(0.01) // Optional: USDC price
  .input({
    schema: { /* JSON Schema */ },
    description: 'Input description',
    examples: [{ example: 'data' }],
  })
  .output({
    schema: { /* JSON Schema */ },
    description: 'Output description',
  })
  .handler(async (input, context) => {
    // Handler logic
    return result;
  })
  .build();
```

### Capability Handler Context

```typescript
interface CapabilityContext {
  agent: Agent;           // Agent instance
  request: RequestContext; // Request metadata
  payment?: PaymentContext; // Payment info (if paid)
  telemetry: TelemetryEmitter; // Event emitter
}

interface RequestContext {
  id: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  timestamp: Date;
}

interface PaymentContext {
  amount: number;
  txHash: string;
  payer: string;
  timestamp: Date;
}
```

## A2A Protocol

The A2A (Agent-to-Agent) protocol provides standardized communication between agents.

### Agent Card

Automatically served at `/.well-known/agent.json`:

```json
{
  "schema_version": "1.0",
  "name": "ResearchAgent",
  "description": "An agent that researches topics",
  "url": "https://api.example.com",
  "capabilities": [
    {
      "id": "research",
      "name": "Research Topic",
      "description": "Research a given topic",
      "pricing": 0.01,
      "requiresPayment": true
    }
  ]
}
```

### JSON-RPC Methods

| Method | Description |
|--------|-------------|
| `a2a.discover` | Get agent metadata and capabilities |
| `a2a.capabilities` | List available capabilities |
| `a2a.handover` | Transfer task to another agent |

### Example Request

```bash
curl -X POST https://api.example.com/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "a2a.discover"
  }'
```

## x402 Payments

Protect endpoints with HTTP 402 Payment Required responses.

### Configuration

```typescript
const agent = createAgent({
  // ...
  x402: {
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    chainId: 84532,
    receiver: '0xYourReceiverAddress',
    timeout: 300, // Payment expiration in seconds
    verifyPayment: async (txHash, amount) => {
      // Custom verification logic
      return true;
    },
  },
});
```

### Payment Flow

1. Client requests capability without payment
2. Server responds with `402 Payment Required`:
   ```json
   {
     "status": 402,
     "paymentRequired": {
       "amount": 10000,
       "token": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
       "chainId": 84532,
       "receiver": "0x...",
       "paymentId": "unique-id",
       "expiresAt": 1234567890
     },
     "message": "Payment required: 0.01 USDC"
   }
   ```
3. Client submits payment transaction
4. Client retries with payment proof in header:
   ```
   X-Payment-Proof: {"txHash":"0x...","amount":10000,...}
   ```

### Default USDC Addresses

| Chain | Chain ID | USDC Address |
|-------|----------|--------------|
| Ethereum | 1 | `0xA0b86a33E6441e0A421e56E4773C3C4b0Db7E5b0` |
| Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Sepolia | 11155111 | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

## Telemetry

Collect events for monitoring and analytics.

```typescript
const agent = createAgent({
  // ...
  telemetry: {
    enabled: true,
    hooks: {
      onCapabilityInvoke: async (event) => {
        console.log('Capability invoked:', event.capabilityId);
        // Send to analytics service
      },
      onPaymentReceived: async (event) => {
        console.log('Payment received:', event.amount);
        // Update revenue tracking
      },
      onError: async (event) => {
        console.error('Error:', event.message);
        // Send to error tracking
      },
    },
  },
});

// Subscribe to custom events
agent.telemetry.on('custom:event', (data) => {
  console.log('Custom event:', data);
});

// Emit custom events
agent.telemetry.emit('custom:event', { foo: 'bar' });
```

### Event Types

| Event | Data |
|-------|------|
| `capability:invoke` | `CapabilityInvokeEvent` |
| `payment:received` | `PaymentReceivedEvent` |
| `error` | `ErrorEvent` |

## Utilities

```typescript
import {
  generateId,
  parseIdentityReference,
  isValidIdentityReference,
  createIdentityReference,
  formatUsdcAmount,
  parseUsdcAmount,
  sanitizeForLogging,
  withRetry,
  deepMerge,
} from '@agentlink/core';

// Generate unique IDs
const id = generateId(); // "1234567890-abc123"

// Parse ERC-8004 identity
const { chainId, address } = parseIdentityReference('eip155:84532/0x...');

// Validate identity format
const isValid = isValidIdentityReference('eip155:84532/0x...');

// Create identity reference
const identity = createIdentityReference('eip155:84532', '0x...');

// Format USDC amounts
const formatted = formatUsdcAmount(1500000); // "1.500000"
const parsed = parseUsdcAmount(1.5); // 1500000

// Sanitize for logging (removes sensitive keys)
const safe = sanitizeForLogging({ password: 'secret', data: 'ok' });
// { password: '[REDACTED]', data: 'ok' }

// Retry with exponential backoff
const result = await withRetry(async () => {
  return await fetchData();
}, {
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
});

// Deep merge objects
const merged = deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 } });
// { a: 1, b: { c: 2, d: 3 } }
```

## TypeScript

The SDK is written in TypeScript with strict mode enabled. All types are exported:

```typescript
import type {
  Agent,
  AgentConfig,
  Capability,
  CapabilityContext,
  AgentCard,
  X402Config,
  TelemetryConfig,
  // ... and more
} from '@agentlink/core';
```

## Error Handling

```typescript
try {
  const result = await agent.executeCapability('research', { topic: 'AI' });
} catch (error) {
  if (error instanceof Error) {
    console.error('Capability failed:', error.message);
  }
}
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Building

```bash
# Build for production
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Examples

### Research Agent with Payment

```typescript
import { createAgent, createCapability } from '@agentlink/core';
import { honoAdapter } from '@agentlink/core/adapters/hono';
import { Hono } from 'hono';

const agent = createAgent({
  name: 'ResearchAgent',
  identity: 'eip155:84532/0x1234567890abcdef1234567890abcdef12345678',
  description: 'AI-powered research agent',
  capabilities: [
    createCapability()
      .id('summarize')
      .name('Summarize Content')
      .description('Summarize long-form content')
      .pricing(0.005)
      .handler(async (input: { content: string }, ctx) => {
        // Access payment info if available
        if (ctx.payment) {
          console.log(`Paid ${ctx.payment.amount} by ${ctx.payment.payer}`);
        }
        
        // Summarize logic
        return { summary: input.content.slice(0, 100) + '...' };
      })
      .build(),
    createCapability()
      .id('research')
      .name('Deep Research')
      .description('Conduct deep research on a topic')
      .pricing(0.05)
      .handler(async (input: { topic: string }) => {
        // Research logic
        return { findings: [`Research on ${input.topic}`] };
      })
      .build(),
  ],
  x402: {
    chainId: 84532,
    receiver: '0xYourAddress',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  telemetry: {
    enabled: true,
    hooks: {
      onCapabilityInvoke: (e) => console.log(`Invoked: ${e.capabilityId}`),
      onPaymentReceived: (e) => console.log(`Received: ${e.amount} USDC`),
    },
  },
});

const app = new Hono();
app.use(honoAdapter(agent, { enableSse: true }));

export default app;
```

### Multi-Agent System

```typescript
import { createAgent, createCapability } from '@agentlink/core';

// Create specialized agents
const researchAgent = createAgent({
  name: 'ResearchAgent',
  identity: 'eip155:84532/0xResearchAddress',
  capabilities: [
    createCapability()
      .id('research')
      .name('Research')
      .description('Research topics')
      .handler(async (input) => ({ data: 'research results' }))
      .build(),
  ],
});

const writingAgent = createAgent({
  name: 'WritingAgent',
  identity: 'eip155:84532/0xWritingAddress',
  capabilities: [
    createCapability()
      .id('write')
      .name('Write')
      .description('Write content')
      .handler(async (input) => ({ content: 'written content' }))
      .build(),
  ],
});

// Orchestrator agent
const orchestrator = createAgent({
  name: 'Orchestrator',
  identity: 'eip155:84532/0xOrchestratorAddress',
  capabilities: [
    createCapability()
      .id('createArticle')
      .name('Create Article')
      .description('Research and write an article')
      .handler(async (input: { topic: string }) => {
        // Use handover to delegate to other agents
        const research = await researchAgent.executeCapability('research', { topic: input.topic });
        const article = await writingAgent.executeCapability('write', { research });
        return article;
      })
      .build(),
  ],
});
```

## License

MIT © AgentLink Team

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## Support

- [Documentation](https://docs.agentlink.io)
- [Discord](https://discord.gg/agentlink)
- [GitHub Issues](https://github.com/agentlink/agentlink-core/issues)
