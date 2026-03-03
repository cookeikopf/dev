// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IX402AutoRepayHook} from "../interfaces/IX402AutoRepayHook.sol";

/// @title MockX402Hook
/// @notice Stores per-loan pledge config for tests.
contract MockX402Hook is IX402AutoRepayHook {
    mapping(address => mapping(uint256 => uint256)) public pledgeBps;

    function registerPledge(address agent, uint256 loanId, uint256 deductionBps) external {
        pledgeBps[agent][loanId] = deductionBps;
    }

    function clearPledge(address agent, uint256 loanId) external {
        pledgeBps[agent][loanId] = 0;
    }
}

