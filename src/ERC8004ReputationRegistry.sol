// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ERC8004ReputationRegistry
/// @notice Production implementation of ERC-8004 Agent Reputation Standard
contract ERC8004ReputationRegistry is AccessControl, Pausable {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    struct ReputationData {
        uint256 score; // 0-10000 (BPS)
        uint256 successfulRepayments;
        uint256 defaults;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 transactionCount;
        uint256 streakDays; // Consecutive days active
        bytes32 socialProof; // GitHub/Twitter hash
        address[] protocolsUsed; // Which protocols agent interacted with
        uint256 lastUpdate;
        bool exists;
    }

    struct SocialProof {
        string platform; // "github", "twitter", "discord"
        string username;
        uint256 followers; // Social proof strength
        uint256 verifiedAt;
        bool active;
    }

    mapping(address => ReputationData) public reputations;
    mapping(address => SocialProof[]) public socialProofs;
    mapping(address => bool) public authorizedContracts;

    // Score weights (must sum to 10000)
    uint256 public constant REPAYMENT_WEIGHT = 4000; // 40%
    uint256 public constant VOLUME_WEIGHT = 2000; // 20%
    uint256 public constant CONSISTENCY_WEIGHT = 2000; // 20%
    uint256 public constant SOCIAL_WEIGHT = 1000; // 10%
    uint256 public constant DIVERSITY_WEIGHT = 1000; // 10%

    uint256 public constant MAX_SCORE = 10000;
    uint256 public constant DEFAULT_SCORE = 5000; // Start at 50/100

    event ReputationUpdated(address indexed agent, uint256 newScore, string reason);
    event SocialProofAdded(address indexed agent, string platform, string username);
    event ProtocolInteraction(address indexed agent, address indexed protocol);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    /// @notice Initialize reputation for new agent
    function initializeReputation(address agent) external {
        require(!reputations[agent].exists, "Already exists");

        reputations[agent] = ReputationData({
            score: DEFAULT_SCORE,
            successfulRepayments: 0,
            defaults: 0,
            totalBorrowed: 0,
            totalRepaid: 0,
            transactionCount: 0,
            streakDays: 0,
            socialProof: 0,
            protocolsUsed: new address[](0),
            lastUpdate: block.timestamp,
            exists: true
        });

        emit ReputationUpdated(agent, DEFAULT_SCORE, "Initialized");
    }

    /// @notice Update reputation based on loan outcome
    /// @param agent The agent address
    /// @param success Whether loan was repaid successfully
    /// @param amount The loan amount
    function updateReputation(address agent, bool success, uint256 amount) external {
        require(authorizedContracts[msg.sender] || hasRole(REPORTER_ROLE, msg.sender), "Unauthorized");
        require(reputations[agent].exists, "Agent not registered");

        ReputationData storage rep = reputations[agent];

        if (success) {
            rep.successfulRepayments++;
            rep.totalRepaid += amount;
            rep.streakDays++;
        } else {
            rep.defaults++;
            rep.streakDays = 0;
        }

        rep.totalBorrowed += amount;
        rep.transactionCount++;
        rep.lastUpdate = block.timestamp;

        // Recalculate score
        uint256 newScore = _calculateScore(agent);
        rep.score = newScore;

        emit ReputationUpdated(agent, newScore, success ? "Repaid" : "Defaulted");
    }

    /// @notice Record protocol interaction (diversity score)
    function recordProtocolInteraction(address agent, address protocol) external {
        require(authorizedContracts[msg.sender], "Unauthorized");
        require(reputations[agent].exists, "Agent not registered");

        ReputationData storage rep = reputations[agent];

        // Check if already recorded
        bool exists = false;
        for (uint256 i = 0; i < rep.protocolsUsed.length; i++) {
            if (rep.protocolsUsed[i] == protocol) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            rep.protocolsUsed.push(protocol);
            emit ProtocolInteraction(agent, protocol);

            // Recalculate with new diversity
            uint256 newScore = _calculateScore(agent);
            rep.score = newScore;
            emit ReputationUpdated(agent, newScore, "Protocol diversity");
        }
    }

    /// @notice Add social proof verification
    function addSocialProof(address agent, string calldata platform, string calldata username, uint256 followers)
        external
        onlyRole(VERIFIER_ROLE)
    {
        require(reputations[agent].exists, "Agent not registered");

        socialProofs[agent].push(
            SocialProof({
                platform: platform, username: username, followers: followers, verifiedAt: block.timestamp, active: true
            })
        );

        // Update main reputation
        ReputationData storage rep = reputations[agent];
        rep.socialProof = keccak256(abi.encodePacked(platform, username));

        // Recalculate with social boost
        uint256 newScore = _calculateScore(agent);
        rep.score = newScore;

        emit SocialProofAdded(agent, platform, username);
        emit ReputationUpdated(agent, newScore, "Social proof added");
    }

    /// @notice Calculate comprehensive reputation score
    function _calculateScore(address agent) internal view returns (uint256) {
        ReputationData storage rep = reputations[agent];
        if (!rep.exists) return 0;

        // Repayment score (0-10000)
        uint256 totalLoans = rep.successfulRepayments + rep.defaults;
        uint256 repaymentScore = totalLoans > 0 ? (rep.successfulRepayments * 10000) / totalLoans : 5000;

        // Volume score (logarithmic scale)
        uint256 volumeScore = _logScale(rep.totalRepaid, 100000e6); // Max at $100K volume

        // Consistency score (streak-based)
        uint256 consistencyScore = _min(rep.streakDays * 100, 10000); // 100 days = max

        // Social score
        uint256 socialScore = _calculateSocialScore(agent);

        // Diversity score (protocol count)
        uint256 diversityScore = _min(rep.protocolsUsed.length * 1000, 10000); // 10 protocols = max

        // Weighted average
        uint256 weightedScore =
            (repaymentScore
                    * REPAYMENT_WEIGHT
                    + volumeScore
                    * VOLUME_WEIGHT
                    + consistencyScore
                    * CONSISTENCY_WEIGHT
                    + socialScore
                    * SOCIAL_WEIGHT
                    + diversityScore
                    * DIVERSITY_WEIGHT) / 10000;

        return _min(weightedScore, MAX_SCORE);
    }

    function _calculateSocialScore(address agent) internal view returns (uint256) {
        SocialProof[] storage proofs = socialProofs[agent];
        if (proofs.length == 0) return 5000;

        uint256 totalFollowers = 0;
        uint256 verifiedAccounts = 0;

        for (uint256 i = 0; i < proofs.length; i++) {
            if (proofs[i].active) {
                totalFollowers += proofs[i].followers;
                verifiedAccounts++;
            }
        }

        // Score based on follower count (log scale) + account diversity
        uint256 followerScore = _logScale(totalFollowers, 10000); // Max at 10K followers
        uint256 diversityBonus = verifiedAccounts > 1 ? 1000 : 0;

        return _min(followerScore + diversityBonus, 10000);
    }

    function _logScale(uint256 value, uint256 maxValue) internal pure returns (uint256) {
        if (value >= maxValue) return 10000;
        if (value == 0) return 0;

        // Approximate log: score = 10000 * sqrt(value/maxValue)
        uint256 ratio = (value * 1e18) / maxValue;
        uint256 sqrt = _sqrt(ratio);
        return (sqrt * 10000) / 1e9; // sqrt(1e18) = 1e9
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // ============ VIEW FUNCTIONS ============

    function getReputation(address agent) external view returns (ReputationData memory) {
        return reputations[agent];
    }

    function getSocialProofs(address agent) external view returns (SocialProof[] memory) {
        return socialProofs[agent];
    }

    function getScore(address agent) external view returns (uint256) {
        return reputations[agent].score;
    }

    // ============ ADMIN ============

    function authorizeContract(address contractAddr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        authorizedContracts[contractAddr] = true;
    }

    function revokeContract(address contractAddr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        authorizedContracts[contractAddr] = false;
    }
}
