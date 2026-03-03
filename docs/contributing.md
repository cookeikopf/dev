# Contributing Guide

Thank you for your interest in contributing to AgentLink!

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [Community](#community)

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+ (recommended) or npm/yarn
- Git

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/agentlink/agentlink.git
cd agentlink

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Build packages
pnpm build

# Run tests
pnpm test
```

### Development Environment

```bash
# Start development mode with hot reload
pnpm dev

# Run specific package in dev mode
pnpm dev --filter @agentlink/sdk

# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# Format code
pnpm format
```

## Project Structure

```
agentlink/
├── packages/
│   ├── sdk/                 # Core SDK
│   │   ├── src/
│   │   │   ├── core/        # Core agent functionality
│   │   │   ├── payments/    # x402 payment handling
│   │   │   ├── identity/    # DID identity
│   │   │   ├── a2a/         # A2A protocol
│   │   │   ├── adapters/    # Framework adapters
│   │   │   └── utils/       # Utilities
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── cli/                 # CLI tool
│   │   ├── src/
│   │   │   ├── commands/    # CLI commands
│   │   │   ├── utils/       # CLI utilities
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── adapters/
│   │   ├── langchain/       # LangChain adapter
│   │   ├── crewai/          # CrewAI adapter
│   │   ├── hono/            # Hono adapter
│   │   ├── express/         # Express adapter
│   │   └── nextjs/          # Next.js adapter
│   │
│   └── types/               # Shared TypeScript types
│
├── apps/
│   ├── docs/                # Documentation site
│   └── dashboard/           # Web dashboard
│
├── examples/                # Example projects
│   ├── greeting-agent/
│   ├── research-agent/
│   └── webhook-handler/
│
├── tests/                   # E2E tests
├── scripts/                 # Build scripts
├── .github/                 # GitHub workflows
└── package.json             # Root package.json
```

## Development Workflow

### 1. Create a Branch

```bash
# Create feature branch
git checkout -b feature/my-feature

# Or bugfix branch
git checkout -b fix/my-bugfix
```

### 2. Make Changes

```bash
# Edit files
# ...

# Run tests
pnpm test

# Run linting
pnpm lint

# Build
pnpm build
```

### 3. Commit Changes

```bash
# Stage changes
git add .

# Commit with conventional commit format
git commit -m "feat(sdk): add new capability"

# Or
pnpm commit  # Interactive commit helper
```

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test changes
- `chore`: Build/tooling changes

**Examples:**

```
feat(sdk): add webhook signature verification

Implement HMAC-SHA256 signature verification for webhooks
to prevent spoofing attacks.

Closes #123
```

```
fix(payments): handle double-spend attempts

Add transaction hash tracking to prevent processing
the same payment twice.

Fixes #456
```

## Code Style

### TypeScript

```typescript
// ✅ DO: Use explicit types
function calculatePrice(amount: number, currency: string): string {
  return `${amount} ${currency}`;
}

// ❌ DON'T: Use implicit types
function calculatePrice(amount, currency) {
  return `${amount} ${currency}`;
}

// ✅ DO: Use interfaces for objects
interface User {
  id: string;
  name: string;
  email: string;
}

// ✅ DO: Use type for unions
type Status = 'pending' | 'processing' | 'completed' | 'failed';

// ✅ DO: Export types that are used externally
export interface AgentConfig {
  name: string;
  capabilities: string[];
}
```

### Naming Conventions

```typescript
// ✅ DO: Use PascalCase for types/interfaces
interface AgentConfig {}
type PaymentMethod = 'crypto' | 'fiat';

// ✅ DO: Use camelCase for variables/functions
const agentName = 'my-agent';
function processPayment() {}

// ✅ DO: Use UPPER_SNAKE_CASE for constants
const MAX_REQUEST_SIZE = 10 * 1024 * 1024;

// ✅ DO: Use descriptive names
const userWalletAddress = '0x...';

// ❌ DON'T: Use abbreviations
const addr = '0x...'; // Bad
```

### Error Handling

```typescript
// ✅ DO: Use custom error classes
class AgentLinkError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AgentLinkError';
  }
}

// ✅ DO: Provide context in errors
throw new AgentLinkError(
  'Payment verification failed',
  'PAYMENT_VERIFICATION_FAILED',
  { txHash, expectedAmount, actualAmount }
);

// ✅ DO: Handle errors gracefully
try {
  await processPayment(params);
} catch (error) {
  if (error instanceof AgentLinkError) {
    logger.error('Payment failed', { code: error.code, details: error.details });
    return { error: error.message, code: error.code };
  }
  throw error;
}
```

### Documentation

```typescript
// ✅ DO: Document public APIs
/**
 * Creates a new AgentLink agent instance.
 * 
 * @param config - Agent configuration
 * @returns Agent instance
 * 
 * @example
 * ```typescript
 * const agent = createAgent({
 *   name: 'my-agent',
 *   capabilities: ['research'],
 *   pricing: { perRequest: 0.01 }
 * });
 * ```
 */
export function createAgent(config: AgentConfig): Agent {
  // Implementation
}
```

## Testing

### Unit Tests

```typescript
// tests/agent.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createAgent } from '../src/core/agent';

describe('Agent', () => {
  let agent: Agent;
  
  beforeEach(() => {
    agent = createAgent({
      name: 'test-agent',
      capabilities: ['test']
    });
  });
  
  it('should create agent with config', () => {
    expect(agent.name).toBe('test-agent');
    expect(agent.capabilities).toContain('test');
  });
  
  it('should handle capability', async () => {
    agent.handle('test', async (ctx, params) => {
      return { result: params.input };
    });
    
    const result = await agent.call('test', { input: 'hello' });
    expect(result.result).toBe('hello');
  });
  
  it('should throw for unknown capability', async () => {
    await expect(agent.call('unknown', {}))
      .rejects.toThrow('Capability not found');
  });
});
```

### Integration Tests

```typescript
// tests/integration/payments.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createAgent } from '../../src/core/agent';

describe('Payment Integration', () => {
  let agent: Agent;
  let server: Server;
  
  beforeAll(async () => {
    agent = createAgent({
      name: 'payment-test-agent',
      capabilities: ['paid-service'],
      pricing: {
        perRequest: 0.01,
        currency: 'USD'
      }
    });
    
    agent.handle('paid-service', async (ctx, params) => {
      return { result: 'success' };
    });
    
    server = await agent.start({ port: 0 });
  });
  
  it('should require payment after free quota', async () => {
    // Use up free quota
    for (let i = 0; i < 5; i++) {
      await fetch(`http://localhost:${server.port}/agent/paid-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
    }
    
    // Next request should require payment
    const response = await fetch(`http://localhost:${server.port}/agent/paid-service`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    expect(response.status).toBe(402);
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test tests/agent.test.ts

# Run tests matching pattern
pnpm test -- -t "should create"
```

## Pull Request Process

### 1. Before Submitting

- [ ] All tests pass
- [ ] Code is linted and formatted
- [ ] Type checking passes
- [ ] Documentation is updated
- [ ] Changes are tested manually

### 2. Create PR

```bash
# Push branch
git push origin feature/my-feature

# Create PR via GitHub CLI
gh pr create --title "feat(sdk): add new feature" --body "Description..."
```

### 3. PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass

## Related Issues
Fixes #123
```

### 4. Review Process

1. Automated checks must pass:
   - Tests
   - Linting
   - Type checking
   - Build

2. Code review by maintainers:
   - At least 1 approval required
   - All comments addressed
   - No unresolved conversations

3. Merge requirements:
   - Branch is up to date with main
   - All checks pass
   - Approved by maintainer

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- `MAJOR`: Breaking changes
- `MINOR`: New features (backward compatible)
- `PATCH`: Bug fixes

### Release Steps

```bash
# 1. Update version
pnpm version [patch|minor|major]

# 2. Update CHANGELOG.md
# Add release notes

# 3. Create release commit
git commit -m "chore(release): v1.2.3"

# 4. Create git tag
git tag v1.2.3

# 5. Push
git push origin main --tags

# 6. GitHub Actions will publish to npm
```

### Changelog Format

```markdown
# Changelog

## [1.2.3] - 2024-01-15

### Added
- New webhook signature verification
- Support for batch payments

### Changed
- Improved error messages
- Updated dependencies

### Fixed
- Fixed rate limiting edge case
- Fixed memory leak in long-running agents

### Security
- Fixed potential XSS vulnerability in output
```

## Community

### Communication Channels

- **Discord**: [Join our community](https://discord.gg/agentlink)
- **GitHub Discussions**: [Ask questions](https://github.com/agentlink/agentlink/discussions)
- **Twitter**: [@AgentLinkHQ](https://twitter.com/AgentLinkHQ)

### Code of Conduct

1. **Be respectful**: Treat everyone with respect
2. **Be constructive**: Provide helpful feedback
3. **Be inclusive**: Welcome newcomers
4. **Stay on topic**: Keep discussions relevant

### Getting Help

- Check [documentation](https://docs.agentlink.dev)
- Search [existing issues](https://github.com/agentlink/agentlink/issues)
- Ask in [Discord](https://discord.gg/agentlink)
- Open a [discussion](https://github.com/agentlink/agentlink/discussions)

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Given credit in documentation

Thank you for contributing to AgentLink! 🚀
