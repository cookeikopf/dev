// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ClawCreditMVP is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    uint256 public constant MIN_LOAN = 10e6;
    uint256 public constant MAX_LOAN = 500e6;
    uint256 public constant BASE_APR = 1500;
    uint256 public constant MIN_APR = 1000;
    uint256 public constant ORIGINATION_FEE = 300;
    uint256 public constant LATE_FEE = 200;
    uint256 public constant INSURANCE_PERCENT = 500;
    uint256 public constant MAX_DAILY_LOANS = 20;
    uint256 public constant MAX_DEFAULT_RATE = 1000;

    struct Loan {
        uint256 principal;
        uint256 startTime;
        uint256 dueDate;
        uint256 apr;
        address agent;
        bool isActive;
        bool isRepaid;
        bool isDefaulted;
    }

    struct AgentProfile {
        uint256 reputation;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 loansCount;
        uint256 defaults;
        uint256 consecutiveRepayments;
    }

    struct LenderPosition {
        uint256 deposited;
        uint256 withdrawn;
        uint256 earningsClaimed;
        uint256 depositTime;
    }

    mapping(uint256 => Loan) public loans;
    mapping(address => AgentProfile) public agents;
    mapping(address => LenderPosition) public lenders;
    mapping(address => uint256[]) public agentLoanIds;

    uint256 public loanCounter;
    uint256 public totalDeposits;
    uint256 public totalLoansActive;
    uint256 public totalLoansRepaid;
    uint256 public totalDefaults;
    uint256 public insurancePool;
    uint256 public protocolFees;
    uint256 public totalLenderEarnings;
    uint256 public dailyLoanCount;
    uint256 public lastLoanDay;
    bool public circuitBroken;

    event LoanIssued(uint256 indexed loanId, address indexed agent, uint256 principal, uint256 apr);
    event LoanRepaid(uint256 indexed loanId, address indexed agent, uint256 totalPaid);
    event LoanDefaulted(uint256 indexed loanId, address indexed agent, uint256 loss);
    event Deposited(address indexed lender, uint256 amount);
    event Withdrawn(address indexed lender, uint256 amount, uint256 earnings);
    event CircuitBroken(string reason);

    modifier circuitCheck() {
        require(!circuitBroken, "Circuit active");
        require(!isHighDefaultRate(), "High defaults");
        _;
    }

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount >= 50e6, "Min $50");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        LenderPosition storage p = lenders[msg.sender];
        if (p.deposited == 0) p.depositTime = block.timestamp;
        p.deposited += amount;
        totalDeposits += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        LenderPosition storage p = lenders[msg.sender];
        uint256 earnings = calculateEarnings(msg.sender);
        if (amount == 0) amount = p.deposited;
        require(amount <= p.deposited, "Insufficient");
        require(totalDeposits - totalLoansActive >= amount, "Locked");
        p.deposited -= amount;
        p.withdrawn += amount;
        p.earningsClaimed += earnings;
        totalDeposits -= amount;
        usdc.safeTransfer(msg.sender, amount + earnings);
        emit Withdrawn(msg.sender, amount, earnings);
    }

    function calculateEarnings(address lender) public view returns (uint256) {
        LenderPosition storage p = lenders[lender];
        if (p.deposited == 0 || totalDeposits == 0) return 0;
        uint256 share = (p.deposited * 1e18) / totalDeposits;
        uint256 earnings = totalLenderEarnings - p.earningsClaimed;
        return (earnings * share) / 1e18;
    }

    function requestLoan(uint256 amount) external nonReentrant whenNotPaused circuitCheck returns (uint256) {
        require(amount >= MIN_LOAN && amount <= MAX_LOAN, "Invalid amount");
        require(totalDeposits - totalLoansActive >= amount, "No liquidity");
        AgentProfile storage agent = agents[msg.sender];
        require(agent.loansCount < 3 || agent.consecutiveRepayments >= 2, "Max loans");
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastLoanDay) {
            dailyLoanCount = 0;
            lastLoanDay = currentDay;
        }
        require(dailyLoanCount < MAX_DAILY_LOANS, "Daily limit");
        dailyLoanCount++;
        uint256 apr = calculateAPR(msg.sender);
        uint256 fee = (amount * ORIGINATION_FEE) / 10000;
        loanCounter++;
        loans[loanCounter] = Loan({
            principal: amount,
            startTime: block.timestamp,
            dueDate: block.timestamp + 30 days,
            apr: apr,
            agent: msg.sender,
            isActive: true,
            isRepaid: false,
            isDefaulted: false
        });
        agentLoanIds[msg.sender].push(loanCounter);
        agent.loansCount++;
        totalLoansActive += amount;
        protocolFees += fee;
        usdc.safeTransfer(msg.sender, amount - fee);
        emit LoanIssued(loanCounter, msg.sender, amount, apr);
        return loanCounter;
    }

    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.isActive && loan.agent == msg.sender, "Invalid");
        uint256 debt = calculateDebt(loanId);
        uint256 interest = debt - loan.principal;
        usdc.safeTransferFrom(msg.sender, address(this), debt);
        loan.isActive = false;
        loan.isRepaid = true;
        totalLoansActive -= loan.principal;
        totalLoansRepaid++;
        AgentProfile storage agent = agents[msg.sender];
        agent.totalRepaid += debt;
        agent.consecutiveRepayments++;
        agent.defaults = 0;
        agent.reputation = _min(100, agent.reputation + 10);
        uint256 insurance = (interest * INSURANCE_PERCENT) / 10000;
        uint256 protocolInterest = (interest * 2000) / 10000;
        uint256 lenderInterest = interest - insurance - protocolInterest;
        insurancePool += insurance;
        protocolFees += protocolInterest;
        totalLenderEarnings += lenderInterest;
        emit LoanRepaid(loanId, msg.sender, debt);
    }

    function markDefault(uint256 loanId) external onlyOwner {
        Loan storage loan = loans[loanId];
        require(loan.isActive, "Not active");
        require(block.timestamp > loan.dueDate + 7 days, "Grace period");
        loan.isActive = false;
        loan.isDefaulted = true;
        totalLoansActive -= loan.principal;
        totalDefaults++;
        AgentProfile storage agent = agents[loan.agent];
        agent.consecutiveRepayments = 0;
        agent.defaults++;
        agent.reputation = agent.reputation > 20 ? agent.reputation - 20 : 0;
        uint256 loss = calculateDebt(loanId);
        uint256 insuranceCover = loss < insurancePool ? loss : insurancePool;
        if (insuranceCover > 0) insurancePool -= insuranceCover;
        emit LoanDefaulted(loanId, loan.agent, loss - insuranceCover);
    }

    function calculateDebt(uint256 loanId) public view returns (uint256) {
        Loan storage loan = loans[loanId];
        if (!loan.isActive) return 0;
        uint256 timeElapsed = block.timestamp - loan.startTime;
        uint256 interest = (loan.principal * loan.apr * timeElapsed) / (365 days * 10000);
        uint256 lateFee = 0;
        if (block.timestamp > loan.dueDate) {
            uint256 daysLate = (block.timestamp - loan.dueDate) / 1 days;
            lateFee = (loan.principal * LATE_FEE * daysLate) / 10000;
        }
        return loan.principal + interest + lateFee;
    }

    function calculateAPR(address agent) public view returns (uint256) {
        AgentProfile storage profile = agents[agent];
        if (profile.reputation >= 80) return MIN_APR;
        if (profile.reputation >= 60) return 1200;
        if (profile.reputation >= 40) return 1350;
        return BASE_APR;
    }

    function isHighDefaultRate() public view returns (bool) {
        uint256 total = totalLoansRepaid + totalDefaults;
        if (total == 0) return false;
        return (totalDefaults * 10000 / total) > MAX_DEFAULT_RATE;
    }

    function setReputation(address agent, uint256 score) external onlyOwner {
        agents[agent].reputation = score;
    }

    function breakCircuit(string calldata reason) external onlyOwner {
        circuitBroken = true;
        _pause();
        emit CircuitBroken(reason);
    }

    function resetCircuit() external onlyOwner {
        circuitBroken = false;
        _unpause();
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
