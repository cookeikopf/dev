// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import "forge-std/console.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";

contract DeploySepolia is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying AgentLink contracts to Base Sepolia...");
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy AgentIdentity
        AgentIdentity agentIdentity = new AgentIdentity(
            "AgentLink Identity",
            "ALINK",
            "https://agent.link/metadata/",
            deployer
        );
        console.log("AgentIdentity deployed at:", address(agentIdentity));
        
        // Base Sepolia USDC address
        address usdc = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
        address treasury = deployer;
        uint256 feeBps = 100; // 1%
        
        // Deploy PaymentRouter
        PaymentRouter paymentRouter = new PaymentRouter(
            usdc,
            treasury,
            feeBps,
            deployer
        );
        console.log("PaymentRouter deployed at:", address(paymentRouter));
        
        // Enable public minting
        agentIdentity.setPublicMintingEnabled(true);
        console.log("Public minting enabled");
        
        // Authorize PaymentRouter as minter
        agentIdentity.setAuthorizedMinter(address(paymentRouter), true);
        console.log("PaymentRouter authorized as minter");
        
        vm.stopBroadcast();
        
        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("AgentIdentity:", address(agentIdentity));
        console.log("PaymentRouter:", address(paymentRouter));
        console.log("USDC:", usdc);
    }
}
