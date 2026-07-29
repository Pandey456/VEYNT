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
    error NotOwner();
    error ZeroAddress();
    error DeadlineInPast();
    error DurationTooShort(uint256 earliestAllowedDeadline);
    error EmptyQuestion();
    error EmptyEndpoint();
    error InvalidOraclePrice();
    error NegativeDecimals();
    error StalePrice(uint256 age);
    error InsufficientFee(uint256 required, uint256 sent);
    error RefundFailed();
    error MarketNotFound();
    error MarketClosed();
    error ZeroStake();
    error AlreadyResolved();
    error GracePeriodNotPassed(uint256 refundableAfter);
    error NothingToWithdraw();
    error TransferFailed();
    error Reentrancy();
    error NotImplemented();
    // interfaces, libraries, contracts
    // Type declarations
    IFtsoV2 public immutable i_ftsoV2;
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
    //CONSTANTS
    /// @notice Target creation fee, expressed in USD with 18 decimals ($13).
    uint256 public constant TARGET_USD_FEE = 13 ether;
    /// @notice Minimum time a market must stay open.
    uint256 public constant MIN_MARKET_DURATION = 5 minutes;
    /// @notice Reject the oracle price if older than this.
    uint256 public constant MAX_PRICE_AGE = 1 hours;
    /// @notice After deadline + this window with no resolution, bettors may refund.
    uint256 public constant RESOLUTION_GRACE = 3 days;

    bytes21 public immutable i_flrUsdFeedId;
    address public owner;
    uint256 public marketCount;
    uint256 private _locked = 1;
    mapping(uint256 marketId => Market) public markets;
    uint256 public accumulatedTreasuryFees;
    mapping(uint256 marketId => mapping(address bettor => uint256 stake))
        public stakeOf;

    // Events
    event MarketCreated(
        uint256 indexed marketId,
        address indexed owner,
        string question,
        string apiEndpoint,
        uint256 deadline
    );
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    event BetPlaced(
        uint256 indexed marketId,
        address indexed bettor,
        uint256 amount,
        bytes encryptedChoice
    );
    event EmergencyRefunded(
        uint256 indexed marketId,
        address indexed bettor,
        uint256 amount
    );
    // Modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    // Functions
    // Layout of Functions:
    // constructor
    constructor(address _ftsoV2Address, bytes21 _flrUsdFeedId) {
        if (_ftsoV2Address == address(0)) revert ZeroAddress();
        i_ftsoV2 = IFtsoV2(_ftsoV2Address);
        i_flrUsdFeedId = _flrUsdFeedId;
        emit OwnershipTransferred(address(0), owner);
        owner = msg.sender;
    }

    // receive function (if exists)
    // fallback function (if exists)
    // external

    function createMarket(
        string calldata _question,
        uint256 _deadline,
        string calldata _apiEndpoint
    ) external payable nonReentrant returns (uint256 marketId) {
        //checks
        if (_deadline <= block.timestamp) revert DeadlineInPast();
        uint256 earliest = block.timestamp + MIN_MARKET_DURATION;
        if (_deadline < earliest) revert DurationTooShort(earliest);
        if (bytes(_question).length == 0) revert EmptyQuestion();
        if (bytes(_apiEndpoint).length == 0) revert EmptyEndpoint();

        uint256 requiredFlrFee = getRequiredFee();
        if (msg.value < requiredFlrFee)
            revert InsufficientFee(requiredFlrFee, msg.value);
        //effect
        marketId = ++marketCount;
        accumulatedTreasuryFees += requiredFlrFee;
        Market storage m = markets[marketId];
        m.owner = msg.sender;
        m.question = _question;
        m.apiEndpoint = _apiEndpoint;
        m.deadline = _deadline;
        emit MarketCreated(
            marketId,
            msg.sender,
            _question,
            _apiEndpoint,
            _deadline
        );
        // interactions
        uint256 excess = msg.value - requiredFlrFee;
        if (excess > 0) {
            (bool ok, ) = payable(msg.sender).call{value: excess}("");
            if (!ok) revert RefundFailed();
        }
    }

    function predict(
        uint256 _marketId,
        bytes calldata _encryptedChoice
    ) external payable nonReentrant {
        Market storage m = markets[_marketId];
        if (m.owner == address(0)) revert MarketNotFound();
        if (block.timestamp >= m.deadline) revert MarketClosed();
        if (msg.value == 0) revert ZeroStake();

        stakeOf[_marketId][msg.sender] += msg.value;
        m.totalPool += msg.value;

        emit BetPlaced(_marketId, msg.sender, msg.value, _encryptedChoice);
    }

    function emergencyRefund(uint256 _marketId) external nonReentrant {
        Market storage m = markets[_marketId];
        if (m.owner == address(0)) revert MarketNotFound();
        if (m.resolved) revert AlreadyResolved();
        uint256 refundableAfter = m.deadline + RESOLUTION_GRACE;
        if (block.timestamp < refundableAfter)
            revert GracePeriodNotPassed(refundableAfter);

        uint256 amount = stakeOf[_marketId][msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        stakeOf[_marketId][msg.sender] = 0;
        m.totalPool -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit EmergencyRefunded(_marketId, msg.sender, amount);
    }

    // public
    // internal
    // private
    // view & pure functions
    function getRequiredFee() public view returns (uint256) {
        (uint256 flrPrice, int8 decimals, uint64 ts) = i_ftsoV2.getFeedById(
            i_flrUsdFeedId
        );
        if (flrPrice == 0) revert InvalidOraclePrice();
        if (decimals < 0) revert NegativeDecimals();

        // Staleness guard (skip if the feed reports a future/equal timestamp).
        if (ts < block.timestamp) {
            uint256 age = block.timestamp - ts;
            if (age > MAX_PRICE_AGE) revert StalePrice(age);
        }

        // price = flrPrice / 10^decimals  ->  requiredWei = 13e18 * 10^decimals / flrPrice
        uint256 multiplier = 10 ** uint256(uint8(decimals)); // safe: decimals >= 0
        return (TARGET_USD_FEE * multiplier) / flrPrice;
    }

    //ADMIN
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
        emit OwnershipTransferred(owner, newOwner);
    }

    function withdrawTreasury(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = accumulatedTreasuryFees;
        if (amount == 0) revert NothingToWithdraw();

        accumulatedTreasuryFees = 0;
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
