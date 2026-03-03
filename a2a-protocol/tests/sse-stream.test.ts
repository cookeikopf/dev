/**
 * A2A Protocol - SSE Stream Tests
 * 
 * Tests for Server-Sent Events streaming functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TaskStreamManager,
  createSSEStreamController,
  formatSSEEvent,
  createStatusUpdateEvent,
  createArtifactUpdateEvent,
  createMessageEvent,
  createErrorEvent,
  createCloseEvent,
  createSSEHeaders,
  SSE_HEADERS,
  parseSSEStream,
  createTaskStatusUpdate,
  createTaskArtifactUpdate,
  isTerminalState,
  type TaskState,
  type SSEEvent,
  type SSEStreamController,
} from '../src/sse-stream.js';

describe('formatSSEEvent', () => {
  it('should format events with ID', () => {
    const event: SSEEvent = {
      type: 'status',
      id: 'evt-1',
      data: { message: 'test' },
    };

    const formatted = formatSSEEvent(event);

    expect(formatted).toContain('id: evt-1');
    expect(formatted).toContain('data: {"message":"test"}');
    expect(formatted).toMatch(/\n\n$/);
  });

  it('should format events with retry', () => {
    const event: SSEEvent = {
      type: 'status',
      id: 'evt-1',
      retry: 5000,
      data: { message: 'test' },
    };

    const formatted = formatSSEEvent(event);

    expect(formatted).toContain('retry: 5000');
  });

  it('should handle multiline data', () => {
    const event: SSEEvent = {
      type: 'status',
      data: { message: 'line1\nline2' },
    };

    const formatted = formatSSEEvent(event);

    expect(formatted).toContain('data: {"message":"line1');
    expect(formatted).toContain('data: line2"}');
  });
});

describe('createStatusUpdateEvent', () => {
  it('should create status update events', () => {
    const event = createStatusUpdateEvent(
      'task-1',
      { state: 'working', timestamp: '2024-01-15T10:30:00.000Z' },
      false,
      'evt-1'
    );

    expect(event.type).toBe('status');
    expect(event.id).toBe('evt-1');
    expect((event.data as Record<string, unknown>).type).toBe('status');
    expect((event.data as Record<string, unknown>).taskId).toBe('task-1');
  });
});

describe('createArtifactUpdateEvent', () => {
  it('should create artifact update events', () => {
    const event = createArtifactUpdateEvent(
      'task-1',
      {
        artifactId: 'art-1',
        parts: [{ type: 'text', text: 'Result' }],
        timestamp: '2024-01-15T10:30:00.000Z',
      },
      'evt-1'
    );

    expect(event.type).toBe('artifact');
    expect(event.id).toBe('evt-1');
    expect((event.data as Record<string, unknown>).type).toBe('artifact');
  });
});

describe('createMessageEvent', () => {
  it('should create message events', () => {
    const message = {
      messageId: 'msg-1',
      role: 'agent' as const,
      parts: [{ type: 'text' as const, text: 'Hello' }],
      timestamp: '2024-01-15T10:30:00.000Z',
    };

    const event = createMessageEvent(message, 'evt-1');

    expect(event.type).toBe('message');
    expect(event.id).toBe('evt-1');
    expect((event.data as Record<string, unknown>).type).toBe('message');
  });
});

describe('createErrorEvent', () => {
  it('should create error events', () => {
    const event = createErrorEvent(
      -32001,
      'Task not found',
      { taskId: 'missing' },
      'evt-1'
    );

    expect(event.type).toBe('error');
    expect(event.id).toBe('evt-1');
    const data = event.data as { jsonrpc: string; error: { code: number; message: string; data?: unknown } };
    expect(data.jsonrpc).toBe('2.0');
    expect(data.error.code).toBe(-32001);
    expect(data.error.message).toBe('Task not found');
    expect(data.error.data).toEqual({ taskId: 'missing' });
  });
});

describe('createCloseEvent', () => {
  it('should create close events', () => {
    const event = createCloseEvent('evt-1');

    expect(event.type).toBe('close');
    expect(event.id).toBe('evt-1');
    expect((event.data as Record<string, unknown>).type).toBe('close');
  });
});

describe('createSSEStreamController', () => {
  let writeFn: ReturnType<typeof vi.fn>;
  let controller: SSEStreamController;

  beforeEach(() => {
    writeFn = vi.fn();
    controller = createSSEStreamController(writeFn, { debug: false });
  });

  it('should write retry header on creation', () => {
    expect(writeFn).toHaveBeenCalledWith('retry: 3000\n\n');
  });

  it('should send status updates', () => {
    controller.sendStatusUpdate({
      taskId: 'task-1',
      status: { state: 'working', timestamp: '2024-01-15T10:30:00.000Z' },
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    expect(writeFn).toHaveBeenCalledTimes(2); // Header + event
    const lastCall = writeFn.mock.calls[writeFn.mock.calls.length - 1][0];
    expect(lastCall).toContain('data:');
    expect(lastCall).toContain('task-1');
  });

  it('should send artifact updates', () => {
    controller.sendArtifactUpdate({
      taskId: 'task-1',
      artifact: {
        artifactId: 'art-1',
        parts: [{ type: 'text', text: 'Result' }],
        timestamp: '2024-01-15T10:30:00.000Z',
      },
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    expect(writeFn).toHaveBeenCalledTimes(2);
  });

  it('should send messages', () => {
    controller.sendMessage({
      messageId: 'msg-1',
      role: 'agent',
      parts: [{ type: 'text', text: 'Hello' }],
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    expect(writeFn).toHaveBeenCalledTimes(2);
  });

  it('should send errors', () => {
    controller.sendError({
      code: -32001,
      message: 'Task not found',
    });

    expect(writeFn).toHaveBeenCalledTimes(2);
  });

  it('should close the stream', () => {
    controller.close();

    expect(controller.isClosed()).toBe(true);
    expect(writeFn).toHaveBeenCalledTimes(2);
  });

  it('should not send after close', () => {
    controller.close();
    writeFn.mockClear();

    controller.sendStatusUpdate({
      taskId: 'task-1',
      status: { state: 'working', timestamp: '2024-01-15T10:30:00.000Z' },
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    expect(writeFn).not.toHaveBeenCalled();
  });

  it('should support custom retry interval', () => {
    writeFn.mockClear();
    const customController = createSSEStreamController(writeFn, {
      retryInterval: 5000,
    });

    expect(writeFn).toHaveBeenCalledWith('retry: 5000\n\n');
  });
});

describe('TaskStreamManager', () => {
  let manager: TaskStreamManager;
  let writeFn1: ReturnType<typeof vi.fn>;
  let writeFn2: ReturnType<typeof vi.fn>;
  let controller1: SSEStreamController;
  let controller2: SSEStreamController;

  beforeEach(() => {
    manager = new TaskStreamManager({ debug: false });
    writeFn1 = vi.fn();
    writeFn2 = vi.fn();
    controller1 = createSSEStreamController(writeFn1, { debug: false });
    controller2 = createSSEStreamController(writeFn2, { debug: false });
  });

  it('should register streams', () => {
    const unsubscribe = manager.registerStream('task-1', controller1);

    expect(manager.getStreamCount('task-1')).toBe(1);
    expect(typeof unsubscribe).toBe('function');
  });

  it('should unregister streams', () => {
    const unsubscribe = manager.registerStream('task-1', controller1);
    unsubscribe();

    expect(manager.getStreamCount('task-1')).toBe(0);
  });

  it('should broadcast status updates', () => {
    manager.registerStream('task-1', controller1);
    manager.registerStream('task-1', controller2);

    manager.broadcastStatusUpdate({
      taskId: 'task-1',
      status: { state: 'working', timestamp: '2024-01-15T10:30:00.000Z' },
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    expect(writeFn1).toHaveBeenCalled();
    expect(writeFn2).toHaveBeenCalled();
  });

  it('should broadcast artifact updates', () => {
    manager.registerStream('task-1', controller1);

    manager.broadcastArtifactUpdate({
      taskId: 'task-1',
      artifact: {
        artifactId: 'art-1',
        parts: [{ type: 'text', text: 'Result' }],
        timestamp: '2024-01-15T10:30:00.000Z',
      },
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    expect(writeFn1).toHaveBeenCalled();
  });

  it('should close streams on final status', () => {
    manager.registerStream('task-1', controller1);

    manager.broadcastStatusUpdate({
      taskId: 'task-1',
      status: { state: 'completed', timestamp: '2024-01-15T10:30:00.000Z' },
      final: true,
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    expect(manager.getStreamCount('task-1')).toBe(0);
  });

  it('should close task streams', () => {
    manager.registerStream('task-1', controller1);
    manager.registerStream('task-1', controller2);

    manager.closeTaskStreams('task-1');

    expect(manager.getStreamCount('task-1')).toBe(0);
    expect(controller1.isClosed()).toBe(true);
    expect(controller2.isClosed()).toBe(true);
  });

  it('should close all streams', () => {
    manager.registerStream('task-1', controller1);
    manager.registerStream('task-2', controller2);

    manager.closeAllStreams();

    expect(manager.getTotalStreamCount()).toBe(0);
    expect(controller1.isClosed()).toBe(true);
    expect(controller2.isClosed()).toBe(true);
  });

  it('should track total stream count', () => {
    manager.registerStream('task-1', controller1);
    manager.registerStream('task-2', controller2);

    expect(manager.getTotalStreamCount()).toBe(2);
  });

  it('should handle multiple streams per task', () => {
    const controller3 = createSSEStreamController(vi.fn(), { debug: false });

    manager.registerStream('task-1', controller1);
    manager.registerStream('task-1', controller2);
    manager.registerStream('task-1', controller3);

    expect(manager.getStreamCount('task-1')).toBe(3);
  });
});

describe('createSSEHeaders', () => {
  it('should create default SSE headers', () => {
    const headers = createSSEHeaders();

    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['Cache-Control']).toBe('no-cache');
    expect(headers['Connection']).toBe('keep-alive');
  });

  it('should include CORS headers when origin provided', () => {
    const headers = createSSEHeaders('https://example.com');

    expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
    expect(headers['Access-Control-Allow-Headers']).toBeDefined();
  });
});

describe('SSE_HEADERS', () => {
  it('should contain required headers', () => {
    expect(SSE_HEADERS['Content-Type']).toBe('text/event-stream');
    expect(SSE_HEADERS['Cache-Control']).toBe('no-cache');
    expect(SSE_HEADERS['Connection']).toBe('keep-alive');
    expect(SSE_HEADERS['X-Accel-Buffering']).toBe('no');
  });
});

describe('parseSSEStream', () => {
  it('should parse SSE stream chunks', () => {
    const chunk = `id: evt-1
data: {"type":"status","taskId":"task-1"}

id: evt-2
data: {"type":"artifact","taskId":"task-1"}

`;

    const events = parseSSEStream(chunk);

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('message');
    expect((events[0].data as Record<string, unknown>).type).toBe('status');
    expect(events[1].type).toBe('message');
    expect((events[1].data as Record<string, unknown>).type).toBe('artifact');
  });

  it('should handle custom event types', () => {
    const chunk = `event: custom
data: {"message":"test"}

`;

    const events = parseSSEStream(chunk);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('custom');
  });

  it('should handle empty chunks', () => {
    const events = parseSSEStream('');

    expect(events).toHaveLength(0);
  });

  it('should skip invalid JSON', () => {
    const chunk = `id: evt-1
data: not valid json

`;

    const events = parseSSEStream(chunk);

    expect(events).toHaveLength(0);
  });
});

describe('createTaskStatusUpdate', () => {
  it('should create status updates', () => {
    const update = createTaskStatusUpdate('task-1', 'working', 'Processing...');

    expect(update.taskId).toBe('task-1');
    expect(update.status.state).toBe('working');
    expect(update.status.message?.parts[0]).toEqual({ type: 'text', text: 'Processing...' });
    expect(update.final).toBe(false);
  });

  it('should mark terminal states as final', () => {
    const update = createTaskStatusUpdate('task-1', 'completed');

    expect(update.final).toBe(true);
  });

  it('should not include message when not provided', () => {
    const update = createTaskStatusUpdate('task-1', 'working');

    expect(update.status.message).toBeUndefined();
  });
});

describe('createTaskArtifactUpdate', () => {
  it('should create artifact updates', () => {
    const update = createTaskArtifactUpdate(
      'task-1',
      'art-1',
      [{ type: 'text', text: 'Result' }],
      'My Artifact',
      'A description'
    );

    expect(update.taskId).toBe('task-1');
    expect(update.artifact.artifactId).toBe('art-1');
    expect(update.artifact.name).toBe('My Artifact');
    expect(update.artifact.description).toBe('A description');
    expect(update.artifact.parts).toHaveLength(1);
  });

  it('should create artifact updates without optional fields', () => {
    const update = createTaskArtifactUpdate('task-1', 'art-1', [
      { type: 'text', text: 'Result' },
    ]);

    expect(update.artifact.name).toBeUndefined();
    expect(update.artifact.description).toBeUndefined();
  });
});

describe('isTerminalState', () => {
  it('should identify terminal states', () => {
    const terminalStates: TaskState[] = ['completed', 'canceled', 'failed', 'rejected'];
    
    for (const state of terminalStates) {
      expect(isTerminalState(state)).toBe(true);
    }
  });

  it('should identify non-terminal states', () => {
    const nonTerminalStates: TaskState[] = ['submitted', 'working', 'input-required'];
    
    for (const state of nonTerminalStates) {
      expect(isTerminalState(state)).toBe(false);
    }
  });
});
