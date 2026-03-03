/**
 * AgentLink MVP - Transactions API Routes
 * GET /api/transactions - List transactions
 * POST /api/transactions - Create transaction (internal/service use)
 */

import { NextRequest } from 'next/server';
import { getServerSupabase, supabaseAdmin } from '@/lib/supabase';
import {
    createTransactionSchema,
    listTransactionsSchema,
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
import { broadcastWebhook } from '@/lib/webhooks';

// GET /api/transactions - List transactions
export async function GET(request: NextRequest) {
    return handleApiRequest(async () => {
        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`transactions:list:${clientIP}`, {
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
        const validation = validateQuery(searchParams, listTransactionsSchema);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const {
            agent_id,
            status,
            payer_address,
            receiver_address,
            from_date,
            to_date,
            limit,
            offset,
        } = validation.data;

        // Build base query - only show transactions for user's agents
        let query = supabase
            .from('transactions')
            .select(`
                *,
                agent:agents!inner(id, name, identity_address, owner_id)
            `, { count: 'exact' })
            .eq('agent.owner_id', user.id);

        // Apply filters
        if (agent_id) {
            query = query.eq('agent_id', agent_id);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (payer_address) {
            query = query.eq('payer_address', payer_address.toLowerCase());
        }

        if (receiver_address) {
            query = query.eq('receiver_address', receiver_address.toLowerCase());
        }

        if (from_date) {
            query = query.gte('created_at', from_date);
        }

        if (to_date) {
            query = query.lte('created_at', to_date);
        }

        // Execute query with pagination
        const { data: transactions, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            handleSupabaseError(error);
        }

        // Calculate summary statistics
        const { data: stats } = await supabase
            .from('transactions')
            .select('status, amount')
            .eq('agent.owner_id', user.id)
            .eq('status', 'confirmed');

        const totalVolume = stats?.reduce((sum, tx) => sum + BigInt(tx.amount), BigInt(0)) || BigInt(0);

        return createSuccessResponse({
            data: transactions || [],
            summary: {
                total_volume: totalVolume.toString(),
                total_count: count || 0,
            },
            pagination: {
                total: count || 0,
                limit,
                offset,
                hasMore: (count || 0) > offset + limit,
            },
        }, 200, formatRateLimitHeaders(rateLimit));
    });
}

// POST /api/transactions - Create transaction (service/webhook use)
export async function POST(request: NextRequest) {
    return handleApiRequest(async () => {
        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(`transactions:create:${clientIP}`, {
            windowMs: 60 * 1000,
            maxRequests: 100,
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

        // Validate request body
        const validation = await validateRequest(request, createTransactionSchema);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const txData = validation.data;

        // Verify agent exists and is active
        const { data: agent, error: agentError } = await supabaseAdmin
            .from('agents')
            .select('*')
            .eq('id', txData.agent_id)
            .eq('is_active', true)
            .single();

        if (agentError || !agent) {
            throw new NotFoundError('Agent');
        }

        // Check for duplicate transaction hash
        if (txData.tx_hash) {
            const { data: existingTx } = await supabaseAdmin
                .from('transactions')
                .select('id')
                .eq('tx_hash', txData.tx_hash)
                .single();

            if (existingTx) {
                return new Response(
                    JSON.stringify({ error: 'Transaction hash already exists' }),
                    { status: 409, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        // Create transaction
        const { data: transaction, error } = await supabaseAdmin
            .from('transactions')
            .insert({
                ...txData,
                payer_address: txData.payer_address.toLowerCase(),
                receiver_address: txData.receiver_address.toLowerCase(),
            })
            .select()
            .single();

        if (error) {
            handleSupabaseError(error);
        }

        // Broadcast webhook for payment received
        if (transaction.status === 'confirmed') {
            await broadcastWebhook(agent.id, 'payment.received', {
                transaction_id: transaction.id,
                tx_hash: transaction.tx_hash,
                from: transaction.payer_address,
                to: transaction.receiver_address,
                amount: transaction.amount,
                fee: transaction.fee,
                memo: transaction.memo,
                timestamp: transaction.created_at,
            });
        }

        return createSuccessResponse(transaction, 201, formatRateLimitHeaders(rateLimit));
    });
}
