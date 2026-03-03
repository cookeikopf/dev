// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";

/// @title Deploy (Deprecated Sentinel)
/// @notice DEPRECATED: this script intentionally reverts to prevent accidental legacy deployments.
contract Deploy is Script {
    function run() external pure {
        revert("Deploy.s.sol deprecated: Use DeployV3Standard.s.sol");
    }
}
