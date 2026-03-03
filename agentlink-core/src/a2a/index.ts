/**
 * @fileoverview A2A Protocol implementation for AgentLink SDK
 * @module @agentlink/core/a2a
 */

import type {
  Agent,
  AgentCard,
  A2ACapability,
  A2AConfig,
  JsonRpcRequest,
  JsonRpcResponse,
  A2ADiscoverResult,
  A2ACapabilitiesResult,
  A2AHandoverParams,
  A2AHandoverResult,
  Capability,
  ProviderInfo,
} from '../types/index.js';
import {
  createJsonRpcResponse,
  createJsonRpcErrorResponse,
  createJsonRpcError,
  JsonRpcErrorCodes,
} from '../utils/index.js';

/**
 * Default A2A configuration
 */
const DEFAULT_A2A_CONFIG: A2AConfig = {
  path: '/',
  enableSse: false,
  ssePath: '/sse',
  agentCardPath: '/.well-known/agent.json',
};

/**
 * A2A Protocol handler
 */
export class A2AHandler {
  private config: A2AConfig;
  private agent: Agent | null = null;

  /**
   * Create a new A2A handler
   * @param config A2A configuration
   */
  constructor(config: A2AConfig = {}) {
    this.config = { ...DEFAULT_A2A_CONFIG, ...config };
  }

  /**
   * Set the agent reference
   * @param agent Agent instance
   */
  setAgent(agent: Agent): void {
    this.agent = agent;
  }

  /**
   * Get the A2A configuration
   */
  getConfig(): A2AConfig {
    return { ...this.config };
  }

  /**
   * Generate the Agent Card
   * @param baseUrl Base URL for the agent
   * @returns Agent Card
   */
  generateAgentCard(baseUrl: string): AgentCard {
    if (!this.agent) {
      throw new Error('Agent not set');
    }

    const config = this.agent.config;
    const capabilities = Array.from(this.agent.capabilities.values()).map((cap) =>
      this.convertCapabilityToA2A(cap)
    );

    return {
      schema_version: '1.0',
      name: config.name,
      description: config.description,
      url: baseUrl,
      provider: config.provider,
      version: config.version,
      documentationUrl: config.documentationUrl,
      capabilities,
      authentication: {
        schemes: ['none'],
      },
    };
  }

  /**
   * Convert internal capability to A2A format
   * @param capability Internal capability
   * @returns A2A capability
   */
  private convertCapabilityToA2A(capability: Capability): A2ACapability {
    return {
      id: capability.id,
      name: capability.name,
      description: capability.description,
      input: capability.input,
      output: capability.output,
      pricing: capability.pricing,
      requiresPayment: capability.requiresPayment,
    };
  }

  /**
   * Handle a JSON-RPC request
   * @param request JSON-RPC request
   * @returns JSON-RPC response
   */
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.agent) {
      return createJsonRpcErrorResponse(
        request.id,
        createJsonRpcError(
          JsonRpcErrorCodes.INTERNAL_ERROR,
          'Agent not initialized'
        )
      );
    }

    // Validate request
    if (request.jsonrpc !== '2.0') {
      return createJsonRpcErrorResponse(
        request.id,
        createJsonRpcError(
          JsonRpcErrorCodes.INVALID_REQUEST,
          'Invalid JSON-RPC version'
        )
      );
    }

    const { method, params } = request;

    try {
      switch (method) {
        case 'a2a.discover':
          return await this.handleDiscover(request.id);

        case 'a2a.capabilities':
          return await this.handleCapabilities(request.id);

        case 'a2a.handover':
          return await this.handleHandover(request.id, params as A2AHandoverParams);

        default:
          return createJsonRpcErrorResponse(
            request.id,
            createJsonRpcError(
              JsonRpcErrorCodes.METHOD_NOT_FOUND,
              `Method not found: ${method}`
            )
          );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createJsonRpcErrorResponse(
        request.id,
        createJsonRpcError(JsonRpcErrorCodes.INTERNAL_ERROR, message)
      );
    }
  }

  /**
   * Handle a2a.discover method
   * @param id Request ID
   * @returns Discover response
   */
  private async handleDiscover(id: string | number | null): Promise<JsonRpcResponse> {
    if (!this.agent) {
      return createJsonRpcErrorResponse(
        id,
        createJsonRpcError(JsonRpcErrorCodes.INTERNAL_ERROR, 'Agent not initialized')
      );
    }

    // Use agent's URL if available, otherwise use a placeholder
    const baseUrl = this.agent.config.url ?? 'http://localhost';
    const agentCard = this.generateAgentCard(baseUrl);

    const result: A2ADiscoverResult = {
      agent: agentCard,
    };

    return createJsonRpcResponse(id, result);
  }

  /**
   * Handle a2a.capabilities method
   * @param id Request ID
   * @returns Capabilities response
   */
  private async handleCapabilities(id: string | number | null): Promise<JsonRpcResponse> {
    if (!this.agent) {
      return createJsonRpcErrorResponse(
        id,
        createJsonRpcError(JsonRpcErrorCodes.INTERNAL_ERROR, 'Agent not initialized')
      );
    }

    const capabilities = Array.from(this.agent.capabilities.values()).map((cap) =>
      this.convertCapabilityToA2A(cap)
    );

    const result: A2ACapabilitiesResult = {
      capabilities,
    };

    return createJsonRpcResponse(id, result);
  }

  /**
   * Handle a2a.handover method
   * @param id Request ID
   * @param params Handover parameters
   * @returns Handover response
   */
  private async handleHandover(
    id: string | number | null,
    params?: A2AHandoverParams
  ): Promise<JsonRpcResponse> {
    if (!params?.taskId || !params?.targetAgent) {
      return createJsonRpcErrorResponse(
        id,
        createJsonRpcError(
          JsonRpcErrorCodes.INVALID_PARAMS,
          'Missing required parameters: taskId, targetAgent'
        )
      );
    }

    // Stub implementation - in production, this would:
    // 1. Validate the task exists
    // 2. Contact the target agent
    // 3. Transfer task context
    // 4. Update task state

    const result: A2AHandoverResult = {
      success: true,
      taskId: params.taskId,
      targetAgent: params.targetAgent,
      message: 'Handover initiated (stub implementation)',
    };

    return createJsonRpcResponse(id, result);
  }

  /**
   * Get the Agent Card path
   */
  getAgentCardPath(): string {
    return this.config.agentCardPath ?? '/.well-known/agent.json';
  }

  /**
   * Get the SSE path
   */
  getSsePath(): string {
    return this.config.ssePath ?? '/sse';
  }

  /**
   * Check if SSE is enabled
   */
  isSseEnabled(): boolean {
    return this.config.enableSse ?? false;
  }
}

/**
 * Create an A2A handler
 * @param config A2A configuration
 * @returns A2A handler instance
 */
export function createA2AHandler(config?: A2AConfig): A2AHandler {
  return new A2AHandler(config);
}

/**
 * A2A SSE stream manager
 */
export class A2ASseStream {
  private encoder: TextEncoder;
  private controller: ReadableStreamController<Uint8Array> | null = null;
  private stream: ReadableStream<Uint8Array>;

  constructor() {
    this.encoder = new TextEncoder();
    this.stream = new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      },
    });
  }

  /**
   * Get the readable stream
   */
  getStream(): ReadableStream<Uint8Array> {
    return this.stream;
  }

  /**
   * Send an event
   * @param event Event name
   * @param data Event data
   */
  send(event: string, data: unknown): void {
    if (!this.controller) return;

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.controller.enqueue(this.encoder.encode(message));
  }

  /**
   * Send a comment (heartbeat)
   */
  heartbeat(): void {
    if (!this.controller) return;
    this.controller.enqueue(this.encoder.encode(':heartbeat\n\n'));
  }

  /**
   * Close the stream
   */
  close(): void {
    if (this.controller) {
      this.controller.close();
      this.controller = null;
    }
  }

  /**
   * Send an error
   * @param error Error message
   */
  error(error: string): void {
    this.send('error', { message: error });
    this.close();
  }
}

/**
 * Create an A2A SSE stream
 * @returns A2A SSE stream instance
 */
export function createA2ASseStream(): A2ASseStream {
  return new A2ASseStream();
}

/**
 * Validate a JSON-RPC request
 * @param body Request body
 * @returns Validation result
 */
export function validateJsonRpcRequest(body: unknown): {
  valid: boolean;
  request?: JsonRpcRequest;
  error?: string;
} {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Request body must be an object' };
  }

  const req = body as Record<string, unknown>;

  if (req.jsonrpc !== '2.0') {
    return { valid: false, error: 'Invalid JSON-RPC version' };
  }

  if (typeof req.method !== 'string' || req.method.length === 0) {
    return { valid: false, error: 'Method must be a non-empty string' };
  }

  if (!('id' in req)) {
    return { valid: false, error: 'Request must have an id' };
  }

  const id = req.id;
  if (id !== null && typeof id !== 'string' && typeof id !== 'number') {
    return { valid: false, error: 'Id must be a string, number, or null' };
  }

  return {
    valid: true,
    request: body as JsonRpcRequest,
  };
}
