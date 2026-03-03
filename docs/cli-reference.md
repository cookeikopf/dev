# CLI Reference

Complete reference for the AgentLink CLI.

## Installation

```bash
# Install globally
npm install -g @agentlink/cli

# Or use with npx
npx @agentlink/cli <command>
```

## Global Options

| Option | Description |
|--------|-------------|
| `-v, --version` | Show CLI version |
| `-h, --help` | Show help for command |
| `--env <env>` | Set environment (development, staging, production) |
| `--config <path>` | Path to config file |
| `--json` | Output as JSON |
| `--quiet` | Suppress non-error output |

## Commands

### `login`

Authenticate with AgentLink.

```bash
agentlink login [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--api-key <key>` | API key (skip interactive) |
| `--sso` | Use SSO login |
| `--token` | Use existing token |

**Examples:**

```bash
# Interactive login
agentlink login

# With API key
agentlink login --api-key your_api_key

# SSO login
agentlink login --sso
```

---

### `logout`

Log out from AgentLink.

```bash
agentlink logout
```

---

### `init`

Create a new agent project.

```bash
agentlink init <project-name> [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--template <name>` | Project template | `basic` |
| `--framework <name>` | Framework adapter | `none` |
| `--typescript` | Use TypeScript | `true` |
| `--git` | Initialize git repo | `true` |
| `--install` | Install dependencies | `true` |

**Templates:**
- `basic` - Simple agent with one capability
- `paid` - Agent with payment integration
- `a2a` - A2A protocol agent
- `full` - Complete example with all features

**Frameworks:**
- `none` - No framework
- `hono` - Hono framework
- `express` - Express.js
- `nextjs` - Next.js
- `fastify` - Fastify

**Examples:**

```bash
# Create basic project
agentlink init my-agent

# Create paid agent with Express
agentlink init my-agent --template paid --framework express

# Create A2A agent
agentlink init my-agent --template a2a --typescript
```

---

### `dev`

Run agent in development mode with hot reload.

```bash
agentlink dev [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--port <port>` | Server port | `3000` |
| `--host <host>` | Server host | `localhost` |
| `--watch <pattern>` | Watch pattern | `src/**/*` |
| `--inspect` | Enable debugger | `false` |

**Examples:**

```bash
# Run on default port
agentlink dev

# Custom port with debugger
agentlink dev --port 3001 --inspect

# Watch specific files
agentlink dev --watch "src/**/*.ts"
```

---

### `deploy`

Deploy agent to AgentLink cloud.

```bash
agentlink deploy [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--env <env>` | Deployment environment |
| `--region <region>` | Deployment region |
| `--image <image>` | Docker image to deploy |
| `--dockerfile <path>` | Path to Dockerfile |
| `--build-arg <arg>` | Build arguments |
| `--no-build` | Skip build step |
| `--no-wait` | Don't wait for deployment |

**Examples:**

```bash
# Deploy current directory
agentlink deploy

# Deploy to staging
agentlink deploy --env staging

# Deploy Docker image
agentlink deploy --image my-agent:latest

# Deploy with custom Dockerfile
agentlink deploy --dockerfile Dockerfile.prod
```

---

### `agents`

Manage deployed agents.

#### `agents list`

List all agents.

```bash
agentlink agents list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--env <env>` | Filter by environment |
| `--status <status>` | Filter by status |
| `--format <format>` | Output format (table, json) |

**Example:**

```bash
agentlink agents list
agentlink agents list --env production --format json
```

#### `agents get`

Get agent details.

```bash
agentlink agents get <agent-name>
```

**Example:**

```bash
agentlink agents get my-agent
```

#### `agents logs`

View agent logs.

```bash
agentlink agents logs <agent-name> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--follow, -f` | Follow logs |
| `--tail <n>` | Last N lines |
| `--since <time>` | Logs since time |
| `--level <level>` | Filter by level |

**Example:**

```bash
# Follow logs
agentlink agents logs my-agent --follow

# Last 100 lines
agentlink agents logs my-agent --tail 100
```

#### `agents stop`

Stop an agent.

```bash
agentlink agents stop <agent-name> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--env <env>` | Environment |

#### `agents start`

Start a stopped agent.

```bash
agentlink agents start <agent-name> [options]
```

#### `agents restart`

Restart an agent.

```bash
agentlink agents restart <agent-name> [options]
```

#### `agents delete`

Delete an agent.

```bash
agentlink agents delete <agent-name> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation |

---

### `logs`

View aggregated logs.

```bash
agentlink logs [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--agent <name>` | Filter by agent |
| `--follow, -f` | Follow logs |
| `--tail <n>` | Last N lines |
| `--since <time>` | Since time |
| `--level <level>` | Log level |
| `--format <format>` | Output format |

**Examples:**

```bash
# All logs
agentlink logs --follow

# Specific agent
agentlink logs --agent my-agent --tail 50

# Error logs only
agentlink logs --level error --since "1 hour ago"
```

---

### `config`

Manage CLI configuration.

#### `config get`

Get configuration value.

```bash
agentlink config get <key>
```

**Example:**

```bash
agentlink config get apiKey
```

#### `config set`

Set configuration value.

```bash
agentlink config set <key> <value>
```

**Example:**

```bash
agentlink config set defaultEnv production
```

#### `config list`

List all configuration.

```bash
agentlink config list
```

---

### `wallet`

Manage payment wallet.

#### `wallet balance`

Check wallet balance.

```bash
agentlink wallet balance [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--currency <c>` | Filter by currency |
| `--network <n>` | Filter by network |

**Example:**

```bash
agentlink wallet balance
agentlink wallet balance --currency USDC --network base
```

#### `wallet deposit`

Get deposit address.

```bash
agentlink wallet deposit [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--currency <c>` | Currency |
| `--network <n>` | Network |

#### `wallet withdraw`

Withdraw funds.

```bash
agentlink wallet withdraw <amount> <address> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--currency <c>` | Currency |
| `--network <n>` | Network |

**Example:**

```bash
agentlink wallet withdraw 100 0x... --currency USDC
```

#### `wallet transactions`

View transaction history.

```bash
agentlink wallet transactions [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--limit <n>` | Limit results |
| `--cursor <c>` | Pagination cursor |

---

### `faucet`

Request testnet funds.

```bash
agentlink faucet [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--network <n>` | Network (base-sepolia, sepolia) |
| `--amount <a>` | Amount to request |

**Example:**

```bash
agentlink faucet --network base-sepolia
```

---

### `status`

Check AgentLink service status.

```bash
agentlink status [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--verbose` | Detailed status |

---

### `webhooks`

Manage webhooks.

#### `webhooks create`

Create a webhook.

```bash
agentlink webhooks create [options]
```

**Options:**
| Option | Required | Description |
|--------|----------|-------------|
| `--agent <name>` | Yes | Agent name |
| `--url <url>` | Yes | Webhook URL |
| `--events <events>` | Yes | Comma-separated events |
| `--secret <secret>` | No | Webhook secret |

**Events:**
- `payment.received` - Payment received
- `payment.failed` - Payment failed
- `request.completed` - Request completed
- `request.failed` - Request failed
- `agent.started` - Agent started
- `agent.stopped` - Agent stopped

**Example:**

```bash
agentlink webhooks create \
  --agent my-agent \
  --url https://my-server.com/webhook \
  --events payment.received,request.completed \
  --secret my-secret
```

#### `webhooks list`

List webhooks.

```bash
agentlink webhooks list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--agent <name>` | Filter by agent |

#### `webhooks delete`

Delete a webhook.

```bash
agentlink webhooks delete <webhook-id>
```

#### `webhooks test`

Test a webhook.

```bash
agentlink webhooks test <webhook-id> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--event <event>` | Event to test |

---

### `discover`

Discover agents in the network.

```bash
agentlink discover [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--capability <cap>` | Filter by capability |
| `--query <query>` | Search query |
| `--limit <n>` | Limit results |

**Example:**

```bash
# Find research agents
agentlink discover --capability research

# Search agents
agentlink discover --query "image generation"
```

---

### `call`

Call an agent capability.

```bash
agentlink call <agent-url> <capability> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--params <json>` | JSON parameters |
| `--payment <amount>` | Payment amount |
| `--wallet <key>` | Wallet private key |
| `--max-payment <amount>` | Maximum payment |

**Example:**

```bash
# Free request
agentlink call https://my-agent.dev research \
  --params '{"query": "AI agents"}'

# Paid request
agentlink call https://my-agent.dev research \
  --params '{"query": "AI agents"}' \
  --max-payment 0.05 \
  --wallet $PRIVATE_KEY
```

---

### `identity`

Manage agent identity.

#### `identity create`

Create a new DID.

```bash
agentlink identity create [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--method <method>` | DID method |
| `--controller <did>` | Controller DID |

#### `identity resolve`

Resolve a DID.

```bash
agentlink identity resolve <did>
```

#### `identity sign`

Sign a message.

```bash
agentlink identity sign <message> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--did <did>` | Signing DID |

#### `identity verify`

Verify a signature.

```bash
agentlink identity verify <message> <signature> <did>
```

---

### `test`

Test agent capabilities.

```bash
agentlink test [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--agent <name>` | Agent to test |
| `--capability <cap>` | Specific capability |
| `--coverage` | Run coverage report |

**Example:**

```bash
# Test all capabilities
agentlink test

# Test specific capability
agentlink test --capability research

# With coverage
agentlink test --coverage
```

---

## Configuration File

Create `.agentlink.json` or `agentlink.config.js`:

```json
{
  "defaultEnv": "development",
  "agents": {
    "my-agent": {
      "entry": "./src/agent.ts",
      "port": 3000,
      "env": {
        "NODE_ENV": "production"
      }
    }
  },
  "deploy": {
    "regions": ["us-east-1", "eu-west-1"],
    "envVars": ["API_KEY", "DATABASE_URL"]
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENTLINK_API_KEY` | Your API key |
| `AGENTLINK_ENV` | Default environment |
| `AGENTLINK_CONFIG` | Config file path |
| `AGENTLINK_DEBUG` | Enable debug logging |
| `AGENTLINK_WALLET_KEY` | Default wallet private key |

## Troubleshooting

### Common Issues

#### "Authentication failed"

```bash
# Re-login
agentlink logout
agentlink login

# Or set API key
export AGENTLINK_API_KEY=your_key
```

#### "Agent not found"

```bash
# List agents
agentlink agents list

# Check environment
agentlink agents list --env production
```

#### "Deployment failed"

```bash
# Check logs
agentlink logs --tail 100

# Verify build locally
agentlink dev

# Deploy with verbose output
agentlink deploy --verbose
```

#### "Payment verification failed"

```bash
# Check wallet balance
agentlink wallet balance

# Request testnet funds
agentlink faucet

# Verify wallet configuration
cat .env | grep WALLET
```

### Debug Mode

```bash
# Enable debug logging
AGENTLINK_DEBUG=true agentlink <command>

# Verbose output
agentlink <command> --verbose
```

### Getting Help

```bash
# Command help
agentlink --help
agentlink <command> --help

# Examples
agentlink init --help-examples
```
