/**
 * AgentLink MVP - Input Validation
 * Zod schemas and validation utilities for API inputs
 */

import { z } from 'zod';

// ============================================
// Common Validators
// ============================================

// Ethereum address validator
const ethereumAddress = z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format');

// UUID validator
const uuid = z.string().uuid('Invalid UUID format');

// URL validator
const url = z.string().url('Invalid URL format');

// Hex string validator
const hexString = z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid hex string');

// ============================================
// Agent Schemas
// ============================================

export const createAgentSchema = z.object({
    name: z.string().min(1).max(100),
    identity_address: ethereumAddress,
    capabilities: z.array(z.object({
        name: z.string(),
        version: z.string(),
        description: z.string().optional(),
    })).default([]),
    endpoint_url: url.optional().nullable(),
});

export const updateAgentSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    capabilities: z.array(z.object({
        name: z.string(),
        version: z.string(),
        description: z.string().optional(),
    })).optional(),
    endpoint_url: url.optional().nullable(),
    is_active: z.boolean().optional(),
});

export const agentIdSchema = z.object({
    id: uuid,
});

// ============================================
// Transaction Schemas
// ============================================

export const createTransactionSchema = z.object({
    agent_id: uuid,
    payer_address: ethereumAddress,
    receiver_address: ethereumAddress,
    amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer'),
    fee: z.string().regex(/^\d+$/, 'Fee must be a positive integer').default('0'),
    memo: z.string().max(500).optional().nullable(),
    tx_hash: hexString.optional().nullable(),
    metadata: z.record(z.any()).default({}),
});

export const updateTransactionSchema = z.object({
    status: z.enum(['pending', 'confirmed', 'failed', 'cancelled']).optional(),
    tx_hash: hexString.optional().nullable(),
    metadata: z.record(z.any()).optional(),
});

export const listTransactionsSchema = z.object({
    agent_id: uuid.optional(),
    status: z.enum(['pending', 'confirmed', 'failed', 'cancelled']).optional(),
    payer_address: ethereumAddress.optional(),
    receiver_address: ethereumAddress.optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

// ============================================
// Telemetry Schemas
// ============================================

export const telemetryEventSchema = z.object({
    agent_id: uuid,
    event_type: z.string().min(1).max(100),
    payload: z.record(z.any()).default({}),
    timestamp: z.number().int().optional(),
});

export const telemetryBatchSchema = z.object({
    events: z.array(telemetryEventSchema).min(1).max(100),
});

export const listTelemetrySchema = z.object({
    agent_id: uuid.optional(),
    event_type: z.string().optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

// ============================================
// API Key Schemas
// ============================================

export const createApiKeySchema = z.object({
    agent_id: uuid,
    name: z.string().max(100).optional(),
    scopes: z.array(z.enum([
        'telemetry:write',
        'telemetry:read',
        'agent:read',
        'agent:write',
        'transactions:read',
        'webhooks:read',
        'webhooks:write',
    ])).default(['telemetry:write']),
    expires_at: z.string().datetime().optional().nullable(),
});

export const revokeApiKeySchema = z.object({
    key_id: uuid,
    agent_id: uuid,
});

// ============================================
// Webhook Schemas
// ============================================

export const createWebhookSchema = z.object({
    agent_id: uuid.optional().nullable(),
    url: url,
    events: z.array(z.string()).min(1),
    secret: z.string().min(16).max(256),
});

export const updateWebhookSchema = z.object({
    url: url.optional(),
    events: z.array(z.string()).min(1).optional(),
    secret: z.string().min(16).max(256).optional(),
    is_active: z.boolean().optional(),
});

export const webhookIdSchema = z.object({
    id: uuid,
});

// ============================================
// Webhook Payload Schemas
// ============================================

export const paymentWebhookSchema = z.object({
    event: z.literal('payment.received'),
    data: z.object({
        tx_hash: hexString,
        from: ethereumAddress,
        to: ethereumAddress,
        amount: z.string(),
        token: z.string().optional(),
        chain_id: z.number().int().optional(),
    }),
});

// ============================================
// Validation Helper Functions
// ============================================

export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: string; issues: z.ZodIssue[] };

/**
 * Validate data against a Zod schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    } else {
        const errorMessage = result.error.issues
            .map(issue => `${issue.path.join('.')}: ${issue.message}`)
            .join(', ');

        return {
            success: false,
            error: errorMessage,
            issues: result.error.issues,
        };
    }
}

/**
 * Validate request body
 */
export async function validateRequest<T>(
    request: Request,
    schema: z.ZodSchema<T>
): Promise<ValidationResult<T>> {
    try {
        const body = await request.json();
        return validate(schema, body);
    } catch (error) {
        return {
            success: false,
            error: 'Invalid JSON body',
            issues: [{ message: 'Failed to parse JSON', path: [], code: 'custom' }] as z.ZodIssue[],
        };
    }
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(
    searchParams: URLSearchParams,
    schema: z.ZodSchema<T>
): ValidationResult<T> {
    const params: Record<string, unknown> = {};

    searchParams.forEach((value, key) => {
        // Handle array params
        if (params[key]) {
            if (Array.isArray(params[key])) {
                (params[key] as unknown[]).push(value);
            } else {
                params[key] = [params[key], value];
            }
        } else {
            params[key] = value;
        }
    });

    return validate(schema, params);
}

// ============================================
// Error Response Helper
// ============================================

export function createValidationErrorResponse(issues: z.ZodIssue[]): Response {
    return new Response(
        JSON.stringify({
            error: 'Validation failed',
            details: issues.map(issue => ({
                field: issue.path.join('.'),
                message: issue.message,
                code: issue.code,
            })),
        }),
        {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
