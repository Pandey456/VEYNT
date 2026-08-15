// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract VeyntMarket {
    // ============================================================
    // ERRORS
    // ============================================================

    error NotOwner();
    error ZeroAddress();
    error DeadlineInPast();
    error DurationTooShort(uint256 earliestAllowedDeadline);
    error EmptyQuestion();
    error EmptyEndpoint();
    error InvalidOutcome();
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

    // ============================================================
    // TYPE DECLARATIONS
    // ============================================================

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

    // ============================================================
    // CONSTANTS
    // ============================================================

    /// @notice Fixed market creation fee: 1 BOT
    uint256 public constant MARKET_CREATION_FEE = 1 ether;

    /// @notice Winner allocation: 86% of the market pool.
    uint256 public constant WINNER_SHARE = 86;

    /// @notice Market creator allocation: 10% of the market pool.
    uint256 public constant CREATOR_SHARE = 10;

    /// @notice Veynt treasury allocation: 3% of the market pool.
    uint256 public constant PLATFORM_SHARE = 3;

    /// @notice Resolver allocation: 1% of the market pool.
    uint256 public constant RESOLVER_SHARE = 1;

    /// @notice Total allocation percentage.
    uint256 public constant TOTAL_SHARE = 100;

    /// @notice Minimum time a market must remain open.
    uint256 public constant MIN_MARKET_DURATION = 5 minutes;

    /// @notice Time after the deadline after which bettors
    /// can claim an emergency refund if the market was not resolved.
    uint256 public constant RESOLUTION_GRACE = 3 days;

    // ============================================================
    // IMMUTABLE STATE
    // ============================================================

    /// @notice Authorized TEE signer for market resolution.
    address public immutable i_teeSigner;

    // ============================================================
    // STATE VARIABLES
    // ============================================================

    address public owner;

    uint256 public marketCount;

    uint256 public accumulatedTreasuryFees;

    uint256 private _locked = 1;

    mapping(uint256 => Market) public markets;

    mapping(uint256 marketId => mapping(address bettor => uint256 stake))
        public stakeOf;

    mapping(uint256 marketId => address[]) public bettors;

    mapping(uint256 marketId => mapping(address bettor => bool)) public hasBet;

    mapping(uint256 marketId => mapping(address bettor => bytes))
        public predictionOf;

    mapping(uint256 marketId => mapping(address bettor => bool claimed))
        public hasClaimed;

    // ============================================================
    // EVENTS
    // ============================================================

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

    event PredictionPlaced(
        uint256 indexed marketId,
        address indexed bettor,
        uint256 amount,
        bytes encryptedChoice
    );

    event MarketResolved(
        uint256 indexed marketId,
        bytes32 indexed merkleRoot,
        string outcome
    );

    event EmergencyRefunded(
        uint256 indexed marketId,
        address indexed bettor,
        uint256 amount
    );

    event TreasuryWithdrawn(address indexed to, uint256 amount);

    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner();
        }

        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) {
            revert Reentrancy();
        }

        _locked = 2;

        _;

        _locked = 1;
    }

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor(address _teeSigner) {
        if (_teeSigner == address(0)) {
            revert ZeroAddress();
        }

        i_teeSigner = _teeSigner;
        owner = msg.sender;

        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============================================================
    // MARKET CREATION
    // ============================================================

    /**
     * @notice Creates a new prediction market.
     *
     * Market creation costs exactly 1 BOT.
     *
     * If the caller sends more than 1 BOT, the excess is refunded.
     */
    function createMarket(
        string calldata _question,
        uint256 _deadline,
        string calldata _apiEndpoint
    ) external payable nonReentrant returns (uint256 marketId) {
        // --------------------------------------------------------
        // CHECKS
        // --------------------------------------------------------

        if (_deadline <= block.timestamp) {
            revert DeadlineInPast();
        }

        uint256 earliestAllowedDeadline = block.timestamp + MIN_MARKET_DURATION;

        if (_deadline < earliestAllowedDeadline) {
            revert DurationTooShort(earliestAllowedDeadline);
        }

        if (bytes(_question).length == 0) {
            revert EmptyQuestion();
        }

        if (bytes(_apiEndpoint).length == 0) {
            revert EmptyEndpoint();
        }

        if (msg.value < MARKET_CREATION_FEE) {
            revert InsufficientFee(MARKET_CREATION_FEE, msg.value);
        }

        // --------------------------------------------------------
        // EFFECTS
        // --------------------------------------------------------

        marketId = ++marketCount;

        accumulatedTreasuryFees += MARKET_CREATION_FEE;

        Market storage market = markets[marketId];

        market.owner = msg.sender;
        market.question = _question;
        market.apiEndpoint = _apiEndpoint;
        market.deadline = _deadline;

        emit MarketCreated(
            marketId,
            msg.sender,
            _question,
            _apiEndpoint,
            _deadline
        );

        // --------------------------------------------------------
        // REFUND EXCESS
        // --------------------------------------------------------

        uint256 excess = msg.value - MARKET_CREATION_FEE;

        if (excess > 0) {
            (bool success, ) = payable(msg.sender).call{value: excess}("");

            if (!success) {
                revert RefundFailed();
            }
        }
    }

    // ============================================================
    // PLACE PREDICTION
    // ============================================================

    /**
     * @notice Places or increases a prediction on a market.
     *
     * @param _marketId Market identifier.
     * @param _encryptedChoice Encrypted YES/NO prediction.
     */
    function predict(
        uint256 _marketId,
        bytes calldata _encryptedChoice
    ) external payable nonReentrant {
        Market storage market = markets[_marketId];

        if (market.owner == address(0)) {
            revert MarketNotFound();
        }

        if (block.timestamp >= market.deadline) {
            revert MarketClosed();
        }

        if (msg.value == 0) {
            revert ZeroStake();
        }

        // --------------------------------------------------------
        // REGISTER BETTOR
        // --------------------------------------------------------

        if (!hasBet[_marketId][msg.sender]) {
            hasBet[_marketId][msg.sender] = true;

            bettors[_marketId].push(msg.sender);
        }

        // --------------------------------------------------------
        // UPDATE BETTOR DATA
        // --------------------------------------------------------

        stakeOf[_marketId][msg.sender] += msg.value;

        predictionOf[_marketId][msg.sender] = _encryptedChoice;

        market.totalPool += msg.value;

        emit PredictionPlaced(
            _marketId,
            msg.sender,
            msg.value,
            _encryptedChoice
        );
    }

    // ============================================================
    // EMERGENCY REFUND
    // ============================================================

    /**
     * @notice Allows bettors to recover their stake if a market
     * remains unresolved after the resolution grace period.
     */
    function emergencyRefund(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];

        if (market.owner == address(0)) {
            revert MarketNotFound();
        }

        if (market.resolved) {
            revert AlreadyResolved();
        }

        uint256 refundableAfter = market.deadline + RESOLUTION_GRACE;

        if (block.timestamp < refundableAfter) {
            revert GracePeriodNotPassed(refundableAfter);
        }

        uint256 amount = stakeOf[_marketId][msg.sender];

        if (amount == 0) {
            revert NothingToWithdraw();
        }

        // --------------------------------------------------------
        // EFFECTS
        // --------------------------------------------------------

        stakeOf[_marketId][msg.sender] = 0;

        market.totalPool -= amount;

        // --------------------------------------------------------
        // INTERACTION
        // --------------------------------------------------------

        (bool success, ) = payable(msg.sender).call{value: amount}("");

        if (!success) {
            revert TransferFailed();
        }

        emit EmergencyRefunded(_marketId, msg.sender, amount);
    }

    // ============================================================
    // RESOLVE MARKET
    // ============================================================

    /**
     * @notice Resolves a market using a TEE-generated signature.
     *
     * The TEE signs:
     *
     * keccak256(
     *     abi.encodePacked(
     *         _marketId,
     *         _merkleRoot,
     *         _outcome
     *     )
     * )
     *
     * The signature is then verified against i_teeSigner.
     */
    function resolveMarket(
        uint256 _marketId,
        bytes32 _merkleRoot,
        string calldata _outcome,
        bytes calldata _signature
    ) external nonReentrant {
        Market storage market = markets[_marketId];

        if (market.owner == address(0)) {
            revert MarketNotFound();
        }

        if (market.resolved) {
            revert AlreadyResolved();
        }

        // --------------------------------------------------------
        // VALIDATE OUTCOME
        // --------------------------------------------------------

        bytes32 outcomeHash = keccak256(bytes(_outcome));

        bool outcome = false;

        if (outcomeHash == keccak256(bytes("YES"))) {
            outcome = true;
        } else if (outcomeHash == keccak256(bytes("NO"))) {
            outcome = false;
        } else {
            revert InvalidOutcome();
        }

        // --------------------------------------------------------
        // CREATE MESSAGE HASH
        // --------------------------------------------------------

        bytes32 messageHash = keccak256(
            abi.encodePacked(_marketId, _merkleRoot, _outcome)
        );

        // --------------------------------------------------------
        // ETH SIGNED MESSAGE HASH
        // --------------------------------------------------------

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        // --------------------------------------------------------
        // RECOVER SIGNER
        // --------------------------------------------------------

        address recoveredSigner = recoverSigner(
            ethSignedMessageHash,
            _signature
        );

        if (recoveredSigner != i_teeSigner) {
            revert NotOwner();
        }

        // --------------------------------------------------------
        // CALCULATE MARKET ALLOCATION
        // --------------------------------------------------------

        uint256 totalPool = market.totalPool;

        uint256 creatorAmount = (totalPool * CREATOR_SHARE) / TOTAL_SHARE;

        uint256 platformAmount = (totalPool * PLATFORM_SHARE) / TOTAL_SHARE;

        uint256 resolverAmount = (totalPool * RESOLVER_SHARE) / TOTAL_SHARE;

        // --------------------------------------------------------
        // ACCOUNT FOR PLATFORM SHARE
        // --------------------------------------------------------

        accumulatedTreasuryFees += platformAmount;

        // --------------------------------------------------------
        // PAY MARKET CREATOR
        // --------------------------------------------------------

        (bool creatorSuccess, ) = payable(market.owner).call{
            value: creatorAmount
        }("");

        if (!creatorSuccess) {
            revert TransferFailed();
        }

        // --------------------------------------------------------
        // PAY RESOLVER
        // --------------------------------------------------------

        (bool resolverSuccess, ) = payable(msg.sender).call{
            value: resolverAmount
        }("");

        if (!resolverSuccess) {
            revert TransferFailed();
        }

        // --------------------------------------------------------
        // RESOLVE MARKET
        // --------------------------------------------------------

        market.resolved = true;
        market.outcome = outcome;
        market.merkleRoot = _merkleRoot;

        emit MarketResolved(_marketId, _merkleRoot, _outcome);
    }

    // ============================================================
    // CLAIM PAYOUT
    // ============================================================

    /**
     * @notice Claims a payout using a Merkle proof.
     *
     * The Merkle leaf is:
     *
     * keccak256(
     *     bytes.concat(
     *         keccak256(
     *             abi.encode(msg.sender, _payout)
     *         )
     *     )
     * )
     */
    function claimPayout(
        uint256 _marketId,
        uint256 _payout,
        bytes32[] calldata _merkleProof
    ) external nonReentrant {
        Market storage market = markets[_marketId];

        if (!market.resolved) {
            revert MarketNotFound();
        }

        if (hasClaimed[_marketId][msg.sender]) {
            revert NothingToWithdraw();
        }

        // --------------------------------------------------------
        // CREATE MERKLE LEAF
        // --------------------------------------------------------

        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(msg.sender, _payout)))
        );

        // --------------------------------------------------------
        // VERIFY MERKLE PROOF
        // --------------------------------------------------------

        if (!MerkleProof.verify(_merkleProof, market.merkleRoot, leaf)) {
            revert TransferFailed();
        }

        // --------------------------------------------------------
        // EFFECTS
        // --------------------------------------------------------

        hasClaimed[_marketId][msg.sender] = true;

        // --------------------------------------------------------
        // TRANSFER PAYOUT
        // --------------------------------------------------------

        (bool success, ) = payable(msg.sender).call{value: _payout}("");

        if (!success) {
            revert TransferFailed();
        }
    }

    // ============================================================
    // SIGNATURE RECOVERY
    // ============================================================

    function recoverSigner(
        bytes32 _ethSignedMessageHash,
        bytes memory _signature
    ) internal pure returns (address) {
        if (_signature.length != 65) {
            revert InvalidOutcome();
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /**
     * @notice Returns all bettors for a market.
     */
    function getBettors(
        uint256 _marketId
    ) external view returns (address[] memory) {
        return bettors[_marketId];
    }

    /**
     * @notice Returns the encrypted prediction of a bettor.
     */
    function getPrediction(
        uint256 _marketId,
        address _bettor
    ) external view returns (bytes memory) {
        return predictionOf[_marketId][_bettor];
    }

    // ============================================================
    // ADMIN
    // ============================================================

    /**
     * @notice Transfers contract ownership.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) {
            revert ZeroAddress();
        }

        address previousOwner = owner;

        owner = _newOwner;

        emit OwnershipTransferred(previousOwner, _newOwner);
    }

    /**
     * @notice Withdraws accumulated market creation fees.
     */
    function withdrawTreasury(address _to) external onlyOwner nonReentrant {
        if (_to == address(0)) {
            revert ZeroAddress();
        }

        uint256 amount = accumulatedTreasuryFees;

        if (amount == 0) {
            revert NothingToWithdraw();
        }

        accumulatedTreasuryFees = 0;

        (bool success, ) = payable(_to).call{value: amount}("");

        if (!success) {
            revert TransferFailed();
        }

        emit TreasuryWithdrawn(_to, amount);
    }
}
