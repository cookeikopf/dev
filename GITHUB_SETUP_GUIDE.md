# GitHub Setup Guide - AgentLink

Complete guide to push all AgentLink code to GitHub and setup the project for collaboration.

## Step 1: Create GitHub Organization

1. Go to https://github.com/account/organizations/new
2. Choose "Create a free organization"
3. Organization name: `agentlink`
4. Contact email: your email
5. Choose "My personal account"
6. Complete setup

## Step 2: Create Repositories

Create these repositories in the `agentlink` org:

| Repo | Description | Visibility |
|------|-------------|------------|
| `agentlink` | Main monorepo (SDK, CLI, dashboard) | Public |
| `agentlink-contracts` | Smart contracts (Foundry) | Public |
| `agentlink-docs` | Documentation website | Public |
| `agentlink-examples` | Example agents | Public |

### Repo Setup Commands

```bash
# 1. Setup main monorepo
cd /mnt/okcomputer/output
mkdir -p agentlink-mono
cd agentlink-mono

# Initialize git
git init

# Create structure
mkdir -p packages/core packages/cli apps/dashboard apps/web
mkdir -p .github/workflows

# Copy files from output
cp -r /mnt/okcomputer/output/agentlink-core/* packages/core/
cp -r /mnt/okcomputer/output/agentlink-cli/* packages/cli/
cp -r /mnt/okcomputer/output/agentlink-dashboard/* apps/dashboard/
cp -r /mnt/okcomputer/output/a2a-protocol packages/core/src/a2a/
cp -r /mnt/okcomputer/output/x402 packages/core/src/x402/

# Copy config files
cp /mnt/okcomputer/output/configs/package.json .
cp /mnt/okcomputer/output/configs/pnpm-workspace.yaml .
cp /mnt/okcomputer/output/configs/turbo.json .
cp /mnt/okcomputer/output/configs/tsconfig.json .
cp /mnt/okcomputer/output/configs/.eslintrc.js .
cp /mnt/okcomputer/output/configs/.prettierrc .
cp /mnt/okcomputer/output/configs/.gitignore . || echo "node_modules\ndist\n.env\n*.log" > .gitignore

# Copy GitHub Actions
cp -r /mnt/okcomputer/output/.github/workflows .github/

# Create root README
cat > README.md << 'EOF'
# AgentLink

Open-source TypeScript SDK + CLI + hosted dashboard for agent-to-agent payments on Base.

## Quick Start

```bash
npm install -g @agentlink/cli
agentlink create my-agent
agentlink dev
```

## Packages

- `@agentlink/core` - SDK with A2A, x402, adapters
- `@agentlink/cli` - CLI for scaffolding and deployment
- `@agentlink/dashboard` - Analytics dashboard (Next.js)

## Documentation

See [docs.agentlink.dev](https://docs.agentlink.dev)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
EOF

# Add all files
git add .
git commit -m "Initial commit: AgentLink MVP"

# Add remote (replace with your org)
git remote add origin https://github.com/agentlink/agentlink.git
git branch -M main
git push -u origin main
```

## Step 3: Setup Contracts Repo

```bash
cd /mnt/okcomputer/output
mkdir -p agentlink-contracts
cd agentlink-contracts

# Initialize
git init

# Copy contract files
cp -r /mnt/okcomputer/output/agentlink-contracts/* .

# Create foundry-specific .gitignore
cat > .gitignore << 'EOF'
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
EOF

# Commit
git add .
git commit -m "Initial commit: Smart contracts"

# Push
git remote add origin https://github.com/agentlink/agentlink-contracts.git
git branch -M main
git push -u origin main
```

## Step 4: Setup Docs Repo

```bash
cd /mnt/okcomputer/output
mkdir -p agentlink-docs
cd agentlink-docs

# Initialize
git init

# Copy docs
cp -r /mnt/okcomputer/output/docs/* .
cp /mnt/okcomputer/output/README.md .

# Commit
git add .
git commit -m "Initial commit: Documentation"

# Push
git remote add origin https://github.com/agentlink/agentlink-docs.git
git branch -M main
git push -u origin main
```

## Step 5: Setup Examples Repo

```bash
cd /mnt/okcomputer/output
mkdir -p agentlink-examples
cd agentlink-examples

# Initialize
git init

# Copy examples
cp -r /mnt/okcomputer/output/examples/* .
cp -r /mnt/okcomputer/output/starter_kits/* .

# Commit
git add .
git commit -m "Initial commit: Example agents"

# Push
git remote add origin https://github.com/agentlink/agentlink-examples.git
git branch -M main
git push -u origin main
```

## Step 6: Configure GitHub Secrets

For each repo, add these secrets (Settings → Secrets and variables → Actions):

### Main Repo Secrets

| Secret | Value | How to Get |
|--------|-------|------------|
| `NPM_TOKEN` | npm_... | https://www.npmjs.com/settings/tokens |
| `VERCEL_TOKEN` | vercel_... | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | org_... | Vercel project settings |
| `VERCEL_PROJECT_ID` | prj_... | Vercel project settings |
| `CODECOV_TOKEN` | codecov_... | https://app.codecov.io |
| `SLACK_WEBHOOK_URL` | https://hooks... | Slack app webhooks |

### Contracts Repo Secrets

| Secret | Value | How to Get |
|--------|-------|------------|
| `BASE_SEPOLIA_RPC_URL` | https://... | Alchemy/Infura dashboard |
| `BASE_MAINNET_RPC_URL` | https://... | Alchemy/Infura dashboard |
| `PRIVATE_KEY` | 0x... | Your wallet private key (use dedicated deployer) |
| `ETHERSCAN_API_KEY` | ... | https://basescan.org/apis |

### Dashboard Repo Secrets

| Secret | Value | How to Get |
|--------|-------|------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | pk_test_... | https://dashboard.clerk.dev |
| `CLERK_SECRET_KEY` | sk_test_... | Clerk dashboard |
| `NEXT_PUBLIC_SUPABASE_URL` | https://... | Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | eyJ... | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | eyJ... | Supabase project settings |

## Step 7: Setup GitHub Project Board

1. Go to https://github.com/orgs/agentlink/projects
2. Click "New project"
3. Name: "AgentLink Roadmap"
4. Template: "Feature"
5. Add these views:
   - Board (Kanban)
   - Table (Detailed)
   - Roadmap (Timeline)

### Initial Columns

- 📋 Backlog
- 🎯 Ready
- 🏗️ In Progress
- 👀 In Review
- ✅ Done

### Initial Issues to Create

```markdown
Title: [CRITICAL] Fix x402 replay protection
Labels: security, critical, p0
Body: Implement nonce tracking to prevent payment proof replay attacks.
```

```markdown
Title: [CRITICAL] Encrypt CLI secrets
Labels: security, critical, p0
Body: Use OS keychain integration instead of storing keys in plaintext .env files.
```

```markdown
Title: Deploy contracts to Base Sepolia
Labels: deployment, contracts
Body: Deploy PaymentRouter and AgentIdentity to Base Sepolia testnet.
```

```markdown
Title: Deploy dashboard to Vercel
Labels: deployment, dashboard
Body: Setup production Vercel deployment with custom domain.
```

```markdown
Title: Invite 5 beta developers
Labels: growth, beta
Body: Reach out to AI agent developers for beta testing.
```

## Step 8: Setup Branch Protection

For each repo (Settings → Branches):

1. Add rule for `main` branch:
   - ☑️ Require pull request reviews before merging (1 reviewer)
   - ☑️ Require status checks to pass before merging
   - ☑️ Require branches to be up to date before merging
   - ☑️ Include administrators

## Step 9: Setup Issue Templates

Create `.github/ISSUE_TEMPLATE/` in main repo:

### bug_report.md
```markdown
---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear description of the bug.

**To Reproduce**
Steps to reproduce:
1. Run '...'
2. See error

**Expected behavior**
What you expected.

**Environment:**
- OS: [e.g. macOS]
- Node version: [e.g. 18.12.0]
- Package version: [e.g. 0.1.0]
```

### feature_request.md
```markdown
---
name: Feature request
about: Suggest an idea
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

**Is your feature request related to a problem?**
A clear description.

**Describe the solution**
What you want to happen.

**Describe alternatives**
Other solutions considered.

**Additional context**
Screenshots, examples, etc.
```

## Step 10: Automated Workflows

The GitHub Actions are already configured. They will:

### On Pull Request
- Lint code
- Run type checks
- Run unit tests
- Run contract tests
- Check coverage
- Build packages

### On Push to Main
- Deploy dashboard to Vercel (production)
- Update changelog
- Tag release

### On Tag (Release)
- Publish packages to NPM
- Create GitHub release
- Deploy contracts (if contract repo)

## Step 11: Setup Monitoring

### Vercel Analytics
1. Go to Vercel dashboard
2. Select project
3. Go to Analytics tab
4. Enable Web Analytics

### BaseScan Monitoring
1. Go to https://basescan.org
2. Search for your contract addresses
3. Click "Add to watch list"
4. Setup email notifications for transactions

### Supabase Monitoring
1. Go to Supabase dashboard
2. Select project
3. Go to Database → Usage
4. Setup usage alerts

## Step 12: Team Setup

### Invite Collaborators

1. Go to org settings: https://github.com/organizations/agentlink/settings/members
2. Click "Invite member"
3. Add by username/email
4. Choose role:
   - **Admin**: Full access (you)
   - **Write**: Can push code (core team)
   - **Read**: Can view only (community)

### Setup Teams (Optional)

1. Go to org settings → Teams
2. Create teams:
   - `core` - Core developers
   - `community` - Community contributors
   - `security` - Security reviewers

## Quick Reference Commands

```bash
# Clone all repos
mkdir -p ~/agentlink && cd ~/agentlink
git clone https://github.com/agentlink/agentlink.git
git clone https://github.com/agentlink/agentlink-contracts.git
git clone https://github.com/agentlink/agentlink-docs.git
git clone https://github.com/agentlink/agentlink-examples.git

# Daily workflow
cd ~/agentlink/agentlink
git pull origin main
# ... make changes ...
git add .
git commit -m "feat: description"
git push origin main

# Create PR
git checkout -b feature/name
git push -u origin feature/name
# Then create PR via GitHub UI
```

## Directory Structure After Setup

```
~/agentlink/
├── agentlink/              # Main monorepo
│   ├── packages/
│   │   ├── core/          # SDK
│   │   └── cli/           # CLI
│   ├── apps/
│   │   └── dashboard/     # Next.js app
│   ├── .github/
│   │   └── workflows/     # CI/CD
│   └── README.md
│
├── agentlink-contracts/    # Smart contracts
│   ├── src/
│   ├── test/
│   ├── script/
│   └── foundry.toml
│
├── agentlink-docs/         # Documentation
│   ├── quickstart.md
│   ├── sdk-reference.md
│   └── examples/
│
└── agentlink-examples/     # Example agents
    ├── research-agent/
    ├── greeting-agent/
    └── webhook-handler/
```

## Troubleshooting

### Push Rejected
```bash
# Force push (careful!)
git push -f origin main

# Or pull first
git pull origin main --rebase
git push origin main
```

### Large Files
```bash
# Use Git LFS for large files
git lfs track "*.psd"
git lfs track "*.mov"
git add .gitattributes
git commit -m "Add Git LFS"
```

### Secrets Leaked
```bash
# Rotate immediately!
# 1. Revoke old secrets
# 2. Generate new ones
# 3. Update GitHub secrets
# 4. Force push to remove from history (if recent)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  HEAD
```

## Next Steps

After GitHub setup:

1. **Fix critical security issues** (x402 replay, CLI secrets)
2. **Deploy to Base Sepolia** (see FINAL_DELIVERABLE.md Section G)
3. **Invite beta testers** (create Discord, post on Twitter)
4. **Start building in public** (share progress weekly)

---

**Your AgentLink is now on GitHub and ready for the world! 🚀**
