// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import {DeployV3Standard} from "./DeployV3Standard.s.sol";

/// @title Deploy (Deprecated wrapper)
/// @notice DEPRECATED: legacy V2 deployment removed from production path. Use DeployV3Standard only.
contract Deploy is Script {
    function run() external {
        DeployV3Standard deployer = new DeployV3Standard();
        deployer.run();
    }
}
