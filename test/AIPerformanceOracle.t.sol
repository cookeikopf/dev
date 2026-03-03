// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import {AIPerformanceOracle} from "../src/AIPerformanceOracle.sol";

contract AIPerformanceOracleTest is Test {
    event MinStakeUpdated(uint256 oldMinStakeWei, uint256 newMinStakeWei);

    AIPerformanceOracle internal oracle;
    address internal admin = address(this);
    address internal reporter = address(0xBEEF);

    function setUp() public {
        oracle = new AIPerformanceOracle(admin);
    }

    function test_MinStakeWeiDefaultsToFiveEther() public {
        assertEq(oracle.minStakeWei(), 5 ether);
    }

    function test_SetMinStakeWeiUpdatesThresholdAndRoleGrant() public {
        oracle.setMinStakeWei(7 ether);

        vm.deal(reporter, 10 ether);
        vm.prank(reporter);
        oracle.stakeReporter{value: 6 ether}();
        assertFalse(oracle.hasRole(oracle.REPORTER_ROLE(), reporter));

        vm.prank(reporter);
        oracle.stakeReporter{value: 1 ether}();
        assertTrue(oracle.hasRole(oracle.REPORTER_ROLE(), reporter));
    }

    function test_SetMinStakeWeiRevertsForUnauthorizedCaller() public {
        vm.prank(reporter);
        vm.expectRevert();
        oracle.setMinStakeWei(6 ether);
    }

    function test_SetMinStakeWeiRevertsBelowLowerBound() public {
        vm.expectRevert(bytes("min stake out of bounds"));
        oracle.setMinStakeWei(0.5 ether);
    }

    function test_SetMinStakeWeiRevertsAboveCap() public {
        vm.expectRevert();
        oracle.setMinStakeWei(101 ether);
    }

    function test_SetMinStakeWeiEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit MinStakeUpdated(5 ether, 6 ether);
        oracle.setMinStakeWei(6 ether);
    }
}
