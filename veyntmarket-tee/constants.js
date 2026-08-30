const VEYNT_MARKET_ADDRESS = process.env.VEYNT_MARKET_ADDRESS;

if (!VEYNT_MARKET_ADDRESS) {
  throw new Error(
    "FATAL: VEYNT_MARKET_ADDRESS environment variable is missing.",
  );
}
// constants.js

const VEYNT_MARKET_ABI = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_teeSigner",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "CREATOR_SHARE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MARKET_CREATION_FEE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MIN_MARKET_DURATION",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "PLATFORM_SHARE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "RESOLUTION_GRACE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "RESOLVER_SHARE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "TOTAL_SHARE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "WINNER_SHARE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "accumulatedTreasuryFees",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bettors",
    inputs: [
      {
        name: "marketId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimPayout",
    inputs: [
      {
        name: "_marketId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_payout",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_merkleProof",
        type: "bytes32[]",
        internalType: "bytes32[]",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createMarket",
    inputs: [
      {
        name: "_question",
        type: "string",
        internalType: "string",
      },
      {
        name: "_deadline",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_apiEndpoint",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "marketId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "emergencyRefund",
    inputs: [
      {
        name: "_marketId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getBettors",
    inputs: [
      {
        name: "_marketId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPrediction",
    inputs: [
      {
        name: "_marketId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_bettor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasBet",
    inputs: [
      {
        name: "marketId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "bettor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasClaimed",
    inputs: [
      {
        name: "marketId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "bettor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "claimed",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "i_teeSigner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "marketCount",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "markets",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "apiEndpoint",
        type: "string",
        internalType: "string",
      },
      {
        name: "question",
        type: "string",
        internalType: "string",
      },
      {
        name: "deadline",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "totalPool",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "resolved",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "outcome",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "merkleRoot",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "refundInitiated",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "startTime",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "predict",
    inputs: [
      {
        name: "_marketId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_encryptedChoice",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "predictionOf",
    inputs: [
      {
        name: "marketId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "bettor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "resolveMarket",
    inputs: [
      {
        name: "_marketId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_merkleRoot",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "_outcome",
        type: "string",
        internalType: "string",
      },
      {
        name: "_signature",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "stakeOf",
    inputs: [
      {
        name: "marketId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "bettor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "stake",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [
      {
        name: "_newOwner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawTreasury",
    inputs: [
      {
        name: "_to",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "EmergencyRefunded",
    inputs: [
      {
        name: "marketId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "bettor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      {
        name: "marketId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "question",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "apiEndpoint",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "deadline",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MarketResolved",
    inputs: [
      {
        name: "marketId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "merkleRoot",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "outcome",
        type: "string",
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PredictionPlaced",
    inputs: [
      {
        name: "marketId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "bettor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "encryptedChoice",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TreasuryWithdrawn",
    inputs: [
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AlreadyResolved",
    inputs: [],
  },
  {
    type: "error",
    name: "DeadlineInPast",
    inputs: [],
  },
  {
    type: "error",
    name: "DurationTooShort",
    inputs: [
      {
        name: "earliestAllowedDeadline",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "ECDSAInvalidSignature",
    inputs: [],
  },
  {
    type: "error",
    name: "ECDSAInvalidSignatureLength",
    inputs: [
      {
        name: "length",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "ECDSAInvalidSignatureS",
    inputs: [
      {
        name: "s",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
  },
  {
    type: "error",
    name: "EmptyEndpoint",
    inputs: [],
  },
  {
    type: "error",
    name: "EmptyQuestion",
    inputs: [],
  },
  {
    type: "error",
    name: "GracePeriodNotPassed",
    inputs: [
      {
        name: "refundableAfter",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "InsufficientFee",
    inputs: [
      {
        name: "required",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "sent",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "InvalidMerkleProof",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidOutcome",
    inputs: [],
  },
  {
    type: "error",
    name: "MarketClosed",
    inputs: [],
  },
  {
    type: "error",
    name: "MarketNotEnded",
    inputs: [],
  },
  {
    type: "error",
    name: "MarketNotFound",
    inputs: [],
  },
  {
    type: "error",
    name: "MarketNotResolved",
    inputs: [],
  },
  {
    type: "error",
    name: "NotOwner",
    inputs: [],
  },
  {
    type: "error",
    name: "NothingToWithdraw",
    inputs: [],
  },
  {
    type: "error",
    name: "ReentrancyGuardReentrantCall",
    inputs: [],
  },
  {
    type: "error",
    name: "RefundAlreadyInitiated",
    inputs: [],
  },
  {
    type: "error",
    name: "RefundFailed",
    inputs: [],
  },
  {
    type: "error",
    name: "TransferFailed",
    inputs: [],
  },
  {
    type: "error",
    name: "UnauthorizedSigner",
    inputs: [],
  },
  {
    type: "error",
    name: "ZeroAddress",
    inputs: [],
  },
  {
    type: "error",
    name: "ZeroStake",
    inputs: [],
  },
];

module.exports = {
  VEYNT_MARKET_ADDRESS,
  VEYNT_MARKET_ABI,
};
