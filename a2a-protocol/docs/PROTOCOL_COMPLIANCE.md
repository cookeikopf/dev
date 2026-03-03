# A2A Protocol Compliance Documentation

## Overview

This document describes the compliance of the AgentLink A2A Protocol implementation with the [Agent2Agent (A2A) Protocol Specification](https://a2a-protocol.org/latest/specification/).

**Implementation Version:** 1.0.0  
**Protocol Version:** 1.0  
**Specification Reference:** A2A Protocol Specification v1.0

---

## Compliance Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Agent Card Discovery | ✅ Complete | `/.well-known/agent.json` endpoint |
| JSON-RPC 2.0 Binding | ✅ Complete | All core methods implemented |
| Task Management | ✅ Complete | Full task lifecycle support |
| SSE Streaming | ✅ Complete | Real-time task updates |
| Schema Validation | ✅ Complete | Zod-based validation |
| Error Handling | ✅ Complete | Standard JSON-RPC error codes |
| Push Notifications | ⚠️ Stub | Framework ready, implementation pending |
| gRPC Binding | ❌ Not Implemented | HTTP/JSON only |

---

## Agent Card (Section 8)

### Discovery Mechanism

The implementation provides Agent Card discovery via the well-known URI:

```
GET /.well-known/agent.json
```

### Agent Card Schema

The implementation includes a complete Agent Card schema with:

- **Required Fields:**
  - `name` - Human-readable agent name
  - `description` - Agent description
  - `url` - A2A endpoint URL
  - `version` - Agent version
  - `capabilities` - Supported capabilities
  - `defaultInputModes` - Default input media types
  - `defaultOutputModes` - Default output media types
  - `skills` - Available skills

- **Optional Fields:**
  - `provider` - Service provider information
  - `documentationUrl` - Documentation URL
  - `securitySchemes` - Authentication schemes
  - `security` - Security requirements
  - `supportedInterfaces` - Protocol interfaces
  - `iconUrl` - Agent icon URL
  - `signatures` - JWS signatures

### Agent Card Builder

The `AgentCardBuilder` class provides a fluent API for constructing Agent Cards:

```typescript
const card = createAgentCard()
  .name('My Agent')
  .description('An A2A agent')
  .url('https://example.com/a2a')
  .version('1.0.0')
  .withStreaming()
  .withBearerAuth()
  .addSkill(createSkill()
    .id('my-skill')
    .name('My Skill')
    .description('A useful skill')
    .build())
  .build();
```

---

## JSON-RPC Protocol Binding (Section 9)

### Protocol Requirements

- ✅ JSON-RPC 2.0 over HTTP(S)
- ✅ Content-Type: `application/json`
- ✅ PascalCase method names
- ✅ Server-Sent Events for streaming

### Implemented Methods

#### Core Methods

| Method | Status | Description |
|--------|--------|-------------|
| `SendMessage` | ✅ | Send a message to initiate/continue a task |
| `SendStreamingMessage` | ✅ | Send message with SSE streaming |
| `GetTask` | ✅ | Retrieve task by ID |
| `ListTasks` | ✅ | List tasks with filtering and pagination |
| `CancelTask` | ✅ | Cancel an ongoing task |
| `SubscribeToTask` | ✅ | Subscribe to task updates via SSE |

#### Discovery Methods

| Method | Status | Description |
|--------|--------|-------------|
| `GetAgentCard` | ✅ | Retrieve agent card |
| `GetExtendedAgentCard` | ✅ | Retrieve extended agent card (if supported) |

#### Legacy/Alias Methods

| Method | Status | Description |
|--------|--------|-------------|
| `a2a.discover` | ✅ | Alias for GetAgentCard |
| `a2a.capabilities` | ✅ | List supported methods |
| `a2a.handover` | ✅ | Task delegation stub |

### Request/Response Format

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "msg-1",
      "role": "user",
      "parts": [{ "type": "text", "text": "Hello" }]
    }
  }
}
```

**Success Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "task": {
      "id": "task-1",
      "status": { "state": "working", "timestamp": "2024-01-15T10:30:00.000Z" },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**Error Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Task not found"
  }
}
```

---

## Task Management (Section 4.1)

### Task States

All task states are fully implemented:

| State | Description |
|-------|-------------|
| `submitted` | Task has been submitted |
| `working` | Task is being processed |
| `input-required` | Agent needs additional input |
| `completed` | Task completed successfully |
| `canceled` | Task was canceled |
| `failed` | Task failed |
| `rejected` | Task was rejected |

### Task Lifecycle

```
submitted → working → completed
    ↓           ↓
    └─────→ input-required
    ↓           ↓
    └─────→ canceled/failed/rejected
```

### Task Operations

- **Create Task:** `POST /a2a` with `SendMessage`
- **Get Task:** `POST /a2a` with `GetTask`
- **List Tasks:** `POST /a2a` with `ListTasks`
- **Cancel Task:** `POST /a2a` with `CancelTask`
- **Subscribe:** `GET /a2a/stream/{taskId}`

---

## Streaming (Section 3.5)

### Server-Sent Events (SSE)

The implementation supports real-time task updates via SSE:

```
GET /a2a/stream/{taskId}
Content-Type: text/event-stream
```

### Event Types

| Event Type | Description |
|------------|-------------|
| `status` | Task status update |
| `artifact` | New artifact available |
| `message` | Message from agent |
| `error` | Error occurred |
| `close` | Stream closing |

### Event Format

```
id: evt-1
data: {"type":"status","taskId":"task-1","status":{"state":"working"},"timestamp":"2024-01-15T10:30:00.000Z"}

id: evt-2
data: {"type":"artifact","taskId":"task-1","artifact":{"artifactId":"art-1","parts":[]},"timestamp":"2024-01-15T10:30:00.000Z"}
```

---

## Error Handling (Section 3.3.2)

### JSON-RPC Standard Errors

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid Request | Invalid JSON-RPC request |
| -32601 | Method not found | Unknown method |
| -32602 | Invalid params | Invalid method parameters |
| -32603 | Internal error | Server internal error |

### A2A-Specific Errors

| Code | Message | Description |
|------|---------|-------------|
| -32001 | Task not found | Task ID does not exist |
| -32002 | Task already exists | Task ID conflict |
| -32003 | Invalid task state | Operation not allowed in current state |
| -32004 | Content type not supported | Media type not supported |
| -32005 | Unauthorized | Authentication required |
| -32006 | Push notifications not supported | Push notifications disabled |
| -32007 | Unsupported operation | Operation not supported |
| -32008 | Extended agent card not configured | Extended card not available |
| -32009 | Version not supported | Protocol version not supported |

---

## Data Model (Section 4)

### Core Objects

#### Part (Section 4.1.6)

```typescript
type Part = 
  | { type: 'text'; text: string }
  | { type: 'file'; file: { name?: string; mimeType?: string; bytes?: string; uri?: string } }
  | { type: 'data'; data: Record<string, unknown> };
```

#### Message (Section 4.1.4)

```typescript
interface Message {
  messageId: string;
  role: 'user' | 'agent';
  parts: Part[];
  metadata?: Record<string, unknown>;
  timestamp?: string;
}
```

#### Task (Section 4.1.1)

```typescript
interface Task {
  id: string;
  contextId?: string;
  sessionId?: string;
  status: TaskStatus;
  artifacts?: Artifact[];
  history?: Message[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

#### Artifact (Section 4.1.7)

```typescript
interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
  metadata?: Record<string, unknown>;
  timestamp?: string;
  index?: number;
}
```

---

## Schema Validation

The implementation uses [Zod](https://zod.dev/) for runtime schema validation:

- All requests are validated against Zod schemas
- Validation errors return proper JSON-RPC error responses
- Type inference provides TypeScript type safety

### Example Validation

```typescript
import { SendMessageRequestSchema, A2AErrorCodes } from '@agentlink/a2a-protocol';

const result = SendMessageRequestSchema.safeParse(request);
if (!result.success) {
  return {
    jsonrpc: '2.0',
    id: request.id,
    error: {
      code: A2AErrorCodes.INVALID_PARAMS,
      message: 'Invalid parameters: ' + result.error.message
    }
  };
}
```

---

## Security (Section 7)

### Supported Authentication Schemes

| Scheme | Status | Description |
|--------|--------|-------------|
| API Key | ✅ | Header or query parameter |
| Bearer Token | ✅ | HTTP Bearer authentication |
| OAuth 2.0 | ✅ | Authorization code & client credentials flows |
| OpenID Connect | ✅ | OIDC discovery |

### Security Configuration

```typescript
const card = createAgentCard()
  .withAPIKeyAuth('apiKey', { in: 'header', name: 'X-API-Key' })
  .withBearerAuth('bearer')
  .withOAuth2('oauth2', {
    authorizationEndpoint: 'https://auth.example.com/authorize',
    tokenEndpoint: 'https://auth.example.com/token',
    scopes: { read: 'Read access' }
  })
  .addSecurityRequirement({ oauth2: ['read'] })
  .build();
```

---

## Testing

### Test Coverage

The implementation includes comprehensive tests:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Files

| File | Description |
|------|-------------|
| `tests/schemas.test.ts` | Schema validation tests |
| `tests/agent-card.test.ts` | Agent Card builder tests |
| `tests/jsonrpc-handler.test.ts` | JSON-RPC handler tests |
| `tests/sse-stream.test.ts` | SSE streaming tests |
| `tests/server.test.ts` | Server integration tests |
| `tests/index.test.ts` | Module export tests |

---

## Usage Examples

### Basic Server Setup

```typescript
import { createA2AServer, createAgentCard, createSkill } from '@agentlink/a2a-protocol';

const agentCard = createAgentCard()
  .name('My Agent')
  .description('An A2A agent')
  .url('https://example.com/a2a')
  .version('1.0.0')
  .withStreaming()
  .addSkill(createSkill()
    .id('greeting')
    .name('Greeting')
    .description('Greets users')
    .examples(['Hello', 'Hi there'])
    .build())
  .build();

const server = createA2AServer({
  agentCard,
  taskHandler: {
    async processMessage(message, options) {
      // Process the message
      return { message: { ...message, role: 'agent', parts: [{ type: 'text', text: 'Hello!' }] } };
    }
  }
});

// Use with Express
app.use(server.getHandler());
```

### Custom Method Handler

```typescript
server.registerMethod('CustomMethod', async (params, context) => {
  return { result: 'custom result' };
});
```

### Task Management

```typescript
// Create a task
const task = await server.createTask(message, { contextId: 'ctx-1' });

// Transition task state
await server.transitionTask(task.id, 'working', { message: 'Processing...' });

// Add artifact
await server.addArtifact(task.id, {
  artifactId: 'result-1',
  parts: [{ type: 'text', text: 'Result data' }]
});

// Complete task
await server.transitionTask(task.id, 'completed');
```

---

## Limitations and Future Work

### Current Limitations

1. **Push Notifications:** Framework is in place but full webhook implementation is pending
2. **gRPC Binding:** Only HTTP/JSON binding is implemented
3. **File Upload:** Direct file upload endpoints not implemented (use data URIs)

### Planned Enhancements

1. Full push notification support with webhook delivery
2. gRPC protocol binding
3. Multi-tenant support
4. Persistent task storage adapters
5. Rate limiting middleware
6. Request/response logging

---

## References

- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [A2A GitHub Repository](https://github.com/a2aproject/A2A)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

## License

MIT License - See LICENSE file for details.
