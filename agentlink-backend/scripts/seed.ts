/**
 * AgentLink MVP - Database Seed Script
 * Seeds the database with initial data for development
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function seed() {
    console.log('🌱 Seeding database...\n');

    // Create test user (if not exists)
    const testUserEmail = 'test@agentlink.io';
    const { data: existingUser } = await supabase
        .from('auth.users')
        .select('id')
        .eq('email', testUserEmail)
        .single();

    let testUserId = existingUser?.id;

    if (!testUserId) {
        const { data: newUser, error } = await supabase.auth.admin.createUser({
            email: testUserEmail,
            password: 'TestPassword123!',
            email_confirm: true,
        });

        if (error) {
            console.error('Failed to create test user:', error);
            return;
        }

        testUserId = newUser.user!.id;
        console.log('✅ Created test user:', testUserEmail);
    } else {
        console.log('ℹ️ Test user already exists');
    }

    // Create test agents
    const agents = [
        {
            name: 'Payment Agent',
            identity_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            owner_id: testUserId,
            capabilities: [
                { name: 'payment', version: '1.0', description: 'Process payments' },
                { name: 'escrow', version: '1.0', description: 'Handle escrow' },
            ],
            endpoint_url: 'https://agent1.agentlink.io',
            is_active: true,
        },
        {
            name: 'Data Oracle',
            identity_address: '0x8ba1f109551bD432803012645Hac136c82C3e8C9',
            owner_id: testUserId,
            capabilities: [
                { name: 'data-feed', version: '2.0', description: 'Provide price feeds' },
            ],
            endpoint_url: 'https://oracle.agentlink.io',
            is_active: true,
        },
        {
            name: 'Trading Bot',
            identity_address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            owner_id: testUserId,
            capabilities: [
                { name: 'trading', version: '1.5', description: 'Automated trading' },
                { name: 'analytics', version: '1.0', description: 'Market analytics' },
            ],
            endpoint_url: null,
            is_active: false,
        },
    ];

    for (const agentData of agents) {
        const { data: existingAgent } = await supabase
            .from('agents')
            .select('id')
            .eq('identity_address', agentData.identity_address)
            .single();

        if (!existingAgent) {
            const { data: agent, error } = await supabase
                .from('agents')
                .insert(agentData)
                .select()
                .single();

            if (error) {
                console.error('Failed to create agent:', error);
                continue;
            }

            console.log('✅ Created agent:', agent.name);

            // Create sample transactions
            const transactions = [
                {
                    agent_id: agent.id,
                    payer_address: '0x1234567890123456789012345678901234567890',
                    receiver_address: agentData.identity_address,
                    amount: '1000000000000000000', // 1 ETH in wei
                    fee: '21000',
                    memo: 'Initial deposit',
                    tx_hash: `0x${randomUUID().replace(/-/g, '')}`,
                    status: 'confirmed' as const,
                },
                {
                    agent_id: agent.id,
                    payer_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
                    receiver_address: agentData.identity_address,
                    amount: '500000000000000000', // 0.5 ETH in wei
                    fee: '21000',
                    memo: 'Service payment',
                    tx_hash: `0x${randomUUID().replace(/-/g, '')}`,
                    status: 'confirmed' as const,
                },
                {
                    agent_id: agent.id,
                    payer_address: '0xfedcbafedcbafedcbafedcbafedcbafedcbafed',
                    receiver_address: agentData.identity_address,
                    amount: '250000000000000000', // 0.25 ETH in wei
                    fee: '21000',
                    memo: null,
                    tx_hash: null,
                    status: 'pending' as const,
                },
            ];

            const { error: txError } = await supabase
                .from('transactions')
                .insert(transactions);

            if (txError) {
                console.error('Failed to create transactions:', txError);
            } else {
                console.log(`  ✅ Created ${transactions.length} transactions`);
            }

            // Create sample telemetry events
            const telemetryEvents = [
                {
                    agent_id: agent.id,
                    event_type: 'agent.startup',
                    payload: { version: '1.0.0', timestamp: Date.now() },
                },
                {
                    agent_id: agent.id,
                    event_type: 'payment.received',
                    payload: { amount: '1000000000000000000', from: '0x1234...' },
                },
                {
                    agent_id: agent.id,
                    event_type: 'health.check',
                    payload: { status: 'healthy', uptime: 3600 },
                },
            ];

            const { error: telemetryError } = await supabase
                .from('telemetry_events')
                .insert(telemetryEvents);

            if (telemetryError) {
                console.error('Failed to create telemetry events:', telemetryError);
            } else {
                console.log(`  ✅ Created ${telemetryEvents.length} telemetry events`);
            }

        } else {
            console.log('ℹ️ Agent already exists:', agentData.name);
        }
    }

    // Create webhook configuration
    const { data: firstAgent } = await supabase
        .from('agents')
        .select('id')
        .eq('name', 'Payment Agent')
        .single();

    if (firstAgent) {
        const { data: existingWebhook } = await supabase
            .from('webhook_configs')
            .select('id')
            .eq('agent_id', firstAgent.id)
            .single();

        if (!existingWebhook) {
            const { error: webhookError } = await supabase
                .from('webhook_configs')
                .insert({
                    agent_id: firstAgent.id,
                    url: 'https://webhook.site/test-webhook',
                    secret: 'whsec_test_secret_key_12345',
                    events: ['payment.received', 'payment.sent'],
                    is_active: true,
                });

            if (webhookError) {
                console.error('Failed to create webhook:', webhookError);
            } else {
                console.log('✅ Created webhook configuration');
            }
        }
    }

    console.log('\n✨ Seeding complete!');
}

seed().catch(console.error);
