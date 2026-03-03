// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PaymentRouter
 * @notice USDC micropayments with fee splitting for AgentLink protocol
 * @dev Routes payments from payer to receiver with treasury fee deduction
 * @custom:security-contact security@agentlink.io
 */
contract PaymentRouter is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Maximum fee in basis points (10%)
    uint256 public constant MAX_FEE_BPS = 1000;

    /// @notice Basis points denominator (100%)
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Minimum payment amount (1 USDC = 1e6)
    uint256 public constant MIN_PAYMENT_AMOUNT = 1e4; // 0.01 USDC

    /// @notice Maximum payment amount (1,000,000 USDC)
    uint256 public constant MAX_PAYMENT_AMOUNT = 1_000_000e6;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice USDC token contract
    IERC20 public immutable usdc;

    /// @notice Treasury address for fee collection
    address public treasury;

    /// @notice Current fee in basis points
    uint256 public feeBps;

    /// @notice Total fees collected by treasury
    uint256 public totalFeesCollected;

    /// @notice Total payment volume routed
    uint256 public totalVolume;

    /// @notice Number of payments routed
    uint256 public paymentCount;

    /// @notice Mapping of authorized operators
    mapping(address => bool) public operators;

    /// @notice Mapping of allowed receiver addresses
    mapping(address => bool) public allowedReceivers;

    /// @notice Whether receiver allowlist is enforced
    bool public allowlistEnabled;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a payment is successfully routed
    /// @param payer Address that initiated the payment
    /// @param receiver Address that received the payment
    /// @param amount Total amount transferred from payer
    /// @param receiverAmount Amount received by receiver (after fee)
    /// @param fee Amount collected as fee
    /// @param memo Optional payment memo/reference
    event PaymentRouted(
        address indexed payer,
        address indexed receiver,
        uint256 amount,
        uint256 receiverAmount,
        uint256 fee,
        string memo
    );

    /// @notice Emitted when treasury address is updated
    /// @param oldTreasury Previous treasury address
    /// @param newTreasury New treasury address
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @notice Emitted when fee is updated
    /// @param oldFeeBps Previous fee in basis points
    /// @param newFeeBps New fee in basis points
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    /// @notice Emitted when operator status is changed
    /// @param operator Address of the operator
    /// @param authorized Whether the operator is authorized
    event OperatorUpdated(address indexed operator, bool authorized);

    /// @notice Emitted when receiver allowlist status is changed
    /// @param receiver Address of the receiver
    /// @param allowed Whether the receiver is allowed
    event ReceiverAllowed(address indexed receiver, bool allowed);

    /// @notice Emitted when allowlist enforcement is toggled
    /// @param enabled Whether allowlist is enforced
    event AllowlistToggled(bool enabled);

    /// @notice Emitted when fees are withdrawn to treasury
    /// @param amount Amount of fees withdrawn
    event FeesWithdrawn(uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when fee exceeds maximum
    error FeeExceedsMaximum(uint256 feeBps, uint256 maxFeeBps);

    /// @notice Thrown when payment amount is invalid
    error InvalidAmount(uint256 amount);

    /// @notice Thrown when receiver address is invalid
    error InvalidReceiver(address receiver);

    /// @notice Thrown when treasury address is invalid
    error InvalidTreasury(address treasury);

    /// @notice Thrown when receiver is not on allowlist
    error ReceiverNotAllowed(address receiver);

    /// @notice Thrown when operator is not authorized
    error UnauthorizedOperator(address caller);

    /// @notice Thrown when payment transfer fails
    error PaymentTransferFailed();

    /// @notice Thrown when fee transfer fails
    error FeeTransferFailed();

    /// @notice Thrown when calculation overflows
    error MathOverflow();

    /*//////////////////////////////////////////////////////////////
                            MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Restricts function to authorized operators or owner
    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedOperator(msg.sender);
        }
        _;
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initializes the PaymentRouter
     * @param _usdc USDC token contract address
     * @param _treasury Treasury address for fee collection
     * @param _feeBps Initial fee in basis points (max 1000)
     * @param _initialOwner Initial owner address
     */
    constructor(
        address _usdc,
        address _treasury,
        uint256 _feeBps,
        address _initialOwner
    ) {
        _transferOwnership(_initialOwner);
        if (_usdc == address(0)) revert InvalidReceiver(_usdc);
        if (_treasury == address(0)) revert InvalidTreasury(_treasury);
        if (_feeBps > MAX_FEE_BPS) revert FeeExceedsMaximum(_feeBps, MAX_FEE_BPS);

        usdc = IERC20(_usdc);
        treasury = _treasury;
        feeBps = _feeBps;
        allowlistEnabled = false;
    }

    /*//////////////////////////////////////////////////////////////
                        EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Routes a payment from caller to receiver with fee splitting
     * @param receiver Address to receive the payment
     * @param amount Total amount to transfer (including fee)
     * @param memo Optional payment memo/reference
     * @return receiverAmount Amount actually received by receiver
     * @dev Uses Checks-Effects-Interactions pattern
     */
    function pay(
        address receiver,
        uint256 amount,
        string calldata memo
    ) external nonReentrant whenNotPaused returns (uint256 receiverAmount) {
        // CHECKS
        if (receiver == address(0)) revert InvalidReceiver(receiver);
        if (amount < MIN_PAYMENT_AMOUNT || amount > MAX_PAYMENT_AMOUNT) {
            revert InvalidAmount(amount);
        }
        if (allowlistEnabled && !allowedReceivers[receiver]) {
            revert ReceiverNotAllowed(receiver);
        }

        // Calculate fee and receiver amount
        uint256 fee = _calculateFee(amount);
        receiverAmount = amount - fee;

        // EFFECTS - Update state before external calls
        totalVolume += amount;
        totalFeesCollected += fee;
        paymentCount++;

        // INTERACTIONS - External calls last
        // Transfer full amount from payer to this contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Transfer receiver amount
        usdc.safeTransfer(receiver, receiverAmount);

        // Transfer fee to treasury
        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
        }

        emit PaymentRouted(msg.sender, receiver, amount, receiverAmount, fee, memo);

        return receiverAmount;
    }

    /**
     * @notice Routes a payment using ERC20 permit (gasless approval)
     * @param receiver Address to receive the payment
     * @param amount Total amount to transfer (including fee)
     * @param memo Optional payment memo/reference
     * @param deadline Permit deadline
     * @param v Signature v component
     * @param r Signature r component
     * @param s Signature s component
     * @return receiverAmount Amount actually received by receiver
     */
    function payWithPermit(
        address receiver,
        uint256 amount,
        string calldata memo,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused returns (uint256 receiverAmount) {
        // CHECKS
        if (receiver == address(0)) revert InvalidReceiver(receiver);
        if (amount < MIN_PAYMENT_AMOUNT || amount > MAX_PAYMENT_AMOUNT) {
            revert InvalidAmount(amount);
        }
        if (allowlistEnabled && !allowedReceivers[receiver]) {
            revert ReceiverNotAllowed(receiver);
        }

        // Calculate fee and receiver amount
        uint256 fee = _calculateFee(amount);
        receiverAmount = amount - fee;

        // EFFECTS
        totalVolume += amount;
        totalFeesCollected += fee;
        paymentCount++;

        // INTERACTIONS - Permit and transfer
        // Use permit for gasless approval
        _permit(address(usdc), msg.sender, address(this), amount, deadline, v, r, s);

        // Transfer full amount from payer to this contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Transfer receiver amount
        usdc.safeTransfer(receiver, receiverAmount);

        // Transfer fee to treasury
        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
        }

        emit PaymentRouted(msg.sender, receiver, amount, receiverAmount, fee, memo);

        return receiverAmount;
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Updates the treasury address
     * @param _treasury New treasury address
     * @dev Only callable by owner
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidTreasury(_treasury);

        address oldTreasury = treasury;
        treasury = _treasury;

        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /**
     * @notice Updates the fee in basis points
     * @param _feeBps New fee in basis points (max 1000)
     * @dev Only callable by owner, enforces maximum fee cap
     */
    function setFeeBps(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeExceedsMaximum(_feeBps, MAX_FEE_BPS);

        uint256 oldFeeBps = feeBps;
        feeBps = _feeBps;

        emit FeeUpdated(oldFeeBps, _feeBps);
    }

    /**
     * @notice Sets operator authorization status
     * @param operator Address to update
     * @param authorized Whether the operator is authorized
     * @dev Only callable by owner
     */
    function setOperator(address operator, bool authorized) external onlyOwner {
        operators[operator] = authorized;
        emit OperatorUpdated(operator, authorized);
    }

    /**
     * @notice Adds or removes a receiver from the allowlist
     * @param receiver Address to update
     * @param allowed Whether the receiver is allowed
     * @dev Only callable by operator or owner
     */
    function setReceiverAllowed(address receiver, bool allowed) external onlyOperator {
        if (receiver == address(0)) revert InvalidReceiver(receiver);
        allowedReceivers[receiver] = allowed;
        emit ReceiverAllowed(receiver, allowed);
    }

    /**
     * @notice Toggles allowlist enforcement
     * @param enabled Whether to enforce allowlist
     * @dev Only callable by owner
     */
    function setAllowlistEnabled(bool enabled) external onlyOwner {
        allowlistEnabled = enabled;
        emit AllowlistToggled(enabled);
    }

    /**
     * @notice Pauses the contract
     * @dev Only callable by owner
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract
     * @dev Only callable by owner
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdrawal of stuck tokens (non-USDC)
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     * @dev Only callable by owner, cannot withdraw USDC to protect fees
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(usdc)) revert InvalidReceiver(token);
        IERC20(token).safeTransfer(owner(), amount);
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Calculates the fee for a given amount
     * @param amount Payment amount
     * @return fee Calculated fee
     */
    function calculateFee(uint256 amount) external view returns (uint256 fee) {
        return _calculateFee(amount);
    }

    /**
     * @notice Calculates the receiver amount after fee
     * @param amount Total payment amount
     * @return receiverAmount Amount receiver will receive
     */
    function calculateReceiverAmount(uint256 amount) external view returns (uint256 receiverAmount) {
        uint256 fee = _calculateFee(amount);
        return amount - fee;
    }

    /**
     * @notice Returns payment statistics
     * @return _totalVolume Total payment volume
     * @return _totalFees Total fees collected
     * @return _paymentCount Number of payments
     */
    function getStats()
        external
        view
        returns (
            uint256 _totalVolume,
            uint256 _totalFees,
            uint256 _paymentCount
        )
    {
        return (totalVolume, totalFeesCollected, paymentCount);
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Calculates fee for a given amount
     * @param amount Payment amount
     * @return fee Calculated fee
     */
    function _calculateFee(uint256 amount) internal view returns (uint256 fee) {
        // Prevent overflow in multiplication
        if (amount > type(uint256).max / feeBps) revert MathOverflow();
        return (amount * feeBps) / BPS_DENOMINATOR;
    }

    /**
     * @notice Calls permit on a token that supports EIP-2612
     * @param token Token address
     * @param owner Token owner
     * @param spender Spender address
     * @param value Permit value
     * @param deadline Permit deadline
     * @param v Signature v
     * @param r Signature r
     * @param s Signature s
     */
    function _permit(
        address token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        // Call permit on the token (works for USDC on Base which supports EIP-2612)
        (bool success, ) = token.call(
            abi.encodeWithSelector(
                IERC20Permit.permit.selector,
                owner,
                spender,
                value,
                deadline,
                v,
                r,
                s
            )
        );
        // Permit failures are acceptable (e.g., if already approved)
        // We rely on the subsequent transferFrom to fail if permit didn't work
        (success); // silence unused variable warning
    }
}

/**
 * @title IERC20Permit
 * @notice Interface for EIP-2612 permit function
 */
interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
