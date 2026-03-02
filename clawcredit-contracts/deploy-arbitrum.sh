#!/bin/bash
# ClawCredit Arbitrum Deployment Script
# Autonomous Cross-Chain Expansion

set -e

echo "🚀 DEPLOYING CLAWCREDIT TO ARBITRUM ONE"
echo "========================================"
echo ""

# Arbitrum Configuration
export CHAIN="arbitrum"
export RPC_URL="https://arb1.arbitrum.io/rpc"
export CHAIN_ID=42161
export ADMIN_ADDRESS="0xF1CB3C64439fea47Af4B62992A704F9aB6010a9d"

# Arbitrum Contract Addresses
export USDC="0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
export ETH_USD_FEED="0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612"

# Verify balance
echo "Step 0: Checking Arbitrum ETH balance..."
BALANCE=$(cast balance $ADMIN_ADDRESS --rpc-url $RPC_URL)
if [ "$BALANCE" -lt 1000000000000000 ]; then
    echo "❌ Insufficient ETH on Arbitrum. Need at least 0.001 ETH"
    echo "Bridge ETH from Ethereum mainnet: https://bridge.arbitrum.io"
    exit 1
fi
echo "✅ Balance: $(cast balance $ADMIN_ADDRESS --rpc-url $RPC_URL | cast to-fixed-point 18) ETH"
echo ""

# Step 1: Deploy Reputation Registry
echo "Step 1: Deploying ERC8004ReputationRegistry..."
REPUTATION_REGISTRY=$(forge create src/ERC8004ReputationRegistry.sol:ERC8004ReputationRegistry \
    --rpc-url $RPC_URL \
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

# Step 2: Deploy AI Oracle
echo "Step 2: Deploying AIPerformanceOracle..."
AI_ORACLE=$(forge create src/AIPerformanceOracle.sol:AIPerformanceOracle \
    --rpc-url $RPC_URL \
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

# Step 3: Deploy X402 Processor
echo "Step 3: Deploying X402PaymentProcessor..."
X402_PROCESSOR=$(forge create src/X402PaymentProcessor.sol:X402PaymentProcessor \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args $USDC $ADMIN_ADDRESS $ADMIN_ADDRESS \
    --broadcast \
    --via-ir 2>/dev/null | grep "Deployed to" | awk '{print $3}')

if [ -z "$X402_PROCESSOR" ]; then
    echo "❌ Failed to deploy X402PaymentProcessor"
    exit 1
fi
echo "✅ X402PaymentProcessor: $X402_PROCESSOR"
echo ""

# Step 4: Deploy Main Pool
echo "Step 4: Deploying ClawCreditUltimateV3..."
CLAWCREDIT_V3=$(forge create src/ClawCreditUltimateV3.sol:ClawCreditUltimateV3 \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args \
        $ADMIN_ADDRESS \
        $ADMIN_ADDRESS \
        $ADMIN_ADDRESS \
        $USDC \
        $REPUTATION_REGISTRY \
        $X402_PROCESSOR \
        $ETH_USD_FEED \
    --broadcast \
    --via-ir 2>/dev/null | grep "Deployed to" | awk '{print $3}')

if [ -z "$CLAWCREDIT_V3" ]; then
    echo "❌ Failed to deploy ClawCreditUltimateV3"
    exit 1
fi
echo "✅ ClawCreditUltimateV3: $CLAWCREDIT_V3"
echo ""

# Step 5: Configure
echo "Step 5: Configuring contracts..."
cast send $X402_PROCESSOR "setClawCreditPool(address)" $CLAWCREDIT_V3 --rpc-url $RPC_URL --private-key $PRIVATE_KEY
cast send $REPUTATION_REGISTRY "authorizeContract(address)" $CLAWCREDIT_V3 --rpc-url $RPC_URL --private-key $PRIVATE_KEY
echo "✅ Configuration complete"
echo ""

# Summary
echo "========================================"
echo "🎉 ARBITRUM DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "Contract Addresses:"
echo "-------------------"
echo "ERC8004ReputationRegistry: $REPUTATION_REGISTRY"
echo "AIPerformanceOracle:        $AI_ORACLE"
echo "X402PaymentProcessor:       $X402_PROCESSOR"
echo "ClawCreditUltimateV3:       $CLAWCREDIT_V3"
echo ""
echo "Arbiscan URLs:"
echo "https://arbiscan.io/address/$CLAWCREDIT_V3"
echo ""
echo "Next Steps:"
echo "1. Fund pool with USDC (Arbitrum bridge: https://bridge.arbitrum.io)"
echo "2. Verify contracts on Arbiscan"
echo "3. Launch marketing for Arbitrum agents"
echo "4. Monitor metrics"
echo ""
