/**
 * @fileoverview Telemetry system for AgentLink SDK
 * @module @agentlink/core/telemetry
 */

import type {
  TelemetryEmitter,
  TelemetryConfig,
  TelemetryHooks,
  CapabilityInvokeEvent,
  PaymentReceivedEvent,
  ErrorEvent,
} from '../types/index.js';
import { generateId, getTimestamp } from '../utils/index.js';

/**
 * Event handler type
 */
type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * Default telemetry configuration
 */
const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: true,
};

/**
 * Simple event emitter implementation for telemetry
 */
class EventEmitter implements TelemetryEmitter {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Emit an event
   * @param event Event name
   * @param data Event data
   */
  emit<T = unknown>(event: string, data: T): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        void handler(data);
      } catch (error) {
        console.error(`Error in telemetry handler for event "${event}":`, error);
      }
    }
  }

  /**
   * Subscribe to an event
   * @param event Event name
   * @param handler Event handler
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param handler Event handler
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Remove all handlers for an event
   * @param event Event name
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}

/**
 * Telemetry manager for collecting and emitting events
 */
export class TelemetryManager implements TelemetryEmitter {
  private config: TelemetryConfig;
  private emitter: EventEmitter;
  private hooks: TelemetryHooks;

  /**
   * Create a new telemetry manager
   * @param config Telemetry configuration
   */
  constructor(config: TelemetryConfig = DEFAULT_TELEMETRY_CONFIG) {
    this.config = { ...DEFAULT_TELEMETRY_CONFIG, ...config };
    this.emitter = new EventEmitter();
    this.hooks = this.config.hooks ?? {};
  }

  /**
   * Check if telemetry is enabled
   */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Emit an event
   * @param event Event name
   * @param data Event data
   */
  emit<T = unknown>(event: string, data: T): void {
    if (!this.enabled) return;
    this.emitter.emit(event, data);
  }

  /**
   * Subscribe to an event
   * @param event Event name
   * @param handler Event handler
   */
  on<T = unknown>(event: string, handler: (data: T) => void): void {
    this.emitter.on(event, handler as EventHandler);
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param handler Event handler
   */
  off<T = unknown>(event: string, handler: (data: T) => void): void {
    this.emitter.off(event, handler as EventHandler);
  }

  /**
   * Record a capability invocation event
   * @param event Capability invoke event data
   */
  async recordCapabilityInvoke(event: Omit<CapabilityInvokeEvent, 'timestamp'>): Promise<void> {
    if (!this.enabled) return;

    const fullEvent: CapabilityInvokeEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.emit('capability:invoke', fullEvent);

    if (this.hooks.onCapabilityInvoke) {
      try {
        await this.hooks.onCapabilityInvoke(fullEvent);
      } catch (error) {
        console.error('Error in onCapabilityInvoke hook:', error);
      }
    }
  }

  /**
   * Record a payment received event
   * @param event Payment received event data
   */
  async recordPaymentReceived(event: Omit<PaymentReceivedEvent, 'timestamp'>): Promise<void> {
    if (!this.enabled) return;

    const fullEvent: PaymentReceivedEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.emit('payment:received', fullEvent);

    if (this.hooks.onPaymentReceived) {
      try {
        await this.hooks.onPaymentReceived(fullEvent);
      } catch (error) {
        console.error('Error in onPaymentReceived hook:', error);
      }
    }
  }

  /**
   * Record an error event
   * @param event Error event data
   */
  async recordError(event: Omit<ErrorEvent, 'timestamp'>): Promise<void> {
    if (!this.enabled) return;

    const fullEvent: ErrorEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.emit('error', fullEvent);

    if (this.hooks.onError) {
      try {
        await this.hooks.onError(fullEvent);
      } catch (error) {
        console.error('Error in onError hook:', error);
      }
    }
  }

  /**
   * Create a capability invoke event builder
   * @returns Event builder
   */
  createCapabilityEvent(): CapabilityEventBuilder {
    return new CapabilityEventBuilder(this);
  }

  /**
   * Create a payment received event builder
   * @returns Event builder
   */
  createPaymentEvent(): PaymentEventBuilder {
    return new PaymentEventBuilder(this);
  }

  /**
   * Create an error event builder
   * @returns Event builder
   */
  createErrorEvent(): ErrorEventBuilder {
    return new ErrorEventBuilder(this);
  }
}

/**
 * Builder for capability invoke events
 */
class CapabilityEventBuilder {
  private telemetry: TelemetryManager;
  private event: Partial<CapabilityInvokeEvent> = {};

  constructor(telemetry: TelemetryManager) {
    this.telemetry = telemetry;
    this.event.requestId = generateId();
  }

  requestId(id: string): this {
    this.event.requestId = id;
    return this;
  }

  capabilityId(id: string): this {
    this.event.capabilityId = id;
    return this;
  }

  agentName(name: string): this {
    this.event.agentName = name;
    return this;
  }

  input(input: unknown): this {
    this.event.input = input;
    return this;
  }

  success(success: boolean): this {
    this.event.success = success;
    return this;
  }

  error(error: string): this {
    this.event.error = error;
    return this;
  }

  duration(duration: number): this {
    this.event.duration = duration;
    return this;
  }

  async send(): Promise<void> {
    if (!this.event.requestId || !this.event.capabilityId || !this.event.agentName) {
      throw new Error('Missing required fields for capability event');
    }
    await this.telemetry.recordCapabilityInvoke(this.event as Omit<CapabilityInvokeEvent, 'timestamp'>);
  }
}

/**
 * Builder for payment received events
 */
class PaymentEventBuilder {
  private telemetry: TelemetryManager;
  private event: Partial<PaymentReceivedEvent> = {};

  constructor(telemetry: TelemetryManager) {
    this.telemetry = telemetry;
  }

  txHash(hash: string): this {
    this.event.txHash = hash;
    return this;
  }

  amount(amount: number): this {
    this.event.amount = amount;
    return this;
  }

  payer(payer: string): this {
    this.event.payer = payer;
    return this;
  }

  capabilityId(id: string): this {
    this.event.capabilityId = id;
    return this;
  }

  async send(): Promise<void> {
    if (!this.event.txHash || !this.event.capabilityId) {
      throw new Error('Missing required fields for payment event');
    }
    await this.telemetry.recordPaymentReceived(this.event as Omit<PaymentReceivedEvent, 'timestamp'>);
  }
}

/**
 * Builder for error events
 */
class ErrorEventBuilder {
  private telemetry: TelemetryManager;
  private event: Partial<ErrorEvent> = {};

  constructor(telemetry: TelemetryManager) {
    this.telemetry = telemetry;
    this.event.requestId = generateId();
  }

  requestId(id: string): this {
    this.event.requestId = id;
    return this;
  }

  message(message: string): this {
    this.event.message = message;
    return this;
  }

  stack(stack: string): this {
    this.event.stack = stack;
    return this;
  }

  capabilityId(id: string): this {
    this.event.capabilityId = id;
    return this;
  }

  async send(): Promise<void> {
    if (!this.event.requestId || !this.event.message) {
      throw new Error('Missing required fields for error event');
    }
    await this.telemetry.recordError(this.event as Omit<ErrorEvent, 'timestamp'>);
  }
}

/**
 * Create a new telemetry manager
 * @param config Telemetry configuration
 * @returns Telemetry manager instance
 */
export function createTelemetry(config?: TelemetryConfig): TelemetryManager {
  return new TelemetryManager(config);
}
