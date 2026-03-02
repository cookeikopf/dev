// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title X402PaymentProcessor
/// @notice x402 protocol implementation for auto-repayment
/// @dev Compatible with Coinbase x402 standard
contract X402PaymentProcessor is AccessControl {
    using SafeERC20 for IERC20;
    
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    
    IERC20 public immutable usdc;
    address public clawCreditPool;
    
    // ============ EARNINGS STREAMS ============
    struct EarningsStream {
        uint256 percentage;           // % of earnings to auto-repay (0-10000)
        uint256 totalEarnings;        // Total earnings tracked
        uint256 totalRepaid;          // Total auto-repaid
        uint256 lastEarningsUpdate;
        bool active;
    }
    
    mapping(address => EarningsStream) public streams;
    mapping(address => bool) public registeredAgents;
    
    // ============ PAYMENT INTENTS ============
    struct PaymentIntent {
        address agent;
        address recipient;            // ClawCredit pool
        uint256 amount;
        uint256 deadline;
        bytes32 metadata;             // Loan ID, etc.
        bool executed;
    }
    
    mapping(bytes32 => PaymentIntent) public intents;
    
    // ============ EVENTS ============
    event StreamRegistered(address indexed agent, uint256 percentage);
    event StreamUpdated(address indexed agent, uint256 newPercentage);
    event EarningsReported(address indexed agent, uint256 amount, uint256 timestamp);
    event AutoRepaymentProcessed(address indexed agent, uint256 amount, bytes32 indexed intentId);
    event IntentCreated(bytes32 indexed intentId, address agent, uint256 amount);
    event IntentExecuted(bytes32 indexed intentId, uint256 amount);
    
    // ============ ERRORS ============
    error InvalidPercentage();
    error InvalidAmount();
    error StreamNotActive();
    error IntentExpired();
    error IntentAlreadyExecuted();
    error UnauthorizedReporter();
    
    constructor(address _usdc, address _clawCreditPool, address admin) {
        usdc = IERC20(_usdc);
        clawCreditPool = _clawCreditPool;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROCESSOR_ROLE, admin);
    }
    
    // ============ STREAM REGISTRATION ============
    function registerEarningsStream(uint256 percentage) external {
        if (percentage > 5000) revert InvalidPercentage(); // Max 50%
        
        streams[msg.sender] = EarningsStream({
            percentage: percentage,
            totalEarnings: 0,
            totalRepaid: 0,
            lastEarningsUpdate: block.timestamp,
            active: true
        });
        
        registeredAgents[msg.sender] = true;
        
        emit StreamRegistered(msg.sender, percentage);
    }
    
    function updateStreamPercentage(uint256 newPercentage) external {
        if (newPercentage > 5000) revert InvalidPercentage();
        if (!streams[msg.sender].active) revert StreamNotActive();
        
        streams[msg.sender].percentage = newPercentage;
        
        emit StreamUpdated(msg.sender, newPercentage);
    }
    
    function deactivateStream() external {
        streams[msg.sender].active = false;
    }
    
    // ============ EARNINGS REPORTING ============
    /// @notice Report earnings from any source (API payment, task completion, etc.)
    function reportEarnings(
        address agent,
        uint256 amount,
        bytes calldata proof
    ) external onlyRole(PROCESSOR_ROLE) {
        if (!streams[agent].active) revert StreamNotActive();
        
        // Verify proof (signature from authorized reporter)
        // In production: verify signature, nonce, etc.
        
        EarningsStream storage stream = streams[agent];
        stream.totalEarnings += amount;
        stream.lastEarningsUpdate = block.timestamp;
        
        emit EarningsReported(agent, amount, block.timestamp);
        
        // Calculate auto-repay amount
        uint256 repayAmount = (amount * stream.percentage) / 10000;
        
        if (repayAmount > 0) {
            _processAutoRepayment(agent, repayAmount);
        }
    }
    
    // ============ AUTO-REPAYMENT ============
    function _processAutoRepayment(address agent, uint256 amount) internal {
        // Check agent has approved this contract
        uint256 allowance = usdc.allowance(agent, address(this));
        if (allowance < amount) {
            // Can't auto-repay - agent needs to approve
            // In production: queue for later or notify
            return;
        }
        
        // Check balance
        uint256 balance = usdc.balanceOf(agent);
        if (balance < amount) {
            // Insufficient balance
            return;
        }
        
        // Transfer from agent to ClawCredit pool
        usdc.safeTransferFrom(agent, clawCreditPool, amount);
        
        // Update stream stats
        streams[agent].totalRepaid += amount;
        
        // Notify pool (optional)
        // IClawCreditPool(clawCreditPool).processExternalRepayment(agent, amount);
        
        emit AutoRepaymentProcessed(agent, amount, bytes32(0));
    }
    
    // ============ PAYMENT INTENTS (x402 Standard) ============
    function createPaymentIntent(
        address agent,
        uint256 amount,
        uint256 deadline,
        bytes32 metadata
    ) external onlyRole(PROCESSOR_ROLE) returns (bytes32 intentId) {
        if (amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidAmount();
        
        intentId = keccak256(abi.encodePacked(agent, amount, deadline, metadata, block.timestamp));
        
        intents[intentId] = PaymentIntent({
            agent: agent,
            recipient: clawCreditPool,
            amount: amount,
            deadline: deadline,
            metadata: metadata,
            executed: false
        });
        
        emit IntentCreated(intentId, agent, amount);
    }
    
    function executeIntent(bytes32 intentId) external {
        PaymentIntent storage intent = intents[intentId];
        
        if (intent.executed) revert IntentAlreadyExecuted();
        if (block.timestamp > intent.deadline) revert IntentExpired();
        
        // Check agent approval
        uint256 allowance = usdc.allowance(intent.agent, address(this));
        require(allowance >= intent.amount, "Insufficient allowance");
        
        // Execute payment
        usdc.safeTransferFrom(intent.agent, intent.recipient, intent.amount);
        
        intent.executed = true;
        
        // Update stream
        if (streams[intent.agent].active) {
            streams[intent.agent].totalRepaid += intent.amount;
        }
        
        emit IntentExecuted(intentId, intent.amount);
        emit AutoRepaymentProcessed(intent.agent, intent.amount, intentId);
    }
    
    // ============ BATCH PROCESSING ============
    function batchProcessRepayments(
        address[] calldata agents,
        uint256[] calldata amounts
    ) external onlyRole(PROCESSOR_ROLE) {
        require(agents.length == amounts.length, "Length mismatch");
        
        for (uint i = 0; i < agents.length; i++) {
            if (streams[agents[i]].active && amounts[i] > 0) {
                _processAutoRepayment(agents[i], amounts[i]);
            }
        }
    }
    
    // ============ VIEW FUNCTIONS ============
    function getStream(address agent) external view returns (EarningsStream memory) {
        return streams[agent];
    }
    
    function getPendingRepayment(address agent) external view returns (uint256) {
        EarningsStream storage stream = streams[agent];
        if (!stream.active) return 0;
        
        // Calculate how much should have been repaid
        uint256 expectedRepaid = (stream.totalEarnings * stream.percentage) / 10000;
        if (expectedRepaid > stream.totalRepaid) {
            return expectedRepaid - stream.totalRepaid;
        }
        return 0;
    }
    
    function getIntent(bytes32 intentId) external view returns (PaymentIntent memory) {
        return intents[intentId];
    }
    
    // ============ ADMIN ============
    function setClawCreditPool(address newPool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        clawCreditPool = newPool;
    }
    
    function authorizeReporter(address reporter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(PROCESSOR_ROLE, reporter);
    }
}
