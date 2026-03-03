-- Migration: 002_webhooks_and_rls
-- Created: 2024-01-15
-- Description: Add webhook tables and RLS policies

-- ============================================
-- Webhook Tables
-- ============================================

CREATE TABLE webhook_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events JSONB NOT NULL DEFAULT '["payment.received"]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Webhook indexes
CREATE INDEX idx_webhook_configs_agent_id ON webhook_configs(agent_id);
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);

-- Webhook trigger
CREATE TRIGGER update_webhook_configs_updated_at
    BEFORE UPDATE ON webhook_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Enable RLS
-- ============================================

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Agents Policies
-- ============================================

CREATE POLICY "Users can view own agents"
    ON agents FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own agents"
    ON agents FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own agents"
    ON agents FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own agents"
    ON agents FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================
-- Transactions Policies
-- ============================================

CREATE POLICY "Users can view transactions for own agents"
    ON transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = transactions.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert transactions"
    ON transactions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update transactions"
    ON transactions FOR UPDATE
    USING (true);

-- ============================================
-- Telemetry Policies
-- ============================================

CREATE POLICY "Users can view telemetry for own agents"
    ON telemetry_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = telemetry_events.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated agents can insert telemetry"
    ON telemetry_events FOR INSERT
    WITH CHECK (true);

-- ============================================
-- API Keys Policies
-- ============================================

CREATE POLICY "Users can view API keys for own agents"
    ON api_keys FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = api_keys.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage API keys for own agents"
    ON api_keys FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = api_keys.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

-- ============================================
-- Webhook Policies
-- ============================================

CREATE POLICY "Users can view webhook configs for own agents"
    ON webhook_configs FOR SELECT
    USING (
        agent_id IS NULL OR
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = webhook_configs.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage webhook configs for own agents"
    ON webhook_configs FOR ALL
    USING (
        agent_id IS NULL OR
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = webhook_configs.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can view webhook deliveries for own agents"
    ON webhook_deliveries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM webhook_configs wc
            JOIN agents a ON wc.agent_id = a.id
            WHERE wc.id = webhook_deliveries.webhook_id
            AND a.owner_id = auth.uid()
        )
    );

-- ============================================
-- Rate Limits Policy
-- ============================================

CREATE POLICY "Service role can access rate limits"
    ON rate_limits FOR ALL
    USING (true)
    WITH CHECK (true);
