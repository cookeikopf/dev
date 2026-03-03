/**
 * @fileoverview Express adapter for AgentLink SDK
 * @module @agentlink/core/adapters/express
 */

import type { Agent, ExpressMiddleware } from '../types/index.js';
import { AgentImpl } from '../core/agent.js';
import { createJsonRpcResponse, createJsonRpcErrorResponse, createJsonRpcError, JsonRpcErrorCodes } from '../utils/index.js';

// Re-export types for convenience
export type { Agent, ExpressMiddleware } from '../types/index.js';

/**
 * Express request type
 */
export interface ExpressRequest {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  url: string;
  method: string;
  ip?: string;
  path: string;
  query: Record<string, unknown>;
}

/**
 * Express response type
 */
export interface ExpressResponse {
  status: (code: number) => ExpressResponse;
  json: (data: unknown) => void;
  send: (data: string) => void;
  setHeader: (name: string, value: string) => void;
  write: (data: string) => void;
  end: () => void;
}

/**
 * Express next function type
 */
export type ExpressNext = (error?: unknown) => void;

/**
 * Express adapter options
 */
export interface ExpressAdapterOptions {
  /** Path for A2A JSON-RPC endpoint (default: "/a2a") */
  a2aPath?: string;
  /** Path for Agent Card endpoint (default: "/.well-known/agent.json") */
  agentCardPath?: string;
  /** Enable SSE streaming endpoint */
  enableSse?: boolean;
  /** Path for SSE endpoint (default: "/a2a/sse") */
  ssePath?: string;
  /** Custom middleware to run before agent handlers */
  preMiddleware?: (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => void;
  /** Custom middleware to run after agent handlers */
  postMiddleware?: (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => void;
}

/**
 * Default adapter options
 */
const DEFAULT_OPTIONS: ExpressAdapterOptions = {
  a2aPath: '/a2a',
  agentCardPath: '/.well-known/agent.json',
  enableSse: false,
  ssePath: '/a2a/sse',
};

/**
 * Create Express middleware for an AgentLink agent
 * 
 * @param agent Agent instance or AgentImpl
 * @param options Adapter options
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { createAgent } from '@agentlink/core';
 * import { expressAdapter } from '@agentlink/core/adapters/express';
 * 
 * const agent = createAgent({
 *   name: 'MyAgent',
 *   identity: 'eip155:84532/0x...',
 *   capabilities: [...]
 * });
 * 
 * const app = express();
 * app.use(express.json());
 * app.use(expressAdapter(agent));
 * 
 * // Or with custom options
 * app.use('/api/agent', expressAdapter(agent, {
 *   a2aPath: '/rpc',
 *   enableSse: true
 * }));
 * ```
 */
export function expressAdapter(
  agent: Agent | AgentImpl,
  options: ExpressAdapterOptions = {}
): ExpressMiddleware {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const agentImpl = agent instanceof AgentImpl ? agent : (agent as unknown as AgentImpl);

  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    const method = req.method;

    // Run pre-middleware if provided
    if (opts.preMiddleware) {
      opts.preMiddleware(req as unknown as ExpressRequest, res as unknown as ExpressResponse, next);
    }

    // Handle Agent Card endpoint
    if (pathname === opts.agentCardPath && method === 'GET') {
      const baseUrl = `${url.protocol}//${url.host}`;
      const agentCard = agent.generateAgentCard(baseUrl);
      res.json(agentCard);
      return;
    }

    // Handle A2A JSON-RPC endpoint
    if (pathname === opts.a2aPath && method === 'POST') {
      try {
        const body = req.body as { jsonrpc: '2.0'; id: string | number | null; method: string; params?: Record<string, unknown> };
        const response = await agent.handleA2ARequest(body);
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

    // Handle SSE endpoint
    if (opts.enableSse && pathname === opts.ssePath && method === 'GET') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial connection event
      res.write(`event: connected\ndata: ${JSON.stringify({ agent: agent.name })}\n\n`);

      // Keep connection alive with heartbeats
      const interval = setInterval(() => {
        try {
          res.write(':heartbeat\n\n');
        } catch {
          clearInterval(interval);
        }
      }, 30000);

      // Clean up on close
      const cleanup = () => {
        clearInterval(interval);
        res.end();
      };

      // Close after 5 minutes
      setTimeout(cleanup, 300000);

      // Handle client disconnect
      req.headers['connection']?.toString().includes('close') && cleanup();
      return;
    }

    // Run post-middleware if provided
    if (opts.postMiddleware) {
      opts.postMiddleware(req as unknown as ExpressRequest, res as unknown as ExpressResponse, next);
    }

    // Continue to next middleware
    next();
  };
}

/**
 * Create a capability-specific Express handler
 * 
 * @param agent Agent instance
 * @param capabilityId Capability ID to handle
 * @returns Express handler function
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { createAgent } from '@agentlink/core';
 * import { createCapabilityHandler } from '@agentlink/core/adapters/express';
 * 
 * const agent = createAgent({...});
 * const app = express();
 * app.use(express.json());
 * 
 * app.post('/api/research', createCapabilityHandler(agent, 'research'));
 * ```
 */
export function createCapabilityHandler(
  agent: Agent | AgentImpl,
  capabilityId: string
): (req: ExpressRequest, res: ExpressResponse) => Promise<void> {
  return async (req, res) => {
    try {
      const result = await agent.executeCapability(capabilityId, req.body, {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ip: req.ip,
        headers: req.headers,
        timestamp: new Date(),
      });

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      res.status(500).json({ error: message });
    }
  };
}

/**
 * Mount agent routes to an Express app
 * 
 * @param app Express app instance
 * @param agent Agent instance
 * @param options Adapter options
 * @param basePath Base path for agent routes (default: "/")
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { createAgent } from '@agentlink/core';
 * import { mountAgentRoutes } from '@agentlink/core/adapters/express';
 * 
 * const agent = createAgent({...});
 * const app = express();
 * app.use(express.json());
 * 
 * mountAgentRoutes(app, agent, {
 *   a2aPath: '/rpc',
 *   enableSse: true
 * }, '/api/agent');
 * ```
 */
export function mountAgentRoutes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: { get: (path: string, handler: (req: ExpressRequest, res: ExpressResponse) => void) => void; post: (path: string, handler: (req: ExpressRequest, res: ExpressResponse) => void) => void },
  agent: Agent | AgentImpl,
  options: ExpressAdapterOptions = {},
  basePath: string = '/'
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

  // Mount agent card endpoint
  app.get(`${normalizedBasePath}${opts.agentCardPath}`, (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const baseUrl = `${url.protocol}//${url.host}`;
    const agentCard = agent.generateAgentCard(baseUrl);
    res.json(agentCard);
  });

  // Mount A2A JSON-RPC endpoint
  app.post(`${normalizedBasePath}${opts.a2aPath}`, async (req, res) => {
    try {
      const body = req.body as { jsonrpc: '2.0'; id: string | number | null; method: string; params?: Record<string, unknown> };
      const response = await agent.handleA2ARequest(body);
      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid request';
      res.status(400).json(
        createJsonRpcErrorResponse(
          null,
          createJsonRpcError(JsonRpcErrorCodes.PARSE_ERROR, message)
        )
      );
    }
  });

  // Mount SSE endpoint if enabled
  if (opts.enableSse) {
    app.get(`${normalizedBasePath}${opts.ssePath}`, (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      res.write(`event: connected\ndata: ${JSON.stringify({ agent: agent.name })}\n\n`);

      const interval = setInterval(() => {
        try {
          res.write(':heartbeat\n\n');
        } catch {
          clearInterval(interval);
        }
      }, 30000);

      setTimeout(() => {
        clearInterval(interval);
        res.end();
      }, 300000);
    });
  }
}

/**
 * Create Express router with agent routes
 * 
 * @param agent Agent instance
 * @param options Adapter options
 * @returns Express router middleware
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { createAgent } from '@agentlink/core';
 * import { createAgentRouter } from '@agentlink/core/adapters/express';
 * 
 * const agent = createAgent({...});
 * const app = express();
 * 
 * const agentRouter = createAgentRouter(agent, { enableSse: true });
 * app.use('/api/agent', agentRouter);
 * ```
 */
export function createAgentRouter(
  agent: Agent | AgentImpl,
  options: ExpressAdapterOptions = {}
): ExpressMiddleware {
  return expressAdapter(agent, options);
}
