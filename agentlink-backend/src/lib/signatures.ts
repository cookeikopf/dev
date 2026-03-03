/**
 * AgentLink MVP - Signature Verification
 * EIP-191 and EIP-712 signature verification for agent authentication
 */

import { createHash } from 'crypto';
import { verifyMessage, verifyTypedData } from 'viem';
import { supabaseAdmin } from './supabase';

// Signature verification result
export interface SignatureVerificationResult {
    valid: boolean;
    address?: string;
    agentId?: string;
    error?: string;
}

// EIP-712 Domain
const EIP712_DOMAIN = {
    name: 'AgentLink',
    version: '1',
    chainId: 1, // Ethereum mainnet
};

// EIP-712 Types for telemetry
const TELEMETRY_TYPES = {
    TelemetryEvent: [
        { name: 'agentId', type: 'string' },
        { name: 'eventType', type: 'string' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'payloadHash', type: 'bytes32' },
    ],
};

/**
 * Verify EIP-191 signature
 * @param message - Original message
 * @param signature - EIP-191 signature
 * @param expectedAddress - Expected signer address (optional)
 */
export async function verifyEIP191Signature(
    message: string,
    signature: string,
    expectedAddress?: string
): Promise<SignatureVerificationResult> {
    try {
        const recoveredAddress = await verifyMessage({
            message,
            signature: signature as `0x${string}`,
        });

        if (expectedAddress && recoveredAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
            return {
                valid: false,
                error: 'Signature address mismatch',
            };
        }

        // Look up agent by identity address
        const { data: agent, error } = await supabaseAdmin
            .from('agents')
            .select('id, identity_address')
            .eq('identity_address', recoveredAddress)
            .eq('is_active', true)
            .single();

        if (error || !agent) {
            return {
                valid: false,
                error: 'Agent not found or inactive',
            };
        }

        return {
            valid: true,
            address: recoveredAddress,
            agentId: agent.id,
        };
    } catch (error) {
        return {
            valid: false,
            error: `Signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Verify EIP-712 typed data signature
 * @param domain - EIP-712 domain
 * @param types - EIP-712 types
 * @param message - Typed data message
 * @param signature - Signature
 * @param expectedAddress - Expected signer address (optional)
 */
export async function verifyEIP712Signature(
    domain: typeof EIP712_DOMAIN,
    types: Record<string, Array<{ name: string; type: string }>>,
    message: Record<string, unknown>,
    signature: string,
    expectedAddress?: string
): Promise<SignatureVerificationResult> {
    try {
        const recoveredAddress = await verifyTypedData({
            domain,
            types,
            primaryType: Object.keys(types)[0],
            message,
            signature: signature as `0x${string}`,
        });

        if (expectedAddress && recoveredAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
            return {
                valid: false,
                error: 'Signature address mismatch',
            };
        }

        // Look up agent by identity address
        const { data: agent, error } = await supabaseAdmin
            .from('agents')
            .select('id, identity_address')
            .eq('identity_address', recoveredAddress)
            .eq('is_active', true)
            .single();

        if (error || !agent) {
            return {
                valid: false,
                error: 'Agent not found or inactive',
            };
        }

        return {
            valid: true,
            address: recoveredAddress,
            agentId: agent.id,
        };
    } catch (error) {
        return {
            valid: false,
            error: `Signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Verify telemetry event signature
 * @param agentId - Agent ID
 * @param eventType - Event type
 * @param payload - Event payload
 * @param timestamp - Event timestamp
 * @param signature - EIP-712 signature
 */
export async function verifyTelemetrySignature(
    agentId: string,
    eventType: string,
    payload: unknown,
    timestamp: number,
    signature: string
): Promise<SignatureVerificationResult> {
    // Get agent's identity address
    const { data: agent, error } = await supabaseAdmin
        .from('agents')
        .select('identity_address')
        .eq('id', agentId)
        .eq('is_active', true)
        .single();

    if (error || !agent) {
        return {
            valid: false,
            error: 'Agent not found or inactive',
        };
    }

    // Create payload hash
    const payloadHash = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');

    // Create typed data message
    const message = {
        agentId,
        eventType,
        timestamp,
        payloadHash: `0x${payloadHash}`,
    };

    return verifyEIP712Signature(
        EIP712_DOMAIN,
        TELEMETRY_TYPES,
        message,
        signature,
        agent.identity_address
    );
}

/**
 * Create a message to sign for telemetry authentication
 * @param agentId - Agent ID
 * @param eventType - Event type
 * @param payload - Event payload
 * @param timestamp - Event timestamp
 */
export function createTelemetryMessage(
    agentId: string,
    eventType: string,
    payload: unknown,
    timestamp: number = Date.now()
): { message: string; payloadHash: string } {
    const payloadHash = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');

    const message = `AgentLink Telemetry Event\n\nAgent ID: ${agentId}\nEvent Type: ${eventType}\nTimestamp: ${timestamp}\nPayload Hash: 0x${payloadHash}`;

    return { message, payloadHash: `0x${payloadHash}` };
}

/**
 * Extract and verify signature from request headers
 * Supports both EIP-191 and EIP-712
 */
export async function verifyRequestSignature(
    request: Request,
    agentId: string,
    payload: unknown
): Promise<SignatureVerificationResult> {
    const signature = request.headers.get('x-signature');
    const signatureType = request.headers.get('x-signature-type') || 'eip191';
    const timestamp = request.headers.get('x-timestamp');

    if (!signature) {
        return { valid: false, error: 'Missing signature header' };
    }

    if (signatureType === 'eip712') {
        if (!timestamp) {
            return { valid: false, error: 'Missing timestamp for EIP-712 signature' };
        }

        // Verify timestamp is within 5 minutes
        const ts = parseInt(timestamp, 10);
        const now = Date.now();
        if (Math.abs(now - ts) > 5 * 60 * 1000) {
            return { valid: false, error: 'Signature timestamp expired' };
        }

        // Get event type from payload
        const eventType = (payload as any)?.eventType || 'unknown';

        return verifyTelemetrySignature(
            agentId,
            eventType,
            payload,
            ts,
            signature
        );
    } else {
        // EIP-191
        const { message } = createTelemetryMessage(
            agentId,
            (payload as any)?.eventType || 'unknown',
            payload,
            timestamp ? parseInt(timestamp, 10) : Date.now()
        );

        return verifyEIP191Signature(message, signature);
    }
}
