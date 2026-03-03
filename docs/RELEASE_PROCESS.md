# AgentLink Release Process

This document describes the release process for AgentLink packages and applications.

## Table of Contents

1. [Release Types](#release-types)
2. [Versioning Strategy](#versioning-strategy)
3. [Release Workflow](#release-workflow)
4. [Package-Specific Releases](#package-specific-releases)
5. [Emergency Releases](#emergency-releases)
6. [Post-Release](#post-release)

---

## Release Types

### Regular Releases

Scheduled releases following the sprint cycle:
- **Frequency**: Bi-weekly
- **Day**: Tuesday
- **Time**: 10:00 UTC

### Hotfix Releases

Emergency releases for critical bugs:
- **Trigger**: Critical bug in production
- **Timeline**: As soon as fix is ready and tested
- **Approval**: Tech lead + Product manager

### Security Releases

Security vulnerability patches:
- **Trigger**: Security vulnerability discovered
- **Timeline**: Within 24 hours of fix
- **Approval**: Security team + Tech lead

---

## Versioning Strategy

We follow [Semantic Versioning](https://semver.org/) (SemVer):

```
MAJOR.MINOR.PATCH
```

### Version Bump Rules

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking API change | MAJOR | 1.2.3 → 2.0.0 |
| New feature (backward compatible) | MINOR | 1.2.3 → 1.3.0 |
| Bug fix | PATCH | 1.2.3 → 1.2.4 |

### Pre-release Versions

For testing before stable release:

```
1.2.3-alpha.1
1.2.3-beta.2
1.2.3-rc.1
```

---

## Release Workflow

### 1. Prepare Release Branch

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Create release branch
git checkout -b release/v1.2.3
```

### 2. Update Versions

```bash
# Create changeset for version bump
pnpm changeset

# Follow interactive prompts:
# - Select packages to bump
# - Choose bump type (major/minor/patch)
# - Add summary

# Version packages
pnpm version-packages
```

### 3. Update Changelog

```bash
# Changelog is auto-generated from changesets
# Review CHANGELOG.md

cat CHANGELOG.md
```

### 4. Create Release PR

```bash
# Commit changes
git add .
git commit -m "chore(release): prepare v1.2.3"

# Push branch
git push origin release/v1.2.3

# Create PR via GitHub CLI
gh pr create \
  --title "Release v1.2.3" \
  --body "## Release v1.2.3

### Changes
$(cat .changeset/*.md | grep -v '---')

### Checklist
- [ ] Tests passing
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Documentation updated" \
  --base main
```

### 5. Review & Merge

- [ ] Code review by 2 team members
- [ ] CI checks passing
- [ ] QA sign-off (for major releases)
- [ ] Product manager approval

```bash
# Merge PR (use squash for clean history)
gh pr merge --squash --delete-branch
```

### 6. Create Release Tag

```bash
# Checkout main
git checkout main
git pull origin main

# Create annotated tag
git tag -a v1.2.3 -m "Release v1.2.3

### Highlights
- Feature A
- Bug fix B
- Improvement C

See CHANGELOG.md for full details."

# Push tag
git push origin v1.2.3
```

### 7. Automated Release

GitHub Actions automatically:
1. Runs full test suite
2. Builds all packages
3. Publishes to NPM
4. Creates GitHub release
5. Updates documentation

Monitor progress: https://github.com/agentlink/agentlink-mvp/actions

---

## Package-Specific Releases

### SDK Package (@agentlink/sdk)

```bash
# Navigate to package
cd packages/sdk

# Update version
npm version patch  # or minor/major

# Build
pnpm build

# Publish
npm publish --access public
```

### Shared Package (@agentlink/shared)

```bash
# Navigate to package
cd packages/shared

# Update version
npm version patch

# Build
pnpm build

# Publish
npm publish --access public
```

### Dashboard Application

Dashboard is deployed automatically on merge to main:

```bash
# Manual deployment (if needed)
cd packages/dashboard
vercel --prod
```

### Contracts

Contracts are deployed manually:

```bash
# Deploy to testnet
./scripts/deploy-contracts.sh base-sepolia --verify

# Deploy to mainnet
./scripts/deploy-contracts.sh base-mainnet --verify
```

---

## Emergency Releases

### Hotfix Process

1. **Create hotfix branch from latest tag**

```bash
# Checkout latest tag
git checkout v1.2.3

# Create hotfix branch
git checkout -b hotfix/critical-fix
```

2. **Apply fix**

```bash
# Make changes
git add .
git commit -m "fix: critical bug description"
```

3. **Fast-track review**

- Skip normal review process
- Get approval from tech lead
- Run minimal tests

4. **Create release**

```bash
# Version bump (patch)
npm version patch

# Create tag
git tag -a v1.2.4 -m "Hotfix: critical bug fix"

# Push
git push origin hotfix/critical-fix
git push origin v1.2.4
```

5. **Deploy immediately**

6. **Post-hotfix**

```bash
# Cherry-pick to main
git checkout main
git cherry-pick <hotfix-commit>

# Cherry-pick to develop (if exists)
git checkout develop
git cherry-pick <hotfix-commit>
```

### Security Release Process

1. **Create private security branch**

```bash
# Create from security team fork
git checkout -b security/fix-vulnerability
```

2. **Develop fix privately**

3. **Coordinate disclosure**

- Notify affected users
- Prepare security advisory
- Set disclosure date

4. **Release on disclosure date**

```bash
# Merge to main
git checkout main
git merge security/fix-vulnerability

# Create release
git tag -a v1.2.4 -m "Security fix for CVE-XXXX-XXXXX"
```

---

## Post-Release

### Verification

1. **Verify NPM packages**

```bash
# Check package is published
npm view @agentlink/sdk versions

# Install and test
npm install @agentlink/sdk@latest
```

2. **Verify dashboard deployment**

```bash
# Check deployment
vercel ls

# Test in browser
open https://app.agentlink.io
```

3. **Verify contracts**

```bash
# Check on explorer
open https://basescan.org/address/<CONTRACT_ADDRESS>
```

### Communication

1. **Update status page**

```bash
# Post release notes
curl -X POST https://api.statuspage.io/v2/pages/$PAGE_ID/incidents \
  -H "Authorization: OAuth $API_KEY" \
  -d "incident[name]=Release v1.2.3" \
  -d "incident[status]=resolved"
```

2. **Notify stakeholders**

- Slack: #releases channel
- Email: stakeholders@agentlink.io
- Twitter: @AgentLink (for major releases)

3. **Update documentation**

```bash
# Deploy docs
cd docs
vercel --prod
```

### Monitoring

Monitor for 24 hours post-release:

- Error rates
- Performance metrics
- User feedback
- Support tickets

### Rollback Plan

If issues are detected:

```bash
# Dashboard rollback
vercel rollback <previous-deployment>

# NPM deprecation
npm deprecate @agentlink/sdk@1.2.3 "Issue found, use 1.2.2"

# Contract emergency pause
# (if upgradeable proxy pattern used)
```

---

## Release Checklist Template

```markdown
## Release vX.Y.Z Checklist

### Pre-Release
- [ ] All PRs merged
- [ ] Tests passing
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Documentation updated

### Release
- [ ] Release PR created
- [ ] Code review completed
- [ ] CI checks passing
- [ ] PR merged to main
- [ ] Tag created and pushed

### Post-Release
- [ ] NPM packages published
- [ ] Dashboard deployed
- [ ] Status page updated
- [ ] Stakeholders notified
- [ ] Monitoring active

### Verification
- [ ] Package installable
- [ ] Dashboard accessible
- [ ] Contracts verified
- [ ] No critical errors
```

---

## Tools & Resources

### Required Tools

```bash
# Install globally
pnpm add -g \
  @changesets/cli \
  gh \
  vercel
```

### Useful Commands

```bash
# List all tags
git tag -l

# Show tag details
git show v1.2.3

# Compare versions
git log v1.2.2..v1.2.3 --oneline

# View changeset status
pnpm changeset status

# View unpublished packages
pnpm changeset status --output=json
```

### References

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
