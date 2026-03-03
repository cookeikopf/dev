/**
 * AgentLink Core - Telemetry System
 */

import type {
  TelemetryConfig,
  TelemetryEmitter,
  TelemetryHooks,
  CapabilityInvokeEvent,
  PaymentReceivedEvent,
  ErrorEvent,
} from './types/index.js';

type EventHandler = (data: unknown) => void;

class EventEmitter implements TelemetryEmitter {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
    }
  }

  emit(event: string, data: unknown): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in telemetry handler for ${event}:`, error);
        }
      }
    }

    // Also emit to wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler({ event, data });
        } catch (error) {
          console.error(`Error in wildcard telemetry handler:`, error);
        }
      }
    }
  }
}

export function createTelemetryEmitter(
  config?: TelemetryConfig
): TelemetryEmitter {
  const emitter = new EventEmitter();

  if (config?.enabled && config.hooks) {
    setupHooks(emitter, config.hooks);
  }

  return emitter;
}

function setupHooks(emitter: EventEmitter, hooks: TelemetryHooks): void {
  if (hooks.onCapabilityInvoke) {
    emitter.on('capability:invoke:success', (data) => {
      const event = data as CapabilityInvokeEvent;
      hooks.onCapabilityInvoke!(event);
    });
    emitter.on('capability:invoke:error', (data) => {
      const event = data as CapabilityInvokeEvent;
      hooks.onCapabilityInvoke!(event);
    });
  }

  if (hooks.onPaymentReceived) {
    emitter.on('payment:received', (data) => {
      const event = data as PaymentReceivedEvent;
      hooks.onPaymentReceived!(event);
    });
  }

  if (hooks.onError) {
    emitter.on('capability:invoke:error', (data) => {
      const event = data as { error: string; timestamp: Date };
      hooks.onError!({
        message: event.error,
        context: 'capability',
        timestamp: event.timestamp,
      });
    });
  }
}
