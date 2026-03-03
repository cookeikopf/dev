/**
 * AgentLink Core - Agent Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAgent, createCapability } from '../../src/index.js';
import type { AgentConfig, CapabilityContext } from '../../src/types/index.js';

describe('Agent Integration', () => {
  const baseConfig: AgentConfig = {
    name: 'IntegrationTestAgent',
    identity: 'eip155:84532/0x1234567890123456789012345678901234567890',
    description: 'Agent for integration tests',
    capabilities: [],
  };

  describe('Full Capability Execution Flow', () => {
    it('should execute capability with full context', async () => {
      let capturedContext: CapabilityContext | undefined;

      const capability = createCapability()
        .id('context-capture')
        .name('Context Capture')
        .description('Captures execution context')
        .handler(async (input, context) => {
          capturedContext = context;
          return { captured: true };
        })
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [capability],
      });

      const result = await agent.executeCapability('context-capture', { test: 'input' });

      expect(result).toEqual({ captured: true });
      expect(capturedContext).toBeDefined();
      expect(capturedContext?.agent).toBe(agent);
      expect(capturedContext?.request).toBeDefined();
      expect(capturedContext?.request.id).toBeDefined();
      expect(capturedContext?.telemetry).toBeDefined();
    });

    it('should handle payment context when provided', async () => {
      let capturedPayment: any;

      const capability = createCapability()
        .id('payment-handler')
        .name('Payment Handler')
        .description('Handles payments')
        .pricing(0.01)
        .handler(async (input, context) => {
          capturedPayment = context.payment;
          return { paid: !!context.payment };
        })
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [capability],
      });

      const paymentContext = {
        amount: 10000,
        txHash: '0xabc123',
        payer: '0x1234567890123456789012345678901234567890',
        timestamp: new Date(),
      };

      const result = await agent.executeCapability(
        'payment-handler',
        { data: 'test' },
        { payment: paymentContext }
      );

      expect(result).toEqual({ paid: true });
      expect(capturedPayment).toEqual(paymentContext);
    });

    it('should emit telemetry throughout execution', async () => {
      const events: string[] = [];

      const capability = createCapability()
        .id('telemetry-test')
        .name('Telemetry Test')
        .description('Tests telemetry')
        .handler(async () => ({ success: true }))
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [capability],
        telemetry: {
          enabled: true,
        },
      });

      agent.telemetry.on('capability:invoke:start', (e) => {
        events.push(`start:${(e as any).capabilityId}`);
      });
      agent.telemetry.on('capability:invoke:success', (e) => {
        events.push(`success:${(e as any).capabilityId}`);
      });

      await agent.executeCapability('telemetry-test', {});

      expect(events).toEqual([
        'start:telemetry-test',
        'success:telemetry-test',
      ]);
    });
  });

  describe('Multi-Capability Agent', () => {
    it('should execute different capabilities independently', async () => {
      const addCap = createCapability()
        .id('add')
        .name('Add')
        .description('Adds two numbers')
        .handler(async (input: { a: number; b: number }) => ({
          result: input.a + input.b,
        }))
        .build();

      const multiplyCap = createCapability()
        .id('multiply')
        .name('Multiply')
        .description('Multiplies two numbers')
        .handler(async (input: { a: number; b: number }) => ({
          result: input.a * input.b,
        }))
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [addCap, multiplyCap],
      });

      const addResult = await agent.executeCapability('add', { a: 5, b: 3 });
      const multiplyResult = await agent.executeCapability('multiply', { a: 5, b: 3 });

      expect(addResult).toEqual({ result: 8 });
      expect(multiplyResult).toEqual({ result: 15 });
    });

    it('should maintain state between capability calls via agent', async () => {
      const state = { counter: 0 };

      const incrementCap = createCapability()
        .id('increment')
        .name('Increment')
        .description('Increments counter')
        .handler(async (_, context) => {
          state.counter++;
          return { counter: state.counter };
        })
        .build();

      const getCountCap = createCapability()
        .id('get-count')
        .name('Get Count')
        .description('Gets current count')
        .handler(async () => ({ counter: state.counter }))
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [incrementCap, getCountCap],
      });

      await agent.executeCapability('increment', {});
      await agent.executeCapability('increment', {});
      const result = await agent.executeCapability('get-count', {});

      expect(result).toEqual({ counter: 2 });
    });
  });

  describe('Error Handling', () => {
    it('should propagate capability errors', async () => {
      const errorCap = createCapability()
        .id('error-cap')
        .name('Error Capability')
        .description('Always throws')
        .handler(async () => {
          throw new Error('Intentional error');
        })
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [errorCap],
      });

      await expect(agent.executeCapability('error-cap', {})).rejects.toThrow(
        'Intentional error'
      );
    });

    it('should emit error telemetry on failure', async () => {
      const errorEvents: any[] = [];

      const errorCap = createCapability()
        .id('error-cap')
        .name('Error Capability')
        .description('Always throws')
        .handler(async () => {
          throw new Error('Test error');
        })
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [errorCap],
        telemetry: {
          enabled: true,
        },
      });

      agent.telemetry.on('capability:invoke:error', (e) => errorEvents.push(e));

      try {
        await agent.executeCapability('error-cap', {});
      } catch {
        // Expected
      }

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].capabilityId).toBe('error-cap');
      expect(errorEvents[0].error).toBe('Test error');
      expect(errorEvents[0].success).toBe(false);
    });

    it('should continue execution after error in telemetry hook', async () => {
      const successCap = createCapability()
        .id('success-cap')
        .name('Success Capability')
        .description('Always succeeds')
        .handler(async () => ({ success: true }))
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [successCap],
        telemetry: {
          enabled: true,
          hooks: {
            onCapabilityInvoke: () => {
              throw new Error('Hook error');
            },
          },
        },
      });

      // Should not throw despite hook error
      const result = await agent.executeCapability('success-cap', {});
      expect(result).toEqual({ success: true });
    });
  });

  describe('Agent Card Generation', () => {
    it('should generate complete agent card', () => {
      const capability = createCapability()
        .id('test-cap')
        .name('Test Capability')
        .description('A test capability')
        .pricing(0.01)
        .input({
          schema: { type: 'object' },
          description: 'Input description',
        })
        .output({
          schema: { type: 'string' },
          description: 'Output description',
        })
        .tags(['test', 'example'])
        .example('Example 1', { input: 'test' }, { output: 'result' })
        .handler(async () => 'result')
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [capability],
        url: 'https://test.agentlink.io',
        documentationUrl: 'https://docs.agentlink.io',
        provider: {
          name: 'Test Provider',
          url: 'https://testprovider.io',
        },
        a2a: {
          streaming: true,
          pushNotifications: true,
          stateTransitionHistory: false,
        },
      });

      const card = agent.getAgentCard();

      expect(card.schema_version).toBe('1.0');
      expect(card.name).toBe('IntegrationTestAgent');
      expect(card.description).toBe('Agent for integration tests');
      expect(card.url).toBe('https://test.agentlink.io');
      expect(card.version).toBe('1.0.0');
      expect(card.capabilities).toEqual({
        streaming: true,
        pushNotifications: true,
        stateTransitionHistory: false,
      });
      expect(card.skills).toHaveLength(1);
      expect(card.skills[0]).toMatchObject({
        id: 'test-cap',
        name: 'Test Capability',
        description: 'A test capability',
        pricing: 0.01,
        tags: ['test', 'example'],
      });
      expect(card.provider).toEqual({
        name: 'Test Provider',
        url: 'https://testprovider.io',
      });
      expect(card.documentationUrl).toBe('https://docs.agentlink.io');
    });

    it('should generate agent card with no capabilities', () => {
      const agent = createAgent(baseConfig);
      const card = agent.getAgentCard();

      expect(card.skills).toEqual([]);
    });
  });

  describe('Telemetry Hooks Integration', () => {
    it('should call all hooks during execution', async () => {
      const hooks = {
        onCapabilityInvoke: vi.fn(),
        onPaymentReceived: vi.fn(),
        onError: vi.fn(),
      };

      const capability = createCapability()
        .id('hook-test')
        .name('Hook Test')
        .description('Tests hooks')
        .handler(async () => ({ result: 'success' }))
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [capability],
        telemetry: {
          enabled: true,
          hooks,
        },
      });

      await agent.executeCapability('hook-test', { test: 'data' });

      expect(hooks.onCapabilityInvoke).toHaveBeenCalledTimes(1);
      expect(hooks.onCapabilityInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          capabilityId: 'hook-test',
          success: true,
        })
      );
    });

    it('should call error hook on failure', async () => {
      const hooks = {
        onCapabilityInvoke: vi.fn(),
        onError: vi.fn(),
      };

      const capability = createCapability()
        .id('error-hook-test')
        .name('Error Hook Test')
        .description('Tests error hooks')
        .handler(async () => {
          throw new Error('Hook test error');
        })
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [capability],
        telemetry: {
          enabled: true,
          hooks,
        },
      });

      try {
        await agent.executeCapability('error-hook-test', {});
      } catch {
        // Expected
      }

      expect(hooks.onError).toHaveBeenCalledTimes(1);
      expect(hooks.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Hook test error',
          context: 'capability',
        })
      );
    });
  });

  describe('x402 Integration', () => {
    it('should include x402 config in agent', () => {
      const x402Config = {
        usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        chainId: 84532,
        receiver: '0x1234567890123456789012345678901234567890',
        timeout: 300,
      };

      const agent = createAgent({
        ...baseConfig,
        x402: x402Config,
      });

      expect(agent.x402).toEqual(x402Config);
    });

    it('should expose pricing in capability info', () => {
      const capability = createCapability()
        .id('paid-cap')
        .name('Paid Capability')
        .description('Requires payment')
        .pricing(0.05)
        .handler(async () => 'premium result')
        .build();

      const agent = createAgent({
        ...baseConfig,
        capabilities: [capability],
      });

      const info = agent.listCapabilities()[0];
      expect(info.pricing).toBe(0.05);
    });
  });
});
