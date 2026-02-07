// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictionMarket
 * @dev Binary prediction markets for paper replication outcomes
 * "Polymarket for Science" — stake RESEARCH tokens on YES/NO outcomes
 */
contract PredictionMarket is Ownable, ReentrancyGuard {

    IERC20 public researchToken;

    struct Market {
        uint256 id;
        uint256 paperId;
        address creator;
        string question;
        uint256 endTime;
        uint256 yesPool;
        uint256 noPool;
        bool resolved;
        bool outcome; // true = YES, false = NO
        uint256 totalParticipants;
    }

    struct Stake {
        uint256 amount;
        bool position; // true = YES, false = NO
        bool claimed;
    }

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Stake)) public stakes;

    event MarketCreated(uint256 indexed marketId, uint256 indexed paperId, string question, uint256 endTime);
    event StakePlaced(uint256 indexed marketId, address indexed user, bool position, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event PayoutClaimed(uint256 indexed marketId, address indexed user, uint256 amount);

    constructor(address _researchToken) Ownable(msg.sender) {
        researchToken = IERC20(_researchToken);
    }

    function createMarket(
        uint256 paperId,
        string memory question,
        uint256 duration
    ) external returns (uint256) {
        marketCount++;

        markets[marketCount] = Market({
            id: marketCount,
            paperId: paperId,
            creator: msg.sender,
            question: question,
            endTime: block.timestamp + duration,
            yesPool: 0,
            noPool: 0,
            resolved: false,
            outcome: false,
            totalParticipants: 0
        });

        emit MarketCreated(marketCount, paperId, question, block.timestamp + duration);
        return marketCount;
    }

    function stake(
        uint256 marketId,
        bool position,
        uint256 amount
    ) external nonReentrant {
        Market storage market = markets[marketId];
        require(market.id != 0, "Market does not exist");
        require(!market.resolved, "Market already resolved");
        require(block.timestamp < market.endTime, "Market ended");
        require(amount > 0, "Amount must be positive");
        require(stakes[marketId][msg.sender].amount == 0, "Already staked");

        require(
            researchToken.transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );

        stakes[marketId][msg.sender] = Stake({
            amount: amount,
            position: position,
            claimed: false
        });

        if (position) {
            market.yesPool += amount;
        } else {
            market.noPool += amount;
        }

        market.totalParticipants++;

        emit StakePlaced(marketId, msg.sender, position, amount);
    }

    function resolveMarket(uint256 marketId, bool outcome) external onlyOwner {
        Market storage market = markets[marketId];
        require(market.id != 0, "Market does not exist");
        require(!market.resolved, "Already resolved");

        market.resolved = true;
        market.outcome = outcome;

        emit MarketResolved(marketId, outcome);
    }

    function claimPayout(uint256 marketId) external nonReentrant {
        Market storage market = markets[marketId];
        require(market.resolved, "Market not resolved");

        Stake storage userStake = stakes[marketId][msg.sender];
        require(userStake.amount > 0, "No stake found");
        require(!userStake.claimed, "Already claimed");
        require(userStake.position == market.outcome, "Wrong position");

        userStake.claimed = true;

        uint256 totalPool = market.yesPool + market.noPool;
        uint256 winningPool = market.outcome ? market.yesPool : market.noPool;
        uint256 payout = (userStake.amount * totalPool) / winningPool;

        require(
            researchToken.transfer(msg.sender, payout),
            "Payout transfer failed"
        );

        emit PayoutClaimed(marketId, msg.sender, payout);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function getUserStake(uint256 marketId, address user) external view returns (Stake memory) {
        return stakes[marketId][user];
    }

    function calculatePayout(uint256 marketId, bool position, uint256 amount) external view returns (uint256) {
        Market memory market = markets[marketId];
        uint256 totalPool = market.yesPool + market.noPool + amount;
        uint256 winningPool = position ? (market.yesPool + amount) : (market.noPool + amount);
        return (amount * totalPool) / winningPool;
    }
}
