const {
  createPublicClient,
  createWalletClient,
  http,
  decodeAbiParameters,
  parseAbiParameters,
  keccak256,
  encodePacked,
} = require("viem");

const { privateKeyToAccount } = require("viem/accounts");
const { coston2 } = require("viem/chains");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const { VEIL_MARKET_ADDRESS, VEIL_MARKET_ABI } = require("./constants.js");

// ============================================================
// CONFIGURATION
// ============================================================

const MARKET_ID = BigInt(process.env.MARKET_ID);

if (!process.env.MARKET_ID) {
  throw new Error("FATAL: MARKET_ID environment variable is missing.");
}

if (!process.env.PRIVATE_KEY) {
  throw new Error("FATAL: PRIVATE_KEY environment variable is missing.");
}

if (!process.env.TEE_PRIVATE_KEY) {
  throw new Error("FATAL: TEE_PRIVATE_KEY environment variable is missing.");
}

if (!VEIL_MARKET_ADDRESS) {
  throw new Error("FATAL: VEIL_MARKET_ADDRESS is missing.");
}

const RPC_URL = "https://coston2-api.flare.network/ext/C/rpc";

// ============================================================
// ACCOUNTS
// ============================================================

console.log("Length:", process.env.PRIVATE_KEY?.length);

console.log("Starts with 0x:", process.env.PRIVATE_KEY?.startsWith("0x"));

const deployerAccount = privateKeyToAccount(process.env.PRIVATE_KEY);

const teeAccount = privateKeyToAccount(process.env.TEE_PRIVATE_KEY);

// ============================================================
// CLIENTS
// ============================================================

const publicClient = createPublicClient({
  chain: coston2,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account: deployerAccount,
  chain: coston2,
  transport: http(RPC_URL),
});

// ============================================================
// PREDICTION DECRYPTION
// ============================================================
//
// CURRENTLY:
// Frontend stores:
//
//   stringToHex("YES")
//   stringToHex("NO")
//
// Therefore this function simply converts the stored bytes
// back into UTF-8.
//
// IMPORTANT:
// When you implement REAL encryption later, replace ONLY
// this function.
//
// The rest of evaluator.js should not need to change.
// ============================================================

function decryptPrediction(encodedPrediction) {
  if (!encodedPrediction || encodedPrediction === "0x") {
    throw new Error("Empty prediction received.");
  }

  const prediction = Buffer.from(encodedPrediction.slice(2), "hex").toString(
    "utf8",
  );

  const normalizedPrediction = prediction.toUpperCase();

  if (normalizedPrediction !== "YES" && normalizedPrediction !== "NO") {
    throw new Error(`Invalid prediction after decryption: ${prediction}`);
  }

  return normalizedPrediction;
}

// ============================================================
// READ MARKET
// ============================================================

async function getMarket() {
  const market = await publicClient.readContract({
    address: VEIL_MARKET_ADDRESS,
    abi: VEIL_MARKET_ABI,
    functionName: "markets",
    args: [MARKET_ID],
  });

  const marketData = {
    owner: market[0],
    apiEndpoint: market[1],
    question: market[2],
    deadline: market[3],
    totalPool: market[4],
    resolved: market[5],
    outcome: market[6],
    merkleRoot: market[7],
  };

  if (
    marketData.owner.toLowerCase() ===
    "0x0000000000000000000000000000000000000000"
  ) {
    throw new Error("Market does not exist.");
  }

  if (marketData.resolved) {
    throw new Error("Market is already resolved.");
  }

  return marketData;
}

// ============================================================
// PARSE MARKET QUESTION
// ============================================================
//
// Expected format:
//
// BTC|ABOVE|6500000000000
//
// parts[0] = BTC
// parts[1] = ABOVE
// parts[2] = 6500000000000
//
// ============================================================

function parseMarketQuestion(question) {
  const parts = question.split("|");

  if (parts.length !== 3) {
    throw new Error(`Invalid market question format: ${question}`);
  }

  const symbol = parts[0].trim();

  const direction = parts[1].trim().toUpperCase();

  const targetPrice = BigInt(parts[2].trim());

  if (direction !== "ABOVE" && direction !== "BELOW") {
    throw new Error(`Invalid market direction: ${direction}`);
  }

  return {
    symbol,
    direction,
    targetPrice,
  };
}

// ============================================================
// GET FDC PRICE
// ============================================================
//
// Uses the existing fdc-run.js.
//
// fdc-run.js should export:
//
// module.exports = { main };
//
// and should NOT automatically execute main()
// when it is imported.
// ============================================================

async function getFdcPrice(deadline) {
  // FDC uses this timestamp to query the API
  // at the market deadline.

  process.env.MARKET_DEADLINE_MS = (Number(deadline) * 1000).toString();

  console.log("Deadline Set:", process.env.MARKET_DEADLINE_MS);

  const { main: runFdc } = require("./fdc-run.js");

  const proofData = await runFdc();

  const abiEncodedData = proofData.response.responseBody.abiEncodedData;

  if (!abiEncodedData) {
    throw new Error("FDC response does not contain abiEncodedData.");
  }

  const [{ price: verifiedPrice }] = decodeAbiParameters(
    parseAbiParameters("(uint256 price)"),
    abiEncodedData,
  );

  return verifiedPrice;
}

// ============================================================
// DETERMINE WINNING SIDE
// ============================================================
//
// ABOVE:
//
// actual >= target
// YES wins
//
// BELOW:
//
// actual <= target
// YES wins
//
// Otherwise NO wins.
// ============================================================

function determineWinningSide(direction, verifiedPrice, targetPrice) {
  if (direction === "ABOVE") {
    return verifiedPrice >= targetPrice ? "YES" : "NO";
  }

  if (direction === "BELOW") {
    return verifiedPrice <= targetPrice ? "YES" : "NO";
  }

  throw new Error(`Unsupported direction: ${direction}`);
}

// ============================================================
// GET ALL BETTORS
// ============================================================

async function getBettors() {
  const bettors = await publicClient.readContract({
    address: VEIL_MARKET_ADDRESS,
    abi: VEIL_MARKET_ABI,
    functionName: "getBettors",
    args: [MARKET_ID],
  });

  return bettors;
}

// ============================================================
// GET SINGLE BETTOR DATA
// ============================================================

async function getBettorPrediction(bettor) {
  const stake = await publicClient.readContract({
    address: VEIL_MARKET_ADDRESS,
    abi: VEIL_MARKET_ABI,
    functionName: "stakeOf",
    args: [MARKET_ID, bettor],
  });

  const encryptedPrediction = await publicClient.readContract({
    address: VEIL_MARKET_ADDRESS,
    abi: VEIL_MARKET_ABI,
    functionName: "getPrediction",
    args: [MARKET_ID, bettor],
  });

  const prediction = decryptPrediction(encryptedPrediction);

  return {
    bettor,
    amount: stake,
    encryptedPrediction,
    prediction,
  };
}

// ============================================================
// CLASSIFY BETTORS
// ============================================================
//
// Separates:
//
// YES bettors
// NO bettors
//
// Also calculates total pool.
// ============================================================

async function classifyBettors(bettors) {
  const yesBettors = [];
  const noBettors = [];

  let totalPoolWei = 0n;

  for (const bettor of bettors) {
    const data = await getBettorPrediction(bettor);

    console.log(`Bettor: ${data.bettor}`);

    console.log(`Stake: ${data.amount.toString()}`);

    console.log(`Prediction: ${data.prediction}`);

    totalPoolWei += data.amount;

    if (data.prediction === "YES") {
      yesBettors.push({
        bettor: data.bettor,
        amount: data.amount,
      });
    } else if (data.prediction === "NO") {
      noBettors.push({
        bettor: data.bettor,
        amount: data.amount,
      });
    }
  }

  return {
    yesBettors,
    noBettors,
    totalPoolWei,
  };
}

// ============================================================
// SELECT WINNERS
// ============================================================

function selectWinningBettors(winningOutcome, yesBettors, noBettors) {
  return winningOutcome === "YES" ? yesBettors : noBettors;
}

// ============================================================
// CALCULATE WINNING POOL
// ============================================================

function calculateWinningPool(winningBettors) {
  let winningPoolWei = 0n;

  for (const winner of winningBettors) {
    winningPoolWei += winner.amount;
  }

  return winningPoolWei;
}

// ============================================================
// CALCULATE PAYOUTS
// ============================================================
//
// Current rule:
//
// 86% of total pool goes to winners.
//
// Each winner receives:
//
// winnerStake / totalWinningStake
// × distributablePool
//
// ============================================================

function calculatePayouts(winningBettors, totalPoolWei, winningPoolWei) {
  if (winningPoolWei === 0n) {
    throw new Error("Winning pool is zero.");
  }

  // 86% of the total pool is distributed.

  const distributablePool = (totalPoolWei * 86n) / 100n;

  console.log("Distributable pool:", distributablePool.toString());

  const payouts = winningBettors.map((winner) => {
    const payout = (winner.amount * distributablePool) / winningPoolWei;

    return {
      bettor: winner.bettor,
      amount: winner.amount,
      payout,
    };
  });

  return {
    distributablePool,
    payouts,
  };
}

// ============================================================
// CREATE MERKLE TREE
// ============================================================

function createPayoutMerkleTree(payouts) {
  if (payouts.length === 0) {
    throw new Error("Cannot create Merkle tree with zero winners.");
  }

  const leaves = payouts.map((winner) => [
    winner.bettor,
    winner.payout.toString(),
  ]);

  const tree = StandardMerkleTree.of(leaves, ["address", "uint256"]);

  return {
    tree,
    merkleRoot: tree.root,
  };
}

// ============================================================
// SIGN RESOLUTION
// ============================================================
//
// This MUST match the Solidity contract:
//
// keccak256(
//     abi.encodePacked(
//         _marketId,
//         _merkleRoot,
//         _outcome
//     )
// )
//
// Then Solidity adds:
//
// "\x19Ethereum Signed Message:\n32"
//
// Viem's signMessage({ message: { raw } })
// adds that Ethereum signed-message prefix.
// ============================================================

async function signResolution(merkleRoot, winningOutcome) {
  const messageHash = keccak256(
    encodePacked(
      ["uint256", "bytes32", "string"],
      [MARKET_ID, merkleRoot, winningOutcome],
    ),
  );

  const signature = await teeAccount.signMessage({
    message: {
      raw: messageHash,
    },
  });

  return {
    messageHash,
    signature,
  };
}

// ============================================================
// SUBMIT RESOLUTION
// ============================================================

async function submitResolution(merkleRoot, winningOutcome, signature) {
  console.log("\nSubmitting resolveMarket...");

  const txHash = await walletClient.writeContract({
    address: VEIL_MARKET_ADDRESS,
    abi: VEIL_MARKET_ABI,
    functionName: "resolveMarket",
    args: [MARKET_ID, merkleRoot, winningOutcome, signature],
  });

  console.log("Resolution transaction:", txHash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  return receipt;
}

// ============================================================
// MAIN EVALUATOR
// ============================================================

async function runProductionEvaluator() {
  console.log("\n==========================================");

  console.log(`PROCESSING MARKET #${MARKET_ID}`);

  console.log("==========================================\n");

  // ==========================================================
  // STEP 1
  // GET QUESTION
  // ==========================================================

  console.log("STEP 1 — Reading market...");

  const market = await getMarket();

  console.log("Raw Market:", market);

  const { symbol, direction, targetPrice } = parseMarketQuestion(
    market.question,
  );

  console.log(`Question:      ${market.question}`);

  console.log(`Symbol:        ${symbol}`);

  console.log(`Condition:     ${direction}`);

  console.log(`Target Price:  $${Number(targetPrice) / 1e8}`);

  console.log(`Deadline:      ${market.deadline.toString()}`);

  console.log(`Total Pool:    ${market.totalPool.toString()}`);

  // ==========================================================
  // STEP 2
  // GET PRICE + DETERMINE WINNER
  // ==========================================================

  console.log("\nSTEP 2 — Getting FDC price...");

  const verifiedPrice = await getFdcPrice(market.deadline);

  console.log(`FDC Verified Price: $${Number(verifiedPrice) / 1e8}`);

  const winningOutcome = determineWinningSide(
    direction,
    verifiedPrice,
    targetPrice,
  );

  console.log(`Winning Side: [ ${winningOutcome} ]`);

  // ==========================================================
  // STEP 3
  // FETCH + DECRYPT + CLASSIFY BETTORS
  // ==========================================================

  console.log("\nSTEP 3 — Fetching bettors...");

  const bettors = await getBettors();

  console.log(`Total bettors: ${bettors.length}`);

  if (bettors.length === 0) {
    throw new Error("No bettors found.");
  }

  const { yesBettors, noBettors, totalPoolWei } =
    await classifyBettors(bettors);

  console.log(`YES bettors: ${yesBettors.length}`);

  console.log(`NO bettors: ${noBettors.length}`);

  console.log(`Calculated total pool: ${totalPoolWei.toString()}`);

  // ==========================================================
  // SELECT WINNING BETTORS
  // ==========================================================

  const winningBettors = selectWinningBettors(
    winningOutcome,
    yesBettors,
    noBettors,
  );

  console.log(`Winning bettors: ${winningBettors.length}`);

  if (winningBettors.length === 0) {
    throw new Error(
      `There are no bettors on the winning side: ${winningOutcome}`,
    );
  }

  // ==========================================================
  // CALCULATE WINNING POOL
  // ==========================================================

  const winningPoolWei = calculateWinningPool(winningBettors);

  console.log(`Winning pool: ${winningPoolWei.toString()}`);

  if (winningPoolWei === 0n) {
    throw new Error("Winning pool is zero.");
  }

  // ==========================================================
  // STEP 4
  // PAYOUTS + MERKLE TREE
  // ==========================================================

  console.log("\nSTEP 4 — Calculating payouts...");

  const { distributablePool, payouts } = calculatePayouts(
    winningBettors,
    totalPoolWei,
    winningPoolWei,
  );

  console.log(`Distributable pool: ${distributablePool.toString()}`);

  for (const winner of payouts) {
    console.log(`Winner: ${winner.bettor}`);

    console.log(`Stake: ${winner.amount.toString()}`);

    console.log(`Payout: ${winner.payout.toString()}`);
  }

  // ==========================================================
  // CREATE MERKLE TREE
  // ==========================================================

  console.log("\nCreating Merkle tree...");

  const { tree, merkleRoot } = createPayoutMerkleTree(payouts);

  console.log("Merkle Root:", merkleRoot);

  // ==========================================================
  // SIGN WITH TEE
  // ==========================================================

  console.log("\nSigning resolution with TEE...");

  const { messageHash, signature } = await signResolution(
    merkleRoot,
    winningOutcome,
  );

  console.log("TEE Address:", teeAccount.address);

  console.log("Message Hash:", messageHash);

  console.log("Signature:", signature);

  // ==========================================================
  // RESOLVE MARKET
  // ==========================================================

  const receipt = await submitResolution(merkleRoot, winningOutcome, signature);

  // ==========================================================
  // SUCCESS
  // ==========================================================

  console.log("\n==========================================");

  console.log("MARKET RESOLVED SUCCESSFULLY");

  console.log("==========================================");

  console.log(`Market ID:       ${MARKET_ID}`);

  console.log(`Winning Side:    ${winningOutcome}`);

  console.log(`Verified Price:  $${Number(verifiedPrice) / 1e8}`);

  console.log(`Target Price:    $${Number(targetPrice) / 1e8}`);

  console.log(`Winning Pool:    ${winningPoolWei}`);

  console.log(`Merkle Root:     ${merkleRoot}`);

  console.log(`Block:           ${receipt.blockNumber}`);

  console.log(`TX Hash:         ${receipt.transactionHash}`);

  console.log("==========================================\n");
}

// ============================================================
// START
// ============================================================

runProductionEvaluator().catch((error) => {
  console.error("\nFATAL:");

  console.error(error);

  process.exit(1);
});
