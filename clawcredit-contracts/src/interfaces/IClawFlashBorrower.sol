// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title IClawFlashBorrower
/// @notice Callback interface for ClawCredit flash loans.
interface IClawFlashBorrower {
    /// @notice Must return `keccak256("ClawCreditFlashBorrower.onFlashLoan")`.
    function onFlashLoan(
        address initiator,
        address asset,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32);
}
