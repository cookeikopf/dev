// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ClawCreditUltimateV2} from "../src/ClawCreditUltimateV2.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {MockERC8004Reputation} from "../src/mocks/MockERC8004Reputation.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockX402Hook} from "../src/mocks/MockX402Hook.sol";
import {MockFlashBorrower} from "./mocks/MockFlashBorrower.sol";

contract ClawCreditUltimateV2Test is Test {
    MockUSDC internal usdc;
    MockERC8004Reputation internal reputation;
    MockAggregator internal usdcFeed;
    MockAggregator internal aiFeed;
    MockX402Hook internal x402Hook;
    ClawCreditUltimateV2 internal pool;

    address internal guardian = address(0x11);
    address internal treasury = address(0x12);
    address internal x402Operator = address(0x13);
    address internal lender = address(0x100);
    address internal agentHigh = address(0x200);
    address internal agentLow = address(0x300);

    function setUp() public {
        usdc = new MockUSDC();
        reputation = new MockERC8004Reputation();
        usdcFeed = new MockAggregator(8, 1e8);
        aiFeed = new MockAggregator(8, 7000e4);
        x402Hook = new MockX402Hook();

        pool = new ClawCreditUltimateV2(
            address(this),
            guardian,
            treasury,
            x402Operator,
            address(usdc),
            address(reputation),
            address(usdcFeed),
            address(aiFeed),
            address(x402Hook)
        );

        reputation.setReputation(agentHigh, 9000, true);
        reputation.setReputation(agentLow, 3000, true);

        usdc.mint(lender, 1_000_000e6);
        usdc.mint(agentHigh, 100_000e6);
        usdc.mint(agentLow, 100_000e6);
        usdc.mint(x402Operator, 100_000e6);

        vm.prank(lender);
        usdc.approve(address(pool), type(uint256).max);
        vm.prank(agentHigh);
        usdc.approve(address(pool), type(uint256).max);
        vm.prank(agentLow);
        usdc.approve(address(pool), type(uint256).max);
        vm.prank(x402Operator);
        usdc.approve(address(pool), type(uint256).max);

        vm.prank(lender);
        pool.deposit(20_000e6);
    }

    function test_DepositMintsShares() public view {
        assertEq(pool.totalShares(), 20_000e6);
        assertEq(pool.lenderShares(lender), 20_000e6);
    }

    function test_RefreshCreditLineUsesReputationAndAi() public {
        vm.prank(agentHigh);
        pool.refreshCreditLine(agentHigh);

        (uint96 limit, uint96 used, uint16 aprBps, uint40 lastUpdated, bool active) = pool.creditLines(agentHigh);
        assertTrue(active);
        assertGt(limit, 400e6);
        assertEq(used, 0);
        assertLt(aprBps, 1_200);
        assertGt(lastUpdated, 0);
    }

    function test_DrawCreditLine_ZeroCollateralForHighReputation() public {
        uint256 loanId = _draw(agentHigh, 100e6, 0, 30);
        (,,,, uint96 collateral,,,,,, bool active,) = pool.loans(loanId);
        assertEq(collateral, 0);
        assertTrue(active);
        assertEq(pool.agentExposure(agentHigh), 100e6);
    }

    function test_DrawCreditLine_RequiresCollateralForLowReputation() public {
        vm.prank(agentLow);
        pool.refreshCreditLine(agentLow);

        vm.prank(agentLow);
        vm.expectRevert(ClawCreditUltimateV2.CollateralTooLow.selector);
        pool.drawCreditLine(100e6, 0, 15);
    }

    function test_RepayClosesLoanAndReturnsCollateral() public {
        uint256 loanId = _draw(agentLow, 100e6, 40e6, 15);
        vm.warp(block.timestamp + 10 days);

        uint256 debt = pool.getCurrentDebt(loanId);
        vm.prank(agentLow);
        pool.repay(loanId, debt);

        (,, uint96 pOut, uint96 iOut, uint96 col,,,,,, bool active, bool defaulted) = pool.loans(loanId);
        assertEq(pOut, 0);
        assertEq(iOut, 0);
        assertEq(col, 0);
        assertFalse(active);
        assertFalse(defaulted);
        assertEq(pool.agentExposure(agentLow), 0);
    }

    function test_AutoRepayHonorsPledgeCap() public {
        uint256 loanId = _draw(agentHigh, 100e6, 0, 30);
        (,,,,,,,,, uint16 autoBps,,) = pool.loans(loanId);

        uint256 gross = 1_000e6;
        uint256 cap = (gross * autoBps) / 10_000;

        vm.startPrank(x402Operator);
        vm.expectRevert(ClawCreditUltimateV2.AutoRepayTooHigh.selector);
        pool.processAutoRepayment(loanId, gross, cap + 1);
        vm.stopPrank();
    }

    function test_AutoRepayPartialReducesDebt() public {
        uint256 loanId = _draw(agentHigh, 120e6, 0, 30);
        vm.warp(block.timestamp + 5 days);

        uint256 beforeDebt = pool.getCurrentDebt(loanId);
        vm.prank(x402Operator);
        pool.processAutoRepayment(loanId, 1_000e6, 20e6);
        uint256 afterDebt = pool.getCurrentDebt(loanId);

        assertLt(afterDebt, beforeDebt);
    }

    function test_FlashLoanSuccess() public {
        MockFlashBorrower borrower = new MockFlashBorrower();
        uint256 amount = 1_000e6;
        uint256 fee = (amount * pool.flashFeeBps()) / 10_000;
        usdc.mint(address(borrower), fee);

        bool ok = pool.flashLoan(address(borrower), amount, "");
        assertTrue(ok);
        assertGt(pool.protocolFees(), 0);
    }

    function test_FlashLoanRevertsIfNotRepaid() public {
        MockFlashBorrower borrower = new MockFlashBorrower();
        borrower.setRepayLoan(false);

        vm.expectRevert(ClawCreditUltimateV2.FlashLoanNotRepaid.selector);
        pool.flashLoan(address(borrower), 1_000e6, "");
    }

    function test_IsolationModeBlocksNonWhitelistedBorrowers() public {
        pool.setIsolationMode(true);
        vm.prank(agentHigh);
        pool.refreshCreditLine(agentHigh);

        vm.prank(agentHigh);
        vm.expectRevert(ClawCreditUltimateV2.IsolationRestricted.selector);
        pool.drawCreditLine(50e6, 0, 10);

        pool.setIsolationWhitelist(agentHigh, true);
        uint256 loanId = _draw(agentHigh, 50e6, 0, 10);
        assertGt(loanId, 0);
    }

    function test_LiquidationAfterGracePeriod() public {
        uint256 loanId = _draw(agentLow, 100e6, 40e6, 1);
        vm.warp(block.timestamp + 5 days);

        assertTrue(pool.isLiquidatable(loanId));
        vm.prank(address(0x999));
        pool.liquidate(loanId);

        (,, uint96 pOut, uint96 iOut,,,,,,, bool active, bool defaulted) = pool.loans(loanId);
        assertEq(pOut, 0);
        assertEq(iOut, 0);
        assertFalse(active);
        assertTrue(defaulted);
    }

    function test_InsurancePoolGetsFivePercentOfOriginationFee() public {
        uint256 beforeInsurance = pool.insurancePool();
        _draw(agentHigh, 100e6, 0, 30);
        uint256 afterInsurance = pool.insurancePool();

        uint256 expected = (100e6 * pool.originationFeeBps()) / 10_000;
        expected = (expected * pool.insuranceFeeBps()) / 10_000;
        assertEq(afterInsurance - beforeInsurance, expected);
    }

    function test_MaxExposureCappedAt500USDC() public {
        // With repScore=9000, aiScore=7500, limit = 50 + 270 + 112.5 = ~432.5e6
        // So we can only draw up to ~432e6 before hitting credit line limit
        _draw(agentHigh, 200e6, 0, 30);
        _draw(agentHigh, 200e6, 0, 30);

        // Third draw should fail due to credit line limit (exposure would be 400+1 > limit)
        vm.prank(agentHigh);
        vm.expectRevert(ClawCreditUltimateV2.CreditLineUnavailable.selector);
        pool.drawCreditLine(100e6, 0, 30);
    }

    function test_ProtocolFeesWithdrawByTreasuryRole() public {
        _draw(agentHigh, 100e6, 0, 30);
        uint256 fees = pool.protocolFees();
        assertGt(fees, 0);

        vm.prank(treasury);
        pool.withdrawProtocolFees(treasury, fees);
        assertEq(pool.protocolFees(), 0);
    }

    function test_ReputationBoostAfterRepayment() public {
        uint256 loanId = _draw(agentHigh, 80e6, 0, 20);
        uint256 beforeScore = reputation.getScore(agentHigh);

        vm.warp(block.timestamp + 3 days);
        uint256 debt = pool.getCurrentDebt(loanId);
        vm.prank(agentHigh);
        pool.repay(loanId, debt);

        uint256 afterScore = reputation.getScore(agentHigh);
        assertGt(afterScore, beforeScore);
    }

    function _draw(address borrower, uint256 amount, uint256 collateral, uint32 tenorDays) internal returns (uint256) {
        vm.prank(borrower);
        pool.refreshCreditLine(borrower);

        vm.prank(borrower);
        return pool.drawCreditLine(amount, collateral, tenorDays);
    }
}
