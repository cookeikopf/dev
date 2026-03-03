// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";

/**
 * @title DeployPaymentRouter
 * @notice Deployment script for PaymentRouter contract
 * @dev Deploys to Base Sepolia testnet
 */
contract DeployPaymentRouter is Script {
    // Base Sepolia USDC address
    address public constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // Fee configuration
    uint256 public constant INITIAL_FEE_BPS = 100; // 1%

    function run() external returns (PaymentRouter router) {
        // Get deployment parameters from environment
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address owner = vm.envAddress("OWNER_ADDRESS");

        require(treasury != address(0), "TREASURY_ADDRESS not set");
        require(owner != address(0), "OWNER_ADDRESS not set");

        console2.log("Deploying PaymentRouter...");
        console2.log("  USDC:", USDC_BASE_SEPOLIA);
        console2.log("  Treasury:", treasury);
        console2.log("  Initial Fee BPS:", INITIAL_FEE_BPS);
        console2.log("  Owner:", owner);

        vm.startBroadcast();

        router = new PaymentRouter(
            USDC_BASE_SEPOLIA,
            treasury,
            INITIAL_FEE_BPS,
            owner
        );

        vm.stopBroadcast();

        console2.log("PaymentRouter deployed at:", address(router));

        // Log deployment info for verification
        console2.log("\n=== Verification Command ===");
        console2.log(
            string.concat(
                "forge verify-contract ",
                vm.toString(address(router)),
                " src/PaymentRouter.sol:PaymentRouter ",
                "--chain base-sepolia ",
                "--constructor-args ",
                vm.toString(abi.encode(USDC_BASE_SEPOLIA, treasury, INITIAL_FEE_BPS, owner))
            )
        );

        return router;
    }
}

/**
 * @title DeployPaymentRouterLocal
 * @notice Local deployment script for testing
 */
contract DeployPaymentRouterLocal is Script {
    function run() external returns (PaymentRouter router, address mockUsdc) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deploying to local network...");
        console2.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock USDC for local testing
        MockUSDC mock = new MockUSDC();
        mockUsdc = address(mock);

        console2.log("Mock USDC deployed at:", mockUsdc);

        // Deploy PaymentRouter
        router = new PaymentRouter(
            mockUsdc,
            deployer, // Treasury is deployer for local testing
            100, // 1% fee
            deployer
        );

        // Mint some USDC for testing
        mock.mint(deployer, 1_000_000e6);

        vm.stopBroadcast();

        console2.log("PaymentRouter deployed at:", address(router));

        return (router, mockUsdc);
    }
}

/**
 * @title MockUSDC
 * @notice Mock USDC for local testing
 */
contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 public totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        balanceOf[from] -= amount;
        allowance[from][msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
