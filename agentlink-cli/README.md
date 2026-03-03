# @agentlink/cli

CLI tool for creating, managing, and deploying AgentLink agents.

## Installation

```bash
# Global installation
npm install -g @agentlink/cli

# Or use with npx
npx @agentlink/cli create my-agent
```

## Quick Start

```bash
# Create a new agent project
agentlink create my-agent

# Navigate to project
cd my-agent

# Start development server
agentlink dev

# Mint your agent identity
agentlink identity mint

# Deploy to production
agentlink deploy
```

## Commands

### `agentlink create [project-name]`

Scaffold a new AgentLink agent project.

**Options:**
- `-t, --template <template>` - Project template (hono|express|fastify) - default: hono
- `-f, --framework <framework>` - Server framework - default: hono
- `--skip-install` - Skip npm install
- `--git` - Initialize git repository - default: true

**Interactive Mode:**
If no project name is provided, the CLI will prompt for:
- Project name
- Description
- Author
- Framework (Hono, Express, Fastify)
- Language (TypeScript, JavaScript)
- Features (authentication, rate limiting, logging, CORS)
- Sample paid endpoint

**Example:**
```bash
# Interactive mode
agentlink create

# With project name
agentlink create my-agent

# With specific framework
agentlink create my-agent --framework express
```

### `agentlink dev`

Start local development server with hot reload.

**Options:**
- `-p, --port <port>` - Port to run server on - default: 3000
- `-h, --host <host>` - Host to bind server to - default: localhost
- `--no-watch` - Disable hot reload

**Example:**
```bash
# Default port
agentlink dev

# Custom port
agentlink dev --port 8080

# External access
agentlink dev --host 0.0.0.0
```

### `agentlink identity`

Manage agent identity and NFT minting.

#### `agentlink identity mint`

Mint an ERC-8004 identity NFT on Base Sepolia.

**Options:**
- `-k, --key <privateKey>` - Private key for signing
- `-r, --rpc <rpcUrl>` - RPC URL for Base Sepolia
- `-n, --name <name>` - Agent name for metadata
- `-d, --description <description>` - Agent description
- `--mainnet` - Use Base mainnet instead of Sepolia

**Example:**
```bash
# Interactive mode
agentlink identity mint

# With private key
agentlink identity mint --key 0x...

# Use mainnet
agentlink identity mint --mainnet
```

#### `agentlink identity info`

Display current identity information.

**Example:**
```bash
agentlink identity info
```

#### `agentlink identity update`

Update identity metadata.

**Options:**
- `-n, --name <name>` - New agent name
- `-d, --description <description>` - New description

**Example:**
```bash
agentlink identity update --name "New Name"
```

### `agentlink deploy`

Deploy your AgentLink agent to production.

**Options:**
- `-p, --platform <platform>` - Deployment platform (railway|render|fly|vercel|docker|manual)
- `--skip-build` - Skip build step
- `--auto` - Auto-deploy without prompts

**Supported Platforms:**
- **Railway** (recommended) - Easy deployment with automatic scaling
- **Render** - Simple web services
- **Fly.io** - Global edge deployment
- **Vercel** - Serverless deployment
- **Docker** - Self-hosted containers
- **Manual** - Generate deployment guides

**Example:**
```bash
# Interactive platform selection
agentlink deploy

# Specific platform
agentlink deploy --platform railway

# Auto-deploy
agentlink deploy --platform railway --auto
```

### `agentlink generate-badge`

Generate shareable Agent Card badge for README.

**Options:**
- `-o, --output <path>` - Output file path
- `-f, --format <format>` - Output format (svg|png|markdown) - default: markdown
- `-s, --style <style>` - Badge style (flat|flat-square|plastic|for-the-badge) - default: flat

**Example:**
```bash
# Generate markdown badge
agentlink generate-badge

# SVG format
agentlink generate-badge --format svg --output badge.svg

# Custom style
agentlink generate-badge --style for-the-badge
```

## Project Structure

A scaffolded AgentLink project has the following structure:

```
my-agent/
├── src/
│   ├── index.ts              # Main server file
│   ├── types.ts              # Type definitions
│   └── __tests__/
│       └── index.test.ts     # Sample tests
├── agent-card.json           # Agent Card (A2A discovery)
├── package.json              # Project dependencies
├── tsconfig.json             # TypeScript configuration
├── vitest.config.ts          # Test configuration
├── .env                      # Environment variables
├── .env.template             # Environment template
├── .gitignore                # Git ignore rules
├── Dockerfile                # Docker configuration
├── docker-compose.yml        # Docker Compose (optional)
├── deployment/               # Deployment guides
│   ├── railway.md
│   ├── CHECKLIST.md
│   └── ...
└── README.md                 # Project documentation
```

## Environment Variables

### Required

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development|production)

### Identity

- `AGENT_IDENTITY_ADDRESS` - Agent identity NFT address
- `AGENT_PRIVATE_KEY` - Wallet private key (dev only)

### Network

- `RPC_URL` - Blockchain RPC URL
- `CHAIN_ID` - Chain ID (84532 for Base Sepolia)

### Optional

- `JWT_SECRET` - JWT signing secret (if auth enabled)
- `PAYMENT_RECEIVER_ADDRESS` - Payment receiver (if paid endpoints)
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key

## Configuration

### Agent Card

The `agent-card.json` file defines your agent's capabilities and endpoints:

```json
{
  "name": "my-agent",
  "description": "My awesome agent",
  "version": "0.1.0",
  "author": "Your Name",
  "framework": "hono",
  "endpoints": [
    {
      "path": "/chat",
      "name": "Chat",
      "description": "Main chat endpoint"
    },
    {
      "path": "/premium",
      "name": "Premium",
      "description": "Premium features",
      "price": "0.001 ETH"
    }
  ],
  "capabilities": {
    "authentication": true,
    "rateLimiting": true,
    "logging": true,
    "cors": true
  },
  "identity": {
    "address": "0x...",
    "tokenId": "123",
    "network": "base-sepolia"
  }
}
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
# Run tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test -- --coverage
```

### Linting

```bash
npm run lint
```

## Troubleshooting

### Common Issues

**Error: Not an AgentLink project**
- Make sure you're in a directory with `agent-card.json`
- Run `agentlink create` first

**Error: Port already in use**
- Use a different port: `agentlink dev --port 8080`
- Kill the process using the port

**Error: Insufficient funds for minting**
- Get test ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

**Hot reload not working**
- Check file permissions
- Ensure `chokidar` is installed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT

## Support

- Documentation: https://agentlink.dev/docs
- Issues: https://github.com/agentlink/agentlink-cli/issues
- Discord: https://discord.gg/agentlink
