/**
 * A2A Protocol - Basic Server Example
 * 
 * This example demonstrates how to create a basic A2A server
 * using the AgentLink A2A Protocol implementation.
 */

import {
  createA2AServer,
  createAgentCard,
  createSkill,
  createTaskStatusUpdate,
  createTaskArtifactUpdate,
  type Task,
  type Message,
} from '../src/index.js';

// ============================================================================
// Step 1: Create the Agent Card
// ============================================================================

const agentCard = createAgentCard()
  .name('Echo Agent')
  .description('A simple agent that echoes back your messages')
  .url('http://localhost:3000/a2a')
  .version('1.0.0')
  .withStreaming()
  .withStateTransitionHistory()
  .defaultInputModes(['text/plain'])
  .defaultOutputModes(['text/plain'])
  .addSkill(
    createSkill()
      .id('echo')
      .name('Echo')
      .description('Echoes back the user message')
      .tags(['echo', 'simple'])
      .examples(['Hello', 'How are you?', 'Echo this'])
      .build()
  )
  .build();

console.log('Agent Card created:');
console.log(JSON.stringify(agentCard, null, 2));

// ============================================================================
// Step 2: Create the Task Handler
// ============================================================================

const taskHandler = {
  async processMessage(
    message: Message,
    options: {
      taskId?: string;
      contextId?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{ task?: Task; message?: Message }> {
    console.log('Received message:', message.parts[0]);

    // Extract text from message
    const text = message.parts[0]?.type === 'text' 
      ? message.parts[0].text 
      : 'Received non-text content';

    // Create echo response
    const responseText = `Echo: ${text}`;

    // For simple responses, return a message directly
    if (!options.taskId) {
      return {
        message: {
          messageId: `resp-${Date.now()}`,
          role: 'agent',
          parts: [{ type: 'text', text: responseText }],
          timestamp: new Date().toISOString(),
        },
      };
    }

    // For task-based responses, the server will handle task creation
    // This is just a placeholder - the actual task is created by the server
    throw new Error('Task-based responses should be handled by the server');
  },
};

// ============================================================================
// Step 3: Create the A2A Server
// ============================================================================

const server = createA2AServer({
  agentCard,
  taskHandler,
  debug: true,
});

// ============================================================================
// Step 4: Create a Simple HTTP Server
// ============================================================================

import http from 'http';

const httpServer = http.createServer(async (req, res) => {
  // Collect request body
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    const handler = server.getHandler();

    await handler(
      {
        method: req.method || 'GET',
        url: req.url || '/',
        headers: req.headers as Record<string, string>,
        body,
      },
      {
        status: (code: number) => {
          res.statusCode = code;
          return {
            json: (data: unknown) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
            send: (data: string) => {
              res.end(data);
            },
          };
        },
        setHeader: (name: string, value: string) => {
          res.setHeader(name, value);
        },
        write: (data: string) => {
          res.write(data);
        },
        end: () => {
          res.end();
        },
      }
    );
  });
});

// ============================================================================
// Step 5: Start the Server
// ============================================================================

const PORT = 3000;

httpServer.listen(PORT, () => {
  console.log(`\n🚀 A2A Server running on http://localhost:${PORT}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`  - Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
  console.log(`  - JSON-RPC:   http://localhost:${PORT}/a2a`);
  console.log(`  - Health:     http://localhost:${PORT}/health`);
  console.log(`\n📝 Try these commands:`);
  console.log(`  # Get Agent Card`);
  console.log(`  curl http://localhost:${PORT}/.well-known/agent.json | jq`);
  console.log(`\n  # Send a message`);
  console.log(`  curl -X POST http://localhost:${PORT}/a2a \\\n    -H "Content-Type: application/json" \\\n    -d '{"jsonrpc":"2.0","id":1,"method":"SendMessage","params":{"message":{"messageId":"msg-1","role":"user","parts":[{"type":"text","text":"Hello!"}]}}}' | jq`);
  console.log(`\n  # Get capabilities`);
  console.log(`  curl -X POST http://localhost:${PORT}/a2a \\\n    -H "Content-Type: application/json" \\\n    -d '{"jsonrpc":"2.0","id":1,"method":"a2a.capabilities"}' | jq`);
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
