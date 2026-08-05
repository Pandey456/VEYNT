const { decodeAbiParameters, parseAbiParameters } = require("viem");
const { main: runFdc } = require("./fdc-run.js");

// =========================================================================
// 🛠️ TEST CONFIGURATION BLOCK (Modify these values to test different scenarios)
// =========================================================================
const TEST_CONFIG = {
  // Target price in USD (e.g. 65000 or 70000)
  targetPriceUsd: 65000,

  // Prediction Direction: "ABOVE" or "BELOW"
  direction: "ABOVE",

  // Automatically scales targetPriceUsd to 10^8 format to match Binance/FDC precision
  get targetPriceScaled() {
    return BigInt(this.targetPriceUsd) * 100000000n;
  },
};
// =========================================================================

async function evaluateTest() {
  console.log("\n==================================================");
  console.log("===      RUNNING TEE EVALUATOR (TEST MODE)     ===");
  console.log("==================================================");

  // 1. RUN FDC-RUN.JS TO GET THE VERIFIED PRICE FROM FLARE
  console.log("\n[1/3] Triggering FDC attestation via fdc-run.js...");
  const proofData = await runFdc();

  if (!proofData || !proofData.response || !proofData.response.responseBody) {
    throw new Error("FDC execution failed: No valid proof data returned.");
  }

  // Extract the raw hex string returned by FDC validators
  const fdcAbiEncodedData = proofData.response.responseBody.abiEncodedData;
  console.log(`[1/3] Raw FDC Hex Data Received: ${fdcAbiEncodedData}`);

  // 2. DECODE THE FDC HEX DATA INTO A REAL NUMBER
  console.log("\n[2/3] Decoding FDC price data...");
  const [{ price: verifiedPrice }] = decodeAbiParameters(
    parseAbiParameters("(uint256 price)"),
    fdcAbiEncodedData,
  );

  const verifiedPriceUsd = Number(verifiedPrice) / 1e8;
  console.log(
    `[2/3] FDC Verified Price: $${verifiedPriceUsd.toLocaleString()}`,
  );

  // 3. COMPARE FDC PRICE AGAINST TEST PARAMETERS
  console.log("\n[3/3] Evaluating market condition...");
  console.log(`Target Price:  $${TEST_CONFIG.targetPriceUsd.toLocaleString()}`);
  console.log(
    `Condition:     Price must be ${TEST_CONFIG.direction} target price`,
  );

  let winningOutcome;
  if (TEST_CONFIG.direction === "ABOVE") {
    winningOutcome =
      verifiedPrice >= TEST_CONFIG.targetPriceScaled ? "YES" : "NO";
  } else if (TEST_CONFIG.direction === "BELOW") {
    winningOutcome =
      verifiedPrice <= TEST_CONFIG.targetPriceScaled ? "YES" : "NO";
  } else {
    throw new Error(`Invalid direction: ${TEST_CONFIG.direction}`);
  }

  // 4. PRINT CLEAR RESULTS FOR GITHUB ACTIONS LOGS
  console.log("\n==================================================");
  console.log("===                TEST RESULT                 ===");
  console.log("==================================================");
  console.log(`FDC Price:     $${verifiedPriceUsd.toLocaleString()}`);
  console.log(`Target:        $${TEST_CONFIG.targetPriceUsd.toLocaleString()}`);
  console.log(`Condition:     ${TEST_CONFIG.direction}`);
  console.log(`--------------------------------------------------`);
  console.log(`🏆 WINNING SIDE: [ ${winningOutcome} ]`);
  console.log("==================================================\n");
}

evaluateTest().catch((error) => {
  console.error("\n❌ TEST EVALUATION FAILED:", error.message);
  process.exit(1);
});
