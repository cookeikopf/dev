# AgentLink Smart Contracts

Secure smart contracts for the AgentLink protocol on Base.

## Contracts

### PaymentRouter.sol

USDC micropayment router with fee splitting.

**Features:**
- USDC micropayments with configurable fee
- Fee splitting between receiver and treasury
- Gasless payments via EIP-2612 permit
- Receiver allowlist support
- Pausable for emergencies
- Comprehensive events

**Key Functions:**
- `pay(receiver, amount, memo)` - Route payment with fee
- `payWithPermit(...)` - Gasless payment using permit
- `setFeeBps(feeBps)` - Update fee (owner only, max 10%)
- `setTreasury(treasury)` - Update treasury (owner only)
- `pause()` / `unpause()` - Emergency controls

### AgentIdentity.sol

ERC-721 identity NFT with ERC-8004 compatibility.

**Features:**
- One identity per address
- Agent metadata (name, endpoint, capabilities)
- Verifiable credentials support
- ERC-8004 DID compatibility
- Supply cap (100,000)
- Pausable minting

**Key Functions:**
- `mint(to, name, endpoint, capabilities, uri)` - Mint identity
- `updateMetadata(...)` - Update agent info
- `addCredential(tokenId, credentialHash)` - Add credential
- `didDocumentURI(tokenId)` - Get DID document URI
- `verifyCredential(tokenId, credentialHash)` - Verify credential

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Node.js](https://nodejs.org/) (optional, for verification)

### Install Dependencies

```bash
# Install OpenZeppelin contracts
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0

# Install Forge Standard Library (if not included)
forge install foundry-rs/forge-std
```

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test

# Run with gas report
forge test --gas-report

# Run with coverage
forge coverage

# Run invariant tests
forge test --match-contract Invariants
```

### Deploy

#### Local Testing

```bash
# Start local node
anvil

# Deploy locally
forge script script/DeployFullProtocol.s.sol:DeployFullProtocolLocal \
  --fork-url http://localhost:8545 \
  --private-key $PRIVATE_KEY \
  --broadcast
```

#### Base Sepolia Testnet

```bash
# Set environment variables
export PRIVATE_KEY="your_private_key"
export OWNER_ADDRESS="your_owner_address"
export TREASURY_ADDRESS="your_treasury_address"
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
export BASESCAN_API_KEY="your_basescan_api_key"

# Deploy
forge script script/DeployFullProtocol.s.sol:DeployFullProtocol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

#### Base Mainnet

```bash
# Set environment variables
export BASE_RPC_URL="https://mainnet.base.org"

# Deploy (remove --broadcast for dry run)
forge script script/DeployFullProtocol.s.sol:DeployFullProtocol \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

## Contract Verification

### After Deployment

```bash
# Verify PaymentRouter
forge verify-contract \
  <CONTRACT_ADDRESS> \
  src/PaymentRouter.sol:PaymentRouter \
  --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(address,address,uint256,address)" \
    0x036CbD53842c5426634e7929541eC2318f3dCF7e \
    <TREASURY_ADDRESS> \
    100 \
    <OWNER_ADDRESS>)

# Verify AgentIdentity
forge verify-contract \
  <CONTRACT_ADDRESS> \
  src/AgentIdentity.sol:AgentIdentity \
  --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(string,string,string,address)" \
    "AgentLink Identity" \
    "ALI" \
    "https://api.agentlink.io/metadata/" \
    <OWNER_ADDRESS>)
```

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# Required for deployment
PRIVATE_KEY="your_private_key"
OWNER_ADDRESS="your_owner_address"
TREASURY_ADDRESS="your_treasury_address"

# RPC URLs
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
BASE_RPC_URL="https://mainnet.base.org"

# Verification
BASESCAN_API_KEY="your_basescan_api_key"
```

### Foundry Configuration

See `foundry.toml` for compiler settings:
- Solidity 0.8.23
- Optimizer enabled (200 runs)
- IR-based optimizer (via_ir)

## Testing

### Unit Tests

```bash
# Run PaymentRouter tests
forge test --match-contract PaymentRouterTest

# Run AgentIdentity tests
forge test --match-contract AgentIdentityTest
```

### Invariant Tests

```bash
# Run all invariant tests
forge test --match-contract Invariants

# Run with more fuzz runs
FOUNDRY_INVARIANT_RUNS=1000 forge test --match-contract Invariants
```

### Coverage Report

```bash
# Generate coverage report
forge coverage --report lcov

# View in browser (with genhtml)
genhtml lcov.info -o coverage-report
open coverage-report/index.html
```

## Project Structure

```
.
├── src/
│   ├── PaymentRouter.sol      # Payment routing contract
│   └── AgentIdentity.sol      # Identity NFT contract
├── test/
│   ├── PaymentRouter.t.sol    # PaymentRouter tests
│   ├── AgentIdentity.t.sol    # AgentIdentity tests
│   └── invariants/
│       ├── PaymentRouterInvariants.t.sol
│       └── AgentIdentityInvariants.t.sol
├── script/
│   ├── DeployPaymentRouter.s.sol
│   └── DeployAgentIdentity.s.sol
├── foundry.toml               # Foundry configuration
├── remappings.txt             # Import remappings
└── README.md                  # This file
```

## Security

See [SECURITY.md](SECURITY.md) for:
- Security features
- Risk assessment
- Audit checklist
- Incident response
- Bug bounty program

## Gas Optimization

### PaymentRouter

| Function | Gas (avg) |
|----------|-----------|
| pay | ~75,000 |
| payWithPermit | ~85,000 |
| setFeeBps | ~25,000 |
| setTreasury | ~25,000 |

### AgentIdentity

| Function | Gas (avg) |
|----------|-----------|
| mint | ~180,000 |
| updateMetadata | ~35,000 |
| addCredential | ~30,000 |

## Addresses

### Base Sepolia (Testnet)

| Contract | Address |
|----------|---------|
| USDC | 0x036CbD53842c5426634e7929541eC2318f3dCF7e |
| PaymentRouter | TBD |
| AgentIdentity | TBD |

### Base (Mainnet)

| Contract | Address |
|----------|---------|
| USDC | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| PaymentRouter | TBD |
| AgentIdentity | TBD |

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests and ensure coverage
4. Submit a pull request

## Support

- Documentation: https://docs.agentlink.io
- Discord: https://discord.gg/agentlink
- Twitter: https://twitter.com/agentlink
- Email: support@agentlink.io
