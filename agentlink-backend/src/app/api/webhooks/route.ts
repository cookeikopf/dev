/**
 * AgentLink MVP - Webhooks API Routes
 * GET /api/webhooks - List webhooks
 * POST /api/webhooks - Create webhook
 */

import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import {
    createWebhookSchema,
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
import { generateWebhookSecret } from '@/lib/webhooks';

// GET /api/webhooks - List webhooks
export async function GET(request: NextRequest) {
    return handleApiRequest(async () => {
        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`webhooks:list:${clientIP}`, {
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

        // Get agent_id filter from query
        const searchParams = request.nextUrl.searchParams;
        const agentId = searchParams.get('agent_id');

        // Build query
        let query = supabase
            .from('webhook_configs')
            .select(`
                *,
                agent:agents!left(id, name, owner_id)
            `, { count: 'exact' });

        if (agentId) {
            // Filter by specific agent
            query = query.eq('agent_id', agentId);
            query = query.eq('agent.owner_id', user.id);
        } else {
            // Get all webhooks for user's agents + global webhooks
            query = query.or(`agent_id.is.null,agent.owner_id.eq.${user.id}`);
        }

        // Execute query
        const { data: webhooks, error, count } = await query
            .order('created_at', { ascending: false });

        if (error) {
            handleSupabaseError(error);
        }

        // Get recent delivery stats for each webhook
        const webhooksWithStats = await Promise.all(
            (webhooks || []).map(async (webhook) => {
                const { data: deliveries } = await supabase
                    .from('webhook_deliveries')
                    .select('response_status, created_at')
                    .eq('webhook_id', webhook.id)
                    .order('created_at', { ascending: false })
                    .limit(10);

                const successful = deliveries?.filter(d => d.response_status && d.response_status >= 200 && d.response_status < 300).length || 0;
                const total = deliveries?.length || 0;

                return {
                    ...webhook,
                    secret: undefined, // Never return the secret
                    delivery_stats: {
                        total_deliveries: total,
                        successful_deliveries: successful,
                        success_rate: total > 0 ? (successful / total) * 100 : 0,
                        last_delivery: deliveries?.[0]?.created_at,
                    },
                };
            })
        );

        return createSuccessResponse({
            data: webhooksWithStats,
            pagination: {
                total: count || 0,
            },
        }, 200, formatRateLimitHeaders(rateLimit));
    });
}

// POST /api/webhooks - Create webhook
export async function POST(request: NextRequest) {
    return handleApiRequest(async () => {
        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`webhooks:create:${clientIP}`, {
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
        const validation = await validateRequest(request, createWebhookSchema);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const webhookData = validation.data;

        // If agent_id is provided, verify ownership
        if (webhookData.agent_id) {
            const { data: agent } = await supabase
                .from('agents')
                .select('id')
                .eq('id', webhookData.agent_id)
                .eq('owner_id', user.id)
                .single();

            if (!agent) {
                throw new NotFoundError('Agent');
            }
        }

        // Generate secret if not provided
        const secret = webhookData.secret || generateWebhookSecret();

        // Create webhook
        const { data: webhook, error } = await supabase
            .from('webhook_configs')
            .insert({
                agent_id: webhookData.agent_id || null,
                url: webhookData.url,
                events: webhookData.events,
                secret,
            })
            .select()
            .single();

        if (error) {
            handleSupabaseError(error);
        }

        return createSuccessResponse({
            ...webhook,
            secret, // Only return secret on creation
        }, 201, formatRateLimitHeaders(rateLimit));
    });
}
