// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {ERC8004ReputationRegistry} from "../src/ERC8004ReputationRegistry.sol";

/// @title SepoliaPersonaTests
/// @notice Simple tests mit deployed contracts
contract SepoliaPersonaTests is Script {
    address constant MOCK_USDC = 0x05c837d06053E06E029DC814D1b8D79c1823443E;
    address constant REPUTATION = 0x97fB42929544bE4DA0453889e9557d098bd8b4Fc;
    
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        
        console2.log("========================================");
        console2.log("SEPOLIA PERSONA TESTS");
        console2.log("========================================");
        
        vm.startBroadcast(deployerPk);
        
        MockUSDC usdc = MockUSDC(MOCK_USDC);
        ERC8004ReputationRegistry reputation = ERC8004ReputationRegistry(REPUTATION);
        
        // Test 1: Mint USDC
        usdc.mint(deployer, 10000e6);
        console2.log("1. Minted 10,000 USDC");
        
        // Test 2: Check balance
        uint256 balance = usdc.balanceOf(deployer);
        console2.log("2. Balance:", balance);
        
        // Test 3: Initialize reputation for test agent
        address alice = address(0x1111111111111111111111111111111111111111);
        reputation.initializeReputation(alice);
        console2.log("3. Alice reputation initialized");
        
        // Test 4: Check score
        uint256 score = reputation.getScore(alice);
        console2.log("4. Alice score:", score);
        
        vm.stopBroadcast();
        
        console2.log("========================================");
        console2.log("TESTS COMPLETE!");
        console2.log("========================================");
    }
}
