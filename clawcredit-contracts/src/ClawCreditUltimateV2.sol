// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IClawFlashBorrower} from "./interfaces/IClawFlashBorrower.sol";
import {IERC8004Reputation} from "./interfaces/IERC8004Reputation.sol";
import {IX402AutoRepayHook} from "./interfaces/IX402AutoRepayHook.sol";

/// @title ClawCreditUltimateV2
/// @notice Reputation-first micro-lending protocol for AI agents on Base.
/// @dev Admin should be a TimelockController. Roles are split for least privilege.
contract ClawCreditUltimateV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");
    bytes32 public constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant X402_ROLE = keccak256("X402_ROLE");

    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;
    uint256 public constant FLASH_CALLBACK_SUCCESS =
        uint256(keccak256("ClawCreditFlashBorrower.onFlashLoan"));

    IERC20 public immutable usdc;
    IERC8004Reputation public reputationRegistry;
    IX402AutoRepayHook public x402Hook;
    AggregatorV3Interface public usdcUsdFeed;
    AggregatorV3Interface public aiPerformanceFeed;

    uint256 public minLoan = 10e6;
    uint256 public maxAgentExposure = 500e6;
    uint256 public maxFlashLoan = 50_000e6;
    uint256 public maxLoanTenor = 30 days;
    uint256 public gracePeriod = 3 days;
    uint256 public creditLineStaleAfter = 1 days;
    uint256 public oracleHeartbeat = 2 hours;

    uint256 public originationFeeBps = 200;
    uint256 public flashFeeBps = 9;
    uint256 public insuranceFeeBps = 500;
    uint256 public protocolFeeBps = 1_000;
    uint256 public lateFeeBpsPerDay = 30;

    uint256 public liquidationThresholdBps = 8_500;
    uint256 public minAiScoreBps = 2_500;
    uint256 public minUsdcPegBps = 9_700;

    bool public isolationMode;
    mapping(address => bool) public isolationWhitelist;

    uint256 public totalShares;
    mapping(address => uint256) public lenderShares;

    uint256 public totalOutstandingPrincipal;
    uint256 public totalCollateralHeld;
    uint256 public insurancePool;
    uint256 public protocolFees;

    uint256 public nextLoanId = 1;

    struct CreditLine {
        uint96 limit;
        uint96 used;
        uint16 aprBps;
        uint40 lastUpdated;
        bool active;
    }

    struct Loan {
        address borrower;
        uint96 principal;
        uint96 principalOutstanding;
        uint96 interestOutstanding;
        uint96 collateral;
        uint40 startTime;
        uint40 dueDate;
        uint40 lastAccrual;
        uint16 aprBps;
        uint16 autoRepayBps;
        bool active;
        bool defaulted;
    }

    mapping(address => CreditLine) public creditLines;
    mapping(address => uint256) public agentExposure;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) private _agentLoanIds;

    event LiquidityDeposited(address indexed lender, uint256 assets, uint256 sharesMinted);
    event LiquidityWithdrawn(address indexed lender, uint256 assets, uint256 sharesBurned);
    event CreditLineUpdated(address indexed agent, uint256 limit, uint256 used, uint256 aprBps);
    event LoanOpened(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principal,
        uint256 collateral,
        uint256 aprBps,
        uint256 autoRepayBps,
        uint256 dueDate
    );
    event LoanRepayment(
        uint256 indexed loanId,
        address indexed payer,
        address indexed borrower,
        uint256 paidAmount,
        uint256 principalPaid,
        uint256 interestPaid,
        uint256 remainingDebt
    );
    event AutoRepaymentProcessed(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 grossEarnings,
        uint256 paymentAmount,
        uint256 deductionBps
    );
    event LoanClosed(uint256 indexed loanId, address indexed borrower, bool repaid);
    event LoanLiquidated(
        uint256 indexed loanId,
        address indexed liquidator,
        uint256 collateralSeized,
        uint256 insuranceUsed,
        uint256 badDebt
    );
    event FlashLoanExecuted(
        address indexed caller,
        address indexed receiver,
        uint256 amount,
        uint256 fee
    );
    event FeesAccrued(uint256 insuranceAmount, uint256 protocolAmount, uint256 lenderAmount);
    event IsolationModeSet(bool enabled);
    event IsolationWhitelistSet(address indexed agent, bool allowed);
    event HookUpdated(address indexed newHook);
    event OraclesUpdated(address indexed usdcUsdFeed, address indexed aiPerformanceFeed);
    event RiskConfigUpdated();
    event FeeConfigUpdated();
    event CapConfigUpdated();
    event ProtocolFeesWithdrawn(address indexed recipient, uint256 amount);
    event InsuranceToppedUp(address indexed payer, uint256 amount);

    error InvalidAddress();
    error InvalidAmount();
    error UnsupportedTenor();
    error LoanNotActive();
    error CreditLineUnavailable();
    error IsolationRestricted();
    error InsufficientLiquidity();
    error BorrowCapExceeded();
    error CollateralTooLow();
    error OracleStale();
    error FlashLoanNotRepaid();
    error InvalidFlashCallback();
    error AutoRepayTooHigh();

    constructor(
        address admin,
        address guardian,
        address treasury,
        address x402Operator,
        address usdcToken,
        address reputation,
        address usdcFeed,
        address aiFeed,
        address initialHook
    ) {
        if (
            admin == address(0) || guardian == address(0) || treasury == address(0)
                || x402Operator == address(0) || usdcToken == address(0) || reputation == address(0)
                || usdcFeed == address(0) || aiFeed == address(0)
        ) revert InvalidAddress();

        usdc = IERC20(usdcToken);
        reputationRegistry = IERC8004Reputation(reputation);
        usdcUsdFeed = AggregatorV3Interface(usdcFeed);
        aiPerformanceFeed = AggregatorV3Interface(aiFeed);
        x402Hook = IX402AutoRepayHook(initialHook);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, guardian);
        _grantRole(TREASURY_ROLE, treasury);
        _grantRole(X402_ROLE, x402Operator);
        _grantRole(RISK_MANAGER_ROLE, admin);
        _grantRole(ORACLE_MANAGER_ROLE, admin);
    }

    function deposit(uint256 assets)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 sharesMinted)
    {
        if (assets == 0) revert InvalidAmount();

        uint256 supply = totalShares;
        uint256 lenderAssetsBefore = _lenderAssets();
        if (supply > 0 && lenderAssetsBefore == 0) revert InsufficientLiquidity();

        sharesMinted = supply == 0 ? assets : (assets * supply) / lenderAssetsBefore;
        if (sharesMinted == 0) revert InvalidAmount();

        totalShares = supply + sharesMinted;
        lenderShares[msg.sender] += sharesMinted;

        usdc.safeTransferFrom(msg.sender, address(this), assets);
        emit LiquidityDeposited(msg.sender, assets, sharesMinted);
    }

    function withdraw(uint256 assets)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 sharesBurned)
    {
        if (assets == 0) revert InvalidAmount();
        if (assets > availableLiquidity()) revert InsufficientLiquidity();

        uint256 supply = totalShares;
        uint256 lenderAssetsNow = _lenderAssets();
        if (lenderAssetsNow == 0) revert InsufficientLiquidity();
        sharesBurned = _ceilDiv(assets * supply, lenderAssetsNow);
        if (sharesBurned == 0 || sharesBurned > lenderShares[msg.sender]) revert InvalidAmount();

        lenderShares[msg.sender] -= sharesBurned;
        totalShares = supply - sharesBurned;

        usdc.safeTransfer(msg.sender, assets);
        emit LiquidityWithdrawn(msg.sender, assets, sharesBurned);
    }

    function refreshCreditLine(address agent) public whenNotPaused {
        (uint256 repScore, bool exists) = _readReputation(agent);
        if (!exists) revert CreditLineUnavailable();

        uint256 aiScore = _readAiScoreBps();

        uint256 limit = 50e6 + ((repScore * 300e6) / BPS) + ((aiScore * 150e6) / BPS);
        if (limit > maxAgentExposure) limit = maxAgentExposure;

        uint256 apr = 1_800;
        apr -= (repScore * 500) / BPS;
        apr -= (aiScore * 400) / BPS;
        if (apr < 900) apr = 900;

        CreditLine storage line = creditLines[agent];
        line.limit = uint96(limit);
        line.used = uint96(agentExposure[agent]);
        line.aprBps = uint16(apr);
        line.lastUpdated = uint40(block.timestamp);
        line.active = true;

        emit CreditLineUpdated(agent, limit, line.used, apr);
    }

    function drawCreditLine(uint256 amount, uint256 collateral, uint32 tenorDays)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 loanId)
    {
        _requireBorrowerAllowed(msg.sender);
        if (amount < minLoan) revert InvalidAmount();
        if (tenorDays == 0 || uint256(tenorDays) * 1 days > maxLoanTenor) revert UnsupportedTenor();
        if (amount > availableLiquidity()) revert InsufficientLiquidity();

        CreditLine storage line = creditLines[msg.sender];
        if (!line.active || _isCreditLineStale(line.lastUpdated)) {
            refreshCreditLine(msg.sender);
        }
        if (!line.active) revert CreditLineUnavailable();

        uint256 newExposure = agentExposure[msg.sender] + amount;
        if (newExposure > maxAgentExposure) revert BorrowCapExceeded();
        if (line.used + amount > line.limit) revert CreditLineUnavailable();

        (uint256 repScore, bool exists) = _readReputation(msg.sender);
        if (!exists) revert CreditLineUnavailable();
        uint256 requiredCollateral = _requiredCollateral(amount, repScore);
        if (collateral < requiredCollateral) revert CollateralTooLow();

        uint256 originationFee = (amount * originationFeeBps) / BPS;
        uint256 netAmount = amount - originationFee;
        uint256 autoRepayBps = _deriveAutoRepayBps(repScore, _readAiScoreBps());

        loanId = nextLoanId++;

        loans[loanId] = Loan({
            borrower: msg.sender,
            principal: uint96(amount),
            principalOutstanding: uint96(amount),
            interestOutstanding: 0,
            collateral: uint96(collateral),
            startTime: uint40(block.timestamp),
            dueDate: uint40(block.timestamp + (uint256(tenorDays) * 1 days)),
            lastAccrual: uint40(block.timestamp),
            aprBps: line.aprBps,
            autoRepayBps: uint16(autoRepayBps),
            active: true,
            defaulted: false
        });

        if (collateral > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), collateral);
            totalCollateralHeld += collateral;
        }

        totalOutstandingPrincipal += amount;
        agentExposure[msg.sender] = newExposure;
        line.used = uint96(newExposure);
        _agentLoanIds[msg.sender].push(loanId);

        _allocateRevenue(originationFee);

        if (address(x402Hook) != address(0)) {
            x402Hook.registerPledge(msg.sender, loanId, autoRepayBps);
        }

        usdc.safeTransfer(msg.sender, netAmount);

        emit LoanOpened(
            loanId,
            msg.sender,
            amount,
            collateral,
            line.aprBps,
            autoRepayBps,
            block.timestamp + (uint256(tenorDays) * 1 days)
        );
    }

    function repay(uint256 loanId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();

        _accrueInterest(loan);
        uint256 debt = _currentDebt(loan);
        if (amount > debt) amount = debt;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        _applyRepayment(loanId, loan, msg.sender, amount, false, 0);
    }

    function processAutoRepayment(uint256 loanId, uint256 grossEarnings, uint256 paymentAmount)
        external
        nonReentrant
        whenNotPaused
        onlyRole(X402_ROLE)
    {
        if (paymentAmount == 0) revert InvalidAmount();
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();

        _accrueInterest(loan);

        uint256 cap = (grossEarnings * loan.autoRepayBps) / BPS;
        if (paymentAmount > cap) revert AutoRepayTooHigh();

        uint256 debt = _currentDebt(loan);
        if (paymentAmount > debt) paymentAmount = debt;

        usdc.safeTransferFrom(msg.sender, address(this), paymentAmount);
        _applyRepayment(loanId, loan, msg.sender, paymentAmount, true, grossEarnings);
    }

    function liquidate(uint256 loanId) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();
        if (!isLiquidatable(loanId)) revert LoanNotActive();

        _accrueInterest(loan);

        uint256 principalDebt = loan.principalOutstanding;
        uint256 interestDebt = loan.interestOutstanding;
        uint256 collateral = loan.collateral;

        if (collateral > 0) {
            totalCollateralHeld -= collateral;
            loan.collateral = 0;
        }

        uint256 interestRecovered = collateral > interestDebt ? interestDebt : collateral;
        uint256 remainingCollateral = collateral - interestRecovered;
        uint256 principalRecovered = remainingCollateral > principalDebt ? principalDebt : remainingCollateral;

        uint256 principalShortfall = principalDebt - principalRecovered;
        uint256 interestShortfall = interestDebt - interestRecovered;
        uint256 totalShortfall = principalShortfall + interestShortfall;

        uint256 insuranceUsed = totalShortfall > insurancePool ? insurancePool : totalShortfall;
        if (insuranceUsed > 0) {
            insurancePool -= insuranceUsed;
        }

        uint256 badDebt = totalShortfall - insuranceUsed;
        if (interestRecovered > 0) {
            _allocateRevenue(interestRecovered);
        }

        totalOutstandingPrincipal -= principalDebt;
        agentExposure[loan.borrower] -= principalDebt;
        creditLines[loan.borrower].used = uint96(agentExposure[loan.borrower]);

        loan.principalOutstanding = 0;
        loan.interestOutstanding = 0;
        loan.active = false;
        loan.defaulted = true;

        reputationRegistry.updateReputation(loan.borrower, false, loan.principal);
        if (address(x402Hook) != address(0)) {
            x402Hook.clearPledge(loan.borrower, loanId);
        }

        emit LoanLiquidated(loanId, msg.sender, collateral, insuranceUsed, badDebt);
        emit LoanClosed(loanId, loan.borrower, false);
    }

    function isLiquidatable(uint256 loanId) public view returns (bool) {
        Loan memory loan = loans[loanId];
        if (!loan.active) return false;

        if (block.timestamp > loan.dueDate + gracePeriod) {
            return true;
        }

        (bool usdcOk, uint256 usdcPegBps) = _tryReadUsdcPegBps();
        if (usdcOk && usdcPegBps < minUsdcPegBps) {
            return true;
        }

        (uint256 repScore, bool exists) = _readReputation(loan.borrower);
        if (!exists) return true;

        uint256 aiScore = _tryReadAiScoreBps();
        uint256 debt = getCurrentDebt(loanId);
        if (debt == 0) return false;

        uint256 virtualSupport = ((repScore + aiScore) * 25e6) / (2 * BPS);
        uint256 collateralValue = uint256(loan.collateral) + virtualSupport;
        uint256 healthBps = (collateralValue * BPS) / debt;

        if (healthBps < liquidationThresholdBps) {
            return true;
        }

        if (aiScore < minAiScoreBps && debt > loan.collateral) {
            return true;
        }

        return false;
    }

    function flashLoan(address receiver, uint256 amount, bytes calldata data)
        external
        nonReentrant
        whenNotPaused
        returns (bool)
    {
        if (receiver == address(0)) revert InvalidAddress();
        if (amount == 0 || amount > maxFlashLoan) revert InvalidAmount();
        if (amount > availableLiquidity()) revert InsufficientLiquidity();

        uint256 fee = (amount * flashFeeBps) / BPS;
        uint256 balanceBefore = usdc.balanceOf(address(this));

        usdc.safeTransfer(receiver, amount);

        bytes32 callbackResult = IClawFlashBorrower(receiver).onFlashLoan(
            msg.sender, address(usdc), amount, fee, data
        );
        if (uint256(callbackResult) != FLASH_CALLBACK_SUCCESS) revert InvalidFlashCallback();

        uint256 balanceAfter = usdc.balanceOf(address(this));
        if (balanceAfter < balanceBefore + fee) revert FlashLoanNotRepaid();

        _allocateRevenue(fee);
        emit FlashLoanExecuted(msg.sender, receiver, amount, fee);
        return true;
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setIsolationMode(bool enabled) external onlyRole(RISK_MANAGER_ROLE) {
        isolationMode = enabled;
        emit IsolationModeSet(enabled);
    }

    function setIsolationWhitelist(address agent, bool allowed) external onlyRole(RISK_MANAGER_ROLE) {
        isolationWhitelist[agent] = allowed;
        emit IsolationWhitelistSet(agent, allowed);
    }

    function setFeeConfig(
        uint256 newOriginationFeeBps,
        uint256 newFlashFeeBps,
        uint256 newInsuranceFeeBps,
        uint256 newProtocolFeeBps,
        uint256 newLateFeeBpsPerDay
    ) external onlyRole(RISK_MANAGER_ROLE) {
        if (newInsuranceFeeBps + newProtocolFeeBps >= BPS) revert InvalidAmount();
        if (newOriginationFeeBps > 1_000 || newFlashFeeBps > 100 || newLateFeeBpsPerDay > 300) {
            revert InvalidAmount();
        }
        originationFeeBps = newOriginationFeeBps;
        flashFeeBps = newFlashFeeBps;
        insuranceFeeBps = newInsuranceFeeBps;
        protocolFeeBps = newProtocolFeeBps;
        lateFeeBpsPerDay = newLateFeeBpsPerDay;
        emit FeeConfigUpdated();
    }

    function setRiskConfig(
        uint256 newLiquidationThresholdBps,
        uint256 newMinAiScoreBps,
        uint256 newMinUsdcPegBps,
        uint256 newGracePeriod,
        uint256 newOracleHeartbeat
    ) external onlyRole(RISK_MANAGER_ROLE) {
        if (
            newLiquidationThresholdBps < 7_000 || newLiquidationThresholdBps > 9_500
                || newMinAiScoreBps > BPS || newMinUsdcPegBps > BPS || newGracePeriod > 14 days
                || newOracleHeartbeat > 24 hours
        ) revert InvalidAmount();

        liquidationThresholdBps = newLiquidationThresholdBps;
        minAiScoreBps = newMinAiScoreBps;
        minUsdcPegBps = newMinUsdcPegBps;
        gracePeriod = newGracePeriod;
        oracleHeartbeat = newOracleHeartbeat;
        emit RiskConfigUpdated();
    }

    function setCapConfig(
        uint256 newMinLoan,
        uint256 newMaxAgentExposure,
        uint256 newMaxFlashLoan,
        uint256 newMaxLoanTenor,
        uint256 newCreditLineStaleAfter
    ) external onlyRole(RISK_MANAGER_ROLE) {
        if (
            newMinLoan == 0 || newMinLoan > newMaxAgentExposure || newMaxAgentExposure > 500e6
                || newMaxLoanTenor > 45 days || newCreditLineStaleAfter > 7 days
        ) revert InvalidAmount();

        minLoan = newMinLoan;
        maxAgentExposure = newMaxAgentExposure;
        maxFlashLoan = newMaxFlashLoan;
        maxLoanTenor = newMaxLoanTenor;
        creditLineStaleAfter = newCreditLineStaleAfter;
        emit CapConfigUpdated();
    }

    function setX402Hook(address newHook) external onlyRole(ORACLE_MANAGER_ROLE) {
        x402Hook = IX402AutoRepayHook(newHook);
        emit HookUpdated(newHook);
    }

    function setOracles(address newUsdcUsdFeed, address newAiFeed) external onlyRole(ORACLE_MANAGER_ROLE) {
        if (newUsdcUsdFeed == address(0) || newAiFeed == address(0)) revert InvalidAddress();
        usdcUsdFeed = AggregatorV3Interface(newUsdcUsdFeed);
        aiPerformanceFeed = AggregatorV3Interface(newAiFeed);
        emit OraclesUpdated(newUsdcUsdFeed, newAiFeed);
    }

    function withdrawProtocolFees(address recipient, uint256 amount)
        external
        nonReentrant
        onlyRole(TREASURY_ROLE)
    {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0 || amount > protocolFees) revert InvalidAmount();
        protocolFees -= amount;
        usdc.safeTransfer(recipient, amount);
        emit ProtocolFeesWithdrawn(recipient, amount);
    }

    function topUpInsurance(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        insurancePool += amount;
        emit InsuranceToppedUp(msg.sender, amount);
    }

    function getCurrentDebt(uint256 loanId) public view returns (uint256) {
        Loan memory loan = loans[loanId];
        if (!loan.active) return 0;
        (uint256 accruedInterest, uint40 _) = _previewAccrual(loan);
        return uint256(loan.principalOutstanding) + uint256(loan.interestOutstanding) + accruedInterest;
    }

    function getAgentLoanIds(address agent) external view returns (uint256[] memory) {
        return _agentLoanIds[agent];
    }

    function lenderAssets() external view returns (uint256) {
        return _lenderAssets();
    }

    function availableLiquidity() public view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 liabilities = insurancePool + protocolFees + totalCollateralHeld;
        return balance > liabilities ? balance - liabilities : 0;
    }

    function previewCreditLine(address agent)
        external
        view
        returns (uint256 limit, uint256 used, uint256 aprBps, bool active)
    {
        (uint256 repScore, bool exists) = _readReputation(agent);
        if (!exists) return (0, agentExposure[agent], 0, false);

        uint256 aiScore = _tryReadAiScoreBps();
        limit = 50e6 + ((repScore * 300e6) / BPS) + ((aiScore * 150e6) / BPS);
        if (limit > maxAgentExposure) limit = maxAgentExposure;

        aprBps = 1_800 - ((repScore * 500) / BPS) - ((aiScore * 400) / BPS);
        if (aprBps < 900) aprBps = 900;

        used = agentExposure[agent];
        active = true;
    }

    function _applyRepayment(
        uint256 loanId,
        Loan storage loan,
        address payer,
        uint256 amount,
        bool autoRepay,
        uint256 grossEarnings
    ) internal {
        uint256 interestPaid;
        uint256 principalPaid;

        uint256 interestOutstanding = loan.interestOutstanding;
        if (amount >= interestOutstanding) {
            interestPaid = interestOutstanding;
            amount -= interestOutstanding;
            loan.interestOutstanding = 0;
        } else {
            interestPaid = amount;
            loan.interestOutstanding = uint96(interestOutstanding - amount);
            amount = 0;
        }

        if (amount > 0) {
            uint256 principalOutstanding = loan.principalOutstanding;
            principalPaid = amount > principalOutstanding ? principalOutstanding : amount;
            loan.principalOutstanding = uint96(principalOutstanding - principalPaid);
            totalOutstandingPrincipal -= principalPaid;
            agentExposure[loan.borrower] -= principalPaid;
            creditLines[loan.borrower].used = uint96(agentExposure[loan.borrower]);
        }

        if (interestPaid > 0) {
            _allocateRevenue(interestPaid);
        }

        uint256 remainingDebt = uint256(loan.principalOutstanding) + uint256(loan.interestOutstanding);
        emit LoanRepayment(
            loanId,
            payer,
            loan.borrower,
            principalPaid + interestPaid,
            principalPaid,
            interestPaid,
            remainingDebt
        );

        if (autoRepay) {
            emit AutoRepaymentProcessed(
                loanId,
                loan.borrower,
                grossEarnings,
                principalPaid + interestPaid,
                loan.autoRepayBps
            );
        }

        if (remainingDebt == 0) {
            _closeLoanAsRepaid(loanId, loan);
        }
    }

    function _closeLoanAsRepaid(uint256 loanId, Loan storage loan) internal {
        loan.active = false;
        reputationRegistry.updateReputation(loan.borrower, true, loan.principal);

        uint256 collateral = loan.collateral;
        if (collateral > 0) {
            totalCollateralHeld -= collateral;
            loan.collateral = 0;
            usdc.safeTransfer(loan.borrower, collateral);
        }

        if (address(x402Hook) != address(0)) {
            x402Hook.clearPledge(loan.borrower, loanId);
        }

        emit LoanClosed(loanId, loan.borrower, true);
    }

    function _allocateRevenue(uint256 amount) internal {
        if (amount == 0) return;
        uint256 insuranceCut = (amount * insuranceFeeBps) / BPS;
        uint256 protocolCut = (amount * protocolFeeBps) / BPS;
        uint256 lenderCut = amount - insuranceCut - protocolCut;

        insurancePool += insuranceCut;
        protocolFees += protocolCut;

        emit FeesAccrued(insuranceCut, protocolCut, lenderCut);
    }

    function _accrueInterest(Loan storage loan) internal {
        if (!loan.active) return;
        (uint256 accrued, uint40 newLastAccrual) = _previewAccrual(loan);
        if (accrued > 0) {
            loan.interestOutstanding += uint96(accrued);
        }
        loan.lastAccrual = newLastAccrual;
    }

    function _previewAccrual(Loan memory loan) internal view returns (uint256 accrued, uint40 newLastAccrual) {
        uint40 lastAccrual = loan.lastAccrual;
        if (block.timestamp <= lastAccrual) return (0, lastAccrual);

        uint256 elapsed = block.timestamp - lastAccrual;
        uint256 interest = (uint256(loan.principalOutstanding) * uint256(loan.aprBps) * elapsed) / (YEAR * BPS);

        uint256 latePenalty;
        if (block.timestamp > loan.dueDate) {
            uint256 lateStart = lastAccrual > loan.dueDate ? lastAccrual : loan.dueDate;
            if (block.timestamp > lateStart) {
                uint256 lateDays = (block.timestamp - lateStart) / 1 days;
                latePenalty = (uint256(loan.principalOutstanding) * lateFeeBpsPerDay * lateDays) / BPS;
            }
        }

        accrued = interest + latePenalty;
        newLastAccrual = uint40(block.timestamp);
    }

    function _currentDebt(Loan storage loan) internal view returns (uint256) {
        return uint256(loan.principalOutstanding) + uint256(loan.interestOutstanding);
    }

    function _requiredCollateral(uint256 amount, uint256 repScore) internal pure returns (uint256) {
        if (repScore >= 8_000) return 0;
        if (repScore >= 6_000) return (amount * 1_000) / BPS;
        if (repScore >= 4_000) return (amount * 2_000) / BPS;
        return (amount * 4_000) / BPS;
    }

    function _deriveAutoRepayBps(uint256 repScore, uint256 aiScore) internal pure returns (uint256) {
        uint256 blended = (repScore + aiScore) / 2;
        return 2_000 - ((blended * 1_000) / BPS);
    }

    function _lenderAssets() internal view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 gross = balance + totalOutstandingPrincipal;
        uint256 liabilities = insurancePool + protocolFees + totalCollateralHeld;
        return gross > liabilities ? gross - liabilities : 0;
    }

    function _isCreditLineStale(uint256 lastUpdated) internal view returns (bool) {
        return lastUpdated == 0 || block.timestamp > lastUpdated + creditLineStaleAfter;
    }

    function _requireBorrowerAllowed(address borrower) internal view {
        if (isolationMode && !isolationWhitelist[borrower]) revert IsolationRestricted();
    }

    function _readReputation(address agent) internal view returns (uint256 score, bool exists) {
        IERC8004Reputation.ReputationData memory rep = reputationRegistry.getReputation(agent);
        score = rep.score > BPS ? BPS : rep.score;
        exists = rep.exists;
    }

    function _readAiScoreBps() internal view returns (uint256) {
        (bool ok, uint256 score) = _tryReadAiScore();
        if (!ok) revert OracleStale();
        return score;
    }

    function _tryReadAiScoreBps() internal view returns (uint256) {
        (, uint256 score) = _tryReadAiScore();
        return score;
    }

    function _tryReadAiScore() internal view returns (bool ok, uint256 scoreBps) {
        try aiPerformanceFeed.latestRoundData() returns (
            uint80,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (answer <= 0) return (false, 0);
            if (block.timestamp > updatedAt + oracleHeartbeat) return (false, 0);

            uint8 decimals = aiPerformanceFeed.decimals();
            uint256 normalized = uint256(answer);
            if (decimals > 4) normalized /= 10 ** (decimals - 4);
            else if (decimals < 4) normalized *= 10 ** (4 - decimals);

            if (normalized > BPS) normalized = BPS;
            return (true, normalized);
        } catch {
            return (false, 0);
        }
    }

    function _tryReadUsdcPegBps() internal view returns (bool ok, uint256 pegBps) {
        try usdcUsdFeed.latestRoundData() returns (
            uint80,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (answer <= 0) return (false, 0);
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

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : ((a - 1) / b) + 1;
    }
}
