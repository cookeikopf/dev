/**
 * A2A Protocol - Server-Sent Events (SSE) Streaming
 * 
 * This module provides SSE streaming support for A2A protocol task updates
 * following the Agent2Agent Protocol Specification.
 * 
 * @module a2a/sse-stream
 * @version 1.0.0
 */

import {
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  TaskState,
  StreamResponse,
  Message,
} from './schemas.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * SSE event types for A2A streaming
 */
export type SSEEventType = 'status' | 'artifact' | 'message' | 'error' | 'close';

/**
 * SSE event structure
 */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  id?: string;
  retry?: number;
}

/**
 * SSE stream options
 */
export interface SSEStreamOptions {
  /** Retry interval in milliseconds */
  retryInterval?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom event ID generator */
  generateEventId?: () => string;
}

/**
 * SSE stream controller interface
 */
export interface SSEStreamController {
  /** Send a status update */
  sendStatusUpdate(event: TaskStatusUpdateEvent): void;
  /** Send an artifact update */
  sendArtifactUpdate(event: TaskArtifactUpdateEvent): void;
  /** Send a message */
  sendMessage(message: Message): void;
  /** Send an error */
  sendError(error: { code: number; message: string; data?: unknown }): void;
  /** Close the stream */
  close(): void;
  /** Check if the stream is closed */
  isClosed(): boolean;
}

/**
 * Callback functions for SSE stream events
 */
export interface SSEStreamCallbacks {
  /** Called when a status update is sent */
  onStatusUpdate?: (event: TaskStatusUpdateEvent) => void;
  /** Called when an artifact update is sent */
  onArtifactUpdate?: (event: TaskArtifactUpdateEvent) => void;
  /** Called when the stream is closed */
  onClose?: () => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

// ============================================================================
// SSE Stream Formatter
// ============================================================================

/**
 * Format an event for SSE transmission
 */
export function formatSSEEvent(event: SSEEvent): string {
  const lines: string[] = [];

  if (event.id) {
    lines.push(`id: ${event.id}`);
  }

  if (event.retry !== undefined) {
    lines.push(`retry: ${event.retry}`);
  }

  // Format data lines (JSON stringify and handle multiline)
  const data = JSON.stringify(event.data);
  const dataLines = data.split('\n');
  for (const line of dataLines) {
    lines.push(`data: ${line}`);
  }

  // Empty line to end the event
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

/**
 * Create a status update SSE event
 */
export function createStatusUpdateEvent(
  taskId: string,
  status: TaskStatusUpdateEvent['status'],
  final?: boolean,
  eventId?: string
): SSEEvent {
  return {
    type: 'status',
    id: eventId,
    data: {
      type: 'status',
      taskId,
      status,
      final,
      timestamp: new Date().toISOString(),
    } as StreamResponse,
  };
}

/**
 * Create an artifact update SSE event
 */
export function createArtifactUpdateEvent(
  taskId: string,
  artifact: TaskArtifactUpdateEvent['artifact'],
  eventId?: string
): SSEEvent {
  return {
    type: 'artifact',
    id: eventId,
    data: {
      type: 'artifact',
      taskId,
      artifact,
      timestamp: new Date().toISOString(),
    } as StreamResponse,
  };
}

/**
 * Create a message SSE event
 */
export function createMessageEvent(
  message: Message,
  eventId?: string
): SSEEvent {
  return {
    type: 'message',
    id: eventId,
    data: {
      type: 'message',
      message,
      timestamp: new Date().toISOString(),
    } as StreamResponse,
  };
}

/**
 * Create an error SSE event
 */
export function createErrorEvent(
  code: number,
  message: string,
  data?: unknown,
  eventId?: string
): SSEEvent {
  return {
    type: 'error',
    id: eventId,
    data: {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        ...(data !== undefined && { data }),
      },
    },
  };
}

/**
 * Create a close SSE event
 */
export function createCloseEvent(eventId?: string): SSEEvent {
  return {
    type: 'close',
    id: eventId,
    data: { type: 'close' },
  };
}

// ============================================================================
// SSE Stream Controller Implementation
// ============================================================================

/**
 * Create an SSE stream controller
 */
export function createSSEStreamController(
  write: (data: string) => void,
  options: SSEStreamOptions = {}
): SSEStreamController {
  const { retryInterval = 3000, debug = false, generateEventId = () => `evt-${Date.now()}` } = options;
  let closed = false;
  let eventCounter = 0;

  const getNextEventId = (): string => {
    return `${generateEventId()}-${++eventCounter}`;
  };

  const log = (...args: unknown[]): void => {
    if (debug) {
      console.log('[A2A SSE]', ...args);
    }
  };

  // Send initial retry header
  write(`retry: ${retryInterval}\n\n`);

  return {
    sendStatusUpdate(event: TaskStatusUpdateEvent): void {
      if (closed) {
        log('Attempted to send status update on closed stream');
        return;
      }

      const sseEvent = createStatusUpdateEvent(
        event.taskId,
        event.status,
        event.final,
        getNextEventId()
      );
      
      log('Sending status update:', event.status.state);
      write(formatSSEEvent(sseEvent));
    },

    sendArtifactUpdate(event: TaskArtifactUpdateEvent): void {
      if (closed) {
        log('Attempted to send artifact update on closed stream');
        return;
      }

      const sseEvent = createArtifactUpdateEvent(
        event.taskId,
        event.artifact,
        getNextEventId()
      );
      
      log('Sending artifact update:', event.artifact.artifactId);
      write(formatSSEEvent(sseEvent));
    },

    sendMessage(message: Message): void {
      if (closed) {
        log('Attempted to send message on closed stream');
        return;
      }

      const sseEvent = createMessageEvent(message, getNextEventId());
      log('Sending message:', message.messageId);
      write(formatSSEEvent(sseEvent));
    },

    sendError(error: { code: number; message: string; data?: unknown }): void {
      if (closed) {
        log('Attempted to send error on closed stream');
        return;
      }

      const sseEvent = createErrorEvent(
        error.code,
        error.message,
        error.data,
        getNextEventId()
      );
      
      log('Sending error:', error.message);
      write(formatSSEEvent(sseEvent));
    },

    close(): void {
      if (closed) {
        return;
      }

      closed = true;
      log('Closing stream');
      
      const sseEvent = createCloseEvent(getNextEventId());
      write(formatSSEEvent(sseEvent));
    },

    isClosed(): boolean {
      return closed;
    },
  };
}

// ============================================================================
// Task Stream Manager
// ============================================================================

/**
 * Manager for task-specific SSE streams
 */
export class TaskStreamManager {
  private streams = new Map<string, Set<SSEStreamController>>();
  private options: SSEStreamOptions;

  constructor(options: SSEStreamOptions = {}) {
    this.options = options;
  }

  /**
   * Register a stream for a task
   */
  registerStream(taskId: string, controller: SSEStreamController): () => void {
    if (!this.streams.has(taskId)) {
      this.streams.set(taskId, new Set());
    }

    const taskStreams = this.streams.get(taskId)!;
    taskStreams.add(controller);

    this.log(`Registered stream for task ${taskId}. Total streams: ${taskStreams.size}`);

    // Return unsubscribe function
    return () => {
      taskStreams.delete(controller);
      this.log(`Unregistered stream for task ${taskId}. Total streams: ${taskStreams.size}`);
      
      if (taskStreams.size === 0) {
        this.streams.delete(taskId);
      }
    };
  }

  /**
   * Broadcast a status update to all streams for a task
   */
  broadcastStatusUpdate(event: TaskStatusUpdateEvent): void {
    const taskStreams = this.streams.get(event.taskId);
    if (!taskStreams || taskStreams.size === 0) {
      return;
    }

    this.log(`Broadcasting status update to ${taskStreams.size} streams for task ${event.taskId}`);

    for (const controller of taskStreams) {
      try {
        controller.sendStatusUpdate(event);
      } catch (error) {
        this.log('Error sending status update:', error);
      }
    }

    // If final state, close all streams
    if (event.final) {
      this.closeTaskStreams(event.taskId);
    }
  }

  /**
   * Broadcast an artifact update to all streams for a task
   */
  broadcastArtifactUpdate(event: TaskArtifactUpdateEvent): void {
    const taskStreams = this.streams.get(event.taskId);
    if (!taskStreams || taskStreams.size === 0) {
      return;
    }

    this.log(`Broadcasting artifact update to ${taskStreams.size} streams for task ${event.taskId}`);

    for (const controller of taskStreams) {
      try {
        controller.sendArtifactUpdate(event);
      } catch (error) {
        this.log('Error sending artifact update:', error);
      }
    }
  }

  /**
   * Close all streams for a task
   */
  closeTaskStreams(taskId: string): void {
    const taskStreams = this.streams.get(taskId);
    if (!taskStreams) {
      return;
    }

    this.log(`Closing all streams for task ${taskId}`);

    for (const controller of taskStreams) {
      try {
        controller.close();
      } catch (error) {
        this.log('Error closing stream:', error);
      }
    }

    this.streams.delete(taskId);
  }

  /**
   * Close all streams
   */
  closeAllStreams(): void {
    this.log('Closing all streams');

    for (const [taskId, taskStreams] of this.streams) {
      for (const controller of taskStreams) {
        try {
          controller.close();
        } catch (error) {
          this.log('Error closing stream:', error);
        }
      }
    }

    this.streams.clear();
  }

  /**
   * Get the number of active streams for a task
   */
  getStreamCount(taskId: string): number {
    return this.streams.get(taskId)?.size || 0;
  }

  /**
   * Get total number of active streams
   */
  getTotalStreamCount(): number {
    let count = 0;
    for (const taskStreams of this.streams.values()) {
      count += taskStreams.size;
    }
    return count;
  }

  /**
   * Log debug messages
   */
  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[A2A TaskStreamManager]', ...args);
    }
  }
}

// ============================================================================
// HTTP Response Helpers
// ============================================================================

/**
 * HTTP headers for SSE responses
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no', // Disable nginx buffering
};

/**
 * Create SSE headers with optional CORS
 */
export function createSSEHeaders(corsOrigin?: string): Record<string, string> {
  const headers = { ...SSE_HEADERS };
  
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }

  return headers;
}

// ============================================================================
// Stream Response Parser (for clients)
// ============================================================================

/**
 * Parse an SSE stream response
 */
export function parseSSEStream(chunk: string): Array<{ type: string; data: unknown }> {
  const events: Array<{ type: string; data: unknown }> = [];
  const lines = chunk.split('\n');
  let currentEvent: { type?: string; data?: string[] } = {};

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent.type = line.slice(7);
    } else if (line.startsWith('data: ')) {
      if (!currentEvent.data) {
        currentEvent.data = [];
      }
      currentEvent.data.push(line.slice(6));
    } else if (line === '' && currentEvent.data) {
      // End of event
      try {
        const data = JSON.parse(currentEvent.data.join('\n'));
        events.push({
          type: currentEvent.type || 'message',
          data,
        });
      } catch (e) {
        // Invalid JSON, skip
      }
      currentEvent = {};
    }
  }

  return events;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a task state is terminal
 */
export function isTerminalState(state: TaskState): boolean {
  return ['completed', 'canceled', 'failed', 'rejected'].includes(state);
}

/**
 * Create a task status update event
 */
export function createTaskStatusUpdate(
  taskId: string,
  state: TaskState,
  message?: string,
  final?: boolean
): TaskStatusUpdateEvent {
  return {
    taskId,
    status: {
      state,
      ...(message && {
        message: {
          messageId: `status-${Date.now()}`,
          role: 'agent',
          parts: [{ type: 'text', text: message }],
          timestamp: new Date().toISOString(),
        },
      }),
      timestamp: new Date().toISOString(),
    },
    final: final ?? isTerminalState(state),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a task artifact update event
 */
export function createTaskArtifactUpdate(
  taskId: string,
  artifactId: string,
  parts: TaskArtifactUpdateEvent['artifact']['parts'],
  name?: string,
  description?: string
): TaskArtifactUpdateEvent {
  return {
    taskId,
    artifact: {
      artifactId,
      name,
      description,
      parts,
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  };
}
