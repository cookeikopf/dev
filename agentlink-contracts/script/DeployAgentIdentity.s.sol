// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";

/**
 * @title DeployAgentIdentity
 * @notice Deployment script for AgentIdentity contract
 * @dev Deploys to Base Sepolia testnet
 */
contract DeployAgentIdentity is Script {
    // Token configuration
    string public constant TOKEN_NAME = "AgentLink Identity";
    string public constant TOKEN_SYMBOL = "ALI";
    string public constant BASE_URI = "https://api.agentlink.io/metadata/";

    function run() external returns (AgentIdentity identity) {
        // Get deployment parameters from environment
        address owner = vm.envAddress("OWNER_ADDRESS");

        require(owner != address(0), "OWNER_ADDRESS not set");

        console2.log("Deploying AgentIdentity...");
        console2.log("  Name:", TOKEN_NAME);
        console2.log("  Symbol:", TOKEN_SYMBOL);
        console2.log("  Base URI:", BASE_URI);
        console2.log("  Owner:", owner);

        vm.startBroadcast();

        identity = new AgentIdentity(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            BASE_URI,
            owner
        );

        vm.stopBroadcast();

        console2.log("AgentIdentity deployed at:", address(identity));

        // Log deployment info for verification
        console2.log("\n=== Verification Command ===");
        console2.log(
            string.concat(
                "forge verify-contract ",
                vm.toString(address(identity)),
                " src/AgentIdentity.sol:AgentIdentity ",
                "--chain base-sepolia ",
                "--constructor-args ",
                vm.toString(abi.encode(TOKEN_NAME, TOKEN_SYMBOL, BASE_URI, owner))
            )
        );

        return identity;
    }
}

/**
 * @title DeployAgentIdentityLocal
 * @notice Local deployment script for testing
 */
contract DeployAgentIdentityLocal is Script {
    function run() external returns (AgentIdentity identity) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deploying to local network...");
        console2.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        identity = new AgentIdentity(
            "AgentLink Identity",
            "ALI",
            "https://api.agentlink.io/metadata/",
            deployer
        );

        vm.stopBroadcast();

        console2.log("AgentIdentity deployed at:", address(identity));

        return identity;
    }
}

/**
 * @title DeployFullProtocol
 * @notice Deploys both contracts together
 */
contract DeployFullProtocol is Script {
    // Base Sepolia USDC address
    address public constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // Configuration
    uint256 public constant INITIAL_FEE_BPS = 100; // 1%
    string public constant TOKEN_NAME = "AgentLink Identity";
    string public constant TOKEN_SYMBOL = "ALI";
    string public constant BASE_URI = "https://api.agentlink.io/metadata/";

    struct DeploymentResult {
        address paymentRouter;
        address agentIdentity;
        address usdc;
    }

    function run() external returns (DeploymentResult memory result) {
        // Get deployment parameters from environment
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address owner = vm.envAddress("OWNER_ADDRESS");

        require(treasury != address(0), "TREASURY_ADDRESS not set");
        require(owner != address(0), "OWNER_ADDRESS not set");

        console2.log("=== Deploying AgentLink Protocol ===");
        console2.log("Network: Base Sepolia");
        console2.log("Owner:", owner);
        console2.log("Treasury:", treasury);
        console2.log("");

        vm.startBroadcast();

        // Deploy PaymentRouter
        console2.log("Deploying PaymentRouter...");
        PaymentRouter router = new PaymentRouter(
            USDC_BASE_SEPOLIA,
            treasury,
            INITIAL_FEE_BPS,
            owner
        );
        result.paymentRouter = address(router);
        console2.log("PaymentRouter deployed at:", result.paymentRouter);

        // Deploy AgentIdentity
        console2.log("Deploying AgentIdentity...");
        AgentIdentity identity = new AgentIdentity(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            BASE_URI,
            owner
        );
        result.agentIdentity = address(identity);
        console2.log("AgentIdentity deployed at:", result.agentIdentity);

        result.usdc = USDC_BASE_SEPOLIA;

        vm.stopBroadcast();

        // Log deployment summary
        console2.log("");
        console2.log("=== Deployment Summary ===");
        console2.log("USDC:", result.usdc);
        console2.log("PaymentRouter:", result.paymentRouter);
        console2.log("AgentIdentity:", result.agentIdentity);
        console2.log("");
        console2.log("=== Verification Commands ===");
        console2.log("PaymentRouter:");
        console2.log(
            string.concat(
                "  forge verify-contract ",
                vm.toString(result.paymentRouter),
                " src/PaymentRouter.sol:PaymentRouter ",
                "--chain base-sepolia"
            )
        );
        console2.log("AgentIdentity:");
        console2.log(
            string.concat(
                "  forge verify-contract ",
                vm.toString(result.agentIdentity),
                " src/AgentIdentity.sol:AgentIdentity ",
                "--chain base-sepolia"
            )
        );

        return result;
    }
}

// Import for full protocol deployment
import {PaymentRouter} from "../src/PaymentRouter.sol";
