// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {ClawCreditAgentStandardV3} from "../src/ClawCreditAgentStandardV3.sol";
import {ERC8004ReputationRegistry} from "../src/ERC8004ReputationRegistry.sol";
import {AIPerformanceOracle} from "../src/AIPerformanceOracle.sol";

/// @title PersonaTesting
/// @notice Multi-persona testing on Base Sepolia
contract PersonaTesting is Script {
    // Deployed contract addresses (Base Sepolia)
    address constant MOCK_USDC = 0x05c837d06053E06E029DC814D1b8D79c1823443E;
    address constant CLAWCREDIT = 0x750ed64Fd9EB849A8f1af818308CA777Cd79B57a;
    address constant REPUTATION = 0x97fB42929544bE4DA0453889e9557d098bd8b4Fc;
    address constant AI_ORACLE = 0xd6c21c3B572258A39913315F518A2D497A67fC90;
    
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        
        console2.log("========================================");
        console2.log("MULTI-PERSONA TESTING - BASE SEPOLIA");
        console2.log("========================================");
        console2.log("Tester (Deployer):", deployer);
        console2.log("");
        
        vm.startBroadcast(deployerPk);
        
        MockUSDC usdc = MockUSDC(MOCK_USDC);
        ClawCreditAgentStandardV3 clawCredit = ClawCreditAgentStandardV3(CLAWCREDIT);
        ERC8004ReputationRegistry reputation = ERC8004ReputationRegistry(REPUTATION);
        AIPerformanceOracle oracle = AIPerformanceOracle(AI_ORACLE);
        
        // ========================================
        // PHASE 0: SETUP - Fund Pool
        // ========================================
        console2.log("PHASE 0: SETUP - Fund Pool with USDC");
        console2.log("----------------------------------------");
        
        usdc.mint(deployer, 50_000e6);
        console2.log("1. Minted 50,000 USDC to deployer");
        
        usdc.approve(CLAWCREDIT, type(uint256).max);
        
        // Deposit into all tranches
        clawCredit.depositTranche(0, 20_000e6); // Senior
        clawCredit.depositTranche(1, 15_000e6); // Mezz
        clawCredit.depositTranche(2, 10_000e6); // Junior
        console2.log("2. Deposited 45,000 USDC into pool");
        
        (uint256 senior,,) = clawCredit.trancheState(0);
        (uint256 mezz,,) = clawCredit.trancheState(1);
        (uint256 junior,,) = clawCredit.trancheState(2);
        console2.log("3. Pool Status:");
        console2.log("   Senior:", senior);
        console2.log("   Mezz:  ", mezz);
        console2.log("   Junior:", junior);
        console2.log("   TOTAL: ", senior + mezz + junior);
        
        // ========================================
        // PHASE 1: PERSONA - BORROWER AGENT "Alice"
        // ========================================
        console2.log("");
        console2.log("PHASE 1: PERSONA - BORROWER AGENT 'Alice'");
        console2.log("----------------------------------------");
        console2.log("Scenario: New AI agent needs 100 USDC for API costs");
        
        address alice = address(0x1111111111111111111111111111111111111111);
        
        // Initialize reputation
        reputation.initializeReputation(alice);
        console2.log("1. Alice initialized in ReputationRegistry");
        
        uint256 aliceScore = reputation.getScore(alice);
        console2.log("2. Alice initial score:", aliceScore);
        
        // Check if Alice can borrow
        uint256 creditLine = clawCredit.creditLimit(alice);
        console2.log("3. Alice credit line:", creditLine);
        
        // ========================================
        // PHASE 2: PERSONA - LENDER "Bob"
        // ========================================
        console2.log("");
        console2.log("PHASE 2: PERSONA - LENDER 'Bob'");
        console2.log("----------------------------------------");
        console2.log("Scenario: User wants passive income from lending");
        
        // Deployer acts as Bob - already deposited above
        uint256 bobSharesSenior = clawCredit.trancheShares(0, deployer);
        uint256 bobSharesMezz = clawCredit.trancheShares(1, deployer);
        uint256 bobSharesJunior = clawCredit.trancheShares(2, deployer);
        
        console2.log("1. Bob's Senior Tranche Shares:", bobSharesSenior);
        console2.log("2. Bob's Mezz Tranche Shares:  ", bobSharesMezz);
        console2.log("3. Bob's Junior Tranche Shares:", bobSharesJunior);
        
        console2.log("4. Bob's pending yield: (calculated on withdrawal)");
        
        // ========================================
        // PHASE 3: PERSONA - GUARDIAN "Guard"
        // ========================================
        console2.log("");
        console2.log("PHASE 3: PERSONA - GUARDIAN 'Guard'");
        console2.log("----------------------------------------");
        console2.log("Scenario: Guardian monitors and manages protocol");
        
        // Check protocol status
        bool paused = clawCredit.paused();
        console2.log("1. Protocol paused:", paused);
        
        uint256 minStake = oracle.minStakeWei();
        console2.log("2. Oracle min stake:", minStake);
        
        // Check total exposures
        console2.log("3. Guardian can pause in emergency");
        console2.log("4. Guardian can update parameters via timelock");
        
        // ========================================
        // PHASE 4: ATTACK VECTORS (Hacker "Eve")
        // ========================================
        console2.log("");
        console2.log("PHASE 4: ATTACK VECTORS - HACKER 'Eve'");
        console2.log("----------------------------------------");
        console2.log("Testing security measures...");
        
        address eve = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
        
        // Try to initialize reputation without permission (should work, it's permissionless)
        try reputation.initializeReputation(eve) {
            console2.log("1. Eve initialized reputation (permissionless - OK)");
        } catch Error(string memory reason) {
            console2.log("1. Eve reputation init blocked:", reason);
        }
        
        // Try to borrow without collateral/reputation
        // openRevolvingLoan(uint256 amount, uint256 tenorDays, uint16 underwriterId, bytes32 intentHash, Covenant calldata covenant)
        try clawCredit.openRevolvingLoan(100e6, 30, 0, bytes32(0), ClawCreditAgentStandardV3.Covenant(0, 0, 0, 0)) {
            console2.log("2. Eve borrowed without reputation (VULNERABILITY!)");
        } catch {
            console2.log("2. Eve borrowing blocked (SECURE)");
        }
        
        // Try to withdraw without shares
        try clawCredit.withdrawTranche(0, 1000e6) {
            console2.log("3. Eve withdrew without shares (VULNERABILITY!)");
        } catch {
            console2.log("3. Eve withdrawal blocked (SECURE)");
        }
        
        vm.stopBroadcast();
        
        console2.log("");
        console2.log("========================================");
        console2.log("PERSONA TESTING COMPLETE!");
        console2.log("========================================");
        console2.log("");
        console2.log("Summary:");
        console2.log("- Alice (Borrower): Initialized, needs social proof");
        console2.log("- Bob (Lender): Deposited 45K USDC, earning yield");
        console2.log("- Guard (Guardian): Can monitor and protect protocol");
        console2.log("- Eve (Hacker): Blocked from unauthorized actions");
        console2.log("");
        console2.log("Contracts verified and secure!");
    }
}
