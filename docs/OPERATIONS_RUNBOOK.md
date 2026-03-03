# AgentLink Operations Runbook

This runbook provides operational procedures for managing the AgentLink platform.

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Deployment Procedures](#deployment-procedures)
3. [Monitoring & Alerting](#monitoring--alerting)
4. [Incident Response](#incident-response)
5. [Rollback Procedures](#rollback-procedures)
6. [Maintenance Windows](#maintenance-windows)

---

## Quick Reference

### Important URLs

| Service | URL |
|---------|-----|
| Production Dashboard | https://app.agentlink.io |
| Staging Dashboard | https://staging.agentlink.io |
| GitHub Repository | https://github.com/agentlink/agentlink-mvp |
| Contract Explorer (Base Sepolia) | https://sepolia.basescan.org |
| Contract Explorer (Base Mainnet) | https://basescan.org |

### Contract Addresses

#### Base Sepolia (Testnet)

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x...` |
| TaskManager | `0x...` |
| ReputationSystem | `0x...` |
| AgentLink | `0x...` |

#### Base Mainnet

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x...` |
| TaskManager | `0x...` |
| ReputationSystem | `0x...` |
| AgentLink | `0x...` |

### Emergency Contacts

| Role | Contact |
|------|---------|
| On-call Engineer | oncall@agentlink.io |
| Security Team | security@agentlink.io |
| Product Team | product@agentlink.io |

---

## Deployment Procedures

### Pre-Deployment Checklist

- [ ] All tests passing in CI
- [ ] Code review completed
- [ ] Security audit passed (for contract changes)
- [ ] Changelog updated
- [ ] Version bumped appropriately

### Contract Deployment

#### 1. Deploy to Testnet (Base Sepolia)

```bash
# Ensure environment is set up
cp .env.example .env
# Edit .env with your values

# Deploy to Base Sepolia
./scripts/deploy-contracts.sh base-sepolia --verify
```

#### 2. Verify Deployment

```bash
# Check contract on explorer
open https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>

# Run integration tests
pnpm test:integration
```

#### 3. Deploy to Mainnet (Base)

```bash
# Deploy to Base mainnet
./scripts/deploy-contracts.sh base-mainnet --verify
```

### Dashboard Deployment

#### Automatic Deployment (via GitHub Actions)

1. Merge PR to `main` branch
2. GitHub Actions automatically deploys to production
3. Monitor deployment in GitHub Actions tab

#### Manual Deployment (via Vercel CLI)

```bash
# Install Vercel CLI
pnpm add -g vercel

# Login
vercel login

# Link project
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### SDK Release

```bash
# Create changeset
pnpm changeset

# Version packages
pnpm version-packages

# Commit and push
git add .
git commit -m "chore: version packages"
git push

# Create release tag
git tag v$(node -p "require('./package.json').version")
git push --tags
```

---

## Monitoring & Alerting

### Health Checks

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Dashboard | `https://app.agentlink.io/api/health` | `{"status":"ok"}` |
| API | `https://api.agentlink.io/health` | `{"status":"ok"}` |

### Key Metrics

#### Dashboard Metrics

- Page load time < 2s
- API response time < 500ms
- Error rate < 0.1%
- Uptime > 99.9%

#### Contract Metrics

- Gas usage per transaction
- Transaction success rate
- Active agent count
- Pending task count

### Log Aggregation

Logs are sent to:
- Vercel (dashboard logs)
- Datadog (application logs)
- Sentry (error tracking)

### Alerting Rules

| Condition | Severity | Action |
|-----------|----------|--------|
| Error rate > 1% | Critical | Page on-call |
| API response > 5s | High | Slack alert |
| Failed deployments | High | Slack alert |
| Contract balance < 0.1 ETH | Medium | Email alert |

---

## Incident Response

### Severity Levels

#### SEV 1 (Critical)
- Complete system outage
- Security breach
- Data loss

**Response Time**: 15 minutes
**Actions**:
1. Page on-call engineer
2. Create incident channel
3. Begin rollback if applicable
4. Post status page update

#### SEV 2 (High)
- Major feature degradation
- Performance issues affecting users
- Contract vulnerabilities

**Response Time**: 1 hour
**Actions**:
1. Notify team via Slack
2. Assess impact
3. Implement fix or workaround
4. Monitor resolution

#### SEV 3 (Medium)
- Minor feature issues
- Non-critical bugs
- Performance degradation

**Response Time**: 4 hours
**Actions**:
1. Create GitHub issue
2. Schedule fix
3. Monitor

### Incident Playbook

#### Contract Emergency Pause

If a critical vulnerability is discovered:

```solidity
// Call pause function on affected contracts
AgentRegistry.pause();
TaskManager.pause();
```

#### Dashboard Rollback

```bash
# Rollback to previous deployment
vercel rollback <deployment-id>

# Or redeploy previous version
git checkout <previous-commit>
vercel --prod
```

---

## Rollback Procedures

### Contract Rollback

**Note**: Contracts are immutable. Use proxy pattern for upgrades.

```bash
# Deploy new implementation
forge script script/Upgrade.s.sol --rpc-url $RPC_URL --broadcast

# Upgrade proxy (requires admin)
# Use multisig or governance
```

### Dashboard Rollback

#### Via Vercel Dashboard

1. Go to Vercel dashboard
2. Select project
3. Go to "Deployments" tab
4. Find previous working deployment
5. Click "..." → "Promote to Production"

#### Via CLI

```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback <deployment-url>
```

### SDK Rollback

```bash
# Deprecate version on npm
npm deprecate @agentlink/sdk@<version> "Critical issue, use @<safe-version>"

# Or unpublish (within 24 hours)
npm unpublish @agentlink/sdk@<version>
```

---

## Maintenance Windows

### Scheduled Maintenance

1. Announce maintenance 24 hours in advance
2. Post on status page
3. Send notifications to users
4. Execute during low-traffic hours (UTC 02:00-04:00)

### Database Maintenance

```bash
# Create backup before maintenance
supabase db dump -f backup-$(date +%Y%m%d).sql

# Apply migrations
supabase db push
```

### Contract Upgrades

1. Deploy new implementation
2. Verify on explorer
3. Submit upgrade transaction via multisig
4. Monitor upgrade execution
5. Verify functionality

---

## Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clear cache
pnpm clean

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Rebuild
pnpm build
```

#### Contract Verification Failures

```bash
# Verify manually
forge verify-contract \
  --chain-id 84532 \
  --watch \
  --constructor-args $(cast abi-encode "constructor(address)" <arg>) \
  <CONTRACT_ADDRESS> \
  <CONTRACT_NAME>
```

#### Vercel Deployment Failures

```bash
# Check build logs
vercel logs --all

# Redeploy
vercel --force
```

### Support Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Base Docs](https://docs.base.org/)

---

## Appendix

### Useful Commands

```bash
# Check contract balance
cast balance <CONTRACT_ADDRESS> --rpc-url $RPC_URL

# Read contract state
cast call <CONTRACT_ADDRESS> "functionName()" --rpc-url $RPC_URL

# Send transaction
cast send <CONTRACT_ADDRESS> "functionName()" --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# Estimate gas
cast estimate <CONTRACT_ADDRESS> "functionName()" --rpc-url $RPC_URL
```

### Environment Setup

```bash
# Install dependencies
pnpm install

# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Vercel CLI
pnpm add -g vercel
```
