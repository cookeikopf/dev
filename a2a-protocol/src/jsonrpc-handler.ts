/**
 * A2A Protocol - JSON-RPC Handler
 * 
 * This module provides a JSON-RPC 2.0 handler for A2A protocol methods
 * following the Agent2Agent Protocol Specification.
 * 
 * @module a2a/jsonrpc-handler
 * @version 1.0.0
 */

import {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCRequestSchema,
  A2AErrorCodes,
  SendMessageRequest,
  GetTaskRequest,
  ListTasksRequest,
  CancelTaskRequest,
  SubscribeToTaskRequest,
  SendMessageRequestSchema,
  GetTaskRequestSchema,
  ListTasksRequestSchema,
  CancelTaskRequestSchema,
  SubscribeToTaskRequestSchema,
  Task,
  Message,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  TaskState,
  AgentCard,
} from './schemas.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Handler function type for A2A methods
 */
export type A2AMethodHandler<T = unknown, R = unknown> = (
  params: T,
  context: RequestContext
) => Promise<R> | R;

/**
 * Request context containing metadata about the incoming request
 */
export interface RequestContext {
  /** Request ID */
  requestId: string | number | null;
  /** HTTP headers */
  headers: Record<string, string>;
  /** Authentication info (if available) */
  auth?: Record<string, unknown>;
  /** Timestamp of the request */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task store interface for managing tasks
 */
export interface TaskStore {
  get(id: string): Promise<Task | undefined>;
  set(id: string, task: Task): Promise<void>;
  delete(id: string): Promise<void>;
  list(options?: { contextId?: string; status?: TaskState }): Promise<Task[]>;
  generateId(): string;
}

/**
 * Task handler interface for processing tasks
 */
export interface TaskHandler {
  /**
   * Process a message and return either a task or a direct message response
   */
  processMessage(
    message: Message,
    options: {
      taskId?: string;
      contextId?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{ task?: Task; message?: Message }>;

  /**
   * Handle task cancellation
   */
  cancelTask?(taskId: string): Promise<Task>;

  /**
   * Subscribe to task updates (for streaming)
   */
  subscribeToTask?(
    taskId: string,
    callbacks: {
      onStatusUpdate: (event: TaskStatusUpdateEvent) => void;
      onArtifactUpdate: (event: TaskArtifactUpdateEvent) => void;
    }
  ): Promise<() => void>;
}

/**
 * JSON-RPC handler options
 */
export interface JSONRPCHandlerOptions {
  /** Agent card to return for discovery methods */
  agentCard: AgentCard;
  /** Task store for persisting tasks */
  taskStore: TaskStore;
  /** Task handler for processing messages */
  taskHandler: TaskHandler;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom method handlers */
  customHandlers?: Record<string, A2AMethodHandler>;
}

// ============================================================================
// JSON-RPC Error
// ============================================================================

/**
 * JSON-RPC error class
 */
export class JSONRPCError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'JSONRPCError';
  }

  toJSON(): { code: number; message: string; data?: unknown } {
    return {
      code: this.code,
      message: this.message,
      ...(this.data !== undefined && { data: this.data }),
    };
  }
}

// ============================================================================
// JSON-RPC Handler
// ============================================================================

/**
 * JSON-RPC handler for A2A protocol
 */
export class JSONRPCHandler {
  private options: JSONRPCHandlerOptions;
  private methodHandlers: Map<string, A2AMethodHandler>;

  constructor(options: JSONRPCHandlerOptions) {
    this.options = options;
    this.methodHandlers = new Map();
    this.registerDefaultHandlers();
    this.registerCustomHandlers();
  }

  /**
   * Register default A2A method handlers
   */
  private registerDefaultHandlers(): void {
    // Core A2A methods
    this.methodHandlers.set('SendMessage', this.handleSendMessage.bind(this));
    this.methodHandlers.set('GetTask', this.handleGetTask.bind(this));
    this.methodHandlers.set('ListTasks', this.handleListTasks.bind(this));
    this.methodHandlers.set('CancelTask', this.handleCancelTask.bind(this));
    this.methodHandlers.set('SubscribeToTask', this.handleSubscribeToTask.bind(this));
    
    // Discovery methods
    this.methodHandlers.set('GetAgentCard', this.handleGetAgentCard.bind(this));
    this.methodHandlers.set('GetExtendedAgentCard', this.handleGetExtendedAgentCard.bind(this));
    
    // Legacy/Alias methods for compatibility
    this.methodHandlers.set('a2a.discover', this.handleDiscover.bind(this));
    this.methodHandlers.set('a2a.capabilities', this.handleCapabilities.bind(this));
    this.methodHandlers.set('a2a.handover', this.handleHandover.bind(this));
  }

  /**
   * Register custom method handlers
   */
  private registerCustomHandlers(): void {
    if (this.options.customHandlers) {
      for (const [method, handler] of Object.entries(this.options.customHandlers)) {
        this.methodHandlers.set(method, handler);
      }
    }
  }

  /**
   * Handle a JSON-RPC request
   */
  async handleRequest(
    request: unknown,
    context: Partial<RequestContext> = {}
  ): Promise<JSONRPCResponse> {
    const fullContext: RequestContext = {
      requestId: null,
      headers: {},
      timestamp: new Date(),
      ...context,
    };

    try {
      // Validate request structure
      const parseResult = JSONRPCRequestSchema.safeParse(request);
      if (!parseResult.success) {
        throw new JSONRPCError(
          A2AErrorCodes.INVALID_REQUEST,
          'Invalid JSON-RPC request: ' + parseResult.error.errors.map(e => e.message).join(', ')
        );
      }

      const rpcRequest = parseResult.data;
      fullContext.requestId = rpcRequest.id;

      this.log('Received request:', rpcRequest.method);

      // Get method handler
      const handler = this.methodHandlers.get(rpcRequest.method);
      if (!handler) {
        throw new JSONRPCError(
          A2AErrorCodes.METHOD_NOT_FOUND,
          `Method not found: ${rpcRequest.method}`
        );
      }

      // Execute handler
      const result = await handler(rpcRequest.params || {}, fullContext);

      return {
        jsonrpc: '2.0',
        id: rpcRequest.id,
        result,
      };
    } catch (error) {
      return this.handleError(error, fullContext.requestId);
    }
  }

  /**
   * Handle errors and convert to JSON-RPC error response
   */
  private handleError(error: unknown, id: string | number | null): JSONRPCResponse {
    let rpcError: JSONRPCError;

    if (error instanceof JSONRPCError) {
      rpcError = error;
    } else if (error instanceof Error) {
      rpcError = new JSONRPCError(
        A2AErrorCodes.INTERNAL_ERROR,
        error.message
      );
    } else {
      rpcError = new JSONRPCError(
        A2AErrorCodes.INTERNAL_ERROR,
        'Unknown error occurred'
      );
    }

    this.log('Error:', rpcError.message);

    return {
      jsonrpc: '2.0',
      id,
      error: rpcError.toJSON(),
    };
  }

  /**
   * Handle SendMessage method
   */
  private async handleSendMessage(
    params: unknown,
    context: RequestContext
  ): Promise<{ task?: Task; message?: Message }> {
    const parseResult = SendMessageRequestSchema.safeParse(params);
    if (!parseResult.success) {
      throw new JSONRPCError(
        A2AErrorCodes.INVALID_PARAMS,
        'Invalid parameters: ' + parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const request: SendMessageRequest = parseResult.data;

    // If taskId is provided, verify it exists
    if (request.taskId) {
      const existingTask = await this.options.taskStore.get(request.taskId);
      if (!existingTask) {
        throw new JSONRPCError(
          A2AErrorCodes.TASK_NOT_FOUND,
          `Task not found: ${request.taskId}`
        );
      }

      // Check if task is in a terminal state
      const terminalStates: TaskState[] = ['completed', 'canceled', 'failed', 'rejected'];
      if (terminalStates.includes(existingTask.status.state)) {
        throw new JSONRPCError(
          A2AErrorCodes.UNSUPPORTED_OPERATION,
          `Cannot send message to task in ${existingTask.status.state} state`
        );
      }
    }

    // Process the message
    const result = await this.options.taskHandler.processMessage(request.message, {
      taskId: request.taskId,
      contextId: request.contextId,
      sessionId: request.sessionId,
      metadata: request.metadata,
    });

    // If a task was created, store it
    if (result.task) {
      await this.options.taskStore.set(result.task.id, result.task);
    }

    return result;
  }

  /**
   * Handle GetTask method
   */
  private async handleGetTask(
    params: unknown,
    context: RequestContext
  ): Promise<Task> {
    const parseResult = GetTaskRequestSchema.safeParse(params);
    if (!parseResult.success) {
      throw new JSONRPCError(
        A2AErrorCodes.INVALID_PARAMS,
        'Invalid parameters: ' + parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const request: GetTaskRequest = parseResult.data;
    const task = await this.options.taskStore.get(request.id);

    if (!task) {
      throw new JSONRPCError(
        A2AErrorCodes.TASK_NOT_FOUND,
        `Task not found: ${request.id}`
      );
    }

    // Apply history length limit if specified
    if (request.historyLength !== undefined && task.history) {
      return {
        ...task,
        history: task.history.slice(-request.historyLength),
      };
    }

    return task;
  }

  /**
   * Handle ListTasks method
   */
  private async handleListTasks(
    params: unknown,
    context: RequestContext
  ): Promise<{ tasks: Task[]; totalSize: number; pageSize: number; nextPageToken?: string }> {
    const parseResult = ListTasksRequestSchema.safeParse(params);
    if (!parseResult.success) {
      throw new JSONRPCError(
        A2AErrorCodes.INVALID_PARAMS,
        'Invalid parameters: ' + parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const request: ListTasksRequest = parseResult.data;
    const pageSize = request.pageSize || 50;

    // Get tasks from store
    const allTasks = await this.options.taskStore.list({
      contextId: request.contextId,
      status: request.status,
    });

    // Apply pagination
    const startIndex = request.pageToken ? parseInt(request.pageToken, 10) : 0;
    const paginatedTasks = allTasks.slice(startIndex, startIndex + pageSize);
    const nextPageToken = startIndex + pageSize < allTasks.length
      ? String(startIndex + pageSize)
      : undefined;

    return {
      tasks: paginatedTasks,
      totalSize: allTasks.length,
      pageSize,
      ...(nextPageToken && { nextPageToken }),
    };
  }

  /**
   * Handle CancelTask method
   */
  private async handleCancelTask(
    params: unknown,
    context: RequestContext
  ): Promise<Task> {
    const parseResult = CancelTaskRequestSchema.safeParse(params);
    if (!parseResult.success) {
      throw new JSONRPCError(
        A2AErrorCodes.INVALID_PARAMS,
        'Invalid parameters: ' + parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const request: CancelTaskRequest = parseResult.data;
    const task = await this.options.taskStore.get(request.id);

    if (!task) {
      throw new JSONRPCError(
        A2AErrorCodes.TASK_NOT_FOUND,
        `Task not found: ${request.id}`
      );
    }

    // Check if task can be canceled
    const terminalStates: TaskState[] = ['completed', 'canceled', 'failed', 'rejected'];
    if (terminalStates.includes(task.status.state)) {
      throw new JSONRPCError(
        A2AErrorCodes.INVALID_TASK_STATE,
        `Cannot cancel task in ${task.status.state} state`
      );
    }

    // Use custom cancel handler if available
    if (this.options.taskHandler.cancelTask) {
      const canceledTask = await this.options.taskHandler.cancelTask(request.id);
      await this.options.taskStore.set(request.id, canceledTask);
      return canceledTask;
    }

    // Default cancel behavior
    const canceledTask: Task = {
      ...task,
      status: {
        state: 'canceled',
        timestamp: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    await this.options.taskStore.set(request.id, canceledTask);
    return canceledTask;
  }

  /**
   * Handle SubscribeToTask method (returns initial task for SSE streaming)
   */
  private async handleSubscribeToTask(
    params: unknown,
    context: RequestContext
  ): Promise<Task> {
    const parseResult = SubscribeToTaskRequestSchema.safeParse(params);
    if (!parseResult.success) {
      throw new JSONRPCError(
        A2AErrorCodes.INVALID_PARAMS,
        'Invalid parameters: ' + parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const request: SubscribeToTaskRequest = parseResult.data;
    const task = await this.options.taskStore.get(request.id);

    if (!task) {
      throw new JSONRPCError(
        A2AErrorCodes.TASK_NOT_FOUND,
        `Task not found: ${request.id}`
      );
    }

    // Check if task is in a terminal state
    const terminalStates: TaskState[] = ['completed', 'canceled', 'failed', 'rejected'];
    if (terminalStates.includes(task.status.state)) {
      throw new JSONRPCError(
        A2AErrorCodes.UNSUPPORTED_OPERATION,
        `Cannot subscribe to task in ${task.status.state} state`
      );
    }

    return task;
  }

  /**
   * Handle GetAgentCard method
   */
  private async handleGetAgentCard(
    params: unknown,
    context: RequestContext
  ): Promise<AgentCard> {
    return this.options.agentCard;
  }

  /**
   * Handle GetExtendedAgentCard method
   */
  private async handleGetExtendedAgentCard(
    params: unknown,
    context: RequestContext
  ): Promise<AgentCard> {
    if (!this.options.agentCard.capabilities.extendedAgentCard) {
      throw new JSONRPCError(
        A2AErrorCodes.UNSUPPORTED_OPERATION,
        'Extended agent card is not supported'
      );
    }

    // Return the same card or a modified version based on authentication
    return this.options.agentCard;
  }

  /**
   * Handle a2a.discover method (legacy alias)
   */
  private async handleDiscover(
    params: unknown,
    context: RequestContext
  ): Promise<AgentCard> {
    return this.handleGetAgentCard(params, context);
  }

  /**
   * Handle a2a.capabilities method (legacy alias)
   */
  private async handleCapabilities(
    params: unknown,
    context: RequestContext
  ): Promise<{ capabilities: Record<string, unknown>; methods: string[] }> {
    const card = this.options.agentCard;
    return {
      capabilities: card.capabilities,
      methods: Array.from(this.methodHandlers.keys()),
    };
  }

  /**
   * Handle a2a.handover method (task delegation stub)
   */
  private async handleHandover(
    params: unknown,
    context: RequestContext
  ): Promise<{ success: boolean; message: string; delegatedTaskId?: string }> {
    // This is a stub implementation for task delegation
    // In a full implementation, this would delegate the task to another agent
    return {
      success: true,
      message: 'Task delegation is not fully implemented in this version',
    };
  }

  /**
   * Register a custom method handler
   */
  registerMethod(method: string, handler: A2AMethodHandler): void {
    this.methodHandlers.set(method, handler);
  }

  /**
   * Get list of registered methods
   */
  getRegisteredMethods(): string[] {
    return Array.from(this.methodHandlers.keys());
  }

  /**
   * Log debug messages
   */
  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[A2A JSON-RPC]', ...args);
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a JSON-RPC success response
 */
export function createSuccessResponse(
  id: string | number | null,
  result: unknown
): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create a JSON-RPC error response
 */
export function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data !== undefined && { data }),
    },
  };
}

/**
 * Parse a JSON-RPC request from string
 */
export function parseJSONRPCRequest(body: string): { request?: JSONRPCRequest; error?: JSONRPCResponse } {
  try {
    const parsed = JSON.parse(body);
    const result = JSONRPCRequestSchema.safeParse(parsed);
    
    if (!result.success) {
      return {
        error: createErrorResponse(
          parsed.id ?? null,
          A2AErrorCodes.INVALID_REQUEST,
          'Invalid JSON-RPC request: ' + result.error.errors.map(e => e.message).join(', ')
        ),
      };
    }

    return { request: result.data };
  } catch (e) {
    return {
      error: createErrorResponse(
        null,
        A2AErrorCodes.PARSE_ERROR,
        'Parse error: ' + (e as Error).message
      ),
    };
  }
}

// ============================================================================
// In-Memory Task Store Implementation
// ============================================================================

/**
 * Simple in-memory task store implementation
 */
export class InMemoryTaskStore implements TaskStore {
  private tasks = new Map<string, Task>();
  private idCounter = 0;

  async get(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async set(id: string, task: Task): Promise<void> {
    this.tasks.set(id, task);
  }

  async delete(id: string): Promise<void> {
    this.tasks.delete(id);
  }

  async list(options?: { contextId?: string; status?: TaskState }): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());

    if (options?.contextId) {
      tasks = tasks.filter(t => t.contextId === options.contextId);
    }

    if (options?.status) {
      tasks = tasks.filter(t => t.status.state === options.status);
    }

    // Sort by createdAt descending
    return tasks.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  generateId(): string {
    return `task-${++this.idCounter}-${Date.now()}`;
  }

  /**
   * Clear all tasks (for testing)
   */
  clear(): void {
    this.tasks.clear();
    this.idCounter = 0;
  }
}
