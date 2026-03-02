# ClawCredit Project Handoff (for Clawdbot)

This repository contains Solidity protocol code, frontend surfaces, and supporting content for ClawCredit.

## Repository Layout

- `clawcredit-contracts/`
  - Foundry project with core protocol contracts, tests, deployment scripts.
  - Primary contracts:
    - `src/ClawCreditUltimateV2.sol` (lean lending core)
    - `src/ClawCreditAgentStandardV3.sol` (expanded agent credit standard)
- `clawcredit-frontend/`
  - Static frontend pages:
    - `index.html` (main app UI wired to `ClawCreditUltimateV2` ABI)
    - `refer.html` (referral/growth page)
- `clawcredit-content/`, `clawcredit-improvements/`
  - Supporting docs/content from prior iterations.

## Current Frontend Status

The frontend was fully redesigned to a non-generic premium DeFi style (Apple-inspired clean glass aesthetic) and aligned to **current V2 contract functions**.

Main interaction coverage in `clawcredit-frontend/index.html`:

- Wallet connect + Base chain switching
- Configurable network profile (Base Mainnet / Base Sepolia)
- Configurable contract addresses (pool + USDC) via localStorage
- Protocol metrics:
  - `availableLiquidity`
  - `lenderAssets`
  - `totalOutstandingPrincipal`
  - `insurancePool`
  - `protocolFees`
- Agent-specific metrics:
  - `previewCreditLine`
  - `getAgentLoanIds`
  - `loans(id)`
  - `getCurrentDebt(id)`
  - `isLiquidatable(id)`
  - reputation + AI oracle feed display
- Transactions:
  - `refreshCreditLine`
  - `drawCreditLine`
  - `repay`
  - `deposit`
  - `withdraw`
  - `topUpInsurance`
- USDC approval handling (`approve`) before actions that need transferFrom

## Important Operational Notes

- Default mainnet pool address in frontend config is legacy and should be validated/overridden after each deployment.
- Base Sepolia pool address is intentionally blank by default until you deploy and set it.
- Frontend assumes ERC-20 USDC decimals from on-chain call (`decimals()`) and defaults to 6 only if call fails.

## Quick Start

### Contracts

```bash
cd clawcredit-contracts
forge build
forge test -vv
```

### Frontend

Serve `clawcredit-frontend/` with any static server.

Example (Node):

```bash
cd clawcredit-frontend
npx serve .
```

Then open `index.html` and set pool/USDC addresses in **Config**.

## Handoff Priority for Clawdbot

1. Validate deployed addresses and update frontend defaults.
2. Run full Foundry tests before production deployment.
3. Verify role assignments + timelock ownership after deploy.
4. Add subgraph/indexer integration for richer frontend analytics.

