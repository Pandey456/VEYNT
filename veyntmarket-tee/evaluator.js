const crypto = require("crypto");
const {
  createPublicClient,
  createWalletClient,
  http,
  decodeAbiParameters,
  parseAbiParameters,
  keccak256,
  defineChain,
  encodePacked,
} = require("viem");

const { privateKeyToAccount } = require("viem/accounts");
const botChainTestnet = defineChain({
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.bohr.life"] },
  },
  blockExplorers: {
    default: {
      name: "BOTScan",
      url: "https://scan.bohr.life",
    },
  },
});
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const { VEYNT_MARKET_ADDRESS, VEYNT_MARKET_ABI } = require("./constants.js");

const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIGURATION
// ============================================================

if (!process.env.MARKET_ID) {
  throw new Error("FATAL: MARKET_ID environment variable is missing.");
}

const MARKET_ID = BigInt(process.env.MARKET_ID);

if (!process.env.PRIVATE_KEY) {
  throw new Error("FATAL: PRIVATE_KEY environment variable is missing.");
}

if (!process.env.TEE_PRIVATE_KEY) {
  throw new Error("FATAL: TEE_PRIVATE_KEY environment variable is missing.");
}
if (!process.env.PREDICTION_PRIVATE_KEY) {
  throw new Error(
    "FATAL: PREDICTION_PRIVATE_KEY environment variable is missing.",
  );
}

if (!VEYNT_MARKET_ADDRESS) {
  throw new Error("FATAL: VEYNT_MARKET_ADDRESS is missing.");
}

const RPC_URL = "https://rpc.bohr.life";

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
  chain: botChainTestnet,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account: deployerAccount,
  chain: botChainTestnet,
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
    throw new Error("Empty encrypted prediction received.");
  }

  if (!process.env.PREDICTION_PRIVATE_KEY) {
    throw new Error("FATAL: PREDICTION_PRIVATE_KEY is missing.");
  }

  const privateKey = process.env.PREDICTION_PRIVATE_KEY.replace(/\\n/g, "\n");

  try {
    const encryptedData = Buffer.from(encodedPrediction.slice(2), "hex");

    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      encryptedData,
    );

    const prediction = decrypted.toString("utf8").toUpperCase();

    if (prediction !== "YES" && prediction !== "NO") {
      throw new Error(`Invalid prediction after decryption: ${prediction}`);
    }

    return prediction;
  } catch (error) {
    throw new Error(`Prediction decryption failed: ${error.message}`);
  }
}

// ============================================================
// READ MARKET
// ============================================================

async function getMarket() {
  const market = await publicClient.readContract({
    address: VEYNT_MARKET_ADDRESS,
    abi: VEYNT_MARKET_ABI,
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
    address: VEYNT_MARKET_ADDRESS,
    abi: VEYNT_MARKET_ABI,
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
    address: VEYNT_MARKET_ADDRESS,
    abi: VEYNT_MARKET_ABI,
    functionName: "stakeOf",
    args: [MARKET_ID, bettor],
  });

  const encryptedPrediction = await publicClient.readContract({
    address: VEYNT_MARKET_ADDRESS,
    abi: VEYNT_MARKET_ABI,
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

  // Each leaf represents:
  //
  // [bettor address, payout amount]
  //
  const leaves = payouts.map((winner) => [
    winner.bettor,
    winner.payout.toString(),
  ]);

  const tree = StandardMerkleTree.of(leaves, ["address", "uint256"]);

  // ----------------------------------------------------------
  // Generate an individual Merkle proof for every winner
  // ----------------------------------------------------------

  const winnersWithProofs = payouts.map((winner, index) => {
    const proof = tree.getProof(index);

    return {
      bettor: winner.bettor,

      // Original stake
      stake: winner.amount.toString(),

      // Exact payout in wei
      payout: winner.payout.toString(),

      // Human-readable value for frontend
      payoutBot: Number(winner.payout) / 1e18,

      // Merkle proof required by claimPayout()
      proof,
    };
  });

  return {
    tree,
    merkleRoot: tree.root,
    winnersWithProofs,
  };
}
// ============================================================
// SAVE CLAIM DATA
// ============================================================
//
// Creates:
//
// payouts/
//   market-1.json
//   market-2.json
//   market-3.json
//
// The frontend can fetch these files and find the
// connected wallet's payout automatically.
//
// ============================================================

function saveClaimData({
  market,
  winningOutcome,
  verifiedPrice,
  targetPrice,
  merkleRoot,
  winnersWithProofs,
  receipt,
}) {
  const payoutsDirectory = path.join(__dirname, "payouts");

  // Create payouts directory if it doesn't exist
  if (!fs.existsSync(payoutsDirectory)) {
    fs.mkdirSync(payoutsDirectory, {
      recursive: true,
    });
  }

  const claimData = {
    marketId: MARKET_ID.toString(),

    contractAddress: VEYNT_MARKET_ADDRESS,

    question: market.question,

    winningOutcome,

    verifiedPrice: verifiedPrice.toString(),

    targetPrice: targetPrice.toString(),

    merkleRoot,

    blockNumber: receipt.blockNumber.toString(),

    transactionHash: receipt.transactionHash,

    winners: winnersWithProofs.map((winner) => ({
      bettor: winner.bettor,

      stake: winner.stake,

      payout: winner.payout,

      payoutBot: winner.payoutBot,

      proof: winner.proof,
    })),
  };

  const filePath = path.join(payoutsDirectory, `market-${MARKET_ID}.json`);

  fs.writeFileSync(filePath, JSON.stringify(claimData, null, 2));

  console.log(`\nClaim data saved: ${filePath}`);

  return filePath;
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
    address: VEYNT_MARKET_ADDRESS,
    abi: VEYNT_MARKET_ABI,
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

  const { tree, merkleRoot, winnersWithProofs } =
    createPayoutMerkleTree(payouts);

  console.log("Merkle Root:", merkleRoot);

  console.log("\nGenerated claim proofs:");

  for (const winner of winnersWithProofs) {
    console.log("------------------------------------------");

    console.log(`Winner: ${winner.bettor}`);

    console.log(`Stake: ${winner.stake} wei`);

    console.log(`Payout: ${winner.payout} wei`);

    console.log(`Payout: ${winner.payoutBot} FLR`);

    console.log(`Proof: ${JSON.stringify(winner.proof)}`);
  }

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
  // SAVE CLAIM DATA
  // ==========================================================

  const claimFile = saveClaimData({
    market,
    winningOutcome,
    verifiedPrice,
    targetPrice,
    merkleRoot,
    winnersWithProofs,
    receipt,
  });

  console.log(`Claim file: ${claimFile}`);

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

  console.log(`Claim File:      payouts/market-${MARKET_ID}.json`);

  console.log("\nWinners:");

  for (const winner of winnersWithProofs) {
    console.log(`  ${winner.bettor} → ${winner.payoutBot} BOT`);
  }

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
