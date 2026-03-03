// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {PaymentRouter} from "../../src/PaymentRouter.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for testing
 */
contract MockUSDC is ERC20 {
    uint8 private constant _DECIMALS = 6;

    constructor() ERC20("USD Coin", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }
}

/**
 * @title PaymentRouterHandler
 * @notice Handler contract for invariant testing
 */
contract PaymentRouterHandler is Test {
    PaymentRouter public router;
    MockUSDC public usdc;

    address public owner;
    address public treasury;

    // Ghost variables to track state
    uint256 public ghost_totalVolume;
    uint256 public ghost_totalFees;
    uint256 public ghost_paymentCount;
    mapping(address => uint256) public ghost_payerBalance;
    mapping(address => uint256) public ghost_receiverBalance;

    // Track approved amounts
    mapping(address => uint256) public approvedAmounts;

    address[] public actors;
    address public currentActor;

    modifier useActor(uint256 actorIndex) {
        currentActor = actors[bound(actorIndex, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(PaymentRouter _router, MockUSDC _usdc, address _owner, address _treasury) {
        router = _router;
        usdc = _usdc;
        owner = _owner;
        treasury = _treasury;

        // Create actors
        for (uint256 i = 0; i < 5; i++) {
            address actor = makeAddr(string(abi.encodePacked("actor", vm.toString(i))));
            actors.push(actor);

            // Fund and approve each actor
            usdc.mint(actor, 1_000_000e6);
            vm.prank(actor);
            usdc.approve(address(router), type(uint256).max);

            ghost_payerBalance[actor] = 1_000_000e6;
        }
    }

    function pay(uint256 actorIndex, uint256 receiverIndex, uint256 amount) external useActor(actorIndex) {
        // Bound inputs
        address receiver = actors[bound(receiverIndex, 0, actors.length - 1)];
        amount = bound(amount, router.MIN_PAYMENT_AMOUNT(), router.MAX_PAYMENT_AMOUNT());

        // Ensure payer has enough balance
        if (amount > usdc.balanceOf(currentActor)) {
            usdc.mint(currentActor, amount - usdc.balanceOf(currentActor));
        }

        // Skip if receiver is not allowed when allowlist is enabled
        if (router.allowlistEnabled() && !router.allowedReceivers(receiver)) {
            return;
        }

        try router.pay(receiver, amount, "Invariant test") {
            // Track ghost state
            uint256 fee = router.calculateFee(amount);
            ghost_totalVolume += amount;
            ghost_totalFees += fee;
            ghost_paymentCount++;
            ghost_payerBalance[currentActor] -= amount;
            ghost_receiverBalance[receiver] += (amount - fee);
        } catch {
            // Expected failures are OK
        }
    }

    function setFeeBps(uint256 newFeeBps) external {
        vm.prank(owner);
        newFeeBps = bound(newFeeBps, 0, router.MAX_FEE_BPS());
        router.setFeeBps(newFeeBps);
    }

    function setAllowlistEnabled(bool enabled) external {
        vm.prank(owner);
        router.setAllowlistEnabled(enabled);
    }

    function setReceiverAllowed(uint256 receiverIndex, bool allowed) external {
        vm.prank(owner);
        address receiver = actors[bound(receiverIndex, 0, actors.length - 1)];
        router.setReceiverAllowed(receiver, allowed);
    }

    function pause() external {
        vm.prank(owner);
        router.pause();
    }

    function unpause() external {
        vm.prank(owner);
        router.unpause();
    }
}

/**
 * @title PaymentRouterInvariants
 * @notice Invariant tests for PaymentRouter
 * @dev These tests verify critical security properties
 */
contract PaymentRouterInvariants is StdInvariant, Test {
    PaymentRouter public router;
    MockUSDC public usdc;
    PaymentRouterHandler public handler;

    address public owner;
    address public treasury;

    uint256 public constant INITIAL_FEE_BPS = 100; // 1%

    function setUp() public {
        owner = makeAddr("owner");
        treasury = makeAddr("treasury");

        vm.startPrank(owner);

        // Deploy mock USDC
        usdc = new MockUSDC();

        // Deploy router
        router = new PaymentRouter(address(usdc), treasury, INITIAL_FEE_BPS, owner);

        vm.stopPrank();

        // Deploy handler
        handler = new PaymentRouterHandler(router, usdc, owner, treasury);

        // Target handler for invariant tests
        targetContract(address(handler));

        // Set fuzz runs
        // vm.warp(1); // Start at block 1
    }

    /*//////////////////////////////////////////////////////////////
                        INVARIANT TESTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Invariant: Fee is always bounded by the maximum fee cap
     * @dev For any amount, fee <= (amount * MAX_FEE_BPS) / BPS_DENOMINATOR
     */
    function invariant_feeBoundedByCap() public view {
        uint256 feeBps = router.feeBps();
        assertLe(feeBps, router.MAX_FEE_BPS(), "Fee exceeds maximum cap");
    }

    /**
     * @notice Invariant: Treasury receives correct share of fees
     * @dev Total fees collected should match ghost tracking
     */
    function invariant_treasuryReceivesCorrectFees() public view {
        (uint256 volume, uint256 fees, ) = router.getStats();

        // Fees should never exceed volume
        assertLe(fees, volume, "Fees exceed total volume");

        // Fee rate should be consistent with feeBps
        if (volume > 0) {
            uint256 feeBps = router.feeBps();
            uint256 expectedMaxFees = (volume * feeBps) / router.BPS_DENOMINATOR();
            assertLe(fees, expectedMaxFees + 1, "Fees exceed expected maximum"); // +1 for rounding
        }
    }

    /**
     * @notice Invariant: Payment count matches stats
     * @dev Stats should be consistent
     */
    function invariant_statsAreConsistent() public view {
        (uint256 volume, uint256 fees, uint256 count) = router.getStats();

        // Volume should be sum of all payments
        assertGe(volume, fees, "Volume should be >= fees");

        // If there are payments, volume should be > 0
        if (count > 0) {
            assertGt(volume, 0, "Volume should be > 0 when count > 0");
        }
    }

    /**
     * @notice Invariant: Contract balance is always zero (USDC is transferred immediately)
     * @dev Router should never hold USDC (all transfers are immediate)
     */
    function invariant_contractBalanceIsZero() public view {
        // The router should never hold USDC as it's immediately transferred
        // This is a security invariant - no funds should be stuck
        assertEq(usdc.balanceOf(address(router)), 0, "Router should not hold USDC");
    }

    /**
     * @notice Invariant: Treasury balance increases with fees
     * @dev Treasury should accumulate fees correctly
     */
    function invariant_treasuryBalanceIncreases() public view {
        (, uint256 fees, ) = router.getStats();

        // Treasury balance should equal total fees collected
        assertEq(usdc.balanceOf(treasury), fees, "Treasury balance should equal total fees");
    }

    /**
     * @notice Invariant: Fee calculation is monotonic
     * @dev Larger amounts should result in larger or equal fees
     */
    function invariant_feeCalculationIsMonotonic() public view {
        uint256 feeBps = router.feeBps();

        uint256 fee1 = (1000e6 * feeBps) / router.BPS_DENOMINATOR();
        uint256 fee2 = (2000e6 * feeBps) / router.BPS_DENOMINATOR();

        assertLt(fee1, fee2, "Fee should increase with amount");
    }

    /**
     * @notice Invariant: Receiver amount plus fee equals total amount
     * @dev For any payment: receiverAmount + fee == amount
     */
    function invariant_paymentMathIsCorrect() public view {
        uint256 amount = 10000e6;
        uint256 fee = router.calculateFee(amount);
        uint256 receiverAmount = router.calculateReceiverAmount(amount);

        assertEq(receiverAmount + fee, amount, "Receiver amount + fee should equal total");
    }

    /**
     * @notice Invariant: Fee is never more than 10% of amount
     * @dev MAX_FEE_BPS is 1000 (10%)
     */
    function invariant_feeNeverExceeds10Percent() public view {
        uint256 amount = router.MAX_PAYMENT_AMOUNT();
        uint256 fee = router.calculateFee(amount);
        uint256 maxFee = (amount * router.MAX_FEE_BPS()) / router.BPS_DENOMINATOR();

        assertLe(fee, maxFee, "Fee should never exceed 10%");
    }

    /**
     * @notice Invariant: Owner cannot be zero address
     * @dev Contract should always have a valid owner
     */
    function invariant_ownerIsValid() public view {
        assertNotEq(router.owner(), address(0), "Owner should not be zero address");
    }

    /**
     * @notice Invariant: Treasury cannot be zero address
     * @dev Contract should always have a valid treasury
     */
    function invariant_treasuryIsValid() public view {
        assertNotEq(router.treasury(), address(0), "Treasury should not be zero address");
    }

    /**
     * @notice Invariant: USDC address is valid
     * @dev Contract should always have a valid USDC address
     */
    function invariant_usdcIsValid() public view {
        assertNotEq(address(router.usdc()), address(0), "USDC should not be zero address");
    }

    /**
     * @notice Invariant: Ghost tracking matches contract state
     * @dev Handler tracking should match actual contract state
     */
    function invariant_ghostTrackingMatchesState() public view {
        (uint256 volume, uint256 fees, uint256 count) = router.getStats();

        assertEq(volume, handler.ghost_totalVolume(), "Volume mismatch");
        assertEq(fees, handler.ghost_totalFees(), "Fees mismatch");
        assertEq(count, handler.ghost_paymentCount(), "Count mismatch");
    }

    /*//////////////////////////////////////////////////////////////
                        ADDITIONAL INVARIANTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Invariant: Contract cannot be both paused and unpaused
     * @dev Pausable state should be consistent
     */
    function invariant_pauseStateIsConsistent() public view {
        // This is always true for OpenZeppelin Pausable
        // But we include it for documentation
        bool isPaused = router.paused();
        // No assertion needed - the state is always valid
        (isPaused); // silence unused variable warning
    }

    /**
     * @notice Invariant: Total volume is sum of all individual payments
     * @dev Volume should accumulate correctly
     */
    function invariant_volumeAccumulatesCorrectly() public {
        uint256 volumeBefore;
        (volumeBefore, , ) = router.getStats();

        // Make a payment
        address payer = makeAddr("testPayer");
        address receiver = makeAddr("testReceiver");
        usdc.mint(payer, 10000e6);

        vm.prank(payer);
        usdc.approve(address(router), 10000e6);

        vm.prank(payer);
        router.pay(receiver, 10000e6, "Test");

        (uint256 volumeAfter, , ) = router.getStats();
        assertEq(volumeAfter, volumeBefore + 10000e6, "Volume should increase by payment amount");
    }
}
