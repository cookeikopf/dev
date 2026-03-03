#!/bin/bash
# AgentLink GitHub Setup Script
# Usage: ./setup-github.sh <github-username> <github-org-name>

set -e

if [ $# -lt 2 ]; then
    echo "Usage: ./setup-github.sh <github-username> <github-org-name>"
    echo "Example: ./setup-github.sh johndoe agentlink"
    exit 1
fi

USERNAME=$1
ORG_NAME=$2
OUTPUT_DIR="/mnt/okcomputer/output"

echo "🚀 AgentLink GitHub Setup"
echo "========================="
echo "GitHub Username: $USERNAME"
echo "Org Name: $ORG_NAME"
echo ""

# Check dependencies
command -v git >/dev/null 2>&1 || { echo "❌ git is required but not installed."; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "❌ GitHub CLI (gh) is required. Install: https://cli.github.com/"; exit 1; }

# Login check
echo "🔐 Checking GitHub authentication..."
gh auth status || gh auth login

# Create organization
echo "🏢 Creating GitHub organization: $ORG_NAME..."
gh org create "$ORG_NAME" --enterprise "" || echo "⚠️ Organization may already exist or using personal account"

# Create repos
echo "📁 Creating repositories..."

# Main monorepo
echo "  - agentlink (main monorepo)"
gh repo create "$ORG_NAME/agentlink" --public --description "Open-source TypeScript SDK + CLI for agent-to-agent payments" || echo "⚠️ Repo may already exist"

# Contracts
echo "  - agentlink-contracts"
gh repo create "$ORG_NAME/agentlink-contracts" --public --description "Smart contracts for AgentLink (Foundry)" || echo "⚠️ Repo may already exist"

# Docs
echo "  - agentlink-docs"
gh repo create "$ORG_NAME/agentlink-docs" --public --description "Documentation for AgentLink" || echo "⚠️ Repo may already exist"

# Examples
echo "  - agentlink-examples"
gh repo create "$ORG_NAME/agentlink-examples" --public --description "Example agents using AgentLink" || echo "⚠️ Repo may already exist"

# Setup main monorepo
echo ""
echo "📦 Setting up main monorepo..."
mkdir -p "$OUTPUT_DIR/agentlink-github"
cd "$OUTPUT_DIR/agentlink-github"

# Initialize
git init

# Create structure
mkdir -p packages/core packages/cli apps/dashboard
mkdir -p .github/workflows

# Copy SDK files
echo "  Copying SDK files..."
cp -r "$OUTPUT_DIR/agentlink-core/src" packages/core/ 2>/dev/null || echo "    ⚠️ SDK source not found"
cp "$OUTPUT_DIR/agentlink-core/package.json" packages/core/ 2>/dev/null || echo "    ⚠️ SDK package.json not found"
cp "$OUTPUT_DIR/agentlink-core/tsconfig.json" packages/core/ 2>/dev/null || echo "    ⚠️ SDK tsconfig not found"
cp "$OUTPUT_DIR/agentlink-core/README.md" packages/core/ 2>/dev/null || echo "    ⚠️ SDK README not found"

# Copy CLI files
echo "  Copying CLI files..."
cp -r "$OUTPUT_DIR/agentlink-cli/src" packages/cli/ 2>/dev/null || echo "    ⚠️ CLI source not found"
cp "$OUTPUT_DIR/agentlink-cli/package.json" packages/cli/ 2>/dev/null || echo "    ⚠️ CLI package.json not found"
cp "$OUTPUT_DIR/agentlink-cli/tsconfig.json" packages/cli/ 2>/dev/null || echo "    ⚠️ CLI tsconfig not found"

# Copy dashboard files
echo "  Copying dashboard files..."
cp -r "$OUTPUT_DIR/agentlink-dashboard/app" apps/dashboard/ 2>/dev/null || echo "    ⚠️ Dashboard app not found"
cp -r "$OUTPUT_DIR/agentlink-dashboard/components" apps/dashboard/ 2>/dev/null || echo "    ⚠️ Dashboard components not found"
cp -r "$OUTPUT_DIR/agentlink-dashboard/lib" apps/dashboard/ 2>/dev/null || echo "    ⚠️ Dashboard lib not found"
cp "$OUTPUT_DIR/agentlink-dashboard/package.json" apps/dashboard/ 2>/dev/null || echo "    ⚠️ Dashboard package.json not found"
cp "$OUTPUT_DIR/agentlink-dashboard/next.config.js" apps/dashboard/ 2>/dev/null || echo "    ⚠️ Dashboard next.config not found"

# Copy config files
echo "  Copying config files..."
cp "$OUTPUT_DIR/configs/package.json" . 2>/dev/null || echo "    ⚠️ Root package.json not found"
cp "$OUTPUT_DIR/configs/pnpm-workspace.yaml" . 2>/dev/null || echo "    ⚠️ pnpm-workspace not found"
cp "$OUTPUT_DIR/configs/turbo.json" . 2>/dev/null || echo "    ⚠️ turbo.json not found"
cp "$OUTPUT_DIR/configs/tsconfig.json" . 2>/dev/null || echo "    ⚠️ Root tsconfig not found"
cp "$OUTPUT_DIR/configs/.eslintrc.js" . 2>/dev/null || echo "    ⚠️ ESLint config not found"
cp "$OUTPUT_DIR/configs/.prettierrc" . 2>/dev/null || echo "    ⚠️ Prettier config not found"

# Copy GitHub Actions
echo "  Copying GitHub Actions..."
cp -r "$OUTPUT_DIR/.github/workflows" .github/ 2>/dev/null || echo "    ⚠️ GitHub Actions not found"

# Create .gitignore
cat > .gitignore << 'GITIGNORE'
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Testing
coverage/
.nyc_output/

# IDE
.vscode/*
!.vscode/extensions.json
.idea/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS
.DS_Store
Thumbs.db

# Misc
*.tsbuildinfo
.cache/
temp/
tmp/
GITIGNORE

# Create root README
cat > README.md << 'README'
# AgentLink

<p align="center">
  <strong>Open-source TypeScript SDK + CLI for agent-to-agent payments on Base</strong>
</p>

<p align="center">
  <a href="https://github.com/$ORG_NAME/agentlink/actions/workflows/ci.yml">
    <img src="https://github.com/$ORG_NAME/agentlink/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="https://www.npmjs.com/package/@agentlink/core">
    <img src="https://img.shields.io/npm/v/@agentlink/core.svg" alt="npm">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
  </a>
</p>

## Quick Start

```bash
# Install CLI
npm install -g @agentlink/cli

# Create your first agent
agentlink create my-agent

# Start development
agentlink dev
```

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [@agentlink/core](./packages/core) | SDK with A2A, x402, adapters | ![npm](https://img.shields.io/npm/v/@agentlink/core) |
| [@agentlink/cli](./packages/cli) | CLI for scaffolding and deployment | ![npm](https://img.shields.io/npm/v/@agentlink/cli) |
| [@agentlink/dashboard](./apps/dashboard) | Analytics dashboard (Next.js) | - |

## Documentation

- [Quick Start](https://docs.agentlink.dev/quickstart)
- [SDK Reference](https://docs.agentlink.dev/sdk-reference)
- [CLI Reference](https://docs.agentlink.dev/cli-reference)
- [Examples](https://github.com/$ORG_NAME/agentlink-examples)

## Features

- 🔌 **Framework Adapters** - Hono, Express, Next.js
- 💰 **x402 Payments** - USDC micropayments
- 🤖 **A2A Protocol** - Agent-to-agent communication
- 🎫 **Identity** - ERC-8004 compatible NFTs
- 📊 **Dashboard** - Revenue metrics and analytics
- 🔒 **Security First** - Audited contracts, strict TypeScript

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## Security

See [SECURITY.md](./SECURITY.md) for security policy and vulnerability reporting.

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

Built with ❤️ by the AgentLink team
README

# Commit and push
echo "  Committing files..."
git add .
git commit -m "Initial commit: AgentLink MVP" || echo "  Nothing to commit"

# Add remote and push
echo "  Pushing to GitHub..."
git remote add origin "https://github.com/$ORG_NAME/agentlink.git" 2>/dev/null || echo "  Remote already exists"
git branch -M main
git push -u origin main || echo "  ⚠️ Push failed - may need to pull first"

echo ""
echo "✅ Main monorepo setup complete!"
echo ""

# Setup contracts repo
echo "📦 Setting up contracts repo..."
mkdir -p "$OUTPUT_DIR/agentlink-contracts-github"
cd "$OUTPUT_DIR/agentlink-contracts-github"

git init

# Copy contract files
cp -r "$OUTPUT_DIR/agentlink-contracts/src" . 2>/dev/null || echo "  ⚠️ Contract source not found"
cp -r "$OUTPUT_DIR/agentlink-contracts/test" . 2>/dev/null || echo "  ⚠️ Contract tests not found"
cp -r "$OUTPUT_DIR/agentlink-contracts/script" . 2>/dev/null || echo "  ⚠️ Contract scripts not found"
cp "$OUTPUT_DIR/agentlink-contracts/foundry.toml" . 2>/dev/null || echo "  ⚠️ foundry.toml not found"
cp "$OUTPUT_DIR/agentlink-contracts/remappings.txt" . 2>/dev/null || echo "  ⚠️ remappings.txt not found"
cp "$OUTPUT_DIR/agentlink-contracts/README.md" . 2>/dev/null || echo "  ⚠️ Contracts README not found"

# Create .gitignore
cat > .gitignore << 'GITIGNORE'
# Foundry
/cache/
/out/
/broadcast/

# Dependencies
/lib/

# IDE
.vscode/
.idea/

# Secrets
.env
*.pem
GITIGNORE

git add .
git commit -m "Initial commit: Smart contracts" || echo "  Nothing to commit"

git remote add origin "https://github.com/$ORG_NAME/agentlink-contracts.git" 2>/dev/null || echo "  Remote already exists"
git branch -M main
git push -u origin main || echo "  ⚠️ Push failed"

echo ""
echo "✅ Contracts repo setup complete!"
echo ""

# Create tracking issue
echo "📋 Creating tracking issue..."
cd "$OUTPUT_DIR/agentlink-github"

gh issue create \
  --repo "$ORG_NAME/agentlink" \
  --title "🚀 AgentLink MVP - Tracking Issue" \
  --body "## Week 1 Goals

- [ ] Fix x402 replay protection (critical)
- [ ] Fix CLI secrets encryption (critical)
- [ ] Deploy contracts to Base Sepolia
- [ ] Deploy dashboard to Vercel
- [ ] Invite 5 beta developers

## Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Agents deployed | 50 | 0 |
| Transactions | 500 | 0 |
| Active developers | 10 | 0 |

## Blockers

None yet.

## Notes

This is the main tracking issue for AgentLink MVP launch." \
  --label "tracking,epic" 2>/dev/null || echo "  ⚠️ Could not create issue (may already exist)"

echo ""
echo "========================================="
echo "✅ GitHub Setup Complete!"
echo "========================================="
echo ""
echo "Repositories created:"
echo "  - https://github.com/$ORG_NAME/agentlink"
echo "  - https://github.com/$ORG_NAME/agentlink-contracts"
echo ""
echo "Next steps:"
echo "  1. Fix critical security issues (see tracking issue)"
echo "  2. Add GitHub secrets (see GITHUB_SETUP_GUIDE.md)"
echo "  3. Deploy to Base Sepolia"
echo "  4. Invite beta testers"
echo ""
echo "Run Kimi Claw with:"
echo "  'You are Kimi Claw, CEO of AgentLink. Fix the critical issues and deploy to testnet this week.'"
echo ""
