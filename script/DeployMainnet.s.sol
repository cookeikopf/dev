// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import {ClawCreditAgentStandardV3} from "../src/ClawCreditAgentStandardV3.sol";
import {ERC8004ReputationRegistry} from "../src/ERC8004ReputationRegistry.sol";
import {AIPerformanceOracle} from "../src/AIPerformanceOracle.sol";

/// @title DeployMainnet
/// @notice Production deployment script for Base Mainnet
/// @dev Run with: forge script script/DeployMainnet.s.sol --rpc-url $BASE_MAINNET_RPC --broadcast --via-ir
contract DeployMainnet is Script {
    // Base Mainnet addresses
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_PRICE_FEED = 0x7e860098F58bBFC8648Cf43BC25f8BC2e9Ef4C4e;
    
    // Configuration
    uint256 constant MIN_STAKE_WEI = 0.5 ether; // 0.5 ETH minimum stake
    
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        
        console2.log("========================================");
        console2.log("CLAWCREDIT V3 - BASE MAINNET DEPLOYMENT");
        console2.log("========================================");
        console2.log("Deployer:", deployer);
        console2.log("Network: Base Mainnet");
        console2.log("Chain ID:", block.chainid);
        console2.log("");
        
        vm.startBroadcast(deployerPk);
        
        // 1. Deploy ReputationRegistry
        ERC8004ReputationRegistry reputation = new ERC8004ReputationRegistry(deployer);
        console2.log("1. ReputationRegistry:", address(reputation));
        
        // 2. Deploy AI Performance Oracle
        AIPerformanceOracle aiOracle = new AIPerformanceOracle(
            address(reputation),
            deployer, // guardian
            MIN_STAKE_WEI
        );
        console2.log("2. AIPerformanceOracle:", address(aiOracle));
        
        // 3. Deploy TimelockController (2-day delay)
        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = deployer;
        executors[0] = deployer;
        
        TimelockController timelock = new TimelockController(
            2 days,
            proposers,
            executors,
            deployer
        );
        console2.log("3. TimelockController:", address(timelock));
        
        // 4. Deploy ClawCredit
        ClawCreditAgentStandardV3 clawCredit = new ClawCreditAgentStandardV3(
            USDC,
            USDC_PRICE_FEED,
            address(reputation),
            address(aiOracle),
            address(timelock),
            deployer
        );
        console2.log("4. ClawCreditAgentStandardV3:", address(clawCredit));
        
        // 5. Configure permissions
        reputation.authorizeContract(address(clawCredit));
        aiOracle.grantRole(aiOracle.REPORTER_ROLE(), deployer);
        
        // Optional: Stake for reporter (if enough ETH)
        // aiOracle.stakeReporter{value: 1 ether}();
        
        vm.stopBroadcast();
        
        console2.log("");
        console2.log("========================================");
        console2.log("DEPLOYMENT COMPLETE!");
        console2.log("========================================");
        console2.log("");
        console2.log("NEXT STEPS:");
        console2.log("1. Verify contracts on Basescan");
        console2.log("2. Set up monitoring");
        console2.log("3. Announce launch");
        console2.log("");
        console2.log("IMPORTANT: Save these addresses!");
    }
}

import "@openzeppelin/contracts/governance/TimelockController.sol";
