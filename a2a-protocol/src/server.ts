/**
 * A2A Protocol - Server
 * 
 * This module provides a complete A2A server implementation
 * following the Agent2Agent Protocol Specification.
 * 
 * @module a2a/server
 * @version 1.0.0
 */

import {
  AgentCard,
  Task,
  Message,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  TaskState,
  A2AErrorCodes,
} from './schemas.js';
import {
  JSONRPCHandler,
  JSONRPCHandlerOptions,
  TaskStore,
  TaskHandler,
  InMemoryTaskStore,
  JSONRPCError,
  RequestContext,
} from './jsonrpc-handler.js';
import {
  TaskStreamManager,
  SSEStreamController,
  createSSEStreamController,
  createSSEHeaders,
  createTaskStatusUpdate,
  createTaskArtifactUpdate,
  isTerminalState,
} from './sse-stream.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * HTTP request handler type
 */
export type HTTPRequestHandler = (
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
  },
  response: {
    status: (code: number) => { json: (data: unknown) => void; send: (data: string) => void };
    setHeader: (name: string, value: string) => void;
    write: (data: string) => void;
    end: () => void;
  }
) => Promise<void> | void;

/**
 * A2A server options
 */
export interface A2AServerOptions {
  /** Agent card describing this agent */
  agentCard: AgentCard;
  /** Custom task store (defaults to InMemoryTaskStore) */
  taskStore?: TaskStore;
  /** Task handler for processing messages */
  taskHandler: TaskHandler;
  /** Base path for A2A endpoints (default: '/a2a') */
  basePath?: string;
  /** Well-known path for agent card (default: '/.well-known/agent.json') */
  wellKnownPath?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** CORS origin */
  corsOrigin?: string;
  /** Custom JSON-RPC method handlers */
  customHandlers?: Record<string, (params: unknown, context: RequestContext) => Promise<unknown> | unknown>;
}

/**
 * Task update event
 */
export interface TaskUpdateEvent {
  type: 'status' | 'artifact';
  taskId: string;
  data: TaskStatusUpdateEvent | TaskArtifactUpdateEvent;
}

// ============================================================================
// A2A Server Class
// ============================================================================

/**
 * A2A Protocol Server
 * 
 * Implements the complete A2A protocol including:
 * - Agent Card discovery (/.well-known/agent.json)
 * - JSON-RPC 2.0 endpoint (/a2a)
 * - SSE streaming for task updates
 * - Task management
 */
export class A2AServer {
  private options: Required<Pick<A2AServerOptions, 'basePath' | 'wellKnownPath' | 'debug'>> & A2AServerOptions;
  private jsonRPCHandler: JSONRPCHandler;
  private streamManager: TaskStreamManager;
  private taskStore: TaskStore;

  constructor(options: A2AServerOptions) {
    this.options = {
      basePath: '/a2a',
      wellKnownPath: '/.well-known/agent.json',
      debug: false,
      ...options,
    };

    this.taskStore = options.taskStore || new InMemoryTaskStore();
    this.streamManager = new TaskStreamManager({ debug: this.options.debug });

    const handlerOptions: JSONRPCHandlerOptions = {
      agentCard: options.agentCard,
      taskStore: this.taskStore,
      taskHandler: options.taskHandler,
      debug: options.debug,
      customHandlers: options.customHandlers,
    };

    this.jsonRPCHandler = new JSONRPCHandler(handlerOptions);
  }

  /**
   * Get the HTTP request handler
   * 
   * This can be used with any Node.js HTTP server or framework
   */
  getHandler(): HTTPRequestHandler {
    return async (req, res) => {
      try {
        await this.handleRequest(req, res);
      } catch (error) {
        this.log('Unhandled error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: A2AErrorCodes.INTERNAL_ERROR,
            message: 'Internal server error',
          },
        });
      }
    };
  }

  /**
   * Handle an HTTP request
   */
  private async handleRequest(
    req: { method: string; url: string; headers: Record<string, string>; body: string },
    res: { 
      status: (code: number) => { json: (data: unknown) => void; send: (data: string) => void };
      setHeader: (name: string, value: string) => void;
      write: (data: string) => void;
      end: () => void;
    }
  ): Promise<void> {
    const url = req.url || '/';
    const method = req.method.toUpperCase();

    this.log(`${method} ${url}`);

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      this.setCORSHeaders(res);
      res.status(204).send('');
      return;
    }

    // Agent Card Discovery
    if (url === this.options.wellKnownPath && method === 'GET') {
      this.setCORSHeaders(res);
      res.status(200).json(this.options.agentCard);
      return;
    }

    // JSON-RPC Endpoint
    if (url === this.options.basePath && method === 'POST') {
      this.setCORSHeaders(res);
      await this.handleJSONRPCRequest(req, res);
      return;
    }

    // SSE Streaming Endpoint
    if (url.startsWith(`${this.options.basePath}/stream/`) && method === 'GET') {
      const taskId = url.split('/').pop();
      if (taskId) {
        await this.handleSSEStream(taskId, req, res);
        return;
      }
    }

    // Health Check
    if (url === '/health' && method === 'GET') {
      this.setCORSHeaders(res);
      res.status(200).json({
        status: 'healthy',
        agent: this.options.agentCard.name,
        version: this.options.agentCard.version,
      });
      return;
    }

    // Not Found
    this.setCORSHeaders(res);
    res.status(404).json({
      error: 'Not Found',
      message: `Endpoint ${url} not found`,
    });
  }

  /**
   * Handle JSON-RPC request
   */
  private async handleJSONRPCRequest(
    req: { headers: Record<string, string>; body: string },
    res: { status: (code: number) => { json: (data: unknown) => void } }
  ): Promise<void> {
    // Parse request body
    let body: unknown;
    try {
      body = JSON.parse(req.body || '{}');
    } catch {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: A2AErrorCodes.PARSE_ERROR,
          message: 'Parse error: Invalid JSON',
        },
      });
      return;
    }

    // Create request context
    const context: RequestContext = {
      requestId: (body as Record<string, unknown>)?.id ?? null,
      headers: req.headers,
      timestamp: new Date(),
    };

    // Handle the request
    const response = await this.jsonRPCHandler.handleRequest(body, context);

    // Send response
    res.status(200).json(response);
  }

  /**
   * Handle SSE streaming request
   */
  private async handleSSEStream(
    taskId: string,
    req: { headers: Record<string, string> },
    res: { 
      status: (code: number) => void;
      setHeader: (name: string, value: string) => void;
      write: (data: string) => void;
      end: () => void;
    }
  ): Promise<void> {
    // Verify task exists
    const task = await this.taskStore.get(taskId);
    if (!task) {
      res.status(404);
      res.setHeader('Content-Type', 'application/json');
      res.write(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: A2AErrorCodes.TASK_NOT_FOUND,
          message: `Task not found: ${taskId}`,
        },
      }));
      res.end();
      return;
    }

    // Check if task is in terminal state
    if (isTerminalState(task.status.state)) {
      res.status(400);
      res.setHeader('Content-Type', 'application/json');
      res.write(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: A2AErrorCodes.UNSUPPORTED_OPERATION,
          message: `Cannot subscribe to task in ${task.status.state} state`,
        },
      }));
      res.end();
      return;
    }

    // Set SSE headers
    const headers = createSSEHeaders(this.options.corsOrigin);
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
    res.status(200);

    // Create stream controller
    const controller = createSSEStreamController(
      (data) => res.write(data),
      { debug: this.options.debug }
    );

    // Register stream
    const unsubscribe = this.streamManager.registerStream(taskId, controller);

    // Handle client disconnect
    const cleanup = () => {
      unsubscribe();
      controller.close();
    };

    // Note: In a real implementation, you'd listen for the 'close' event on the response
    // For now, we'll just return and let the caller handle cleanup

    this.log(`SSE stream started for task ${taskId}`);

    // Send initial task state
    controller.sendStatusUpdate({
      taskId,
      status: task.status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Set CORS headers
   */
  private setCORSHeaders(res: { setHeader: (name: string, value: string) => void }): void {
    if (this.options.corsOrigin) {
      res.setHeader('Access-Control-Allow-Origin', this.options.corsOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
  }

  /**
   * Update a task and broadcast to all subscribers
   */
  async updateTask(task: Task): Promise<void> {
    await this.taskStore.set(task.id, task);

    // Broadcast status update
    this.streamManager.broadcastStatusUpdate({
      taskId: task.id,
      status: task.status,
      final: isTerminalState(task.status.state),
      timestamp: new Date().toISOString(),
    });

    // Close streams if terminal state
    if (isTerminalState(task.status.state)) {
      this.streamManager.closeTaskStreams(task.id);
    }
  }

  /**
   * Add an artifact to a task and broadcast to all subscribers
   */
  async addArtifact(
    taskId: string,
    artifact: TaskArtifactUpdateEvent['artifact']
  ): Promise<void> {
    const task = await this.taskStore.get(taskId);
    if (!task) {
      throw new JSONRPCError(
        A2AErrorCodes.TASK_NOT_FOUND,
        `Task not found: ${taskId}`
      );
    }

    // Add artifact to task
    const updatedTask: Task = {
      ...task,
      artifacts: [...(task.artifacts || []), artifact],
      updatedAt: new Date().toISOString(),
    };

    await this.taskStore.set(taskId, updatedTask);

    // Broadcast artifact update
    this.streamManager.broadcastArtifactUpdate({
      taskId,
      artifact,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Create a new task
   */
  async createTask(
    message: Message,
    options: {
      contextId?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: this.taskStore.generateId(),
      contextId: options.contextId,
      sessionId: options.sessionId,
      status: {
        state: 'submitted',
        timestamp: now,
      },
      history: [message],
      metadata: options.metadata,
      createdAt: now,
      updatedAt: now,
    };

    await this.taskStore.set(task.id, task);
    return task;
  }

  /**
   * Transition a task to a new state
   */
  async transitionTask(
    taskId: string,
    newState: TaskState,
    options: {
      message?: string;
      artifacts?: TaskArtifactUpdateEvent['artifact'][];
    } = {}
  ): Promise<Task> {
    const task = await this.taskStore.get(taskId);
    if (!task) {
      throw new JSONRPCError(
        A2AErrorCodes.TASK_NOT_FOUND,
        `Task not found: ${taskId}`
      );
    }

    const now = new Date().toISOString();
    const updatedTask: Task = {
      ...task,
      status: {
        state: newState,
        ...(options.message && {
          message: {
            messageId: `status-${Date.now()}`,
            role: 'agent',
            parts: [{ type: 'text', text: options.message }],
            timestamp: now,
          },
        }),
        timestamp: now,
      },
      updatedAt: now,
    };

    // Add artifacts if provided
    if (options.artifacts) {
      updatedTask.artifacts = [...(task.artifacts || []), ...options.artifacts];
    }

    await this.updateTask(updatedTask);
    return updatedTask;
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<Task | undefined> {
    return this.taskStore.get(taskId);
  }

  /**
   * List all tasks
   */
  async listTasks(options?: { contextId?: string; status?: TaskState }): Promise<Task[]> {
    return this.taskStore.list(options);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<Task> {
    return this.transitionTask(taskId, 'canceled', {
      message: 'Task was canceled by user request',
    });
  }

  /**
   * Get the agent card
   */
  getAgentCard(): AgentCard {
    return this.options.agentCard;
  }

  /**
   * Get the JSON-RPC handler
   */
  getJSONRPCHandler(): JSONRPCHandler {
    return this.jsonRPCHandler;
  }

  /**
   * Get the stream manager
   */
  getStreamManager(): TaskStreamManager {
    return this.streamManager;
  }

  /**
   * Register a custom JSON-RPC method
   */
  registerMethod(
    method: string,
    handler: (params: unknown, context: RequestContext) => Promise<unknown> | unknown
  ): void {
    this.jsonRPCHandler.registerMethod(method, handler);
  }

  /**
   * Log debug messages
   */
  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[A2A Server]', ...args);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an A2A server with the given options
 */
export function createA2AServer(options: A2AServerOptions): A2AServer {
  return new A2AServer(options);
}

// ============================================================================
// Express Integration Helper
// ============================================================================

/**
 * Create Express middleware for A2A server
 * 
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { createA2AServer, createExpressMiddleware } from './server.js';
 * 
 * const a2aServer = createA2AServer({ agentCard, taskHandler });
 * const app = express();
 * app.use(createExpressMiddleware(a2aServer));
 * ```
 */
export function createExpressMiddleware(a2aServer: A2AServer) {
  return async (
    req: { method: string; url: string; headers: Record<string, string>; body: string },
    res: {
      status: (code: number) => { json: (data: unknown) => void; send: (data: string) => void };
      setHeader: (name: string, value: string) => void;
      write: (data: string) => void;
      end: () => void;
    },
    next: () => void
  ) => {
    const handler = a2aServer.getHandler();
    await handler(req, res);
  };
}

// Re-export types and utilities
export {
  JSONRPCHandler,
  TaskStore,
  TaskHandler,
  InMemoryTaskStore,
  JSONRPCError,
  RequestContext,
  TaskStreamManager,
  SSEStreamController,
  createSSEStreamController,
  createSSEHeaders,
  createTaskStatusUpdate,
  createTaskArtifactUpdate,
  isTerminalState,
};
