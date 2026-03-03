#!/bin/bash

# AgentLink Contract Deployment Script
# Usage: ./deploy-contracts.sh [network] [options]
#
# Networks:
#   local       - Deploy to local Anvil node (default)
#   base-sepolia - Deploy to Base Sepolia testnet
#   base-mainnet - Deploy to Base mainnet
#
# Options:
#   --verify    - Verify contracts on Etherscan after deployment
#   --dry-run   - Simulate deployment without broadcasting
#   --fork      - Fork from live network for testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
NETWORK="local"
VERIFY=false
DRY_RUN=false
FORK=false
RPC_URL=""
CHAIN_ID=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        local|base-sepolia|base-mainnet)
            NETWORK="$1"
            shift
            ;;
        --verify)
            VERIFY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --fork)
            FORK=true
            shift
            ;;
        --rpc-url)
            RPC_URL="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: ./deploy-contracts.sh [network] [options]"
            echo ""
            echo "Networks:"
            echo "  local         Deploy to local Anvil node (default)"
            echo "  base-sepolia  Deploy to Base Sepolia testnet"
            echo "  base-mainnet  Deploy to Base mainnet"
            echo ""
            echo "Options:"
            echo "  --verify      Verify contracts on Etherscan"
            echo "  --dry-run     Simulate deployment without broadcasting"
            echo "  --fork        Fork from live network"
            echo "  --rpc-url     Custom RPC URL"
            echo "  --help, -h    Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Set network-specific values
case $NETWORK in
    local)
        RPC_URL="${RPC_URL:-http://localhost:8545}"
        CHAIN_ID="31337"
        ;;
    base-sepolia)
        RPC_URL="${RPC_URL:-$BASE_SEPOLIA_RPC_URL}"
        CHAIN_ID="84532"
        if [ -z "$RPC_URL" ]; then
            echo -e "${RED}Error: BASE_SEPOLIA_RPC_URL not set${NC}"
            exit 1
        fi
        ;;
    base-mainnet)
        RPC_URL="${RPC_URL:-$BASE_MAINNET_RPC_URL}"
        CHAIN_ID="8453"
        if [ -z "$RPC_URL" ]; then
            echo -e "${RED}Error: BASE_MAINNET_RPC_URL not set${NC}"
            exit 1
        fi
        ;;
esac

# Check required environment variables
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: PRIVATE_KEY not set${NC}"
    exit 1
fi

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              AgentLink Contract Deployment                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Network:${NC} $NETWORK"
echo -e "${YELLOW}RPC URL:${NC} $RPC_URL"
echo -e "${YELLOW}Chain ID:${NC} $CHAIN_ID"
echo -e "${YELLOW}Verify:${NC} $VERIFY"
echo -e "${YELLOW}Dry Run:${NC} $DRY_RUN"
echo ""

# Change to contracts directory
cd packages/contracts

# Create deployments directory if it doesn't exist
mkdir -p deployments

# Build contracts first
echo -e "${BLUE}Building contracts...${NC}"
forge build --sizes

# Set broadcast flag
BROADCAST_FLAG=""
if [ "$DRY_RUN" = false ]; then
    BROADCAST_FLAG="--broadcast"
fi

# Set verify flag
VERIFY_FLAG=""
if [ "$VERIFY" = true ] && [ "$NETWORK" != "local" ]; then
    if [ -z "$ETHERSCAN_API_KEY" ]; then
        echo -e "${YELLOW}Warning: ETHERSCAN_API_KEY not set, skipping verification${NC}"
    else
        VERIFY_FLAG="--verify"
    fi
fi

# Set fork flag
FORK_FLAG=""
if [ "$FORK" = true ]; then
    FORK_FLAG="--fork-url $RPC_URL"
fi

# Run deployment
echo -e "${BLUE}Running deployment...${NC}"
echo ""

if [ "$NETWORK" = "local" ]; then
    # Local deployment uses DeployLocal script
    forge script script/Deploy.s.sol:DeployLocal \
        --rpc-url $RPC_URL \
        $BROADCAST_FLAG \
        $VERIFY_FLAG \
        -vvvv
else
    # Live deployment uses Deploy script
    forge script script/Deploy.s.sol:Deploy \
        --rpc-url $RPC_URL \
        $BROADCAST_FLAG \
        $VERIFY_FLAG \
        --slow \
        -vvvv
fi

# Check deployment result
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    
    # Find and display the latest deployment file
    LATEST_DEPLOYMENT=$(ls -t deployments/${CHAIN_ID}_*.json 2>/dev/null | head -1)
    if [ -n "$LATEST_DEPLOYMENT" ]; then
        echo ""
        echo -e "${BLUE}Deployment details saved to:${NC} $LATEST_DEPLOYMENT"
        echo ""
        cat "$LATEST_DEPLOYMENT"
    fi
    
    # Display broadcast file location
    BROADCAST_FILE="broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json"
    if [ -f "$BROADCAST_FILE" ]; then
        echo ""
        echo -e "${BLUE}Broadcast file:${NC} $BROADCAST_FILE"
    fi
else
    echo ""
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi
