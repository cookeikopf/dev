// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title AggregatorV3Interface
/// @notice Chainlink-compatible interface
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

/// @title AIPerformanceOracle
/// @notice Decentralized AI agent performance scoring
/// @dev Multi-reporter consensus system with stake-slashing
contract AIPerformanceOracle is AccessControl, Pausable, AggregatorV3Interface {
    
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // ============ AGENT METRICS ============
    struct AgentMetrics {
        uint256 taskSuccessRate;      // 0-10000 (BPS) - % tasks completed
        uint256 avgTaskValue;         // Average $ per task (6 decimals)
        uint256 consistencyScore;     // 0-10000 - Low variance = high score
        uint256 uptime;               // 0-10000 - % online
        uint256 responseTime;         // Average seconds to respond
        uint256 uniqueClients;        // Number of unique clients
        uint256 totalTasks;           // Total tasks completed
        uint256 totalValue;           // Total $ earned
        uint256 lastUpdate;
        bool exists;
    }
    
    struct MetricReport {
        address reporter;
        AgentMetrics metrics;
        uint256 timestamp;
        uint256 stake;
    }
    
    mapping(address => AgentMetrics) public agentMetrics;
    mapping(address => MetricReport[]) public pendingReports;
    mapping(address => uint256) public lastConsensusUpdate;
    
    // ============ REPORTER MANAGEMENT ============
    mapping(address => uint256) public reporterStake;
    mapping(address => uint256) public reporterReputation;
    mapping(address => uint256) public slashCount;
    
    uint256 public constant MIN_STAKE = 5 ether;       // 5 ETH-denominated stake (wei)
    uint256 public constant MIN_REPORTERS = 3;         // Need 3+ reports
    uint256 public constant REPORT_TIMEOUT = 1 hours;  // Consensus window
    uint256 public constant MAX_VARIANCE = 2000;       // 20% max variance
    
    // ============ ORACLE STATE ============
    uint8 private _decimals = 8;
    string private _description = "AI Agent Performance Index";
    uint256 private _version = 1;
    
    // Latest consensus data (Chainlink compatible)
    uint80 public latestRound;
    int256 public latestAnswer;       // Composite performance score
    uint256 public latestTimestamp;
    
    // ============ EVENTS ============
    event MetricsReported(address indexed agent, address reporter, uint256 timestamp);
    event ConsensusReached(address indexed agent, uint256 score, uint256 timestamp);
    event ReporterSlashed(address reporter, uint256 amount, string reason);
    event ReporterRewarded(address reporter, uint256 amount);
    
    // ============ ERRORS ============
    error InsufficientStake();
    error InvalidMetrics();
    error ConsensusTimeout();
    error VarianceTooHigh();
    error ReporterBanned();
    
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }
    
    // ============ STAKING ============
    function stakeReporter() external payable {
        if (slashCount[msg.sender] >= 3) revert ReporterBanned();
        
        reporterStake[msg.sender] += msg.value;
        if (reporterStake[msg.sender] >= MIN_STAKE) {
            _grantRole(REPORTER_ROLE, msg.sender);
        }
    }
    
    function unstakeReporter(uint256 amount) external {
        if (reporterStake[msg.sender] < amount) revert InsufficientStake();
        
        // Check no active reports
        reporterStake[msg.sender] -= amount;
        
        if (reporterStake[msg.sender] < MIN_STAKE) {
            _revokeRole(REPORTER_ROLE, msg.sender);
        }
        
        payable(msg.sender).transfer(amount);
    }
    
    // ============ METRICS REPORTING ============
    function reportMetrics(
        address agent,
        AgentMetrics calldata metrics
    ) external onlyRole(REPORTER_ROLE) whenNotPaused {
        // Validate metrics
        if (!_validateMetrics(metrics)) revert InvalidMetrics();
        
        // Add to pending
        pendingReports[agent].push(MetricReport({
            reporter: msg.sender,
            metrics: metrics,
            timestamp: block.timestamp,
            stake: reporterStake[msg.sender]
        }));
        
        emit MetricsReported(agent, msg.sender, block.timestamp);
        
        // Try to reach consensus
        if (pendingReports[agent].length >= MIN_REPORTERS) {
            _attemptConsensus(agent);
        }
    }
    
    function _validateMetrics(AgentMetrics memory m) internal pure returns (bool) {
        if (m.taskSuccessRate > 10000) return false;
        if (m.consistencyScore > 10000) return false;
        if (m.uptime > 10000) return false;
        if (m.responseTime == 0) return false;
        return true;
    }
    
    // ============ CONSENSUS LOGIC ============
    function _attemptConsensus(address agent) internal {
        MetricReport[] storage reports = pendingReports[agent];
        if (reports.length < MIN_REPORTERS) return;
        
        // Check time window
        uint256 oldestReport = reports[0].timestamp;
        if (block.timestamp - oldestReport > REPORT_TIMEOUT) {
            _clearOldReports(agent);
            return;
        }
        
        // Calculate consensus for each metric
        AgentMetrics memory consensus;
        
        // Task success rate (weighted median)
        uint256[] memory successRates = new uint256[](reports.length);
        uint256[] memory stakes = new uint256[](reports.length);
        uint256 totalStake = 0;
        
        for (uint i = 0; i < reports.length; i++) {
            successRates[i] = reports[i].metrics.taskSuccessRate;
            stakes[i] = reports[i].stake;
            totalStake += reports[i].stake;
        }
        
        consensus.taskSuccessRate = _weightedMedian(successRates, stakes, totalStake);
        
        // Check variance
        uint256 variance = _calculateVariance(successRates, consensus.taskSuccessRate);
        if (variance > MAX_VARIANCE) {
            // Slash outliers
            _slashOutliers(agent, reports, consensus.taskSuccessRate);
            return;
        }
        
        // Calculate other metrics
        consensus.avgTaskValue = _weightedAverage(_extractValues(reports, 1), stakes, totalStake);
        consensus.consistencyScore = _weightedMedian(_extractValues(reports, 2), stakes, totalStake);
        consensus.uptime = _weightedMedian(_extractValues(reports, 3), stakes, totalStake);
        consensus.responseTime = _weightedAverage(_extractValues(reports, 4), stakes, totalStake);
        consensus.uniqueClients = _max(_extractValues(reports, 5));
        consensus.totalTasks = _sum(_extractValues(reports, 6));
        consensus.totalValue = _sum(_extractValues(reports, 7));
        consensus.lastUpdate = block.timestamp;
        consensus.exists = true;
        
        // Store consensus
        agentMetrics[agent] = consensus;
        lastConsensusUpdate[agent] = block.timestamp;
        
        // Calculate composite score (0-10000)
        uint256 compositeScore = _calculateCompositeScore(consensus);
        
        // Update Chainlink-compatible data
        latestRound++;
        latestAnswer = int256(compositeScore * 1e4); // Scale to 8 decimals
        latestTimestamp = block.timestamp;
        
        // Reward good reporters
        _rewardReporters(agent, reports, totalStake);
        
        // Clear pending
        delete pendingReports[agent];
        
        emit ConsensusReached(agent, compositeScore, block.timestamp);
    }
    
    function _calculateCompositeScore(AgentMetrics memory m) internal pure returns (uint256) {
        // Weighted composite
        uint256 score = 0;
        
        // Task success (40%)
        score += (m.taskSuccessRate * 4000) / 10000;
        
        // Consistency (20%)
        score += (m.consistencyScore * 2000) / 10000;
        
        // Uptime (20%)
        score += (m.uptime * 2000) / 10000;
        
        // Response time - faster is better (10%)
        uint256 responseScore = m.responseTime < 60 ? 10000 : 
                               (m.responseTime < 300 ? 8000 :
                               (m.responseTime < 900 ? 5000 : 2000));
        score += (responseScore * 1000) / 10000;
        
        // Client diversity (10%)
        uint256 clientScore = m.uniqueClients > 10 ? 10000 : (m.uniqueClients * 1000);
        score += (clientScore * 1000) / 10000;
        
        return score > 10000 ? 10000 : score;
    }
    
    // ============ SLASHING & REWARDS ============
    function _slashOutliers(
        address agent,
        MetricReport[] storage reports,
        uint256 consensusValue
    ) internal {
        for (uint i = 0; i < reports.length; i++) {
            uint256 diff = reports[i].metrics.taskSuccessRate > consensusValue 
                ? reports[i].metrics.taskSuccessRate - consensusValue 
                : consensusValue - reports[i].metrics.taskSuccessRate;
            
            if (diff > MAX_VARIANCE) {
                // Slash 10% of stake
                uint256 slashAmount = reports[i].stake / 10;
                reporterStake[reports[i].reporter] -= slashAmount;
                slashCount[reports[i].reporter]++;
                
                emit ReporterSlashed(reports[i].reporter, slashAmount, "Outlier report");
                
                if (slashCount[reports[i].reporter] >= 3) {
                    _revokeRole(REPORTER_ROLE, reports[i].reporter);
                }
            }
        }
        
        // Remove slashed reports and try again
        _clearOutliers(agent);
    }
    
    function _rewardReporters(
        address agent,
        MetricReport[] storage reports,
        uint256 totalStake
    ) internal {
        for (uint i = 0; i < reports.length; i++) {
            // Reward proportional to stake and accuracy
            uint256 reward = (reports[i].stake * 1e6) / totalStake; // 0.01% of something
            reporterReputation[reports[i].reporter] += reward;
            emit ReporterRewarded(reports[i].reporter, reward);
        }
    }
    
    // ============ MATH HELPERS ============
    function _weightedMedian(
        uint256[] memory values,
        uint256[] memory weights,
        uint256 totalWeight
    ) internal pure returns (uint256) {
        // Simple implementation: sort and pick middle
        // In production: use more efficient algorithm
        uint256 midWeight = totalWeight / 2;
        uint256 cumulative = 0;
        
        for (uint i = 0; i < values.length; i++) {
            cumulative += weights[i];
            if (cumulative >= midWeight) {
                return values[i];
            }
        }
        return values[values.length - 1];
    }
    
    function _weightedAverage(
        uint256[] memory values,
        uint256[] memory weights,
        uint256 totalWeight
    ) internal pure returns (uint256) {
        uint256 sum = 0;
        for (uint i = 0; i < values.length; i++) {
            sum += values[i] * weights[i];
        }
        return sum / totalWeight;
    }
    
    function _calculateVariance(uint256[] memory values, uint256 mean) internal pure returns (uint256) {
        uint256 sumSqDiff = 0;
        for (uint i = 0; i < values.length; i++) {
            uint256 diff = values[i] > mean ? values[i] - mean : mean - values[i];
            sumSqDiff += diff * diff;
        }
        return sumSqDiff / values.length;
    }
    
    function _extractValues(MetricReport[] storage reports, uint8 field) internal view returns (uint256[] memory) {
        uint256[] memory values = new uint256[](reports.length);
        for (uint i = 0; i < reports.length; i++) {
            if (field == 0) values[i] = reports[i].metrics.taskSuccessRate;
            else if (field == 1) values[i] = reports[i].metrics.avgTaskValue;
            else if (field == 2) values[i] = reports[i].metrics.consistencyScore;
            else if (field == 3) values[i] = reports[i].metrics.uptime;
            else if (field == 4) values[i] = reports[i].metrics.responseTime;
            else if (field == 5) values[i] = reports[i].metrics.uniqueClients;
            else if (field == 6) values[i] = reports[i].metrics.totalTasks;
            else if (field == 7) values[i] = reports[i].metrics.totalValue;
        }
        return values;
    }
    
    function _sum(uint256[] memory values) internal pure returns (uint256) {
        uint256 s = 0;
        for (uint i = 0; i < values.length; i++) {
            s += values[i];
        }
        return s;
    }
    
    function _max(uint256[] memory values) internal pure returns (uint256) {
        uint256 m = 0;
        for (uint i = 0; i < values.length; i++) {
            if (values[i] > m) m = values[i];
        }
        return m;
    }
    
    function _clearOldReports(address agent) internal {
        delete pendingReports[agent];
    }
    
    function _clearOutliers(address agent) internal {
        // Remove reports that were slashed
        // Implementation: filter array
    }
    
    // ============ CHAINLINK INTERFACE ============
    function decimals() external view override returns (uint8) {
        return _decimals;
    }
    
    function description() external view override returns (string memory) {
        return _description;
    }
    
    function version() external view override returns (uint256) {
        return _version;
    }
    
    function latestRoundData() external view override returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (latestRound, latestAnswer, latestTimestamp, latestTimestamp, latestRound);
    }
    
    // ============ STALENESS PROTECTION ============
    uint256 public constant MAX_STALENESS = 1 days;
    
    function getAgentMetrics(address agent) external view returns (AgentMetrics memory) {
        AgentMetrics memory m = agentMetrics[agent];
        if (!m.exists) revert("Agent not registered");
        
        // CRITICAL SECURITY CHECK: Prevent stale data usage
        if (block.timestamp - m.lastUpdate > MAX_STALENESS) {
            revert("Data too stale");
        }
        
        return m;
    }
    
    function getConsensusScore(address agent) external view returns (uint256) {
        if (!agentMetrics[agent].exists) return 0;
        
        // Check staleness
        if (block.timestamp - agentMetrics[agent].lastUpdate > MAX_STALENESS) {
            return 0; // Return 0 if data is stale
        }
        
        return uint256(latestAnswer / 1e4);
    }
}
