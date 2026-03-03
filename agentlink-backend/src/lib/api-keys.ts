/**
 * AgentLink MVP - API Key Management
 * Handles API key generation, validation, and management
 */

import { createHash, randomBytes } from 'crypto';
import { supabaseAdmin } from './supabase';

// API key prefix for identification
const API_KEY_PREFIX = 'ag_';

// API key scopes
export type ApiKeyScope = 
    | 'telemetry:write'
    | 'telemetry:read'
    | 'agent:read'
    | 'agent:write'
    | 'transactions:read'
    | 'webhooks:read'
    | 'webhooks:write';

export const DEFAULT_API_KEY_SCOPES: ApiKeyScope[] = ['telemetry:write'];

// Generated API key result
export interface GeneratedApiKey {
    key: string;        // Full API key (only shown once)
    keyId: string;      // Key ID in database
    prefix: string;     // Key prefix for identification
}

// API key validation result
export interface ApiKeyValidationResult {
    valid: boolean;
    agentId?: string;
    scopes?: string[];
    error?: string;
}

/**
 * Generate a new API key
 * @param agentId - Agent ID to associate with the key
 * @param name - Optional name for the key
 * @param scopes - Array of permission scopes
 * @param expiresAt - Optional expiration date
 */
export async function generateApiKey(
    agentId: string,
    name?: string,
    scopes: ApiKeyScope[] = DEFAULT_API_KEY_SCOPES,
    expiresAt?: Date
): Promise<GeneratedApiKey> {
    // Generate random API key
    const randomPart = randomBytes(32).toString('base64url');
    const key = `${API_KEY_PREFIX}${randomPart}`;
    
    // Create hash for storage
    const keyHash = createHash('sha256').update(key).digest('hex');
    
    // Extract prefix for identification (first 8 chars after prefix)
    const keyPrefix = key.substring(0, 12);
    
    // Store in database
    const { data, error } = await supabaseAdmin
        .from('api_keys')
        .insert({
            agent_id: agentId,
            key_hash: keyHash,
            key_prefix: keyPrefix,
            name: name || null,
            scopes,
            expires_at: expiresAt?.toISOString() || null,
        })
        .select('id')
        .single();
    
    if (error) {
        throw new Error(`Failed to create API key: ${error.message}`);
    }
    
    return {
        key,
        keyId: data.id,
        prefix: keyPrefix,
    };
}

/**
 * Validate an API key
 * @param apiKey - The API key to validate
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
    // Check prefix
    if (!apiKey.startsWith(API_KEY_PREFIX)) {
        return { valid: false, error: 'Invalid API key format' };
    }
    
    // Create hash for lookup
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    
    // Look up in database
    const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single();
    
    if (error || !data) {
        return { valid: false, error: 'Invalid API key' };
    }
    
    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return { valid: false, error: 'API key expired' };
    }
    
    // Update last used timestamp
    await supabaseAdmin
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id);
    
    return {
        valid: true,
        agentId: data.agent_id,
        scopes: data.scopes,
    };
}

/**
 * Revoke an API key
 * @param keyId - The key ID to revoke
 * @param agentId - Agent ID for verification
 */
export async function revokeApiKey(keyId: string, agentId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', keyId)
        .eq('agent_id', agentId);
    
    if (error) {
        throw new Error(`Failed to revoke API key: ${error.message}`);
    }
}

/**
 * List API keys for an agent
 * @param agentId - Agent ID
 */
export async function listApiKeys(agentId: string) {
    const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, key_prefix, name, scopes, is_active, last_used_at, created_at, expires_at')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });
    
    if (error) {
        throw new Error(`Failed to list API keys: ${error.message}`);
    }
    
    return data;
}

/**
 * Check if API key has required scope
 * @param scopes - Key scopes
 * @param requiredScope - Required scope
 */
export function hasScope(scopes: string[], requiredScope: ApiKeyScope): boolean {
    return scopes.includes(requiredScope) || scopes.includes('*');
}

/**
 * Extract API key from request headers
 * @param request - Request object
 */
export function extractApiKey(request: Request): string | null {
    const authHeader = request.headers.get('authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    
    // Also check X-API-Key header
    const apiKeyHeader = request.headers.get('x-api-key');
    if (apiKeyHeader) {
        return apiKeyHeader;
    }
    
    return null;
}

/**
 * Middleware to validate API key and check scopes
 */
export async function requireApiKey(
    request: Request,
    requiredScopes: ApiKeyScope[] = []
): Promise<ApiKeyValidationResult> {
    const apiKey = extractApiKey(request);
    
    if (!apiKey) {
        return { valid: false, error: 'Missing API key' };
    }
    
    const validation = await validateApiKey(apiKey);
    
    if (!validation.valid) {
        return validation;
    }
    
    // Check required scopes
    if (requiredScopes.length > 0) {
        const hasRequiredScope = requiredScopes.some(scope => 
            hasScope(validation.scopes || [], scope)
        );
        
        if (!hasRequiredScope) {
            return { valid: false, error: 'Insufficient permissions' };
        }
    }
    
    return validation;
}
