/**
 * AgentLink MVP - Agents API Routes
 * CRUD operations for agents
 * GET /api/agents - List agents
 * POST /api/agents - Create agent
 */

import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import {
    createAgentSchema,
    listAgentsSchema,
    validateRequest,
    validateQuery,
} from '@/lib/validation';
import {
    createSuccessResponse,
    handleApiRequest,
    NotFoundError,
    AuthorizationError,
    handleSupabaseError,
} from '@/lib/errors';
import { checkRateLimit, formatRateLimitHeaders, getClientIP } from '@/lib/rate-limit';

// GET /api/agents - List agents
export async function GET(request: NextRequest) {
    return handleApiRequest(async () => {
        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`agents:list:${clientIP}`, {
            windowMs: 60 * 1000,
            maxRequests: 60,
        });

        if (!rateLimit.success) {
            return new Response(
                JSON.stringify({ error: 'Rate limit exceeded' }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        ...formatRateLimitHeaders(rateLimit),
                    },
                }
            );
        }

        // Get authenticated user
        const supabase = getServerSupabase();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new AuthorizationError();
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const validation = validateQuery(searchParams, listAgentsSchema);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { is_active, limit, offset } = validation.data;

        // Build query
        let query = supabase
            .from('agents')
            .select('*', { count: 'exact' })
            .eq('owner_id', user.id);

        if (is_active !== undefined) {
            query = query.eq('is_active', is_active);
        }

        // Execute query with pagination
        const { data: agents, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            handleSupabaseError(error);
        }

        return createSuccessResponse({
            data: agents || [],
            pagination: {
                total: count || 0,
                limit,
                offset,
                hasMore: (count || 0) > offset + limit,
            },
        }, 200, formatRateLimitHeaders(rateLimit));
    });
}

// POST /api/agents - Create agent
export async function POST(request: NextRequest) {
    return handleApiRequest(async () => {
        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`agents:create:${clientIP}`, {
            windowMs: 60 * 1000,
            maxRequests: 10,
        });

        if (!rateLimit.success) {
            return new Response(
                JSON.stringify({ error: 'Rate limit exceeded' }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        ...formatRateLimitHeaders(rateLimit),
                    },
                }
            );
        }

        // Get authenticated user
        const supabase = getServerSupabase();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new AuthorizationError();
        }

        // Validate request body
        const validation = await validateRequest(request, createAgentSchema);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const agentData = validation.data;

        // Check if identity address is already registered
        const { data: existingAgent } = await supabase
            .from('agents')
            .select('id')
            .eq('identity_address', agentData.identity_address)
            .single();

        if (existingAgent) {
            return new Response(
                JSON.stringify({ error: 'Identity address already registered' }),
                { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Create agent
        const { data: agent, error } = await supabase
            .from('agents')
            .insert({
                ...agentData,
                owner_id: user.id,
            })
            .select()
            .single();

        if (error) {
            handleSupabaseError(error);
        }

        return createSuccessResponse(agent, 201, formatRateLimitHeaders(rateLimit));
    });
}
