/**
 * AgentLink MVP - Webhook Deliveries API Routes
 * GET /api/webhooks/deliveries - List webhook delivery attempts
 */

import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import {
    createSuccessResponse,
    handleApiRequest,
    AuthorizationError,
    handleSupabaseError,
} from '@/lib/errors';
import { checkRateLimit, formatRateLimitHeaders, getClientIP } from '@/lib/rate-limit';

// GET /api/webhooks/deliveries - List webhook deliveries
export async function GET(request: NextRequest) {
    return handleApiRequest(async () => {
        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`webhooks:deliveries:list:${clientIP}`, {
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
        const webhookId = searchParams.get('webhook_id');
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        // Build query
        let query = supabase
            .from('webhook_deliveries')
            .select(`
                *,
                webhook:webhook_configs!inner(
                    id,
                    agent_id,
                    url,
                    agent:agents!left(owner_id)
                )
            `, { count: 'exact' });

        // Filter by webhook_id if provided
        if (webhookId) {
            query = query.eq('webhook_id', webhookId);
        }

        // Only show deliveries for user's webhooks
        query = query.eq('webhook.agent.owner_id', user.id);

        // Execute query with pagination
        const { data: deliveries, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            handleSupabaseError(error);
        }

        // Clean up response - remove sensitive data
        const sanitizedDeliveries = (deliveries || []).map(delivery => ({
            id: delivery.id,
            webhook_id: delivery.webhook_id,
            event_type: delivery.event_type,
            payload: delivery.payload,
            response_status: delivery.response_status,
            delivery_attempts: delivery.delivery_attempts,
            delivered_at: delivery.delivered_at,
            error_message: delivery.error_message,
            created_at: delivery.created_at,
            webhook: {
                id: delivery.webhook.id,
                url: delivery.webhook.url,
                agent_id: delivery.webhook.agent_id,
            },
        }));

        return createSuccessResponse({
            data: sanitizedDeliveries,
            pagination: {
                total: count || 0,
                limit,
                offset,
                hasMore: (count || 0) > offset + limit,
            },
        }, 200, formatRateLimitHeaders(rateLimit));
    });
}
