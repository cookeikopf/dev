# AgentLink MVP - Backend

Complete Supabase backend for the AgentLink dashboard with authentication, telemetry ingestion, and webhook handling.

## Features

- **Database Schema**: Complete PostgreSQL schema with agents, transactions, telemetry, and API keys
- **Row Level Security (RLS)**: Fine-grained access control policies
- **Authentication**: Supports Supabase Auth, Clerk, and NextAuth.js
- **API Key Management**: Secure API key generation and validation
- **Signature Verification**: EIP-191 and EIP-712 signature support for agent authentication
- **Rate Limiting**: Configurable rate limits per endpoint and user
- **Webhook System**: Send and receive webhooks with retry logic
- **Telemetry Ingestion**: High-throughput event ingestion with multiple auth methods

## Project Structure

```
agentlink-backend/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── agents/           # Agent CRUD endpoints
│   │       ├── transactions/     # Transaction endpoints
│   │       ├── telemetry/        # Telemetry ingestion
│   │       ├── webhooks/         # Webhook management & receiver
│   │       ├── api-keys/         # API key management
│   │       └── health/           # Health check
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client config
│   │   ├── auth.ts               # Authentication utilities
│   │   ├── api-keys.ts           # API key management
│   │   ├── signatures.ts         # EIP-191/712 verification
│   │   ├── rate-limit.ts         # Rate limiting
│   │   ├── webhooks.ts           # Webhook utilities
│   │   ├── validation.ts         # Zod schemas
│   │   └── errors.ts             # Error handling
│   ├── middleware.ts             # Next.js middleware
│   └── types/
│       └── supabase.ts           # Database types
├── supabase/
│   ├── schema.sql                # Complete database schema
│   ├── rls_policies.sql          # RLS policies
│   └── migrations/               # Database migrations
├── scripts/
│   └── seed.ts                   # Database seeding
└── package.json
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### 3. Set Up Supabase

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Or apply schema directly
supabase sql < supabase/schema.sql
supabase sql < supabase/rls_policies.sql
```

### 4. Seed Database (Optional)

```bash
npm run db:seed
```

### 5. Run Development Server

```bash
npm run dev
```

## API Endpoints

### Agents
- `GET /api/agents` - List agents
- `POST /api/agents` - Create agent
- `GET /api/agents/:id` - Get agent details
- `PATCH /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction

### Telemetry
- `GET /api/telemetry` - List telemetry events
- `POST /api/telemetry` - Ingest single event
- `PUT /api/telemetry` - Batch ingest events

### Webhooks
- `GET /api/webhooks` - List webhooks
- `POST /api/webhooks` - Create webhook
- `GET /api/webhooks/deliveries` - List deliveries
- `POST /api/webhooks/receiver` - Receive external webhooks

### API Keys
- `GET /api/api-keys?agent_id=:id` - List API keys
- `POST /api/api-keys` - Create API key
- `DELETE /api/api-keys` - Revoke API key

### Health
- `GET /api/health` - Health check

## Authentication

### User Authentication
Protected endpoints require a valid Supabase session cookie (handled automatically).

### Agent Authentication (Telemetry)
Two methods supported:

1. **API Key** (Recommended for servers):
```bash
curl -X POST https://api.agentlink.io/api/telemetry \
  -H "Authorization: Bearer ag_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "uuid",
    "event_type": "agent.startup",
    "payload": { "version": "1.0.0" }
  }'
```

2. **EIP-191 Signature** (For agents with private keys):
```bash
curl -X POST https://api.agentlink.io/api/telemetry \
  -H "X-Signature: 0x..." \
  -H "X-Signature-Type: eip191" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "uuid",
    "event_type": "agent.startup",
    "payload": { "version": "1.0.0" }
  }'
```

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `agents` | Agent information and configuration |
| `transactions` | Payment transactions |
| `telemetry_events` | Agent telemetry data |
| `api_keys` | API key storage |
| `webhook_configs` | Webhook configurations |
| `webhook_deliveries` | Webhook delivery logs |
| `rate_limits` | Rate limiting data |

### Views

| View | Description |
|------|-------------|
| `agent_summary` | Agents with transaction counts |
| `telemetry_summary` | Telemetry event aggregations |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `AUTH_PROVIDER` | Auth provider (supabase/clerk/nextauth) | No |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | No |

See `.env.example` for complete list.

## Security

- Row Level Security (RLS) policies on all tables
- API key authentication with scope-based permissions
- EIP-191/EIP-712 signature verification
- Rate limiting per IP, user, and agent
- CORS protection
- Security headers (HSTS, CSP, etc.)
- Input validation with Zod
- Audit logging for sensitive operations

## License

MIT
