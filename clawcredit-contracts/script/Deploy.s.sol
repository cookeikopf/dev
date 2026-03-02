// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {ClawCreditUltimateV2} from "../src/ClawCreditUltimateV2.sol";

/// @title Deploy
/// @notice Deploys TimelockController + ClawCreditUltimateV2 for Base networks.
contract Deploy is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        address usdc = vm.envAddress("USDC_ADDRESS");
        address reputation = vm.envAddress("REPUTATION_REGISTRY");
        address usdcFeed = vm.envAddress("USDC_USD_FEED");
        address aiFeed = vm.envAddress("AI_SCORE_FEED");
        address guardian = vm.envAddress("GUARDIAN_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address x402Operator = vm.envAddress("X402_OPERATOR");
        address x402Hook = vm.envAddress("X402_HOOK");
        uint256 timelockDelay = vm.envOr("TIMELOCK_DELAY_SECONDS", uint256(2 days));

        vm.startBroadcast(deployerPk);

        address[] memory proposers = new address[](1);
        proposers[0] = vm.envOr("TIMELOCK_PROPOSER", deployer);

        address[] memory executors = new address[](1);
        executors[0] = vm.envOr("TIMELOCK_EXECUTOR", deployer);

        TimelockController timelock =
            new TimelockController(timelockDelay, proposers, executors, deployer);

        ClawCreditUltimateV2 clawCredit = new ClawCreditUltimateV2(
            address(timelock),
            guardian,
            treasury,
            x402Operator,
            usdc,
            reputation,
            usdcFeed,
            aiFeed,
            x402Hook
        );

        vm.stopBroadcast();

        console2.log("Deployer:", deployer);
        console2.log("TimelockController:", address(timelock));
        console2.log("ClawCreditUltimateV2:", address(clawCredit));
    }
}

