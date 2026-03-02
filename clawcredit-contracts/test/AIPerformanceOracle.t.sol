// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import {AIPerformanceOracle} from "../src/AIPerformanceOracle.sol";

contract AIPerformanceOracleTest is Test {
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
}
