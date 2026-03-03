/**
 * AgentLink Core - Capability Builder Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { createCapability, CapabilityBuilder } from '../../src/index.js';

describe('createCapability', () => {
  describe('Builder Pattern', () => {
    it('should build capability with all properties', () => {
      const handler = async (input: { name: string }) => `Hello, ${input.name}!`;
      
      const capability = createCapability()
        .id('greet')
        .name('Greeting')
        .description('Greets a person by name')
        .pricing(0.001)
        .input({
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
          description: 'The name to greet',
          examples: [{ name: 'World' }],
        })
        .output({
          schema: {
            type: 'string',
          },
          description: 'The greeting message',
        })
        .handler(handler)
        .tags(['greeting', 'hello'])
        .example('Simple greeting', { name: 'Alice' }, 'Hello, Alice!')
        .build();

      expect(capability.id).toBe('greet');
      expect(capability.name).toBe('Greeting');
      expect(capability.description).toBe('Greets a person by name');
      expect(capability.pricing).toBe(0.001);
      expect(capability.input?.schema.type).toBe('object');
      expect(capability.output?.schema.type).toBe('string');
      expect(capability.handler).toBe(handler);
      expect(capability.tags).toEqual(['greeting', 'hello']);
      expect(capability.examples).toHaveLength(1);
    });

    it('should build capability with minimal properties', () => {
      const capability = createCapability()
        .id('simple')
        .name('Simple')
        .description('A simple capability')
        .handler(async () => 'result')
        .build();

      expect(capability.id).toBe('simple');
      expect(capability.name).toBe('Simple');
      expect(capability.description).toBe('A simple capability');
      expect(capability.pricing).toBeUndefined();
      expect(capability.input).toBeUndefined();
      expect(capability.output).toBeUndefined();
      expect(capability.tags).toBeUndefined();
      expect(capability.examples).toBeUndefined();
    });
  });

  describe('Validation', () => {
    it('should throw error when ID is missing', () => {
      expect(() =>
        createCapability()
          .name('Test')
          .description('Test')
          .handler(async () => 'result')
          .build()
      ).toThrow('Capability ID is required');
    });

    it('should throw error when name is missing', () => {
      expect(() =>
        createCapability()
          .id('test')
          .description('Test')
          .handler(async () => 'result')
          .build()
      ).toThrow('Capability name is required');
    });

    it('should throw error when description is missing', () => {
      expect(() =>
        createCapability()
          .id('test')
          .name('Test')
          .handler(async () => 'result')
          .build()
      ).toThrow('Capability description is required');
    });

    it('should throw error when handler is missing', () => {
      expect(() =>
        createCapability()
          .id('test')
          .name('Test')
          .description('Test')
          .build()
      ).toThrow('Capability handler is required');
    });

    it('should throw error for invalid ID format', () => {
      expect(() =>
        createCapability()
          .id('invalid id with spaces')
          .name('Test')
          .description('Test')
          .handler(async () => 'result')
          .build()
      ).toThrow('Invalid capability ID');
    });

    it('should throw error for negative pricing', () => {
      expect(() =>
        createCapability()
          .id('test')
          .name('Test')
          .description('Test')
          .pricing(-1)
          .handler(async () => 'result')
          .build()
      ).toThrow('Pricing cannot be negative');
    });
  });

  describe('ID Format Validation', () => {
    it('should accept alphanumeric IDs', () => {
      const cap = createCapability()
        .id('test123')
        .name('Test')
        .description('Test')
        .handler(async () => 'result')
        .build();
      expect(cap.id).toBe('test123');
    });

    it('should accept IDs with hyphens', () => {
      const cap = createCapability()
        .id('test-cap')
        .name('Test')
        .description('Test')
        .handler(async () => 'result')
        .build();
      expect(cap.id).toBe('test-cap');
    });

    it('should accept IDs with underscores', () => {
      const cap = createCapability()
        .id('test_cap')
        .name('Test')
        .description('Test')
        .handler(async () => 'result')
        .build();
      expect(cap.id).toBe('test_cap');
    });

    it('should accept mixed case IDs', () => {
      const cap = createCapability()
        .id('TestCap_123')
        .name('Test')
        .description('Test')
        .handler(async () => 'result')
        .build();
      expect(cap.id).toBe('TestCap_123');
    });

    it('should reject IDs with spaces', () => {
      expect(() =>
        createCapability()
          .id('test cap')
          .name('Test')
          .description('Test')
          .handler(async () => 'result')
          .build()
      ).toThrow('Invalid capability ID');
    });

    it('should reject IDs with special characters', () => {
      expect(() =>
        createCapability()
          .id('test@cap')
          .name('Test')
          .description('Test')
          .handler(async () => 'result')
          .build()
      ).toThrow('Invalid capability ID');
    });

    it('should reject IDs with slashes', () => {
      expect(() =>
        createCapability()
          .id('test/cap')
          .name('Test')
          .description('Test')
          .handler(async () => 'result')
          .build()
      ).toThrow('Invalid capability ID');
    });
  });

  describe('Chaining', () => {
    it('should support method chaining', () => {
      const builder = createCapability();
      
      expect(builder.id('test')).toBe(builder);
      expect(builder.name('Test')).toBe(builder);
      expect(builder.description('Test')).toBe(builder);
      expect(builder.pricing(0.01)).toBe(builder);
      expect(builder.handler(async () => 'result')).toBe(builder);
    });

    it('should build after multiple chains', () => {
      const cap = createCapability()
        .id('chained')
        .name('Chained')
        .description('A chained capability')
        .pricing(0.001)
        .input({ schema: { type: 'object' } })
        .output({ schema: { type: 'string' } })
        .tags(['tag1', 'tag2'])
        .example('Ex1', { input: 1 })
        .example('Ex2', { input: 2 }, { output: 2 })
        .handler(async (input) => input)
        .build();

      expect(cap.id).toBe('chained');
      expect(cap.pricing).toBe(0.001);
      expect(cap.tags).toHaveLength(2);
      expect(cap.examples).toHaveLength(2);
    });
  });

  describe('Handler Execution', () => {
    it('should execute async handler', async () => {
      const cap = createCapability()
        .id('async')
        .name('Async')
        .description('Async handler')
        .handler(async (input: { delay: number }) => {
          await new Promise(resolve => setTimeout(resolve, input.delay));
          return { delayed: true };
        })
        .build();

      const start = Date.now();
      const result = await cap.handler({ delay: 10 }, {} as any);
      const elapsed = Date.now() - start;

      expect(result).toEqual({ delayed: true });
      expect(elapsed).toBeGreaterThanOrEqual(10);
    });

    it('should handle handler errors', async () => {
      const cap = createCapability()
        .id('error')
        .name('Error')
        .description('Error handler')
        .handler(async () => {
          throw new Error('Handler error');
        })
        .build();

      await expect(cap.handler({}, {} as any)).rejects.toThrow('Handler error');
    });
  });
});

describe('CapabilityBuilder', () => {
  it('should be instantiable', () => {
    const builder = new CapabilityBuilder();
    expect(builder).toBeInstanceOf(CapabilityBuilder);
  });

  it('should work with new keyword', () => {
    const cap = new CapabilityBuilder()
      .id('new-builder')
      .name('New Builder')
      .description('Using new keyword')
      .handler(async () => 'result')
      .build();

    expect(cap.id).toBe('new-builder');
  });
});
