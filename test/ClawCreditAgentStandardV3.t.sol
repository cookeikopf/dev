// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ClawCreditAgentStandardV3} from "../src/ClawCreditAgentStandardV3.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {MockERC8004Reputation} from "../src/mocks/MockERC8004Reputation.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockUnderwriterModel} from "../src/mocks/MockUnderwriterModel.sol";

contract ClawCreditAgentStandardV3Test is Test {
    MockUSDC internal usdc;
    MockERC8004Reputation internal reputation;
    MockAggregator internal usdcFeed;
    MockAggregator internal aiFeed;
    MockUnderwriterModel internal model;
    ClawCreditAgentStandardV3 internal pool;

    address internal guardian = address(0x11);
    address internal treasury = address(0x12);
    address internal attestor = address(0x13);
    address internal hook = address(0x14);
    address internal lender = address(0x100);
    address internal agent = address(0x200);
    uint16 internal underwriterId;

    function setUp() public {
        usdc = new MockUSDC();
        reputation = new MockERC8004Reputation();
        usdcFeed = new MockAggregator(8, 1e8);
        aiFeed = new MockAggregator(8, 7500e4);
        model = new MockUnderwriterModel();

        pool = new ClawCreditAgentStandardV3(
            address(this), guardian, treasury, address(usdc), address(reputation), address(usdcFeed), address(aiFeed)
        );

        pool.grantRole(pool.ATTESTOR_ROLE(), attestor);
        pool.grantRole(pool.EARNINGS_HOOK_ROLE(), hook);

        underwriterId = pool.registerUnderwriter(address(model), 100);
        reputation.setReputation(agent, 8500, true);

        usdc.mint(lender, 1_000_000e6);
        usdc.mint(agent, 400_000e6);

        vm.startPrank(lender);
        usdc.approve(address(pool), type(uint256).max);
        pool.depositTranche(pool.TRANCHE_SENIOR(), 200_000e6);
        pool.depositTranche(pool.TRANCHE_MEZZ(), 200_000e6);
        pool.depositTranche(pool.TRANCHE_JUNIOR(), 200_000e6);
        vm.stopPrank();

        vm.prank(agent);
        usdc.approve(address(pool), type(uint256).max);
    }

    function test_EscrowLiabilityBlocksOverWithdrawUntilReleased() public {
        // Create task with escrow
        vm.prank(agent);
        uint256 taskId =
            pool.createTaskReceivable(100e6, uint40(block.timestamp + 20 days), keccak256("esc-liab"), true);

        // Verify escrow liability is tracked
        assertEq(pool.totalTaskEscrowLiability(), 100e6, "Escrow liability should be 100 USDC");

        // Try to withdraw - should fail because escrow liability exists
        uint8 senior = pool.TRANCHE_SENIOR(); // Get constant first
        vm.prank(lender);
        vm.expectRevert(ClawCreditAgentStandardV3.InsufficientLiquidity.selector);
        pool.withdrawTranche(senior, 200_000e6);

        // Release escrow
        vm.prank(agent);
        pool.releaseTaskPayment(taskId);

        // Verify escrow liability is cleared
        assertEq(pool.totalTaskEscrowLiability(), 0, "Escrow liability should be 0 after release");

        // Now withdrawal should work
        vm.prank(lender);
        pool.withdrawTranche(senior, 200_000e6);
    }

    function test_TaskBackedLoanRequiresEscrow() public {
        vm.prank(agent);
        uint256 taskId = pool.createTaskReceivable(200e6, uint40(block.timestamp + 20 days), keccak256("bad"), false);

        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        vm.expectRevert(ClawCreditAgentStandardV3.TaskUnavailable.selector);
        pool.openTaskBackedLoan(taskId, 50e6, 10, underwriterId, keccak256("intent"), c);
    }

    function test_TaskCannotBeLinkedTwice() public {
        vm.prank(agent);
        uint256 taskId = pool.createTaskReceivable(200e6, uint40(block.timestamp + 20 days), keccak256("esc"), true);

        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        pool.openTaskBackedLoan(taskId, 50e6, 10, underwriterId, keccak256("intent-1"), c);

        vm.prank(agent);
        vm.expectRevert(ClawCreditAgentStandardV3.TaskAlreadyLinked.selector);
        pool.openTaskBackedLoan(taskId, 50e6, 10, underwriterId, keccak256("intent-2"), c);
    }

    function test_TaskSettledCannotBeLinkedAgain() public {
        vm.prank(agent);
        uint256 taskId = pool.createTaskReceivable(120e6, uint40(block.timestamp + 20 days), keccak256("esc2"), true);

        vm.prank(agent);
        pool.releaseTaskPayment(taskId);

        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        vm.expectRevert(ClawCreditAgentStandardV3.TaskUnavailable.selector);
        pool.openTaskBackedLoan(taskId, 50e6, 10, underwriterId, keccak256("intent"), c);
    }

    function test_DefaultCloseDoesNotPayReservedCreditToBorrower() public {
        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        uint256 loanId = pool.openRevolvingLoan(100e6, 2, underwriterId, keccak256("def"), c);

        uint256 beforeBal = usdc.balanceOf(agent);
        vm.warp(block.timestamp + 10 days);
        pool.liquidate(loanId);
        uint256 afterBal = usdc.balanceOf(agent);

        assertEq(afterBal, beforeBal);
    }

    function test_Invariant_TotalOutstandingMatchesActivePrincipal() public {
        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        pool.openRevolvingLoan(50e6, 2, underwriterId, keccak256("inv1"), c);

        assertEq(pool.totalOutstandingPrincipal(), 50e6);

        vm.prank(agent);
        pool.openRevolvingLoan(50e6, 2, underwriterId, keccak256("inv2"), c);

        assertEq(pool.totalOutstandingPrincipal(), 100e6);
    }

    function test_EmergencyRecoverCannotDrainUSDC() public {
        uint256 initialPoolBalance = usdc.balanceOf(address(pool));

        vm.expectRevert();
        pool.emergencyRecoverToken(address(usdc), address(this), initialPoolBalance);
    }
}
