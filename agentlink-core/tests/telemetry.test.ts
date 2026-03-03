import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetryManager, createTelemetry } from '../src/telemetry/index.js';
import type { TelemetryConfig, CapabilityInvokeEvent } from '../src/types/index.js';

describe('Telemetry', () => {
  describe('TelemetryManager', () => {
    let telemetry: TelemetryManager;

    beforeEach(() => {
      telemetry = new TelemetryManager({ enabled: true });
    });

    describe('constructor', () => {
      it('should create with default config', () => {
        const tm = new TelemetryManager();
        expect(tm.enabled).toBe(true);
      });

      it('should respect enabled config', () => {
        const tm = new TelemetryManager({ enabled: false });
        expect(tm.enabled).toBe(false);
      });
    });

    describe('emit/on/off', () => {
      it('should emit and receive events', () => {
        const handler = vi.fn();
        telemetry.on('test', handler);
        telemetry.emit('test', { data: 'value' });
        expect(handler).toHaveBeenCalledWith({ data: 'value' });
      });

      it('should support multiple handlers', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        telemetry.on('test', handler1);
        telemetry.on('test', handler2);
        telemetry.emit('test', { data: 'value' });
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
      });

      it('should remove handler with off', () => {
        const handler = vi.fn();
        telemetry.on('test', handler);
        telemetry.off('test', handler);
        telemetry.emit('test', { data: 'value' });
        expect(handler).not.toHaveBeenCalled();
      });

      it('should not emit when disabled', () => {
        const disabledTelemetry = new TelemetryManager({ enabled: false });
        const handler = vi.fn();
        disabledTelemetry.on('test', handler);
        disabledTelemetry.emit('test', { data: 'value' });
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('recordCapabilityInvoke', () => {
      it('should record capability invoke event', async () => {
        const handler = vi.fn();
        telemetry.on('capability:invoke', handler);

        await telemetry.recordCapabilityInvoke({
          requestId: 'req-1',
          capabilityId: 'cap-1',
          agentName: 'TestAgent',
          success: true,
          duration: 100,
        });

        expect(handler).toHaveBeenCalled();
        const event = handler.mock.calls[0]![0] as CapabilityInvokeEvent;
        expect(event.requestId).toBe('req-1');
        expect(event.capabilityId).toBe('cap-1');
        expect(event.agentName).toBe('TestAgent');
        expect(event.success).toBe(true);
        expect(event.duration).toBe(100);
        expect(event.timestamp).toBeInstanceOf(Date);
      });

      it('should call onCapabilityInvoke hook', async () => {
        const hook = vi.fn();
        const tm = new TelemetryManager({
          enabled: true,
          hooks: { onCapabilityInvoke: hook },
        });

        await tm.recordCapabilityInvoke({
          requestId: 'req-1',
          capabilityId: 'cap-1',
          agentName: 'TestAgent',
          success: true,
          duration: 100,
        });

        expect(hook).toHaveBeenCalled();
      });

      it('should not record when disabled', async () => {
        const disabledTelemetry = new TelemetryManager({ enabled: false });
        const handler = vi.fn();
        disabledTelemetry.on('capability:invoke', handler);

        await disabledTelemetry.recordCapabilityInvoke({
          requestId: 'req-1',
          capabilityId: 'cap-1',
          agentName: 'TestAgent',
          success: true,
          duration: 100,
        });

        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('recordPaymentReceived', () => {
      it('should record payment received event', async () => {
        const handler = vi.fn();
        telemetry.on('payment:received', handler);

        await telemetry.recordPaymentReceived({
          txHash: '0xabc',
          amount: 1000000,
          payer: '0x123',
          capabilityId: 'cap-1',
        });

        expect(handler).toHaveBeenCalled();
        const event = handler.mock.calls[0]![0];
        expect(event.txHash).toBe('0xabc');
        expect(event.amount).toBe(1000000);
        expect(event.payer).toBe('0x123');
        expect(event.timestamp).toBeInstanceOf(Date);
      });

      it('should call onPaymentReceived hook', async () => {
        const hook = vi.fn();
        const tm = new TelemetryManager({
          enabled: true,
          hooks: { onPaymentReceived: hook },
        });

        await tm.recordPaymentReceived({
          txHash: '0xabc',
          amount: 1000000,
          payer: '0x123',
          capabilityId: 'cap-1',
        });

        expect(hook).toHaveBeenCalled();
      });
    });

    describe('recordError', () => {
      it('should record error event', async () => {
        const handler = vi.fn();
        telemetry.on('error', handler);

        await telemetry.recordError({
          requestId: 'req-1',
          message: 'Something went wrong',
          capabilityId: 'cap-1',
        });

        expect(handler).toHaveBeenCalled();
        const event = handler.mock.calls[0]![0];
        expect(event.requestId).toBe('req-1');
        expect(event.message).toBe('Something went wrong');
        expect(event.timestamp).toBeInstanceOf(Date);
      });

      it('should call onError hook', async () => {
        const hook = vi.fn();
        const tm = new TelemetryManager({
          enabled: true,
          hooks: { onError: hook },
        });

        await tm.recordError({
          requestId: 'req-1',
          message: 'Error',
        });

        expect(hook).toHaveBeenCalled();
      });
    });

    describe('event builders', () => {
      it('should create capability event with builder', async () => {
        const handler = vi.fn();
        telemetry.on('capability:invoke', handler);

        await telemetry
          .createCapabilityEvent()
          .requestId('req-1')
          .capabilityId('cap-1')
          .agentName('TestAgent')
          .success(true)
          .duration(100)
          .send();

        expect(handler).toHaveBeenCalled();
      });

      it('should create payment event with builder', async () => {
        const handler = vi.fn();
        telemetry.on('payment:received', handler);

        await telemetry
          .createPaymentEvent()
          .txHash('0xabc')
          .amount(1000000)
          .payer('0x123')
          .capabilityId('cap-1')
          .send();

        expect(handler).toHaveBeenCalled();
      });

      it('should create error event with builder', async () => {
        const handler = vi.fn();
        telemetry.on('error', handler);

        await telemetry
          .createErrorEvent()
          .requestId('req-1')
          .message('Error message')
          .capabilityId('cap-1')
          .send();

        expect(handler).toHaveBeenCalled();
      });

      it('should throw on missing required fields', async () => {
        await expect(
          telemetry.createCapabilityEvent().send()
        ).rejects.toThrow('Missing required fields');
      });
    });
  });

  describe('createTelemetry', () => {
    it('should create telemetry manager', () => {
      const config: TelemetryConfig = { enabled: true };
      const tm = createTelemetry(config);
      expect(tm).toBeInstanceOf(TelemetryManager);
      expect(tm.enabled).toBe(true);
    });
  });
});
