/**
 * A2A Protocol - JSON-RPC Handler Tests
 * 
 * Tests for JSON-RPC handler and method implementations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  JSONRPCHandler,
  JSONRPCError,
  InMemoryTaskStore,
  createSuccessResponse,
  createErrorResponse,
  parseJSONRPCRequest,
  type AgentCard,
  type Task,
  type Message,
  type TaskHandler,
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

describe('JSONRPCHandler', () => {
  let taskStore: InMemoryTaskStore;
  let taskHandler: TaskHandler;
  let handler: JSONRPCHandler;

  beforeEach(() => {
    taskStore = new InMemoryTaskStore();
    taskHandler = {
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

    handler = new JSONRPCHandler({
      agentCard: testAgentCard,
      taskStore,
      taskHandler,
      debug: false,
    });
  });

  describe('SendMessage', () => {
    it('should create a new task', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'SendMessage',
        params: {
          message: createTestMessage('Hello'),
        },
      };

      const response = await handler.handleRequest(request, { headers: {} });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      expect(response.result?.task).toBeDefined();
      expect(response.result?.task?.status?.state).toBe('working');
    });

    it('should continue an existing task', async () => {
      // First, create a task
      const createResponse = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'SendMessage',
          params: {
            message: createTestMessage('Hello'),
          },
        },
        { headers: {} }
      );

      const taskId = createResponse.result?.task?.id;

      // Continue the task
      const continueResponse = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'SendMessage',
          params: {
            message: createTestMessage('Follow up'),
            taskId,
          },
        },
        { headers: {} }
      );

      expect(continueResponse.error).toBeUndefined();
      expect(continueResponse.result?.task?.id).toBe(taskId);
    });

    it('should return error for non-existent task', async () => {
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'SendMessage',
          params: {
            message: createTestMessage('Hello'),
            taskId: 'non-existent-task',
          },
        },
        { headers: {} }
      );

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(A2AErrorCodes.TASK_NOT_FOUND);
    });

    it('should return error for terminal state task', async () => {
      // Create and complete a task
      const createResponse = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'SendMessage',
          params: {
            message: createTestMessage('Hello'),
          },
        },
        { headers: {} }
      );

      const taskId = createResponse.result?.task?.id;

      // Complete the task
      await taskStore.set(taskId, {
        ...createResponse.result?.task,
        status: {
          state: 'completed',
          timestamp: new Date().toISOString(),
        },
      });

      // Try to continue
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'SendMessage',
          params: {
            message: createTestMessage('Follow up'),
            taskId,
          },
        },
        { headers: {} }
      );

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(A2AErrorCodes.UNSUPPORTED_OPERATION);
    });

    it('should return error for invalid params', async () => {
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'SendMessage',
          params: {},
        },
        { headers: {} }
      );

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(A2AErrorCodes.INVALID_PARAMS);
    });
  });

  describe('GetTask', () => {
    it('should retrieve an existing task', async () => {
      // Create a task first
      const createResponse = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'SendMessage',
          params: {
            message: createTestMessage('Hello'),
          },
        },
        { headers: {} }
      );

      const taskId = createResponse.result?.task?.id;

      // Get the task
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'GetTask',
          params: { id: taskId },
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.id).toBe(taskId);
    });

    it('should return error for non-existent task', async () => {
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'GetTask',
          params: { id: 'non-existent' },
        },
        { headers: {} }
      );

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(A2AErrorCodes.TASK_NOT_FOUND);
    });

    it('should limit history length', async () => {
      // Create a task with history
      const task: Task = {
        id: 'test-task',
        status: {
          state: 'working',
          timestamp: new Date().toISOString(),
        },
        history: [
          createTestMessage('Message 1'),
          createTestMessage('Message 2'),
          createTestMessage('Message 3'),
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await taskStore.set(task.id, task);

      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'GetTask',
          params: { id: 'test-task', historyLength: 2 },
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.history).toHaveLength(2);
    });
  });

  describe('ListTasks', () => {
    it('should list all tasks', async () => {
      // Create multiple tasks
      for (let i = 0; i < 3; i++) {
        await handler.handleRequest(
          {
            jsonrpc: '2.0',
            id: i,
            method: 'SendMessage',
            params: {
              message: createTestMessage(`Message ${i}`),
            },
          },
          { headers: {} }
        );
      }

      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 10,
          method: 'ListTasks',
          params: {},
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.tasks).toHaveLength(3);
      expect(response.result?.totalSize).toBe(3);
    });

    it('should filter by context ID', async () => {
      // Create tasks with different context IDs
      await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'SendMessage',
          params: {
            message: createTestMessage('Message 1'),
            contextId: 'ctx-1',
          },
        },
        { headers: {} }
      );

      await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'SendMessage',
          params: {
            message: createTestMessage('Message 2'),
            contextId: 'ctx-2',
          },
        },
        { headers: {} }
      );

      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'ListTasks',
          params: { contextId: 'ctx-1' },
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.tasks).toHaveLength(1);
    });

    it('should support pagination', async () => {
      // Create multiple tasks
      for (let i = 0; i < 5; i++) {
        await handler.handleRequest(
          {
            jsonrpc: '2.0',
            id: i,
            method: 'SendMessage',
            params: {
              message: createTestMessage(`Message ${i}`),
            },
          },
          { headers: {} }
        );
      }

      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 10,
          method: 'ListTasks',
          params: { pageSize: 2 },
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.tasks).toHaveLength(2);
      expect(response.result?.pageSize).toBe(2);
      expect(response.result?.nextPageToken).toBeDefined();
    });
  });

  describe('CancelTask', () => {
    it('should cancel an existing task', async () => {
      // Create a task
      const createResponse = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'SendMessage',
          params: {
            message: createTestMessage('Hello'),
          },
        },
        { headers: {} }
      );

      const taskId = createResponse.result?.task?.id;

      // Cancel the task
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'CancelTask',
          params: { id: taskId },
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.status?.state).toBe('canceled');
    });

    it('should return error for non-existent task', async () => {
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'CancelTask',
          params: { id: 'non-existent' },
        },
        { headers: {} }
      );

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(A2AErrorCodes.TASK_NOT_FOUND);
    });

    it('should return error for already completed task', async () => {
      // Create and complete a task
      const createResponse = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'SendMessage',
          params: {
            message: createTestMessage('Hello'),
          },
        },
        { headers: {} }
      );

      const taskId = createResponse.result?.task?.id;
      await taskStore.set(taskId, {
        ...createResponse.result?.task,
        status: {
          state: 'completed',
          timestamp: new Date().toISOString(),
        },
      });

      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'CancelTask',
          params: { id: taskId },
        },
        { headers: {} }
      );

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(A2AErrorCodes.INVALID_TASK_STATE);
    });
  });

  describe('GetAgentCard', () => {
    it('should return the agent card', async () => {
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'GetAgentCard',
          params: {},
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.name).toBe(testAgentCard.name);
      expect(response.result?.version).toBe(testAgentCard.version);
    });
  });

  describe('GetExtendedAgentCard', () => {
    it('should return extended agent card when supported', async () => {
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'GetExtendedAgentCard',
          params: {},
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.name).toBe(testAgentCard.name);
    });

    it('should return error when not supported', async () => {
      const handlerWithoutExtended = new JSONRPCHandler({
        agentCard: {
          ...testAgentCard,
          capabilities: { ...testAgentCard.capabilities, extendedAgentCard: false },
        },
        taskStore,
        taskHandler,
      });

      const response = await handlerWithoutExtended.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'GetExtendedAgentCard',
          params: {},
        },
        { headers: {} }
      );

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(A2AErrorCodes.UNSUPPORTED_OPERATION);
    });
  });

  describe('Legacy Methods', () => {
    it('should support a2a.discover', async () => {
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'a2a.discover',
          params: {},
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.name).toBe(testAgentCard.name);
    });

    it('should support a2a.capabilities', async () => {
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'a2a.capabilities',
          params: {},
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.capabilities).toBeDefined();
      expect(response.result?.methods).toContain('SendMessage');
    });

    it('should support a2a.handover', async () => {
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'a2a.handover',
          params: {},
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON-RPC requests', async () => {
      const response = await handler.handleRequest(
        {
          jsonrpc: '1.0', // Invalid version
          id: 1,
          method: 'SendMessage',
          params: {},
        },
        { headers: {} }
      );

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(A2AErrorCodes.INVALID_REQUEST);
    });

    it('should handle unknown methods', async () => {
      const response = await handler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'UnknownMethod',
          params: {},
        },
        { headers: {} }
      );

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(A2AErrorCodes.METHOD_NOT_FOUND);
    });
  });

  describe('Custom Handlers', () => {
    it('should support custom method handlers', async () => {
      const customHandler = new JSONRPCHandler({
        agentCard: testAgentCard,
        taskStore,
        taskHandler,
        customHandlers: {
          CustomMethod: async () => ({ custom: true }),
        },
      });

      const response = await customHandler.handleRequest(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'CustomMethod',
          params: {},
        },
        { headers: {} }
      );

      expect(response.error).toBeUndefined();
      expect(response.result?.custom).toBe(true);
    });
  });
});

describe('Utility Functions', () => {
  describe('createSuccessResponse', () => {
    it('should create a success response', () => {
      const response = createSuccessResponse(1, { task: { id: 'task-1' } });
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toEqual({ task: { id: 'task-1' } });
      expect(response.error).toBeUndefined();
    });
  });

  describe('createErrorResponse', () => {
    it('should create an error response', () => {
      const response = createErrorResponse(
        1,
        A2AErrorCodes.TASK_NOT_FOUND,
        'Task not found'
      );
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.error?.code).toBe(A2AErrorCodes.TASK_NOT_FOUND);
      expect(response.error?.message).toBe('Task not found');
      expect(response.result).toBeUndefined();
    });

    it('should include error data when provided', () => {
      const response = createErrorResponse(
        1,
        A2AErrorCodes.INVALID_PARAMS,
        'Invalid params',
        { field: 'taskId' }
      );
      
      expect(response.error?.data).toEqual({ field: 'taskId' });
    });
  });

  describe('parseJSONRPCRequest', () => {
    it('should parse valid JSON-RPC requests', () => {
      const json = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'SendMessage',
        params: {},
      });

      const { request, error } = parseJSONRPCRequest(json);

      expect(error).toBeUndefined();
      expect(request).toBeDefined();
      expect(request?.method).toBe('SendMessage');
    });

    it('should return error for invalid JSON', () => {
      const { request, error } = parseJSONRPCRequest('not valid json');

      expect(request).toBeUndefined();
      expect(error).toBeDefined();
      expect(error?.error?.code).toBe(A2AErrorCodes.PARSE_ERROR);
    });

    it('should return error for invalid JSON-RPC', () => {
      const json = JSON.stringify({
        jsonrpc: '1.0', // Invalid version
        id: 1,
        method: 'SendMessage',
      });

      const { request, error } = parseJSONRPCRequest(json);

      expect(request).toBeUndefined();
      expect(error).toBeDefined();
      expect(error?.error?.code).toBe(A2AErrorCodes.INVALID_REQUEST);
    });
  });
});

describe('JSONRPCError', () => {
  it('should create JSON-RPC errors', () => {
    const error = new JSONRPCError(
      A2AErrorCodes.TASK_NOT_FOUND,
      'Task not found',
      { taskId: 'missing' }
    );

    expect(error.code).toBe(A2AErrorCodes.TASK_NOT_FOUND);
    expect(error.message).toBe('Task not found');
    expect(error.data).toEqual({ taskId: 'missing' });
    expect(error.name).toBe('JSONRPCError');
  });

  it('should convert to JSON', () => {
    const error = new JSONRPCError(
      A2AErrorCodes.INVALID_PARAMS,
      'Invalid params'
    );

    const json = error.toJSON();
    expect(json.code).toBe(A2AErrorCodes.INVALID_PARAMS);
    expect(json.message).toBe('Invalid params');
    expect(json.data).toBeUndefined();
  });
});

describe('InMemoryTaskStore', () => {
  it('should store and retrieve tasks', async () => {
    const store = new InMemoryTaskStore();
    const task: Task = {
      id: 'task-1',
      status: {
        state: 'working',
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.set(task.id, task);
    const retrieved = await store.get(task.id);

    expect(retrieved).toEqual(task);
  });

  it('should return undefined for non-existent tasks', async () => {
    const store = new InMemoryTaskStore();
    const retrieved = await store.get('non-existent');

    expect(retrieved).toBeUndefined();
  });

  it('should delete tasks', async () => {
    const store = new InMemoryTaskStore();
    const task: Task = {
      id: 'task-1',
      status: {
        state: 'working',
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.set(task.id, task);
    await store.delete(task.id);
    const retrieved = await store.get(task.id);

    expect(retrieved).toBeUndefined();
  });

  it('should list tasks', async () => {
    const store = new InMemoryTaskStore();
    
    for (let i = 0; i < 3; i++) {
      const task: Task = {
        id: `task-${i}`,
        status: {
          state: 'working',
          timestamp: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await store.set(task.id, task);
    }

    const tasks = await store.list();

    expect(tasks).toHaveLength(3);
  });

  it('should filter tasks by context ID', async () => {
    const store = new InMemoryTaskStore();
    
    const task1: Task = {
      id: 'task-1',
      contextId: 'ctx-1',
      status: {
        state: 'working',
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const task2: Task = {
      id: 'task-2',
      contextId: 'ctx-2',
      status: {
        state: 'working',
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.set(task1.id, task1);
    await store.set(task2.id, task2);

    const tasks = await store.list({ contextId: 'ctx-1' });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('task-1');
  });

  it('should generate unique IDs', () => {
    const store = new InMemoryTaskStore();
    
    const id1 = store.generateId();
    const id2 = store.generateId();

    expect(id1).not.toBe(id2);
    expect(id1).toContain('task-');
  });

  it('should clear all tasks', async () => {
    const store = new InMemoryTaskStore();
    
    const task: Task = {
      id: 'task-1',
      status: {
        state: 'working',
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.set(task.id, task);
    store.clear();
    const retrieved = await store.get(task.id);

    expect(retrieved).toBeUndefined();
  });
});
