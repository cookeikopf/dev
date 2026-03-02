// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";

/// @title MockAggregator
/// @notice Chainlink AggregatorV3 compatible mock.
contract MockAggregator is AggregatorV3Interface {
    int256 private _answer;
    uint8 private _decimals;
    uint80 private _round;
    uint256 private _updatedAt;

    constructor(uint8 decimals_, int256 initialAnswer) {
        _decimals = decimals_;
        _answer = initialAnswer;
        _round = 1;
        _updatedAt = block.timestamp;
    }

    function setAnswer(int256 newAnswer) external {
        _answer = newAnswer;
        _round += 1;
        _updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 ts) external {
        _updatedAt = ts;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_round, _answer, _updatedAt, _updatedAt, _round);
    }
}

