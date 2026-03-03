/**
 * A2A Protocol - Server Tests
 * 
 * Tests for the complete A2A server implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  A2AServer,
  createA2AServer,
  InMemoryTaskStore,
  type AgentCard,
  type TaskHandler,
  type Task,
  type Message,
  A2AErrorCodes,
} from '../src/index.js';

// Test fixtures
const testAgentCard: AgentCard = {
  name: 'Test Agent',
  description: 'A test agent',
  url: 'https://example.com/a2a',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
    extendedAgentCard: true,
  },
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [
    {
      id: 'test-skill',
      name: 'Test Skill',
      description: 'A test skill',
    },
  ],
};

const createTestMessage = (text: string): Message => ({
  messageId: `msg-${Date.now()}`,
  role: 'user',
  parts: [{ type: 'text', text }],
  timestamp: new Date().toISOString(),
});

describe('A2AServer', () => {
  let server: A2AServer;
  let taskStore: InMemoryTaskStore;

  beforeEach(() => {
    taskStore = new InMemoryTaskStore();
    const taskHandler: TaskHandler = {
      async processMessage(message, options) {
        const task: Task = {
          id: taskStore.generateId(),
          contextId: options.contextId,
          sessionId: options.sessionId,
          status: {
            state: 'working',
            timestamp: new Date().toISOString(),
          },
          history: [message],
          metadata: options.metadata,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await taskStore.set(task.id, task);
        return { task };
      },
    };

    server = createA2AServer({
      agentCard: testAgentCard,
      taskStore,
      taskHandler,
      debug: false,
    });
  });

  describe('Agent Card Discovery', () => {
    it('should serve agent card at well-known endpoint', async () => {
      const req = {
        method: 'GET',
        url: '/.well-known/agent.json',
        headers: {},
        body: '',
      };

      let responseBody: unknown;
      const res = {
        status: (code: number) => ({
          json: (data: unknown) => {
            responseBody = data;
          },
          send: (data: string) => {
            responseBody = data;
          },
        }),
        setHeader: () => {},
        write: () => {},
        end: () => {},
      };

      const handler = server.getHandler();
      await handler(req, res);

      expect(responseBody).toEqual(testAgentCard);
    });
  });

  describe('Health Check', () => {
    it('should respond to health checks', async () => {
      const req = {
        method: 'GET',
        url: '/health',
        headers: {},
        body: '',
      };

      let responseBody: unknown;
      const res = {
        status: (code: number) => ({
          json: (data: unknown) => {
            responseBody = data;
          },
          send: () => {},
        }),
        setHeader: () => {},
        write: () => {},
        end: () => {},
      };

      const handler = server.getHandler();
      await handler(req, res);

      expect(responseBody).toMatchObject({
        status: 'healthy',
        agent: testAgentCard.name,
        version: testAgentCard.version,
      });
    });
  });

  describe('JSON-RPC Endpoint', () => {
    it('should handle SendMessage requests', async () => {
      const req = {
        method: 'POST',
        url: '/a2a',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'SendMessage',
          params: {
            message: createTestMessage('Hello'),
          },
        }),
      };

      let responseBody: unknown;
      const res = {
        status: (code: number) => ({
          json: (data: unknown) => {
            responseBody = data;
          },
          send: () => {},
        }),
        setHeader: () => {},
        write: () => {},
        end: () => {},
      };

      const handler = server.getHandler();
      await handler(req, res);

      expect((responseBody as Record<string, unknown>).error).toBeUndefined();
      expect((responseBody as Record<string, unknown>).result).toBeDefined();
    });

    it('should handle invalid JSON', async () => {
      const req = {
        method: 'POST',
        url: '/a2a',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      };

      let responseBody: unknown;
      const res = {
        status: (code: number) => ({
          json: (data: unknown) => {
            responseBody = data;
          },
          send: () => {},
        }),
        setHeader: () => {},
        write: () => {},
        end: () => {},
      };

      const handler = server.getHandler();
      await handler(req, res);

      expect((responseBody as Record<string, unknown>).error).toBeDefined();
      expect(((responseBody as Record<string, unknown>).error as Record<string, unknown>)?.code).toBe(A2AErrorCodes.PARSE_ERROR);
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS requests', async () => {
      const serverWithCORS = createA2AServer({
        agentCard: testAgentCard,
        taskStore,
        taskHandler: {
          async processMessage(message) {
            return { task: await server.createTask(message) };
          },
        },
        corsOrigin: 'https://example.com',
      });

      const req = {
        method: 'OPTIONS',
        url: '/a2a',
        headers: {},
        body: '',
      };

      let statusCode = 0;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: () => {},
            send: () => {},
          };
        },
        setHeader: () => {},
        write: () => {},
        end: () => {},
      };

      const handler = serverWithCORS.getHandler();
      await handler(req, res);

      expect(statusCode).toBe(204);
    });
  });

  describe('Task Management', () => {
    it('should create tasks', async () => {
      const message = createTestMessage('Hello');
      const task = await server.createTask(message, { contextId: 'ctx-1' });

      expect(task.id).toBeDefined();
      expect(task.status.state).toBe('submitted');
      expect(task.contextId).toBe('ctx-1');
      expect(task.history).toHaveLength(1);
    });

    it('should retrieve tasks', async () => {
      const message = createTestMessage('Hello');
      const created = await server.createTask(message);

      const retrieved = await server.getTask(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should list tasks', async () => {
      await server.createTask(createTestMessage('Message 1'));
      await server.createTask(createTestMessage('Message 2'));
      await server.createTask(createTestMessage('Message 3'));

      const tasks = await server.listTasks();

      expect(tasks).toHaveLength(3);
    });

    it('should filter tasks by context', async () => {
      await server.createTask(createTestMessage('Message 1'), { contextId: 'ctx-1' });
      await server.createTask(createTestMessage('Message 2'), { contextId: 'ctx-2' });

      const tasks = await server.listTasks({ contextId: 'ctx-1' });

      expect(tasks).toHaveLength(1);
    });

    it('should transition tasks', async () => {
      const message = createTestMessage('Hello');
      const task = await server.createTask(message);

      const updated = await server.transitionTask(task.id, 'working', {
        message: 'Processing...',
      });

      expect(updated.status.state).toBe('working');
      expect(updated.status.message?.parts[0]).toEqual({
        type: 'text',
        text: 'Processing...',
      });
    });

    it('should cancel tasks', async () => {
      const message = createTestMessage('Hello');
      const task = await server.createTask(message);

      const canceled = await server.cancelTask(task.id);

      expect(canceled.status.state).toBe('canceled');
    });

    it('should add artifacts', async () => {
      const message = createTestMessage('Hello');
      const task = await server.createTask(message);

      await server.addArtifact(task.id, {
        artifactId: 'art-1',
        parts: [{ type: 'text', text: 'Result' }],
        timestamp: new Date().toISOString(),
      });

      const updated = await server.getTask(task.id);
      expect(updated?.artifacts).toHaveLength(1);
    });

    it('should throw error when adding artifact to non-existent task', async () => {
      await expect(
        server.addArtifact('non-existent', {
          artifactId: 'art-1',
          parts: [{ type: 'text', text: 'Result' }],
          timestamp: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });
  });

  describe('Getters', () => {
    it('should return agent card', () => {
      const card = server.getAgentCard();

      expect(card).toEqual(testAgentCard);
    });

    it('should return JSON-RPC handler', () => {
      const handler = server.getJSONRPCHandler();

      expect(handler).toBeDefined();
    });

    it('should return stream manager', () => {
      const manager = server.getStreamManager();

      expect(manager).toBeDefined();
    });
  });

  describe('Custom Methods', () => {
    it('should support custom method registration', async () => {
      server.registerMethod('CustomMethod', async () => ({ custom: true }));

      const req = {
        method: 'POST',
        url: '/a2a',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'CustomMethod',
          params: {},
        }),
      };

      let responseBody: unknown;
      const res = {
        status: (code: number) => ({
          json: (data: unknown) => {
            responseBody = data;
          },
          send: () => {},
        }),
        setHeader: () => {},
        write: () => {},
        end: () => {},
      };

      const handler = server.getHandler();
      await handler(req, res);

      expect((responseBody as Record<string, unknown>).error).toBeUndefined();
      expect(((responseBody as Record<string, unknown>).result as Record<string, unknown>)?.custom).toBe(true);
    });
  });

  describe('Not Found', () => {
    it('should return 404 for unknown endpoints', async () => {
      const req = {
        method: 'GET',
        url: '/unknown',
        headers: {},
        body: '',
      };

      let statusCode = 0;
      let responseBody: unknown;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: unknown) => {
              responseBody = data;
            },
            send: () => {},
          };
        },
        setHeader: () => {},
        write: () => {},
        end: () => {},
      };

      const handler = server.getHandler();
      await handler(req, res);

      expect(statusCode).toBe(404);
      expect((responseBody as Record<string, unknown>).error).toBe('Not Found');
    });
  });
});

describe('createA2AServer', () => {
  it('should create a server with default options', () => {
    const taskHandler: TaskHandler = {
      async processMessage(message) {
        return { message: { ...message, role: 'agent' } };
      },
    };

    const server = createA2AServer({
      agentCard: testAgentCard,
      taskHandler,
    });

    expect(server).toBeInstanceOf(A2AServer);
    expect(server.getAgentCard()).toEqual(testAgentCard);
  });
});
