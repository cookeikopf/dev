import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAgent, createCapability, AgentImpl } from '../src/core/agent.js';
import type { AgentConfig, Capability, JsonRpcRequest } from '../src/types/index.js';

describe('Agent', () => {
  describe('createAgent', () => {
    const baseConfig: AgentConfig = {
      name: 'TestAgent',
      identity: 'eip155:84532/0x1234567890abcdef1234567890abcdef12345678',
      capabilities: [],
    };

    it('should create agent with minimal config', () => {
      const agent = createAgent(baseConfig);
      expect(agent).toBeDefined();
      expect(agent.name).toBe('TestAgent');
      expect(agent.identity.reference).toBe(baseConfig.identity);
    });

    it('should throw without name', () => {
      expect(() => createAgent({ ...baseConfig, name: '' } as AgentConfig)).toThrow('name is required');
    });

    it('should throw without identity', () => {
      expect(() => createAgent({ ...baseConfig, identity: '' as `eip155:${number}/${string}` })).toThrow('identity is required');
    });

    it('should throw with invalid identity format', () => {
      expect(() => createAgent({
        ...baseConfig,
        identity: 'invalid' as `eip155:${number}/${string}`,
      })).toThrow('Invalid identity reference');
    });

    it('should normalize identity address to lowercase', () => {
      const agent = createAgent({
        ...baseConfig,
        identity: 'eip155:84532/0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
      });
      expect(agent.identity.reference).toBe('eip155:84532/0xabcdef1234567890abcdef1234567890abcdef12');
    });

    it('should set default version', () => {
      const agent = createAgent(baseConfig);
      expect(agent.config.version).toBe('1.0.0');
    });

    it('should accept custom version', () => {
      const agent = createAgent({ ...baseConfig, version: '2.0.0' });
      expect(agent.config.version).toBe('2.0.0');
    });

    it('should accept capabilities', () => {
      const cap = createCapability()
        .id('test-cap')
        .name('Test')
        .description('Test capability')
        .handler(async () => ({ result: 'ok' }))
        .build();
      
      const agent = createAgent({ ...baseConfig, capabilities: [cap] });
      expect(agent.capabilities.has('test-cap')).toBe(true);
    });

    it('should accept x402 config', () => {
      const agent = createAgent({
        ...baseConfig,
        x402: {
          usdcAddress: '0x...',
          chainId: 84532,
          receiver: '0x...',
        },
      });
      expect(agent.isPaymentEnabled()).toBe(true);
    });

    it('should accept telemetry config', () => {
      const onCapabilityInvoke = vi.fn();
      const agent = createAgent({
        ...baseConfig,
        telemetry: {
          enabled: true,
          hooks: { onCapabilityInvoke },
        },
      });
      expect(agent.telemetry).toBeDefined();
    });

    it('should accept A2A config', () => {
      const agent = createAgent({
        ...baseConfig,
        a2a: {
          path: '/custom',
          enableSse: true,
        },
      });
      const handler = (agent as AgentImpl).getA2AHandler();
      expect(handler.getConfig().path).toBe('/custom');
      expect(handler.isSseEnabled()).toBe(true);
    });
  });

  describe('AgentImpl', () => {
    let agent: AgentImpl;

    beforeEach(() => {
      agent = createAgent({
        name: 'TestAgent',
        identity: 'eip155:84532/0x1234567890abcdef1234567890abcdef12345678',
        capabilities: [
          createCapability()
            .id('test-cap')
            .name('Test Capability')
            .description('A test capability')
            .handler(async (input: { value: number }) => ({ result: input.value * 2 }))
            .build(),
        ],
      }) as AgentImpl;
    });

    describe('registerCapability', () => {
      it('should register new capability', () => {
        const newCap = createCapability()
          .id('new-cap')
          .name('New')
          .description('New capability')
          .handler(async () => ({}))
          .build();
        
        agent.registerCapability(newCap);
        expect(agent.capabilities.has('new-cap')).toBe(true);
      });

      it('should return agent for chaining', () => {
        const newCap = createCapability()
          .id('new-cap')
          .name('New')
          .description('New capability')
          .handler(async () => ({}))
          .build();
        
        const result = agent.registerCapability(newCap);
        expect(result).toBe(agent);
      });
    });

    describe('unregisterCapability', () => {
      it('should unregister capability', () => {
        agent.unregisterCapability('test-cap');
        expect(agent.capabilities.has('test-cap')).toBe(false);
      });

      it('should return agent for chaining', () => {
        const result = agent.unregisterCapability('test-cap');
        expect(result).toBe(agent);
      });

      it('should handle unregistering non-existent capability', () => {
        expect(() => agent.unregisterCapability('non-existent')).not.toThrow();
      });
    });

    describe('executeCapability', () => {
      it('should execute capability', async () => {
        const result = await agent.executeCapability('test-cap', { value: 5 });
        expect(result).toEqual({ result: 10 });
      });

      it('should throw for non-existent capability', async () => {
        await expect(agent.executeCapability('non-existent', {})).rejects.toThrow('Capability not found');
      });

      it('should pass request context', async () => {
        const handler = vi.fn().mockResolvedValue({});
        agent.registerCapability(
          createCapability()
            .id('context-cap')
            .name('Context')
            .description('Context test')
            .handler(handler)
            .build()
        );

        await agent.executeCapability('context-cap', { data: 'test' }, {
          id: 'req-1',
          ip: '127.0.0.1',
          headers: { 'x-custom': 'value' },
        });

        expect(handler).toHaveBeenCalled();
        const context = handler.mock.calls[0]![1];
        expect(context.request.id).toBe('req-1');
        expect(context.request.ip).toBe('127.0.0.1');
        expect(context.agent).toBe(agent);
      });

      it('should record telemetry on success', async () => {
        const telemetrySpy = vi.spyOn(agent.getTelemetryManager(), 'recordCapabilityInvoke');
        await agent.executeCapability('test-cap', { value: 5 });
        expect(telemetrySpy).toHaveBeenCalled();
        const call = telemetrySpy.mock.calls[0]![0];
        expect(call.success).toBe(true);
        expect(call.capabilityId).toBe('test-cap');
      });

      it('should record telemetry on failure', async () => {
        agent.registerCapability(
          createCapability()
            .id('error-cap')
            .name('Error')
            .description('Error test')
            .handler(async () => {
              throw new Error('Test error');
            })
            .build()
        );

        const telemetrySpy = vi.spyOn(agent.getTelemetryManager(), 'recordCapabilityInvoke');
        const errorSpy = vi.spyOn(agent.getTelemetryManager(), 'recordError');

        await expect(agent.executeCapability('error-cap', {})).rejects.toThrow('Test error');

        expect(telemetrySpy).toHaveBeenCalled();
        expect(telemetrySpy.mock.calls[0]![0].success).toBe(false);
        expect(errorSpy).toHaveBeenCalled();
      });
    });

    describe('generateAgentCard', () => {
      it('should generate agent card', () => {
        const card = agent.generateAgentCard('http://localhost:3000');
        expect(card.schema_version).toBe('1.0');
        expect(card.name).toBe('TestAgent');
        expect(card.url).toBe('http://localhost:3000');
        expect(card.capabilities).toHaveLength(1);
      });
    });

    describe('handleA2ARequest', () => {
      it('should handle discover request', async () => {
        const request: JsonRpcRequest = {
          jsonrpc: '2.0',
          id: '1',
          method: 'a2a.discover',
        };
        const response = await agent.handleA2ARequest(request);
        expect(response.result).toBeDefined();
        expect(response.error).toBeUndefined();
      });

      it('should return error for invalid JSON-RPC', async () => {
        const request = {
          jsonrpc: '1.0',
          id: '1',
          method: 'a2a.discover',
        } as unknown as JsonRpcRequest;
        const response = await agent.handleA2ARequest(request);
        expect(response.error).toBeDefined();
        expect(response.error!.code).toBe(-32600);
      });
    });

    describe('honoMiddleware', () => {
      it('should return middleware function', () => {
        const middleware = agent.honoMiddleware();
        expect(typeof middleware).toBe('function');
      });
    });

    describe('expressMiddleware', () => {
      it('should return middleware function', () => {
        const middleware = agent.expressMiddleware();
        expect(typeof middleware).toBe('function');
      });
    });

    describe('nextJsHandler', () => {
      it('should return handler function', () => {
        const handler = agent.nextJsHandler();
        expect(typeof handler).toBe('function');
      });
    });

    describe('isPaymentEnabled', () => {
      it('should return false without x402 config', () => {
        expect(agent.isPaymentEnabled()).toBe(false);
      });

      it('should return true with x402 config', () => {
        const paidAgent = createAgent({
          name: 'PaidAgent',
          identity: 'eip155:84532/0x1234567890abcdef1234567890abcdef12345678',
          capabilities: [],
          x402: {
            usdcAddress: '0x...',
            chainId: 84532,
            receiver: '0x...',
          },
        });
        expect(paidAgent.isPaymentEnabled()).toBe(true);
      });
    });
  });

  describe('createCapability', () => {
    it('should create capability builder', () => {
      const builder = createCapability();
      expect(builder).toBeDefined();
      expect(typeof builder.id).toBe('function');
    });

    it('should build capability with all fields', () => {
      const cap = createCapability()
        .id('test-cap')
        .name('Test Capability')
        .description('A test capability')
        .input({
          schema: { type: 'object', properties: { value: { type: 'number' } } },
          description: 'Input description',
        })
        .output({
          schema: { type: 'object', properties: { result: { type: 'number' } } },
          description: 'Output description',
        })
        .pricing(1.5)
        .requiresPayment(true)
        .handler(async (input: { value: number }) => ({ result: input.value * 2 }))
        .build();

      expect(cap.id).toBe('test-cap');
      expect(cap.name).toBe('Test Capability');
      expect(cap.description).toBe('A test capability');
      expect(cap.input).toBeDefined();
      expect(cap.output).toBeDefined();
      expect(cap.pricing).toBe(1.5);
      expect(cap.requiresPayment).toBe(true);
      expect(typeof cap.handler).toBe('function');
    });

    it('should set requiresPayment based on pricing', () => {
      const cap = createCapability()
        .id('paid-cap')
        .name('Paid')
        .description('Paid capability')
        .pricing(1)
        .handler(async () => ({}))
        .build();

      expect(cap.requiresPayment).toBe(true);
    });

    it('should throw without id', () => {
      expect(() =>
        createCapability()
          .name('Test')
          .description('Test')
          .handler(async () => ({}))
          .build()
      ).toThrow('ID is required');
    });

    it('should throw without name', () => {
      expect(() =>
        createCapability()
          .id('test')
          .description('Test')
          .handler(async () => ({}))
          .build()
      ).toThrow('name is required');
    });

    it('should throw without description', () => {
      expect(() =>
        createCapability()
          .id('test')
          .name('Test')
          .handler(async () => ({}))
          .build()
      ).toThrow('description is required');
    });

    it('should throw without handler', () => {
      expect(() =>
        createCapability()
          .id('test')
          .name('Test')
          .description('Test')
          .build()
      ).toThrow('handler is required');
    });
  });
});
