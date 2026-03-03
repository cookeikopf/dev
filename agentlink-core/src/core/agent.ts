/**
 * @fileoverview Core Agent implementation for AgentLink SDK
 * @module @agentlink/core/core/agent
 */

import type {
  Agent,
  AgentConfig,
  AgentIdentity,
  AgentCard,
  Capability,
  CapabilityContext,
  RequestContext,
  TelemetryEmitter,
  JsonRpcRequest,
  JsonRpcResponse,
  HonoMiddleware,
  ExpressMiddleware,
  NextJsHandler,
  PricingConfig,
  X402Config,
  TelemetryConfig,
  A2AConfig,
  CapabilityHandler,
  CapabilityInput,
  CapabilityOutput,
  IdentityReference,
  PaymentContext,
} from '../types/index.js';
import { TelemetryManager } from '../telemetry/index.js';
import { A2AHandler } from '../a2a/index.js';
import { X402PaymentManager, createX402Middleware } from '../x402/index.js';
import {
  generateId,
  parseIdentityReference,
  createJsonRpcResponse,
  createJsonRpcErrorResponse,
  createJsonRpcError,
  JsonRpcErrorCodes,
  sanitizeForLogging,
  assertDefined,
} from '../utils/index.js';

/**
 * Default agent configuration
 */
const DEFAULT_AGENT_CONFIG: Partial<AgentConfig> = {
  version: '1.0.0',
  a2a: {
    path: '/',
    enableSse: false,
    agentCardPath: '/.well-known/agent.json',
  },
  telemetry: {
    enabled: true,
  },
};

/**
 * Agent implementation
 */
export class AgentImpl implements Agent {
  readonly config: Readonly<AgentConfig>;
  readonly name: string;
  readonly identity: AgentIdentity;
  readonly capabilities: Map<string, Capability>;
  readonly telemetry: TelemetryEmitter;
  readonly agentCard: AgentCard;

  private a2aHandler: A2AHandler;
  private paymentManager: X402PaymentManager | null;
  private telemetryManager: TelemetryManager;
  private x402Middleware: ReturnType<typeof createX402Middleware> | null = null;

  /**
   * Create a new agent
   * @param config Agent configuration
   */
  constructor(config: AgentConfig) {
    // Validate required fields
    assertDefined(config.name, 'Agent name is required');
    assertDefined(config.identity, 'Agent identity is required');
    assertDefined(config.capabilities, 'Agent capabilities are required');

    // Parse and validate identity
    const identityRef = config.identity;
    const { chainId, address } = parseIdentityReference(identityRef);

    // Merge with defaults
    this.config = {
      ...DEFAULT_AGENT_CONFIG,
      ...config,
      a2a: { ...DEFAULT_AGENT_CONFIG.a2a, ...config.a2a },
      telemetry: { ...DEFAULT_AGENT_CONFIG.telemetry, ...config.telemetry },
    } as AgentConfig;

    this.name = this.config.name;
    this.identity = {
      reference: identityRef,
      name: this.config.name,
      description: this.config.description,
    };

    // Initialize capabilities map
    this.capabilities = new Map();
    for (const cap of config.capabilities) {
      this.capabilities.set(cap.id, cap);
    }

    // Initialize telemetry
    this.telemetryManager = new TelemetryManager(this.config.telemetry);
    this.telemetry = this.telemetryManager;

    // Initialize A2A handler
    this.a2aHandler = new A2AHandler(this.config.a2a);
    this.a2aHandler.setAgent(this);

    // Initialize payment manager if x402 config provided
    if (this.config.x402) {
      this.paymentManager = new X402PaymentManager(this.config.x402);
      this.x402Middleware = createX402Middleware(
        this.paymentManager,
        (id) => this.capabilities.get(id)
      );
    } else {
      this.paymentManager = null;
    }

    // Generate initial agent card
    this.agentCard = this.generateAgentCard(this.config.url ?? 'http://localhost');
  }

  /**
   * Register a new capability
   * @param capability Capability to register
   * @returns This agent (for chaining)
   */
  registerCapability(capability: Capability): this {
    this.capabilities.set(capability.id, capability);
    return this;
  }

  /**
   * Unregister a capability
   * @param capabilityId Capability ID to unregister
   * @returns This agent (for chaining)
   */
  unregisterCapability(capabilityId: string): this {
    this.capabilities.delete(capabilityId);
    return this;
  }

  /**
   * Execute a capability
   * @param capabilityId Capability ID to execute
   * @param input Input data
   * @param requestContext Request context
   * @returns Capability output
   */
  async executeCapability<TInput = unknown, TOutput = unknown>(
    capabilityId: string,
    input: TInput,
    requestContext?: Partial<RequestContext>
  ): Promise<TOutput> {
    const startTime = Date.now();
    const requestId = requestContext?.id ?? generateId();

    try {
      // Get capability
      const capability = this.capabilities.get(capabilityId);
      if (!capability) {
        throw new Error(`Capability not found: ${capabilityId}`);
      }

      // Build full request context
      const fullRequestContext: RequestContext = {
        id: requestId,
        ip: requestContext?.ip,
        headers: requestContext?.headers ?? {},
        timestamp: requestContext?.timestamp ?? new Date(),
      };

      // Build capability context
      const context: CapabilityContext = {
        agent: this,
        request: fullRequestContext,
        telemetry: this.telemetry,
      };

      // Execute capability
      const result = await capability.handler(input, context);

      // Record telemetry
      const duration = Date.now() - startTime;
      await this.telemetryManager.recordCapabilityInvoke({
        requestId,
        capabilityId,
        agentName: this.name,
        input: sanitizeForLogging(input),
        success: true,
        duration,
      });

      return result as TOutput;
    } catch (error) {
      // Record error telemetry
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.telemetryManager.recordCapabilityInvoke({
        requestId,
        capabilityId,
        agentName: this.name,
        input: sanitizeForLogging(input),
        success: false,
        error: errorMessage,
        duration,
      });

      await this.telemetryManager.recordError({
        requestId,
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        capabilityId,
      });

      throw error;
    }
  }

  /**
   * Generate the Agent Card
   * @param baseUrl Base URL for the agent
   * @returns Agent Card
   */
  generateAgentCard(baseUrl: string): AgentCard {
    return this.a2aHandler.generateAgentCard(baseUrl);
  }

  /**
   * Handle an A2A JSON-RPC request
   * @param request JSON-RPC request
   * @returns JSON-RPC response
   */
  async handleA2ARequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    return this.a2aHandler.handleRequest(request);
  }

  /**
   * Get Hono middleware
   * @returns Hono middleware function
   */
  honoMiddleware(): HonoMiddleware {
    return async (ctx, next) => {
      const url = new URL(ctx.req.url);
      const method = ctx.req.method;

      // Handle Agent Card endpoint
      if (url.pathname === this.a2aHandler.getAgentCardPath() && method === 'GET') {
        const baseUrl = `${url.protocol}//${url.host}`;
        const agentCard = this.generateAgentCard(baseUrl);
        return ctx.json(agentCard);
      }

      // Handle A2A JSON-RPC endpoint
      if (method === 'POST') {
        try {
          const body = await ctx.req.json() as JsonRpcRequest;
          const response = await this.handleA2ARequest(body);
          return ctx.json(response);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid request';
          return ctx.json(
            createJsonRpcErrorResponse(
              null,
              createJsonRpcError(JsonRpcErrorCodes.PARSE_ERROR, message)
            ),
            400
          );
        }
      }

      // Continue to next middleware
      await next();
    };
  }

  /**
   * Get Express middleware
   * @returns Express middleware function
   */
  expressMiddleware(): ExpressMiddleware {
    return async (req, res, next) => {
      const url = new URL(req.url, 'http://localhost');
      const method = req.method;

      // Handle Agent Card endpoint
      if (url.pathname === this.a2aHandler.getAgentCardPath() && method === 'GET') {
        const baseUrl = `${url.protocol}//${url.host}`;
        const agentCard = this.generateAgentCard(baseUrl);
        res.json(agentCard);
        return;
      }

      // Handle A2A JSON-RPC endpoint
      if (method === 'POST') {
        try {
          const body = req.body as JsonRpcRequest;
          const response = await this.handleA2ARequest(body);
          res.json(response);
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid request';
          res.status(400).json(
            createJsonRpcErrorResponse(
              null,
              createJsonRpcError(JsonRpcErrorCodes.PARSE_ERROR, message)
            )
          );
          return;
        }
      }

      // Continue to next middleware
      next();
    };
  }

  /**
   * Get Next.js handler
   * @returns Next.js handler function
   */
  nextJsHandler(): NextJsHandler {
    return async (req) => {
      const url = new URL(req.url);
      const method = req.method;

      // Handle Agent Card endpoint
      if (url.pathname === this.a2aHandler.getAgentCardPath() && method === 'GET') {
        const baseUrl = `${url.protocol}//${url.host}`;
        const agentCard = this.generateAgentCard(baseUrl);
        return new Response(JSON.stringify(agentCard), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle A2A JSON-RPC endpoint
      if (method === 'POST') {
        try {
          const body = await req.json() as JsonRpcRequest;
          const response = await this.handleA2ARequest(body);
          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid request';
          return new Response(
            JSON.stringify(
              createJsonRpcErrorResponse(
                null,
                createJsonRpcError(JsonRpcErrorCodes.PARSE_ERROR, message)
              )
            ),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response('Not Found', { status: 404 });
    };
  }

  /**
   * Get the payment manager
   * @returns Payment manager or null if not configured
   */
  getPaymentManager(): X402PaymentManager | null {
    return this.paymentManager;
  }

  /**
   * Get the A2A handler
   * @returns A2A handler
   */
  getA2AHandler(): A2AHandler {
    return this.a2aHandler;
  }

  /**
   * Get the telemetry manager
   * @returns Telemetry manager
   */
  getTelemetryManager(): TelemetryManager {
    return this.telemetryManager;
  }

  /**
   * Check if x402 payment is enabled
   * @returns True if payment is enabled
   */
  isPaymentEnabled(): boolean {
    return this.paymentManager !== null;
  }
}

/**
 * Capability builder for fluent API
 */
export class CapabilityBuilder {
  private capability: Partial<Capability> = {};

  /**
   * Set capability ID
   * @param id Capability ID
   */
  id(id: string): this {
    this.capability.id = id;
    return this;
  }

  /**
   * Set capability name
   * @param name Capability name
   */
  name(name: string): this {
    this.capability.name = name;
    return this;
  }

  /**
   * Set capability description
   * @param description Capability description
   */
  description(description: string): this {
    this.capability.description = description;
    return this;
  }

  /**
   * Set capability input schema
   * @param input Input specification
   */
  input(input: CapabilityInput): this {
    this.capability.input = input;
    return this;
  }

  /**
   * Set capability output schema
   * @param output Output specification
   */
  output(output: CapabilityOutput): this {
    this.capability.output = output;
    return this;
  }

  /**
   * Set capability pricing
   * @param pricing Price in USDC
   */
  pricing(pricing: number): this {
    this.capability.pricing = pricing;
    this.capability.requiresPayment = pricing > 0;
    return this;
  }

  /**
   * Set whether payment is required
   * @param requiresPayment Whether payment is required
   */
  requiresPayment(requiresPayment: boolean): this {
    this.capability.requiresPayment = requiresPayment;
    return this;
  }

  /**
   * Set capability handler
   * @param handler Handler function
   */
  handler<TInput = unknown, TOutput = unknown>(
    handler: CapabilityHandler<TInput, TOutput>
  ): this {
    this.capability.handler = handler as CapabilityHandler;
    return this;
  }

  /**
   * Build the capability
   * @returns Capability instance
   */
  build(): Capability {
    if (!this.capability.id) {
      throw new Error('Capability ID is required');
    }
    if (!this.capability.name) {
      throw new Error('Capability name is required');
    }
    if (!this.capability.description) {
      throw new Error('Capability description is required');
    }
    if (!this.capability.handler) {
      throw new Error('Capability handler is required');
    }

    return {
      id: this.capability.id,
      name: this.capability.name,
      description: this.capability.description,
      input: this.capability.input,
      output: this.capability.output,
      pricing: this.capability.pricing,
      requiresPayment: this.capability.requiresPayment ?? false,
      handler: this.capability.handler,
    };
  }
}

/**
 * Create a capability builder
 * @returns Capability builder
 */
export function createCapability(): CapabilityBuilder {
  return new CapabilityBuilder();
}

/**
 * Create an agent
 * @param config Agent configuration
 * @returns Agent instance
 * 
 * @example
 * ```typescript
 * const agent = createAgent({
 *   name: 'ResearchAgent',
 *   identity: 'eip155:84532/0x1234567890abcdef...',
 *   capabilities: [
 *     createCapability()
 *       .id('research')
 *       .name('Research')
 *       .description('Research a topic')
 *       .pricing(0.01)
 *       .handler(async (input) => {
 *         // Research logic
 *         return { result: 'Research complete' };
 *       })
 *       .build()
 *   ],
 *   x402: {
 *     usdcAddress: '0x...',
 *     chainId: 84532,
 *     receiver: '0x...'
 *   }
 * });
 * ```
 */
export function createAgent(config: AgentConfig): Agent {
  return new AgentImpl(config);
}
