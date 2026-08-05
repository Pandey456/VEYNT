const {
  createPublicClient,
  createWalletClient,
  http,
  decodeAbiParameters,
  parseAbiParameters,
  keccak256,
  encodePacked,
  parseAbiItem,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { coston2 } = require("viem/chains");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

// --- CONFIGURATION ---
const MARKET_ID = BigInt(process.env.MARKET_ID);
if (!MARKET_ID)
  throw new Error("FATAL: MARKET_ID environment variable is missing.");

const RPC_URL = "https://coston2-api.flare.network/ext/C/rpc";
const VEIL_MARKET_ADDRESS = process.env.VEIL_MARKET_ADDRESS;
console.log("Length:", process.env.PRIVATE_KEY?.length);
console.log("Starts with 0x:", process.env.PRIVATE_KEY?.startsWith("0x"));

const deployerAccount = privateKeyToAccount(process.env.PRIVATE_KEY);
const teeAccount = privateKeyToAccount(process.env.TEE_PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: coston2,
  transport: http(RPC_URL),
});
const walletClient = createWalletClient({
  account: deployerAccount,
  chain: coston2,
  transport: http(RPC_URL),
});

const VEIL_MARKET_ABI = [
  {
    type: "function",
    name: "markets",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "marketId" }],
    outputs: [
      { type: "address", name: "owner" },
      { type: "string", name: "apiEndpoint" },
      { type: "string", name: "question" },
      { type: "uint256", name: "deadline" },
      { type: "uint256", name: "totalPool" },
      { type: "bool", name: "resolved" },
      { type: "bool", name: "outcome" },
      { type: "bytes32", name: "merkleRoot" },
    ],
  },
  {
    type: "function",
    name: "resolveMarket",
    stateMutability: "nonpayable",
    inputs: [
      { type: "uint256", name: "_marketId" },
      { type: "bytes32", name: "_merkleRoot" },
      { type: "string", name: "_outcome" },
      { type: "bytes", name: "_signature" },
    ],
    outputs: [],
  },
];

async function runProductionEvaluator() {
  console.log(`\n=== PROCESSING MARKET #${MARKET_ID} ===`);

  // 1. READ MARKET DATA FROM SMART CONTRACT
  const market = await publicClient.readContract({
    address: VEIL_MARKET_ADDRESS,
    abi: VEIL_MARKET_ABI,
    functionName: "markets",
    args: [MARKET_ID],
  });

  if (market.owner === "0x0000000000000000000000000000000000000000")
    throw new Error("Market does not exist.");
  if (market.resolved) throw new Error("Market already resolved.");
  console.log(market);

  // Parse target from question: e.g. "BTC|ABOVE|6500000000000"
  const parts = market.question.split("|");
  const direction = parts[1].toUpperCase();
  const targetPrice = BigInt(parts[2]);

  // Set the FDC target timestamp dynamically in the environment
  process.env.MARKET_DEADLINE_MS = (Number(market.deadline) * 1000).toString();

  console.log(`Target Price:  $${Number(targetPrice) / 1e8}`);
  console.log(`Condition:     ${direction}`);
  console.log(`Deadline Set:  ${process.env.MARKET_DEADLINE_MS}`);

  // 2. RUN FDC SCRIPT WITH DYNAMIC DEADLINE
  const { main: runFdc } = require("./fdc-run.js");
  const proofData = await runFdc();
  const fdcAbiEncodedData = proofData.response.responseBody.abiEncodedData;

  const [{ price: verifiedPrice }] = decodeAbiParameters(
    parseAbiParameters("(uint256 price)"),
    fdcAbiEncodedData,
  );
  console.log(`FDC Verified Price: $${Number(verifiedPrice) / 1e8}`);

  // 3. DETERMINE WINNER
  let winningOutcome;
  if (direction === "ABOVE") {
    winningOutcome = verifiedPrice >= targetPrice ? "YES" : "NO";
  } else if (direction === "BELOW") {
    winningOutcome = verifiedPrice <= targetPrice ? "YES" : "NO";
  }
  console.log(`Winning Side: [ ${winningOutcome} ]`);

  // 4. FETCH PREDICTION EVENTS
  const logs = await publicClient.getLogs({
    address: VEIL_MARKET_ADDRESS,
    event: parseAbiItem(
      "event PredictionPlaced(uint256 indexed marketId, address indexed bettor, uint256 amount, bytes encryptedChoice)",
    ),
    args: { marketId: MARKET_ID },
    fromBlock: "earliest",
  });

  let totalPoolWei = 0n;
  let winningPoolWei = 0n;
  const winners = [];

  for (const log of logs) {
    const bettor = log.args.bettor;
    const amount = BigInt(log.args.amount);

    // Convert hex payload back to plain string ("YES" or "NO")
    const choice = Buffer.from(
      log.args.encryptedChoice.slice(2),
      "hex",
    ).toString("utf8");

    totalPoolWei += amount;
    if (choice === winningOutcome) {
      winningPoolWei += amount;
      winners.push({ bettor, amount });
    }
  }

  if (winningPoolWei === 0n) {
    console.log("No winning bets found. Aborting payout generation.");
    return;
  }

  // 5. CALCULATE 86% PRO-RATA PAYOUTS & MERKLE TREE
  const distributablePool = (totalPoolWei * 86n) / 100n;
  const merkleLeaves = winners.map((w) => [
    w.bettor,
    ((w.amount * distributablePool) / winningPoolWei).toString(),
  ]);

  const tree = StandardMerkleTree.of(merkleLeaves, ["address", "uint256"]);
  const merkleRoot = tree.root;

  // 6. SIGN THE PAYLOAD WITH TEE KEY
  const messageHash = keccak256(
    encodePacked(
      ["uint256", "bytes32", "string"],
      [MARKET_ID, merkleRoot, winningOutcome],
    ),
  );
  const signature = await teeAccount.signMessage({
    message: { raw: messageHash },
  });

  // 7. SUBMIT TO SMART CONTRACT
  console.log("Submitting resolution to smart contract...");
  const txHash = await walletClient.writeContract({
    address: VEIL_MARKET_ADDRESS,
    abi: VEIL_MARKET_ABI,
    functionName: "resolveMarket",
    args: [MARKET_ID, merkleRoot, winningOutcome, signature],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  console.log(`SUCCESS! Market resolved in block ${receipt.blockNumber}`);
  console.log(`Transaction Hash: ${txHash}`);
}

runProductionEvaluator().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
