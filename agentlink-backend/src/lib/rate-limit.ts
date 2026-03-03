/**
 * AgentLink MVP - Rate Limiting
 * Implements sliding window rate limiting using Supabase
 */

import { supabaseAdmin } from './supabase';

// Rate limit configuration
export interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Maximum requests per window
}

// Default rate limits for different endpoints
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
    'telemetry': { windowMs: 60 * 1000, maxRequests: 100 },      // 100 req/min
    'api_key': { windowMs: 60 * 1000, maxRequests: 10 },         // 10 req/min
    'webhook': { windowMs: 60 * 1000, maxRequests: 60 },         // 60 req/min
    'default': { windowMs: 60 * 1000, maxRequests: 60 },         // 60 req/min
};

// Rate limit result
export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    resetAt: Date;
    retryAfter?: number;
}

/**
 * Check rate limit for a given key
 * @param key - Unique identifier (e.g., "telemetry:agent_123" or "ip:192.168.1.1")
 * @param config - Rate limit configuration
 */
export async function checkRateLimit(
    key: string,
    config: RateLimitConfig = DEFAULT_RATE_LIMITS.default
): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);
    const resetAt = new Date(now.getTime() + config.windowMs);

    try {
        // Try to get existing rate limit entry
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('rate_limits')
            .select('*')
            .eq('key', key)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Rate limit fetch error:', fetchError);
            // Fail open - allow request on error
            return {
                success: true,
                limit: config.maxRequests,
                remaining: config.maxRequests - 1,
                resetAt,
            };
        }

        // If no entry exists or window has expired, create new entry
        if (!existing || new Date(existing.window_start) < windowStart) {
            const { error: upsertError } = await supabaseAdmin
                .from('rate_limits')
                .upsert({
                    key,
                    count: 1,
                    window_start: now.toISOString(),
                }, { onConflict: 'key' });

            if (upsertError) {
                console.error('Rate limit upsert error:', upsertError);
                return {
                    success: true,
                    limit: config.maxRequests,
                    remaining: config.maxRequests - 1,
                    resetAt,
                };
            }

            return {
                success: true,
                limit: config.maxRequests,
                remaining: config.maxRequests - 1,
                resetAt,
            };
        }

        // Check if limit exceeded
        if (existing.count >= config.maxRequests) {
            const retryAfter = Math.ceil((new Date(existing.window_start).getTime() + config.windowMs - now.getTime()) / 1000);
            
            return {
                success: false,
                limit: config.maxRequests,
                remaining: 0,
                resetAt: new Date(existing.window_start).getTime() + config.windowMs > now.getTime() 
                    ? new Date(new Date(existing.window_start).getTime() + config.windowMs)
                    : resetAt,
                retryAfter: Math.max(0, retryAfter),
            };
        }

        // Increment counter
        const { error: updateError } = await supabaseAdmin
            .from('rate_limits')
            .update({ count: existing.count + 1 })
            .eq('key', key);

        if (updateError) {
            console.error('Rate limit update error:', updateError);
        }

        return {
            success: true,
            limit: config.maxRequests,
            remaining: config.maxRequests - existing.count - 1,
            resetAt: new Date(new Date(existing.window_start).getTime() + config.windowMs),
        };

    } catch (error) {
        console.error('Rate limit error:', error);
        // Fail open on error
        return {
            success: true,
            limit: config.maxRequests,
            remaining: config.maxRequests - 1,
            resetAt,
        };
    }
}

/**
 * Create rate limit middleware for API routes
 */
export function createRateLimiter(type: keyof typeof DEFAULT_RATE_LIMITS) {
    const config = DEFAULT_RATE_LIMITS[type] || DEFAULT_RATE_LIMITS.default;

    return async (identifier: string): Promise<RateLimitResult> => {
        const key = `${type}:${identifier}`;
        return checkRateLimit(key, config);
    };
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
        return realIP;
    }
    
    // Fallback - in production, you'd get this from the connection
    return 'unknown';
}

/**
 * Clean up old rate limit entries (should be run periodically)
 */
export async function cleanupRateLimits(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { error } = await supabaseAdmin
        .from('rate_limits')
        .delete()
        .lt('window_start', oneHourAgo);

    if (error) {
        console.error('Rate limit cleanup error:', error);
    }
}

/**
 * Format rate limit headers
 */
export function formatRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
        'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
        ...(result.retryAfter ? { 'Retry-After': result.retryAfter.toString() } : {}),
    };
}
