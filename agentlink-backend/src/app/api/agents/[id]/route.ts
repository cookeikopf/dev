/**
 * AgentLink MVP - Agent Detail API Routes
 * GET /api/agents/[id] - Get agent details
 * PATCH /api/agents/[id] - Update agent
 * DELETE /api/agents/[id] - Delete agent
 */

import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import {
    updateAgentSchema,
    agentIdSchema,
    validateRequest,
} from '@/lib/validation';
import {
    createSuccessResponse,
    handleApiRequest,
    NotFoundError,
    AuthorizationError,
    handleSupabaseError,
} from '@/lib/errors';
import { checkRateLimit, formatRateLimitHeaders, getClientIP } from '@/lib/rate-limit';

interface RouteParams {
    params: {
        id: string;
    };
}

// GET /api/agents/[id] - Get agent details
export async function GET(request: NextRequest, { params }: RouteParams) {
    return handleApiRequest(async () => {
        // Validate agent ID
        const idValidation = agentIdSchema.safeParse({ id: params.id });
        if (!idValidation.success) {
            return new Response(
                JSON.stringify({ error: 'Invalid agent ID' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`agents:get:${clientIP}`, {
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

        // Get agent with transaction summary
        const { data: agent, error } = await supabase
            .from('agents')
            .select(`
                *,
                transactions:transactions(count),
                total_volume:transactions(amount)
            `)
            .eq('id', params.id)
            .eq('owner_id', user.id)
            .single();

        if (error || !agent) {
            throw new NotFoundError('Agent');
        }

        // Get recent transactions
        const { data: recentTransactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('agent_id', params.id)
            .order('created_at', { ascending: false })
            .limit(5);

        // Get API keys count
        const { count: apiKeysCount } = await supabase
            .from('api_keys')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', params.id)
            .eq('is_active', true);

        return createSuccessResponse({
            ...agent,
            recent_transactions: recentTransactions || [],
            api_keys_count: apiKeysCount || 0,
        }, 200, formatRateLimitHeaders(rateLimit));
    });
}

// PATCH /api/agents/[id] - Update agent
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    return handleApiRequest(async () => {
        // Validate agent ID
        const idValidation = agentIdSchema.safeParse({ id: params.id });
        if (!idValidation.success) {
            return new Response(
                JSON.stringify({ error: 'Invalid agent ID' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`agents:update:${clientIP}`, {
            windowMs: 60 * 1000,
            maxRequests: 30,
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
        const validation = await validateRequest(request, updateAgentSchema);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const updateData = validation.data;

        // Verify ownership
        const { data: existingAgent } = await supabase
            .from('agents')
            .select('id')
            .eq('id', params.id)
            .eq('owner_id', user.id)
            .single();

        if (!existingAgent) {
            throw new NotFoundError('Agent');
        }

        // Update agent
        const { data: agent, error } = await supabase
            .from('agents')
            .update(updateData)
            .eq('id', params.id)
            .select()
            .single();

        if (error) {
            handleSupabaseError(error);
        }

        return createSuccessResponse(agent, 200, formatRateLimitHeaders(rateLimit));
    });
}

// DELETE /api/agents/[id] - Delete agent
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    return handleApiRequest(async () => {
        // Validate agent ID
        const idValidation = agentIdSchema.safeParse({ id: params.id });
        if (!idValidation.success) {
            return new Response(
                JSON.stringify({ error: 'Invalid agent ID' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`agents:delete:${clientIP}`, {
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

        // Verify ownership
        const { data: existingAgent } = await supabase
            .from('agents')
            .select('id')
            .eq('id', params.id)
            .eq('owner_id', user.id)
            .single();

        if (!existingAgent) {
            throw new NotFoundError('Agent');
        }

        // Soft delete - mark as inactive instead of hard delete
        const { error } = await supabase
            .from('agents')
            .update({ is_active: false })
            .eq('id', params.id);

        if (error) {
            handleSupabaseError(error);
        }

        // Also deactivate API keys
        await supabase
            .from('api_keys')
            .update({ is_active: false })
            .eq('agent_id', params.id);

        return createSuccessResponse(
            { message: 'Agent deleted successfully' },
            200,
            formatRateLimitHeaders(rateLimit)
        );
    });
}
