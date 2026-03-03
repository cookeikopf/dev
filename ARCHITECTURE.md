# AgentLink MVP - Technical Architecture

## Table of Contents
1. [Overview](#overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Package Dependency Graph](#package-dependency-graph)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Interface Contracts](#interface-contracts)
6. [Technology Decision Records](#technology-decision-records)
7. [Security Architecture](#security-architecture)
8. [Deployment Architecture](#deployment-architecture)

---

## Overview

AgentLink is a decentralized protocol enabling autonomous agents to discover, communicate, and transact with each other. The MVP consists of:

- **Core SDK**: TypeScript library for agent integration
- **CLI Tool**: Developer tooling for agent management
- **Dashboard**: Web interface for monitoring and configuration
- **Smart Contracts**: On-chain protocol logic (x402 payments, A2A coordination)
- **Example Agent**: Reference implementation (paid-research-agent)

---

## Monorepo Structure

```
agentlink-mvp/
├── 📁 .github/
│   └── workflows/
│       ├── ci.yml                    # Main CI pipeline
│       ├── release.yml               # NPM publishing
│       └── contract-tests.yml        # Foundry test automation
│
├── 📁 .husky/                        # Git hooks
│   └── pre-commit
│
├── 📁 packages/
│   │
│   ├── 📁 @agentlink-core/           # Core TypeScript SDK
│   │   ├── src/
│   │   │   ├── index.ts              # Public API exports
│   │   │   ├── types/
│   │   │   │   ├── index.ts          # Shared type definitions
│   │   │   │   ├── a2a.ts            # A2A protocol types
│   │   │   │   ├── x402.ts           # x402 payment types
│   │   │   │   └── telemetry.ts      # Telemetry types
│   │   │   ├── client/
│   │   │   │   ├── AgentClient.ts    # HTTP client for agent comms
│   │   │   │   ├── DiscoveryClient.ts # Agent discovery
│   │   │   │   └── PaymentClient.ts  # x402 payment handling
│   │   │   ├── protocol/
│   │   │   │   ├── a2a/
│   │   │   │   │   ├── AgentCard.ts  # Agent capability descriptor
│   │   │   │   │   ├── TaskManager.ts # Task lifecycle management
││   │   │   │   │   └── MessageRouter.ts # Message routing logic
│   │   │   │   └── x402/
│   │   │   │       ├── PaymentVerifier.ts  # Verify on-chain payments
│   │   │   │       ├── PaymentRequest.ts   # Create payment requests
│   │   │   │       └── middleware.ts       # Express/Fastify middleware
│   │   │   ├── telemetry/
│   │   │   │   ├── TelemetryCollector.ts   # Event collection
│   │   │   │   ├── TelemetryReporter.ts    # Send to dashboard
│   │   │   │   └── exporters/
│   │   │   │       ├── ConsoleExporter.ts
│   │   │   │       └── DashboardExporter.ts
│   │   │   └── utils/
│   │   │       ├── crypto.ts         # Signing utilities
│   │   │       ├── validation.ts     # Input validation
│   │   │       └── errors.ts         # Custom error classes
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── README.md
│   │
│   └── 📁 @agentlink-cli/            # CLI Tool
│       ├── src/
│       │   ├── index.ts              # CLI entry point
│       │   ├── commands/
│       │   │   ├── init.ts           # Initialize new agent project
│       │   │   ├── deploy.ts         # Deploy agent configuration
│       │   │   ├── register.ts       # Register agent to directory
│       │   │   ├── verify.ts         # Verify agent setup
│       │   │   ├── logs.ts           # Stream agent logs
│       │   │   └── config.ts         # Manage configuration
│       │   ├── templates/
│       │   │   ├── express-agent/    # Express.js agent template
│       │   │   ├── fastify-agent/    # Fastify agent template
│       │   │   └── nextjs-agent/     # Next.js agent template
│       │   └── utils/
│       │       ├── configLoader.ts
│       │       ├── projectGenerator.ts
│       │       └── validators.ts
│       ├── tests/
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
│
├── 📁 apps/
│   └── 📁 dashboard/                 # Next.js Dashboard Application
│       ├── src/
│       │   ├── app/                  # Next.js App Router
│       │   │   ├── (auth)/
│       │   │   │   ├── login/
│       │   │   │   └── register/
│       │   │   ├── (dashboard)/
│       │   │   │   ├── agents/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   └── [id]/
│       │   │   │   ├── tasks/
│       │   │   │   ├── payments/
│       │   │   │   └── settings/
│       │   │   └── api/
│       │   │       ├── agents/
│       │   │       ├── tasks/
│       │   │       ├── telemetry/
│       │   │       └── webhooks/
│       │   ├── components/
│       │   │   ├── ui/               # shadcn/ui components
│       │   │   ├── agents/
│       │   │   ├── tasks/
│       │   │   └── payments/
│       │   ├── hooks/
│       │   │   ├── useAgents.ts
│       │   │   ├── useTasks.ts
│       │   │   └── useTelemetry.ts
│       │   ├── lib/
│       │   │   ├── supabase/
│       │   │   │   ├── client.ts
│       │   │   │   └── server.ts
│       │   │   ├── wagmi/
│       │   │   │   └── config.ts
│       │   │   └── utils.ts
│       │   └── types/
│       │       └── index.ts
│       ├── public/
│       ├── tests/
│       │   └── e2e/
│       ├── supabase/
│       │   ├── migrations/
│       │   └── seed.sql
│       ├── package.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── playwright.config.ts
│       └── tsconfig.json
│
├── 📁 contracts/                     # Foundry Smart Contracts
│   ├── src/
│   │   ├── x402/
│   │   │   ├── PaymentProcessor.sol  # Main x402 payment logic
│   │   │   ├── PaymentEscrow.sol     # Escrow for pending payments
│   │   │   ├── interfaces/
│   │   │   │   ├── IPaymentProcessor.sol
│   │   │   │   └── IEscrow.sol
│   │   │   └── libraries/
│   │   │       ├── PaymentLib.sol
│   │   │       └── VerificationLib.sol
│   │   ├── a2a/
│   │   │   ├── AgentRegistry.sol     # On-chain agent directory
│   │   │   ├── TaskCoordinator.sol   # Task assignment & verification
│   │   │   ├── interfaces/
│   │   │   │   ├── IAgentRegistry.sol
│   │   │   │   └── ITaskCoordinator.sol
│   │   │   └── libraries/
│   │   │       └── TaskLib.sol
│   │   └── shared/
│   │       ├── types/
│   │       │   └── AgentTypes.sol
│   │       └── utils/
│   │           └── AccessControl.sol
│   ├── test/
│   │   ├── x402/
│   │   ├── a2a/
│   │   └── mocks/
│   ├── script/
│   │   ├── Deploy.s.sol
│   │   └── Upgrade.s.sol
│   ├── foundry.toml
│   ├── remappings.txt
│   └── README.md
│
├── 📁 examples/
│   └── 📁 paid-research-agent/       # Reference Implementation
│       ├── src/
│       │   ├── index.ts              # Agent entry point
│       │   ├── agent.ts              # Agent logic
│       │   ├── services/
│       │   │   ├── research.ts       # Research capabilities
│       │   │   └── pricing.ts        # Pricing configuration
│       │   └── config/
│       │       └── agent.config.ts
│       ├── agent-card.json           # A2A Agent Card
│       ├── package.json
│       └── README.md
│
├── 📁 docs/                          # Documentation
│   ├── architecture/
│   ├── api/
│   └── guides/
│
├── 📁 config/                        # Shared configuration
│   ├── eslint/
│   ├── prettier/
│   └── typescript/
│
├── package.json                      # Root package.json
├── pnpm-workspace.yaml               # pnpm workspace config
├── turbo.json                        # Turborepo pipeline config
├── tsconfig.json                     # Root TypeScript config
└── README.md
```

---

## Package Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PACKAGE DEPENDENCY GRAPH                             │
└─────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │   SHARED    │
                                    │   TYPES     │
                                    │  (types/)   │
                                    └──────┬──────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │  @agentlink/    │          │  @agentlink/    │          │   CONTRACTS     │
    │     core        │◄────────►│     cli         │          │  (Solidity)     │
    │   (SDK)         │  used by │   (CLI Tool)    │          │                 │
    └────────┬────────┘          └─────────────────┘          └────────┬────────┘
             │                                                          │
             │  exports                                                 │  deployed to
             ▼                                                          ▼
    ┌─────────────────┐                                      ┌─────────────────┐
    │  examples/      │                                      │  BLOCKCHAIN     │
    │  paid-research  │                                      │  (Base Sepolia) │
    │     -agent      │                                      │                 │
    └────────┬────────┘                                      └─────────────────┘
             │
             │  reports telemetry
             ▼
    ┌─────────────────┐          ┌─────────────────┐
    │   DASHBOARD     │◄─────────│   SUPABASE      │
    │   (Next.js)     │  queries │  (PostgreSQL)   │
    └─────────────────┘          └─────────────────┘


LEGEND:
───────
──►  Depends on / Uses
◄──  Consumed by / Reports to
◄─►  Bidirectional dependency
```

### Dependency Details

| Package | Dependencies | Consumers |
|---------|--------------|-----------|
| `@agentlink/core` | viem, zod, uuid | `@agentlink/cli`, `examples/*`, external agents |
| `@agentlink/cli` | `@agentlink/core`, commander, inquirer, chalk | None (end-user tool) |
| `apps/dashboard` | Next.js, @supabase/*, wagmi, @agentlink/core | None (end-user app) |
| `contracts` | OpenZeppelin, forge-std | Deployed to Base Sepolia |
| `examples/paid-research-agent` | `@agentlink/core`, express, openai | None (reference impl) |

---

## Data Flow Diagrams

### 1. x402 Payment Flow

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                          x402 PAYMENT FLOW                                      │
│                    (Agent-to-Agent Payment Protocol)                            │
└────────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐                    ┌──────────────┐                    ┌──────────────┐
    │   CLIENT     │                    │   SERVER     │                    │  BLOCKCHAIN  │
    │   (Buyer)    │                    │   (Seller)   │                    │  (Base)      │
    └──────┬───────┘                    └──────┬───────┘                    └──────┬───────┘
           │                                    │                                   │
           │  1. Request service                │                                   │
           │ ─────────────────────────────────► │                                   │
           │                                    │                                   │
           │  2. Return 402 + Payment Header    │                                   │
           │ ◄───────────────────────────────── │                                   │
           │     X-Payment-Required:            │                                   │
           │     {                              │                                   │
           │       "scheme": "x402",            │                                   │
           │       "network": "base-sepolia",   │                                   │
           │       "amount": "1000000",         │  1 USDC (6 decimals)             │
           │       "receiver": "0x...",         │                                   │
           │       "deadline": 1234567890,      │                                   │
           │       "payload": "0x..."           │                                   │
           │     }                              │                                   │
           │                                    │                                   │
           │  3. Create & sign payment tx       │                                   │
           │ ─────────────────────────────────────────────────────────────────────► │
           │     (User signs with wallet)       │                                   │
           │                                    │                                   │
           │                                    │                                   │  4. Verify
           │                                    │                                   │     on-chain
           │                                    │                                   │     ◄──────┐
           │                                    │                                   │            │
           │  5. Return signed tx proof         │                                   │            │
           │ ─────────────────────────────────► │                                   │            │
           │     Authorization:                 │                                   │            │
           │     X402 {                         │                                   │            │
           │       "txHash": "0x...",           │                                   │            │
           │       "signature": "0x..."         │                                   │            │
           │     }                              │                                   │            │
           │                                    │                                   │            │
           │                                    │  6. Verify payment on-chain       │            │
           │                                    │ ─────────────────────────────────► │            │
           │                                    │     call PaymentProcessor.verify()│            │
           │                                    │                                   │            │
           │                                    │                                   │  7. Confirm
           │                                    │ ◄───────────────────────────────── │ ───────────┘
           │                                    │     Payment verified              │
           │                                    │                                   │
           │  8. Return service response        │                                   │
           │ ◄───────────────────────────────── │                                   │
           │     (Research results, etc.)       │                                   │
           │                                    │                                   │
           │                                    │                                   │
           ▼                                    ▼                                   ▼

    ┌────────────────────────────────────────────────────────────────────────────────┐
    │                         SETTLEMENT (Async)                                      │
    └────────────────────────────────────────────────────────────────────────────────┘

           │                                    │  9. Submit for settlement         │
           │                                    │ ─────────────────────────────────► │
           │                                    │     (After service completion)    │
           │                                    │                                   │
           │                                    │                                   │ 10. Transfer
           │                                    │                                   │     USDC to
           │                                    │                                   │     seller
           │                                    │                                   │
           │  11. Emit PaymentSettled event    │                                   │
           │ ◄───────────────────────────────────────────────────────────────────── │
           │     (Webhook notification)         │                                   │
           │                                    │                                   │
```

### 2. A2A Protocol Interaction Flow

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                       A2A PROTOCOL INTERACTION FLOW                             │
│                    (Agent-to-Agent Communication)                               │
└────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
    │  AGENT A        │              │  AGENT DIRECTORY│              │  AGENT B        │
    │ (Research Agent)│              │  (On-chain +    │              │ (Analysis Agent)│
    │                 │              │   Off-chain)    │              │                 │
    └────────┬────────┘              └────────┬────────┘              └────────┬────────┘
             │                                │                                │
             │  1. Register Agent Card        │                                │
             │ ─────────────────────────────► │                                │
             │    POST /agents/register       │                                │
             │    {                           │                                │
             │      "name": "ResearchBot",    │                                │
             │      "capabilities": ["research", "summarize"],               │
             │      "endpoint": "https://...",│                                │
             │      "pricing": {...}          │                                │
             │    }                           │                                │
             │                                │                                │
             │                                │  2. Store in registry          │
             │                                │  ─────────────────────────────►│
             │                                │     (On-chain + IPFS)          │
             │                                │                                │
             │  3. Confirm registration       │                                │
             │ ◄───────────────────────────── │                                │
             │                                │                                │
             │                                │                                │
             │════════════════════════════════════════════════════════════════│
             │         DISCOVERY PHASE                                        │
             │════════════════════════════════════════════════════════════════│
             │                                │                                │
             │  4. Query for capabilities     │                                │
             │ ─────────────────────────────► │                                │
             │    GET /agents?capability=analysis                              │
             │                                │                                │
             │                                │  5. Return matching agents     │
             │                                │ ◄───────────────────────────── │
             │                                │                                │
             │  6. Receive Agent B info       │                                │
             │ ◄───────────────────────────── │                                │
             │    {                           │                                │
             │      "agentId": "agent-b-123", │                                │
             │      "endpoint": "https://b...",                                │
             │      "capabilities": ["analysis", "insights"]                    │
             │    }                           │                                │
             │                                │                                │
             │════════════════════════════════════════════════════════════════│
             │         TASK NEGOTIATION                                       │
             │════════════════════════════════════════════════════════════════│
             │                                │                                │
             │  7. Fetch Agent Card           │                                │
             │ ─────────────────────────────────────────────────────────────► │
             │    GET /.well-known/agent-card │                                │
             │                                │                                │
             │  8. Return Agent Card          │                                │
             │ ◄───────────────────────────────────────────────────────────── │
             │    {                           │                                │
             │      "name": "AnalysisBot",    │                                │
             │      "capabilities": {...},    │                                │
             │      "skills": [...],          │                                │
             │      "authentication": {...}   │                                │
             │    }                           │                                │
             │                                │                                │
             │  9. Send Task Request          │                                │
             │ ─────────────────────────────────────────────────────────────► │
             │    POST /a2a/tasks/send        │                                │
             │    {                           │                                │
             │      "id": "task-123",         │                                │
             │      "message": {              │                                │
             │        "role": "user",         │                                │
             │        "parts": [{"text": "Analyze this research..."}]         │
             │      },                        │                                │
             │      "acceptedOutputModes": ["text", "json"]                    │
             │    }                           │                                │
             │                                │                                │
             │ 10. Return Task Created        │                                │
             │ ◄───────────────────────────────────────────────────────────── │
             │    {                           │                                │
             │      "id": "task-123",         │                                │
             │      "status": "submitted",    │                                │
             │      "sessionId": "sess-456"   │                                │
             │    }                           │                                │
             │                                │                                │
             │════════════════════════════════════════════════════════════════│
             │         TASK EXECUTION                                         │
             │════════════════════════════════════════════════════════════════│
             │                                │                                │
             │ 11. Subscribe to updates       │                                │
             │ ─────────────────────────────────────────────────────────────► │
             │    POST /a2a/tasks/sendSubscribe                                │
             │    (SSE stream)                │                                │
             │                                │                                │
             │ 12. Stream status updates      │                                │
             │ ◄═════════════════════════════════════════════════════════════ │
             │    data: {"status": "working"} │                                │
             │    data: {"status": "input-required"}                           │
             │    data: {"status": "completed", "result": {...}}               │
             │                                │                                │
             │                                │                                │
             │════════════════════════════════════════════════════════════════│
             │         PAYMENT (if required)                                  │
             │════════════════════════════════════════════════════════════════│
             │                                │                                │
             │ 13. x402 payment flow          │                                │
             │ ◄═════════════════════════════════════════════════════════════ │
             │    (See x402 Payment Flow above)                                │
             │                                │                                │
             │                                │                                │
             ▼                                ▼                                ▼
```

### 3. Telemetry Ingestion Flow

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        TELEMETRY INGESTION FLOW                                 │
│                    (Agent Monitoring & Analytics)                               │
└────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
    │  AGENT SDK      │              │  DASHBOARD API  │              │  SUPABASE       │
    │  (Core Package) │              │  (Next.js API)  │              │  (PostgreSQL)   │
    └────────┬────────┘              └────────┬────────┘              └────────┬────────┘
             │                                │                                │
             │  1. Initialize Telemetry       │                                │
             │    TelemetryCollector.init({   │                                │
             │      agentId: "agent-123",     │                                │
             │      apiKey: "tk_...",         │                                │
             │      endpoint: "https://..."   │                                │
             │    })                          │                                │
             │                                │                                │
             │════════════════════════════════════════════════════════════════│
             │         AUTOMATIC COLLECTION                                   │
             │════════════════════════════════════════════════════════════════│
             │                                │                                │
             │  2. Collect events             │                                │
             │    - Task started              │                                │
             │    - Task completed            │                                │
             │    - Payment received          │                                │
             │    - Error occurred            │                                │
             │    - Performance metrics       │                                │
             │                                │                                │
             │  3. Batch & buffer             │                                │
             │    (In-memory queue)           │                                │
             │                                │                                │
             │  4. Send batch (every 30s)     │                                │
             │ ─────────────────────────────► │                                │
             │    POST /api/telemetry/batch   │                                │
             │    Headers:                    │                                │
             │      X-Agent-ID: agent-123     │                                │
             │      X-API-Key: tk_...         │                                │
             │    Body:                       │                                │
             │    {                           │                                │
             │      "events": [               │                                │
             │        {                       │                                │
             │          "type": "task.completed",                              │
             │          "timestamp": 1234567890,                               │
             │          "data": {...}         │                                │
             │        }                       │                                │
             │      ]                         │                                │
             │    }                           │                                │
             │                                │                                │
             │                                │  5. Validate API key           │
             │                                │    (Check against agents table)│
             │                                │                                │
             │                                │  6. Insert events              │
             │                                │ ─────────────────────────────► │
             │                                │    INSERT INTO telemetry_events │
             │                                │                                │
             │                                │                                │
             │  7. Return 200 OK              │                                │
             │ ◄───────────────────────────── │                                │
             │                                │                                │
             │════════════════════════════════════════════════════════════════│
             │         REAL-TIME UPDATES                                      │
             │════════════════════════════════════════════════════════════════│
             │                                │                                │
             │                                │  8. Trigger webhook/SSE        │
             │                                │ ─────────────────────────────► │
             │                                │    (For live dashboard)        │
             │                                │                                │
             │  9. Receive real-time update   │                                │
             │ ◄───────────────────────────── │                                │
             │    (Dashboard WebSocket/SSE)   │                                │
             │                                │                                │
             ▼                                ▼                                ▼


    ┌────────────────────────────────────────────────────────────────────────────────┐
    │                         TELEMETRY EVENT SCHEMA                                  │
    └────────────────────────────────────────────────────────────────────────────────┘

    Event Types:
    ┌────────────────────┬──────────────────────────────────────────────────────────┐
    │ Type               │ Data Structure                                           │
    ├────────────────────┼──────────────────────────────────────────────────────────┤
    │ task.started       │ { taskId, sessionId, capability, inputSize }            │
    │ task.completed     │ { taskId, duration, outputSize, status }                │
    │ task.failed        │ { taskId, error, errorType }                            │
    │ payment.received   │ { amount, token, payer, taskId }                        │
    │ payment.sent       │ { amount, token, payee, taskId }                        │
    │ agent.registered   │ { agentId, capabilities }                               │
    │ error.occurred     │ { error, stack, context }                               │
    │ performance.metric │ { metric, value, unit }                                 │
    └────────────────────┴──────────────────────────────────────────────────────────┘
```

---

## Interface Contracts

### 1. SDK Public API

```typescript
// @agentlink/core - Public API

// ============================================
// AGENT CLIENT
// ============================================

interface AgentClientConfig {
  agentId: string;
  privateKey?: string;  // For signing
  apiKey?: string;      // For telemetry
  telemetryEndpoint?: string;
}

class AgentClient {
  constructor(config: AgentClientConfig);
  
  // Discovery
  async discoverAgents(filter: AgentFilter): Promise<AgentCard[]>;
  async getAgentCard(agentId: string): Promise<AgentCard>;
  
  // Task Management
  async sendTask(params: SendTaskParams): Promise<Task>;
  async sendTaskSubscribe(params: SendTaskParams): AsyncIterable<TaskUpdate>;
  async getTaskStatus(taskId: string): Promise<TaskStatus>;
  async cancelTask(taskId: string): Promise<void>;
  
  // Payment
  async createPaymentRequest(params: PaymentRequestParams): Promise<PaymentRequest>;
  async verifyPayment(paymentProof: PaymentProof): Promise<boolean>;
}

// ============================================
// A2A PROTOCOL TYPES
// ============================================

interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: Capability[];
  skills: Skill[];
  authentication: AuthenticationScheme;
  defaultInputModes: string[];
  defaultOutputModes: string[];
}

interface Capability {
  name: string;
  description: string;
  parameters?: JSONSchema;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

interface Task {
  id: string;
  sessionId: string;
  status: TaskStatus;
  history: Message[];
  artifacts?: Artifact[];
  metadata?: Record<string, unknown>;
}

interface Message {
  role: 'user' | 'agent';
  parts: Part[];
  timestamp: number;
}

type Part = TextPart | FilePart | DataPart;

interface TextPart {
  type: 'text';
  text: string;
}

interface FilePart {
  type: 'file';
  file: {
    name: string;
    mimeType: string;
    bytes?: string;  // base64
    uri?: string;
  };
}

interface DataPart {
  type: 'data';
  data: Record<string, unknown>;
}

// ============================================
// X402 PAYMENT TYPES
// ============================================

interface PaymentRequest {
  scheme: 'x402';
  network: 'base' | 'base-sepolia';
  amount: string;  // In token decimals
  token: string;   // Token contract address
  receiver: string;
  deadline: number;
  payload: string; // Encoded payment data
  metadata?: Record<string, unknown>;
}

interface PaymentProof {
  txHash: string;
  signature: string;
  nonce: string;
}

interface PaymentConfig {
  token: string;
  receiver: string;
  amount: bigint;
  deadlineSeconds: number;
}

// Middleware for Express/Fastify
function x402Middleware(config: PaymentConfig): RequestHandler;

// ============================================
// TELEMETRY API
// ============================================

interface TelemetryConfig {
  agentId: string;
  apiKey: string;
  endpoint: string;
  batchSize?: number;
  flushIntervalMs?: number;
}

class TelemetryCollector {
  static init(config: TelemetryConfig): TelemetryCollector;
  
  trackEvent(eventType: string, data: Record<string, unknown>): void;
  trackTaskStart(taskId: string, params: TaskParams): void;
  trackTaskComplete(taskId: string, result: TaskResult): void;
  trackPaymentReceived(payment: PaymentEvent): void;
  trackError(error: Error, context?: Record<string, unknown>): void;
  
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
```

### 2. CLI Commands

```typescript
// @agentlink/cli - Command Interface

// agentlink init <project-name>
interface InitOptions {
  template: 'express' | 'fastify' | 'nextjs';
  typescript: boolean;
  install: boolean;
}

// agentlink register
interface RegisterOptions {
  config: string;     // Path to agent.config.ts
  network: 'base-sepolia' | 'base';
}

// agentlink deploy
interface DeployOptions {
  env: 'development' | 'staging' | 'production';
  verify: boolean;
}

// agentlink logs
interface LogsOptions {
  agentId: string;
  follow: boolean;
  tail: number;
}

// agentlink verify
interface VerifyOptions {
  endpoint: string;
  checkPayments: boolean;
  checkA2A: boolean;
}
```

### 3. Dashboard API Routes

```typescript
// apps/dashboard - API Routes

// ============================================
// AGENTS API
// ============================================

// GET /api/agents
// List all registered agents for the authenticated user
interface ListAgentsResponse {
  agents: AgentSummary[];
  total: number;
}

// GET /api/agents/[id]
// Get detailed agent information
interface GetAgentResponse {
  agent: AgentDetails;
  stats: AgentStats;
  recentTasks: TaskSummary[];
}

// POST /api/agents
// Register a new agent
interface CreateAgentRequest {
  name: string;
  description: string;
  endpoint: string;
  capabilities: Capability[];
  pricing?: PricingConfig;
}

// ============================================
// TASKS API
// ============================================

// GET /api/tasks
// List tasks with filtering
interface ListTasksParams {
  agentId?: string;
  status?: TaskStatus;
  from?: string;  // ISO date
  to?: string;
}

// GET /api/tasks/[id]
// Get task details
interface GetTaskResponse {
  task: TaskDetails;
  messages: Message[];
  payments: Payment[];
}

// ============================================
// TELEMETRY API
// ============================================

// POST /api/telemetry/batch
// Ingest telemetry events from agents
interface TelemetryBatchRequest {
  events: TelemetryEvent[];
}

interface TelemetryEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

// GET /api/telemetry/metrics
// Get aggregated metrics
interface GetMetricsParams {
  agentId?: string;
  metric: string;
  granularity: 'hour' | 'day' | 'week';
  from: string;
  to: string;
}

// ============================================
// PAYMENTS API
// ============================================

// GET /api/payments
// List payment history
interface ListPaymentsResponse {
  payments: Payment[];
  totalVolume: string;
  totalCount: number;
}

// GET /api/payments/stats
// Get payment statistics
interface PaymentStatsResponse {
  dailyVolume: TimeSeriesData[];
  tokenBreakdown: TokenBreakdown[];
}
```

### 4. Smart Contract Interfaces

```solidity
// contracts/src/x402/interfaces/IPaymentProcessor.sol

interface IPaymentProcessor {
    // Events
    event PaymentReceived(
        bytes32 indexed paymentId,
        address indexed payer,
        address indexed receiver,
        address token,
        uint256 amount
    );
    
    event PaymentSettled(
        bytes32 indexed paymentId,
        address indexed receiver,
        uint256 amount
    );
    
    event PaymentRefunded(
        bytes32 indexed paymentId,
        address indexed payer,
        uint256 amount
    );

    // Functions
    function processPayment(
        address token,
        uint256 amount,
        address receiver,
        uint256 deadline,
        bytes calldata signature
    ) external returns (bytes32 paymentId);
    
    function verifyPayment(bytes32 paymentId) external view returns (bool);
    
    function settlePayment(bytes32 paymentId) external;
    
    function refundPayment(bytes32 paymentId) external;
    
    function getEscrowBalance(bytes32 paymentId) external view returns (uint256);
}

// contracts/src/a2a/interfaces/IAgentRegistry.sol

interface IAgentRegistry {
    struct Agent {
        string name;
        string endpoint;
        bytes32 capabilitiesHash;
        address owner;
        bool isActive;
        uint256 registeredAt;
    }

    event AgentRegistered(
        bytes32 indexed agentId,
        string name,
        address indexed owner
    );
    
    event AgentUpdated(
        bytes32 indexed agentId,
        string endpoint
    );
    
    event AgentDeactivated(bytes32 indexed agentId);

    function registerAgent(
        string calldata name,
        string calldata endpoint,
        bytes32 capabilitiesHash
    ) external returns (bytes32 agentId);
    
    function updateAgent(
        bytes32 agentId,
        string calldata endpoint,
        bytes32 capabilitiesHash
    ) external;
    
    function deactivateAgent(bytes32 agentId) external;
    
    function getAgent(bytes32 agentId) external view returns (Agent memory);
    
    function isRegistered(bytes32 agentId) external view returns (bool);
    
    function getAgentsByOwner(address owner) external view returns (bytes32[] memory);
}

// contracts/src/a2a/interfaces/ITaskCoordinator.sol

interface ITaskCoordinator {
    enum TaskStatus { Pending, Active, Completed, Failed, Cancelled }

    struct Task {
        bytes32 taskId;
        bytes32 agentId;
        address requester;
        string payloadHash;
        TaskStatus status;
        uint256 createdAt;
        uint256 completedAt;
        bytes32 resultHash;
    }

    event TaskCreated(
        bytes32 indexed taskId,
        bytes32 indexed agentId,
        address indexed requester
    );
    
    event TaskStatusUpdated(
        bytes32 indexed taskId,
        TaskStatus status
    );
    
    event TaskCompleted(
        bytes32 indexed taskId,
        bytes32 resultHash
    );

    function createTask(
        bytes32 agentId,
        string calldata payloadHash
    ) external payable returns (bytes32 taskId);
    
    function updateTaskStatus(
        bytes32 taskId,
        TaskStatus status
    ) external;
    
    function completeTask(
        bytes32 taskId,
        bytes32 resultHash
    ) external;
    
    function getTask(bytes32 taskId) external view returns (Task memory);
    
    function getAgentTasks(bytes32 agentId) external view returns (bytes32[] memory);
}
```

---

## Technology Decision Records

### TDR-001: Monorepo Tool Selection

**Decision**: Use pnpm workspaces + Turborepo

**Context**:
- Need efficient dependency management across packages
- Want fast, cached builds
- Require task orchestration (build order, parallelization)

**Options Considered**:
| Tool | Pros | Cons |
|------|------|------|
| pnpm workspaces | Fast, disk efficient, native workspace support | Limited task orchestration |
| Turborepo | Excellent caching, pipeline config, remote cache | Additional complexity |
| Nx | Powerful, mature | Heavier, steeper learning curve |
| Rush | Microsoft-backed, strict | Complex setup |

**Decision Rationale**:
- pnpm workspaces provide excellent dependency management
- Turborepo adds powerful build caching and task pipelines
- Combination is lightweight yet powerful
- Used by Vercel, well-supported

**Consequences**:
- (+) Fast installs with pnpm's content-addressable store
- (+) Efficient caching reduces CI times
- (+) Pipeline ensures correct build order
- (-) Team needs to learn Turborepo concepts

---

### TDR-002: TypeScript Configuration

**Decision**: Strict TypeScript with shared configs

**Context**:
- Multiple packages need consistent TypeScript settings
- Want maximum type safety
- Need to support both Node.js and browser environments

**Configuration**:
```json
// Root tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

**Decision Rationale**:
- Strict mode catches more errors at compile time
- Shared config ensures consistency
- ES2022 target for modern features
- ESM for better tree-shaking

---

### TDR-003: Smart Contract Framework

**Decision**: Use Foundry

**Context**:
- Need fast, reliable smart contract development
- Want comprehensive testing
- Require deployment scripting

**Options Considered**:
| Framework | Pros | Cons |
|-----------|------|------|
| Foundry | Fast tests (Rust), fuzzing, gas reports | Newer ecosystem |
| Hardhat | Mature, large plugin ecosystem | Slower tests (JS) |
| Truffle | Well-known | Slower, less active |

**Decision Rationale**:
- Foundry tests are extremely fast (Rust-based)
- Built-in fuzzing and invariant testing
- Gas reporting for optimization
- Solidity-based tests feel natural
- Strong Base ecosystem alignment

---

### TDR-004: Blockchain Network Selection

**Decision**: Base Sepolia for MVP, path to Base Mainnet

**Context**:
- Need EVM-compatible L2 for low gas costs
- Want strong developer ecosystem
- Require stable testnet for development

**Options Considered**:
| Network | Pros | Cons |
|---------|------|------|
| Base Sepolia | Coinbase backing, low gas, fast | Newer testnet |
| Sepolia | Established, widely supported | Higher gas, slower |
| Mumbai (Polygon) | Established | Being deprecated |
| Arbitrum Sepolia | Fast, established | Less Coinbase alignment |

**Decision Rationale**:
- Base has strong Coinbase backing
- Low gas costs enable micro-transactions
- Fast block times (2 seconds)
- Growing ecosystem of DeFi protocols
- Clear path to mainnet

**Deployment Path**:
```
Development → Base Sepolia Testnet → Base Mainnet
     │              │                    │
     │              │                    │
     ▼              ▼                    ▼
  Local Anvil   Staging/QA           Production
  (Foundry)     (Public testnet)     (Live users)
```

---

### TDR-005: Dashboard Frontend Stack

**Decision**: Next.js 14 + App Router + shadcn/ui

**Context**:
- Need modern React framework
- Want server-side rendering for SEO/performance
- Require component library for rapid development

**Stack Details**:
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | Next.js 14 | App Router, RSC, excellent DX |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Components | shadcn/ui | Copy-paste, customizable |
| State | React Query | Server state management |
| Forms | React Hook Form + Zod | Type-safe forms |
| Web3 | Wagmi + Viem | Best-in-class Ethereum interaction |
| Database | Supabase | PostgreSQL + real-time + auth |

---

### TDR-006: Testing Strategy

**Decision**: Multi-layer testing approach

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit Tests | Vitest | All packages, business logic |
| Integration Tests | Vitest | SDK + API interactions |
| Contract Tests | Foundry | All smart contracts |
| E2E Tests | Playwright | Dashboard critical paths |

**Testing Pyramid**:
```
                    ▲
                   / \
                  /E2E\          Playwright
                 /─────\
                /INTEGRATION\     Vitest (SDK)
               /─────────────\
              /    CONTRACT    \   Foundry
             /───────────────────\
            /      UNIT TESTS      \  Vitest
           /─────────────────────────\
```

---

### TDR-007: Package Publishing Strategy

**Decision**: Automated NPM publishing via GitHub Actions

**Workflow**:
```
1. Developer creates changeset (npx changeset)
2. PR merged to main
3. Changeset bot creates "Version Packages" PR
4. When merged:
   - Versions updated
   - Changelogs generated
   - Packages published to NPM
   - GitHub releases created
```

**Versioning Strategy**:
- `@agentlink/core`: Independent versioning
- `@agentlink/cli`: Independent versioning
- Pre-1.0: Minor bumps for breaking changes
- Post-1.0: Follow semver strictly

---

## Security Architecture

### 1. Threat Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           THREAT MODEL                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Assets:
├── Agent private keys (signing)
├── User funds (USDC payments)
├── Agent configuration data
├── Telemetry data (potentially sensitive)
└── Smart contract state

Threats:
├── T1: Private key compromise
├── T2: Man-in-the-middle attacks
├── T3: Replay attacks on payments
├── T4: Smart contract vulnerabilities
├── T5: API key theft
├── T6: Unauthorized agent registration
└── T7: Data exfiltration
```

### 2. Security Controls

| Threat | Control | Implementation |
|--------|---------|----------------|
| T1 | Hardware wallet support | Support Ledger/Trezor via Wagmi |
| T1 | Key rotation | CLI command to rotate keys |
| T2 | TLS everywhere | Enforce HTTPS for all endpoints |
| T2 | Certificate pinning | Optional in SDK |
| T3 | Nonce-based payments | Unique nonce per payment in contracts |
| T3 | Deadline enforcement | Payments expire after deadline |
| T4 | Formal verification | Critical contracts (future) |
| T4 | Audits | Pre-mainnet audit required |
| T4 | Bug bounty | Post-launch program |
| T5 | Scoped API keys | Per-agent, revocable keys |
| T5 | Key encryption | Encrypt at rest in agent config |
| T6 | Stake requirement | Register agents with small stake |
| T6 | Reputation system | Track agent performance |
| T7 | Data minimization | Only collect necessary telemetry |
| T7 | Encryption at rest | Supabase encrypts data |

### 3. Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AGENT AUTHENTICATION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐                    ┌──────────────┐                    ┌──────────────┐
    │    AGENT     │                    │   DASHBOARD  │                    │   SUPABASE   │
    │              │                    │     API      │                    │              │
    └──────┬───────┘                    └──────┬───────┘                    └──────┬───────┘
           │                                    │                                   │
           │  1. Generate keypair               │                                   │
           │     (via CLI or SDK)               │                                   │
           │                                    │                                   │
           │  2. Register agent                 │                                   │
           │ ────────────────────────────────► │                                   │
           │     POST /api/agents              │                                   │
           │     {                             │                                   │
           │       "name": "My Agent",         │                                   │
           │       "publicKey": "0x..."        │                                   │
           │     }                             │                                   │
           │                                    │                                   │
           │                                    │  3. Create agent record          │
           │                                    │ ───────────────────────────────► │
           │                                    │                                   │
           │                                    │  4. Return API key               │
           │                                    │ ◄─────────────────────────────── │
           │                                    │                                   │
           │  5. Return API key to agent       │                                   │
           │ ◄──────────────────────────────── │                                   │
           │     (Store securely)              │                                   │
           │                                    │                                   │
           │══════════════════════════════════════════════════════════════════════│
           │                    SUBSEQUENT REQUESTS                              │
           │══════════════════════════════════════════════════════════════════════│
           │                                    │                                   │
           │  6. Sign request with private key │                                   │
           │     X-Agent-Signature: 0x...      │                                   │
           │     X-Agent-ID: agent-123         │                                   │
           │     X-API-Key: tk_...             │                                   │
           │ ────────────────────────────────► │                                   │
           │                                    │                                   │
           │                                    │  7. Verify signature             │
           │                                    │     (Recover public key)         │
           │                                    │                                   │
           │                                    │  8. Verify API key               │
           │                                    │     (Check against DB)           │
           │                                    │                                   │
           │  9. Return response               │                                   │
           │ ◄──────────────────────────────── │                                   │
           │                                    │                                   │
```

### 4. Smart Contract Security

```solidity
// Security patterns used in contracts

// 1. Reentrancy Guard
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PaymentProcessor is ReentrancyGuard {
    function settlePayment(bytes32 paymentId) external nonReentrant {
        // ...
    }
}

// 2. Access Control
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AgentRegistry is Ownable, AccessControl {
    bytes32 public constant AGENT_MANAGER_ROLE = keccak256("AGENT_MANAGER_ROLE");
    
    function registerAgent(...) external onlyRole(AGENT_MANAGER_ROLE) {
        // ...
    }
}

// 3. Input Validation
modifier validAddress(address addr) {
    require(addr != address(0), "Invalid address");
    require(addr != address(this), "Cannot be contract address");
    _;
}

// 4. Checks-Effects-Interactions Pattern
function settlePayment(bytes32 paymentId) external nonReentrant {
    // CHECKS
    require(escrows[paymentId].amount > 0, "No escrow");
    require(!escrows[paymentId].settled, "Already settled");
    
    // EFFECTS
    uint256 amount = escrows[paymentId].amount;
    escrows[paymentId].settled = true;
    
    // INTERACTIONS (last)
    (bool success, ) = escrows[paymentId].receiver.call{value: amount}("");
    require(success, "Transfer failed");
}

// 5. Emergency Pause
import "@openzeppelin/contracts/security/Pausable.sol";

contract PaymentProcessor is Pausable {
    function pause() external onlyOwner {
        _pause();
    }
    
    function processPayment(...) external whenNotPaused {
        // ...
    }
}
```

### 5. Secrets Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SECRETS MANAGEMENT                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Agent Local Secrets:
├── ~/.agentlink/config.json (encrypted)
│   ├── privateKey (encrypted with OS keychain)
│   ├── apiKey (encrypted)
│   └── agentId
│
Environment Variables (Development):
├── AGENTLINK_PRIVATE_KEY (only for testing)
├── AGENTLINK_API_KEY
└── AGENTLINK_AGENT_ID

Dashboard Secrets (Vercel):
├── SUPABASE_URL
├── SUPABASE_SERVICE_KEY
├── NEXTAUTH_SECRET
└── (Managed via Vercel Dashboard)

Contract Deployment:
├── DEPLOYER_PRIVATE_KEY (hardware wallet recommended)
└── ETHERSCAN_API_KEY (for verification)
```

---

## Deployment Architecture

### 1. Environment Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT ENVIRONMENTS                               │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────┐
    │   LOCAL DEV     │
    │   (Developer)   │
    ├─────────────────┤
    │ • Anvil local   │
    │ • Local Supabase│
    │ • Hot reload    │
    └────────┬────────┘
             │
             │  git push
             ▼
    ┌─────────────────┐
    │    PREVIEW      │
    │   (Vercel)      │
    ├─────────────────┤
    │ • PR previews   │
    │ • Base Sepolia  │
    │ • Isolated DB   │
    └────────┬────────┘
             │
             │  PR merge
             ▼
    ┌─────────────────┐
    │    STAGING      │
    │   (Vercel)      │
    ├─────────────────┤
    │ • Main branch   │
    │ • Base Sepolia  │
    │ • Shared DB     │
    └────────┬────────┘
             │
             │  Release tag
             ▼
    ┌─────────────────┐
    │   PRODUCTION    │
    │   (Vercel)      │
    ├─────────────────┤
    │ • Tagged release│
    │ • Base Mainnet  │
    │ • Production DB │
    └─────────────────┘
```

### 2. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # 1. Lint & Type Check
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm type-check

  # 2. Unit Tests
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test

  # 3. Contract Tests
  contract-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge test

  # 4. Build
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build

  # 5. E2E Tests (on preview deploy)
  e2e:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm e2e
```

### 3. Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │    USER     │
                              └──────┬──────┘
                                     │
                                     │ HTTPS
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL EDGE                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Next.js Dashboard                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │   App       │  │   API       │  │  Middleware │  │   Edge     │ │   │
│  │  │   Router    │  │   Routes    │  │   (Auth)    │  │   Config   │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
          ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
          │  SUPABASE   │ │   BASE      │ │    NPM      │
          │             │ │  (Blockchain)│ │  REGISTRY   │
          │ ┌─────────┐ │ │             │ │             │
          │ │PostgreSQL│ │ │ ┌─────────┐ │ │ ┌─────────┐ │
          │ │  Auth   │ │ │ │Sepolia  │ │ │ │  Core   │ │
          │ │Realtime │ │ │ │Mainnet  │ │ │ │  CLI    │ │
          │ │ Storage │ │ │ │         │ │ │ └─────────┘ │
          │ └─────────┘ │ │ └─────────┘ │ └─────────────┘
          └─────────────┘ └─────────────┘
                                  │
                                  │ RPC
                                  ▼
                        ┌─────────────────┐
                        │  ALCHEMY/INFURA │
                        │   (Node Access) │
                        └─────────────────┘
```

### 4. Package Publishing Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NPM PACKAGE PUBLISHING FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

    Developer                    GitHub                    NPM Registry
         │                          │                            │
         │  1. Make changes         │                            │
         │  2. npx changeset        │                            │
         │     (Describe changes)   │                            │
         │                          │                            │
         │  3. git commit & push    │                            │
         │ ───────────────────────► │                            │
         │                          │                            │
         │                          │  4. Open PR                │
         │ ◄─────────────────────── │                            │
         │                          │                            │
         │  5. Review & approve     │                            │
         │ ───────────────────────► │                            │
         │                          │                            │
         │                          │  6. Merge to main          │
         │                          │ ─────────────────────────► │
         │                          │                            │
         │                          │  7. Changeset bot creates  │
         │                          │     "Version Packages" PR  │
         │ ◄─────────────────────── │                            │
         │                          │                            │
         │  8. Review version PR    │                            │
         │ ───────────────────────► │                            │
         │                          │                            │
         │                          │  9. Merge version PR       │
         │                          │ ─────────────────────────► │
         │                          │                            │
         │                          │ 10. GitHub Action:         │
         │                          │     - Bump versions        │
         │                          │     - Update changelogs    │
         │                          │     - Create git tags      │
         │                          │     - Publish to NPM       │
         │                          │ ─────────────────────────► │
         │                          │                            │
         │                          │ 11. Packages available!    │
         │ ◄─────────────────────── │ ◄───────────────────────── │
         │                          │                            │
```

---

## Appendix: File Structure Summary

```
Key Configuration Files:
├── package.json              # Root workspace config
├── pnpm-workspace.yaml       # pnpm workspace definition
├── turbo.json                # Turborepo pipeline
├── tsconfig.json             # Root TypeScript config
├── .eslintrc.js              # Shared ESLint config
├── .prettierrc               # Shared Prettier config
│
├── packages/core/package.json          # SDK package
├── packages/cli/package.json           # CLI package
├── apps/dashboard/package.json         # Dashboard app
├── contracts/foundry.toml              # Foundry config
│
└── examples/paid-research-agent/       # Reference implementation
```

---

## Quick Start Commands

```bash
# Setup
pnpm install

# Development
pnpm dev              # Start all dev servers
pnpm dev:dashboard    # Start dashboard only
pnpm dev:contracts    # Start local Anvil + deploy

# Testing
pnpm test             # Run all tests
pnpm test:contracts   # Run Foundry tests
pnpm test:e2e         # Run Playwright tests

# Building
pnpm build            # Build all packages
pnpm build:core       # Build SDK only

# Linting
pnpm lint             # Lint all packages
pnpm lint:fix         # Fix linting issues

# Changesets
pnpm changeset        # Create a changeset
pnpm version-packages # Version packages
pnpm release          # Publish to NPM
```

---

*Document Version: 1.0.0*
*Last Updated: 2024*
