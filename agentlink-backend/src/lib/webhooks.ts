/**
 * AgentLink MVP - Webhook Utilities
 * Handles webhook delivery, signature generation, and retry logic
 */

import { createHmac } from 'crypto';
import { supabaseAdmin } from './supabase';

// Webhook event types
export type WebhookEventType =
    | 'payment.received'
    | 'payment.sent'
    | 'payment.failed'
    | 'agent.registered'
    | 'agent.updated'
    | 'telemetry.alert'
    | 'api_key.revoked';

// Webhook payload interface
export interface WebhookPayload {
    event: WebhookEventType;
    timestamp: number;
    data: Record<string, unknown>;
}

// Webhook delivery result
export interface WebhookDeliveryResult {
    success: boolean;
    statusCode?: number;
    error?: string;
    retryAfter?: number;
}

// Maximum retry attempts
const MAX_RETRIES = 3;

// Retry delays in milliseconds
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

/**
 * Generate webhook signature
 * @param payload - Webhook payload
 * @param secret - Webhook secret
 */
export function generateWebhookSignature(payload: WebhookPayload, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');
}

/**
 * Verify webhook signature
 * @param payload - Webhook payload
 * @param signature - Received signature
 * @param secret - Webhook secret
 */
export function verifyWebhookSignature(
    payload: WebhookPayload,
    signature: string,
    secret: string
): boolean {
    const expectedSignature = generateWebhookSignature(payload, secret);
    return signature === expectedSignature;
}

/**
 * Send webhook to configured URL
 * @param webhookId - Webhook configuration ID
 * @param payload - Webhook payload
 */
export async function sendWebhook(
    webhookId: string,
    payload: WebhookPayload
): Promise<WebhookDeliveryResult> {
    // Get webhook configuration
    const { data: webhook, error } = await supabaseAdmin
        .from('webhook_configs')
        .select('*')
        .eq('id', webhookId)
        .eq('is_active', true)
        .single();

    if (error || !webhook) {
        return {
            success: false,
            error: 'Webhook not found or inactive',
        };
    }

    // Check if event type is subscribed
    if (!webhook.events.includes(payload.event)) {
        return {
            success: false,
            error: 'Event type not subscribed',
        };
    }

    // Generate signature
    const signature = generateWebhookSignature(payload, webhook.secret);

    // Prepare request
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp.toString(),
        'User-Agent': 'AgentLink-Webhook/1.0',
    };

    try {
        const response = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            // 30 second timeout
            signal: AbortSignal.timeout(30000),
        });

        const responseBody = await response.text();

        // Log delivery
        await logWebhookDelivery({
            webhookId,
            eventType: payload.event,
            payload,
            responseStatus: response.status,
            responseBody: responseBody.slice(0, 10000), // Limit response size
            deliveredAt: response.ok ? new Date() : undefined,
            errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
        });

        if (response.ok) {
            return {
                success: true,
                statusCode: response.status,
            };
        }

        // Check for retry-after header
        const retryAfter = response.headers.get('retry-after');

        return {
            success: false,
            statusCode: response.status,
            error: `HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
            retryAfter: retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Log failed delivery
        await logWebhookDelivery({
            webhookId,
            eventType: payload.event,
            payload,
            errorMessage,
        });

        return {
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Log webhook delivery attempt
 */
async function logWebhookDelivery({
    webhookId,
    eventType,
    payload,
    responseStatus,
    responseBody,
    deliveredAt,
    errorMessage,
}: {
    webhookId: string;
    eventType: string;
    payload: WebhookPayload;
    responseStatus?: number;
    responseBody?: string;
    deliveredAt?: Date;
    errorMessage?: string;
}): Promise<void> {
    await supabaseAdmin.from('webhook_deliveries').insert({
        webhook_id: webhookId,
        event_type: eventType,
        payload,
        response_status: responseStatus,
        response_body: responseBody,
        delivered_at: deliveredAt?.toISOString(),
        error_message: errorMessage,
    });
}

/**
 * Send webhook with retry logic
 */
export async function sendWebhookWithRetry(
    webhookId: string,
    payload: WebhookPayload,
    attempt: number = 0
): Promise<WebhookDeliveryResult> {
    const result = await sendWebhook(webhookId, payload);

    if (result.success || attempt >= MAX_RETRIES) {
        return result;
    }

    // Calculate delay
    const delay = result.retryAfter || RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    // Retry
    return sendWebhookWithRetry(webhookId, payload, attempt + 1);
}

/**
 * Broadcast event to all subscribed webhooks for an agent
 * @param agentId - Agent ID
 * @param event - Event type
 * @param data - Event data
 */
export async function broadcastWebhook(
    agentId: string,
    event: WebhookEventType,
    data: Record<string, unknown>
): Promise<void> {
    // Get all webhooks for this agent
    const { data: webhooks, error } = await supabaseAdmin
        .from('webhook_configs')
        .select('*')
        .eq('agent_id', agentId)
        .eq('is_active', true);

    if (error || !webhooks || webhooks.length === 0) {
        return;
    }

    const payload: WebhookPayload = {
        event,
        timestamp: Date.now(),
        data,
    };

    // Send to all subscribed webhooks (fire and forget)
    const subscribedWebhooks = webhooks.filter(w => w.events.includes(event));

    for (const webhook of subscribedWebhooks) {
        // Don't await - webhooks are sent asynchronously
        sendWebhookWithRetry(webhook.id, payload).catch(console.error);
    }
}

/**
 * Broadcast event to global webhooks
 * @param event - Event type
 * @param data - Event data
 */
export async function broadcastGlobalWebhook(
    event: WebhookEventType,
    data: Record<string, unknown>
): Promise<void> {
    // Get global webhooks (no agent_id)
    const { data: webhooks, error } = await supabaseAdmin
        .from('webhook_configs')
        .select('*')
        .is('agent_id', null)
        .eq('is_active', true);

    if (error || !webhooks || webhooks.length === 0) {
        return;
    }

    const payload: WebhookPayload = {
        event,
        timestamp: Date.now(),
        data,
    };

    const subscribedWebhooks = webhooks.filter(w => w.events.includes(event));

    for (const webhook of subscribedWebhooks) {
        sendWebhookWithRetry(webhook.id, payload).catch(console.error);
    }
}

/**
 * Create webhook configuration
 */
export async function createWebhook(
    url: string,
    events: WebhookEventType[],
    secret: string,
    agentId?: string
): Promise<string> {
    const { data, error } = await supabaseAdmin
        .from('webhook_configs')
        .insert({
            agent_id: agentId || null,
            url,
            events,
            secret,
        })
        .select('id')
        .single();

    if (error) {
        throw new Error(`Failed to create webhook: ${error.message}`);
    }

    return data.id;
}

/**
 * Generate a secure webhook secret
 */
export function generateWebhookSecret(): string {
    return createHmac('sha256', Math.random().toString())
        .update(Date.now().toString())
        .digest('hex');
}
