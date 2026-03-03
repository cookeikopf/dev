// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {ClawCreditAgentStandardV3} from "../src/ClawCreditAgentStandardV3.sol";
import {ERC8004ReputationRegistry} from "../src/ERC8004ReputationRegistry.sol";

/// @title OvernightTest
/// @notice Fund pool with USDC for testing
contract OvernightTest is Script {
    address constant MOCK_USDC = 0x05c837d06053E06E029DC814D1b8D79c1823443E;
    address constant CLAWCREDIT = 0x750ed64Fd9EB849A8f1af818308CA777Cd79B57a;

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        console2.log("========================================");
        console2.log("CLAWCREDIT OVERNIGHT TEST");
        console2.log("========================================");

        vm.startBroadcast(deployerPk);

        MockUSDC usdc = MockUSDC(MOCK_USDC);
        ClawCreditAgentStandardV3 clawCredit = ClawCreditAgentStandardV3(CLAWCREDIT);

        // 1. Mint 10,000 USDC to deployer
        usdc.mint(deployer, 10_000e6);
        console2.log("Minted 10,000 USDC");

        // 2. Approve pool
        usdc.approve(CLAWCREDIT, type(uint256).max);
        console2.log("Approved pool to spend USDC");

        // 3. Deposit into tranches
        clawCredit.depositTranche(clawCredit.TRANCHE_SENIOR(), 4_000e6);
        clawCredit.depositTranche(clawCredit.TRANCHE_MEZZ(), 3_000e6);
        clawCredit.depositTranche(clawCredit.TRANCHE_JUNIOR(), 3_000e6);
        console2.log("Deposited 10,000 USDC into pool");

        // 4. Check balances
        (uint256 senior,,) = clawCredit.trancheState(0);
        (uint256 mezz,,) = clawCredit.trancheState(1);
        (uint256 junior,,) = clawCredit.trancheState(2);

        console2.log("");
        console2.log("Pool Status:");
        console2.log("- Senior: ", senior);
        console2.log("- Mezz:   ", mezz);
        console2.log("- Junior: ", junior);
        console2.log("- Total:  ", senior + mezz + junior);

        vm.stopBroadcast();

        console2.log("");
        console2.log("POOL FUNDED AND READY!");
    }
}
