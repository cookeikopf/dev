// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC8004Reputation} from "../interfaces/IERC8004Reputation.sol";

/// @title MockERC8004Reputation
/// @notice Minimal mutable ERC-8004 style registry for tests.
contract MockERC8004Reputation is IERC8004Reputation {
    mapping(address => ReputationData) private _rep;

    function setReputation(address agent, uint256 score, bool exists) external {
        ReputationData storage r = _rep[agent];
        r.score = score;
        r.exists = exists;
    }

    function getReputation(address agent) external view returns (ReputationData memory) {
        return _rep[agent];
    }

    function getScore(address agent) external view returns (uint256) {
        return _rep[agent].score;
    }

    function updateReputation(address agent, bool repaid, uint256) external {
        ReputationData storage r = _rep[agent];
        if (!r.exists) {
            r.exists = true;
            r.score = 5_000;
        }
        if (repaid) {
            r.successfulRepayments += 1;
            if (r.score < 10_000) {
                uint256 next = r.score + 300;
                r.score = next > 10_000 ? 10_000 : next;
            }
        } else {
            r.defaults += 1;
            r.score = r.score > 800 ? r.score - 800 : 0;
        }
    }
}

