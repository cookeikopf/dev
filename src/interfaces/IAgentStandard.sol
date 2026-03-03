// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title IAgentStandard
/// @notice Minimal open integration surface for third-party wallets/marketplaces.
interface IAgentStandard {
    /// @notice Returns current blended score for an agent.
    function blendedScore(address agent) external view returns (uint256);

    /// @notice Returns current dynamic credit limit for an agent.
    function creditLimit(address agent) external view returns (uint256);

    /// @notice Returns principal outstanding across all active loans for an agent.
    function exposureOf(address agent) external view returns (uint256);
}

