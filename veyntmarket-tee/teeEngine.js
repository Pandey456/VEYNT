const { ethers } = require("ethers");
const EthCrypto = require("eth-crypto");
const { MerkleTree } = require("merkletreejs");

const RPC_URL = "https://coston2-api.flare.network/ext/C/rpc";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const MARKET_ID = 1;
const CONTRACT_ADDRESS = "0x";
const TEE_PRIVATE_KEY = "0x";

if (!MARKET_ID) {
  process.exit(1);
}

if (!CONTRACT_ADDRESS) {
  process.exit(1);
}

const abi = [
  "event PredictionPlaced(uint256 indexed marketId, address indexed bettor, uint256 amount, bytes encryptedChoice)",
];

async function stepOneFetchBets(marketId) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
  const filter = contract.filters.PredictionPlaced(marketId);
  const logs = await contract.queryFilter(filter);

  const bets = logs.map((log) => ({
    bettor: log.args.bettor,
    amount: ethers.formatEther(log.args.amount),
    encryptedChoice: log.args.encryptedChoice,
  }));

  return bets;
}

async function decryptBets(eventLogs, teePrivateKey) {
  const decryptedBets = [];

  for (const log of eventLogs) {
    const userAddress = log.args.user;
    const stakeAmount = log.args.stake;
    const encryptedChoiceHex = log.args.encryptedChoice;

    try {
      const encryptedObject = EthCrypto.cipher.parse(encryptedChoiceHex);
      const decryptedString = await EthCrypto.decryptWithPrivateKey(
        teePrivateKey,
        encryptedObject,
      );

      decryptedBets.push({
        user: userAddress,
        stake: stakeAmount,
        choice: decryptedString,
      });
    } catch (error) {
      continue;
    }
  }

  return decryptedBets;
}

async function fetchFDCOutcome(marketId) {
  const DA_LAYER_URL = `https://attestation-coston2.flare.network/fdc/proof?marketId=${marketId}`;

  try {
    const response = await fetch(DA_LAYER_URL);
    const data = await response.json();

    if (data.status !== "CONFIRMED") {
      throw new Error("FDC consensus not reached.");
    }

    const winningOutcome = data.outcomeString;

    return {
      outcome: winningOutcome,
      proof: data.merkleProof,
    };
  } catch (error) {
    process.exit(1);
  }
}

async function calculateAndSignWinners(parsedBets, winningOutcome) {
  let totalPool = 0n;
  let winningPool = 0n;
  const winners = [];

  for (const bet of parsedBets) {
    const stake = BigInt(bet.stake);
    totalPool += stake;

    if (bet.choice.toUpperCase() === winningOutcome.toUpperCase()) {
      winningPool += stake;
      winners.push({ address: bet.user, stake: stake });
    }
  }

  const FEE_PERCENTAGE = 14n;
  const PAYOUT_PERCENTAGE = 100n - FEE_PERCENTAGE;
  const finalWinnerPool = (totalPool * PAYOUT_PERCENTAGE) / 100n;
  const leaves = [];

  if (winners.length > 0) {
    for (const winner of winners) {
      const payout = (winner.stake * finalWinnerPool) / winningPool;
      const leaf = ethers.solidityPackedKeccak256(
        ["address", "uint256"],
        [winner.address, payout],
      );
      leaves.push(leaf);
    }
  }

  const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
  const merkleRoot = leaves.length > 0 ? tree.getHexRoot() : ethers.ZeroHash;

  const wallet = new ethers.Wallet(TEE_PRIVATE_KEY);
  const messageHash = ethers.solidityPackedKeccak256(
    ["uint256", "bytes32", "string"],
    [MARKET_ID, merkleRoot, winningOutcome],
  );

  const signature = await wallet.signMessage(ethers.getBytes(messageHash));

  return { merkleRoot, signature };
}

async function resolveMarket() {
  const rawLogs = await stepOneFetchBets(MARKET_ID);
  const TEE_PRIVATE_KEY_ENV = process.env.TEE_PRIVATE_KEY || TEE_PRIVATE_KEY;
  const parsedBets = await decryptBets(rawLogs, TEE_PRIVATE_KEY_ENV);
  const fdcData = await fetchFDCOutcome(MARKET_ID);
  await calculateAndSignWinners(parsedBets, fdcData.outcome);
}

resolveMarket();
