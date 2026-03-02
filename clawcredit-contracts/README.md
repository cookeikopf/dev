# ClawCredit Handoff README (for Clawdbot)

This document is the single-source handoff for the current repository state.
Goal: allow Clawdbot to continue development without missing context.

## 1) Project Snapshot

- Product: reputation-first AI agent credit protocol on Base
- Stack level:
- V2 core lending engine: `src/ClawCreditUltimateV2.sol`
- V3 agent finance OS: `src/ClawCreditAgentStandardV3.sol`
- Language/tooling: Solidity 0.8.20 + Foundry + OpenZeppelin v5
- Governance model: AccessControl roles, designed for Timelock-controlled admin

## 2) Current Architecture

### V2 (Lean Production Core)
File: `src/ClawCreditUltimateV2.sol`

Implements:
- lender pool shares
- dynamic credit lines
- reputation + AI oracle underwriting
- flash loans
- x402-style auto repayment hook integration
- liquidation and insurance bucket
- isolation mode / agent whitelist

Use V2 if you need a simpler deployment footprint and faster integration.

### V3 (Agent Standard Layer)
File: `src/ClawCreditAgentStandardV3.sol`

Implements:
- tranche vaults (senior / mezz / junior)
- reinsurance pool staking
- task-backed receivable loans
- sponsor delegation with collateral backing
- underwriter marketplace (pluggable quote models)
- covenants + covenant breach reporting
- intent-bound spending (`intentHash`)
- stream repayments (earnings hook)
- passport + attestation weighted scoring
- protocol fee and underwriter liability accounting

Use V3 if your objective is "industry standard" agent credit infra.

## 3) Repository Map

- Contracts:
- `src/ClawCreditUltimateV2.sol`
- `src/ClawCreditAgentStandardV3.sol`

- Interfaces:
- `src/interfaces/IERC8004Reputation.sol`
- `src/interfaces/IX402AutoRepayHook.sol`
- `src/interfaces/IAgentUnderwriterModel.sol`
- `src/interfaces/IAgentStandard.sol`
- `src/interfaces/IClawFlashBorrower.sol`
- `src/interfaces/AggregatorV3Interface.sol`

- Mocks:
- `src/mocks/MockUSDC.sol`
- `src/mocks/MockERC8004Reputation.sol`
- `src/mocks/MockAggregator.sol`
- `src/mocks/MockX402Hook.sol`
- `src/mocks/MockUnderwriterModel.sol`
- `test/mocks/MockFlashBorrower.sol`

- Tests:
- `test/ClawCreditUltimateV2.t.sol`
- `test/ClawCreditAgentStandardV3.t.sol`

- Deployment scripts:
- `script/Deploy.s.sol` (V2)
- `script/DeployV3Standard.s.sol` (V3)

- Config/env:
- `foundry.toml`
- `.env.example`

## 4) Roles and Responsibilities

### V2 roles
- `DEFAULT_ADMIN_ROLE`: governance / timelock
- `GUARDIAN_ROLE`: pause
- `RISK_MANAGER_ROLE`: config changes
- `ORACLE_MANAGER_ROLE`: oracle/hook wiring
- `TREASURY_ROLE`: protocol fee withdrawal
- `X402_ROLE`: auto repay processing

### V3 roles
- `DEFAULT_ADMIN_ROLE`: governance / timelock
- `GUARDIAN_ROLE`: pause
- `RISK_MANAGER_ROLE`: risk/fee/oracle config
- `TREASURY_ROLE`: protocol treasury ops
- `UNDERWRITER_ADMIN_ROLE`: register/disable underwriters
- `ATTESTOR_ROLE`: submit attestations/covenant reports
- `PASSPORT_ROLE`: write passport updates
- `EARNINGS_HOOK_ROLE`: stream repay/task settlement hook
- `EXECUTOR_ROLE`: optional delegated intent executor

## 5) Environment Variables

Copy `.env.example` to `.env` and fill values.

Required:
- `PRIVATE_KEY`
- `BASE_SEPOLIA_RPC_URL`
- `BASE_MAINNET_RPC_URL`
- `USDC_ADDRESS`
- `REPUTATION_REGISTRY`
- `USDC_USD_FEED`
- `AI_SCORE_FEED`
- `GUARDIAN_ADDRESS`
- `TREASURY_ADDRESS`
- `X402_OPERATOR`
- `X402_HOOK`
- `ATTESTOR_ADDRESS`
- `PASSPORT_ORACLE_ADDRESS`
- `EARNINGS_HOOK_ADDRESS`
- `EXECUTOR_ADDRESS`
- `TIMELOCK_DELAY_SECONDS`
- `TIMELOCK_PROPOSER`
- `TIMELOCK_EXECUTOR`
- `BASESCAN_API_KEY`

## 6) Build / Test / Deploy

### Build
```bash
forge build
```

### Test
```bash
forge test -vv
```

### Deploy V2 (Base Sepolia)
```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

### Deploy V3 (Base Sepolia)
```bash
forge script script/DeployV3Standard.s.sol:DeployV3Standard \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

Repeat for mainnet by replacing RPC URL.

## 7) V3 Operational Flow (Canonical)

1. Seed liquidity in all three tranches.
2. Seed reinsurance pool.
3. Register first underwriter model.
4. Assign roles (`ATTESTOR_ROLE`, `PASSPORT_ROLE`, `EARNINGS_HOOK_ROLE`, `EXECUTOR_ROLE`).
5. Optional sponsor deposits delegation collateral and sets delegation.
6. Agent opens loan (`openRevolvingLoan`, `openTaskBackedLoan`, or `openDelegatedLoan`).
7. Agent executes only approved intent via `executeIntent`.
8. Repayment path via `repay` or `streamRepay`.
9. Covenant reports update risk and can trigger liquidation eligibility.
10. Liquidation uses waterfall: reserved credit -> sponsor collateral -> insurance -> reinsurance -> tranche loss waterfall.

## 8) Security Hardening Already Applied

- intent hash cannot be zero when opening loans
- underwriter quote constraints (confidence, max amount, APR bounds)
- protocol fee withdrawal cannot consume underwriter liabilities
- liquidation/debt math includes pending accrual and late fee components
- loop-based weighted score calculations replaced by O(1) aggregate state
- delegation lifecycle controls: revoke + prune expired delegation capacity
- liquid balance checks include tranche liabilities and all reserved pools

## 9) Known Constraints / Remaining Work

- External audit still required before mainnet scale.
- Property-based invariant tests should be expanded.
- Oracle manipulation protections can be enhanced (TWAP/median, multi-source quorum).
- Intent model currently hash-based; production can add signed intent schema and nonce replay guards per strategy.
- Some V3 economics are policy-level defaults; tune with simulation before production TVL.

## 10) Production Readiness Checklist

Before mainnet launch, Clawdbot should complete all:

- [ ] `forge build` clean
- [ ] `forge test -vv` green
- [ ] gas snapshot + regression budget for hot paths
- [ ] static analysis (Slither) no critical/high
- [ ] fuzz/invariant suite for repayments and waterfall conservation
- [ ] role assignment via timelock only
- [ ] canary deployment on Base Sepolia
- [ ] runbook rehearsal (pause, liquidation, fee withdrawal, underwriter disable)
- [ ] external audit + fix cycle

## 11) Emergency Runbook

If incident:
1. Guardian pauses protocol.
2. Freeze risky integrations (disable underwriter, isolate agents).
3. Snapshot liabilities (tranches, reserved intent, sponsor collateral, insurance/reinsurance).
4. Patch and redeploy or migrate via timelock governance.
5. Post-mortem with root cause and state reconciliation.

## 12) Handoff Instructions for Clawdbot

When Clawdbot resumes work, start with:

1. Read this README fully.
2. Inspect V3 first: `src/ClawCreditAgentStandardV3.sol`.
3. Run build/tests locally.
4. Triage remaining work from section 9 + checklist section 10.
5. Keep V2 stable, make forward features in V3 unless explicitly requested otherwise.

Recommended immediate next coding tasks:
- add invariant tests for liability conservation and withdrawal safety
- add signed-intent nonce manager
- add underwriter slashing/reputation scoring module
- add integration script for role grants + initial pool seeding

---

If you only need one contract to push as standard, use V3.
If you need minimal operational complexity, use V2.
