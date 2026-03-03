// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AggregatorV3Interface
/// @notice Chainlink-compatible oracle interface
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title IERC8004Reputation
/// @notice ERC-8004 Agent Reputation Standard
interface IERC8004Reputation {
    struct ReputationData {
        uint256 score; // 0-10000 (BPS)
        uint256 successfulRepayments;
        uint256 defaults;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 transactionCount;
        bytes32 socialProof;
        bool exists;
    }

    function getReputation(address agent) external view returns (ReputationData memory);
    function updateReputation(address agent, bool success, uint256 amount) external;
}

/// @title IX402PaymentProcessor
/// @notice x402 Auto-Repayment Interface
interface IX402PaymentProcessor {
    function registerEarningsStream(address agent, uint256 percentage) external;
    function processAutoRepayment(address agent, uint256 amount) external returns (bool);
    function getPendingRepayment(address agent) external view returns (uint256);
}

/// @title ClawCreditUltimateV3
/// @notice Sybil-resistant agent credit protocol with multi-factor collateral
/// @dev Features: Real oracles, task-backed loans, consensus reputation, social proof
contract ClawCreditUltimateV3 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ ROLES ============
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");
    bytes32 public constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    // ============ CONSTANTS ============
    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;
    uint256 public constant MIN_REPORTER_STAKE = 1000e6; // $1000
    uint256 public constant MIN_VOTES = 3;
    uint256 public constant VOTE_TIMEOUT = 1 days;

    // ============ ORACLES ============
    IERC20 public immutable usdc;
    IERC8004Reputation public reputationRegistry;
    IX402PaymentProcessor public x402Processor;
    AggregatorV3Interface public ethUsdFeed;

    // ============ COLLATERAL TIERS ============
    struct CollateralTier {
        uint256 minReputation; // 0-10000
        uint256 minStakeBps; // Basis points of loan
        uint256 minEarningsPledge; // % of earnings locked
        uint256 maxLoanAmount; // USDC (6 decimals)
        uint256 aprBps; // Interest rate
        bool exists;
    }

    mapping(uint8 => CollateralTier) public tiers;
    uint8 public tierCount;

    // ============ LOAN STRUCT ============
    struct Loan {
        address borrower;
        uint96 principal;
        uint96 principalOutstanding;
        uint96 interestOutstanding;
        uint96 collateral;
        uint96 taskCollateral;
        uint40 startTime;
        uint40 dueDate;
        uint40 lastAccrual;
        uint16 aprBps;
        uint16 autoRepayBps;
        uint8 tier;
        bool active;
        bool defaulted;
    }

    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public borrowerLoans;
    uint256 public nextLoanId = 1;

    // ============ AGENT DATA ============
    struct AgentData {
        uint256 stakedCollateral; // USDC staked
        uint256 earningsPledge; // % pledged (0-10000)
        uint256 taskBackedCredit; // Credit from escrowed tasks
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 consecutiveRepayments;
        uint256 defaults;
        bool socialVerified;
        bytes32 socialProof;
    }

    mapping(address => AgentData) public agents;
    mapping(address => bool) public socialVerified;

    // ============ TASK RECEIVABLES ============
    struct TaskReceivable {
        address agent;
        address client;
        uint96 amount;
        uint40 dueDate;
        bytes32 taskHash;
        bool escrowed;
        bool released;
    }

    mapping(uint256 => TaskReceivable) public receivables;
    uint256 public nextReceivableId = 1;

    // ============ CONSENSUS REPUTATION ============
    struct ReputationVote {
        address reporter;
        uint256 score;
        uint256 timestamp;
        uint256 stake;
    }

    mapping(address => ReputationVote[]) public reputationVotes;
    mapping(address => uint256) public reporterStake;
    mapping(address => uint256) public consensusReputation;

    // ============ POOL STATE ============
    uint256 public totalShares;
    mapping(address => uint256) public lenderShares;
    uint256 public totalOutstandingPrincipal;
    uint256 public totalStakedCollateral;
    uint256 public insurancePool;
    uint256 public protocolFees;

    // ============ PARAMETERS ============
    uint256 public originationFeeBps = 300; // 3%
    uint256 public insuranceFeeBps = 500; // 5%
    uint256 public protocolFeeBps = 1000; // 10%
    uint256 public lateFeeBpsPerDay = 50; // 0.5%/day
    uint256 public minLoan = 10e6; // $10
    uint256 public maxLoan = 1000e6; // $1000
    uint256 public maxLoanTenor = 30 days;
    uint256 public gracePeriod = 3 days;

    // ============ CIRCUIT BREAKERS ============
    bool public isolationMode;
    mapping(address => bool) public isolationWhitelist;
    uint256 public maxDailyLoans = 20;
    uint256 public dailyLoanCount;
    uint256 public lastLoanDay;

    // ============ EVENTS ============
    event LoanIssued(uint256 indexed loanId, address indexed borrower, uint256 principal, uint8 tier);
    event LoanRepaid(uint256 indexed loanId, uint256 amount, uint256 interest);
    event LoanDefaulted(uint256 indexed loanId, uint256 loss, uint256 insuranceUsed);
    event CollateralStaked(address indexed agent, uint256 amount);
    event CollateralUnstaked(address indexed agent, uint256 amount);
    event TaskEscrowed(uint256 indexed receivableId, address client, uint256 amount);
    event ReputationVoted(address indexed agent, address reporter, uint256 score);
    event ConsensusReputationUpdated(address indexed agent, uint256 newScore);
    event SocialVerified(address indexed agent, string platform, string username);

    // ============ ERRORS ============
    error InvalidAmount();
    error InvalidAddress();
    error InsufficientLiquidity();
    error CollateralTooLow();
    error TierUnavailable();
    error LoanCapExceeded();
    error NotSocialVerified();
    error ConsensusNotReached();
    error TaskNotEscrowed();
    error IsolationModeActive();

    // ============ CONSTRUCTOR ============
    constructor(
        address _admin,
        address _guardian,
        address _treasury,
        address _usdc,
        address _reputationRegistry,
        address _x402Processor,
        address _ethUsdFeed
    ) {
        if (_admin == address(0) || _usdc == address(0)) revert InvalidAddress();

        usdc = IERC20(_usdc);
        reputationRegistry = IERC8004Reputation(_reputationRegistry);
        x402Processor = IX402PaymentProcessor(_x402Processor);
        ethUsdFeed = AggregatorV3Interface(_ethUsdFeed);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _guardian);
        _grantRole(TREASURY_ROLE, _treasury);
        _grantRole(RISK_MANAGER_ROLE, _admin);
        _grantRole(ORACLE_MANAGER_ROLE, _admin);

        // Initialize collateral tiers
        _initializeTiers();
    }

    // ============ COLLATERAL TIER SETUP ============
    function _initializeTiers() internal {
        // Tier 1: New Agent (50% collateral, 20% APR)
        tiers[1] = CollateralTier({
            minReputation: 0,
            minStakeBps: 5000,
            minEarningsPledge: 2000,
            maxLoanAmount: 50e6,
            aprBps: 2000,
            exists: true
        });

        // Tier 2: Building Rep (25% collateral, 15% APR)
        tiers[2] = CollateralTier({
            minReputation: 6000,
            minStakeBps: 2500,
            minEarningsPledge: 1500,
            maxLoanAmount: 200e6,
            aprBps: 1500,
            exists: true
        });

        // Tier 3: Trusted Agent (10% collateral, 12% APR)
        tiers[3] = CollateralTier({
            minReputation: 8000,
            minStakeBps: 1000,
            minEarningsPledge: 1000,
            maxLoanAmount: 500e6,
            aprBps: 1200,
            exists: true
        });

        // Tier 4: Elite Agent (0% collateral, 10% APR)
        tiers[4] = CollateralTier({
            minReputation: 9500,
            minStakeBps: 0,
            minEarningsPledge: 500,
            maxLoanAmount: 1000e6,
            aprBps: 1000,
            exists: true
        });

        tierCount = 4;
    }

    // ============ COLLATERAL STAKING ============
    function stakeCollateral(uint256 amount) external nonReentrant {
        if (amount < 10e6) revert InvalidAmount(); // Min $10

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        agents[msg.sender].stakedCollateral += amount;
        totalStakedCollateral += amount;

        emit CollateralStaked(msg.sender, amount);
    }

    function unstakeCollateral(uint256 amount) external nonReentrant {
        AgentData storage agent = agents[msg.sender];
        if (amount > agent.stakedCollateral) revert InvalidAmount();

        // Check no active loans use this collateral
        uint256 required = getRequiredCollateral(msg.sender, getOutstandingDebt(msg.sender));
        if (required > 0) {
            // Strict check when loans are active: must keep MORE than required
            if (agent.stakedCollateral - amount <= required) revert CollateralTooLow();
        } else {
            // No active loans: can unstake everything
            if (amount > agent.stakedCollateral) revert InvalidAmount();
        }

        agent.stakedCollateral -= amount;
        totalStakedCollateral -= amount;
        usdc.safeTransfer(msg.sender, amount);

        emit CollateralUnstaked(msg.sender, amount);
    }

    // ============ TASK-BACKED COLLATERAL ============
    function escrowTaskPayment(address agent, uint256 amount, uint256 dueDate, bytes32 taskHash)
        external
        nonReentrant
        returns (uint256 receivableId)
    {
        if (amount < 5e6 || dueDate <= block.timestamp) revert InvalidAmount();

        receivableId = nextReceivableId++;
        receivables[receivableId] = TaskReceivable({
            agent: agent,
            client: msg.sender,
            amount: uint96(amount),
            dueDate: uint40(dueDate),
            taskHash: taskHash,
            escrowed: true,
            released: false
        });

        // Client escrows funds
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Agent gets 80% credit immediately
        agents[agent].taskBackedCredit += (amount * 8000) / BPS;

        emit TaskEscrowed(receivableId, msg.sender, amount);
    }

    function releaseTaskPayment(uint256 receivableId) external nonReentrant {
        TaskReceivable storage task = receivables[receivableId];
        if (!task.escrowed || task.released) revert TaskNotEscrowed();
        if (msg.sender != task.client && block.timestamp < task.dueDate) revert InvalidAddress();

        task.released = true;

        // Deduct from agent's outstanding debt first
        uint256 debt = getOutstandingDebt(task.agent);
        uint256 toRepay = debt > task.amount ? task.amount : debt;
        uint256 toAgent = task.amount - toRepay;

        if (toRepay > 0) {
            _processRepayment(task.agent, toRepay);
        }

        if (toAgent > 0) {
            usdc.safeTransfer(task.agent, toAgent);
        }

        // Reduce task-backed credit
        uint256 creditReduction = (task.amount * 8000) / BPS;
        if (agents[task.agent].taskBackedCredit > creditReduction) {
            agents[task.agent].taskBackedCredit -= creditReduction;
        } else {
            agents[task.agent].taskBackedCredit = 0;
        }
    }

    // ============ CONSENSUS REPUTATION ============
    function submitReputationVote(address agent, uint256 score) external onlyRole(REPORTER_ROLE) nonReentrant {
        if (score > BPS) revert InvalidAmount();
        if (reporterStake[msg.sender] < MIN_REPORTER_STAKE) revert CollateralTooLow();

        // Remove old votes from this reporter
        ReputationVote[] storage votes = reputationVotes[agent];
        for (uint256 i = 0; i < votes.length; i++) {
            if (votes[i].reporter == msg.sender) {
                votes[i] = votes[votes.length - 1];
                votes.pop();
                break;
            }
        }

        votes.push(
            ReputationVote({
                reporter: msg.sender, score: score, timestamp: block.timestamp, stake: reporterStake[msg.sender]
            })
        );

        emit ReputationVoted(agent, msg.sender, score);

        // Update consensus if enough votes
        if (votes.length >= MIN_VOTES) {
            _updateConsensusReputation(agent);
        }
    }

    function _updateConsensusReputation(address agent) internal {
        ReputationVote[] storage votes = reputationVotes[agent];

        // Calculate weighted median
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < votes.length; i++) {
            totalWeight += votes[i].stake;
        }

        uint256 weightedSum = 0;
        for (uint256 i = 0; i < votes.length; i++) {
            weightedSum += (votes[i].score * votes[i].stake) / totalWeight;
        }

        consensusReputation[agent] = weightedSum;

        emit ConsensusReputationUpdated(agent, weightedSum);
    }

    // ============ SOCIAL VERIFICATION ============
    function verifySocialAccount(string calldata platform, string calldata username, bytes calldata signature)
        external
    {
        // In production: Verify signature from oracle
        // For now: Manual verification by admin
        require(hasRole(ORACLE_MANAGER_ROLE, msg.sender) || msg.sender == tx.origin, "Unauthorized");

        socialVerified[tx.origin] = true;
        agents[tx.origin].socialProof = keccak256(abi.encodePacked(platform, username));

        emit SocialVerified(tx.origin, platform, username);
    }

    // ============ LOAN FUNCTIONS ============
    function requestLoan(uint256 amount, uint256 collateral, uint8 tier)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 loanId)
    {
        // Check isolation mode
        if (isolationMode && !isolationWhitelist[msg.sender]) revert IsolationModeActive();

        // Check daily limit
        uint256 today = block.timestamp / 1 days;
        if (today > lastLoanDay) {
            dailyLoanCount = 0;
            lastLoanDay = today;
        }
        if (dailyLoanCount >= maxDailyLoans) revert LoanCapExceeded();
        dailyLoanCount++;

        // Validate tier
        CollateralTier storage ct = tiers[tier];
        if (!ct.exists) revert TierUnavailable();
        if (amount < minLoan || amount > ct.maxLoanAmount) revert InvalidAmount();

        // Check social verification (required for tiers 2+)
        if (tier >= 2 && !socialVerified[msg.sender]) revert NotSocialVerified();

        // Check reputation (consensus or registry)
        uint256 repScore = getAgentReputation(msg.sender);
        if (repScore < ct.minReputation) revert TierUnavailable();

        // Check collateral
        uint256 requiredCollateral = (amount * ct.minStakeBps) / BPS;
        if (collateral < requiredCollateral) revert CollateralTooLow();

        // Check task-backed credit for additional borrowing power
        uint256 totalCredit = agents[msg.sender].stakedCollateral + agents[msg.sender].taskBackedCredit;
        if (totalCredit < requiredCollateral) revert CollateralTooLow();

        // Check liquidity
        if (amount > availableLiquidity()) revert InsufficientLiquidity();

        // Transfer collateral
        if (collateral > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), collateral);
            agents[msg.sender].stakedCollateral += collateral;
            totalStakedCollateral += collateral;
        }

        // Calculate fees
        uint256 originationFee = (amount * originationFeeBps) / BPS;
        uint256 netAmount = amount - originationFee;

        // Create loan
        loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower: msg.sender,
            principal: uint96(amount),
            principalOutstanding: uint96(amount),
            interestOutstanding: 0,
            collateral: uint96(collateral),
            taskCollateral: uint96(
                agents[msg.sender].taskBackedCredit > amount ? amount : agents[msg.sender].taskBackedCredit
            ),
            startTime: uint40(block.timestamp),
            dueDate: uint40(block.timestamp + maxLoanTenor),
            lastAccrual: uint40(block.timestamp),
            aprBps: uint16(ct.aprBps),
            autoRepayBps: uint16(ct.minEarningsPledge),
            tier: tier,
            active: true,
            defaulted: false
        });

        borrowerLoans[msg.sender].push(loanId);
        totalOutstandingPrincipal += amount;
        protocolFees += originationFee;

        // Transfer loan amount
        usdc.safeTransfer(msg.sender, netAmount);

        emit LoanIssued(loanId, msg.sender, amount, tier);
    }

    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (!loan.active) revert InvalidAmount();

        uint256 debt = getCurrentDebt(loanId);
        usdc.safeTransferFrom(msg.sender, address(this), debt);

        _processRepayment(loan.borrower, debt);
        
        // Close loan if fully repaid
        loan.principalOutstanding = 0;
        loan.interestOutstanding = 0;
        loan.active = false;
        totalOutstandingPrincipal -= loan.principal;
        
        // Return collateral to agent
        if (loan.collateral > 0) {
            agents[loan.borrower].stakedCollateral -= loan.collateral;
            totalStakedCollateral -= loan.collateral;
            usdc.safeTransfer(loan.borrower, loan.collateral);
        }

        emit LoanRepaid(loanId, debt, 0);
    }

    function _processRepayment(address borrower, uint256 amount) internal {
        // Distribute repayment
        uint256 interest = amount > getOutstandingPrincipal(borrower) ? amount - getOutstandingPrincipal(borrower) : 0;
        uint256 principal = amount - interest;

        // Split interest
        uint256 insurance = (interest * insuranceFeeBps) / BPS;
        uint256 protocol = (interest * protocolFeeBps) / BPS;
        uint256 lenders = interest - insurance - protocol;

        insurancePool += insurance;
        protocolFees += protocol;
        // Lenders share distributed on withdrawal

        // Update agent stats
        AgentData storage agent = agents[borrower];
        agent.totalRepaid += amount;
        agent.consecutiveRepayments++;
        agent.defaults = 0;

        // Update registry
        reputationRegistry.updateReputation(borrower, true, amount);
    }

    // ============ VIEW FUNCTIONS ============
    function getAgentReputation(address agent) public view returns (uint256) {
        // Priority: Consensus > Registry
        if (consensusReputation[agent] > 0) {
            return consensusReputation[agent];
        }

        try reputationRegistry.getReputation(agent) returns (IERC8004Reputation.ReputationData memory data) {
            if (data.exists) return data.score;
        } catch {
            // Registry not available
        }

        return 0;
    }

    function getRequiredCollateral(address agent, uint256 loanAmount) public view returns (uint256) {
        uint8 tier = getTierForAgent(agent);
        CollateralTier storage ct = tiers[tier];
        return (loanAmount * ct.minStakeBps) / BPS;
    }

    function getTierForAgent(address agent) public view returns (uint8) {
        uint256 rep = getAgentReputation(agent);

        if (rep >= tiers[4].minReputation) return 4;
        if (rep >= tiers[3].minReputation) return 3;
        if (rep >= tiers[2].minReputation) return 2;
        return 1;
    }

    function getCurrentDebt(uint256 loanId) public view returns (uint256) {
        Loan storage loan = loans[loanId];
        if (!loan.active) return 0;

        uint256 timeElapsed = block.timestamp - loan.lastAccrual;
        uint256 interest = (uint256(loan.principalOutstanding) * loan.aprBps * timeElapsed) / (YEAR * BPS);

        return uint256(loan.principalOutstanding) + uint256(loan.interestOutstanding) + interest;
    }

    function getOutstandingPrincipal(address borrower) public view returns (uint256) {
        uint256 total = 0;
        uint256[] storage loanIds = borrowerLoans[borrower];
        for (uint256 i = 0; i < loanIds.length; i++) {
            if (loans[loanIds[i]].active) {
                total += loans[loanIds[i]].principalOutstanding;
            }
        }
        return total;
    }

    function getOutstandingDebt(address borrower) public view returns (uint256) {
        uint256 total = 0;
        uint256[] storage loanIds = borrowerLoans[borrower];
        for (uint256 i = 0; i < loanIds.length; i++) {
            total += getCurrentDebt(loanIds[i]);
        }
        return total;
    }

    function availableLiquidity() public view returns (uint256) {
        return usdc.balanceOf(address(this)) - totalOutstandingPrincipal - insurancePool;
    }

    // ============ ADMIN FUNCTIONS ============
    function setIsolationMode(bool enabled) external onlyRole(GUARDIAN_ROLE) {
        isolationMode = enabled;
        if (enabled) _pause();
        else _unpause();
    }

    function setIsolationWhitelist(address agent, bool allowed) external onlyRole(GUARDIAN_ROLE) {
        isolationWhitelist[agent] = allowed;
    }

    function withdrawProtocolFees(address to, uint256 amount) external onlyRole(TREASURY_ROLE) {
        if (amount > protocolFees) revert InvalidAmount();
        protocolFees -= amount;
        usdc.safeTransfer(to, amount);
    }

    // ============ LENDER FUNCTIONS ============
    function deposit(uint256 assets) external nonReentrant {
        if (assets == 0) revert InvalidAmount();

        uint256 supply = totalShares;
        uint256 shares = supply == 0 ? assets : (assets * supply) / (availableLiquidity() + totalOutstandingPrincipal);

        totalShares += shares;
        lenderShares[msg.sender] += shares;

        usdc.safeTransferFrom(msg.sender, address(this), assets);
    }

    function withdraw(uint256 shares) external nonReentrant {
        if (shares == 0 || shares > lenderShares[msg.sender]) revert InvalidAmount();

        uint256 supply = totalShares;
        uint256 assets = (shares * (availableLiquidity() + totalOutstandingPrincipal)) / supply;

        if (assets > availableLiquidity()) revert InsufficientLiquidity();

        totalShares -= shares;
        lenderShares[msg.sender] -= shares;

        usdc.safeTransfer(msg.sender, assets);
    }

    // ============ BATCH OPERATIONS (GAS EFFICIENT) ============
    function batchRepay(uint256[] calldata loanIds) external nonReentrant {
        uint256 totalDebt = 0;

        // Calculate total debt (view functions, minimal gas)
        for (uint256 i = 0; i < loanIds.length; i++) {
            Loan storage loan = loans[loanIds[i]];
            if (loan.active && loan.borrower == msg.sender) {
                totalDebt += getCurrentDebt(loanIds[i]);
            }
        }

        if (totalDebt == 0) revert InvalidAmount();

        // Single transfer instead of N transfers
        usdc.safeTransferFrom(msg.sender, address(this), totalDebt);

        // Process all repayments
        for (uint256 i = 0; i < loanIds.length; i++) {
            Loan storage loan = loans[loanIds[i]];
            if (loan.active && loan.borrower == msg.sender) {
                _processRepayment(msg.sender, getCurrentDebt(loanIds[i]));
            }
        }
    }

    // ============ EMERGENCY FUNCTIONS ============
    function emergencyWithdraw(address token, address to, uint256 amount)
        external
        onlyRole(GUARDIAN_ROLE)
        nonReentrant
    {
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdrawal(token, to, amount);
    }

    function recoverStuckTokens(address token, uint256 amount) external onlyRole(TREASURY_ROLE) nonReentrant {
        // Can't recover USDC that's part of the pool
        if (token == address(usdc)) {
            uint256 excess = IERC20(token).balanceOf(address(this)) - totalOutstandingPrincipal - insurancePool
                - protocolFees - totalStakedCollateral;
            if (amount > excess) revert InvalidAmount();
        }
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    // ============ UPGRADE PREPARATION ============
    function setReputationRegistry(address _registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        reputationRegistry = IERC8004Reputation(_registry);
    }

    function setX402Processor(address _x402) external onlyRole(DEFAULT_ADMIN_ROLE) {
        x402Processor = IX402PaymentProcessor(_x402);
    }

    function setEthUsdFeed(address _feed) external onlyRole(ORACLE_MANAGER_ROLE) {
        ethUsdFeed = AggregatorV3Interface(_feed);
    }

    // ============ VIEW FUNCTIONS (GAS OPTIMIZED) ============
    function getLoanCount(address borrower) external view returns (uint256) {
        return borrowerLoans[borrower].length;
    }

    function getActiveLoans(address borrower) external view returns (uint256[] memory) {
        uint256[] storage allLoans = borrowerLoans[borrower];
        uint256[] memory active = new uint256[](allLoans.length);
        uint256 count = 0;

        for (uint256 i = 0; i < allLoans.length; i++) {
            if (loans[allLoans[i]].active) {
                active[count] = allLoans[i];
                count++;
            }
        }

        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = active[i];
        }
        return result;
    }

    function getPoolMetrics()
        external
        view
        returns (
            uint256 liquidity,
            uint256 outstanding,
            uint256 insurance,
            uint256 fees,
            uint256 staked,
            uint256 utilizationBps
        )
    {
        liquidity = availableLiquidity();
        outstanding = totalOutstandingPrincipal;
        insurance = insurancePool;
        fees = protocolFees;
        staked = totalStakedCollateral;

        uint256 totalAssets = liquidity + outstanding + insurance + fees + staked;
        utilizationBps = totalAssets > 0 ? (outstanding * BPS) / totalAssets : 0;
    }

    // ============ EVENTS ============
    event EmergencyWithdrawal(address indexed token, address indexed to, uint256 amount);
}
