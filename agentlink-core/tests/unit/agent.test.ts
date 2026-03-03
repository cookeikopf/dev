/**
 * AgentLink Core - Agent Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAgent, createCapability } from '../../src/index.js';
import type { AgentConfig, Capability } from '../../src/types/index.js';

describe('createAgent', () => {
  const validConfig: AgentConfig = {
    name: 'TestAgent',
    identity: 'eip155:84532/0x1234567890123456789012345678901234567890',
    description: 'A test agent',
    capabilities: [],
  };

  describe('Validation', () => {
    it('should create an agent with valid config', () => {
      const agent = createAgent(validConfig);
      
      expect(agent.name).toBe('TestAgent');
      expect(agent.identity).toBe('eip155:84532/0x1234567890123456789012345678901234567890');
      expect(agent.description).toBe('A test agent');
      expect(agent.version).toBe('1.0.0');
    });

    it('should throw error when name is missing', () => {
      expect(() =>
        createAgent({ ...validConfig, name: '' } as any)
      ).toThrow('Agent name is required');
    });

    it('should throw error when identity is missing', () => {
      expect(() =>
        createAgent({ ...validConfig, identity: '' } as any)
      ).toThrow('Agent identity is required');
    });

    it('should throw error with invalid identity format', () => {
      expect(() =>
        createAgent({ ...validConfig, identity: 'invalid' })
      ).toThrow('Invalid identity reference');
    });

    it('should throw error for duplicate capability IDs', () => {
      const duplicateCapabilities: Capability[] = [
        createCapability()
          .id('test-cap')
          .name('Test Cap 1')
          .description('First')
          .handler(async () => 'result1')
          .build(),
        createCapability()
          .id('test-cap')
          .name('Test Cap 2')
          .description('Second')
          .handler(async () => 'result2')
          .build(),
      ];

      expect(() =>
        createAgent({ ...validConfig, capabilities: duplicateCapabilities })
      ).toThrow('Duplicate capability ID: test-cap');
    });
  });

  describe('Agent Properties', () => {
    it('should use default version when not specified', () => {
      const agent = createAgent(validConfig);
      expect(agent.version).toBe('1.0.0');
    });

    it('should use custom version when specified', () => {
      const agent = createAgent({ ...validConfig, version: '2.0.0' });
      expect(agent.version).toBe('2.0.0');
    });

    it('should use default description when not specified', () => {
      const agent = createAgent({ ...validConfig, description: undefined });
      expect(agent.description).toBe('');
    });

    it('should store provider info', () => {
      const provider = { name: 'Test Provider', url: 'https://test.com' };
      const agent = createAgent({ ...validConfig, provider });
      expect(agent.provider).toEqual(provider);
    });

    it('should store x402 config', () => {
      const x402 = {
        usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        chainId: 84532,
        receiver: '0x1234567890123456789012345678901234567890',
      };
      const agent = createAgent({ ...validConfig, x402 });
      expect(agent.x402).toEqual(x402);
    });
  });

  describe('Capability Management', () => {
    const testCapability = createCapability()
      .id('test-cap')
      .name('Test Capability')
      .description('A test capability')
      .handler(async (input: { value: number }) => ({ result: input.value * 2 }))
      .build();

    it('should get capability by ID', () => {
      const agent = createAgent({
        ...validConfig,
        capabilities: [testCapability],
      });

      const cap = agent.getCapability('test-cap');
      expect(cap).toBeDefined();
      expect(cap?.id).toBe('test-cap');
      expect(cap?.name).toBe('Test Capability');
    });

    it('should return undefined for non-existent capability', () => {
      const agent = createAgent({
        ...validConfig,
        capabilities: [testCapability],
      });

      const cap = agent.getCapability('non-existent');
      expect(cap).toBeUndefined();
    });

    it('should list all capabilities', () => {
      const cap2 = createCapability()
        .id('test-cap-2')
        .name('Test Capability 2')
        .description('Another test')
        .handler(async () => 'result')
        .build();

      const agent = createAgent({
        ...validConfig,
        capabilities: [testCapability, cap2],
      });

      const list = agent.listCapabilities();
      expect(list).toHaveLength(2);
      expect(list.map(c => c.id)).toContain('test-cap');
      expect(list.map(c => c.id)).toContain('test-cap-2');
    });

    it('should return empty list when no capabilities', () => {
      const agent = createAgent(validConfig);
      expect(agent.listCapabilities()).toEqual([]);
    });
  });

  describe('executeCapability', () => {
    const testCapability = createCapability()
      .id('multiply')
      .name('Multiply')
      .description('Multiplies a number by 2')
      .handler(async (input: { value: number }) => ({ result: input.value * 2 }))
      .build();

    it('should execute capability successfully', async () => {
      const agent = createAgent({
        ...validConfig,
        capabilities: [testCapability],
      });

      const result = await agent.executeCapability('multiply', { value: 5 });
      expect(result).toEqual({ result: 10 });
    });

    it('should throw error for non-existent capability', async () => {
      const agent = createAgent(validConfig);

      await expect(
        agent.executeCapability('non-existent', {})
      ).rejects.toThrow('Capability not found: non-existent');
    });

    it('should emit telemetry events on success', async () => {
      const events: string[] = [];
      const agent = createAgent({
        ...validConfig,
        capabilities: [testCapability],
        telemetry: {
          enabled: true,
        },
      });

      agent.telemetry.on('capability:invoke:start', () => events.push('start'));
      agent.telemetry.on('capability:invoke:success', () => events.push('success'));

      await agent.executeCapability('multiply', { value: 5 });

      expect(events).toContain('start');
      expect(events).toContain('success');
    });

    it('should emit telemetry events on error', async () => {
      const events: string[] = [];
      const errorCap = createCapability()
        .id('error-cap')
        .name('Error Cap')
        .description('Always errors')
        .handler(async () => {
          throw new Error('Test error');
        })
        .build();

      const agent = createAgent({
        ...validConfig,
        capabilities: [errorCap],
        telemetry: {
          enabled: true,
        },
      });

      agent.telemetry.on('capability:invoke:start', () => events.push('start'));
      agent.telemetry.on('capability:invoke:error', () => events.push('error'));

      await expect(agent.executeCapability('error-cap', {})).rejects.toThrow();

      expect(events).toContain('start');
      expect(events).toContain('error');
    });

    it('should pass context to handler', async () => {
      let receivedContext: any;
      const contextCap = createCapability()
        .id('context-cap')
        .name('Context Cap')
        .description('Captures context')
        .handler(async (input, context) => {
          receivedContext = context;
          return { received: true };
        })
        .build();

      const agent = createAgent({
        ...validConfig,
        capabilities: [contextCap],
      });

      await agent.executeCapability('context-cap', { test: 'data' });

      expect(receivedContext).toBeDefined();
      expect(receivedContext.agent).toBe(agent);
      expect(receivedContext.request).toBeDefined();
      expect(receivedContext.telemetry).toBeDefined();
    });
  });

  describe('getAgentCard', () => {
    it('should generate valid agent card', () => {
      const capability = createCapability()
        .id('test-cap')
        .name('Test Cap')
        .description('Test')
        .pricing(0.01)
        .handler(async () => 'result')
        .build();

      const agent = createAgent({
        ...validConfig,
        capabilities: [capability],
        url: 'https://test.agentlink.io',
        documentationUrl: 'https://docs.test.io',
        provider: { name: 'Test Provider' },
        a2a: {
          streaming: true,
          pushNotifications: false,
        },
      });

      const card = agent.getAgentCard();

      expect(card.schema_version).toBe('1.0');
      expect(card.name).toBe('TestAgent');
      expect(card.description).toBe('A test agent');
      expect(card.url).toBe('https://test.agentlink.io');
      expect(card.version).toBe('1.0.0');
      expect(card.capabilities.streaming).toBe(true);
      expect(card.capabilities.pushNotifications).toBe(false);
      expect(card.skills).toHaveLength(1);
      expect(card.skills[0].pricing).toBe(0.01);
      expect(card.provider?.name).toBe('Test Provider');
      expect(card.documentationUrl).toBe('https://docs.test.io');
    });

    it('should use defaults for A2A capabilities', () => {
      const agent = createAgent(validConfig);
      const card = agent.getAgentCard();

      expect(card.capabilities.streaming).toBe(false);
      expect(card.capabilities.pushNotifications).toBe(false);
      expect(card.capabilities.stateTransitionHistory).toBe(false);
    });
  });

  describe('Telemetry', () => {
    it('should have telemetry emitter', () => {
      const agent = createAgent(validConfig);
      expect(agent.telemetry).toBeDefined();
      expect(typeof agent.telemetry.on).toBe('function');
      expect(typeof agent.telemetry.emit).toBe('function');
    });

    it('should emit and receive custom events', () => {
      const agent = createAgent(validConfig);
      const received: unknown[] = [];

      agent.telemetry.on('custom:event', (data) => received.push(data));
      agent.telemetry.emit('custom:event', { test: 'data' });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ test: 'data' });
    });
  });
});
