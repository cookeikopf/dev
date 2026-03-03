/**
 * AgentLink Core - Hono Adapter
 */

import type { Context, Hono, MiddlewareHandler } from 'hono';
import type { Agent, AdapterOptions, HTTPResponse } from '../types/index.js';
import { createPaymentRequirement, createPaymentRequiredResponse, parsePaymentProof, verifyPayment, requiresPayment } from '../x402/index.js';
import { generateId } from '../utils/index.js';

export interface HonoAdapterOptions extends AdapterOptions {
  enableSse?: boolean;
}

/**
 * Create Hono middleware for AgentLink agent
 */
export function honoAdapter(
  agent: Agent,
  options: HonoAdapterOptions = {}
): MiddlewareHandler {
  const { enableSse = false, cors } = options;

  return async (c: Context) => {
    // Handle CORS preflight
    if (c.req.method === 'OPTIONS') {
      return handleCors(c, cors);
    }

    const path = c.req.path;
    const method = c.req.method;

    try {
      // Agent card discovery
      if (method === 'GET' && path.endsWith('/.well-known/agent.json')) {
        return c.json(agent.getAgentCard());
      }

      // Health check
      if (method === 'GET' && path.endsWith('/health')) {
        return c.json({
          status: 'healthy',
          agent: agent.name,
          version: agent.version,
          timestamp: new Date().toISOString(),
        });
      }

      // List capabilities
      if (method === 'GET' && path.endsWith('/capabilities')) {
        return c.json({
          capabilities: agent.listCapabilities(),
        });
      }

      // A2A JSON-RPC endpoint
      if (method === 'POST' && path.endsWith('/a2a')) {
        const body = await c.req.json();
        return handleA2ARequest(c, agent, body);
      }

      // Capability execution
      if (method === 'POST') {
        const capabilityMatch = path.match(/\/capabilities\/([^\/]+)$/);
        if (capabilityMatch) {
          const capabilityId = capabilityMatch[1];
          const body = await c.req.json();
          return handleCapabilityRequest(c, agent, capabilityId, body, options);
        }
      }

      return c.json({ error: 'Not Found' }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  };
}

/**
 * Create a handler for a specific capability
 */
export function createCapabilityHandler(
  agent: Agent,
  capabilityId: string,
  options: { enablePayment?: boolean } = {}
): MiddlewareHandler {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      return handleCapabilityRequest(c, agent, capabilityId, body, {
        enablePayment: options.enablePayment ?? true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  };
}

async function handleCors(c: Context, cors?: { origin: string | string[] }): Promise<Response> {
  const origin = Array.isArray(cors?.origin) ? cors.origin[0] : cors?.origin || '*';
  
  c.res.headers.set('Access-Control-Allow-Origin', origin);
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment-Proof');
  
  return c.body(null, 204);
}

async function handleA2ARequest(
  c: Context,
  agent: Agent,
  body: { jsonrpc?: string; method?: string; id?: string | number; params?: unknown }
): Promise<Response> {
  // Validate JSON-RPC
  if (body.jsonrpc !== '2.0') {
    return c.json({
      jsonrpc: '2.0',
      id: body.id || null,
      error: { code: -32600, message: 'Invalid Request' },
    }, 400);
  }

  const { method, params, id } = body;

  switch (method) {
    case 'a2a.discover':
      return c.json({
        jsonrpc: '2.0',
        id,
        result: agent.getAgentCard(),
      });

    case 'a2a.capabilities':
      return c.json({
        jsonrpc: '2.0',
        id,
        result: { capabilities: agent.listCapabilities() },
      });

    case 'a2a.execute': {
      const { capabilityId, input } = params as { capabilityId: string; input: unknown };
      
      if (!capabilityId) {
        return c.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Missing capabilityId parameter' },
        }, 400);
      }

      try {
        const result = await agent.executeCapability(capabilityId, input, {
          request: {
            id: generateId(),
            headers: Object.fromEntries(c.req.headers.entries()),
            timestamp: new Date(),
          },
        });

        return c.json({
          jsonrpc: '2.0',
          id,
          result,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return c.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message },
        }, 500);
      }
    }

    default:
      return c.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      }, 404);
  }
}

async function handleCapabilityRequest(
  c: Context,
  agent: Agent,
  capabilityId: string,
  body: { input?: unknown },
  options: { enablePayment?: boolean }
): Promise<Response> {
  const capability = agent.getCapability(capabilityId);
  
  if (!capability) {
    return c.json({ error: `Capability not found: ${capabilityId}` }, 404);
  }

  // Check if payment is required
  const paymentCheck = requiresPayment(capabilityId, { agent } as any);
  
  if (paymentCheck.required && paymentCheck.amount && options.enablePayment && agent.x402) {
    // Check for payment proof header
    const paymentProofHeader = c.req.header('X-Payment-Proof');
    
    if (!paymentProofHeader) {
      // Return 402 Payment Required
      const requirement = createPaymentRequirement(
        paymentCheck.amount * 1_000_000, // Convert to base units
        agent.x402
      );
      
      const response = createPaymentRequiredResponse(requirement);
      return c.json(response, 402);
    }
    
    // Verify payment proof
    try {
      const proof = parsePaymentProof(paymentProofHeader);
      const verification = await verifyPayment(
        proof,
        paymentCheck.amount * 1_000_000,
        agent.x402
      );
      
      if (!verification.valid) {
        return c.json({
          error: 'Payment verification failed',
          details: verification.error,
        }, 402);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: `Invalid payment proof: ${message}` }, 400);
    }
  }

  // Execute capability
  try {
    const result = await agent.executeCapability(capabilityId, body.input, {
      request: {
        id: generateId(),
        headers: Object.fromEntries(c.req.headers.entries()),
        timestamp: new Date(),
      },
    });

    return c.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 500);
  }
}
