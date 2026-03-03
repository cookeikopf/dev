-- ============================================
-- AgentLink MVP - Supabase Database Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Custom Types
-- ============================================

-- Transaction status enum
CREATE TYPE transaction_status AS ENUM (
    'pending',
    'confirmed',
    'failed',
    'cancelled'
);

-- ============================================
-- Tables
-- ============================================

-- Agents table - stores agent information
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    identity_address TEXT NOT NULL UNIQUE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    capabilities JSONB DEFAULT '[]'::jsonb,
    endpoint_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table - stores payment transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    payer_address TEXT NOT NULL,
    receiver_address TEXT NOT NULL,
    amount NUMERIC(78, 0) NOT NULL CHECK (amount >= 0), -- Support for large numbers (wei)
    fee NUMERIC(78, 0) DEFAULT 0 CHECK (fee >= 0),
    memo TEXT,
    tx_hash TEXT UNIQUE,
    status transaction_status DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telemetry events table - stores agent telemetry data
CREATE TABLE telemetry_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_ip INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys table - stores agent API keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL, -- First 8 chars for identification
    name TEXT,
    scopes JSONB DEFAULT '["telemetry:write"]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Rate limiting table - tracks API usage
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE, -- Composite key: "type:identifier"
    count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook configurations table
CREATE TABLE webhook_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL, -- For HMAC signature verification
    events JSONB NOT NULL DEFAULT '["payment.received"]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery logs
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    delivery_attempts INTEGER DEFAULT 1,
    delivered_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Agents indexes
CREATE INDEX idx_agents_owner_id ON agents(owner_id);
CREATE INDEX idx_agents_identity_address ON agents(identity_address);
CREATE INDEX idx_agents_created_at ON agents(created_at DESC);

-- Transactions indexes
CREATE INDEX idx_transactions_agent_id ON transactions(agent_id);
CREATE INDEX idx_transactions_payer ON transactions(payer_address);
CREATE INDEX idx_transactions_receiver ON transactions(receiver_address);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Telemetry events indexes
CREATE INDEX idx_telemetry_agent_id ON telemetry_events(agent_id);
CREATE INDEX idx_telemetry_event_type ON telemetry_events(event_type);
CREATE INDEX idx_telemetry_created_at ON telemetry_events(created_at DESC);

-- API keys indexes
CREATE INDEX idx_api_keys_agent_id ON api_keys(agent_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- Rate limits indexes
CREATE INDEX idx_rate_limits_key ON rate_limits(key);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);

-- Webhook indexes
CREATE INDEX idx_webhook_configs_agent_id ON webhook_configs(agent_id);
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);

-- ============================================
-- Functions
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_configs_updated_at
    BEFORE UPDATE ON webhook_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old rate limit entries
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to update API key last_used_at
CREATE OR REPLACE FUNCTION update_api_key_last_used()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE api_keys
    SET last_used_at = NOW()
    WHERE key_hash = NEW.key_hash;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Views
-- ============================================

-- Agent summary view with transaction counts
CREATE VIEW agent_summary AS
SELECT 
    a.id,
    a.name,
    a.identity_address,
    a.owner_id,
    a.is_active,
    a.created_at,
    COUNT(DISTINCT t.id) as total_transactions,
    COUNT(DISTINCT CASE WHEN t.status = 'confirmed' THEN t.id END) as confirmed_transactions,
    COALESCE(SUM(CASE WHEN t.status = 'confirmed' THEN t.amount ELSE 0 END), 0) as total_volume
FROM agents a
LEFT JOIN transactions t ON a.id = t.agent_id
GROUP BY a.id, a.name, a.identity_address, a.owner_id, a.is_active, a.created_at;

-- Telemetry summary view
CREATE VIEW telemetry_summary AS
SELECT 
    agent_id,
    event_type,
    COUNT(*) as event_count,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen
FROM telemetry_events
GROUP BY agent_id, event_type;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE agents IS 'Stores agent information and configuration';
COMMENT ON TABLE transactions IS 'Stores payment transactions between agents';
COMMENT ON TABLE telemetry_events IS 'Stores agent telemetry and event data';
COMMENT ON TABLE api_keys IS 'Stores API keys for agent authentication';
COMMENT ON TABLE rate_limits IS 'Tracks API rate limiting data';
COMMENT ON TABLE webhook_configs IS 'Stores webhook configuration for agents';
COMMENT ON TABLE webhook_deliveries IS 'Logs webhook delivery attempts';
