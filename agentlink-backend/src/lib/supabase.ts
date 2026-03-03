/**
 * AgentLink MVP - Supabase Client Configuration
 * Centralized Supabase client for server and browser contexts
 */

import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

// Browser/client-side Supabase client
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});

// Server-side Supabase client (for API routes)
export function getServerSupabase() {
    return createRouteHandlerClient({ cookies });
}

// Service role client (for admin operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// Database types for TypeScript
export type Database = {
    public: {
        Tables: {
            agents: {
                Row: {
                    id: string;
                    name: string;
                    identity_address: string;
                    owner_id: string;
                    capabilities: any[];
                    endpoint_url: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    identity_address: string;
                    owner_id: string;
                    capabilities?: any[];
                    endpoint_url?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    identity_address?: string;
                    owner_id?: string;
                    capabilities?: any[];
                    endpoint_url?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            transactions: {
                Row: {
                    id: string;
                    agent_id: string;
                    payer_address: string;
                    receiver_address: string;
                    amount: string;
                    fee: string;
                    memo: string | null;
                    tx_hash: string | null;
                    status: 'pending' | 'confirmed' | 'failed' | 'cancelled';
                    metadata: any;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    agent_id: string;
                    payer_address: string;
                    receiver_address: string;
                    amount: string;
                    fee?: string;
                    memo?: string | null;
                    tx_hash?: string | null;
                    status?: 'pending' | 'confirmed' | 'failed' | 'cancelled';
                    metadata?: any;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    agent_id?: string;
                    payer_address?: string;
                    receiver_address?: string;
                    amount?: string;
                    fee?: string;
                    memo?: string | null;
                    tx_hash?: string | null;
                    status?: 'pending' | 'confirmed' | 'failed' | 'cancelled';
                    metadata?: any;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            telemetry_events: {
                Row: {
                    id: string;
                    agent_id: string;
                    event_type: string;
                    payload: any;
                    source_ip: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    agent_id: string;
                    event_type: string;
                    payload?: any;
                    source_ip?: string | null;
                    created_at?: string;
                };
            };
            api_keys: {
                Row: {
                    id: string;
                    agent_id: string;
                    key_hash: string;
                    key_prefix: string;
                    name: string | null;
                    scopes: string[];
                    is_active: boolean;
                    last_used_at: string | null;
                    created_at: string;
                    expires_at: string | null;
                };
                Insert: {
                    id?: string;
                    agent_id: string;
                    key_hash: string;
                    key_prefix: string;
                    name?: string | null;
                    scopes?: string[];
                    is_active?: boolean;
                    last_used_at?: string | null;
                    created_at?: string;
                    expires_at?: string | null;
                };
            };
            webhook_configs: {
                Row: {
                    id: string;
                    agent_id: string | null;
                    url: string;
                    secret: string;
                    events: string[];
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    agent_id?: string | null;
                    url: string;
                    secret: string;
                    events?: string[];
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
            };
        };
    };
};
