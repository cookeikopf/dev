#!/bin/bash
# ClawCredit production deployment (V3 standard only)

set -euo pipefail

echo "🚀 Deploying ClawCredit V3 Standard to Base Mainnet"

: "${BASE_MAINNET_RPC_URL:?Set BASE_MAINNET_RPC_URL}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY}"
: "${USDC_ADDRESS:?Set USDC_ADDRESS}"
: "${REPUTATION_REGISTRY:?Set REPUTATION_REGISTRY}"
: "${USDC_USD_FEED:?Set USDC_USD_FEED}"
: "${AI_SCORE_FEED:?Set AI_SCORE_FEED}"
: "${GUARDIAN_ADDRESS:?Set GUARDIAN_ADDRESS}"
: "${TREASURY_ADDRESS:?Set TREASURY_ADDRESS}"

forge script script/DeployV3Standard.s.sol:DeployV3Standard \
  --rpc-url "$BASE_MAINNET_RPC_URL" \
  --broadcast

echo "✅ Deployment submitted via DeployV3Standard.s.sol"
