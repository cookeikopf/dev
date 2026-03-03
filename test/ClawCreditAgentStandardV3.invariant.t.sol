// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import {ClawCreditAgentStandardV3} from "../src/ClawCreditAgentStandardV3.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockERC8004Reputation} from "../src/mocks/MockERC8004Reputation.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {MockUnderwriterModel} from "../src/mocks/MockUnderwriterModel.sol";

contract V3InvariantHandler is Test {
    ClawCreditAgentStandardV3 internal pool;
    MockUSDC internal usdc;

    address internal lender;
    address internal agent;
    uint16 internal underwriterId;

    uint256[] internal trackedLoans;
    mapping(uint256 => uint256) internal lastObservedDebt;
    uint256[] internal trackedTasks;

    constructor(
        ClawCreditAgentStandardV3 _pool,
        MockUSDC _usdc,
        address _lender,
        address _agent,
        uint16 _underwriterId
    ) {
        pool = _pool;
        usdc = _usdc;
        lender = _lender;
        agent = _agent;
        underwriterId = _underwriterId;
    }

    function openRevolving(uint96 amount, uint8 tenorDays) external {
        uint256 a = bound(uint256(amount), 10e6, 80e6);
        uint256 tenor = bound(uint256(tenorDays), 5, 30);
        ClawCreditAgentStandardV3.Covenant memory c;

        vm.prank(agent);
        uint256 loanId = pool.openRevolvingLoan(a, tenor, underwriterId, keccak256("inv"), c);
        trackedLoans.push(loanId);
        lastObservedDebt[loanId] = pool.getCurrentDebt(loanId);
    }

    function repayLoan(uint8 idx, uint96 amount) external {
        if (trackedLoans.length == 0) return;
        uint256 i = bound(uint256(idx), 0, trackedLoans.length - 1);
        uint256 loanId = trackedLoans[i];

        ClawCreditAgentStandardV3.Loan memory loan = pool.getLoan(loanId);
        if (!loan.active) return;

        uint256 beforeDebt = pool.getCurrentDebt(loanId);
        uint256 repayAmt = bound(uint256(amount), 1e6, beforeDebt == 0 ? 1e6 : beforeDebt);

        vm.prank(agent);
        pool.repay(loanId, repayAmt);

        uint256 afterDebt = pool.getCurrentDebt(loanId);
        if (afterDebt > beforeDebt) {
            revert("debt increased after repay");
        }
        lastObservedDebt[loanId] = afterDebt;
    }

    function warpTime(uint32 secondsForward) external {
        vm.warp(block.timestamp + bound(uint256(secondsForward), 1, 2 days));
    }

    function liquidateExpired(uint8 idx) external {
        if (trackedLoans.length == 0) return;
        uint256 i = bound(uint256(idx), 0, trackedLoans.length - 1);
        uint256 loanId = trackedLoans[i];
        ClawCreditAgentStandardV3.Loan memory loan = pool.getLoan(loanId);
        if (!loan.active) return;

        vm.warp(uint256(loan.dueDate) + uint256(pool.gracePeriod()) + 1);
        uint256 beforeBal = usdc.balanceOf(agent);
        pool.liquidate(loanId);
        uint256 afterBal = usdc.balanceOf(agent);
        if (afterBal > beforeBal) {
            revert("default paid borrower");
        }
    }

    function trackedLoansLength() external view returns (uint256) {
        return trackedLoans.length;
    }

    function trackedLoanAt(uint256 i) external view returns (uint256) {
        return trackedLoans[i];
    }

    function createEscrowTask(uint96 receivable, uint16 dueInDays) external {
        uint256 amount = bound(uint256(receivable), 1e6, 40e6);
        uint256 daysForward = bound(uint256(dueInDays), 3, 30);

        vm.prank(agent);
        uint256 taskId = pool.createTaskReceivable(
            amount, uint40(block.timestamp + daysForward * 1 days), keccak256("inv-task"), true
        );
        trackedTasks.push(taskId);
    }

    function releaseEscrowTask(uint8 idx) external {
        if (trackedTasks.length == 0) return;
        uint256 i = bound(uint256(idx), 0, trackedTasks.length - 1);
        uint256 taskId = trackedTasks[i];
        (,, uint96 escrowBalance,,, bool escrowed, bool settled) = pool.tasks(taskId);
        if (!escrowed || settled || escrowBalance == 0) return;

        vm.prank(agent);
        pool.releaseTaskPayment(taskId);
    }

    function trackedTasksLength() external view returns (uint256) {
        return trackedTasks.length;
    }

    function trackedTaskAt(uint256 i) external view returns (uint256) {
        return trackedTasks[i];
    }
}

contract ClawCreditAgentStandardV3InvariantTest is StdInvariant, Test {
    MockUSDC internal usdc;
    MockERC8004Reputation internal reputation;
    MockAggregator internal usdcFeed;
    MockAggregator internal aiFeed;
    MockUnderwriterModel internal model;
    ClawCreditAgentStandardV3 internal pool;
    V3InvariantHandler internal handler;

    address internal guardian = address(0x11);
    address internal treasury = address(0x12);
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

        underwriterId = pool.registerUnderwriter(address(model), 100);
        reputation.setReputation(agent, 8500, true);

        usdc.mint(lender, 1_000_000e6);
        usdc.mint(agent, 500_000e6);

        vm.startPrank(lender);
        usdc.approve(address(pool), type(uint256).max);
        pool.depositTranche(pool.TRANCHE_SENIOR(), 300_000e6);
        pool.depositTranche(pool.TRANCHE_MEZZ(), 300_000e6);
        pool.depositTranche(pool.TRANCHE_JUNIOR(), 300_000e6);
        vm.stopPrank();

        vm.prank(agent);
        usdc.approve(address(pool), type(uint256).max);

        handler = new V3InvariantHandler(pool, usdc, lender, agent, underwriterId);
        targetContract(address(handler));
    }

    function invariant_totalOutstandingPrincipalMatchesActiveLoans() public {
        uint256 sum;
        uint256[] memory ids = pool.getAgentLoans(agent);
        for (uint256 i = 0; i < ids.length; i++) {
            ClawCreditAgentStandardV3.Loan memory loan = pool.getLoan(ids[i]);
            if (loan.active) sum += loan.principalOutstanding;
        }
        assertEq(pool.totalOutstandingPrincipal(), sum);
    }

    function invariant_defaultNeverPaysBorrowerReservedCredit() public {
        uint256 beforeBal = usdc.balanceOf(agent);
        uint256 len = handler.trackedLoansLength();
        for (uint256 i = 0; i < len; i++) {
            uint256 loanId = handler.trackedLoanAt(i);
            ClawCreditAgentStandardV3.Loan memory loan = pool.getLoan(loanId);
            if (loan.defaulted) {
                assertEq(uint256(loan.reservedCredit), 0);
            }
        }
        assertGe(usdc.balanceOf(agent), beforeBal);
    }

    function invariant_poolBalanceCoversTaskEscrowLiability() public {
        assertGe(usdc.balanceOf(address(pool)), pool.totalTaskEscrowLiability());
    }

    function invariant_trackedTasksMatchEscrowLiability() public {
        uint256 trackedLiability;
        uint256 len = handler.trackedTasksLength();
        for (uint256 i = 0; i < len; i++) {
            uint256 taskId = handler.trackedTaskAt(i);
            (,, uint96 escrowBalance,,, bool escrowed, bool settled) = pool.tasks(taskId);
            if (escrowed && !settled) {
                trackedLiability += uint256(escrowBalance);
            }
        }
        assertEq(pool.totalTaskEscrowLiability(), trackedLiability);
    }

    function testFuzz_TaskEscrowRequiresRealTransferDelta(uint96 receivable) public {
        uint256 amount = bound(uint256(receivable), 1e6, 50e6);
        vm.prank(agent);
        uint256 taskId = pool.createTaskReceivable(amount, uint40(block.timestamp + 7 days), keccak256("esc"), true);
        (, uint96 r, uint96 escrowBalance,,,,) = pool.tasks(taskId);
        assertEq(uint256(r), amount);
        assertEq(uint256(escrowBalance), amount);
    }

    function testFuzz_TaskBackedBorrowRespectsHaircut(uint96 receivable) public {
        uint256 amount = bound(uint256(receivable), 20e6, 100e6);
        vm.prank(agent);
        uint256 taskId =
            pool.createTaskReceivable(amount, uint40(block.timestamp + 30 days), keccak256("haircut"), true);

        ClawCreditAgentStandardV3.Covenant memory c;
        uint256 aboveHaircut = (amount * (pool.taskEscrowHaircutBps() + 1)) / pool.BPS();
        vm.prank(agent);
        vm.expectRevert(ClawCreditAgentStandardV3.BorrowCapExceeded.selector);
        pool.openTaskBackedLoan(taskId, aboveHaircut, 10, underwriterId, keccak256("intent"), c);
    }
}
