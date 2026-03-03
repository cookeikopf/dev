# AgentLink Documentation

Welcome to the AgentLink documentation! This directory contains comprehensive guides, references, and examples for building with AgentLink.

## Quick Navigation

| Document | Description |
|----------|-------------|
| [Quick Start](quickstart.md) | Get up and running in 5 minutes |
| [SDK Reference](sdk-reference.md) | Complete API documentation |
| [CLI Reference](cli-reference.md) | Command-line tool reference |
| [Security Guide](security.md) | Security best practices |
| [Contributing Guide](contributing.md) | How to contribute |

## Documentation Structure

### Getting Started

- **[quickstart.md](quickstart.md)** - Step-by-step guide to create your first agent
  - Installation
  - Environment setup
  - First agent creation
  - Testing free and paid requests
  - Dashboard setup

### API References

- **[sdk-reference.md](sdk-reference.md)** - Complete SDK API reference
  - `createAgent()` configuration
  - Agent methods (`handle`, `use`, `start`, `stop`)
  - Context object properties
  - Type definitions
  - Error handling
  - Utilities

- **[cli-reference.md](cli-reference.md)** - CLI command reference
  - Installation and setup
  - All commands with examples
  - Global options
  - Configuration file format
  - Troubleshooting

### Integration Guides

Located in [`integration-guides/`](integration-guides/):

| Guide | Framework | Description |
|-------|-----------|-------------|
| [langchain-integration.md](integration-guides/langchain-integration.md) | LangChain | Build agents with LangChain tools |
| [crewai-integration.md](integration-guides/crewai-integration.md) | CrewAI | Multi-agent teams with payments |
| [hono-setup.md](integration-guides/hono-setup.md) | Hono | Lightweight web framework |
| [express-setup.md](integration-guides/express-setup.md) | Express.js | Popular Node.js framework |
| [nextjs-setup.md](integration-guides/nextjs-setup.md) | Next.js | React framework with API routes |

### Examples

Located in [`examples/`](examples/):

| Example | Description |
|---------|-------------|
| [paid-research-agent.md](examples/paid-research-agent.md) | Production-ready research agent with multi-tier pricing |
| [simple-greeting-agent.md](examples/simple-greeting-agent.md) | Minimal agent demonstrating basics |
| [webhook-handler.md](examples/webhook-handler.md) | Complete webhook handler with security |

### Security

- **[security.md](security.md)** - Security guide
  - Threat model
  - Security best practices
  - API key security
  - Payment security
  - Identity verification
  - Rate limiting
  - Webhook security
  - Known limitations
  - Security checklist

### Contributing

- **[contributing.md](contributing.md)** - Contribution guide
  - Development setup
  - Project structure
  - Development workflow
  - Code style
  - Testing
  - Pull request process
  - Release process

## Documentation Conventions

### Code Examples

Code examples use TypeScript by default. JavaScript users can remove type annotations.

```typescript
// TypeScript
const agent = createAgent({
  name: 'my-agent',
  capabilities: ['research']
} as AgentConfig);

// JavaScript equivalent
const agent = createAgent({
  name: 'my-agent',
  capabilities: ['research']
});
```

### File Paths

- Root documentation: `/docs/<file>.md`
- Integration guides: `/docs/integration-guides/<file>.md`
- Examples: `/docs/examples/<file>.md`

### Version Information

This documentation is for AgentLink SDK v1.0.0+. Check your version:

```bash
npm list @agentlink/sdk
```

## Getting Help

- 📖 **Documentation**: You're here!
- 💬 **Discord**: [Join our community](https://discord.gg/agentlink)
- 🐦 **Twitter**: [@AgentLinkHQ](https://twitter.com/AgentLinkHQ)
- 📧 **Email**: support@agentlink.dev
- 🐛 **Issues**: [GitHub Issues](https://github.com/agentlink/agentlink/issues)

## Contributing to Documentation

We welcome documentation contributions! See [contributing.md](contributing.md) for guidelines.

### Documentation Style

1. **Be concise** - Get to the point quickly
2. **Use examples** - Show, don't just tell
3. **Be accurate** - Test all code examples
4. **Stay current** - Update for new releases

---

<p align="center">
  Built with ❤️ by the AgentLink team
</p>
