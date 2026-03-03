// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {AgentRegistry} from "../src/AgentRegistry.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {ReputationSystem} from "../src/ReputationSystem.sol";
import {AgentLink} from "../src/AgentLink.sol";

/**
 * @title Deploy
 * @notice Deployment script for AgentLink contracts
 * @dev Uses environment variables for configuration
 *
 * Environment Variables:
 * - PRIVATE_KEY: Deployer private key (required)
 * - BASE_SEPOLIA_RPC_URL: RPC URL for Base Sepolia (required for live deployment)
 * - VERIFY_CONTRACTS: Set to "true" to verify on Etherscan (optional)
 * - ETHERSCAN_API_KEY: API key for contract verification (optional)
 */
contract Deploy is Script {
    // Deployment configuration
    uint256 public deployerPrivateKey;
    address public deployerAddress;

    // Deployed contract addresses
    address public agentRegistry;
    address public taskManager;
    address public reputationSystem;
    address public agentLink;

    // Events for easier parsing
    event ContractDeployed(string name, address indexed addr, uint256 timestamp);

    function setUp() public {
        // Get private key from environment
        deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployerAddress = vm.addr(deployerPrivateKey);

        console2.log("Deployer Address:", deployerAddress);
        console2.log("Deployer Balance:", deployerAddress.balance);
    }

    function run() public {
        vm.startBroadcast(deployerPrivateKey);

        // Deploy contracts in order
        _deployAgentRegistry();
        _deployReputationSystem();
        _deployTaskManager();
        _deployAgentLink();

        // Setup contract relationships
        _setupContracts();

        vm.stopBroadcast();

        // Output deployment summary
        _printDeploymentSummary();

        // Save deployment info
        _saveDeployment();
    }

    function _deployAgentRegistry() internal {
        console2.log("\n=== Deploying AgentRegistry ===");

        AgentRegistry registry = new AgentRegistry();
        agentRegistry = address(registry);

        emit ContractDeployed("AgentRegistry", agentRegistry, block.timestamp);
        console2.log("AgentRegistry deployed at:", agentRegistry);
    }

    function _deployReputationSystem() internal {
        console2.log("\n=== Deploying ReputationSystem ===");

        ReputationSystem reputation = new ReputationSystem();
        reputationSystem = address(reputation);

        emit ContractDeployed("ReputationSystem", reputationSystem, block.timestamp);
        console2.log("ReputationSystem deployed at:", reputationSystem);
    }

    function _deployTaskManager() internal {
        console2.log("\n=== Deploying TaskManager ===");

        TaskManager taskMgr = new TaskManager(agentRegistry);
        taskManager = address(taskMgr);

        emit ContractDeployed("TaskManager", taskManager, block.timestamp);
        console2.log("TaskManager deployed at:", taskManager);
    }

    function _deployAgentLink() internal {
        console2.log("\n=== Deploying AgentLink ===");

        AgentLink link = new AgentLink(
            agentRegistry,
            taskManager,
            reputationSystem
        );
        agentLink = address(link);

        emit ContractDeployed("AgentLink", agentLink, block.timestamp);
        console2.log("AgentLink deployed at:", agentLink);
    }

    function _setupContracts() internal {
        console2.log("\n=== Setting up contract relationships ===");

        // Grant roles
        AgentRegistry(agentRegistry).grantRole(
            keccak256("TASK_MANAGER_ROLE"),
            taskManager
        );
        console2.log("Granted TASK_MANAGER_ROLE to TaskManager");

        AgentRegistry(agentRegistry).grantRole(
            keccak256("REPUTATION_ROLE"),
            reputationSystem
        );
        console2.log("Granted REPUTATION_ROLE to ReputationSystem");

        // Transfer ownership to AgentLink
        AgentRegistry(agentRegistry).transferOwnership(agentLink);
        console2.log("Transferred AgentRegistry ownership to AgentLink");

        ReputationSystem(reputationSystem).transferOwnership(agentLink);
        console2.log("Transferred ReputationSystem ownership to AgentLink");\n
        console2.log("Contract setup complete");
    }

    function _printDeploymentSummary() internal view {
        console2.log("\n");
        console2.log("╔══════════════════════════════════════════════════════════════╗");
        console2.log("║                 DEPLOYMENT SUMMARY                           ║");
        console2.log("╠══════════════════════════════════════════════════════════════╣");
        console2.log("║  Network:", block.chainid == 84532 ? "Base Sepolia" : "Unknown", "                                    ║");
        console2.log("║  Block Number:", block.number, "                                  ║");
        console2.log("╠══════════════════════════════════════════════════════════════╣");
        console2.log("║  AgentRegistry:    ", agentRegistry, "  ║");
        console2.log("║  ReputationSystem: ", reputationSystem, "  ║");
        console2.log("║  TaskManager:      ", taskManager, "  ║");
        console2.log("║  AgentLink:        ", agentLink, "  ║");
        console2.log("╚══════════════════════════════════════════════════════════════╝");
    }

    function _saveDeployment() internal {
        // Create deployment JSON
        string memory deploymentJson = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "blockNumber": ', vm.toString(block.number), ',\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "deployer": "', vm.toString(deployerAddress), '",\n',
            '  "contracts": {\n',
            '    "AgentRegistry": "', vm.toString(agentRegistry), '",\n',
            '    "ReputationSystem": "', vm.toString(reputationSystem), '",\n',
            '    "TaskManager": "', vm.toString(taskManager), '",\n',
            '    "AgentLink": "', vm.toString(agentLink), '"\n',
            '  }\n',
            '}'
        );

        // Write to file
        string memory filename = string.concat(
            "deployments/",
            vm.toString(block.chainid),
            "_",
            vm.toString(block.timestamp),
            ".json"
        );

        vm.writeFile(filename, deploymentJson);
        console2.log("\nDeployment info saved to:", filename);
    }
}

/**
 * @title DeployLocal
 * @notice Deployment script for local Anvil testing
 */
contract DeployLocal is Deploy {
    function setUp() public override {
        // Use default Anvil private key
        deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        deployerAddress = vm.addr(deployerPrivateKey);

        console2.log("Local Deployer Address:", deployerAddress);
    }
}

/**
 * @title UpgradeContracts
 * @notice Upgrade script for AgentLink contracts
 */
contract UpgradeContracts is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address agentLink = vm.envAddress("AGENTLINK_PROXY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        AgentLink newImplementation = new AgentLink(
            address(0), // Will be set by proxy
            address(0),
            address(0)
        );

        console2.log("New implementation deployed:", address(newImplementation));

        // Upgrade proxy (requires proxy admin)
        // ITransparentUpgradeableProxy(agentLink).upgradeTo(address(newImplementation));

        vm.stopBroadcast();
    }
}
