# AgentLink DevOps Configuration

This directory contains the complete CI/CD pipeline and deployment infrastructure for AgentLink.

## 📁 Directory Structure

```
.
├── .github/
│   ├── workflows/           # GitHub Actions workflows
│   │   ├── ci.yml          # Main CI pipeline
│   │   ├── release.yml     # Release automation
│   │   ├── dashboard-deploy.yml  # Dashboard deployment
│   │   └── contract-deploy.yml   # Contract deployment
│   ├── ISSUE_TEMPLATE/     # GitHub issue templates
│   └── pull_request_template.md
├── .husky/                 # Git hooks
├── packages/
│   ├── contracts/          # Smart contracts
│   ├── dashboard/          # Next.js dashboard
│   ├── sdk/                # TypeScript SDK
│   └── shared/             # Shared utilities
├── scripts/                # Deployment scripts
├── docs/                   # Documentation
└── [config files]         # Root configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Foundry (for contracts)
- Vercel CLI (optional)

### Setup

```bash
# Install dependencies
pnpm install

# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Copy environment template
cp .env.example .env
# Edit .env with your values
```

## 🔧 Configuration Files

### Root Configuration

| File | Purpose |
|------|---------|
| `package.json` | Root package configuration, workspace scripts |
| `pnpm-workspace.yaml` | pnpm workspace definitions |
| `turbo.json` | Turborepo task pipeline configuration |
| `tsconfig.json` | TypeScript project references |
| `.eslintrc.js` | ESLint configuration |
| `.prettierrc` | Prettier formatting rules |
| `commitlint.config.js` | Commit message linting |
| `knip.config.ts` | Unused code detection |
| `.env.example` | Environment variable template |

### GitHub Actions Workflows

#### CI Pipeline (`ci.yml`)

Runs on every PR and push to main/develop:

- **Changes Detection**: Only runs affected jobs
- **Lint & Format**: ESLint, Prettier, knip
- **Type Check**: TypeScript compilation
- **Unit Tests**: Vitest with coverage
- **Contract Tests**: Foundry tests with coverage
- **Build**: All packages
- **Integration Tests**: Full integration suite
- **Security Audit**: npm audit, Slither
- **Bundle Size**: Dashboard bundle analysis

#### Release Pipeline (`release.yml`)

Runs on version tag push:

- **Verify**: Validates tag format
- **Full Test Suite**: All tests
- **Build**: All packages
- **NPM Dry Run**: Tests publish without publishing
- **Publish to NPM**: Publishes SDK packages
- **GitHub Release**: Creates release with changelog
- **Update Changelog**: Updates CHANGELOG.md

#### Dashboard Deploy (`dashboard-deploy.yml`)

Runs on dashboard changes:

- **Validate Environment**: Checks secrets
- **Build**: Next.js build
- **Deploy Preview**: For PRs
- **Deploy Production**: For main branch
- **E2E Tests**: Playwright tests on preview
- **Lighthouse Audit**: Performance checks

#### Contract Deploy (`contract-deploy.yml`)

Manual workflow for contract deployment:

- **Validate Environment**: Checks secrets
- **Run Tests**: Contract test suite
- **Deploy**: To selected network
- **Verify**: On Etherscan
- **Update Addresses**: Updates .env.example

## 📦 Package Configuration

### Shared Package (`@agentlink/shared`)

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types/index.js",
    "./constants": "./dist/constants/index.js",
    "./utils": "./dist/utils/index.js"
  }
}
```

### SDK Package (`@agentlink/sdk`)

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./react": "./dist/react/index.js",
    "./actions": "./dist/actions/index.js"
  }
}
```

### Dashboard Package

Next.js 14 application with:
- App Router
- TypeScript
- Tailwind CSS
- Wagmi + Viem
- Supabase
- Playwright E2E tests

### Contracts Package

Foundry-based Solidity development:
- Forge for building/testing
- Slither for security analysis
- Custom deployment scripts

## 🔄 Task Pipeline (Turbo)

```
build
  └─ depends on: ^build
  
dev
  └─ persistent: true
  
test
  └─ depends on: build
  └─ outputs: coverage/**
  
test:unit
  └─ depends on: build:deps
  
test:integration
  └─ depends on: build
  └─ env: ANVIL_RPC_URL
```

## 🔐 Required Secrets

### GitHub Repository Secrets

| Secret | Description | Used In |
|--------|-------------|---------|
| `NPM_TOKEN` | NPM publish token | release.yml |
| `VERCEL_TOKEN` | Vercel API token | dashboard-deploy.yml |
| `VERCEL_ORG_ID` | Vercel organization ID | dashboard-deploy.yml |
| `VERCEL_PROJECT_ID_DASHBOARD` | Vercel project ID | dashboard-deploy.yml |
| `CODECOV_TOKEN` | Codecov upload token | ci.yml |
| `BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC | contract-deploy.yml |
| `BASE_MAINNET_RPC_URL` | Base Mainnet RPC | contract-deploy.yml |
| `PRIVATE_KEY` | Deployer private key | contract-deploy.yml |
| `ETHERSCAN_API_KEY` | Basescan API key | contract-deploy.yml |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect ID | dashboard-deploy.yml |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | dashboard-deploy.yml |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | dashboard-deploy.yml |
| `SENTRY_AUTH_TOKEN` | Sentry auth token | dashboard-deploy.yml |
| `SLACK_WEBHOOK_URL` | Slack notifications | release.yml |

## 🚀 Deployment

### Contract Deployment

```bash
# Local testing
./scripts/deploy-contracts.sh local

# Testnet deployment
./scripts/deploy-contracts.sh base-sepolia --verify

# Mainnet deployment
./scripts/deploy-contracts.sh base-mainnet --verify
```

### Dashboard Deployment

Automatic via GitHub Actions on merge to main.

Manual deployment:
```bash
cd packages/dashboard
vercel --prod
```

### SDK Release

```bash
# Create changeset
pnpm changeset

# Version packages
pnpm version-packages

# Push changes
git push

# Create and push tag
git tag v1.2.3
git push origin v1.2.3
```

## 📊 Monitoring

### Health Checks

- Dashboard: `https://app.agentlink.io/api/health`
- API: `https://api.agentlink.io/health`

### Metrics

- Error rates via Sentry
- Performance via Vercel Analytics
- Contract metrics via custom dashboard

### Alerting

- Slack notifications on deployment
- Email alerts for critical errors
- PagerDuty integration for SEV-1 incidents

## 🛠️ Development Workflow

### Branch Strategy

```
main          Production releases
  ↑
develop       Integration branch
  ↑
feature/*     Feature branches
  ↑
hotfix/*      Emergency fixes
```

### Commit Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `contract`

Scopes: `sdk`, `shared`, `dashboard`, `contracts`, `ci`, `deps`, `config`, `docs`

Example:
```
feat(sdk): add agent registration helper

Adds a new helper function for registering agents
with automatic metadata validation.

Closes #123
```

## 🧪 Testing

### Unit Tests

```bash
# All packages
pnpm test:unit

# Specific package
pnpm --filter sdk test:unit
```

### Contract Tests

```bash
cd packages/contracts
forge test
```

### Integration Tests

```bash
# Start local node
anvil

# Run tests
pnpm test:integration
```

### E2E Tests

```bash
cd packages/dashboard
pnpm test:e2e
```

## 📚 Documentation

- [Operations Runbook](docs/OPERATIONS_RUNBOOK.md)
- [Release Process](docs/RELEASE_PROCESS.md)

## 🔧 Troubleshooting

### Build Failures

```bash
# Clean everything
pnpm clean
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install

# Rebuild
pnpm build
```

### Contract Verification Failures

```bash
# Verify manually
forge verify-contract \
  --chain-id 84532 \
  --watch \
  <CONTRACT_ADDRESS> \
  <CONTRACT_NAME>
```

### Vercel Deployment Issues

```bash
# Check logs
vercel logs --all

# Redeploy
vercel --force
```

## 📄 License

MIT License - see LICENSE file for details.
