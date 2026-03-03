# AgentLink MVP - Test Plan Document

## Table of Contents
1. [Test Strategy Overview](#test-strategy-overview)
2. [Test Pyramid](#test-pyramid)
3. [Coverage Targets](#coverage-targets)
4. [Test Data Strategy](#test-data-strategy)
5. [Test Environments](#test-environments)
6. [CI/CD Integration](#cicd-integration)
7. [Test Commands](#test-commands)

---

## Test Strategy Overview

### Philosophy
AgentLink follows a comprehensive testing strategy based on the **Test Pyramid** model, ensuring confidence at every level of the application stack:

- **Unit Tests**: Fast, isolated tests for individual functions and components
- **Integration Tests**: Tests for component interactions and API contracts
- **Contract Tests**: Foundry-based Solidity tests for smart contract security
- **E2E Tests**: End-to-end user journey validation

### Testing Principles
1. **Test Behavior, Not Implementation**: Focus on what code does, not how it does it
2. **Fast Feedback**: Unit tests run in <100ms, full suite in <5 minutes
3. **Deterministic**: Tests produce consistent results across runs
4. **Isolated**: Tests don't depend on each other or external state
5. **Readable**: Tests serve as documentation

---

## Test Pyramid

```
        /\
       /  \     E2E Tests (Playwright)
      /    \    ~10 tests, ~5 min
     /------\
    /        \   Integration Tests
   /          \  ~50 tests, ~2 min
  /------------\
 /              \ Contract Tests (Foundry)
/                \ ~100 tests, ~1 min
------------------
|   Unit Tests    | (Vitest)
|  ~200+ tests   | ~30 sec
------------------
```

### Breakdown by Component

| Component | Unit | Integration | Contract | E2E |
|-----------|------|-------------|----------|-----|
| SDK Core | 80+ | 20 | - | - |
| A2A Protocol | 50+ | 15 | - | - |
| CLI | 30+ | 10 | - | - |
| x402 Payments | 20+ | 10 | - | - |
| Smart Contracts | - | - | 100+ | - |
| Dashboard | 20+ | 10 | - | 10 |
| **Total** | **200+** | **65** | **100+** | **10** |

---

## Coverage Targets

### Minimum Coverage Requirements

| Metric | Target | Critical Path |
|--------|--------|---------------|
| Line Coverage | 80% | 95% |
| Branch Coverage | 75% | 90% |
| Function Coverage | 85% | 100% |
| Statement Coverage | 80% | 95% |

### Critical Paths (95% Coverage Required)
1. **Payment Flow**: x402 payment processing, verification, settlement
2. **Identity Management**: Agent registration, credential verification
3. **A2A Protocol**: Task creation, message handling, streaming
4. **CLI Core**: create, dev, deploy, identity commands

### Coverage Exclusions
- Auto-generated code (type definitions, build artifacts)
- Third-party dependencies
- Debug/logging code
- Configuration files

---

## Test Data Strategy

### Fixtures

#### 1. Agent Fixtures
```typescript
// Standard test agent configurations
export const testAgents = {
  minimal: { /* minimal valid agent */ },
  fullFeatured: { /* agent with all features */ },
  streaming: { /* streaming-enabled agent */ },
  payment: { /* payment-enabled agent */ },
};
```

#### 2. Wallet Fixtures
```typescript
// Anvil test wallets with deterministic addresses
export const testWallets = {
  deployer: { address: '0x...', privateKey: '0x...' },
  agent: { address: '0x...', privateKey: '0x...' },
  payer: { address: '0x...', privateKey: '0x...' },
  receiver: { address: '0x...', privateKey: '0x...' },
};
```

#### 3. Contract Fixtures
```solidity
// Pre-deployed contract states
contract TestFixtures {
    AgentIdentity identity;
    PaymentRouter router;
    MockUSDC usdc;
}
```

### Mock Strategy

| Dependency | Mock Type | Location |
|------------|-----------|----------|
| Blockchain | Anvil local node | `@tests/mocks/anvil.ts` |
| IPFS | Memory store | `@tests/mocks/ipfs.ts` |
| External APIs | MSW handlers | `@tests/mocks/handlers.ts` |
| Database | In-memory SQLite | `@tests/mocks/database.ts` |

---

## Test Environments

### Local Development
```bash
# Run all tests locally
pnpm test

# Run specific test suite
pnpm test:unit
pnpm test:integration
pnpm test:contracts
pnpm test:e2e
```

### CI Environment
- **Node.js**: 18.x, 20.x
- **Foundry**: Latest stable
- **OS**: Ubuntu 22.04
- **Browser**: Chromium (Playwright)

### Test Networks
| Network | Purpose | RPC URL |
|---------|---------|---------|
| Anvil | Local testing | http://localhost:8545 |
| Sepolia | Integration testing | https://rpc.sepolia.org |
| Base Sepolia | E2E testing | https://sepolia.base.org |

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test:unit --coverage
      - uses: codecov/codecov-action@v3

  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge test --fuzz-runs 1000

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm exec playwright install
      - run: pnpm test:e2e
```

### Failure Criteria
- ❌ Any unit test failure blocks PR
- ❌ Contract test failure blocks PR
- ❌ Coverage drop >2% blocks PR
- ⚠️ Integration test failure requires review
- ⚠️ E2E test flaky - retry 3x before failure

---

## Test Commands

### Full Test Suite
```bash
# Run everything
pnpm lint && pnpm typecheck && pnpm test

# With coverage
pnpm test --coverage

# Watch mode
pnpm test --watch
```

### Contract Tests
```bash
# Build and test
forge build && forge test

# With gas report
forge test --gas-report

# Fuzzing with more runs
forge test --fuzz-runs 10000
```

### E2E Tests
```bash
# Install browsers
pnpm exec playwright install

# Run tests
playwright test

# UI mode
playwright test --ui

# Debug mode
playwright test --debug
```

### Specific Test Suites
```bash
# SDK tests
pnpm --filter @agentlink/core test

# CLI tests
pnpm --filter @agentlink/cli test

# A2A protocol tests
pnpm --filter @agentlink/a2a test

# Contract tests
cd agentlink-contracts && forge test
```

---

## Test File Organization

```
packages/
├── agentlink-core/
│   ├── src/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── fixtures/
├── agentlink-cli/
│   ├── src/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── fixtures/
├── a2a-protocol/
│   ├── src/
│   └── tests/
│       ├── unit/
│       └── fixtures/
├── agentlink-contracts/
│   ├── src/
│   └── test/
│       ├── unit/
│       ├── invariants/
│       └── mocks/
└── dashboard/
    ├── src/
    └── tests/
        ├── unit/
        ├── integration/
        └── e2e/
```

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Test Count | 375+ | - |
| Coverage | 80% | - |
| Flaky Tests | 0% | - |
| Test Runtime | <5 min | - |
| Contract Fuzz Runs | 1000+ | - |

---

## Maintenance

### Monthly Review
- [ ] Review flaky tests
- [ ] Update test data fixtures
- [ ] Check coverage trends
- [ ] Update test dependencies

### Quarterly Review
- [ ] Reassess coverage targets
- [ ] Review test pyramid balance
- [ ] Update E2E test scenarios
- [ ] Performance benchmarking
