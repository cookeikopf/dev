# AgentLink Smart Contracts Makefile

.PHONY: help install build test coverage clean deploy-local deploy-testnet deploy-mainnet verify

# Default target
help:
	@echo "AgentLink Smart Contracts"
	@echo ""
	@echo "Available commands:"
	@echo "  make install          - Install dependencies"
	@echo "  make build            - Build contracts"
	@echo "  make test             - Run all tests"
	@echo "  make test-coverage    - Run tests with coverage"
	@echo "  make test-invariant   - Run invariant tests"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make deploy-local     - Deploy to local network"
	@echo "  make deploy-testnet   - Deploy to Base Sepolia"
	@echo "  make verify           - Verify contracts on BaseScan"

# Install dependencies
install:
	forge install OpenZeppelin/openzeppelin-contracts@v5.0.0 --no-commit
	forge install foundry-rs/forge-std --no-commit

# Build contracts
build:
	forge build

# Run all tests
test:
	forge test -vvv

# Run tests with gas report
test-gas:
	forge test --gas-report

# Run tests with coverage
test-coverage:
	forge coverage

# Run invariant tests
test-invariant:
	forge test --match-contract Invariants -vvv

# Clean build artifacts
clean:
	forge clean
	rm -rf cache out coverage-report lcov.info

# Format code
fmt:
	forge fmt

# Check formatting
fmt-check:
	forge fmt --check

# Run static analysis with Slither (requires slither to be installed)
analyze:
	slither src/PaymentRouter.sol
	slither src/AgentIdentity.sol

# Deploy to local network (requires anvil running)
deploy-local:
	forge script script/DeployFullProtocol.s.sol:DeployFullProtocolLocal \
		--fork-url http://localhost:8545 \
		--private-key $(PRIVATE_KEY) \
		--broadcast

# Deploy to Base Sepolia testnet
deploy-testnet:
	forge script script/DeployFullProtocol.s.sol:DeployFullProtocol \
		--rpc-url $(BASE_SEPOLIA_RPC_URL) \
		--private-key $(PRIVATE_KEY) \
		--broadcast \
		--verify

# Deploy to Base mainnet
deploy-mainnet:
	forge script script/DeployFullProtocol.s.sol:DeployFullProtocol \
		--rpc-url $(BASE_RPC_URL) \
		--private-key $(PRIVATE_KEY) \
		--broadcast \
		--verify

# Verify contracts (after deployment)
verify-payment-router:
	forge verify-contract \
		$(PAYMENT_ROUTER_ADDRESS) \
		src/PaymentRouter.sol:PaymentRouter \
		--chain base-sepolia \
		--constructor-args $(shell cast abi-encode "constructor(address,address,uint256,address)" $(USDC_ADDRESS) $(TREASURY_ADDRESS) 100 $(OWNER_ADDRESS))

verify-agent-identity:
	forge verify-contract \
		$(AGENT_IDENTITY_ADDRESS) \
		src/AgentIdentity.sol:AgentIdentity \
		--chain base-sepolia \
		--constructor-args $(shell cast abi-encode "constructor(string,string,string,address)" "AgentLink Identity" "ALI" "https://api.agentlink.io/metadata/" $(OWNER_ADDRESS))

# Generate documentation
docs:
	forge doc

# Snapshot gas usage
snapshot:
	forge snapshot

# Compare gas usage
gas-compare:
	forge snapshot --diff

# Run all checks before deployment
check: fmt-check build test test-coverage
	@echo "All checks passed!"

# Full deployment workflow for testnet
deploy-testnet-full: check deploy-testnet
	@echo "Testnet deployment complete!"

# Full deployment workflow for mainnet
deploy-mainnet-full: check deploy-mainnet
	@echo "Mainnet deployment complete!"
