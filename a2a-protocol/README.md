# AgentLink A2A Protocol

A complete TypeScript implementation of the [Agent-to-Agent (A2A) Protocol](https://a2a-protocol.org/) for AgentLink MVP.

[![A2A Protocol](https://img.shields.io/badge/A2A%20Protocol-v1.0-blue)](https://a2a-protocol.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Features

- ✅ **Agent Card Discovery** - `/.well-known/agent.json` endpoint
- ✅ **JSON-RPC 2.0** - Full protocol implementation
- ✅ **Task Management** - Complete task lifecycle
- ✅ **SSE Streaming** - Real-time task updates
- ✅ **Schema Validation** - Zod-based validation
- ✅ **Type Safety** - Full TypeScript support
- ✅ **Extensible** - Custom method handlers

## Installation

```bash
npm install @agentlink/a2a-protocol
```

## Quick Start

### 1. Create an Agent Card

```typescript
import { createAgentCard, createSkill } from '@agentlink/a2a-protocol';

const agentCard = createAgentCard()
  .name('My Agent')
  .description('An A2A-compatible agent')
  .url('https://myagent.example.com/a2a')
  .version('1.0.0')
  .withStreaming()
  .withBearerAuth()
  .addSkill(
    createSkill()
      .id('chat')
      .name('Chat')
      .description('Have a conversation')
      .examples(['Hello', 'How are you?'])
      .build()
  )
  .build();
```

### 2. Create the A2A Server

```typescript
import { createA2AServer } from '@agentlink/a2a-protocol';

const server = createA2AServer({
  agentCard,
  taskHandler: {
    async processMessage(message, options) {
      // Process the message and return a response
      const responseText = `You said: ${message.parts[0].text}`;
      
      return {
        message: {
          messageId: `resp-${Date.now()}`,
          role: 'agent',
          parts: [{ type: 'text', text: responseText }],
          timestamp: new Date().toISOString(),
        }
      };
    }
  }
});
```

### 3. Integrate with Express

```typescript
import express from 'express';

const app = express();
app.use(express.json());

// Mount A2A handler
app.use(server.getHandler());

app.listen(3000, () => {
  console.log('A2A server running on port 3000');
});
```

## API Reference

### Core Methods

| Method | Description |
|--------|-------------|
| `SendMessage` | Send a message to initiate or continue a task |
| `GetTask` | Retrieve a task by ID |
| `ListTasks` | List tasks with filtering and pagination |
| `CancelTask` | Cancel an ongoing task |
| `SubscribeToTask` | Subscribe to task updates via SSE |
| `GetAgentCard` | Get the agent's capabilities |

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent.json` | GET | Agent Card discovery |
| `/a2a` | POST | JSON-RPC endpoint |
| `/a2a/stream/{taskId}` | GET | SSE streaming endpoint |
| `/health` | GET | Health check |

## Example Usage

### Sending a Message

```typescript
const response = await fetch('https://myagent.example.com/a2a', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'SendMessage',
    params: {
      message: {
        messageId: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello!' }]
      }
    }
  })
});

const result = await response.json();
console.log(result.result.task);
```

### Streaming Updates

```typescript
const eventSource = new EventSource(
  'https://myagent.example.com/a2a/stream/task-123'
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};

eventSource.onerror = (error) => {
  console.error('Stream error:', error);
  eventSource.close();
};
```

### Task Management

```typescript
// Create a task
const task = await server.createTask(message);

// Update task status
await server.transitionTask(task.id, 'working', {
  message: 'Processing your request...'
});

// Add an artifact
await server.addArtifact(task.id, {
  artifactId: 'result-1',
  parts: [{ type: 'text', text: 'Here is the result!' }]
});

// Complete the task
await server.transitionTask(task.id, 'completed');
```

## Advanced Features

### Custom Method Handlers

```typescript
server.registerMethod('CustomMethod', async (params, context) => {
  // Custom logic here
  return { custom: true, params };
});
```

### Authentication

```typescript
const agentCard = createAgentCard()
  .withAPIKeyAuth('apiKey', { in: 'header', name: 'X-API-Key' })
  .withOAuth2('oauth2', {
    tokenEndpoint: 'https://auth.example.com/token',
    scopes: { read: 'Read access', write: 'Write access' }
  })
  .build();
```

### Custom Task Store

```typescript
import { TaskStore, Task } from '@agentlink/a2a-protocol';

class RedisTaskStore implements TaskStore {
  async get(id: string): Promise<Task | undefined> {
    // Redis implementation
  }
  
  async set(id: string, task: Task): Promise<void> {
    // Redis implementation
  }
  
  // ... other methods
}

const server = createA2AServer({
  agentCard,
  taskStore: new RedisTaskStore(),
  taskHandler
});
```

## Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Build
npm run build
```

## Protocol Compliance

See [PROTOCOL_COMPLIANCE.md](docs/PROTOCOL_COMPLIANCE.md) for detailed compliance information.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        A2A Server                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Agent Card  │  │ JSON-RPC    │  │ SSE Streaming       │  │
│  │ Handler     │  │ Handler     │  │ Manager             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Zod Schemas │  │ Task Store  │  │ Task Handler        │  │
│  │ (Validation)│  │ (In-Memory) │  │ (User-defined)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Resources

- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [A2A GitHub](https://github.com/a2aproject/A2A)
- [AgentLink Documentation](https://docs.agentlink.io)

---

Built with ❤️ by the AgentLink Team
