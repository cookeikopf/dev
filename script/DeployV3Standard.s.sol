// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {ClawCreditAgentStandardV3} from "../src/ClawCreditAgentStandardV3.sol";

/// @title DeployV3Standard
/// @notice Deploy Timelock + ClawCreditAgentStandardV3.
contract DeployV3Standard is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        address usdc = vm.envAddress("USDC_ADDRESS");
        address reputation = vm.envAddress("REPUTATION_REGISTRY");
        address usdcFeed = vm.envAddress("USDC_USD_FEED");
        address aiFeed = vm.envAddress("AI_SCORE_FEED");
        address guardian = vm.envAddress("GUARDIAN_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        uint256 timelockDelay = vm.envOr("TIMELOCK_DELAY_SECONDS", uint256(2 days));

        vm.startBroadcast(deployerPk);

        address[] memory proposers = new address[](1);
        proposers[0] = vm.envOr("TIMELOCK_PROPOSER", deployer);

        address[] memory executors = new address[](1);
        executors[0] = vm.envOr("TIMELOCK_EXECUTOR", deployer);

        TimelockController timelock = new TimelockController(timelockDelay, proposers, executors, deployer);

        ClawCreditAgentStandardV3 v3 =
            new ClawCreditAgentStandardV3(address(timelock), guardian, treasury, usdc, reputation, usdcFeed, aiFeed);

        vm.stopBroadcast();

        console2.log("Deployer:", deployer);
        console2.log("TimelockController:", address(timelock));
        console2.log("ClawCreditAgentStandardV3:", address(v3));
    }
}

