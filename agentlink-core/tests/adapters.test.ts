import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgent, createCapability } from '../src/core/agent.js';
import { honoAdapter, createCapabilityHandler as honoCapabilityHandler, mountAgentRoutes as honoMountRoutes } from '../src/adapters/hono.js';
import { expressAdapter, createCapabilityHandler as expressCapabilityHandler, mountAgentRoutes as expressMountRoutes } from '../src/adapters/express.js';
import { nextAdapter, createCapabilityHandler as nextCapabilityHandler, createRouteHandlers, edgeHandler } from '../src/adapters/next.js';
import type { Agent } from '../src/types/index.js';

describe('Adapters', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = createAgent({
      name: 'TestAgent',
      identity: 'eip155:84532/0x1234567890abcdef1234567890abcdef12345678',
      capabilities: [
        createCapability()
          .id('test-cap')
          .name('Test')
          .description('Test capability')
          .handler(async (input) => input)
          .build(),
      ],
    });
  });

  describe('Hono Adapter', () => {
    describe('honoAdapter', () => {
      it('should return middleware function', () => {
        const middleware = honoAdapter(agent);
        expect(typeof middleware).toBe('function');
      });

      it('should handle agent card request', async () => {
        const middleware = honoAdapter(agent);
        const ctx = createMockHonoContext('GET', '/.well-known/agent.json');
        const next = vi.fn();

        await middleware(ctx, next);

        expect(ctx.json).toHaveBeenCalled();
        const response = ctx.json.mock.calls[0]![0];
        expect(response.name).toBe('TestAgent');
      });

      it('should handle A2A JSON-RPC request', async () => {
        const middleware = honoAdapter(agent);
        const ctx = createMockHonoContext('POST', '/a2a', {
          jsonrpc: '2.0',
          id: '1',
          method: 'a2a.discover',
        });
        const next = vi.fn();

        await middleware(ctx, next);

        expect(ctx.json).toHaveBeenCalled();
        const response = ctx.json.mock.calls[0]![0];
        expect(response.jsonrpc).toBe('2.0');
      });

      it('should handle invalid JSON-RPC', async () => {
        const middleware = honoAdapter(agent);
        const ctx = createMockHonoContext('POST', '/a2a', 'invalid');
        ctx.req.json = vi.fn().mockRejectedValue(new Error('Invalid JSON'));
        const next = vi.fn();

        await middleware(ctx, next);

        expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({
          error: expect.objectContaining({ code: -32700 }),
        }), 400);
      });

      it('should call next for unmatched routes', async () => {
        const middleware = honoAdapter(agent);
        const ctx = createMockHonoContext('GET', '/other');
        const next = vi.fn();

        await middleware(ctx, next);

        expect(next).toHaveBeenCalled();
      });

      it('should support custom options', async () => {
        const middleware = honoAdapter(agent, {
          a2aPath: '/custom/rpc',
          agentCardPath: '/custom/card.json',
        });
        const ctx = createMockHonoContext('GET', '/custom/card.json');
        const next = vi.fn();

        await middleware(ctx, next);

        expect(ctx.json).toHaveBeenCalled();
      });
    });

    describe('createCapabilityHandler', () => {
      it('should return handler function', () => {
        const handler = honoCapabilityHandler(agent, 'test-cap');
        expect(typeof handler).toBe('function');
      });

      it('should execute capability', async () => {
        const handler = honoCapabilityHandler(agent, 'test-cap');
        const ctx = createMockHonoContext('POST', '/api/test', { value: 42 });

        await handler(ctx);

        expect(ctx.json).toHaveBeenCalledWith({ value: 42 });
      });

      it('should handle errors', async () => {
        const handler = honoCapabilityHandler(agent, 'non-existent');
        const ctx = createMockHonoContext('POST', '/api/test', {});

        await handler(ctx);

        expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({
          error: expect.any(String),
        }), 500);
      });
    });
  });

  describe('Express Adapter', () => {
    describe('expressAdapter', () => {
      it('should return middleware function', () => {
        const middleware = expressAdapter(agent);
        expect(typeof middleware).toBe('function');
      });

      it('should handle agent card request', async () => {
        const middleware = expressAdapter(agent);
        const req = createMockExpressRequest('GET', '/.well-known/agent.json');
        const res = createMockExpressResponse();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(res.json).toHaveBeenCalled();
        const response = res.json.mock.calls[0]![0];
        expect(response.name).toBe('TestAgent');
      });

      it('should handle A2A JSON-RPC request', async () => {
        const middleware = expressAdapter(agent);
        const req = createMockExpressRequest('POST', '/a2a', {
          jsonrpc: '2.0',
          id: '1',
          method: 'a2a.discover',
        });
        const res = createMockExpressResponse();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(res.json).toHaveBeenCalled();
        const response = res.json.mock.calls[0]![0];
        expect(response.jsonrpc).toBe('2.0');
      });

      it('should handle invalid JSON-RPC', async () => {
        const middleware = expressAdapter(agent);
        const req = createMockExpressRequest('POST', '/a2a', 'invalid');
        const res = createMockExpressResponse();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should call next for unmatched routes', async () => {
        const middleware = expressAdapter(agent);
        const req = createMockExpressRequest('GET', '/other');
        const res = createMockExpressResponse();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });
    });

    describe('createCapabilityHandler', () => {
      it('should return handler function', () => {
        const handler = expressCapabilityHandler(agent, 'test-cap');
        expect(typeof handler).toBe('function');
      });

      it('should execute capability', async () => {
        const handler = expressCapabilityHandler(agent, 'test-cap');
        const req = createMockExpressRequest('POST', '/api/test', { value: 42 });
        const res = createMockExpressResponse();

        await handler(req, res);

        expect(res.json).toHaveBeenCalledWith({ value: 42 });
      });

      it('should handle errors', async () => {
        const handler = expressCapabilityHandler(agent, 'non-existent');
        const req = createMockExpressRequest('POST', '/api/test', {});
        const res = createMockExpressResponse();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe('Next.js Adapter', () => {
    describe('nextAdapter', () => {
      it('should return handler function', () => {
        const handler = nextAdapter(agent);
        expect(typeof handler).toBe('function');
      });

      it('should handle agent card request', async () => {
        const handler = nextAdapter(agent);
        const req = createMockNextRequest('GET', '/.well-known/agent.json');

        const response = await handler(req);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.name).toBe('TestAgent');
      });

      it('should handle A2A JSON-RPC request', async () => {
        const handler = nextAdapter(agent);
        const req = createMockNextRequest('POST', '/a2a', {
          jsonrpc: '2.0',
          id: '1',
          method: 'a2a.discover',
        });

        const response = await handler(req);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.jsonrpc).toBe('2.0');
      });

      it('should handle CORS preflight', async () => {
        const handler = nextAdapter(agent, {
          cors: { origin: 'https://example.com' },
        });
        const req = createMockNextRequest('OPTIONS', '/a2a');

        const response = await handler(req);

        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      });

      it('should return 404 for unmatched routes', async () => {
        const handler = nextAdapter(agent);
        const req = createMockNextRequest('GET', '/other');

        const response = await handler(req);

        expect(response.status).toBe(404);
      });
    });

    describe('createCapabilityHandler', () => {
      it('should return handler function', () => {
        const handler = nextCapabilityHandler(agent, 'test-cap');
        expect(typeof handler).toBe('function');
      });

      it('should execute capability', async () => {
        const handler = nextCapabilityHandler(agent, 'test-cap');
        const req = createMockNextRequest('POST', '/api/test', { value: 42 });

        const response = await handler(req);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({ value: 42 });
      });

      it('should handle errors', async () => {
        const handler = nextCapabilityHandler(agent, 'non-existent');
        const req = createMockNextRequest('POST', '/api/test', {});

        const response = await handler(req);

        expect(response.status).toBe(500);
      });
    });

    describe('createRouteHandlers', () => {
      it('should return GET and POST handlers', () => {
        const handlers = createRouteHandlers(agent);
        expect(typeof handlers.GET).toBe('function');
        expect(typeof handlers.POST).toBe('function');
      });
    });

    describe('edgeHandler', () => {
      it('should return edge-compatible handler', () => {
        const handler = edgeHandler(agent);
        expect(typeof handler).toBe('function');
      });

      it('should handle requests', async () => {
        const handler = edgeHandler(agent);
        const request = new Request('http://localhost/.well-known/agent.json');

        const response = await handler(request);

        expect(response.status).toBe(200);
      });
    });
  });
});

// Mock helpers
function createMockHonoContext(method: string, path: string, body?: unknown) {
  const url = `http://localhost${path}`;
  return {
    req: {
      json: vi.fn().mockResolvedValue(body ?? {}),
      header: vi.fn().mockReturnValue(undefined),
      url,
      method,
      path,
    },
    json: vi.fn().mockReturnValue(new Response()),
    text: vi.fn().mockReturnValue(new Response()),
    body: vi.fn().mockReturnValue(new Response()),
    header: vi.fn(),
  };
}

function createMockExpressRequest(method: string, path: string, body?: unknown) {
  return {
    body: body ?? {},
    headers: {},
    url: path,
    method,
    path,
    query: {},
    ip: '127.0.0.1',
  };
}

function createMockExpressResponse() {
  const res: {
    statusCode: number;
    headers: Record<string, string>;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  } = {
    statusCode: 200,
    headers: {},
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockImplementation((name: string, value: string) => {
      res.headers[name] = value;
      return res;
    }),
    write: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
  return res;
}

function createMockNextRequest(method: string, path: string, body?: unknown) {
  const url = `http://localhost${path}`;
  const headers = new Headers();
  
  return {
    json: vi.fn().mockResolvedValue(body ?? {}),
    headers,
    url,
    method,
    nextUrl: {
      pathname: path,
      search: '',
      searchParams: new URLSearchParams(),
    },
  };
}
