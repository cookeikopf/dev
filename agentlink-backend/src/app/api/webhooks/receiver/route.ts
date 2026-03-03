/**
 * AgentLink MVP - Webhook Receiver
 * POST /api/webhooks/receiver - Receive payment notifications from external services
 * Supports multiple payment provider formats
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { paymentWebhookSchema } from '@/lib/validation';
import {
    createSuccessResponse,
    handleApiRequest,
    ValidationError,
    handleSupabaseError,
} from '@/lib/errors';
import { checkRateLimit, formatRateLimitHeaders, getClientIP } from '@/lib/rate-limit';
import { broadcastWebhook, broadcastGlobalWebhook } from '@/lib/webhooks';

// Supported payment providers
const SUPPORTED_PROVIDERS = ['stripe', 'circle', 'coinbase', 'alchemy', 'custom'] as const;
type PaymentProvider = typeof SUPPORTED_PROVIDERS[number];

// Provider-specific webhook handlers
interface ProviderWebhookHandler {
    verifySignature(request: Request, secret: string): Promise<boolean>;
    parsePayload(body: unknown): Promise<{
        txHash?: string;
        from: string;
        to: string;
        amount: string;
        token?: string;
        chainId?: number;
        status: 'confirmed' | 'pending' | 'failed';
    }>;
}

// Stripe webhook handler
const stripeHandler: ProviderWebhookHandler = {
    async verifySignature(request, secret) {
        const signature = request.headers.get('stripe-signature');
        if (!signature) return false;
        // Implement Stripe signature verification
        // This is a simplified version - use stripe library in production
        return true;
    },
    async parsePayload(body: any) {
        // Parse Stripe payment intent
        return {
            from: body.data?.object?.charges?.data?.[0]?.billing_details?.address?.line1 || 'unknown',
            to: body.data?.object?.transfer_data?.destination || 'unknown',
            amount: (body.data?.object?.amount || 0).toString(),
            token: body.data?.object?.currency?.toUpperCase(),
            status: body.data?.object?.status === 'succeeded' ? 'confirmed' : 'pending',
        };
    },
};

// Alchemy webhook handler
const alchemyHandler: ProviderWebhookHandler = {
    async verifySignature(request, secret) {
        const signature = request.headers.get('x-alchemy-signature');
        if (!signature) return false;
        // Implement Alchemy signature verification
        return true;
    },
    async parsePayload(body: any) {
        const event = body.event || body;
        return {
            txHash: event.transaction?.hash,
            from: event.transaction?.from,
            to: event.transaction?.to,
            amount: event.transaction?.value || '0',
            token: 'ETH',
            chainId: body.chainId || 1,
            status: 'confirmed',
        };
    },
};

// Generic/custom webhook handler
const customHandler: ProviderWebhookHandler = {
    async verifySignature(request, secret) {
        const signature = request.headers.get('x-webhook-signature');
        if (!signature) return true; // Optional for custom webhooks
        // Implement custom signature verification
        return true;
    },
    async parsePayload(body: any) {
        return {
            txHash: body.tx_hash || body.transactionHash,
            from: body.from,
            to: body.to,
            amount: body.amount || body.value,
            token: body.token || body.currency,
            chainId: body.chain_id || body.chainId,
            status: body.status || 'confirmed',
        };
    },
};

// Get handler for provider
function getProviderHandler(provider: string): ProviderWebhookHandler {
    switch (provider) {
        case 'stripe':
            return stripeHandler;
        case 'alchemy':
            return alchemyHandler;
        default:
            return customHandler;
    }
}

// POST /api/webhooks/receiver - Receive payment notification
export async function POST(request: NextRequest) {
    return handleApiRequest(async () => {
        const clientIP = getClientIP(request);

        // Check rate limit
        const rateLimit = await checkRateLimit(`webhooks:receiver:${clientIP}`, {
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

        // Get provider from header or query param
        const provider = (request.headers.get('x-provider') || 'custom') as PaymentProvider;

        if (!SUPPORTED_PROVIDERS.includes(provider)) {
            return new Response(
                JSON.stringify({ error: 'Unsupported payment provider' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Get provider secret from environment
        const providerSecret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`] || '';

        // Get handler
        const handler = getProviderHandler(provider);

        // Verify signature
        const isValid = await handler.verifySignature(request, providerSecret);
        if (!isValid) {
            return new Response(
                JSON.stringify({ error: 'Invalid signature' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Parse body
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(
                JSON.stringify({ error: 'Invalid JSON body' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Parse provider-specific payload
        const paymentData = await handler.parsePayload(body);

        // Validate payment data
        if (!paymentData.to || !paymentData.amount) {
            return new Response(
                JSON.stringify({ error: 'Missing required payment data' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Find agent by receiver address
        const { data: agent, error: agentError } = await supabaseAdmin
            .from('agents')
            .select('*')
            .eq('identity_address', paymentData.to.toLowerCase())
            .eq('is_active', true)
            .single();

        if (agentError || !agent) {
            // Still return success to webhook sender, but log the issue
            console.warn(`No agent found for address: ${paymentData.to}`);

            // Broadcast to global webhooks
            await broadcastGlobalWebhook('payment.received', {
                ...paymentData,
                matched_agent: false,
            });

            return createSuccessResponse({
                received: true,
                matched: false,
                message: 'Payment received but no matching agent found',
            }, 200, formatRateLimitHeaders(rateLimit));
        }

        // Check for duplicate transaction
        if (paymentData.txHash) {
            const { data: existingTx } = await supabaseAdmin
                .from('transactions')
                .select('id')
                .eq('tx_hash', paymentData.txHash)
                .single();

            if (existingTx) {
                return createSuccessResponse({
                    received: true,
                    duplicate: true,
                    transaction_id: existingTx.id,
                }, 200, formatRateLimitHeaders(rateLimit));
            }
        }

        // Create transaction record
        const { data: transaction, error: txError } = await supabaseAdmin
            .from('transactions')
            .insert({
                agent_id: agent.id,
                payer_address: paymentData.from.toLowerCase(),
                receiver_address: paymentData.to.toLowerCase(),
                amount: paymentData.amount,
                fee: '0',
                tx_hash: paymentData.txHash,
                status: paymentData.status === 'confirmed' ? 'confirmed' : 'pending',
                metadata: {
                    provider,
                    chain_id: paymentData.chainId,
                    token: paymentData.token,
                    source_ip: clientIP,
                },
            })
            .select()
            .single();

        if (txError) {
            handleSupabaseError(txError);
        }

        // Broadcast webhook to agent's configured webhooks
        await broadcastWebhook(agent.id, 'payment.received', {
            transaction_id: transaction.id,
            tx_hash: transaction.tx_hash,
            from: transaction.payer_address,
            to: transaction.receiver_address,
            amount: transaction.amount,
            token: paymentData.token,
            chain_id: paymentData.chainId,
            timestamp: transaction.created_at,
        });

        // Also broadcast to global webhooks
        await broadcastGlobalWebhook('payment.received', {
            transaction_id: transaction.id,
            tx_hash: transaction.tx_hash,
            from: transaction.payer_address,
            to: transaction.receiver_address,
            amount: transaction.amount,
            token: paymentData.token,
            chain_id: paymentData.chainId,
            matched_agent: true,
            agent_id: agent.id,
            agent_name: agent.name,
        });

        return createSuccessResponse({
            received: true,
            matched: true,
            transaction_id: transaction.id,
            agent_id: agent.id,
        }, 201, formatRateLimitHeaders(rateLimit));
    });
}
