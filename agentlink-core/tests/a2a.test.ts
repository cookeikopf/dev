import { describe, it, expect, beforeEach } from 'vitest';
import {
  A2AHandler,
  createA2AHandler,
  A2ASseStream,
  createA2ASseStream,
  validateJsonRpcRequest,
} from '../src/a2a/index.js';
import { AgentImpl, createAgent, createCapability } from '../src/core/agent.js';
import type { AgentConfig, JsonRpcRequest } from '../src/types/index.js';

describe('A2A Protocol', () => {
  describe('A2AHandler', () => {
    let handler: A2AHandler;
    let agent: AgentImpl;

    beforeEach(() => {
      handler = new A2AHandler();
      agent = createAgent({
        name: 'TestAgent',
        identity: 'eip155:84532/0x1234567890abcdef1234567890abcdef12345678',
        capabilities: [
          createCapability()
            .id('test-cap')
            .name('Test Capability')
            .description('A test capability')
            .handler(async () => ({ result: 'success' }))
            .build(),
        ],
      }) as AgentImpl;
      handler.setAgent(agent);
    });

    describe('constructor', () => {
      it('should create with default config', () => {
        const h = new A2AHandler();
        expect(h.getConfig().path).toBe('/');
      });

      it('should accept custom config', () => {
        const h = new A2AHandler({ path: '/custom', enableSse: true });
        expect(h.getConfig().path).toBe('/custom');
        expect(h.getConfig().enableSse).toBe(true);
      });
    });

    describe('generateAgentCard', () => {
      it('should generate agent card', () => {
        const card = handler.generateAgentCard('http://localhost:3000');
        expect(card.schema_version).toBe('1.0');
        expect(card.name).toBe('TestAgent');
        expect(card.url).toBe('http://localhost:3000');
        expect(card.capabilities).toHaveLength(1);
        expect(card.capabilities[0]!.id).toBe('test-cap');
      });

      it('should throw if agent not set', () => {
        const h = new A2AHandler();
        expect(() => h.generateAgentCard('http://localhost')).toThrow('Agent not set');
      });
    });

    describe('handleRequest', () => {
      it('should handle a2a.discover', async () => {
        const request: JsonRpcRequest = {
          jsonrpc: '2.0',
          id: '1',
          method: 'a2a.discover',
        };
        const response = await handler.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('1');
        expect(response.result).toBeDefined();
        expect(response.error).toBeUndefined();
        const result = response.result as { agent: { name: string } };
        expect(result.agent.name).toBe('TestAgent');
      });

      it('should handle a2a.capabilities', async () => {
        const request: JsonRpcRequest = {
          jsonrpc: '2.0',
          id: '1',
          method: 'a2a.capabilities',
        };
        const response = await handler.handleRequest(request);
        expect(response.result).toBeDefined();
        const result = response.result as { capabilities: Array<{ id: string }> };
        expect(result.capabilities).toHaveLength(1);
        expect(result.capabilities[0]!.id).toBe('test-cap');
      });

      it('should handle a2a.handover', async () => {
        const request: JsonRpcRequest = {
          jsonrpc: '2.0',
          id: '1',
          method: 'a2a.handover',
          params: {
            taskId: 'task-1',
            targetAgent: 'http://other-agent.com',
          },
        };
        const response = await handler.handleRequest(request);
        expect(response.result).toBeDefined();
        const result = response.result as { success: boolean; taskId: string };
        expect(result.success).toBe(true);
        expect(result.taskId).toBe('task-1');
      });

      it('should return error for missing params in handover', async () => {
        const request: JsonRpcRequest = {
          jsonrpc: '2.0',
          id: '1',
          method: 'a2a.handover',
          params: {},
        };
        const response = await handler.handleRequest(request);
        expect(response.error).toBeDefined();
        expect(response.error!.code).toBe(-32602);
      });

      it('should return error for unknown method', async () => {
        const request: JsonRpcRequest = {
          jsonrpc: '2.0',
          id: '1',
          method: 'unknown.method',
        };
        const response = await handler.handleRequest(request);
        expect(response.error).toBeDefined();
        expect(response.error!.code).toBe(-32601);
      });

      it('should return error for invalid JSON-RPC version', async () => {
        const request = {
          jsonrpc: '1.0',
          id: '1',
          method: 'a2a.discover',
        } as unknown as JsonRpcRequest;
        const response = await handler.handleRequest(request);
        expect(response.error).toBeDefined();
        expect(response.error!.code).toBe(-32600);
      });

      it('should return error if agent not initialized', async () => {
        const h = new A2AHandler();
        const request: JsonRpcRequest = {
          jsonrpc: '2.0',
          id: '1',
          method: 'a2a.discover',
        };
        const response = await h.handleRequest(request);
        expect(response.error).toBeDefined();
        expect(response.error!.code).toBe(-32603);
      });
    });

    describe('getAgentCardPath', () => {
      it('should return default path', () => {
        expect(handler.getAgentCardPath()).toBe('/.well-known/agent.json');
      });

      it('should return custom path', () => {
        const h = new A2AHandler({ agentCardPath: '/custom/agent.json' });
        expect(h.getAgentCardPath()).toBe('/custom/agent.json');
      });
    });

    describe('getSsePath', () => {
      it('should return default path', () => {
        expect(handler.getSsePath()).toBe('/sse');
      });

      it('should return custom path', () => {
        const h = new A2AHandler({ ssePath: '/custom/sse' });
        expect(h.getSsePath()).toBe('/custom/sse');
      });
    });

    describe('isSseEnabled', () => {
      it('should return false by default', () => {
        expect(handler.isSseEnabled()).toBe(false);
      });

      it('should return true when enabled', () => {
        const h = new A2AHandler({ enableSse: true });
        expect(h.isSseEnabled()).toBe(true);
      });
    });
  });

  describe('createA2AHandler', () => {
    it('should create A2A handler', () => {
      const handler = createA2AHandler({ path: '/custom' });
      expect(handler).toBeInstanceOf(A2AHandler);
      expect(handler.getConfig().path).toBe('/custom');
    });
  });

  describe('A2ASseStream', () => {
    it('should create SSE stream', () => {
      const stream = new A2ASseStream();
      expect(stream.getStream()).toBeInstanceOf(ReadableStream);
    });

    it('should send events', async () => {
      const stream = createA2ASseStream();
      const reader = stream.getStream().getReader();
      
      stream.send('test', { data: 'value' });
      
      const result = await reader.read();
      expect(result.done).toBe(false);
      const text = new TextDecoder().decode(result.value);
      expect(text).toContain('event: test');
      expect(text).toContain('data: {"data":"value"}');
      
      reader.releaseLock();
    });

    it('should send heartbeat', async () => {
      const stream = createA2ASseStream();
      const reader = stream.getStream().getReader();
      
      stream.heartbeat();
      
      const result = await reader.read();
      const text = new TextDecoder().decode(result.value);
      expect(text).toContain(':heartbeat');
      
      reader.releaseLock();
    });

    it('should close stream', async () => {
      const stream = createA2ASseStream();
      const reader = stream.getStream().getReader();
      
      stream.close();
      
      const result = await reader.read();
      expect(result.done).toBe(true);
    });

    it('should send error and close', async () => {
      const stream = createA2ASseStream();
      const reader = stream.getStream().getReader();
      
      stream.error('Test error');
      
      const result = await reader.read();
      const text = new TextDecoder().decode(result.value);
      expect(text).toContain('event: error');
      expect(text).toContain('Test error');
      
      const done = await reader.read();
      expect(done.done).toBe(true);
    });
  });

  describe('validateJsonRpcRequest', () => {
    it('should validate valid request', () => {
      const body = {
        jsonrpc: '2.0',
        id: '1',
        method: 'test',
        params: {},
      };
      const result = validateJsonRpcRequest(body);
      expect(result.valid).toBe(true);
      expect(result.request).toEqual(body);
    });

    it('should reject non-object body', () => {
      const result = validateJsonRpcRequest('invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request body must be an object');
    });

    it('should reject invalid jsonrpc version', () => {
      const result = validateJsonRpcRequest({ jsonrpc: '1.0', id: '1', method: 'test' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JSON-RPC version');
    });

    it('should reject missing method', () => {
      const result = validateJsonRpcRequest({ jsonrpc: '2.0', id: '1' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Method must be a non-empty string');
    });

    it('should reject empty method', () => {
      const result = validateJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: '' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Method must be a non-empty string');
    });

    it('should reject missing id', () => {
      const result = validateJsonRpcRequest({ jsonrpc: '2.0', method: 'test' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request must have an id');
    });

    it('should accept null id', () => {
      const result = validateJsonRpcRequest({ jsonrpc: '2.0', id: null, method: 'test' });
      expect(result.valid).toBe(true);
    });

    it('should accept number id', () => {
      const result = validateJsonRpcRequest({ jsonrpc: '2.0', id: 123, method: 'test' });
      expect(result.valid).toBe(true);
    });
  });
});
