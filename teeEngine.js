import { ethers } from "ethers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

// Minimal ABI required for the TEE to interact with VeilMarket.sol
const VEIL_MARKET_ABI = [
  "function questions(uint256) view returns (string ipfsHash, uint256 totalPool, uint256 endTime, bool resolved)",
  "event BetPlaced(uint256 indexed marketId, address indexed bettor, uint256 amount, bytes encryptedChoice)",
];

async function runTEEEngine() {
  const rpcUrl = process.env.FLARE_RPC_URL;
  const privateKey = process.env.TEE_PRIVATE_KEY;
  const marketAddress = process.env.VEIL_MARKET_ADDRESS;
  const marketId = process.env.MARKET_ID || "1"; // Default to market 1

  if (!rpcUrl || !privateKey || !marketAddress) {
    console.error("❌ Missing required environment variables.");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const teeWallet = new ethers.Wallet(privateKey, provider);
  const marketContract = new ethers.Contract(
    marketAddress,
    VEIL_MARKET_ABI,
    provider,
  );

  console.log(`\n🔒 [TEE Enclave Activated]`);
  console.log(`📍 TEE Address: ${teeWallet.address}`);
  console.log(`📡 Target Contract: ${marketAddress}`);

  // ==========================================
  // STEP 1: TRIGGER FDC / WEB2 API FOR OUTCOME
  // ==========================================
  console.log(`\n🌐 Fetching real-world outcome for Market #${marketId}...`);
  // MOCK FDC/Web2 API Call (e.g., fetching a sports score or crypto price)
  // In reality, you would use fetch('https://api.coingecko.com/...') here
  const verifiedOutcome = "YES";
  console.log(`🏆 Verified Winning Outcome: ${verifiedOutcome}`);

  // ==========================================
  // STEP 2: FETCH & DECRYPT BETS OFF-CHAIN
  // ==========================================
  console.log(`\n🔍 Scanning blockchain for BetPlaced events...`);
  const filter = marketContract.filters.BetPlaced(marketId);
  const betEvents = await marketContract.queryFilter(filter);

  if (betEvents.length === 0) {
    console.log("⚠️ No bets found for this market. Exiting.");
    return;
  }

  let totalWinningStake = 0n;
  const userStakes = {};

  for (const event of betEvents) {
    const { bettor, amount, encryptedChoice } = event.args;

    // 🔒 DECRYPTION HAPPENS HERE (Inside secure hardware RAM)
    // We mock the decryption for the hackathon.
    // Real logic: const choice = decrypt(encryptedChoice, teePrivateKey);
    const decryptedChoice = "YES"; // Mocking that this user chose "YES"

    if (decryptedChoice === verifiedOutcome) {
      userStakes[bettor] = (userStakes[bettor] || 0n) + BigInt(amount);
      totalWinningStake += BigInt(amount);
    }
  }

  // ==========================================
  // STEP 3: CALCULATE EXACT 86% PAYOUTS
  // ==========================================
  const market = await marketContract.questions(marketId);
  const totalPool = BigInt(market.totalPool);
  const finalWinnerPool = (totalPool * 86n) / 100n; // 86% goes to winners, 14% kept

  console.log(`\n💰 Total Pool: ${ethers.formatEther(totalPool)} FLR`);
  console.log(
    `💸 Winner Pool (86%): ${ethers.formatEther(finalWinnerPool)} FLR`,
  );

  const winnersArray = [];
  for (const [bettor, stake] of Object.entries(userStakes)) {
    // Proportional Payout = (User Stake / Total Winning Stake) * Final Winner Pool
    const payout = (stake * finalWinnerPool) / totalWinningStake;
    winnersArray.push([bettor, payout.toString()]);
    console.log(`   🏆 Winner: ${bettor} -> ${ethers.formatEther(payout)} FLR`);
  }

  // ==========================================
  // STEP 4: GENERATE MERKLE TREE & SIGN
  // ==========================================
  console.log(`\n🌲 Constructing Merkle Tree...`);
  const tree = StandardMerkleTree.of(winnersArray, ["address", "uint256"]);
  const merkleRoot = tree.root;

  const messageHash = ethers.solidityPackedKeccak256(
    ["uint256", "bytes32", "string"],
    [marketId, merkleRoot, verifiedOutcome],
  );

  const signature = await teeWallet.signMessage(ethers.getBytes(messageHash));

  console.log(`✅ TEE Resolution Complete!`);
  console.log(`🌲 Merkle Root: ${merkleRoot}`);
  console.log(`🔑 Signature:   ${signature}\n`);
}

runTEEEngine().catch((err) => {
  console.error("❌ TEE Execution Failed:", err);
  process.exit(1);
});
