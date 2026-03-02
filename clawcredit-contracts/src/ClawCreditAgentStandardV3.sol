// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IAgentStandard} from "./interfaces/IAgentStandard.sol";
import {IAgentUnderwriterModel} from "./interfaces/IAgentUnderwriterModel.sol";
import {IERC8004Reputation} from "./interfaces/IERC8004Reputation.sol";

/// @title ClawCreditAgentStandardV3
/// @notice Agent financial operating system with task-backed credit, tranches, delegation,
/// underwriter marketplace, covenants, intent-bounded spending, streaming repayment,
/// reinsurance, and cross-chain credit passport support.
contract ClawCreditAgentStandardV3 is AccessControl, Pausable, ReentrancyGuard, EIP712, IAgentStandard {
    using SafeERC20 for IERC20;

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant UNDERWRITER_ADMIN_ROLE = keccak256("UNDERWRITER_ADMIN_ROLE");
    bytes32 public constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");
    bytes32 public constant PASSPORT_ROLE = keccak256("PASSPORT_ROLE");
    bytes32 public constant EARNINGS_HOOK_ROLE = keccak256("EARNINGS_HOOK_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;

    uint8 public constant TRANCHE_SENIOR = 0;
    uint8 public constant TRANCHE_MEZZ = 1;
    uint8 public constant TRANCHE_JUNIOR = 2;

    IERC20 public immutable usdc;
    IERC8004Reputation public reputationRegistry;
    AggregatorV3Interface public usdcUsdFeed;
    AggregatorV3Interface public aiPerformanceFeed;

    uint256 public minLoan = 10e6;
    uint256 public maxExposurePerAgent = 500e6;
    uint256 public maxTenorDays = 45;
    uint256 public gracePeriod = 3 days;
    uint256 public oracleHeartbeat = 2 hours;
    uint256 public taskEscrowHaircutBps = 9_000;

    uint256 public originationFeeBps = 200;
    uint256 public insuranceFeeBps = 500;
    uint256 public protocolFeeBps = 1_000;
    uint256 public reinsurancePremiumBps = 100;
    uint256 public lateFeeBpsPerDay = 25;

    uint256 public liquidationThresholdBps = 8_000;
    uint256 public minUsdcPegBps = 9_700;

    bool public isolationMode;
    mapping(address => bool) public isolationWhitelist;

    uint256 public protocolFees;
    uint256 public underwriterFeeLiability;
    uint256 public insurancePool;
    uint256 public reinsurancePool;
    uint256 public reservedIntentCredit;
    uint256 public totalOutstandingPrincipal;
    uint256 public totalSponsorCollateral;
    uint256 public totalTaskEscrowLiability;

    bytes32 private constant _SOCIAL_VERIFICATION_TYPEHASH = keccak256(
        "SocialVerification(address subject,address verifier,bytes32 action,uint256 chainId,address contractAddress,uint256 nonce,uint256 deadline,bytes32 payloadHash)"
    );

    struct TrancheState {
        uint256 assets;
        uint256 shares;
        uint256 pendingYield;
    }

    mapping(uint8 => TrancheState) public trancheState;
    mapping(uint8 => mapping(address => uint256)) public trancheShares;

    uint256 public totalReinsuranceShares;
    mapping(address => uint256) public reinsuranceShares;

    struct Delegation {
        uint96 limit;
        uint96 used;
        uint40 expiry;
        bool active;
    }

    mapping(address => uint256) public sponsorCollateral;
    mapping(address => uint256) public sponsorDelegatedCapacity;
    mapping(address => mapping(address => Delegation)) public delegations;

    struct TaskReceivable {
        address agent;
        uint96 receivable;
        uint96 escrowBalance;
        uint40 dueDate;
        bytes32 externalRef;
        bool escrowed;
        bool settled;
    }

    uint256 public nextTaskId = 1;
    mapping(uint256 => TaskReceivable) public tasks;
    mapping(uint256 => uint256) public taskLoan;

    struct Covenant {
        uint16 minTaskCompletionBps;
        int32 minPnlBps;
        uint16 maxDrawdownBps;
        uint40 reviewAt;
    }

    struct CovenantReport {
        int256 pnlBps;
        uint256 drawdownBps;
        uint256 completionBps;
        uint40 reportedAt;
    }

    struct Underwriter {
        address model;
        uint16 feeBps;
        bool active;
        uint64 loansQuoted;
        uint64 defaults;
        uint256 accruedFees;
    }

    uint16 public nextUnderwriterId = 1;
    mapping(uint16 => Underwriter) public underwriters;

    struct Attestation {
        uint16 scoreBps;
        uint16 confidenceBps;
        uint40 updatedAt;
        bytes32 evidence;
    }

    mapping(address => mapping(address => Attestation)) public attestations;
    mapping(address => address[]) private _agentAttestors;
    mapping(address => mapping(address => bool)) private _attestorSeen;
    mapping(address => uint256) private _attestationWeightedScoreSum;
    mapping(address => uint256) private _attestationWeightSum;

    struct Passport {
        uint16 scoreBps;
        uint16 confidenceBps;
        uint64 nonce;
        uint40 updatedAt;
    }

    mapping(address => mapping(uint256 => Passport)) public passports;
    mapping(address => uint256[]) private _agentPassportChains;
    mapping(address => mapping(uint256 => bool)) private _passportChainSeen;
    mapping(address => uint256) private _passportWeightedScoreSum;
    mapping(address => uint256) private _passportWeightSum;

    struct Loan {
        address borrower;
        address sponsor;
        uint96 principal;
        uint96 principalOutstanding;
        uint96 accruedInterest;
        uint96 reservedCredit;
        uint40 startTime;
        uint40 dueDate;
        uint40 lastAccrual;
        uint16 aprBps;
        uint16 underwriterId;
        uint8 tranche;
        uint8 mode; // 0 revolving, 1 task-backed, 2 delegated
        uint256 taskId;
        bytes32 intentHash;
        bool active;
        bool defaulted;
    }

    uint256 public nextLoanId = 1;
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => Covenant) public covenants;
    mapping(uint256 => CovenantReport) public covenantReports;
    mapping(uint256 => bool) public covenantBreached;

    mapping(address => uint256) private _agentExposure;
    mapping(address => uint256[]) private _agentLoans;
    mapping(address => bool) public socialVerified;
    mapping(address => bytes32) public socialProof;
    mapping(address => mapping(address => uint256)) public verificationNonces;

    event TrancheDeposited(address indexed lender, uint8 indexed tranche, uint256 assets, uint256 sharesMinted);
    event TrancheWithdrawn(address indexed lender, uint8 indexed tranche, uint256 assetsOut, uint256 yieldOut, uint256 sharesBurned);
    event ReinsuranceStaked(address indexed staker, uint256 assets, uint256 sharesMinted);
    event ReinsuranceUnstaked(address indexed staker, uint256 assetsOut, uint256 sharesBurned);
    event DelegationCollateralDeposited(address indexed sponsor, uint256 amount);
    event DelegationCollateralWithdrawn(address indexed sponsor, uint256 amount);
    event DelegationUpdated(address indexed sponsor, address indexed agent, uint256 limit, uint256 expiry);
    event TaskCreated(uint256 indexed taskId, address indexed agent, uint256 receivable, uint256 dueDate, bool escrowed);
    event TaskSettled(uint256 indexed taskId, uint256 amount);
    event TaskEscrowFunded(uint256 indexed taskId, uint256 amount);
    event TaskEscrowReleased(uint256 indexed taskId, uint256 toPool, uint256 toAgent);
    event TaskEscrowed(uint256 indexed taskId, address indexed payer, uint256 amount, uint256 totalTaskEscrowLiability);
    event TaskEscrowLiabilityReleased(uint256 indexed taskId, uint256 escrowReleased, uint256 totalTaskEscrowLiability);
    event SocialVerified(address indexed subject, address indexed verifier, bytes32 payloadHash, uint256 nonce);
    event AttestationSubmitted(address indexed agent, address indexed attestor, uint256 scoreBps, uint256 confidenceBps, bytes32 evidence);
    event PassportUpdated(address indexed agent, uint256 indexed sourceChainId, uint256 scoreBps, uint256 confidenceBps, uint256 nonce);
    event UnderwriterRegistered(uint16 indexed underwriterId, address indexed model, uint256 feeBps);
    event UnderwriterStatusUpdated(uint16 indexed underwriterId, bool active);
    event UnderwriterFeesWithdrawn(uint16 indexed underwriterId, address indexed recipient, uint256 amount);
    event LoanOpened(uint256 indexed loanId, address indexed borrower, address indexed sponsor, uint256 principal, uint256 aprBps, uint8 tranche, uint8 mode, uint256 taskId, bytes32 intentHash);
    event IntentExecuted(uint256 indexed loanId, address indexed caller, address indexed to, uint256 amount, bytes32 intentHash);
    event UnusedCreditCancelled(uint256 indexed loanId, uint256 amount);
    event LoanRepaid(uint256 indexed loanId, address indexed payer, uint256 amount, uint256 principalPaid, uint256 interestPaid, uint256 remainingDebt);
    event StreamRepayment(uint256 indexed loanId, bytes32 indexed streamRef, uint256 amount);
    event CovenantReported(uint256 indexed loanId, int256 pnlBps, uint256 drawdownBps, uint256 completionBps, bool breached);
    event LoanLiquidated(uint256 indexed loanId, address indexed liquidator, uint256 insuranceUsed, uint256 reinsuranceUsed, uint256 badDebt);
    event IsolationModeSet(bool enabled);
    event IsolationWhitelistSet(address indexed agent, bool allowed);
    event ConfigUpdated();
    event ProtocolFeesWithdrawn(address indexed recipient, uint256 amount);
    event EmergencyTokenRecovered(address indexed token, address indexed recipient, uint256 amount);

    error InvalidAddress();
    error InvalidAmount();
    error InvalidTranche();
    error InsufficientLiquidity();
    error LoanNotActive();
    error NotBorrower();
    error BorrowCapExceeded();
    error DelegationUnavailable();
    error TaskUnavailable();
    error TaskAlreadyLinked();
    error UnauthorizedIntent();
    error UnsupportedTenor();
    error IsolationRestricted();
    error UnderwriterUnavailable();

    constructor(
        address admin,
        address guardian,
        address treasury,
        address usdcToken,
        address reputation,
        address usdcFeed,
        address aiFeed
    ) EIP712("ClawCreditAgentStandardV3", "1") {
        if (
            admin == address(0) || guardian == address(0) || treasury == address(0)
                || usdcToken == address(0) || reputation == address(0) || usdcFeed == address(0)
                || aiFeed == address(0)
        ) revert InvalidAddress();

        usdc = IERC20(usdcToken);
        reputationRegistry = IERC8004Reputation(reputation);
        usdcUsdFeed = AggregatorV3Interface(usdcFeed);
        aiPerformanceFeed = AggregatorV3Interface(aiFeed);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, guardian);
        _grantRole(TREASURY_ROLE, treasury);
        _grantRole(RISK_MANAGER_ROLE, admin);
        _grantRole(UNDERWRITER_ADMIN_ROLE, admin);
        _grantRole(ORACLE_MANAGER_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(PASSPORT_ROLE, admin);
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function depositTranche(uint8 tranche, uint256 assets)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 sharesMinted)
    {
        _validateTranche(tranche);
        if (assets == 0) revert InvalidAmount();

        TrancheState storage t = trancheState[tranche];
        uint256 assetsBefore = t.assets;
        if (t.shares > 0 && assetsBefore == 0) revert InsufficientLiquidity();

        sharesMinted = t.shares == 0 ? assets : (assets * t.shares) / assetsBefore;
        if (sharesMinted == 0) revert InvalidAmount();

        t.assets += assets;
        t.shares += sharesMinted;
        trancheShares[tranche][msg.sender] += sharesMinted;

        usdc.safeTransferFrom(msg.sender, address(this), assets);
        emit TrancheDeposited(msg.sender, tranche, assets, sharesMinted);
    }

    function withdrawTranche(uint8 tranche, uint256 sharesBurned)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 assetsOut, uint256 yieldOut)
    {
        _validateTranche(tranche);
        if (sharesBurned == 0) revert InvalidAmount();

        TrancheState storage t = trancheState[tranche];
        uint256 userShares = trancheShares[tranche][msg.sender];
        if (sharesBurned > userShares || t.shares == 0) revert InvalidAmount();

        assetsOut = (sharesBurned * t.assets) / t.shares;
        yieldOut = (sharesBurned * t.pendingYield) / t.shares;

        trancheShares[tranche][msg.sender] = userShares - sharesBurned;
        t.shares -= sharesBurned;
        t.assets -= assetsOut;
        t.pendingYield -= yieldOut;

        uint256 out = assetsOut + yieldOut;
        _checkLiquidBalance(out);
        usdc.safeTransfer(msg.sender, out);

        emit TrancheWithdrawn(msg.sender, tranche, assetsOut, yieldOut, sharesBurned);
    }

    function stakeReinsurance(uint256 assets)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 sharesMinted)
    {
        if (assets == 0) revert InvalidAmount();

        uint256 poolBefore = reinsurancePool;
        sharesMinted = totalReinsuranceShares == 0
            ? assets
            : (assets * totalReinsuranceShares) / poolBefore;
        if (sharesMinted == 0) revert InvalidAmount();

        totalReinsuranceShares += sharesMinted;
        reinsuranceShares[msg.sender] += sharesMinted;
        reinsurancePool += assets;

        usdc.safeTransferFrom(msg.sender, address(this), assets);
        emit ReinsuranceStaked(msg.sender, assets, sharesMinted);
    }

    function unstakeReinsurance(uint256 sharesBurned)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 assetsOut)
    {
        if (sharesBurned == 0 || sharesBurned > reinsuranceShares[msg.sender] || totalReinsuranceShares == 0) {
            revert InvalidAmount();
        }

        assetsOut = (sharesBurned * reinsurancePool) / totalReinsuranceShares;
        reinsuranceShares[msg.sender] -= sharesBurned;
        totalReinsuranceShares -= sharesBurned;
        reinsurancePool -= assetsOut;

        _checkLiquidBalance(assetsOut);
        usdc.safeTransfer(msg.sender, assetsOut);
        emit ReinsuranceUnstaked(msg.sender, assetsOut, sharesBurned);
    }

    function depositDelegationCollateral(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        sponsorCollateral[msg.sender] += amount;
        totalSponsorCollateral += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit DelegationCollateralDeposited(msg.sender, amount);
    }

    function withdrawDelegationCollateral(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0 || amount > sponsorCollateral[msg.sender]) revert InvalidAmount();
        if (sponsorCollateral[msg.sender] - amount < sponsorDelegatedCapacity[msg.sender]) {
            revert DelegationUnavailable();
        }

        sponsorCollateral[msg.sender] -= amount;
        totalSponsorCollateral -= amount;
        _checkLiquidBalance(amount);
        usdc.safeTransfer(msg.sender, amount);
        emit DelegationCollateralWithdrawn(msg.sender, amount);
    }

    function setDelegation(address agent, uint256 limit, uint40 expiry) external whenNotPaused {
        if (agent == address(0)) revert InvalidAddress();
        if (limit > type(uint96).max || expiry <= block.timestamp) revert InvalidAmount();

        Delegation storage d = delegations[msg.sender][agent];
        if (limit < d.used) revert DelegationUnavailable();

        uint256 trackedLimit = d.limit;
        if (d.active && d.expiry <= block.timestamp && trackedLimit > d.used) {
            uint256 expiredSlack = trackedLimit - d.used;
            if (expiredSlack > sponsorDelegatedCapacity[msg.sender]) revert DelegationUnavailable();
            sponsorDelegatedCapacity[msg.sender] -= expiredSlack;
            d.limit = d.used;
            trackedLimit = d.used;
        }

        uint256 currentCapacity = sponsorDelegatedCapacity[msg.sender];
        uint256 newCapacity;
        if (limit >= trackedLimit) {
            newCapacity = currentCapacity + (limit - trackedLimit);
        } else {
            uint256 reduction = trackedLimit - limit;
            if (reduction > currentCapacity) revert DelegationUnavailable();
            newCapacity = currentCapacity - reduction;
        }
        if (newCapacity > sponsorCollateral[msg.sender]) revert DelegationUnavailable();

        sponsorDelegatedCapacity[msg.sender] = newCapacity;
        d.limit = uint96(limit);
        d.expiry = expiry;
        d.active = true;

        emit DelegationUpdated(msg.sender, agent, limit, expiry);
    }

    /// @notice Revokes future borrowing capacity while preserving used delegation until repayment.
    function revokeDelegation(address agent) external whenNotPaused {
        Delegation storage d = delegations[msg.sender][agent];
        if (!d.active && d.limit == 0) revert DelegationUnavailable();

        uint256 nextLimit = d.used;
        if (d.limit > nextLimit) {
            uint256 released = d.limit - nextLimit;
            if (released > sponsorDelegatedCapacity[msg.sender]) revert DelegationUnavailable();
            sponsorDelegatedCapacity[msg.sender] -= released;
        }

        d.limit = uint96(nextLimit);
        d.expiry = uint40(block.timestamp);
        d.active = nextLimit > 0;

        emit DelegationUpdated(msg.sender, agent, nextLimit, block.timestamp);
    }

    /// @notice Releases delegated capacity once expired and fully repaid.
    function pruneExpiredDelegation(address sponsor, address agent) external whenNotPaused {
        Delegation storage d = delegations[sponsor][agent];
        if (!d.active || d.expiry > block.timestamp || d.used != 0 || d.limit == 0) {
            revert DelegationUnavailable();
        }
        if (d.limit > sponsorDelegatedCapacity[sponsor]) revert DelegationUnavailable();

        sponsorDelegatedCapacity[sponsor] -= d.limit;
        d.limit = 0;
        d.active = false;

        emit DelegationUpdated(sponsor, agent, 0, d.expiry);
    }

    function createTaskReceivable(uint256 receivable, uint40 dueDate, bytes32 externalRef, bool escrowed)
        external
        whenNotPaused
        returns (uint256 taskId)
    {
        if (receivable == 0 || receivable > type(uint96).max || dueDate <= block.timestamp) {
            revert InvalidAmount();
        }

        uint256 escrowBalance;
        if (escrowed) {
            uint256 balBefore = usdc.balanceOf(address(this));
            usdc.safeTransferFrom(msg.sender, address(this), receivable);
            uint256 balAfter = usdc.balanceOf(address(this));
            escrowBalance = balAfter - balBefore;
            if (escrowBalance == 0) revert InvalidAmount();
            totalTaskEscrowLiability += escrowBalance;
        }

        taskId = nextTaskId++;
        tasks[taskId] = TaskReceivable({
            agent: msg.sender,
            receivable: uint96(receivable),
            escrowBalance: uint96(escrowBalance),
            dueDate: dueDate,
            externalRef: externalRef,
            escrowed: escrowed,
            settled: false
        });

        if (escrowed) {
            emit TaskEscrowFunded(taskId, escrowBalance);
            emit TaskEscrowed(taskId, msg.sender, escrowBalance, totalTaskEscrowLiability);
        }
        emit TaskCreated(taskId, msg.sender, receivable, dueDate, escrowed);
    }

    function verifySocialAccount(
        address subject,
        address verifier,
        bytes32 action,
        uint256 deadline,
        bytes32 payloadHash,
        bytes calldata signature
    ) external whenNotPaused {
        if (subject == address(0) || verifier == address(0)) revert InvalidAddress();
        if (block.timestamp > deadline) revert InvalidAmount();
        if (!(hasRole(ORACLE_MANAGER_ROLE, verifier) || hasRole(VERIFIER_ROLE, verifier))) revert DelegationUnavailable();

        uint256 nonce = verificationNonces[subject][verifier];
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _SOCIAL_VERIFICATION_TYPEHASH,
                    subject,
                    verifier,
                    action,
                    block.chainid,
                    address(this),
                    nonce,
                    deadline,
                    payloadHash
                )
            )
        );

        _validateVerifierSignature(verifier, digest, signature);
        verificationNonces[subject][verifier] = nonce + 1;
        socialVerified[subject] = true;
        socialProof[subject] = payloadHash;
        emit SocialVerified(subject, verifier, payloadHash, nonce);
    }

    function settleTask(uint256 taskId, uint256 amount) external nonReentrant whenNotPaused {
        TaskReceivable storage task = tasks[taskId];
        if (task.agent == address(0) || task.settled) revert TaskUnavailable();
        if (msg.sender != task.agent && !hasRole(EARNINGS_HOOK_ROLE, msg.sender)) revert DelegationUnavailable();

        task.settled = true;
        uint256 escrow = task.escrowBalance;
        if (escrow > 0) {
            task.escrowBalance = 0;
            totalTaskEscrowLiability -= escrow;
            emit TaskEscrowLiabilityReleased(taskId, escrow, totalTaskEscrowLiability);
        }

        if (amount > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), amount);
        }

        (uint256 toPool, uint256 toAgent) = _repayTaskLinkedLoan(taskId, amount + escrow, task.agent);
        emit TaskEscrowReleased(taskId, toPool, toAgent);
        emit TaskSettled(taskId, toPool + toAgent);
    }

    function releaseTaskPayment(uint256 taskId) external nonReentrant whenNotPaused {
        TaskReceivable storage task = tasks[taskId];
        if (task.agent == address(0) || task.settled || !task.escrowed) revert TaskUnavailable();
        if (msg.sender != task.agent && !hasRole(EARNINGS_HOOK_ROLE, msg.sender)) revert DelegationUnavailable();

        task.settled = true;
        uint256 escrow = task.escrowBalance;
        task.escrowBalance = 0;
        totalTaskEscrowLiability -= escrow;
        emit TaskEscrowLiabilityReleased(taskId, escrow, totalTaskEscrowLiability);

        (uint256 toPool, uint256 toAgent) = _repayTaskLinkedLoan(taskId, escrow, task.agent);

        emit TaskEscrowReleased(taskId, toPool, toAgent);
        emit TaskSettled(taskId, toPool + toAgent);
    }

    function submitAttestation(address agent, uint256 scoreBps, uint256 confidenceBps, bytes32 evidence)
        external
        onlyRole(ATTESTOR_ROLE)
    {
        if (agent == address(0) || scoreBps > BPS || confidenceBps > BPS) revert InvalidAmount();

        Attestation memory prev = attestations[agent][msg.sender];
        if (prev.updatedAt > 0 && prev.confidenceBps > 0) {
            _attestationWeightedScoreSum[agent] -= uint256(prev.scoreBps) * uint256(prev.confidenceBps);
            _attestationWeightSum[agent] -= prev.confidenceBps;
        }

        attestations[agent][msg.sender] = Attestation({
            scoreBps: uint16(scoreBps),
            confidenceBps: uint16(confidenceBps),
            updatedAt: uint40(block.timestamp),
            evidence: evidence
        });

        if (confidenceBps > 0) {
            _attestationWeightedScoreSum[agent] += scoreBps * confidenceBps;
            _attestationWeightSum[agent] += confidenceBps;
        }

        if (!_attestorSeen[agent][msg.sender]) {
            _attestorSeen[agent][msg.sender] = true;
            _agentAttestors[agent].push(msg.sender);
        }

        emit AttestationSubmitted(agent, msg.sender, scoreBps, confidenceBps, evidence);
    }

    function updatePassport(address agent, uint256 sourceChainId, uint256 scoreBps, uint256 confidenceBps, uint64 nonce)
        external
        onlyRole(PASSPORT_ROLE)
    {
        if (agent == address(0) || scoreBps > BPS || confidenceBps > BPS) revert InvalidAmount();

        Passport storage p = passports[agent][sourceChainId];
        if (nonce <= p.nonce) revert InvalidAmount();

        if (p.updatedAt > 0 && p.confidenceBps > 0) {
            _passportWeightedScoreSum[agent] -= uint256(p.scoreBps) * uint256(p.confidenceBps);
            _passportWeightSum[agent] -= p.confidenceBps;
        }

        p.scoreBps = uint16(scoreBps);
        p.confidenceBps = uint16(confidenceBps);
        p.nonce = nonce;
        p.updatedAt = uint40(block.timestamp);

        if (confidenceBps > 0) {
            _passportWeightedScoreSum[agent] += scoreBps * confidenceBps;
            _passportWeightSum[agent] += confidenceBps;
        }

        if (!_passportChainSeen[agent][sourceChainId]) {
            _passportChainSeen[agent][sourceChainId] = true;
            _agentPassportChains[agent].push(sourceChainId);
        }

        emit PassportUpdated(agent, sourceChainId, scoreBps, confidenceBps, nonce);
    }

    function registerUnderwriter(address model, uint256 feeBps)
        external
        onlyRole(UNDERWRITER_ADMIN_ROLE)
        returns (uint16 underwriterId)
    {
        if (model == address(0) || feeBps > 1_000) revert InvalidAmount();

        underwriterId = nextUnderwriterId++;
        underwriters[underwriterId] = Underwriter({
            model: model,
            feeBps: uint16(feeBps),
            active: true,
            loansQuoted: 0,
            defaults: 0,
            accruedFees: 0
        });

        emit UnderwriterRegistered(underwriterId, model, feeBps);
    }

    function setUnderwriterStatus(uint16 underwriterId, bool active) external onlyRole(UNDERWRITER_ADMIN_ROLE) {
        Underwriter storage uw = underwriters[underwriterId];
        if (uw.model == address(0)) revert UnderwriterUnavailable();
        uw.active = active;
        emit UnderwriterStatusUpdated(underwriterId, active);
    }

    function withdrawUnderwriterFees(uint16 underwriterId, address recipient, uint256 amount) external nonReentrant {
        Underwriter storage uw = underwriters[underwriterId];
        if (uw.model == address(0) || recipient == address(0)) revert InvalidAddress();
        if (msg.sender != uw.model && !hasRole(TREASURY_ROLE, msg.sender)) revert DelegationUnavailable();
        if (amount == 0 || amount > uw.accruedFees) revert InvalidAmount();

        uw.accruedFees -= amount;
        protocolFees -= amount;
        underwriterFeeLiability -= amount;
        _checkLiquidBalance(amount);
        usdc.safeTransfer(recipient, amount);

        emit UnderwriterFeesWithdrawn(underwriterId, recipient, amount);
    }

    function blendedScore(address agent) public view returns (uint256) {
        uint256 repScore;
        bool repExists;
        IERC8004Reputation.ReputationData memory rep = reputationRegistry.getReputation(agent);
        repScore = rep.score > BPS ? BPS : rep.score;
        repExists = rep.exists;

        uint256 aiScore = _readAiScoreBpsSafe();

        uint256 attWeight = _attestationWeightSum[agent];
        uint256 attScore = attWeight == 0 ? 0 : _attestationWeightedScoreSum[agent] / attWeight;

        uint256 passWeight = _passportWeightSum[agent];
        uint256 passScore = passWeight == 0 ? 0 : _passportWeightedScoreSum[agent] / passWeight;

        uint256 totalWeight;
        uint256 weighted;

        if (repExists) {
            totalWeight += 4_000;
            weighted += repScore * 4_000;
        }

        totalWeight += 2_000;
        weighted += aiScore * 2_000;

        if (attWeight > 0) {
            totalWeight += 2_000;
            weighted += attScore * 2_000;
        }

        if (passWeight > 0) {
            totalWeight += 2_000;
            weighted += passScore * 2_000;
        }

        if (totalWeight == 0) return 0;
        return weighted / totalWeight;
    }

    function creditLimit(address agent) public view returns (uint256) {
        uint256 score = blendedScore(agent);
        uint256 limit = 50e6 + ((score * 450e6) / BPS);
        if (limit > maxExposurePerAgent) limit = maxExposurePerAgent;
        return limit;
    }

    function exposureOf(address agent) external view returns (uint256) {
        return _agentExposure[agent];
    }

    function getAgentLoans(address agent) external view returns (uint256[] memory) {
        return _agentLoans[agent];
    }

    function getAgentLoansPaginated(address agent, uint256 start, uint256 limit)
        external
        view
        returns (uint256[] memory loanIds)
    {
        uint256 total = _agentLoans[agent].length;
        if (start >= total || limit == 0) return new uint256[](0);
        uint256 end = start + limit;
        if (end > total) end = total;
        loanIds = new uint256[](end - start);
        for (uint256 i = start; i < end; i++) {
            loanIds[i - start] = _agentLoans[agent][i];
        }
    }

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function getAgentAttestors(address agent) external view returns (address[] memory) {
        return _agentAttestors[agent];
    }

    function getAgentPassportChains(address agent) external view returns (uint256[] memory) {
        return _agentPassportChains[agent];
    }

    function openRevolvingLoan(
        uint256 amount,
        uint256 tenorDays,
        uint16 underwriterId,
        bytes32 intentHash,
        Covenant calldata covenant
    ) external nonReentrant whenNotPaused returns (uint256 loanId) {
        _requireBorrowerAllowed(msg.sender);
        if (tenorDays == 0 || tenorDays > maxTenorDays) revert UnsupportedTenor();
        if (amount < minLoan) revert InvalidAmount();

        uint256 limit = creditLimit(msg.sender);
        if (_agentExposure[msg.sender] + amount > limit) revert BorrowCapExceeded();

        loanId = _openLoan(
            msg.sender,
            address(0),
            amount,
            tenorDays,
            underwriterId,
            intentHash,
            covenant,
            0,
            0,
            false
        );
    }

    function openTaskBackedLoan(
        uint256 taskId,
        uint256 amount,
        uint256 tenorDays,
        uint16 underwriterId,
        bytes32 intentHash,
        Covenant calldata covenant
    ) external nonReentrant whenNotPaused returns (uint256 loanId) {
        _requireBorrowerAllowed(msg.sender);
        if (tenorDays == 0 || tenorDays > maxTenorDays) revert UnsupportedTenor();
        if (amount < minLoan) revert InvalidAmount();

        TaskReceivable memory task = tasks[taskId];
        if (task.agent != msg.sender || task.settled || !task.escrowed) revert TaskUnavailable();
        if (taskLoan[taskId] != 0) revert TaskAlreadyLinked();
        if (task.escrowBalance == 0) revert TaskUnavailable();
        if (task.dueDate < block.timestamp + tenorDays * 1 days) revert TaskUnavailable();
        uint256 maxBorrow = (uint256(task.escrowBalance) * taskEscrowHaircutBps) / BPS;
        if (amount > maxBorrow) revert BorrowCapExceeded();

        uint256 coverageBps = task.escrowBalance == 0 ? 0 : (uint256(task.escrowBalance) * BPS) / amount;
        if (coverageBps < BPS) revert TaskUnavailable();

        loanId = _openLoan(
            msg.sender,
            address(0),
            amount,
            tenorDays,
            underwriterId,
            intentHash,
            covenant,
            taskId,
            coverageBps,
            false
        );
    }

    function openDelegatedLoan(
        address sponsor,
        uint256 amount,
        uint256 tenorDays,
        uint16 underwriterId,
        bytes32 intentHash,
        Covenant calldata covenant
    ) external nonReentrant whenNotPaused returns (uint256 loanId) {
        _requireBorrowerAllowed(msg.sender);
        if (sponsor == address(0) || tenorDays == 0 || tenorDays > maxTenorDays) revert InvalidAmount();
        if (amount < minLoan) revert InvalidAmount();

        Delegation storage d = delegations[sponsor][msg.sender];
        if (!d.active || d.expiry <= block.timestamp) revert DelegationUnavailable();
        if (d.used + amount > d.limit) revert DelegationUnavailable();

        if (sponsorCollateral[sponsor] < sponsorDelegatedCapacity[sponsor]) revert DelegationUnavailable();

        d.used += uint96(amount);

        loanId = _openLoan(
            msg.sender,
            sponsor,
            amount,
            tenorDays,
            underwriterId,
            intentHash,
            covenant,
            0,
            0,
            true
        );
    }

    function executeIntent(uint256 loanId, bytes32 intentHash, address to, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();
        if (to == address(0) || amount == 0) revert InvalidAmount();
        if (msg.sender != loan.borrower && !hasRole(EXECUTOR_ROLE, msg.sender)) revert UnauthorizedIntent();
        if (intentHash == bytes32(0) || intentHash != loan.intentHash) revert UnauthorizedIntent();
        if (amount > loan.reservedCredit) revert InvalidAmount();

        loan.reservedCredit -= uint96(amount);
        reservedIntentCredit -= amount;

        _checkLiquidBalance(amount);
        usdc.safeTransfer(to, amount);
        emit IntentExecuted(loanId, msg.sender, to, amount, intentHash);
    }

    function cancelUnusedCredit(uint256 loanId, uint256 amount) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (amount == 0 || amount > loan.reservedCredit) revert InvalidAmount();

        loan.reservedCredit -= uint96(amount);
        reservedIntentCredit -= amount;

        _applyInternalRepayment(loanId, loan, amount, msg.sender);
        emit UnusedCreditCancelled(loanId, amount);
    }

    function repay(uint256 loanId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();

        _accrueInterest(loan);
        uint256 debt = _currentDebt(loan);
        if (amount > debt) amount = debt;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        _applyExternalRepayment(loanId, loan, amount, msg.sender);
    }

    function streamRepay(uint256 loanId, uint256 amount, bytes32 streamRef)
        external
        nonReentrant
        whenNotPaused
    {
        if (amount == 0) revert InvalidAmount();
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();
        if (msg.sender != loan.borrower && !hasRole(EARNINGS_HOOK_ROLE, msg.sender)) {
            revert DelegationUnavailable();
        }

        _accrueInterest(loan);
        uint256 debt = _currentDebt(loan);
        if (amount > debt) amount = debt;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        _applyExternalRepayment(loanId, loan, amount, msg.sender);

        emit StreamRepayment(loanId, streamRef, amount);
    }

    function submitCovenantReport(
        uint256 loanId,
        int256 pnlBps,
        uint256 drawdownBps,
        uint256 completionBps
    ) external onlyRole(ATTESTOR_ROLE) {
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();

        Covenant memory c = covenants[loanId];
        if (c.reviewAt == 0 || block.timestamp < c.reviewAt) revert InvalidAmount();

        bool breached = false;
        if (drawdownBps > c.maxDrawdownBps) breached = true;
        if (completionBps < c.minTaskCompletionBps) breached = true;
        if (pnlBps < c.minPnlBps) breached = true;

        covenantReports[loanId] = CovenantReport({
            pnlBps: pnlBps,
            drawdownBps: drawdownBps,
            completionBps: completionBps,
            reportedAt: uint40(block.timestamp)
        });

        if (breached) {
            covenantBreached[loanId] = true;
            if (loan.aprBps < 3_500) {
                loan.aprBps += 200;
            }
        }

        emit CovenantReported(loanId, pnlBps, drawdownBps, completionBps, breached);
    }

    function liquidate(uint256 loanId) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();
        if (!_isLiquidatable(loanId, loan)) revert LoanNotActive();

        _accrueInterest(loan);

        uint256 debt = _currentDebt(loan);

        uint256 fromReserved = loan.reservedCredit;
        if (fromReserved > 0) {
            uint256 used = fromReserved > debt ? debt : fromReserved;
            loan.reservedCredit -= uint96(used);
            reservedIntentCredit -= used;
            debt -= used;
            _applyRepaymentAccounting(loan, used);
        }

        uint256 fromSponsor;
        if (debt > 0 && loan.sponsor != address(0)) {
            uint256 avail = sponsorCollateral[loan.sponsor];
            fromSponsor = avail > debt ? debt : avail;
            if (fromSponsor > 0) {
                sponsorCollateral[loan.sponsor] -= fromSponsor;
                totalSponsorCollateral -= fromSponsor;
                debt -= fromSponsor;
                _applyRepaymentAccounting(loan, fromSponsor);
            }
        }

        uint256 insuranceUsed;
        if (debt > 0) {
            insuranceUsed = insurancePool > debt ? debt : insurancePool;
            if (insuranceUsed > 0) {
                insurancePool -= insuranceUsed;
                debt -= insuranceUsed;
                _applyRepaymentAccounting(loan, insuranceUsed);
            }
        }

        uint256 reinsuranceUsed;
        if (debt > 0) {
            reinsuranceUsed = reinsurancePool > debt ? debt : reinsurancePool;
            if (reinsuranceUsed > 0) {
                reinsurancePool -= reinsuranceUsed;
                debt -= reinsuranceUsed;
                _applyRepaymentAccounting(loan, reinsuranceUsed);
            }
        }

        uint256 badDebt = debt;
        if (badDebt > 0) {
            _applyLossWaterfall(badDebt);
        }

        if (loan.principalOutstanding > 0) {
            uint256 writeoff = loan.principalOutstanding;
            totalOutstandingPrincipal -= writeoff;
            _agentExposure[loan.borrower] -= writeoff;
            _reduceDelegatedUsage(loan, writeoff);
            loan.principalOutstanding = 0;
        }
        if (loan.accruedInterest > 0) {
            loan.accruedInterest = 0;
        }

        _closeLoan(loanId, loan, false);

        if (loan.underwriterId != 0) {
            underwriters[loan.underwriterId].defaults += 1;
        }

        emit LoanLiquidated(loanId, msg.sender, insuranceUsed, reinsuranceUsed, badDebt);
    }

    function isLiquidatable(uint256 loanId) external view returns (bool) {
        Loan memory loan = loans[loanId];
        if (!loan.active) return false;
        return _isLiquidatable(loanId, loan);
    }

    function withdrawProtocolFees(address recipient, uint256 amount)
        external
        nonReentrant
        onlyRole(TREASURY_ROLE)
    {
        if (recipient == address(0)) revert InvalidAddress();
        uint256 withdrawable = protocolFees > underwriterFeeLiability
            ? protocolFees - underwriterFeeLiability
            : 0;
        if (amount == 0 || amount > withdrawable) revert InvalidAmount();

        protocolFees -= amount;
        _checkLiquidBalance(amount);
        usdc.safeTransfer(recipient, amount);

        emit ProtocolFeesWithdrawn(recipient, amount);
    }

    function withdrawableProtocolFees() external view returns (uint256) {
        return protocolFees > underwriterFeeLiability ? protocolFees - underwriterFeeLiability : 0;
    }

    function setIsolationMode(bool enabled) external onlyRole(RISK_MANAGER_ROLE) {
        isolationMode = enabled;
        emit IsolationModeSet(enabled);
    }

    function setIsolationWhitelist(address agent, bool allowed) external onlyRole(RISK_MANAGER_ROLE) {
        isolationWhitelist[agent] = allowed;
        emit IsolationWhitelistSet(agent, allowed);
    }

    function setCoreConfig(
        uint256 newMinLoan,
        uint256 newMaxExposurePerAgent,
        uint256 newMaxTenorDays,
        uint256 newGracePeriod,
        uint256 newLiquidationThresholdBps,
        uint256 newMinUsdcPegBps
    ) external onlyRole(RISK_MANAGER_ROLE) {
        if (
            newMinLoan == 0 || newMaxExposurePerAgent > 500e6 || newMaxTenorDays == 0
                || newMaxTenorDays > 60 || newGracePeriod > 14 days
                || newLiquidationThresholdBps < 6_500 || newLiquidationThresholdBps > 9_500
                || newMinUsdcPegBps > BPS
        ) revert InvalidAmount();

        minLoan = newMinLoan;
        maxExposurePerAgent = newMaxExposurePerAgent;
        maxTenorDays = newMaxTenorDays;
        gracePeriod = newGracePeriod;
        liquidationThresholdBps = newLiquidationThresholdBps;
        minUsdcPegBps = newMinUsdcPegBps;

        emit ConfigUpdated();
    }

    function setFeeConfig(
        uint256 newOriginationFeeBps,
        uint256 newInsuranceFeeBps,
        uint256 newProtocolFeeBps,
        uint256 newReinsurancePremiumBps,
        uint256 newLateFeeBpsPerDay
    ) external onlyRole(RISK_MANAGER_ROLE) {
        if (
            newOriginationFeeBps > 1_000 || newInsuranceFeeBps + newProtocolFeeBps >= BPS
                || newReinsurancePremiumBps > 500 || newLateFeeBpsPerDay > 300
        ) revert InvalidAmount();

        originationFeeBps = newOriginationFeeBps;
        insuranceFeeBps = newInsuranceFeeBps;
        protocolFeeBps = newProtocolFeeBps;
        reinsurancePremiumBps = newReinsurancePremiumBps;
        lateFeeBpsPerDay = newLateFeeBpsPerDay;

        emit ConfigUpdated();
    }

    function setOracles(address newUsdcFeed, address newAiFeed, uint256 newHeartbeat)
        external
        onlyRole(RISK_MANAGER_ROLE)
    {
        if (newUsdcFeed == address(0) || newAiFeed == address(0) || newHeartbeat == 0 || newHeartbeat > 24 hours) {
            revert InvalidAmount();
        }

        usdcUsdFeed = AggregatorV3Interface(newUsdcFeed);
        aiPerformanceFeed = AggregatorV3Interface(newAiFeed);
        oracleHeartbeat = newHeartbeat;

        emit ConfigUpdated();
    }

    function setTaskEscrowHaircutBps(uint256 newHaircutBps) external onlyRole(RISK_MANAGER_ROLE) {
        if (newHaircutBps == 0 || newHaircutBps > BPS) revert InvalidAmount();
        taskEscrowHaircutBps = newHaircutBps;
        emit ConfigUpdated();
    }

    function getCurrentDebt(uint256 loanId) external view returns (uint256) {
        Loan memory loan = loans[loanId];
        if (!loan.active) return 0;
        uint256 pending = 0;
        if (block.timestamp > loan.lastAccrual) {
            uint256 elapsed = block.timestamp - loan.lastAccrual;
            pending = (uint256(loan.principalOutstanding) * loan.aprBps * elapsed) / (YEAR * BPS);

            if (block.timestamp > loan.dueDate) {
                uint256 lateStart = loan.lastAccrual > loan.dueDate ? loan.lastAccrual : loan.dueDate;
                if (block.timestamp > lateStart) {
                    uint256 lateDays = (block.timestamp - lateStart) / 1 days;
                    pending += (uint256(loan.principalOutstanding) * lateFeeBpsPerDay * lateDays) / BPS;
                }
            }
        }
        return uint256(loan.principalOutstanding) + uint256(loan.accruedInterest) + pending;
    }

    function _openLoan(
        address borrower,
        address sponsor,
        uint256 amount,
        uint256 tenorDays,
        uint16 underwriterId,
        bytes32 intentHash,
        Covenant calldata covenant,
        uint256 taskId,
        uint256 taskCoverageBps,
        bool delegated
    ) internal returns (uint256 loanId) {
        if (amount > type(uint96).max || tenorDays == 0 || tenorDays > maxTenorDays) revert InvalidAmount();
        if (intentHash == bytes32(0)) revert UnauthorizedIntent();
        if (_agentExposure[borrower] + amount > maxExposurePerAgent) revert BorrowCapExceeded();

        uint256 score = blendedScore(borrower);
        uint8 tranche = _selectTranche(score, delegated, taskId != 0);
        TrancheState storage t = trancheState[tranche];
        if (t.assets < amount) revert InsufficientLiquidity();

        (uint256 aprBps, uint256 underwriterFee) =
            _quoteUnderwriter(underwriterId, borrower, amount, tenorDays, score, taskCoverageBps);

        if (aprBps < 700) aprBps = 700;

        uint256 originationFee = (amount * originationFeeBps) / BPS;
        uint256 reinsurancePremium = (amount * reinsurancePremiumBps) / BPS;
        uint256 totalFee = originationFee + reinsurancePremium + underwriterFee;
        if (totalFee >= amount) revert InvalidAmount();
        uint256 netCredit = amount - totalFee;

        t.assets -= amount;

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower: borrower,
            sponsor: sponsor,
            principal: uint96(amount),
            principalOutstanding: uint96(amount),
            accruedInterest: 0,
            reservedCredit: uint96(netCredit),
            startTime: uint40(block.timestamp),
            dueDate: uint40(block.timestamp + tenorDays * 1 days),
            lastAccrual: uint40(block.timestamp),
            aprBps: uint16(aprBps),
            underwriterId: underwriterId,
            tranche: tranche,
            mode: taskId != 0 ? 1 : (delegated ? 2 : 0),
            taskId: taskId,
            intentHash: intentHash,
            active: true,
            defaulted: false
        });

        if (covenant.reviewAt > 0) {
            covenants[loanId] = covenant;
        }

        _agentExposure[borrower] += amount;
        _agentLoans[borrower].push(loanId);
        if (taskId != 0) {
            taskLoan[taskId] = loanId;
        }
        reservedIntentCredit += netCredit;
        totalOutstandingPrincipal += amount;

        _allocateOriginationRevenue(originationFee, reinsurancePremium, underwriterId, underwriterFee);

        emit LoanOpened(
            loanId,
            borrower,
            sponsor,
            amount,
            aprBps,
            tranche,
            taskId != 0 ? 1 : (delegated ? 2 : 0),
            taskId,
            intentHash
        );
    }

    function _quoteUnderwriter(
        uint16 underwriterId,
        address borrower,
        uint256 amount,
        uint256 tenorDays,
        uint256 score,
        uint256 taskCoverageBps
    ) internal returns (uint256 aprBps, uint256 underwriterFee) {
        aprBps = 1_800 - ((score * 900) / BPS);
        if (aprBps < 800) aprBps = 800;

        if (underwriterId == 0) {
            return (aprBps, 0);
        }

        Underwriter storage uw = underwriters[underwriterId];
        if (!uw.active || uw.model == address(0)) revert UnderwriterUnavailable();

        uw.loansQuoted += 1;

        try IAgentUnderwriterModel(uw.model).quote(
            borrower,
            amount,
            tenorDays,
            score,
            taskCoverageBps
        ) returns (uint256 modelApr, uint256 confidenceBps, uint256 maxAmount) {
            if (confidenceBps < 2_000 || maxAmount < amount || modelApr == 0 || modelApr > 5_000) {
                revert UnderwriterUnavailable();
            }
            aprBps = modelApr;
        } catch {
            revert UnderwriterUnavailable();
        }

        underwriterFee = (amount * uw.feeBps) / BPS;
    }

    function _allocateOriginationRevenue(
        uint256 originationFee,
        uint256 reinsurancePremium,
        uint16 underwriterId,
        uint256 underwriterFee
    ) internal {
        uint256 insuranceCut = (originationFee * insuranceFeeBps) / BPS;
        uint256 protocolCut = (originationFee * protocolFeeBps) / BPS;
        uint256 lenderYield = originationFee - insuranceCut - protocolCut;

        insurancePool += insuranceCut;
        protocolFees += protocolCut;
        reinsurancePool += reinsurancePremium;

        if (underwriterFee > 0 && underwriterId != 0) {
            underwriters[underwriterId].accruedFees += underwriterFee;
            protocolFees += underwriterFee;
            underwriterFeeLiability += underwriterFee;
        }

        _allocateYieldAcrossTranches(lenderYield);
    }

    function _allocateYieldAcrossTranches(uint256 amount) internal {
        if (amount == 0) return;
        uint256 senior = (amount * 4_000) / BPS;
        uint256 mezz = (amount * 3_500) / BPS;
        uint256 junior = amount - senior - mezz;

        trancheState[TRANCHE_SENIOR].pendingYield += senior;
        trancheState[TRANCHE_MEZZ].pendingYield += mezz;
        trancheState[TRANCHE_JUNIOR].pendingYield += junior;
    }

    function _allocateInterestRevenue(uint256 interestAmount) internal {
        if (interestAmount == 0) return;
        uint256 insuranceCut = (interestAmount * insuranceFeeBps) / BPS;
        uint256 protocolCut = (interestAmount * protocolFeeBps) / BPS;
        uint256 lenderYield = interestAmount - insuranceCut - protocolCut;

        insurancePool += insuranceCut;
        protocolFees += protocolCut;
        _allocateYieldAcrossTranches(lenderYield);
    }

    function _applyExternalRepayment(uint256 loanId, Loan storage loan, uint256 amount, address payer) internal {
        uint256 principalPaid;
        uint256 interestPaid;

        uint256 accrued = loan.accruedInterest;
        if (amount >= accrued) {
            interestPaid = accrued;
            amount -= accrued;
            loan.accruedInterest = 0;
        } else {
            interestPaid = amount;
            loan.accruedInterest = uint96(accrued - amount);
            amount = 0;
        }

        if (amount > 0) {
            uint256 principalOut = loan.principalOutstanding;
            principalPaid = amount > principalOut ? principalOut : amount;
            loan.principalOutstanding = uint96(principalOut - principalPaid);
            totalOutstandingPrincipal -= principalPaid;
            _agentExposure[loan.borrower] -= principalPaid;
            trancheState[loan.tranche].assets += principalPaid;
            _reduceDelegatedUsage(loan, principalPaid);
        }

        if (interestPaid > 0) {
            _allocateInterestRevenue(interestPaid);
        }

        uint256 remainingDebt = _currentDebt(loan);
        emit LoanRepaid(loanId, payer, principalPaid + interestPaid, principalPaid, interestPaid, remainingDebt);

        if (remainingDebt == 0) {
            _closeLoan(loanId, loan, true);
        }
    }

    function _applyInternalRepayment(uint256 loanId, Loan storage loan, uint256 amount, address payer) internal {
        _accrueInterest(loan);
        uint256 debt = _currentDebt(loan);
        if (amount > debt) amount = debt;

        _applyExternalRepayment(loanId, loan, amount, payer);
    }

    function _applyRepaymentAccounting(Loan storage loan, uint256 amount) internal {
        uint256 accrued = loan.accruedInterest;
        if (amount >= accrued) {
            uint256 interestPaid = accrued;
            amount -= accrued;
            loan.accruedInterest = 0;
            if (interestPaid > 0) {
                _allocateInterestRevenue(interestPaid);
            }
        } else {
            loan.accruedInterest = uint96(accrued - amount);
            _allocateInterestRevenue(amount);
            return;
        }

        if (amount > 0) {
            uint256 principalOut = loan.principalOutstanding;
            uint256 principalPaid = amount > principalOut ? principalOut : amount;
            loan.principalOutstanding = uint96(principalOut - principalPaid);
            totalOutstandingPrincipal -= principalPaid;
            _agentExposure[loan.borrower] -= principalPaid;
            trancheState[loan.tranche].assets += principalPaid;
            _reduceDelegatedUsage(loan, principalPaid);
        }
    }

    function _reduceDelegatedUsage(Loan storage loan, uint256 principalPaid) internal {
        if (loan.sponsor == address(0) || principalPaid == 0) return;

        Delegation storage d = delegations[loan.sponsor][loan.borrower];
        if (d.used > principalPaid) {
            d.used -= uint96(principalPaid);
        } else {
            d.used = 0;
        }

        if (d.used == 0 && d.expiry <= block.timestamp && d.limit > 0) {
            if (d.limit > sponsorDelegatedCapacity[loan.sponsor]) revert DelegationUnavailable();
            sponsorDelegatedCapacity[loan.sponsor] -= d.limit;
            d.limit = 0;
            d.active = false;
        }
    }

    function _closeLoan(uint256 loanId, Loan storage loan, bool repaid) internal {
        if (!loan.active) return;
        loan.active = false;
        loan.defaulted = !repaid;

        if (loan.reservedCredit > 0) {
            uint256 leftover = loan.reservedCredit;
            loan.reservedCredit = 0;
            reservedIntentCredit -= leftover;
            if (repaid) {
                _checkLiquidBalance(leftover);
                usdc.safeTransfer(loan.borrower, leftover);
            } else {
                trancheState[loan.tranche].assets += leftover;
            }
        }

        if (repaid) {
            reputationRegistry.updateReputation(loan.borrower, true, loan.principal);
        } else {
            reputationRegistry.updateReputation(loan.borrower, false, loan.principal);
        }

    }

    function _accrueInterest(Loan storage loan) internal {
        if (!loan.active) return;
        if (block.timestamp <= loan.lastAccrual) return;

        uint256 elapsed = block.timestamp - loan.lastAccrual;
        uint256 interest = (uint256(loan.principalOutstanding) * loan.aprBps * elapsed) / (YEAR * BPS);

        uint256 latePenalty;
        if (block.timestamp > loan.dueDate) {
            uint256 lateStart = loan.lastAccrual > loan.dueDate ? loan.lastAccrual : loan.dueDate;
            if (block.timestamp > lateStart) {
                uint256 lateDays = (block.timestamp - lateStart) / 1 days;
                latePenalty = (uint256(loan.principalOutstanding) * lateFeeBpsPerDay * lateDays) / BPS;
            }
        }

        loan.accruedInterest += uint96(interest + latePenalty);
        loan.lastAccrual = uint40(block.timestamp);
    }

    function _currentDebt(Loan storage loan) internal view returns (uint256) {
        return uint256(loan.principalOutstanding) + uint256(loan.accruedInterest);
    }

    function _isLiquidatable(uint256 loanId, Loan memory loan) internal view returns (bool) {
        if (block.timestamp > loan.dueDate + gracePeriod) return true;
        if (covenantBreached[loanId]) return true;

        (bool pegOk, uint256 pegBps) = _readUsdcPegBpsSafe();
        if (pegOk && pegBps < minUsdcPegBps) return true;

        uint256 score = blendedScore(loan.borrower);
        uint256 debt = uint256(loan.principalOutstanding) + uint256(loan.accruedInterest);
        if (block.timestamp > loan.lastAccrual) {
            uint256 elapsed = block.timestamp - loan.lastAccrual;
            debt += (uint256(loan.principalOutstanding) * loan.aprBps * elapsed) / (YEAR * BPS);
            if (block.timestamp > loan.dueDate) {
                uint256 lateStart = loan.lastAccrual > loan.dueDate ? loan.lastAccrual : loan.dueDate;
                if (block.timestamp > lateStart) {
                    uint256 lateDays = (block.timestamp - lateStart) / 1 days;
                    debt += (uint256(loan.principalOutstanding) * lateFeeBpsPerDay * lateDays) / BPS;
                }
            }
        }
        if (debt == 0) return false;

        uint256 healthBps = ((score * 30e6) / BPS + loan.reservedCredit) * BPS / debt;
        return healthBps < liquidationThresholdBps;
    }

    function _applyLossWaterfall(uint256 loss) internal {
        uint256 remaining = loss;

        remaining = _absorbTrancheLoss(TRANCHE_JUNIOR, remaining);
        if (remaining > 0) remaining = _absorbTrancheLoss(TRANCHE_MEZZ, remaining);
        if (remaining > 0) remaining = _absorbTrancheLoss(TRANCHE_SENIOR, remaining);
    }

    function _absorbTrancheLoss(uint8 tranche, uint256 loss) internal returns (uint256 remaining) {
        TrancheState storage t = trancheState[tranche];
        uint256 absorbFromYield = t.pendingYield > loss ? loss : t.pendingYield;
        if (absorbFromYield > 0) {
            t.pendingYield -= absorbFromYield;
            loss -= absorbFromYield;
        }

        if (loss == 0) return 0;

        uint256 absorbFromAssets = t.assets > loss ? loss : t.assets;
        if (absorbFromAssets > 0) {
            t.assets -= absorbFromAssets;
            loss -= absorbFromAssets;
        }

        return loss;
    }

    function _selectTranche(uint256 score, bool delegated, bool taskBacked) internal pure returns (uint8) {
        if (delegated || taskBacked) return TRANCHE_MEZZ;
        if (score >= 7_500) return TRANCHE_SENIOR;
        if (score >= 4_500) return TRANCHE_MEZZ;
        return TRANCHE_JUNIOR;
    }

    function _readAiScoreBpsSafe() internal view returns (uint256) {
        try aiPerformanceFeed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            if (answer <= 0) return 5_000;
            if (updatedAt == 0) return 5_000;
            if (answeredInRound < roundId) return 5_000;
            if (block.timestamp > updatedAt + oracleHeartbeat) return 5_000;

            uint8 decimals = aiPerformanceFeed.decimals();
            uint256 normalized = uint256(answer);
            if (decimals > 4) normalized /= 10 ** (decimals - 4);
            else if (decimals < 4) normalized *= 10 ** (4 - decimals);

            if (normalized > BPS) normalized = BPS;
            return normalized;
        } catch {
            return 5_000;
        }
    }

    function _readUsdcPegBpsSafe() internal view returns (bool ok, uint256 pegBps) {
        try usdcUsdFeed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            if (answer <= 0) return (false, 0);
            if (updatedAt == 0) return (false, 0);
            if (answeredInRound < roundId) return (false, 0);
            if (block.timestamp > updatedAt + oracleHeartbeat) return (false, 0);

            uint8 decimals = usdcUsdFeed.decimals();
            uint256 scaled = uint256(answer);
            if (decimals > 8) scaled /= 10 ** (decimals - 8);
            else if (decimals < 8) scaled *= 10 ** (8 - decimals);

            pegBps = (scaled * BPS) / 1e8;
            return (true, pegBps);
        } catch {
            return (false, 0);
        }
    }

    function _requireBorrowerAllowed(address borrower) internal view {
        if (isolationMode && !isolationWhitelist[borrower]) revert IsolationRestricted();
    }

    function _validateTranche(uint8 tranche) internal pure {
        if (tranche > TRANCHE_JUNIOR) revert InvalidTranche();
    }

    function _checkLiquidBalance(uint256 amountOut) internal view {
        uint256 bal = usdc.balanceOf(address(this));
        uint256 trancheLiabilities = _totalTrancheLiabilities();
        uint256 liabilities =
            protocolFees + insurancePool + reinsurancePool + reservedIntentCredit + totalSponsorCollateral
                + trancheLiabilities + totalTaskEscrowLiability;
        uint256 available = bal > liabilities ? bal - liabilities : 0;
        if (amountOut > available) revert InsufficientLiquidity();
    }

    function _totalTrancheLiabilities() internal view returns (uint256) {
        TrancheState memory s = trancheState[TRANCHE_SENIOR];
        TrancheState memory m = trancheState[TRANCHE_MEZZ];
        TrancheState memory j = trancheState[TRANCHE_JUNIOR];
        return s.assets + s.pendingYield + m.assets + m.pendingYield + j.assets + j.pendingYield;
    }
    function emergencyRecoverToken(address token, address recipient, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        whenPaused
    {
        if (token == address(0) || recipient == address(0)) revert InvalidAddress();
        if (token == address(usdc)) revert DelegationUnavailable();
        IERC20(token).safeTransfer(recipient, amount);
        emit EmergencyTokenRecovered(token, recipient, amount);
    }

    function _repayTaskLinkedLoan(uint256 taskId, uint256 funds, address agent)
        internal
        returns (uint256 toPool, uint256 toAgent)
    {
        uint256 linkedLoanId = taskLoan[taskId];
        if (funds == 0) return (0, 0);

        if (linkedLoanId != 0) {
            Loan storage loan = loans[linkedLoanId];
            if (loan.active && loan.mode == 1 && loan.taskId == taskId) {
                _accrueInterest(loan);
                uint256 debt = _currentDebt(loan);
                uint256 repayAmt = funds > debt ? debt : funds;
                if (repayAmt > 0) {
                    _applyRepaymentAccounting(loan, repayAmt);
                    funds -= repayAmt;
                    toPool = repayAmt;
                }
                if (_currentDebt(loan) == 0) {
                    _closeLoan(linkedLoanId, loan, true);
                }
            }
        }

        if (funds > 0) {
            toAgent = funds;
            _checkLiquidBalance(toAgent);
            usdc.safeTransfer(agent, toAgent);
        }
    }

    function _validateVerifierSignature(address verifier, bytes32 digest, bytes calldata signature) internal view {
        if (!SignatureChecker.isValidSignatureNow(verifier, digest, signature)) revert UnauthorizedIntent();
    }

}
