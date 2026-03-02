// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ClawCreditAgentStandardV3} from "../src/ClawCreditAgentStandardV3.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {MockERC8004Reputation} from "../src/mocks/MockERC8004Reputation.sol";
import {MockUnderwriterModel} from "../src/mocks/MockUnderwriterModel.sol";
import {MaliciousReentrantUSDC} from "./mocks/MaliciousReentrantUSDC.sol";

contract ClawCreditAgentStandardV3ReentrancyTest is Test {
    MaliciousReentrantUSDC internal usdc;
    MockERC8004Reputation internal reputation;
    MockAggregator internal usdcFeed;
    MockAggregator internal aiFeed;
    MockUnderwriterModel internal model;
    ClawCreditAgentStandardV3 internal pool;

    address internal guardian = address(0x11);
    address internal treasury = address(0x12);
    address internal lender = address(0x100);
    address internal agent = address(0x200);
    uint16 internal underwriterId;

    function setUp() public {
        usdc = new MaliciousReentrantUSDC();
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
    }

    function test_SettleTaskBlocksReentrancyAndKeepsLiabilityConsistent() public {
        vm.prank(agent);
        uint256 taskId = pool.createTaskReceivable(50e6, uint40(block.timestamp + 7 days), keccak256("r"), true);

        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        pool.openTaskBackedLoan(taskId, 20e6, 3, underwriterId, keccak256("intent"), c);

        usdc.configureReentry(address(pool), taskId, true);

        vm.prank(agent);
        vm.expectRevert();
        pool.settleTask(taskId, 1e6);

        (, , uint96 escrowBalance, , , bool settled) = pool.tasks(taskId);
        assertFalse(settled);
        assertEq(uint256(escrowBalance), 50e6);
        assertEq(pool.totalTaskEscrowLiability(), 50e6);
    }
}
