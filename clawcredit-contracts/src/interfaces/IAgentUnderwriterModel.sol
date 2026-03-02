// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title IAgentUnderwriterModel
/// @notice Pluggable risk model interface for ClawCredit Agent Standard.
interface IAgentUnderwriterModel {
    /// @notice Returns quote data for a potential loan.
    /// @param agent Borrower address.
    /// @param amount Requested principal in USDC units.
    /// @param tenorDays Requested tenor in days.
    /// @param blendedScore Protocol blended score (0-10000).
    /// @param taskCoverageBps Receivable coverage for task-backed loans (0-10000+).
    /// @return aprBps Loan APR in basis points.
    /// @return confidenceBps Quote confidence in basis points.
    /// @return maxAmount Maximum amount approved by this model.
    function quote(
        address agent,
        uint256 amount,
        uint256 tenorDays,
        uint256 blendedScore,
        uint256 taskCoverageBps
    ) external view returns (uint256 aprBps, uint256 confidenceBps, uint256 maxAmount);
}

