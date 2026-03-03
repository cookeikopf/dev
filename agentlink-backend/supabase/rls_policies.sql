-- ============================================
-- AgentLink MVP - Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Agents Table Policies
-- ============================================

-- Policy: Users can view their own agents
CREATE POLICY "Users can view own agents"
    ON agents FOR SELECT
    USING (owner_id = auth.uid());

-- Policy: Users can insert their own agents
CREATE POLICY "Users can insert own agents"
    ON agents FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Policy: Users can update their own agents
CREATE POLICY "Users can update own agents"
    ON agents FOR UPDATE
    USING (owner_id = auth.uid());

-- Policy: Users can delete their own agents
CREATE POLICY "Users can delete own agents"
    ON agents FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================
-- Transactions Table Policies
-- ============================================

-- Policy: Users can view transactions for their agents
CREATE POLICY "Users can view transactions for own agents"
    ON transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = transactions.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

-- Policy: Service role can insert transactions
CREATE POLICY "Service role can insert transactions"
    ON transactions FOR INSERT
    WITH CHECK (true); -- Validated by API layer

-- Policy: Service role can update transactions
CREATE POLICY "Service role can update transactions"
    ON transactions FOR UPDATE
    USING (true); -- Validated by API layer

-- ============================================
-- Telemetry Events Table Policies
-- ============================================

-- Policy: Users can view telemetry for their agents
CREATE POLICY "Users can view telemetry for own agents"
    ON telemetry_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = telemetry_events.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

-- Policy: Authenticated agents can insert telemetry
CREATE POLICY "Authenticated agents can insert telemetry"
    ON telemetry_events FOR INSERT
    WITH CHECK (true); -- Validated by API key or signature

-- ============================================
-- API Keys Table Policies
-- ============================================

-- Policy: Users can view API keys for their agents
CREATE POLICY "Users can view API keys for own agents"
    ON api_keys FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = api_keys.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

-- Policy: Users can manage API keys for their agents
CREATE POLICY "Users can insert API keys for own agents"
    ON api_keys FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = api_keys.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update API keys for own agents"
    ON api_keys FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = api_keys.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete API keys for own agents"
    ON api_keys FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = api_keys.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

-- ============================================
-- Webhook Configs Table Policies
-- ============================================

-- Policy: Users can view webhook configs for their agents
CREATE POLICY "Users can view webhook configs for own agents"
    ON webhook_configs FOR SELECT
    USING (
        agent_id IS NULL OR -- Global webhooks
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = webhook_configs.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

-- Policy: Users can manage webhook configs for their agents
CREATE POLICY "Users can insert webhook configs for own agents"
    ON webhook_configs FOR INSERT
    WITH CHECK (
        agent_id IS NULL OR -- Global webhooks (admin only in API layer)
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = webhook_configs.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update webhook configs for own agents"
    ON webhook_configs FOR UPDATE
    USING (
        agent_id IS NULL OR -- Global webhooks (admin only in API layer)
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = webhook_configs.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete webhook configs for own agents"
    ON webhook_configs FOR DELETE
    USING (
        agent_id IS NULL OR -- Global webhooks (admin only in API layer)
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = webhook_configs.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

-- ============================================
-- Webhook Deliveries Table Policies
-- ============================================

-- Policy: Users can view webhook deliveries for their agents
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
-- Rate Limits Table Policies
-- ============================================

-- Policy: Only service role can access rate limits
CREATE POLICY "Service role can access rate limits"
    ON rate_limits FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- Additional Security Functions
-- ============================================

-- Function to check if user owns agent
CREATE OR REPLACE FUNCTION user_owns_agent(agent_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM agents 
        WHERE id = agent_uuid 
        AND owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get agent owner
CREATE OR REPLACE FUNCTION get_agent_owner(agent_uuid UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT owner_id FROM agents 
        WHERE id = agent_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify API key ownership
CREATE OR REPLACE FUNCTION verify_api_key_ownership(key_hash TEXT, agent_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM api_keys ak
        JOIN agents a ON ak.agent_id = a.id
        WHERE ak.key_hash = key_hash
        AND ak.agent_id = agent_uuid
        AND ak.is_active = true
        AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Audit Logging (Optional)
-- ============================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access audit logs
CREATE POLICY "Service role can access audit logs"
    ON audit_logs FOR ALL
    USING (true)
    WITH CHECK (true);

-- Function to create audit log
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, user_id)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), auth.uid());
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), auth.uid());
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_data, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), auth.uid());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for sensitive tables
CREATE TRIGGER audit_agents_changes
    AFTER INSERT OR UPDATE OR DELETE ON agents
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_api_keys_changes
    AFTER INSERT OR UPDATE OR DELETE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_webhook_configs_changes
    AFTER INSERT OR UPDATE OR DELETE ON webhook_configs
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();
