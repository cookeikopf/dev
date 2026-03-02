#!/bin/bash
# ClawCredit V3 Standard Production Deployment Script
# Base Mainnet - Autonomous Deployment
# Timestamp: 2026-03-03

set -e

echo "🚀 CLAWCREDIT PRODUCTION DEPLOYMENT"
echo "===================================="
echo ""

# Configuration
export PRIVATE_KEY="${PRIVATE_KEY:-YOUR_PRIVATE_KEY}"
export BASE_MAINNET_RPC="https://mainnet.base.org"
export ADMIN_ADDRESS="0xF1CB3C64439fea47Af4B62992A704F9aB6010a9d"
export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
export USDC_USD_FEED="0x7e8600986f7494b4F47BB7D9f84f11b77cDD7cF6"
export AI_SCORE_FEED="0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"
export GUARDIAN_ADDRESS="$ADMIN_ADDRESS"
export TREASURY_ADDRESS="$ADMIN_ADDRESS"

# Verify balance
echo "Step 0: Verifying wallet balance..."
BALANCE=$(cast balance $ADMIN_ADDRESS --rpc-url $BASE_MAINNET_RPC)
if [ "$BALANCE" -lt 1000000000000000 ]; then
    echo "❌ Insufficient ETH balance. Need at least 0.001 ETH"
    exit 1
fi
echo "✅ Balance: $(cast balance $ADMIN_ADDRESS --rpc-url $BASE_MAINNET_RPC | cast to-fixed-point 18) ETH"
echo ""

# Step 1: Deploy ERC8004ReputationRegistry
echo "Step 1: Deploying ERC8004ReputationRegistry..."
REPUTATION_REGISTRY=$(forge create src/ERC8004ReputationRegistry.sol:ERC8004ReputationRegistry \
    --rpc-url $BASE_MAINNET_RPC \
    --private-key $PRIVATE_KEY \
    --constructor-args $ADMIN_ADDRESS \
    --broadcast \
    --via-ir 2>/dev/null | grep "Deployed to" | awk '{print $3}')

if [ -z "$REPUTATION_REGISTRY" ]; then
    echo "❌ Failed to deploy ReputationRegistry"
    exit 1
fi
echo "✅ ReputationRegistry: $REPUTATION_REGISTRY"
echo ""

# Step 2: Deploy AIPerformanceOracle
echo "Step 2: Deploying AIPerformanceOracle..."
AI_ORACLE=$(forge create src/AIPerformanceOracle.sol:AIPerformanceOracle \
    --rpc-url $BASE_MAINNET_RPC \
    --private-key $PRIVATE_KEY \
    --constructor-args $ADMIN_ADDRESS \
    --broadcast \
    --via-ir 2>/dev/null | grep "Deployed to" | awk '{print $3}')

if [ -z "$AI_ORACLE" ]; then
    echo "❌ Failed to deploy AIPerformanceOracle"
    exit 1
fi
echo "✅ AIPerformanceOracle: $AI_ORACLE"
echo ""

# Step 3: Deploy X402PaymentProcessor (placeholder pool address)
echo "Step 3: Deploying X402PaymentProcessor..."
X402_PROCESSOR=$(forge create src/X402PaymentProcessor.sol:X402PaymentProcessor \
    --rpc-url $BASE_MAINNET_RPC \
    --private-key $PRIVATE_KEY \
    --constructor-args $USDC_ADDRESS $ADMIN_ADDRESS $ADMIN_ADDRESS \
    --broadcast \
    --via-ir 2>/dev/null | grep "Deployed to" | awk '{print $3}')

if [ -z "$X402_PROCESSOR" ]; then
    echo "❌ Failed to deploy X402PaymentProcessor"
    exit 1
fi
echo "✅ X402PaymentProcessor: $X402_PROCESSOR"
echo ""

# Step 4: Deploy ClawCreditAgentStandardV3
echo "Step 4: Deploying ClawCreditAgentStandardV3 (MAIN CONTRACT)..."
CLAWCREDIT_STANDARD_V3=$(forge create src/ClawCreditAgentStandardV3.sol:ClawCreditAgentStandardV3 \
    --rpc-url $BASE_MAINNET_RPC \
    --private-key $PRIVATE_KEY \
    --constructor-args \
        $ADMIN_ADDRESS \
        $GUARDIAN_ADDRESS \
        $TREASURY_ADDRESS \
        $USDC_ADDRESS \
        $REPUTATION_REGISTRY \
        $USDC_USD_FEED \
        $AI_SCORE_FEED \
    --broadcast \
    --via-ir 2>/dev/null | grep "Deployed to" | awk '{print $3}')

if [ -z "$CLAWCREDIT_STANDARD_V3" ]; then
    echo "❌ Failed to deploy ClawCreditAgentStandardV3"
    exit 1
fi
echo "✅ ClawCreditAgentStandardV3: $CLAWCREDIT_STANDARD_V3"
echo ""

# Step 5: Update X402 with real pool address
echo "Step 5: Updating X402PaymentProcessor with pool address..."
cast send $X402_PROCESSOR \
    "setClawCreditPool(address)" \
    $CLAWCREDIT_STANDARD_V3 \
    --rpc-url $BASE_MAINNET_RPC \
    --private-key $PRIVATE_KEY

echo "✅ X402 processor configured"
echo ""

# Step 6: Authorize contracts
echo "Step 6: Authorizing contracts..."
cast send $REPUTATION_REGISTRY \
    "authorizeContract(address)" \
    $CLAWCREDIT_STANDARD_V3 \
    --rpc-url $BASE_MAINNET_RPC \
    --private-key $PRIVATE_KEY

echo "✅ Contracts authorized"
echo ""

# Step 7: Verify contracts
echo "Step 7: Verifying contracts on BaseScan..."
forge verify-contract $REPUTATION_REGISTRY src/ERC8004ReputationRegistry.sol:ERC8004ReputationRegistry --chain-id 8453 --watch &
forge verify-contract $AI_ORACLE src/AIPerformanceOracle.sol:AIPerformanceOracle --chain-id 8453 --watch &
forge verify-contract $X402_PROCESSOR src/X402PaymentProcessor.sol:X402PaymentProcessor --chain-id 8453 --watch &
forge verify-contract $CLAWCREDIT_STANDARD_V3 src/ClawCreditAgentStandardV3.sol:ClawCreditAgentStandardV3 --chain-id 8453 --watch &

echo "✅ Verification submitted (async)"
echo ""

# Summary
echo "===================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "===================================="
echo ""
echo "Contract Addresses:"
echo "-------------------"
echo "ERC8004ReputationRegistry: $REPUTATION_REGISTRY"
echo "AIPerformanceOracle:        $AI_ORACLE"
echo "X402PaymentProcessor:       $X402_PROCESSOR"
echo "ClawCreditAgentStandardV3:       $CLAWCREDIT_STANDARD_V3"
echo ""
echo "Next Steps:"
echo "1. Fund pool with 150 USDC"
echo "2. Test first loan"
echo "3. Launch marketing"
echo "4. Monitor metrics"
echo ""
echo "BaseScan URLs:"
echo "https://basescan.org/address/$CLAWCREDIT_STANDARD_V3"
echo ""
