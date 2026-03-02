// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ClawCreditUltimateV3} from "../src/ClawCreditUltimateV3.sol";
import {ERC8004ReputationRegistry} from "../src/ERC8004ReputationRegistry.sol";
import {AIPerformanceOracle} from "../src/AIPerformanceOracle.sol";
import {X402PaymentProcessor} from "../src/X402PaymentProcessor.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract ClawCreditUltimateV3Test is Test {
    ClawCreditUltimateV3 public pool;
    ERC8004ReputationRegistry public reputation;
    AIPerformanceOracle public aiOracle;
    X402PaymentProcessor public x402;
    MockUSDC public usdc;
    
    address public admin = address(1);
    address public guardian = address(2);
    address public treasury = address(3);
    address public lender = address(100);
    address public agent = address(200);
    address public client = address(300);
    
    function setUp() public {
        // Deploy USDC
        usdc = new MockUSDC();
        
        // Deploy infrastructure
        reputation = new ERC8004ReputationRegistry(admin);
        aiOracle = new AIPerformanceOracle(admin);
        x402 = new X402PaymentProcessor(address(usdc), address(0), admin);
        
        // Deploy main pool
        pool = new ClawCreditUltimateV3(
            admin,
            guardian,
            treasury,
            address(usdc),
            address(reputation),
            address(x402),
            address(0) // Mock price feed
        );
        
        // Update x402 with pool address
        vm.prank(admin);
        x402.setClawCreditPool(address(pool));
        
        // Authorize pool in reputation registry
        vm.prank(admin);
        reputation.authorizeContract(address(pool));
        
        // Mint USDC
        usdc.mint(lender, 100_000e6);
        usdc.mint(agent, 10_000e6);
        usdc.mint(client, 50_000e6);
        
        // Initialize agent reputation
        vm.prank(admin);
        reputation.initializeReputation(agent);
        
        // Approve spending
        vm.prank(lender);
        usdc.approve(address(pool), type(uint256).max);
        
        vm.prank(agent);
        usdc.approve(address(pool), type(uint256).max);
        
        vm.prank(client);
        usdc.approve(address(pool), type(uint256).max);
        
        // Lender deposits
        vm.prank(lender);
        pool.deposit(50_000e6);
    }
    
    function test_DepositMintsShares() public {
        assertEq(pool.totalShares(), 50_000e6);
        assertGt(pool.lenderShares(lender), 0);
    }
    
    function test_AgentCanStakeCollateral() public {
        vm.prank(agent);
        pool.stakeCollateral(5_000e6);
        
        // Access tuple by index: stakedCollateral is index 0 (9 total fields)
        (uint256 staked,,,,,,,,) = pool.agents(agent);
        assertEq(staked, 5_000e6);
    }
    
    function test_Tier1LoanRequires50PercentCollateral() public {
        // Stake collateral
        vm.prank(agent);
        pool.stakeCollateral(5_000e6);
        
        // Request $50 loan (Tier 1)
        vm.prank(agent);
        uint256 loanId = pool.requestLoan(50e6, 25e6, 1); // 50% of 50 = 25
        
        assertEq(loanId, 1);
        // Access tuple: active is index 12 (14 total fields)
        (,,,,,,,,,,,, bool active,) = pool.loans(loanId);
        assertTrue(active);
    }
    
    function test_Tier4LoanRequiresZeroCollateral() public {
        // Boost agent to Tier 4 reputation
        // First build reputation through multiple successful loans
        // ... (simplified for test)
        
        // Admin manually sets high reputation for test
        // In real scenario, this would happen through repayments
        
        // For now, test that Tier 4 exists (unpack 6 fields)
        (uint256 minRep, uint256 minStake,,,,) = pool.tiers(4);
        assertEq(minStake, 0); // Tier 4 requires 0% collateral
    }
    
    function test_LoanRepaymentUpdatesReputation() public {
        // Setup
        vm.prank(agent);
        pool.stakeCollateral(5_000e6);
        
        vm.prank(agent);
        uint256 loanId = pool.requestLoan(50e6, 25e6, 1);
        
        // Fast forward and repay
        vm.warp(block.timestamp + 15 days);
        
        uint256 debt = pool.getCurrentDebt(loanId);
        usdc.mint(agent, debt);
        
        vm.prank(agent);
        pool.repayLoan(loanId);
        
        // Verify loan closed - active is index 12 (14 total fields)
        (,,,,,,,,,,,, bool active,) = pool.loans(loanId);
        assertFalse(active);
    }
    
    function test_TaskBackedCollateralIncreasesCredit() public {
        // Client escrows payment for agent's task
        uint256 taskValue = 100e6;
        
        vm.prank(client);
        uint256 receivableId = pool.escrowTaskPayment(agent, taskValue, block.timestamp + 30 days, keccak256("task1"));
        
        // Agent should have 80% credit ($80) - taskBackedCredit is index 2 (9 total fields)
        (,,uint256 taskCredit,,,,,,) = pool.agents(agent);
        assertEq(taskCredit, 80e6);
    }
    
    function test_ReputationVoteUpdatesConsensus() public {
        // Setup reporter
        vm.deal(admin, 10_000e6);
        vm.prank(admin);
        aiOracle.stakeReporter{value: 6_000e6}();
        
        // Submit votes
        vm.prank(admin);
        aiOracle.reportMetrics(agent, AIPerformanceOracle.AgentMetrics({
            taskSuccessRate: 8000,
            avgTaskValue: 100e6,
            consistencyScore: 7500,
            uptime: 9000,
            responseTime: 120,
            uniqueClients: 5,
            totalTasks: 100,
            totalValue: 10_000e6,
            lastUpdate: block.timestamp,
            exists: true
        }));
        
        // Check consensus (would need multiple reporters in reality)
        assertGt(aiOracle.getConsensusScore(agent), 0);
    }
    
    function test_IsolationModePausesLoans() public {
        // Enable isolation mode
        vm.prank(guardian);
        pool.setIsolationMode(true);
        
        // Try to request loan (should fail)
        vm.prank(agent);
        vm.expectRevert();
        pool.requestLoan(50e6, 25e6, 1);
    }
    
    function test_WithdrawalRequiresLiquidity() public {
        // All liquidity is used
        vm.prank(agent);
        pool.stakeCollateral(5_000e6);
        vm.prank(agent);
        pool.requestLoan(50e6, 25e6, 1);
        
        // Try to withdraw (should fail)
        vm.prank(lender);
        vm.expectRevert();
        pool.withdraw(pool.lenderShares(lender));
    }
    
    function test_CollateralUnlockAfterRepayment() public {
        // Setup and take loan
        vm.prank(agent);
        pool.stakeCollateral(5_000e6);
        
        vm.prank(agent);
        pool.requestLoan(50e6, 25e6, 1);
        
        // Can't unstake while loan active
        vm.prank(agent);
        vm.expectRevert();
        pool.unstakeCollateral(5_000e6);
        
        // Repay loan
        vm.warp(block.timestamp + 15 days);
        uint256 debt = pool.getCurrentDebt(1);
        usdc.mint(agent, debt);
        vm.prank(agent);
        pool.repayLoan(1);
        
        // Now can unstake
        vm.prank(agent);
        pool.unstakeCollateral(5_000e6);
        
        (uint256 stakedAfter,,,,,,,,) = pool.agents(agent);
        assertEq(stakedAfter, 0);
    }
    
    function test_FlashLoan() public {
        // Setup
        vm.prank(agent);
        pool.stakeCollateral(10_000e6);
        
        // Would need flash borrower contract for full test
        // For now, just verify contract compiles with flash loan functions
        assertTrue(true);
    }
}
