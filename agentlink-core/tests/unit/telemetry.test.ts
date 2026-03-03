/**
 * AgentLink Core - Telemetry Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { createTelemetryEmitter } from '../../src/telemetry.js';
import type { TelemetryConfig, CapabilityInvokeEvent, PaymentReceivedEvent } from '../../src/types/index.js';

describe('createTelemetryEmitter', () => {
  describe('Basic Functionality', () => {
    it('should create emitter with enabled false', () => {
      const emitter = createTelemetryEmitter({ enabled: false });
      expect(emitter).toBeDefined();
      expect(typeof emitter.on).toBe('function');
      expect(typeof emitter.off).toBe('function');
      expect(typeof emitter.emit).toBe('function');
    });

    it('should create emitter with enabled true', () => {
      const emitter = createTelemetryEmitter({ enabled: true });
      expect(emitter).toBeDefined();
    });

    it('should create emitter without config', () => {
      const emitter = createTelemetryEmitter();
      expect(emitter).toBeDefined();
    });
  });

  describe('Event Subscription', () => {
    it('should receive emitted events', () => {
      const emitter = createTelemetryEmitter();
      const handler = vi.fn();

      emitter.on('test:event', handler);
      emitter.emit('test:event', { data: 'test' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should support multiple handlers for same event', () => {
      const emitter = createTelemetryEmitter();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('test:event', handler1);
      emitter.on('test:event', handler2);
      emitter.emit('test:event', { data: 'test' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should support multiple events', () => {
      const emitter = createTelemetryEmitter();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('event1', handler1);
      emitter.on('event2', handler2);
      emitter.emit('event1', { data: 1 });
      emitter.emit('event2', { data: 2 });

      expect(handler1).toHaveBeenCalledWith({ data: 1 });
      expect(handler2).toHaveBeenCalledWith({ data: 2 });
    });

    it('should unsubscribe with off', () => {
      const emitter = createTelemetryEmitter();
      const handler = vi.fn();

      emitter.on('test:event', handler);
      emitter.off('test:event', handler);
      emitter.emit('test:event', { data: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle unsubscribing non-existent handler', () => {
      const emitter = createTelemetryEmitter();
      const handler = vi.fn();

      // Should not throw
      expect(() => emitter.off('test:event', handler)).not.toThrow();
    });

    it('should not receive events after unsubscribe', () => {
      const emitter = createTelemetryEmitter();
      const handler = vi.fn();

      emitter.on('test:event', handler);
      emitter.emit('test:event', { data: 1 });
      emitter.off('test:event', handler);
      emitter.emit('test:event', { data: 2 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ data: 1 });
    });
  });

  describe('Wildcard Events', () => {
    it('should receive all events with wildcard', () => {
      const emitter = createTelemetryEmitter();
      const wildcardHandler = vi.fn();

      emitter.on('*', wildcardHandler);
      emitter.emit('event1', { data: 1 });
      emitter.emit('event2', { data: 2 });

      expect(wildcardHandler).toHaveBeenCalledTimes(2);
      expect(wildcardHandler).toHaveBeenNthCalledWith(1, { event: 'event1', data: { data: 1 } });
      expect(wildcardHandler).toHaveBeenNthCalledWith(2, { event: 'event2', data: { data: 2 } });
    });

    it('should work alongside specific handlers', () => {
      const emitter = createTelemetryEmitter();
      const specificHandler = vi.fn();
      const wildcardHandler = vi.fn();

      emitter.on('specific:event', specificHandler);
      emitter.on('*', wildcardHandler);
      emitter.emit('specific:event', { data: 'test' });

      expect(specificHandler).toHaveBeenCalledTimes(1);
      expect(wildcardHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should continue after handler error', () => {
      const emitter = createTelemetryEmitter();
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = vi.fn();

      emitter.on('test:event', errorHandler);
      emitter.on('test:event', successHandler);

      // Should not throw
      expect(() => emitter.emit('test:event', {})).not.toThrow();

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });

    it('should log handler errors to console', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const emitter = createTelemetryEmitter();

      emitter.on('test:event', () => {
        throw new Error('Test error');
      });
      emitter.emit('test:event', {});

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in telemetry handler for test:event:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should log wildcard handler errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const emitter = createTelemetryEmitter();

      emitter.on('*', () => {
        throw new Error('Wildcard error');
      });
      emitter.emit('test:event', {});

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in wildcard telemetry handler:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Hooks Integration', () => {
    it('should call onCapabilityInvoke hook on success', () => {
      const onCapabilityInvoke = vi.fn();
      const config: TelemetryConfig = {
        enabled: true,
        hooks: {
          onCapabilityInvoke,
        },
      };

      const emitter = createTelemetryEmitter(config);
      const event: CapabilityInvokeEvent = {
        capabilityId: 'test-cap',
        requestId: 'req-123',
        input: { test: true },
        timestamp: new Date(),
        success: true,
      };

      emitter.emit('capability:invoke:success', event);

      expect(onCapabilityInvoke).toHaveBeenCalledWith(event);
    });

    it('should call onCapabilityInvoke hook on error', () => {
      const onCapabilityInvoke = vi.fn();
      const config: TelemetryConfig = {
        enabled: true,
        hooks: {
          onCapabilityInvoke,
        },
      };

      const emitter = createTelemetryEmitter(config);
      const event: CapabilityInvokeEvent = {
        capabilityId: 'test-cap',
        requestId: 'req-123',
        input: { test: true },
        timestamp: new Date(),
        success: false,
        error: 'Test error',
      };

      emitter.emit('capability:invoke:error', event);

      expect(onCapabilityInvoke).toHaveBeenCalledWith(event);
    });

    it('should call onPaymentReceived hook', () => {
      const onPaymentReceived = vi.fn();
      const config: TelemetryConfig = {
        enabled: true,
        hooks: {
          onPaymentReceived,
        },
      };

      const emitter = createTelemetryEmitter(config);
      const event: PaymentReceivedEvent = {
        amount: 1000000,
        txHash: '0xabc',
        payer: '0x123',
        capabilityId: 'test-cap',
        timestamp: new Date(),
      };

      emitter.emit('payment:received', event);

      expect(onPaymentReceived).toHaveBeenCalledWith(event);
    });

    it('should call onError hook', () => {
      const onError = vi.fn();
      const config: TelemetryConfig = {
        enabled: true,
        hooks: {
          onError,
        },
      };

      const emitter = createTelemetryEmitter(config);

      emitter.emit('capability:invoke:error', {
        error: 'Test error message',
        timestamp: new Date(),
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error message',
          context: 'capability',
        })
      );
    });

    it('should not call hooks when disabled', () => {
      const onCapabilityInvoke = vi.fn();
      const config: TelemetryConfig = {
        enabled: false,
        hooks: {
          onCapabilityInvoke,
        },
      };

      const emitter = createTelemetryEmitter(config);
      emitter.emit('capability:invoke:success', {});

      expect(onCapabilityInvoke).not.toHaveBeenCalled();
    });

    it('should not call hooks when hooks not provided', () => {
      const config: TelemetryConfig = {
        enabled: true,
        hooks: {},
      };

      const emitter = createTelemetryEmitter(config);
      // Should not throw
      expect(() => emitter.emit('capability:invoke:success', {})).not.toThrow();
    });

    it('should support async hooks', async () => {
      const asyncHook = vi.fn().mockResolvedValue(undefined);
      const config: TelemetryConfig = {
        enabled: true,
        hooks: {
          onCapabilityInvoke: asyncHook,
        },
      };

      const emitter = createTelemetryEmitter(config);
      const event: CapabilityInvokeEvent = {
        capabilityId: 'test-cap',
        requestId: 'req-123',
        input: {},
        timestamp: new Date(),
        success: true,
      };

      emitter.emit('capability:invoke:success', event);

      // Wait for async hook
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(asyncHook).toHaveBeenCalledWith(event);
    });
  });

  describe('Event Data Types', () => {
    it('should handle string data', () => {
      const emitter = createTelemetryEmitter();
      const handler = vi.fn();

      emitter.on('test', handler);
      emitter.emit('test', 'string data');

      expect(handler).toHaveBeenCalledWith('string data');
    });

    it('should handle number data', () => {
      const emitter = createTelemetryEmitter();
      const handler = vi.fn();

      emitter.on('test', handler);
      emitter.emit('test', 42);

      expect(handler).toHaveBeenCalledWith(42);
    });

    it('should handle null data', () => {
      const emitter = createTelemetryEmitter();
      const handler = vi.fn();

      emitter.on('test', handler);
      emitter.emit('test', null);

      expect(handler).toHaveBeenCalledWith(null);
    });

    it('should handle undefined data', () => {
      const emitter = createTelemetryEmitter();
      const handler = vi.fn();

      emitter.on('test', handler);
      emitter.emit('test', undefined);

      expect(handler).toHaveBeenCalledWith(undefined);
    });

    it('should handle complex object data', () => {
      const emitter = createTelemetryEmitter();
      const handler = vi.fn();
      const complexData = {
        nested: {
          array: [1, 2, 3],
          object: { a: 1 },
        },
        date: new Date(),
        func: () => {},
      };

      emitter.on('test', handler);
      emitter.emit('test', complexData);

      expect(handler).toHaveBeenCalledWith(complexData);
    });
  });
});
