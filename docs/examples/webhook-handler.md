# Example: Webhook Handler

A complete webhook handler for AgentLink events.

## Overview

This example demonstrates:
- Webhook signature verification
- Event handling
- Retry logic
- Idempotency
- Error handling

## Complete Implementation

### webhook-server.ts

```typescript
import express from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const app = express();

// Parse raw body for signature verification
app.use('/webhooks', express.raw({ type: 'application/json' }));

// JSON parsing for other routes
app.use(express.json());

// Supabase client for storing events
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// Webhook handler
app.post('/webhooks/agentlink', async (req, res) => {
  const signature = req.headers['x-agentlink-signature'] as string;
  const timestamp = req.headers['x-agentlink-timestamp'] as string;
  const eventId = req.headers['x-agentlink-event-id'] as string;
  
  try {
    // Verify signature
    if (!verifySignature(req.body, signature, timestamp)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Check timestamp (prevent replay attacks)
    const eventTime = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - eventTime) > 300) { // 5 minute window
      console.error('Webhook timestamp too old');
      return res.status(401).json({ error: 'Timestamp expired' });
    }
    
    // Parse event
    const event = JSON.parse(req.body.toString());
    
    // Check idempotency
    const isDuplicate = await checkDuplicateEvent(eventId);
    if (isDuplicate) {
      console.log(`Duplicate event: ${eventId}`);
      return res.status(200).json({ received: true, duplicate: true });
    }
    
    // Store event
    await storeEvent(eventId, event);
    
    // Process event
    await processEvent(event);
    
    // Acknowledge receipt
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// Signature verification
function verifySignature(
  payload: Buffer,
  signature: string,
  timestamp: string
): boolean {
  const secret = process.env.WEBHOOK_SECRET!;
  
  // Create expected signature
  const signedPayload = `${timestamp}.${payload.toString()}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Check for duplicate events
async function checkDuplicateEvent(eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .single();
  
  return !!data;
}

// Store event for idempotency
async function storeEvent(eventId: string, event: any): Promise<void> {
  await supabase
    .from('webhook_events')
    .insert({
      event_id: eventId,
      event_type: event.type,
      payload: event,
      processed_at: new Date().toISOString()
    });
}

// Process events
async function processEvent(event: WebhookEvent): Promise<void> {
  console.log(`Processing event: ${event.type}`);
  
  switch (event.type) {
    case 'payment.received':
      await handlePaymentReceived(event.data);
      break;
      
    case 'payment.failed':
      await handlePaymentFailed(event.data);
      break;
      
    case 'request.completed':
      await handleRequestCompleted(event.data);
      break;
      
    case 'request.failed':
      await handleRequestFailed(event.data);
      break;
      
    case 'agent.started':
      await handleAgentStarted(event.data);
      break;
      
    case 'agent.stopped':
      await handleAgentStopped(event.data);
      break;
      
    case 'quota.exceeded':
      await handleQuotaExceeded(event.data);
      break;
      
    default:
      console.log(`Unknown event type: ${event.type}`);
  }
}

// Event handlers
async function handlePaymentReceived(data: PaymentEventData): Promise<void> {
  console.log('💰 Payment received:', {
    amount: data.amount,
    currency: data.currency,
    agent: data.agentName,
    wallet: data.walletAddress
  });
  
  // Update analytics
  await supabase
    .from('payments')
    .insert({
      amount: data.amount,
      currency: data.currency,
      agent_name: data.agentName,
      wallet_address: data.walletAddress,
      tx_hash: data.txHash,
      request_id: data.requestId
    });
  
  // Send notification
  await sendNotification({
    type: 'payment_received',
    title: 'New Payment',
    message: `Received $${data.amount} ${data.currency}`,
    data
  });
}

async function handlePaymentFailed(data: PaymentFailedData): Promise<void> {
  console.error('❌ Payment failed:', {
    error: data.error,
    agent: data.agentName,
    wallet: data.walletAddress
  });
  
  // Log failure
  await supabase
    .from('payment_failures')
    .insert({
      error: data.error,
      agent_name: data.agentName,
      wallet_address: data.walletAddress,
      request_id: data.requestId
    });
  
  // Alert if high failure rate
  await checkFailureRate(data.agentName);
}

async function handleRequestCompleted(data: RequestEventData): Promise<void> {
  console.log('✅ Request completed:', {
    requestId: data.requestId,
    capability: data.capability,
    duration: data.duration
  });
  
  // Update metrics
  await supabase
    .from('requests')
    .insert({
      request_id: data.requestId,
      capability: data.capability,
      agent_name: data.agentName,
      duration_ms: data.duration,
      wallet_address: data.walletAddress
    });
}

async function handleRequestFailed(data: RequestFailedData): Promise<void> {
  console.error('❌ Request failed:', {
    requestId: data.requestId,
    error: data.error
  });
  
  // Log error
  await supabase
    .from('request_failures')
    .insert({
      request_id: data.requestId,
      error: data.error,
      agent_name: data.agentName,
      capability: data.capability
    });
}

async function handleAgentStarted(data: AgentEventData): Promise<void> {
  console.log('🚀 Agent started:', data.agentName);
  
  await supabase
    .from('agent_events')
    .insert({
      event_type: 'started',
      agent_name: data.agentName,
      timestamp: data.timestamp
    });
}

async function handleAgentStopped(data: AgentEventData): Promise<void> {
  console.log('🛑 Agent stopped:', data.agentName);
  
  await supabase
    .from('agent_events')
    .insert({
      event_type: 'stopped',
      agent_name: data.agentName,
      timestamp: data.timestamp
    });
}

async function handleQuotaExceeded(data: QuotaEventData): Promise<void> {
  console.log('⚠️ Quota exceeded:', {
    wallet: data.walletAddress,
    quota: data.quota
  });
  
  // Notify user
  await sendNotification({
    type: 'quota_exceeded',
    title: 'Free Quota Exceeded',
    message: 'You have used all your free requests',
    data
  });
}

// Helper functions
async function checkFailureRate(agentName: string): Promise<void> {
  const { data } = await supabase
    .from('payment_failures')
    .select('*')
    .eq('agent_name', agentName)
    .gte('created_at', new Date(Date.now() - 3600000).toISOString()); // Last hour
  
  if (data && data.length > 10) {
    await sendAlert({
      severity: 'high',
      message: `High payment failure rate for ${agentName}: ${data.length} failures in last hour`
    });
  }
}

async function sendNotification(notification: Notification): Promise<void> {
  // Send to your notification service
  console.log('Sending notification:', notification);
}

async function sendAlert(alert: Alert): Promise<void> {
  // Send to your alerting service
  console.log('Sending alert:', alert);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() });
});

// Event statistics
app.get('/stats', async (req, res) => {
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .gte('created_at', new Date(Date.now() - 86400000).toISOString());
  
  const { data: requests } = await supabase
    .from('requests')
    .select('*')
    .gte('created_at', new Date(Date.now() - 86400000).toISOString());
  
  const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  
  res.json({
    last24Hours: {
      totalRevenue,
      totalRequests: requests?.length || 0,
      averageDuration: requests?.length 
        ? requests.reduce((sum, r) => sum + r.duration_ms, 0) / requests.length 
        : 0
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🎣 Webhook server running on port ${PORT}`);
});

// Type definitions
interface WebhookEvent {
  type: string;
  data: any;
  timestamp: string;
}

interface PaymentEventData {
  amount: number;
  currency: string;
  agentName: string;
  walletAddress: string;
  txHash?: string;
  requestId: string;
}

interface PaymentFailedData {
  error: string;
  agentName: string;
  walletAddress: string;
  requestId: string;
}

interface RequestEventData {
  requestId: string;
  capability: string;
  agentName: string;
  duration: number;
  walletAddress?: string;
}

interface RequestFailedData {
  requestId: string;
  error: string;
  agentName: string;
  capability: string;
}

interface AgentEventData {
  agentName: string;
  timestamp: string;
}

interface QuotaEventData {
  walletAddress: string;
  quota: number;
}

interface Notification {
  type: string;
  title: string;
  message: string;
  data: any;
}

interface Alert {
  severity: 'low' | 'medium' | 'high';
  message: string;
}
```

## Database Schema

```sql
-- Webhook events table
CREATE TABLE webhook_events (
  id SERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);

-- Payments table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  amount DECIMAL(10, 6) NOT NULL,
  currency TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT,
  request_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_agent ON payments(agent_name);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- Payment failures table
CREATE TABLE payment_failures (
  id SERIAL PRIMARY KEY,
  error TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  request_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Requests table
CREATE TABLE requests (
  id SERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  duration_ms INTEGER,
  wallet_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_requests_agent ON requests(agent_name);
CREATE INDEX idx_requests_created_at ON requests(created_at);

-- Request failures table
CREATE TABLE request_failures (
  id SERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  error TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  capability TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent events table
CREATE TABLE agent_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Environment Variables

```bash
# .env
PORT=3001
WEBHOOK_SECRET=your_webhook_secret_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key
```

## Testing Webhooks Locally

```bash
# Install dependencies
npm install express @supabase/supabase-js

# Run server
npx tsx webhook-server.ts

# Test with curl
curl -X POST http://localhost:3001/webhooks/agentlink \
  -H "Content-Type: application/json" \
  -H "X-AgentLink-Signature: test-signature" \
  -H "X-AgentLink-Timestamp: 1705312800" \
  -H "X-AgentLink-Event-ID: evt_123" \
  -d '{
    "type": "payment.received",
    "data": {
      "amount": 0.05,
      "currency": "USD",
      "agentName": "test-agent",
      "walletAddress": "0x123...",
      "requestId": "req_456"
    },
    "timestamp": "2024-01-15T10:00:00Z"
  }'
```

## Deployment

### Vercel

```javascript
// api/webhooks/agentlink.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get raw body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  
  // Verify signature
  const signature = req.headers['x-agentlink-signature'];
  const timestamp = req.headers['x-agentlink-timestamp'];
  
  if (!verifySignature(body, signature, timestamp)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process event
  const event = JSON.parse(body.toString());
  await processEvent(event);
  
  res.status(200).json({ received: true });
}

function verifySignature(payload, signature, timestamp) {
  const secret = process.env.WEBHOOK_SECRET;
  const signedPayload = `${timestamp}.${payload.toString()}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return signature === expected;
}

async function processEvent(event) {
  // Store and process event
  console.log('Processing:', event.type);
}
```

## Best Practices

1. **Always verify signatures** - Prevent spoofed webhooks
2. **Check timestamps** - Prevent replay attacks
3. **Implement idempotency** - Handle duplicate events
4. **Return 200 quickly** - Acknowledge receipt fast
5. **Process asynchronously** - Don't block the response
6. **Log everything** - For debugging and auditing
7. **Set up monitoring** - Alert on failures
