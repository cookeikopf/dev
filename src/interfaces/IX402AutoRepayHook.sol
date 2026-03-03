// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title IX402AutoRepayHook
/// @notice x402 future-earnings pledge hook integration.
interface IX402AutoRepayHook {
    /// @notice Registers earnings deduction percentage for an active loan.
    function registerPledge(address agent, uint256 loanId, uint256 deductionBps) external;

    /// @notice Clears pledge for a closed/defaulted loan.
    function clearPledge(address agent, uint256 loanId) external;
}
