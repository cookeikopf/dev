# ClawCredit Frontend README

This folder contains the production-ready static frontend for ClawCredit.

## Files

- `index.html`
  - Main protocol UI for `ClawCreditUltimateV2`
  - Includes custom design system, wallet integration, and tx flows
- `refer.html`
  - Referral/growth page with wallet-based referral link generation

## Supported Networks

Configured in-app via `NETWORKS`:

- Base Mainnet (chainId `8453` / `0x2105`)
- Base Sepolia (chainId `84532` / `0x14A34`)

Config can be overridden from the UI and is persisted in localStorage per network.

## Contract Interface Used

`index.html` uses these V2 functions:

- Reads:
  - `availableLiquidity()`
  - `lenderAssets()`
  - `totalOutstandingPrincipal()`
  - `insurancePool()`
  - `protocolFees()`
  - `nextLoanId()`
  - `lenderShares(address)`
  - `previewCreditLine(address)`
  - `getAgentLoanIds(address)`
  - `getCurrentDebt(uint256)`
  - `isLiquidatable(uint256)`
  - `loans(uint256)`
  - `reputationRegistry()`
  - `aiPerformanceFeed()`
- Writes:
  - `refreshCreditLine(address)`
  - `drawCreditLine(uint256,uint256,uint32)`
  - `repay(uint256,uint256)`
  - `deposit(uint256)`
  - `withdraw(uint256)`
  - `topUpInsurance(uint256)`

USDC interactions:

- `balanceOf`
- `allowance`
- `approve`
- `decimals`

## Run Locally

Any static server works.

```bash
cd clawcredit-frontend
npx serve .
```

Open `index.html`, then:

1. Click `Config`
2. Select network
3. Set deployed pool and USDC addresses
4. Save config
5. Connect wallet

## UX/Design Direction

- Apple-inspired clarity with DeFi-native telemetry
- Non-generic visuals:
  - custom typography (Sora + Plus Jakarta Sans)
  - layered gradients and glass surfaces
  - dense but readable control panels
- Mobile + desktop responsive layout

## Next Frontend Enhancements

- Add event-indexed transaction/activity feed
- Integrate historical charts (liquidity, defaults, repayments)
- Add contract health alerts from oracle heartbeat + risk thresholds

