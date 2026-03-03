# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-01-XX

### Added

- Initial release of @agentlink/cli
- `create` command for scaffolding new agent projects
  - Interactive project setup
  - Support for Hono, Express, and Fastify frameworks
  - TypeScript and JavaScript support
  - Configurable features (auth, rate limiting, logging, CORS)
  - Sample paid endpoint generation
- `dev` command for local development
  - Hot reload on file changes
  - Environment variable loading
  - Endpoint display
- `identity` command for agent identity management
  - ERC-8004 identity NFT minting on Base Sepolia
  - Identity information display
  - Metadata updates
- `deploy` command for production deployment
  - Platform-specific guides (Railway, Render, Fly.io, Vercel, Docker)
  - Pre-deployment checks
  - GitHub Actions workflow generation
  - Deployment checklist
- `generate-badge` command for README badges
  - SVG badge generation
  - Markdown badge output
  - Multiple badge styles
- Comprehensive test suite with Vitest
- Full TypeScript support
- ESLint configuration
- Documentation and examples

### Features

- Modern CLI experience with commander.js, inquirer, chalk, and ora
- Beautiful terminal output with colors and spinners
- Interactive prompts for easy setup
- Error handling and validation
- Project validation before commands
- Environment variable management
- Template-based code generation
- Snapshot testing

[0.1.0]: https://github.com/agentlink/agentlink-cli/releases/tag/v0.1.0
