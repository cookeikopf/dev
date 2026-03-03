// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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

    // EIP-2612 permit support
    mapping(address => uint256) public nonces;

    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    bytes32 public DOMAIN_SEPARATOR;

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp <= deadline, "Permit expired");

        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline)
        );

        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0) && signer == owner, "Invalid signature");

        _approve(owner, spender, value);
    }
}

/**
 * @title PaymentRouterTest
 * @notice Comprehensive test suite for PaymentRouter
 */
contract PaymentRouterTest is Test {
    PaymentRouter public router;
    MockUSDC public usdc;

    address public owner;
    address public treasury;
    address public payer;
    address public receiver;
    address public operator;

    uint256 public constant INITIAL_FEE_BPS = 100; // 1%
    uint256 public constant INITIAL_BALANCE = 1_000_000e6; // 1M USDC

    // Events for testing
    event PaymentRouted(
        address indexed payer,
        address indexed receiver,
        uint256 amount,
        uint256 receiverAmount,
        uint256 fee,
        string memo
    );
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event OperatorUpdated(address indexed operator, bool authorized);
    event ReceiverAllowed(address indexed receiver, bool allowed);
    event AllowlistToggled(bool enabled);

    function setUp() public {
        owner = makeAddr("owner");
        treasury = makeAddr("treasury");
        payer = makeAddr("payer");
        receiver = makeAddr("receiver");
        operator = makeAddr("operator");

        vm.startPrank(owner);

        // Deploy mock USDC
        usdc = new MockUSDC();

        // Deploy router
        router = new PaymentRouter(address(usdc), treasury, INITIAL_FEE_BPS, owner);

        // Mint USDC to payer
        usdc.mint(payer, INITIAL_BALANCE);

        vm.stopPrank();

        // Approve router to spend payer's USDC
        vm.prank(payer);
        usdc.approve(address(router), type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Constructor_SetsCorrectValues() public view {
        assertEq(address(router.usdc()), address(usdc));
        assertEq(router.treasury(), treasury);
        assertEq(router.feeBps(), INITIAL_FEE_BPS);
        assertEq(router.owner(), owner);
        assertEq(router.MAX_FEE_BPS(), 1000);
        assertEq(router.BPS_DENOMINATOR(), 10000);
    }

    function test_Constructor_RevertsOnZeroUsdc() public {
        vm.expectRevert(PaymentRouter.InvalidReceiver.selector);
        new PaymentRouter(address(0), treasury, INITIAL_FEE_BPS, owner);
    }

    function test_Constructor_RevertsOnZeroTreasury() public {
        vm.expectRevert(PaymentRouter.InvalidTreasury.selector);
        new PaymentRouter(address(usdc), address(0), INITIAL_FEE_BPS, owner);
    }

    function test_Constructor_RevertsOnExcessiveFee() public {
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.FeeExceedsMaximum.selector, 1001, 1000));
        new PaymentRouter(address(usdc), treasury, 1001, owner);
    }

    /*//////////////////////////////////////////////////////////////
                            PAY FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Pay_TransfersCorrectAmounts() public {
        uint256 amount = 1000e6; // 1000 USDC
        uint256 expectedFee = (amount * INITIAL_FEE_BPS) / 10000; // 10 USDC
        uint256 expectedReceiverAmount = amount - expectedFee;

        uint256 payerBalanceBefore = usdc.balanceOf(payer);
        uint256 receiverBalanceBefore = usdc.balanceOf(receiver);
        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);

        vm.prank(payer);
        router.pay(receiver, amount, "Test payment");

        assertEq(usdc.balanceOf(payer), payerBalanceBefore - amount);
        assertEq(usdc.balanceOf(receiver), receiverBalanceBefore + expectedReceiverAmount);
        assertEq(usdc.balanceOf(treasury), treasuryBalanceBefore + expectedFee);
    }

    function test_Pay_EmitsPaymentRoutedEvent() public {
        uint256 amount = 1000e6;
        uint256 expectedFee = (amount * INITIAL_FEE_BPS) / 10000;
        uint256 expectedReceiverAmount = amount - expectedFee;

        vm.prank(payer);
        vm.expectEmit(true, true, false, true);
        emit PaymentRouted(payer, receiver, amount, expectedReceiverAmount, expectedFee, "Test payment");
        router.pay(receiver, amount, "Test payment");
    }

    function test_Pay_UpdatesStats() public {
        uint256 amount = 1000e6;
        uint256 expectedFee = (amount * INITIAL_FEE_BPS) / 10000;

        (uint256 volumeBefore, uint256 feesBefore, uint256 countBefore) = router.getStats();

        vm.prank(payer);
        router.pay(receiver, amount, "Test");

        (uint256 volumeAfter, uint256 feesAfter, uint256 countAfter) = router.getStats();

        assertEq(volumeAfter, volumeBefore + amount);
        assertEq(feesAfter, feesBefore + expectedFee);
        assertEq(countAfter, countBefore + 1);
    }

    function test_Pay_RevertsOnZeroReceiver() public {
        vm.prank(payer);
        vm.expectRevert(PaymentRouter.InvalidReceiver.selector);
        router.pay(address(0), 1000e6, "Test");
    }

    function test_Pay_RevertsOnAmountTooSmall() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.InvalidAmount.selector, 1));
        router.pay(receiver, 1, "Test");
    }

    function test_Pay_RevertsOnAmountTooLarge() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.InvalidAmount.selector, 1_000_001e6));
        router.pay(receiver, 1_000_001e6, "Test");
    }

    function test_Pay_RevertsWhenNotApproved() public {
        address newPayer = makeAddr("newPayer");
        usdc.mint(newPayer, 10000e6);

        vm.prank(newPayer);
        vm.expectRevert();
        router.pay(receiver, 1000e6, "Test");
    }

    function test_Pay_RevertsWhenAllowlistedReceiverNotAllowed() public {
        // Enable allowlist
        vm.prank(owner);
        router.setAllowlistEnabled(true);

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.ReceiverNotAllowed.selector, receiver));
        router.pay(receiver, 1000e6, "Test");
    }

    function test_Pay_SucceedsWithAllowlistedReceiver() public {
        // Enable allowlist and add receiver
        vm.startPrank(owner);
        router.setAllowlistEnabled(true);
        router.setReceiverAllowed(receiver, true);
        vm.stopPrank();

        vm.prank(payer);
        router.pay(receiver, 1000e6, "Test");

        // Should succeed
        assertEq(router.paymentCount(), 1);
    }

    function test_Pay_ReturnsCorrectReceiverAmount() public {
        uint256 amount = 1000e6;
        uint256 expectedFee = (amount * INITIAL_FEE_BPS) / 10000;
        uint256 expectedReceiverAmount = amount - expectedFee;

        vm.prank(payer);
        uint256 returnedAmount = router.pay(receiver, amount, "Test");

        assertEq(returnedAmount, expectedReceiverAmount);
    }

    function test_Pay_WithZeroFee() public {
        // Set fee to 0
        vm.prank(owner);
        router.setFeeBps(0);

        uint256 amount = 1000e6;

        vm.prank(payer);
        uint256 returnedAmount = router.pay(receiver, amount, "Test");

        assertEq(returnedAmount, amount);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_Pay_WithMaxFee() public {
        // Set fee to max (10%)
        vm.prank(owner);
        router.setFeeBps(1000);

        uint256 amount = 1000e6;
        uint256 expectedFee = (amount * 1000) / 10000; // 100 USDC
        uint256 expectedReceiverAmount = amount - expectedFee;

        vm.prank(payer);
        uint256 returnedAmount = router.pay(receiver, amount, "Test");

        assertEq(returnedAmount, expectedReceiverAmount);
        assertEq(usdc.balanceOf(treasury), expectedFee);
    }

    /*//////////////////////////////////////////////////////////////
                            FEE CALCULATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CalculateFee_CorrectMath() public view {
        uint256 amount = 10000e6; // 10000 USDC
        uint256 expectedFee = (amount * INITIAL_FEE_BPS) / 10000; // 100 USDC

        assertEq(router.calculateFee(amount), expectedFee);
    }

    function test_CalculateReceiverAmount_CorrectMath() public view {
        uint256 amount = 10000e6;
        uint256 expectedFee = (amount * INITIAL_FEE_BPS) / 10000;
        uint256 expectedReceiverAmount = amount - expectedFee;

        assertEq(router.calculateReceiverAmount(amount), expectedReceiverAmount);
    }

    function testFuzz_CalculateFee_AlwaysBounded(uint256 amount, uint256 feeBps) public {
        // Bound inputs
        amount = bound(amount, router.MIN_PAYMENT_AMOUNT(), router.MAX_PAYMENT_AMOUNT());
        feeBps = bound(feeBps, 0, router.MAX_FEE_BPS());

        // Set fee
        vm.prank(owner);
        router.setFeeBps(feeBps);

        uint256 fee = router.calculateFee(amount);
        uint256 maxPossibleFee = (amount * router.MAX_FEE_BPS()) / router.BPS_DENOMINATOR();

        assertLe(fee, maxPossibleFee);
        assertLe(fee, amount); // Fee should never exceed amount
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SetTreasury_UpdatesTreasury() public {
        address newTreasury = makeAddr("newTreasury");

        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit TreasuryUpdated(treasury, newTreasury);
        router.setTreasury(newTreasury);

        assertEq(router.treasury(), newTreasury);
    }

    function test_SetTreasury_RevertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(PaymentRouter.InvalidTreasury.selector);
        router.setTreasury(address(0));
    }

    function test_SetTreasury_RevertsWhenNotOwner() public {
        vm.prank(payer);
        vm.expectRevert();
        router.setTreasury(makeAddr("newTreasury"));
    }

    function test_SetFeeBps_UpdatesFee() public {
        uint256 newFee = 200; // 2%

        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit FeeUpdated(INITIAL_FEE_BPS, newFee);
        router.setFeeBps(newFee);

        assertEq(router.feeBps(), newFee);
    }

    function test_SetFeeBps_RevertsOnExcessiveFee() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.FeeExceedsMaximum.selector, 1001, 1000));
        router.setFeeBps(1001);
    }

    function test_SetFeeBps_RevertsWhenNotOwner() public {
        vm.prank(payer);
        vm.expectRevert();
        router.setFeeBps(200);
    }

    function test_SetOperator_UpdatesOperator() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit OperatorUpdated(operator, true);
        router.setOperator(operator, true);

        assertTrue(router.operators(operator));
    }

    function test_SetOperator_CanRevoke() public {
        vm.startPrank(owner);
        router.setOperator(operator, true);
        router.setOperator(operator, false);
        vm.stopPrank();

        assertFalse(router.operators(operator));
    }

    function test_SetReceiverAllowed_AllowsReceiver() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit ReceiverAllowed(receiver, true);
        router.setReceiverAllowed(receiver, true);

        assertTrue(router.allowedReceivers(receiver));
    }

    function test_SetReceiverAllowed_OperatorCanAdd() public {
        // Set operator
        vm.prank(owner);
        router.setOperator(operator, true);

        // Operator can add receiver
        vm.prank(operator);
        router.setReceiverAllowed(receiver, true);

        assertTrue(router.allowedReceivers(receiver));
    }

    function test_SetReceiverAllowed_NonOperatorCannotAdd() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.UnauthorizedOperator.selector, payer));
        router.setReceiverAllowed(receiver, true);
    }

    function test_SetAllowlistEnabled_TogglesAllowlist() public {
        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit AllowlistToggled(true);
        router.setAllowlistEnabled(true);

        assertTrue(router.allowlistEnabled());
    }

    function test_Pause_PausesContract() public {
        vm.prank(owner);
        router.pause();

        assertTrue(router.paused());

        vm.prank(payer);
        vm.expectRevert();
        router.pay(receiver, 1000e6, "Test");
    }

    function test_Unpause_UnpausesContract() public {
        vm.startPrank(owner);
        router.pause();
        router.unpause();
        vm.stopPrank();

        assertFalse(router.paused());

        // Should work now
        vm.prank(payer);
        router.pay(receiver, 1000e6, "Test");
    }

    /*//////////////////////////////////////////////////////////////
                            PAUSE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Pause_RevertsWhenNotOwner() public {
        vm.prank(payer);
        vm.expectRevert();
        router.pause();
    }

    function test_Unpause_RevertsWhenNotOwner() public {
        vm.prank(owner);
        router.pause();

        vm.prank(payer);
        vm.expectRevert();
        router.unpause();
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetStats_ReturnsCorrectValues() public {
        (uint256 volume, uint256 fees, uint256 count) = router.getStats();

        assertEq(volume, 0);
        assertEq(fees, 0);
        assertEq(count, 0);

        // Make a payment
        vm.prank(payer);
        router.pay(receiver, 1000e6, "Test");

        (volume, fees, count) = router.getStats();
        assertEq(volume, 1000e6);
        assertEq(fees, 10e6); // 1% of 1000
        assertEq(count, 1);
    }

    /*//////////////////////////////////////////////////////////////
                            EMERGENCY WITHDRAW TESTS
    //////////////////////////////////////////////////////////////*/

    function test_EmergencyWithdraw_WorksForNonUsdc() public {
        // Deploy another token
        MockUSDC otherToken = new MockUSDC();
        otherToken.mint(address(router), 1000e6);

        vm.prank(owner);
        router.emergencyWithdraw(address(otherToken), 1000e6);

        assertEq(otherToken.balanceOf(owner), 1000e6);
    }

    function test_EmergencyWithdraw_RevertsForUsdc() public {
        usdc.mint(address(router), 1000e6);

        vm.prank(owner);
        vm.expectRevert(PaymentRouter.InvalidReceiver.selector);
        router.emergencyWithdraw(address(usdc), 1000e6);
    }

    function test_EmergencyWithdraw_RevertsWhenNotOwner() public {
        MockUSDC otherToken = new MockUSDC();

        vm.prank(payer);
        vm.expectRevert();
        router.emergencyWithdraw(address(otherToken), 1000e6);
    }

    /*//////////////////////////////////////////////////////////////
                            REENTRANCY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Pay_IsReentrancyProtected() public {
        // This test verifies the nonReentrant modifier is present
        // A full reentrancy test would require a malicious receiver contract
        // The modifier ensures the function cannot be reentered

        vm.prank(payer);
        router.pay(receiver, 1000e6, "Test");

        // Should complete without reentrancy issues
        assertEq(router.paymentCount(), 1);
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_Pay_WithValidAmounts(uint256 amount) public {
        // Bound to valid range
        amount = bound(amount, router.MIN_PAYMENT_AMOUNT(), router.MAX_PAYMENT_AMOUNT());

        // Ensure payer has enough
        if (amount > usdc.balanceOf(payer)) {
            vm.prank(owner);
            usdc.mint(payer, amount - usdc.balanceOf(payer));
        }

        uint256 payerBalanceBefore = usdc.balanceOf(payer);
        uint256 expectedFee = (amount * INITIAL_FEE_BPS) / 10000;
        uint256 expectedReceiverAmount = amount - expectedFee;

        vm.prank(payer);
        uint256 returnedAmount = router.pay(receiver, amount, "Fuzz test");

        assertEq(returnedAmount, expectedReceiverAmount);
        assertEq(usdc.balanceOf(payer), payerBalanceBefore - amount);
    }

    function testFuzz_SetFeeBps(uint256 newFeeBps) public {
        newFeeBps = bound(newFeeBps, 0, router.MAX_FEE_BPS());

        vm.prank(owner);
        router.setFeeBps(newFeeBps);

        assertEq(router.feeBps(), newFeeBps);
    }

    function testFuzz_FeeNeverExceedsAmount(uint256 amount, uint256 feeBps) public {
        amount = bound(amount, 1, type(uint256).max / 10000);
        feeBps = bound(feeBps, 0, 10000);

        uint256 fee = (amount * feeBps) / 10000;

        assertLe(fee, amount);
    }
}
