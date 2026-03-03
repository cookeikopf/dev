/**
 * AgentLink MVP - Telemetry API Routes
 * GET /api/telemetry - List telemetry events
 * POST /api/telemetry - Ingest telemetry event
 * Supports API key or EIP-191/EIP-712 signature authentication
 */

import { NextRequest } from 'next/server';
import { getServerSupabase, supabaseAdmin } from '@/lib/supabase';
import {
    telemetryEventSchema,
    telemetryBatchSchema,
    listTelemetrySchema,
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
import { requireApiKey, ApiKeyScope } from '@/lib/api-keys';
import { verifyRequestSignature } from '@/lib/signatures';

// GET /api/telemetry - List telemetry events
export async function GET(request: NextRequest) {
    return handleApiRequest(async () => {
        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`telemetry:list:${clientIP}`, {
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
        const validation = validateQuery(searchParams, listTelemetrySchema);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const {
            agent_id,
            event_type,
            from_date,
            to_date,
            limit,
            offset,
        } = validation.data;

        // Build query
        let query = supabase
            .from('telemetry_events')
            .select(`
                *,
                agent:agents!inner(id, name, owner_id)
            `, { count: 'exact' })
            .eq('agent.owner_id', user.id);

        // Apply filters
        if (agent_id) {
            query = query.eq('agent_id', agent_id);
        }

        if (event_type) {
            query = query.eq('event_type', event_type);
        }

        if (from_date) {
            query = query.gte('created_at', from_date);
        }

        if (to_date) {
            query = query.lte('created_at', to_date);
        }

        // Execute query with pagination
        const { data: events, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            handleSupabaseError(error);
        }

        // Get event type summary
        const { data: eventSummary } = await supabase
            .from('telemetry_summary')
            .select('*')
            .in('agent_id', events?.map(e => e.agent_id) || []);

        return createSuccessResponse({
            data: events || [],
            summary: eventSummary || [],
            pagination: {
                total: count || 0,
                limit,
                offset,
                hasMore: (count || 0) > offset + limit,
            },
        }, 200, formatRateLimitHeaders(rateLimit));
    });
}

// POST /api/telemetry - Ingest telemetry event
export async function POST(request: NextRequest) {
    return handleApiRequest(async () => {
        const clientIP = getClientIP(request);

        // Check rate limit by IP first
        const ipRateLimit = await checkRateLimit(`telemetry:ip:${clientIP}`, {
            windowMs: 60 * 1000,
            maxRequests: 1000,
        });

        if (!ipRateLimit.success) {
            return new Response(
                JSON.stringify({ error: 'Rate limit exceeded' }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        ...formatRateLimitHeaders(ipRateLimit),
                    },
                }
            );
        }

        // Determine authentication method
        const authHeader = request.headers.get('authorization');
        const signatureHeader = request.headers.get('x-signature');

        let agentId: string;
        let authMethod: 'api_key' | 'signature';

        if (authHeader?.startsWith('Bearer ')) {
            // API Key authentication
            const apiKeyValidation = await requireApiKey(request, ['telemetry:write']);

            if (!apiKeyValidation.valid) {
                return new Response(
                    JSON.stringify({ error: apiKeyValidation.error }),
                    { status: 401, headers: { 'Content-Type': 'application/json' } }
                );
            }

            agentId = apiKeyValidation.agentId!;
            authMethod = 'api_key';

            // Check agent-specific rate limit
            const agentRateLimit = await checkRateLimit(`telemetry:agent:${agentId}`, {
                windowMs: 60 * 1000,
                maxRequests: 100,
            });

            if (!agentRateLimit.success) {
                return new Response(
                    JSON.stringify({ error: 'Agent rate limit exceeded' }),
                    {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json',
                            ...formatRateLimitHeaders(agentRateLimit),
                        },
                    }
                );
            }
        } else if (signatureHeader) {
            // Signature authentication
            // Parse body first to get agent_id
            let body;
            try {
                body = await request.clone().json();
            } catch {
                return new Response(
                    JSON.stringify({ error: 'Invalid JSON body' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }

            if (!body.agent_id) {
                return new Response(
                    JSON.stringify({ error: 'agent_id is required for signature authentication' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }

            // Verify signature
            const signatureValidation = await verifyRequestSignature(
                request,
                body.agent_id,
                body
            );

            if (!signatureValidation.valid) {
                return new Response(
                    JSON.stringify({ error: signatureValidation.error }),
                    { status: 401, headers: { 'Content-Type': 'application/json' } }
                );
            }

            agentId = signatureValidation.agentId!;
            authMethod = 'signature';

            // Check agent-specific rate limit
            const agentRateLimit = await checkRateLimit(`telemetry:agent:${agentId}`, {
                windowMs: 60 * 1000,
                maxRequests: 100,
            });

            if (!agentRateLimit.success) {
                return new Response(
                    JSON.stringify({ error: 'Agent rate limit exceeded' }),
                    {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json',
                            ...formatRateLimitHeaders(agentRateLimit),
                        },
                    }
                );
            }
        } else {
            return new Response(
                JSON.stringify({ error: 'Authentication required. Provide API key or signature.' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validate request body
        const validation = await validateRequest(request, telemetryEventSchema);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const eventData = validation.data;

        // Verify agent_id matches authenticated agent
        if (eventData.agent_id !== agentId) {
            return new Response(
                JSON.stringify({ error: 'Agent ID mismatch' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Verify agent exists and is active
        const { data: agent, error: agentError } = await supabaseAdmin
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .eq('is_active', true)
            .single();

        if (agentError || !agent) {
            throw new NotFoundError('Agent');
        }

        // Store telemetry event
        const { data: event, error } = await supabaseAdmin
            .from('telemetry_events')
            .insert({
                agent_id: agentId,
                event_type: eventData.event_type,
                payload: eventData.payload,
                source_ip: clientIP,
            })
            .select()
            .single();

        if (error) {
            handleSupabaseError(error);
        }

        return createSuccessResponse({
            ...event,
            auth_method: authMethod,
        }, 201, formatRateLimitHeaders(ipRateLimit));
    });
}

// POST /api/telemetry/batch - Batch ingest telemetry events
export async function PUT(request: NextRequest) {
    return handleApiRequest(async () => {
        const clientIP = getClientIP(request);

        // Check rate limit
        const rateLimit = await checkRateLimit(`telemetry:batch:${clientIP}`, {
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

        // Authenticate
        const apiKeyValidation = await requireApiKey(request, ['telemetry:write']);

        if (!apiKeyValidation.valid) {
            return new Response(
                JSON.stringify({ error: apiKeyValidation.error }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const agentId = apiKeyValidation.agentId!;

        // Validate request body
        const validation = await validateRequest(request, telemetryBatchSchema);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { events } = validation.data;

        // Verify all events belong to the same agent
        const mismatchedEvents = events.filter(e => e.agent_id !== agentId);
        if (mismatchedEvents.length > 0) {
            return new Response(
                JSON.stringify({ error: 'All events must belong to the authenticated agent' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Prepare events for insertion
        const eventsToInsert = events.map(event => ({
            agent_id: event.agent_id,
            event_type: event.event_type,
            payload: event.payload,
            source_ip: clientIP,
        }));

        // Store events
        const { data: insertedEvents, error } = await supabaseAdmin
            .from('telemetry_events')
            .insert(eventsToInsert)
            .select();

        if (error) {
            handleSupabaseError(error);
        }

        return createSuccessResponse({
            inserted: insertedEvents?.length || 0,
            events: insertedEvents || [],
        }, 201, formatRateLimitHeaders(rateLimit));
    });
}
