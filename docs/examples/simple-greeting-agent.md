# Example: Simple Greeting Agent

A minimal AgentLink agent that demonstrates the basics.

## Overview

This example shows:
- Basic agent creation
- Simple capability handling
- Free quota configuration
- Minimal setup

## Complete Code

```typescript
// greeting-agent.ts
import { createAgent } from '@agentlink/sdk';

// Create a simple greeting agent
const agent = createAgent({
  name: 'greeting-agent',
  description: 'A friendly agent that greets users',
  capabilities: ['greet', 'goodbye'],
  pricing: {
    perRequest: 0.001,  // $0.001 per request
    currency: 'USD',
    freeQuota: 10       // 10 free greetings
  }
});

// Handle greeting requests
agent.handle('greet', async (ctx, params) => {
  const { 
    name = 'friend',
    language = 'en',
    formal = false 
  } = params;
  
  // Generate greeting based on language and formality
  const greetings: Record<string, { casual: string; formal: string }> = {
    en: { casual: 'Hey', formal: 'Hello' },
    es: { casual: 'Hola', formal: 'Buenos días' },
    fr: { casual: 'Salut', formal: 'Bonjour' },
    de: { casual: 'Hallo', formal: 'Guten Tag' },
    ja: { casual: 'やあ', formal: 'こんにちは' },
    zh: { casual: '你好', formal: '您好' }
  };
  
  const langGreetings = greetings[language] || greetings.en;
  const greeting = formal ? langGreetings.formal : langGreetings.casual;
  
  // Get current time for contextual greeting
  const hour = new Date().getHours();
  let timeOfDay = '';
  
  if (language === 'en') {
    if (hour < 12) timeOfDay = 'morning';
    else if (hour < 17) timeOfDay = 'afternoon';
    else timeOfDay = 'evening';
  }
  
  return {
    message: timeOfDay 
      ? `${greeting}, ${name}! Good ${timeOfDay}!`
      : `${greeting}, ${name}!`,
    language,
    formal,
    timestamp: new Date().toISOString(),
    quotaRemaining: ctx.user.quotaRemaining
  };
});

// Handle goodbye requests
agent.handle('goodbye', async (ctx, params) => {
  const { name = 'friend', language = 'en' } = params;
  
  const goodbyes: Record<string, string> = {
    en: 'Goodbye',
    es: 'Adiós',
    fr: 'Au revoir',
    de: 'Auf Wiedersehen',
    ja: 'さようなら',
    zh: '再见'
  };
  
  const goodbye = goodbyes[language] || goodbyes.en;
  
  return {
    message: `${goodbye}, ${name}!`,
    language,
    timestamp: new Date().toISOString(),
    quotaRemaining: ctx.user.quotaRemaining
  };
});

// Handle status requests (no payment required)
agent.handle('status', async (ctx) => {
  return {
    status: 'healthy',
    agent: ctx.agent.name,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };
});

// Event listeners
agent.on('request', (event) => {
  console.log(`📨 ${event.capability} request: ${event.requestId}`);
});

agent.on('payment', (event) => {
  console.log(`💰 Payment: $${event.amount} from ${event.walletAddress.slice(0, 10)}...`);
});

// Start the agent
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

agent.start({ port: PORT });

console.log('🚀 Greeting Agent running!');
console.log(`📍 http://localhost:${PORT}`);
console.log('🎁 10 free greetings included');
```

## Running the Agent

```bash
# Install AgentLink SDK
npm install @agentlink/sdk

# Set your API key
export AGENTLINK_API_KEY=your_api_key

# Run the agent
npx tsx greeting-agent.ts
```

## Testing

```bash
# Greet in English (free)
curl -X POST http://localhost:3000/agent/greet \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'

# Formal greeting in Spanish (free)
curl -X POST http://localhost:3000/agent/greet \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Carlos",
    "language": "es",
    "formal": true
  }'

# Goodbye in Japanese (free)
curl -X POST http://localhost:3000/agent/goodbye \
  -H "Content-Type: application/json" \
  -d '{"name": "Tanaka", "language": "ja"}'

# Check status (always free)
curl http://localhost:3000/agent/status
```

## Expected Responses

### Greeting Response

```json
{
  "message": "Hello, Alice! Good afternoon!",
  "language": "en",
  "formal": false,
  "timestamp": "2024-01-15T14:30:00.000Z",
  "quotaRemaining": 9
}
```

### Goodbye Response

```json
{
  "message": "さようなら, Tanaka!",
  "language": "ja",
  "timestamp": "2024-01-15T14:30:05.000Z",
  "quotaRemaining": 8
}
```

### Status Response

```json
{
  "status": "healthy",
  "agent": "greeting-agent",
  "uptime": 3600,
  "timestamp": "2024-01-15T14:30:10.000Z",
  "version": "1.0.0"
}
```

## Project Files

### package.json

```json
{
  "name": "greeting-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx greeting-agent.ts"
  },
  "dependencies": {
    "@agentlink/sdk": "^1.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0"
  }
}
```

### .env

```bash
AGENTLINK_API_KEY=your_api_key_here
PORT=3000
```

## Next Steps

1. **Add more languages** - Extend the `greetings` and `goodbyes` objects
2. **Add personalization** - Store user preferences
3. **Add time zones** - Adjust greetings based on user's timezone
4. **Add analytics** - Track most popular languages
