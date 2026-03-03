-- ============================================
-- AgentLink MVP - Supabase Schema
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Users (handled by Supabase Auth)
-- Additional user metadata
-- ============================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Agents
-- ============================================
CREATE TABLE public.agents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Agent metadata
    name TEXT NOT NULL,
    description TEXT,
    endpoint TEXT NOT NULL,
    agent_card_url TEXT,
    
    -- Blockchain
    wallet_address TEXT,
    chain_id INTEGER DEFAULT 84532, -- Base Sepolia
    
    -- Status
    status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'suspended')),
    is_registered_on_chain BOOLEAN DEFAULT FALSE,
    
    -- Capabilities (stored as JSON for flexibility)
    capabilities JSONB DEFAULT '[]'::jsonb,
    skills JSONB DEFAULT '[]'::jsonb,
    
    -- API key for telemetry (hashed)
    api_key_hash TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_endpoint CHECK (endpoint ~ '^https?://')
);

-- Index for user queries
CREATE INDEX idx_agents_user_id ON public.agents(user_id);
CREATE INDEX idx_agents_status ON public.agents(status);
CREATE INDEX idx_agents_wallet ON public.agents(wallet_address);

-- ============================================
-- Tasks
-- ============================================
CREATE TABLE public.tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Task metadata
    external_task_id TEXT, -- From A2A protocol
    session_id TEXT,
    
    -- Participants
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    requester_address TEXT, -- External requester
    
    -- Task content
    capability TEXT NOT NULL,
    input_payload JSONB,
    output_payload JSONB,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'input-required', 'completed', 'failed', 'cancelled')),
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Metrics
    duration_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    
    -- Error tracking
    error_message TEXT,
    error_code TEXT
);

-- Indexes
CREATE INDEX idx_tasks_agent_id ON public.tasks(agent_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_created_at ON public.tasks(created_at);
CREATE INDEX idx_tasks_external_id ON public.tasks(external_task_id);

-- ============================================
-- Payments
-- ============================================
CREATE TABLE public.payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Payment details
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    
    -- Transaction details
    tx_hash TEXT UNIQUE,
    payment_id TEXT, -- From x402 protocol
    
    -- Token details
    token_address TEXT NOT NULL,
    token_symbol TEXT DEFAULT 'USDC',
    amount TEXT NOT NULL, -- Stored as string for precision
    decimals INTEGER DEFAULT 6,
    
    -- Participants
    payer_address TEXT NOT NULL,
    receiver_address TEXT NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'settled', 'refunded', 'failed')),
    
    -- Network
    chain_id INTEGER DEFAULT 84532,
    network TEXT DEFAULT 'base-sepolia',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_payments_agent_id ON public.payments(agent_id);
CREATE INDEX idx_payments_task_id ON public.payments(task_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_payer ON public.payments(payer_address);
CREATE INDEX idx_payments_created_at ON public.payments(created_at);

-- ============================================
-- Telemetry Events
-- ============================================
CREATE TABLE public.telemetry_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Event source
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    
    -- Event details
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Timestamp (from agent)
    event_timestamp TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Session tracking
    session_id TEXT
);

-- Indexes for efficient querying
CREATE INDEX idx_telemetry_agent_id ON public.telemetry_events(agent_id);
CREATE INDEX idx_telemetry_event_type ON public.telemetry_events(event_type);
CREATE INDEX idx_telemetry_event_timestamp ON public.telemetry_events(event_timestamp);
CREATE INDEX idx_telemetry_session ON public.telemetry_events(session_id);

-- Partition by time for performance (optional, for production)
-- CREATE TABLE public.telemetry_events_partitioned (LIKE public.telemetry_events) PARTITION BY RANGE (event_timestamp);

-- ============================================
-- Agent Registry (On-chain cache)
-- ============================================
CREATE TABLE public.agent_registry (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- On-chain data
    agent_id TEXT UNIQUE NOT NULL, -- From smart contract
    contract_address TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    
    -- Agent details
    name TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    owner_address TEXT NOT NULL,
    capabilities_hash TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_registry_agent_id ON public.agent_registry(agent_id);
CREATE INDEX idx_registry_owner ON public.agent_registry(owner_address);
CREATE INDEX idx_registry_active ON public.agent_registry(is_active);

-- ============================================
-- Webhook Subscriptions
-- ============================================
CREATE TABLE public.webhook_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    
    -- Webhook config
    url TEXT NOT NULL,
    secret TEXT, -- For HMAC verification
    
    -- Event filters
    event_types TEXT[] DEFAULT '{}'::text[],
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_delivered_at TIMESTAMPTZ,
    delivery_failures INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Functions & Triggers
-- ============================================

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_webhook_subscriptions_updated_at BEFORE UPDATE ON public.webhook_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Agents: Users can only see their own agents
CREATE POLICY "Users can view own agents" ON public.agents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create agents" ON public.agents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents" ON public.agents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents" ON public.agents
    FOR DELETE USING (auth.uid() = user_id);

-- Tasks: Users can see tasks for their agents
CREATE POLICY "Users can view tasks for their agents" ON public.tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE agents.id = tasks.agent_id 
            AND agents.user_id = auth.uid()
        )
    );

-- Payments: Users can see payments for their agents
CREATE POLICY "Users can view payments for their agents" ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE agents.id = payments.agent_id 
            AND agents.user_id = auth.uid()
        )
    );

-- Telemetry: Users can see telemetry for their agents
CREATE POLICY "Users can view telemetry for their agents" ON public.telemetry_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE agents.id = telemetry_events.agent_id 
            AND agents.user_id = auth.uid()
        )
    );

-- Agent Registry: Public read access
CREATE POLICY "Agent registry is public" ON public.agent_registry
    FOR SELECT USING (true);

-- ============================================
-- Views for Analytics
-- ============================================

-- Agent performance summary
CREATE VIEW public.agent_performance AS
SELECT 
    a.id as agent_id,
    a.name as agent_name,
    a.user_id,
    COUNT(t.id) as total_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.status = 'failed' THEN 1 END) as failed_tasks,
    AVG(t.duration_ms) as avg_duration_ms,
    SUM(CASE WHEN p.status = 'settled' THEN p.amount::numeric ELSE 0 END) as total_revenue
FROM public.agents a
LEFT JOIN public.tasks t ON t.agent_id = a.id
LEFT JOIN public.payments p ON p.task_id = t.id
GROUP BY a.id, a.name, a.user_id;

-- Daily metrics
CREATE VIEW public.daily_metrics AS
SELECT 
    DATE_TRUNC('day', t.created_at) as date,
    COUNT(t.id) as tasks_created,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as tasks_completed,
    SUM(CASE WHEN p.status = 'settled' THEN p.amount::numeric ELSE 0 END) as daily_volume
FROM public.tasks t
LEFT JOIN public.payments p ON p.task_id = t.id
GROUP BY DATE_TRUNC('day', t.created_at)
ORDER BY date DESC;
