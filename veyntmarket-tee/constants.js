const VEYNT_MARKET_ADDRESS = process.env.VEYNT_MARKET_ADDRESS;

if (!VEYNT_MARKET_ADDRESS) {
  throw new Error(
    "FATAL: VEYNT_MARKET_ADDRESS environment variable is missing.",
  );
}
// constants.js

// const VEYNT_MARKET_ADDRESS =
//   "0xae1cf56E2Df39E4EE9203DcEd781C75799E36202";

const VEYNT_MARKET_ABI = [
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
    ],
    stateMutability: "view",
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
];

module.exports = {
  VEYNT_MARKET_ADDRESS,
  VEYNT_MARKET_ABI,
};
