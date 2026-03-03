// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {ClawCreditAgentStandardV3} from "../src/ClawCreditAgentStandardV3.sol";
import {ERC8004ReputationRegistry} from "../src/ERC8004ReputationRegistry.sol";
import {AIPerformanceOracle} from "../src/AIPerformanceOracle.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";

/// @title DeployV3StandardWithMocks
/// @notice Deploy complete ClawCredit ecosystem with mocks on Base Sepolia
contract DeployV3StandardWithMocks is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        // Admin addresses (using deployer for simplicity on testnet)
        address guardian = deployer;
        address treasury = deployer;
        address admin = deployer;

        vm.startBroadcast(deployerPk);

        console2.log("========================================");
        console2.log("DEPLOYING CLAWCREDIT V3 TO BASE SEPOLIA");
        console2.log("========================================");
        console2.log("Deployer:", deployer);

        // 1. Deploy Mock USDC
        MockUSDC usdc = new MockUSDC();
        console2.log("1. MockUSDC:", address(usdc));

        // 2. Deploy Mock Price Feeds
        MockAggregator usdcFeed = new MockAggregator(8, 1e8); // $1.00
        MockAggregator aiFeed = new MockAggregator(8, 7500e4); // 7500 = 75% score
        console2.log("2. MockUSDCFeed:", address(usdcFeed));
        console2.log("3. MockAIFeed:", address(aiFeed));

        // 3. Deploy Reputation Registry
        ERC8004ReputationRegistry reputation = new ERC8004ReputationRegistry(admin);
        console2.log("4. ReputationRegistry:", address(reputation));

        // 4. Deploy AI Performance Oracle
        AIPerformanceOracle aiOracle = new AIPerformanceOracle(admin);
        console2.log("5. AIPerformanceOracle:", address(aiOracle));

        // 5. Deploy Timelock (2 day delay for testnet)
        address[] memory proposers = new address[](1);
        proposers[0] = admin;
        address[] memory executors = new address[](1);
        executors[0] = admin;

        TimelockController timelock = new TimelockController(2 days, proposers, executors, admin);
        console2.log("6. TimelockController:", address(timelock));

        // 6. Deploy Main ClawCredit Contract
        ClawCreditAgentStandardV3 clawCredit = new ClawCreditAgentStandardV3(
            address(timelock),
            guardian,
            treasury,
            address(usdc),
            address(reputation),
            address(usdcFeed),
            address(aiFeed)
        );
        console2.log("7. ClawCreditAgentStandardV3:", address(clawCredit));

        // 7. Configure permissions (skip ETH staking - can be done later)
        reputation.authorizeContract(address(clawCredit));

        // Grant reporter role to deployer for testing
        aiOracle.grantRole(aiOracle.REPORTER_ROLE(), deployer);

        // Stake small amount of ETH for reporter (0.01 ETH is enough for testnet)
        aiOracle.stakeReporter{value: 0.01 ether}();

        vm.stopBroadcast();

        console2.log("========================================");
        console2.log("DEPLOYMENT COMPLETE!");
        console2.log("========================================");
        console2.log("");
        console2.log("Contract Addresses:");
        console2.log("-------------------");
        console2.log("MockUSDC:                 ", address(usdc));
        console2.log("MockUSDCFeed:             ", address(usdcFeed));
        console2.log("MockAIFeed:               ", address(aiFeed));
        console2.log("ERC8004ReputationRegistry:", address(reputation));
        console2.log("AIPerformanceOracle:      ", address(aiOracle));
        console2.log("TimelockController:       ", address(timelock));
        console2.log("ClawCreditAgentStandardV3:", address(clawCredit));
        console2.log("");
        console2.log("Next Steps:");
        console2.log("1. Fund the pool with USDC");
        console2.log("2. Mint test USDC: usdc.mint(address(clawCredit), amount)");
        console2.log("3. Test borrowing flow");
        console2.log("4. Verify contracts on Basescan");
    }
}
