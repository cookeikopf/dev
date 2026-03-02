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
    address internal sponsor = address(0x101);
    address internal agent = address(0x200);
    address internal target = address(0x300);

    uint16 internal underwriterId;

    function setUp() public {
        usdc = new MockUSDC();
        reputation = new MockERC8004Reputation();
        usdcFeed = new MockAggregator(8, 1e8);
        aiFeed = new MockAggregator(8, 7500e4);
        model = new MockUnderwriterModel();

        pool = new ClawCreditAgentStandardV3(
            address(this),
            guardian,
            treasury,
            address(usdc),
            address(reputation),
            address(usdcFeed),
            address(aiFeed)
        );

        pool.grantRole(pool.ATTESTOR_ROLE(), attestor);
        pool.grantRole(pool.PASSPORT_ROLE(), address(this));
        pool.grantRole(pool.EARNINGS_HOOK_ROLE(), hook);

        underwriterId = pool.registerUnderwriter(address(model), 100);

        reputation.setReputation(agent, 8500, true);

        usdc.mint(lender, 1_000_000e6);
        usdc.mint(sponsor, 500_000e6);
        usdc.mint(agent, 200_000e6);
        usdc.mint(hook, 100_000e6);

        vm.startPrank(lender);
        usdc.approve(address(pool), type(uint256).max);
        pool.depositTranche(pool.TRANCHE_SENIOR(), 200_000e6);
        pool.depositTranche(pool.TRANCHE_MEZZ(), 200_000e6);
        pool.depositTranche(pool.TRANCHE_JUNIOR(), 200_000e6);
        vm.stopPrank();

        vm.prank(sponsor);
        usdc.approve(address(pool), type(uint256).max);
        vm.prank(agent);
        usdc.approve(address(pool), type(uint256).max);
        vm.prank(hook);
        usdc.approve(address(pool), type(uint256).max);
    }

    function test_TrancheDepositAndWithdrawFlow() public {
        uint256 beforeBal = usdc.balanceOf(lender);
        uint256 shares = pool.trancheShares(pool.TRANCHE_SENIOR(), lender);
        vm.prank(lender);
        pool.withdrawTranche(pool.TRANCHE_SENIOR(), shares / 10);
        uint256 afterBal = usdc.balanceOf(lender);
        assertGt(afterBal, beforeBal);
    }

    function test_ReinsuranceStakeAndUnstake() public {
        vm.prank(agent);
        pool.stakeReinsurance(10_000e6);
        uint256 shares = pool.reinsuranceShares(agent);
        assertGt(shares, 0);

        vm.prank(agent);
        pool.unstakeReinsurance(shares / 2);
        assertGt(usdc.balanceOf(agent), 0);
    }

    function test_DelegatedLoanFlow() public {
        vm.prank(sponsor);
        pool.depositDelegationCollateral(500e6);

        vm.prank(sponsor);
        pool.setDelegation(agent, 200e6, uint40(block.timestamp + 7 days));

        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        uint256 loanId = pool.openDelegatedLoan(sponsor, 100e6, 15, underwriterId, keccak256("intent"), c);
        assertGt(loanId, 0);
    }

    function test_RevokeDelegationPreventsNewBorrowing() public {
        vm.prank(sponsor);
        pool.depositDelegationCollateral(500e6);
        vm.prank(sponsor);
        pool.setDelegation(agent, 200e6, uint40(block.timestamp + 7 days));

        vm.prank(sponsor);
        pool.revokeDelegation(agent);

        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        vm.expectRevert(ClawCreditAgentStandardV3.DelegationUnavailable.selector);
        pool.openDelegatedLoan(sponsor, 50e6, 10, underwriterId, keccak256("intent"), c);
    }

    function test_TaskBackedLoanRequiresEscrow() public {
        uint256 badTask;
        vm.prank(agent);
        badTask = pool.createTaskReceivable(200e6, uint40(block.timestamp + 20 days), keccak256("bad"), false);

        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        vm.expectRevert(ClawCreditAgentStandardV3.TaskUnavailable.selector);
        pool.openTaskBackedLoan(badTask, 50e6, 10, underwriterId, keccak256("intent"), c);
    }

    function test_TaskBackedLoanSuccess() public {
        vm.prank(agent);
        uint256 taskId =
            pool.createTaskReceivable(300e6, uint40(block.timestamp + 30 days), keccak256("ok"), true);

        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        uint256 loanId = pool.openTaskBackedLoan(taskId, 100e6, 10, underwriterId, keccak256("intent"), c);
        assertGt(loanId, 0);
    }

    function test_OpenLoanRejectsZeroIntentHash() public {
        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        vm.expectRevert(ClawCreditAgentStandardV3.UnauthorizedIntent.selector);
        pool.openRevolvingLoan(100e6, 20, underwriterId, bytes32(0), c);
    }

    function test_IntentExecutionMovesFunds() public {
        ClawCreditAgentStandardV3.Covenant memory c;
        bytes32 intent = keccak256("route-1");
        vm.prank(agent);
        uint256 loanId = pool.openRevolvingLoan(100e6, 20, underwriterId, intent, c);

        uint256 before = usdc.balanceOf(target);
        vm.prank(agent);
        pool.executeIntent(loanId, intent, target, 10e6);
        uint256 afterBal = usdc.balanceOf(target);
        assertEq(afterBal - before, 10e6);
    }

    function test_CancelUnusedCreditRepaysPrincipal() public {
        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        uint256 loanId = pool.openRevolvingLoan(100e6, 20, underwriterId, keccak256("i"), c);

        ClawCreditAgentStandardV3.Loan memory beforeLoan = pool.getLoan(loanId);
        assertTrue(beforeLoan.active);
        assertEq(beforeLoan.principalOutstanding, 100e6);

        vm.prank(agent);
        pool.cancelUnusedCredit(loanId, 20e6);

        ClawCreditAgentStandardV3.Loan memory afterLoan = pool.getLoan(loanId);
        assertEq(afterLoan.principalOutstanding, 80e6);
    }

    function test_StreamRepaymentByHook() public {
        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        uint256 loanId = pool.openRevolvingLoan(80e6, 20, underwriterId, keccak256("stream"), c);

        vm.warp(block.timestamp + 2 days);
        vm.prank(hook);
        pool.streamRepay(loanId, 10e6, keccak256("s1"));

        uint256 debt = pool.getCurrentDebt(loanId);
        assertLt(debt, 85e6);
    }

    function test_InterestRepaymentSplitsInsuranceAndProtocol() public {
        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        uint256 loanId = pool.openRevolvingLoan(100e6, 20, underwriterId, keccak256("split"), c);

        uint256 insuranceBefore = pool.insurancePool();
        uint256 protocolBefore = pool.protocolFees();

        vm.warp(block.timestamp + 10 days);
        uint256 debt = pool.getCurrentDebt(loanId);
        vm.prank(agent);
        pool.repay(loanId, debt);

        assertGt(pool.insurancePool(), insuranceBefore);
        assertGt(pool.protocolFees(), protocolBefore);
    }

    function test_CovenantBreachTriggersLiquidationEligibility() public {
        ClawCreditAgentStandardV3.Covenant memory c = ClawCreditAgentStandardV3.Covenant({
            minTaskCompletionBps: 8_000,
            minPnlBps: 50,
            maxDrawdownBps: 1_000,
            reviewAt: uint40(block.timestamp + 1 days)
        });

        vm.prank(agent);
        uint256 loanId = pool.openRevolvingLoan(100e6, 20, underwriterId, keccak256("cov"), c);

        vm.warp(block.timestamp + 2 days);
        vm.prank(attestor);
        pool.submitCovenantReport(loanId, -100, 2_000, 6_000);

        assertTrue(pool.covenantBreached(loanId));
        assertTrue(pool.isLiquidatable(loanId));
    }

    function test_IsolationModeBlocksBorrowerWhenNotWhitelisted() public {
        pool.setIsolationMode(true);

        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        vm.expectRevert(ClawCreditAgentStandardV3.IsolationRestricted.selector);
        pool.openRevolvingLoan(50e6, 10, underwriterId, keccak256("iso"), c);
    }

    function test_PassportAndAttestationImproveScore() public {
        uint256 beforeScore = pool.blendedScore(agent);

        vm.prank(attestor);
        pool.submitAttestation(agent, 9_000, 8_000, keccak256("perf"));
        pool.updatePassport(agent, 8453, 9_200, 7_500, 1);

        uint256 afterScore = pool.blendedScore(agent);
        assertGt(afterScore, beforeScore);
    }

    function test_LiquidationUsesWaterfallsAndClosesLoan() public {
        vm.prank(agent);
        pool.stakeReinsurance(50e6);

        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        uint256 loanId = pool.openRevolvingLoan(120e6, 2, underwriterId, keccak256("liq"), c);

        vm.warp(block.timestamp + 10 days);
        vm.prank(address(0x999));
        pool.liquidate(loanId);

        ClawCreditAgentStandardV3.Loan memory closedLoan = pool.getLoan(loanId);
        assertEq(closedLoan.principalOutstanding, 0);
        assertEq(closedLoan.accruedInterest, 0);
        assertFalse(closedLoan.active);
        assertTrue(closedLoan.defaulted);
    }

    function test_TreasuryCannotWithdrawUnderwriterLiability() public {
        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        pool.openRevolvingLoan(100e6, 20, underwriterId, keccak256("fee"), c);

        uint256 protocolFees = pool.protocolFees();
        assertGt(protocolFees, 0);
        uint256 underwriterLiability = pool.underwriterFeeLiability();
        assertGt(underwriterLiability, 0);

        vm.prank(treasury);
        vm.expectRevert(ClawCreditAgentStandardV3.InvalidAmount.selector);
        pool.withdrawProtocolFees(treasury, protocolFees);
    }

    function test_PruneExpiredDelegationReleasesCapacity() public {
        vm.prank(sponsor);
        pool.depositDelegationCollateral(500e6);
        vm.prank(sponsor);
        pool.setDelegation(agent, 200e6, uint40(block.timestamp + 1 days));

        assertEq(pool.sponsorDelegatedCapacity(sponsor), 200e6);
        vm.warp(block.timestamp + 2 days);
        pool.pruneExpiredDelegation(sponsor, agent);
        assertEq(pool.sponsorDelegatedCapacity(sponsor), 0);
    }
}
