const VEIL_MARKET_ADDRESS = process.env.VEIL_MARKET_ADDRESS;

if (!VEIL_MARKET_ADDRESS) {
  throw new Error(
    "FATAL: VEIL_MARKET_ADDRESS environment variable is missing.",
  );
}

const VEIL_MARKET_ABI = [
  {
    type: "function",
    name: "markets",
    stateMutability: "view",
    inputs: [
      {
        type: "uint256",
        name: "marketId",
      },
    ],
    outputs: [
      {
        type: "address",
        name: "owner",
      },
      {
        type: "string",
        name: "apiEndpoint",
      },
      {
        type: "string",
        name: "question",
      },
      {
        type: "uint256",
        name: "deadline",
      },
      {
        type: "uint256",
        name: "totalPool",
      },
      {
        type: "bool",
        name: "resolved",
      },
      {
        type: "bool",
        name: "outcome",
      },
      {
        type: "bytes32",
        name: "merkleRoot",
      },
    ],
  },

  {
    type: "function",
    name: "getBettors",
    stateMutability: "view",
    inputs: [
      {
        type: "uint256",
        name: "marketId",
      },
    ],
    outputs: [
      {
        type: "address[]",
      },
    ],
  },

  {
    type: "function",
    name: "getPrediction",
    stateMutability: "view",
    inputs: [
      {
        type: "uint256",
        name: "marketId",
      },
      {
        type: "address",
        name: "bettor",
      },
    ],
    outputs: [
      {
        type: "bytes",
      },
    ],
  },

  {
    type: "function",
    name: "stakeOf",
    stateMutability: "view",
    inputs: [
      {
        type: "uint256",
        name: "marketId",
      },
      {
        type: "address",
        name: "bettor",
      },
    ],
    outputs: [
      {
        type: "uint256",
      },
    ],
  },

  {
    type: "function",
    name: "resolveMarket",
    stateMutability: "nonpayable",
    inputs: [
      {
        type: "uint256",
        name: "_marketId",
      },
      {
        type: "bytes32",
        name: "_merkleRoot",
      },
      {
        type: "string",
        name: "_outcome",
      },
      {
        type: "bytes",
        name: "_signature",
      },
    ],
    outputs: [],
  },
];

module.exports = {
  VEIL_MARKET_ADDRESS,
  VEIL_MARKET_ABI,
};
