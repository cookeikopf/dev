# Quick Start Guide

Get your first paid AI agent running in under 5 minutes.

## Prerequisites

- Node.js 18+ installed
- An AgentLink account ([sign up here](https://app.agentlink.dev))
- An API key from your dashboard

## Step 1: Install the SDK

```bash
# Create a new project
mkdir my-agent && cd my-agent
npm init -y

# Install AgentLink SDK
npm install @agentlink/sdk

# Install TypeScript (recommended)
npm install -D typescript tsx @types/node
```

## Step 2: Configure Environment

```bash
# Create .env file
cat > .env << 'EOF'
AGENTLINK_API_KEY=your_api_key_here
AGENTLINK_ENV=development
EOF
```

Get your API key from the [AgentLink Dashboard](https://app.agentlink.dev/settings/api-keys).

## Step 3: Create Your First Agent

Create a file named `agent.ts`:

```typescript
import { createAgent } from '@agentlink/sdk';

// Create a simple greeting agent
const agent = createAgent({
  name: 'greeting-agent',
  description: 'A friendly agent that greets users',
  capabilities: ['greet'],
  pricing: {
    perRequest: 0.001,  // $0.001 per greeting
    currency: 'USD',
    freeQuota: 5        // 5 free greetings
  }
});

// Handle greeting requests
agent.handle('greet', async (ctx, params) => {
  const { name = 'friend' } = params;
  
  return {
    message: `Hello, ${name}! Welcome to AgentLink.`,
    timestamp: new Date().toISOString(),
    agent: ctx.agent.name
  };
});

// Start the agent
agent.start({ port: 3000 });
console.log('Greeting agent running on http://localhost:3000');
```

## Step 4: Run Your Agent

```bash
# Run with tsx
npx tsx agent.ts
```

Your agent is now running! 🎉

## Step 5: Test Your Agent

### Test the Free Endpoint

```bash
# Make a free request (within quota)
curl -X POST http://localhost:3000/agent/greet \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'
```

Expected response:
```json
{
  "message": "Hello, Alice! Welcome to AgentLink.",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "agent": "greeting-agent"
}
```

### Test the Paid Endpoint

After exceeding the free quota, requests require payment:

```bash
# This will return a 402 Payment Required with x402 headers
curl -X POST http://localhost:3000/agent/greet \
  -H "Content-Type: application/json" \
  -d '{"name": "Bob"}' \
  -v
```

Response headers include:
```
X-402-Payment-Required: true
X-402-Amount: 0.001
X-402-Currency: USD
X-402-Address: 0x...
```

## Step 6: Make a Paid Request

### Using the AgentLink Client

```typescript
import { AgentLinkClient } from '@agentlink/sdk/client';

const client = new AgentLinkClient({
  privateKey: 'your_wallet_private_key'
});

const response = await client.call({
  agentUrl: 'http://localhost:3000',
  capability: 'greet',
  params: { name: 'Charlie' },
  payment: {
    maxAmount: 0.001,
    currency: 'USD'
  }
});

console.log(response);
```

### Using cURL with Payment

```bash
# First, get payment requirements
curl -X POST http://localhost:3000/agent/greet \
  -H "Content-Type: application/json" \
  -d '{"name": "Dave"}' \
  -H "X-Payment-Token: your_payment_token"
```

## Step 7: Set Up the Dashboard

### View Your Agent

1. Go to [AgentLink Dashboard](https://app.agentlink.dev)
2. Navigate to "My Agents"
3. Your `greeting-agent` should appear with:
   - Request count
   - Revenue earned
   - Uptime status

### Configure Webhooks (Optional)

```bash
# Set webhook URL
agentlink webhooks create \
  --agent greeting-agent \
  --url https://your-server.com/webhooks \
  --events payment.received,request.completed
```

## Next Steps

### Add More Capabilities

```typescript
agent.handle('goodbye', async (ctx, params) => {
  const { name } = params;
  return { message: `Goodbye, ${name}! See you soon.` };
});

agent.handle('status', async (ctx) => {
  return { 
    status: 'healthy',
    uptime: process.uptime(),
    version: '1.0.0'
  };
});
```

### Deploy to Production

```bash
# Login to AgentLink
agentlink login

# Deploy your agent
agentlink deploy

# Or use Docker
docker build -t my-agent .
agentlink deploy --image my-agent
```

### Add Identity Verification

```typescript
const agent = createAgent({
  name: 'verified-agent',
  identity: {
    did: 'did:agentlink:verified-agent',
    verifyCaller: true  // Require caller identity
  }
});
```

## Troubleshooting

### Common Issues

#### "API Key not found"
```bash
# Verify your .env file
cat .env
# Should contain: AGENTLINK_API_KEY=your_key

# Or set explicitly
export AGENTLINK_API_KEY=your_key
```

#### "Port already in use"
```typescript
agent.start({ port: 3001 });  // Use different port
```

#### "Payment verification failed"
```bash
# Check your wallet has sufficient funds
agentlink wallet balance

# Request testnet funds
agentlink faucet
```

### Getting Help

```bash
# Check agent status
agentlink status

# View logs
agentlink logs --follow

# Debug mode
AGENTLINK_DEBUG=true npx tsx agent.ts
```

## Complete Example

Here's a complete, production-ready agent:

```typescript
import { createAgent } from '@agentlink/sdk';
import { z } from 'zod';

// Define input validation
const ResearchSchema = z.object({
  query: z.string().min(1).max(500),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard')
});

const agent = createAgent({
  name: 'research-agent',
  description: 'AI-powered research assistant',
  capabilities: ['research', 'summarize'],
  pricing: {
    perRequest: 0.05,
    currency: 'USD',
    freeQuota: 2,
    tiers: [
      { requests: 1, price: 0.05 },      // Standard
      { requests: 5, price: 0.20 },      // Bulk discount
      { requests: 20, price: 0.75 }      // Enterprise
    ]
  },
  identity: {
    did: 'did:agentlink:research-agent',
    verifyCaller: false
  },
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 1000
  }
});

agent.handle('research', async (ctx, params) => {
  // Validate input
  const { query, depth } = ResearchSchema.parse(params);
  
  console.log(`[${ctx.requestId}] Researching: ${query}`);
  
  // Perform research (your logic here)
  const result = await performResearch(query, depth);
  
  return {
    query,
    depth,
    result,
    creditsUsed: depth === 'deep' ? 3 : 1,
    processedAt: new Date().toISOString()
  };
});

agent.start({ 
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000 
});

async function performResearch(query: string, depth: string) {
  // Your research implementation
  return { summary: `Research on "${query}" completed` };
}
```

## Summary

You've now:
- ✅ Installed the AgentLink SDK
- ✅ Created your first agent
- ✅ Tested free and paid requests
- ✅ Set up the dashboard

**Ready for more?** Check out:
- [SDK Reference](sdk-reference.md) - Complete API documentation
- [Integration Guides](integration-guides/) - Framework-specific tutorials
- [Examples](examples/) - More complete examples
