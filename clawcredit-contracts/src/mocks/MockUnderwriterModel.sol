// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IAgentUnderwriterModel} from "../interfaces/IAgentUnderwriterModel.sol";

/// @title MockUnderwriterModel
/// @notice Deterministic underwriter quote model for tests.
contract MockUnderwriterModel is IAgentUnderwriterModel {
    uint256 public baseAprBps = 1200;
    uint256 public confidenceBps = 7000;
    uint256 public maxAmount = 500e6;

    function setQuoteParams(uint256 aprBps, uint256 confidence, uint256 maxLoan) external {
        baseAprBps = aprBps;
        confidenceBps = confidence;
        maxAmount = maxLoan;
    }

    function quote(
        address,
        uint256,
        uint256,
        uint256 blendedScore,
        uint256 taskCoverageBps
    ) external view returns (uint256 aprBps, uint256 confidence, uint256 maxLoan) {
        uint256 discount = (blendedScore + taskCoverageBps) / 50;
        if (discount > 400) discount = 400;
        aprBps = baseAprBps > discount ? baseAprBps - discount : 700;
        confidence = confidenceBps;
        maxLoan = maxAmount;
    }
}

