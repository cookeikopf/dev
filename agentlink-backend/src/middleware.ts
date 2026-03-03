/**
 * AgentLink MVP - Next.js Middleware
 * Handles authentication, CORS, and security headers
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CORS configuration
const CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://agentlink.io',
];

const CORS_ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization, X-API-Key, X-Signature, X-Signature-Type, X-Timestamp, X-Provider';
const CORS_MAX_AGE = '86400'; // 24 hours

// Rate limit configuration for middleware (in-memory, per-instance)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Paths that don't require authentication
const PUBLIC_PATHS = [
    '/api/auth/',
    '/api/webhooks/receiver',
    '/_next/',
    '/static/',
    '/favicon.ico',
    '/health',
];

// Paths that require API key or signature authentication
const AGENT_AUTH_PATHS = [
    '/api/telemetry',
];

/**
 * Check if path is public
 */
function isPublicPath(path: string): boolean {
    return PUBLIC_PATHS.some(publicPath => path.startsWith(publicPath));
}

/**
 * Check if path requires agent authentication (API key/signature)
 */
function requiresAgentAuth(path: string): boolean {
    return AGENT_AUTH_PATHS.some(authPath => path.startsWith(authPath));
}

/**
 * Add CORS headers to response
 */
function addCORSHeaders(request: NextRequest, response: NextResponse): NextResponse {
    const origin = request.headers.get('origin');
    
    // Check if origin is allowed
    if (origin && CORS_ALLOWED_ORIGINS.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
    } else {
        // Allow any origin in development
        if (process.env.NODE_ENV === 'development') {
            response.headers.set('Access-Control-Allow-Origin', origin || '*');
        }
    }

    response.headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
    response.headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
    response.headers.set('Access-Control-Max-Age', CORS_MAX_AGE);
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    return response;
}

/**
 * Add security headers
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
    // Prevent MIME type sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    response.headers.set('X-Frame-Options', 'DENY');
    
    // XSS protection
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy (adjust as needed)
    response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co;"
    );

    // HSTS (only in production)
    if (process.env.NODE_ENV === 'production') {
        response.headers.set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        );
    }

    return response;
}

/**
 * Simple in-memory rate limiting for middleware
 */
function checkMiddlewareRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
        for (const [k, v] of rateLimitMap.entries()) {
            if (v.resetTime < windowStart) {
                rateLimitMap.delete(k);
            }
        }
    }

    const current = rateLimitMap.get(key);

    if (!current || current.resetTime < now) {
        // New window
        rateLimitMap.set(key, {
            count: 1,
            resetTime: now + windowMs,
        });
        return true;
    }

    if (current.count >= maxRequests) {
        return false;
    }

    current.count++;
    return true;
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 204 });
        return addCORSHeaders(request, response);
    }

    // Skip middleware for non-API routes
    if (!pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Check global rate limit
    const clientIP = request.ip || 'unknown';
    const isAllowed = checkMiddlewareRateLimit(
        `global:${clientIP}`,
        1000, // 1000 requests per minute
        60 * 1000
    );

    if (!isAllowed) {
        return new NextResponse(
            JSON.stringify({ error: 'Rate limit exceeded' }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }

    // Allow public paths
    if (isPublicPath(pathname)) {
        const response = NextResponse.next();
        return addCORSHeaders(request, addSecurityHeaders(response));
    }

    // Check for agent authentication on specific paths
    if (requiresAgentAuth(pathname)) {
        const hasApiKey = request.headers.get('authorization')?.startsWith('Bearer ');
        const hasSignature = request.headers.has('x-signature');

        if (!hasApiKey && !hasSignature) {
            return new NextResponse(
                JSON.stringify({ 
                    error: 'Authentication required',
                    message: 'Provide either an API key (Authorization: Bearer <key>) or a signature (X-Signature header)'
                }),
                {
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
    }

    // Continue with the request
    const response = NextResponse.next();
    return addCORSHeaders(request, addSecurityHeaders(response));
}

/**
 * Configure middleware matcher
 */
export const config = {
    matcher: [
        // Match all API routes
        '/api/:path*',
        // Exclude static files and images
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
