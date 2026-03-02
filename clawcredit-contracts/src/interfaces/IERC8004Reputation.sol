// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title IERC8004Reputation
/// @notice Minimal ERC-8004-style reputation registry interface used by ClawCredit.
interface IERC8004Reputation {
    /// @notice Reputation data for an AI agent.
    struct ReputationData {
        uint256 score; // Expected scale: 0-10000 (10000 = max trust)
        uint256 successfulRepayments;
        uint256 defaults;
        bool exists;
    }

    /// @notice Returns full reputation data for an agent.
    function getReputation(address agent) external view returns (ReputationData memory);

    /// @notice Returns score only, in 0-10000 scale.
    function getScore(address agent) external view returns (uint256);

    /// @notice Updates repayment performance for an agent.
    function updateReputation(address agent, bool repaid, uint256 amount) external;
}
