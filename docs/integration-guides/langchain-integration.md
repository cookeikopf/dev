# LangChain Integration Guide

Integrate AgentLink with LangChain agents for paid AI capabilities.

## Overview

The AgentLink LangChain adapter provides:
- Native LangChain tool integration
- Automatic payment handling
- Agent discovery and calling
- A2A protocol support

## Installation

```bash
npm install @agentlink/sdk langchain @langchain/openai
```

## Basic Integration

### 1. Create AgentLink Toolkit

```typescript
import { AgentLinkToolkit } from '@agentlink/sdk/adapters/langchain';

const toolkit = new AgentLinkToolkit({
  apiKey: process.env.AGENTLINK_API_KEY,
  agentName: 'my-langchain-agent',
  defaultPayment: {
    maxAmount: 0.1,
    currency: 'USD'
  }
});
```

### 2. Get Tools

```typescript
// Get all available tools
const tools = toolkit.getTools();

// Get specific tools
const researchTool = toolkit.getTool('research');
const summarizeTool = toolkit.getTool('summarize');
```

### 3. Use with LangChain Agent

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIFunctionsAgent } from 'langchain/agents';
import { AgentExecutor } from 'langchain/agents';

// Initialize LLM
const llm = new ChatOpenAI({
  modelName: 'gpt-4',
  temperature: 0
});

// Create agent with AgentLink tools
const agent = await createOpenAIFunctionsAgent({
  llm,
  tools,
  prompt: ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant with access to paid AI services.'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}']
  ])
});

// Create executor
const executor = new AgentExecutor({
  agent,
  tools,
  verbose: true
});

// Run agent
const result = await executor.invoke({
  input: 'Research the latest developments in AI agents and summarize the findings'
});

console.log(result.output);
```

## Advanced Usage

### Custom Capability Registration

```typescript
// Register custom capability
const toolkit = new AgentLinkToolkit({
  apiKey: process.env.AGENTLINK_API_KEY,
  agentName: 'my-agent'
});

// Register a custom tool
toolkit.registerCapability({
  name: 'code-review',
  description: 'Review code for bugs and improvements',
  parameters: {
    code: {
      type: 'string',
      description: 'Code to review'
    },
    language: {
      type: 'string',
      description: 'Programming language'
    }
  },
  handler: async (params) => {
    const { code, language } = params;
    // Your code review logic
    return { review: 'Code review results...' };
  },
  pricing: {
    perRequest: 0.02,
    currency: 'USD'
  }
});

// Get updated tools
const tools = toolkit.getTools();
```

### Multi-Agent Orchestration

```typescript
import { AgentLinkToolkit } from '@agentlink/sdk/adapters/langchain';

// Create toolkits for multiple agents
const researchToolkit = new AgentLinkToolkit({
  apiKey: process.env.AGENTLINK_API_KEY,
  agentName: 'research-agent'
});

const writingToolkit = new AgentLinkToolkit({
  apiKey: process.env.AGENTLINK_API_KEY,
  agentName: 'writing-agent'
});

const imageToolkit = new AgentLinkToolkit({
  apiKey: process.env.AGENTLINK_API_KEY,
  agentName: 'image-agent'
});

// Combine all tools
const allTools = [
  ...researchToolkit.getTools(),
  ...writingToolkit.getTools(),
  ...imageToolkit.getTools()
];

// Create multi-capability agent
const agent = await createOpenAIFunctionsAgent({
  llm,
  tools: allTools,
  prompt
});

// Agent can now:
// - Research topics
// - Write content
// - Generate images
// - All with automatic payment handling
```

### Dynamic Agent Discovery

```typescript
import { AgentDiscovery } from '@agentlink/sdk';

const discovery = new AgentDiscovery({
  apiKey: process.env.AGENTLINK_API_KEY
});

// Discover agents by capability
const agents = await discovery.findAgents({
  capabilities: ['image-generation', 'video-editing'],
  minRating: 4.0,
  maxPrice: 0.5
});

// Dynamically add discovered agents as tools
const toolkit = new AgentLinkToolkit({
  apiKey: process.env.AGENTLINK_API_KEY
});

for (const agent of agents) {
  toolkit.registerExternalAgent({
    name: agent.name,
    url: agent.url,
    capabilities: agent.capabilities,
    pricing: agent.pricing
  });
}

const dynamicTools = toolkit.getTools();
```

## Payment Management

### Setting Payment Limits

```typescript
const toolkit = new AgentLinkToolkit({
  apiKey: process.env.AGENTLINK_API_KEY,
  defaultPayment: {
    maxAmount: 0.5,        // Max $0.50 per request
    currency: 'USD',
    dailyLimit: 10.0       // Max $10 per day
  }
});
```

### Per-Tool Payment Configuration

```typescript
// Configure payment per tool
const expensiveTool = toolkit.getTool('video-generation', {
  maxPayment: 1.0,         // Allow up to $1 for video
  requireConfirmation: true // Confirm before paying
});

const cheapTool = toolkit.getTool('summarize', {
  maxPayment: 0.01         // Only $0.01 for summaries
});
```

### Payment Callbacks

```typescript
const toolkit = new AgentLinkToolkit({
  apiKey: process.env.AGENTLINK_API_KEY,
  onPayment: (payment) => {
    console.log(`Paid $${payment.amount} for ${payment.capability}`);
    // Log to your system
  },
  onPaymentFailed: (error) => {
    console.error('Payment failed:', error);
    // Handle failure
  }
});
```

## Complete Example: Research Assistant

```typescript
import { AgentLinkToolkit } from '@agentlink/sdk/adapters/langchain';
import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIFunctionsAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

async function createResearchAssistant() {
  // Initialize toolkit
  const toolkit = new AgentLinkToolkit({
    apiKey: process.env.AGENTLINK_API_KEY,
    agentName: 'research-assistant',
    defaultPayment: {
      maxAmount: 0.1,
      currency: 'USD',
      dailyLimit: 5.0
    }
  });

  // Register custom research capability
  toolkit.registerCapability({
    name: 'deep-research',
    description: 'Conduct in-depth research on any topic using multiple sources',
    parameters: {
      topic: {
        type: 'string',
        description: 'Research topic'
      },
      depth: {
        type: 'string',
        enum: ['quick', 'standard', 'deep'],
        description: 'Research depth'
      }
    },
    handler: async ({ topic, depth }) => {
      // Implement research logic
      const sources = await gatherSources(topic, depth);
      const analysis = await analyzeSources(sources);
      return {
        summary: analysis.summary,
        sources: sources.map(s => s.url),
        confidence: analysis.confidence
      };
    },
    pricing: {
      perRequest: 0.05,
      currency: 'USD'
    }
  });

  // Get all tools
  const tools = toolkit.getTools();

  // Create LLM
  const llm = new ChatOpenAI({
    modelName: 'gpt-4',
    temperature: 0.3
  });

  // Create prompt
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', `You are a research assistant with access to paid AI services.
You can conduct deep research, analyze data, and generate reports.
Always cite your sources and be transparent about costs.`],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}']
  ]);

  // Create agent
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt
  });

  // Create executor
  const executor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
    maxIterations: 10
  });

  return executor;
}

// Use the assistant
async function main() {
  const assistant = await createResearchAssistant();
  
  const result = await assistant.invoke({
    input: `Research the current state of quantum computing in 2024. 
Focus on:
1. Major breakthroughs
2. Commercial applications
3. Key players in the industry
Provide a comprehensive report with sources.`
  });

  console.log('Research Report:');
  console.log(result.output);
}

main().catch(console.error);
```

## Error Handling

```typescript
import { PaymentError, RateLimitError, AgentNotFoundError } from '@agentlink/sdk';

try {
  const result = await executor.invoke({ input: 'Research AI' });
} catch (error) {
  if (error instanceof PaymentError) {
    console.log('Insufficient funds. Please add more to your wallet.');
  } else if (error instanceof RateLimitError) {
    console.log('Rate limited. Please try again later.');
  } else if (error instanceof AgentNotFoundError) {
    console.log('Agent not found. It may be offline.');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Best Practices

1. **Set Payment Limits**: Always set `maxAmount` and `dailyLimit`
2. **Handle Errors**: Implement proper error handling for payments
3. **Log Payments**: Track all payments for transparency
4. **Cache Results**: Cache expensive operations when possible
5. **Use Confirmations**: For expensive operations, require confirmation

## Troubleshooting

### Tools Not Appearing

```typescript
// Ensure toolkit is initialized
const toolkit = new AgentLinkToolkit({
  apiKey: process.env.AGENTLINK_API_KEY // Must be set
});

// Verify agent is registered
await toolkit.verifyConnection();
```

### Payment Failures

```typescript
// Check wallet balance
const balance = await toolkit.getWalletBalance();
console.log(`Balance: $${balance}`);

// Request testnet funds if needed
await toolkit.requestFaucet();
```

### Rate Limiting

```typescript
// Add retry logic
const executor = new AgentExecutor({
  agent,
  tools,
  maxIterations: 10,
  retry: {
    maxRetries: 3,
    delay: 1000
  }
});
```
