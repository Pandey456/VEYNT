// Layout of Contract:

// SPDX-License-Identifier: MIT
// version
pragma solidity ^0.8.20;

// imports
interface IFtsoV2 {
    function getFeedById(
        bytes21 _feedId
    ) external view returns (uint256 value, int8 decimals, uint64 timestamp);
}

contract VeilMarket {
    // errors
    // interfaces, libraries, contracts
    // Type declarations
    IFtsoV2 public ftsoV2;
    struct Market {
        address owner;
        string apiEndpoint;
        string question;
        uint256 deadline;
        uint256 totalPool;
        bool resolved;
        bool outcome;
        bytes32 merkleRoot;
    }

    // State variables
    uint256 constant TARGET_USD_FEE = 13 ether; // 13 * 10^18 wei;
    bytes21 public flrUsdFeedId;
    uint256 public marketCount;
    mapping(uint256 marketId => Market) public markets;
    uint256 public accumulatedTreasuryFees;

    // Events
    event MarketCreated(
        uint256 indexed marketId,
        address indexed owner,
        string question,
        string apiEndpoint,
        uint256 deadline
    );

    // Modifiers
    // Functions
    // Layout of Functions:
    // constructor
    constructor(address _ftsoV2Address, bytes21 _flrUsdFeedId) {
        ftsoV2 = IFtsoV2(_ftsoV2Address);
        flrUsdFeedId = _flrUsdFeedId;
    }

    // receive function (if exists)
    // fallback function (if exists)
    // external

    function createMarket(
        string memory _question,
        uint256 _deadline,
        string memory _apiEndpoint
    ) external payable {
        //checks
        require(
            _deadline > block.timestamp,
            "createMarket: Deadline should be in future"
        );
        (uint256 flrPrice, int8 decimals, ) = ftsoV2.getFeedById(flrUsdFeedId);
        require(flrPrice > 0, "createMarket: Invalid oracle price");
        uint256 multiplier = 10 ** uint256(int256(decimals));
        uint256 requiredFlrFee = (TARGET_USD_FEE * multiplier) / flrPrice;
        require(msg.value >= requiredFlrFee, "createMarket: Insufficient fee");
        //effect
        marketCount++;
        accumulatedTreasuryFees += requiredFlrFee;
        markets[marketCount] = Market({
            owner: msg.sender,
            question: _question,
            apiEndpoint: _apiEndpoint,
            deadline: _deadline,
            totalPool: 0,
            resolved: false,
            outcome: false,
            merkleRoot: 0
        });
        uint256 excess;

        emit MarketCreated(
            marketCount,
            msg.sender,
            _question,
            _apiEndpoint,
            _deadline
        );
        // interactions
        if (msg.value > requiredFlrFee) {
            excess = msg.value - requiredFlrFee;
            (bool success, ) = payable(msg.sender).call{value: excess}("");
            require(success, "createMarket: Refund failed");
        }
    }

    // public
    // internal
    // private
    // view & pure functions
}
