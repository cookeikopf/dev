/**
 * @fileoverview Next.js adapter for AgentLink SDK
 * @module @agentlink/core/adapters/next
 */

import type { Agent, NextJsHandler, JsonRpcRequest } from '../types/index.js';
import { AgentImpl } from '../core/agent.js';
import { createJsonRpcResponse, createJsonRpcErrorResponse, createJsonRpcError, JsonRpcErrorCodes } from '../utils/index.js';

// Re-export types for convenience
export type { Agent, NextJsHandler } from '../types/index.js';

/**
 * Next.js request type
 */
export interface NextRequest {
  json: () => Promise<unknown>;
  headers: Headers;
  url: string;
  method: string;
  nextUrl: {
    pathname: string;
    search: string;
    searchParams: URLSearchParams;
  };
}

/**
 * Next.js adapter options
 */
export interface NextAdapterOptions {
  /** Path for A2A JSON-RPC endpoint (default: "/a2a") */
  a2aPath?: string;
  /** Path for Agent Card endpoint (default: "/.well-known/agent.json") */
  agentCardPath?: string;
  /** Enable SSE streaming endpoint */
  enableSse?: boolean;
  /** Path for SSE endpoint (default: "/a2a/sse") */
  ssePath?: string;
  /** CORS headers to add to responses */
  cors?: {
    origin?: string;
    methods?: string;
    headers?: string;
  };
}

/**
 * Default adapter options
 */
const DEFAULT_OPTIONS: NextAdapterOptions = {
  a2aPath: '/a2a',
  agentCardPath: '/.well-known/agent.json',
  enableSse: false,
  ssePath: '/a2a/sse',
};

/**
 * Default CORS headers
 */
const DEFAULT_CORS = {
  origin: '*',
  methods: 'GET, POST, OPTIONS',
  headers: 'Content-Type, Authorization',
};

/**
 * Create CORS headers
 * @param cors CORS options
 * @returns Header record
 */
function createCorsHeaders(cors?: NextAdapterOptions['cors']): Record<string, string> {
  const options = { ...DEFAULT_CORS, ...cors };
  return {
    'Access-Control-Allow-Origin': options.origin ?? '*',
    'Access-Control-Allow-Methods': options.methods ?? 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': options.headers ?? 'Content-Type, Authorization',
  };
}

/**
 * Create Next.js handler for an AgentLink agent
 * 
 * @param agent Agent instance or AgentImpl
 * @param options Adapter options
 * @returns Next.js handler function
 * 
 * @example
 * ```typescript
 * // app/api/agent/route.ts
 * import { createAgent } from '@agentlink/core';
 * import { nextAdapter } from '@agentlink/core/adapters/next';
 * 
 * const agent = createAgent({
 *   name: 'MyAgent',
 *   identity: 'eip155:84532/0x...',
 *   capabilities: [...]
 * });
 * 
 * export const GET = nextAdapter(agent);
 * export const POST = nextAdapter(agent);
 * ```
 */
export function nextAdapter(
  agent: Agent | AgentImpl,
  options: NextAdapterOptions = {}
): NextJsHandler {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const agentImpl = agent instanceof AgentImpl ? agent : (agent as unknown as AgentImpl);
  const corsHeaders = createCorsHeaders(opts.cors);

  return async (req) => {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Handle Agent Card endpoint
    if (pathname === opts.agentCardPath && method === 'GET') {
      const baseUrl = `${url.protocol}//${url.host}`;
      const agentCard = agent.generateAgentCard(baseUrl);
      return new Response(JSON.stringify(agentCard), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Handle A2A JSON-RPC endpoint
    if (pathname === opts.a2aPath && method === 'POST') {
      try {
        const body = await req.json() as JsonRpcRequest;
        const response = await agent.handleA2ARequest(body);
        return new Response(JSON.stringify(response), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
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
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }

    // Handle SSE endpoint
    if (opts.enableSse && pathname === opts.ssePath && method === 'GET') {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          
          // Send initial connection event
          const message = `event: connected\ndata: ${JSON.stringify({ agent: agent.name })}\n\n`;
          controller.enqueue(encoder.encode(message));

          // Keep connection alive with heartbeats
          const interval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(':heartbeat\n\n'));
            } catch {
              clearInterval(interval);
            }
          }, 30000);

          // Clean up on close
          const cleanup = () => {
            clearInterval(interval);
            controller.close();
          };

          // Close after 5 minutes
          setTimeout(cleanup, 300000);
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders,
        },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  };
}

/**
 * Create a capability-specific Next.js handler
 * 
 * @param agent Agent instance
 * @param capabilityId Capability ID to handle
 * @returns Next.js handler function
 * 
 * @example
 * ```typescript
 * // app/api/research/route.ts
 * import { createAgent } from '@agentlink/core';
 * import { createCapabilityHandler } from '@agentlink/core/adapters/next';
 * 
 * const agent = createAgent({...});
 * export const POST = createCapabilityHandler(agent, 'research');
 * ```
 */
export function createCapabilityHandler(
  agent: Agent | AgentImpl,
  capabilityId: string
): (req: NextRequest) => Promise<Response> {
  return async (req) => {
    try {
      const body = await req.json();
      
      const result = await agent.executeCapability(capabilityId, body, {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        headers: Object.fromEntries(req.headers.entries()),
        timestamp: new Date(),
      });

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

/**
 * Create route handlers for Next.js App Router
 * 
 * @param agent Agent instance
 * @param options Adapter options
 * @returns Object with GET and POST handlers
 * 
 * @example
 * ```typescript
 * // app/api/agent/route.ts
 * import { createAgent } from '@agentlink/core';
 * import { createRouteHandlers } from '@agentlink/core/adapters/next';
 * 
 * const agent = createAgent({...});
 * export const { GET, POST } = createRouteHandlers(agent, { enableSse: true });
 * ```
 */
export function createRouteHandlers(
  agent: Agent | AgentImpl,
  options: NextAdapterOptions = {}
): { GET: NextJsHandler; POST: NextJsHandler } {
  const handler = nextAdapter(agent, options);
  return {
    GET: handler,
    POST: handler,
  };
}

/**
 * Create a Next.js config-based route handler
 * This creates handlers for specific paths in the Next.js App Router
 * 
 * @param agent Agent instance
 * @param path Route path
 * @param options Adapter options
 * @returns Handler for the specified path
 * 
 * @example
 * ```typescript
 * // app/api/agent/[...path]/route.ts
 * import { createAgent } from '@agentlink/core';
 * import { createPathHandler } from '@agentlink/core/adapters/next';
 * 
 * const agent = createAgent({...});
 * export const GET = createPathHandler(agent, '/.well-known/agent.json');
 * export const POST = createPathHandler(agent, '/a2a');
 * ```
 */
export function createPathHandler(
  agent: Agent | AgentImpl,
  path: string,
  options: Omit<NextAdapterOptions, 'a2aPath' | 'agentCardPath'> = {}
): NextJsHandler {
  const opts: NextAdapterOptions = {
    ...options,
    a2aPath: path,
    agentCardPath: path,
  };
  return nextAdapter(agent, opts);
}

/**
 * Edge runtime compatible handler
 * For use with Next.js Edge Runtime
 * 
 * @param agent Agent instance
 * @param options Adapter options
 * @returns Edge-compatible handler
 * 
 * @example
 * ```typescript
 * // app/api/agent/route.ts
 * import { createAgent } from '@agentlink/core';
 * import { edgeHandler } from '@agentlink/core/adapters/next';
 * 
 * export const runtime = 'edge';
 * 
 * const agent = createAgent({...});
 * export default edgeHandler(agent);
 * ```
 */
export function edgeHandler(
  agent: Agent | AgentImpl,
  options: NextAdapterOptions = {}
): (request: Request) => Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const corsHeaders = createCorsHeaders(opts.cors);

  return async (request: Request) => {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Handle Agent Card endpoint
    if (pathname === opts.agentCardPath && method === 'GET') {
      const baseUrl = `${url.protocol}//${url.host}`;
      const agentCard = agent.generateAgentCard(baseUrl);
      return new Response(JSON.stringify(agentCard), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Handle A2A JSON-RPC endpoint
    if (pathname === opts.a2aPath && method === 'POST') {
      try {
        const body = await request.json() as JsonRpcRequest;
        const response = await agent.handleA2ARequest(body);
        return new Response(JSON.stringify(response), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
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
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }

    // Handle SSE endpoint
    if (opts.enableSse && pathname === opts.ssePath && method === 'GET') {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          
          const message = `event: connected\ndata: ${JSON.stringify({ agent: agent.name })}\n\n`;
          controller.enqueue(encoder.encode(message));

          const interval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(':heartbeat\n\n'));
            } catch {
              clearInterval(interval);
            }
          }, 30000);

          setTimeout(() => {
            clearInterval(interval);
            controller.close();
          }, 300000);
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders,
        },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  };
}
