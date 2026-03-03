/**
 * AgentLink MVP - API Keys Management Routes
 * GET /api/api-keys - List API keys for an agent
 * POST /api/api-keys - Create new API key
 * DELETE /api/api-keys - Revoke API key
 */

import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import {
    createApiKeySchema,
    revokeApiKeySchema,
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
import { generateApiKey, listApiKeys, revokeApiKey } from '@/lib/api-keys';

// GET /api/api-keys - List API keys
export async function GET(request: NextRequest) {
    return handleApiRequest(async () => {
        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`api-keys:list:${clientIP}`, {
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

        // Get agent_id from query
        const searchParams = request.nextUrl.searchParams;
        const agentId = searchParams.get('agent_id');

        if (!agentId) {
            return new Response(
                JSON.stringify({ error: 'agent_id query parameter is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Verify agent ownership
        const { data: agent } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agentId)
            .eq('owner_id', user.id)
            .single();

        if (!agent) {
            throw new NotFoundError('Agent');
        }

        // List API keys
        const keys = await listApiKeys(agentId);

        return createSuccessResponse({
            data: keys,
            agent_id: agentId,
        }, 200, formatRateLimitHeaders(rateLimit));
    });
}

// POST /api/api-keys - Create new API key
export async function POST(request: NextRequest) {
    return handleApiRequest(async () => {
        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`api-keys:create:${clientIP}`, {
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
        const validation = await validateRequest(request, createApiKeySchema);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { agent_id, name, scopes, expires_at } = validation.data;

        // Verify agent ownership
        const { data: agent } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agent_id)
            .eq('owner_id', user.id)
            .single();

        if (!agent) {
            throw new NotFoundError('Agent');
        }

        // Check existing key count (max 5 per agent)
        const { count } = await supabase
            .from('api_keys')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', agent_id)
            .eq('is_active', true);

        if (count && count >= 5) {
            return new Response(
                JSON.stringify({ error: 'Maximum number of API keys (5) reached for this agent' }),
                { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Generate API key
        const expiresAt = expires_at ? new Date(expires_at) : undefined;
        const generatedKey = await generateApiKey(agent_id, name, scopes, expiresAt);

        return createSuccessResponse({
            key: generatedKey.key,
            key_id: generatedKey.keyId,
            prefix: generatedKey.prefix,
            agent_id,
            scopes,
            expires_at: expires_at || null,
            warning: 'This key will only be shown once. Store it securely.',
        }, 201, formatRateLimitHeaders(rateLimit));
    });
}

// DELETE /api/api-keys - Revoke API key
export async function DELETE(request: NextRequest) {
    return handleApiRequest(async () => {
        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`api-keys:revoke:${clientIP}`, {
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

        // Parse request body
        const validation = await validateRequest(request, revokeApiKeySchema);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { key_id, agent_id } = validation.data;

        // Verify agent ownership
        const { data: agent } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agent_id)
            .eq('owner_id', user.id)
            .single();

        if (!agent) {
            throw new NotFoundError('Agent');
        }

        // Revoke API key
        await revokeApiKey(key_id, agent_id);

        return createSuccessResponse({
            message: 'API key revoked successfully',
            key_id,
            agent_id,
        }, 200, formatRateLimitHeaders(rateLimit));
    });
}
