# VeilMarket

## Confidential prediction markets on Flare

> **VeilMarket is a prototype confidential parimutuel prediction market built on Flare Coston2.**
>
> Users submit encrypted YES/NO predictions, while stake amounts and wallet addresses remain publicly visible on-chain. Markets are resolved using real-world data retrieved through Flare Data Connector (FDC), with an evaluator producing the final outcome, payout allocation, Merkle tree, and TEE-authorized resolution.

**Live demo:** https://veilmarket.adarshpandey.xyz  
**Repository:** https://github.com/Pandey456/VeilMarket  
**Build in public:** https://x.com/pandeyy456

<p align="center">
  <img alt="Solidity" src="https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity" />
  <img alt="Foundry" src="https://img.shields.io/badge/Built%20with-Foundry-black" />
  <img alt="Flare" src="https://img.shields.io/badge/Network-Flare%20Coston2-e62058" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20-339933?logo=node.js" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-blue" />
</p>

---

## ⚠️ Demo Status

VeilMarket is currently a **working Coston2 testnet prototype**, not a production prediction market.

The end-to-end demo flow has been implemented and tested:

- [x] Create markets from the frontend
- [x] Create markets with FTSO-derived FLR/USD fee calculation
- [x] Place YES/NO predictions
- [x] Restrict each wallet to one prediction per market
- [x] Encrypt prediction choices client-side
- [x] Store encrypted predictions on-chain
- [x] Retrieve the encrypted bettor list during evaluation
- [x] Resolve crypto-price markets using FDC Web2Json
- [x] Determine the winning side from the verified price
- [x] Calculate proportional payouts
- [x] Build a Merkle tree for winning bettors
- [x] Generate individual Merkle proofs
- [x] Sign the resolution payload with the configured TEE signing key
- [x] Verify the TEE signature on-chain
- [x] Store the Merkle root on-chain
- [x] Generate claim data for winners
- [x] Publish payout JSON through GitHub Actions
- [x] Allow winners to claim using a Merkle proof
- [x] Provide an emergency refund path for unresolved markets

### What is not production-ready

- The evaluator currently runs through GitHub Actions for the public demo.
- The signing key and prediction-decryption key are supplied to the evaluator through GitHub Actions secrets.
- The current implementation should **not** be treated as a production-grade hardware TEE deployment.
- The system has not been independently audited.
- The current demo is intended to demonstrate the architecture and end-to-end mechanics on Coston2.

---

# The Problem

Traditional prediction markets expose a user's position publicly.

If a user sees:

```text
Alice → YES → 100 FLR
Bob   → YES → 500 FLR
Charlie → NO → 2 FLR
```

they can infer market sentiment and potentially follow large positions.

This creates:

- herding bias
- copy trading
- information leakage
- strategic behavior based on other users' positions

VeilMarket attempts to hide the **prediction direction** while keeping the settlement verifiable.

### What is private?

The prediction:

```text
YES
```

or:

```text
NO
```

is encrypted before it reaches the blockchain.

### What remains public?

The following are inherently visible on an EVM chain:

- wallet address
- transaction
- stake amount
- market ID
- encrypted prediction ciphertext
- transaction timestamp
- contract address

VeilMarket therefore does **not** claim that the entire bet is private.

The specific goal is:

> **Hide the prediction direction until the market resolves.**

---

# Architecture

VeilMarket currently combines four major components.

```text
                    ┌─────────────────────────┐
                    │       Frontend           │
                    │  veilmarket.adarsh...   │
                    └────────────┬────────────┘
                                 │
                     Encrypt YES / NO
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   VeilMarket Contract   │
                    │      Flare Coston2      │
                    └──────┬─────────┬────────┘
                           │         │
                  encrypted bets     │
                           │         │
                           ▼         ▼
                    ┌──────────┐  ┌──────────┐
                    │Evaluator │  │  FDC     │
                    │GitHub    │  │Web2Json  │
                    │Actions   │  │          │
                    └────┬─────┘  └────┬─────┘
                         │             │
                         │ decrypt     │ verified
                         │ predictions│ response
                         └──────┬──────┘
                                │
                         determine winner
                                │
                         calculate payouts
                                │
                         Merkle tree
                                │
                         TEE signature
                                │
                                ▼
                    ┌─────────────────────────┐
                    │    resolveMarket()      │
                    │   Signature verified    │
                    │   Merkle root stored    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │ claimPayout() │
                         │ Merkle proof  │
                         └───────────────┘
```

---

# Confidential Prediction Flow

## 1. User chooses YES or NO

The frontend never sends plaintext:

```text
YES
```

or:

```text
NO
```

to the contract.

Instead, the choice is encrypted client-side.

The current prototype uses:

**RSA-OAEP with SHA-256**

The public encryption key is safe to expose in the frontend.

The corresponding private decryption key is kept outside the frontend and supplied to the evaluator as:

```text
PREDICTION_PRIVATE_KEY
```

### Encryption flow

```text
User choice
    │
    ▼
"YES"
    │
    ▼
RSA-OAEP(SHA-256)
    │
    │ public key
    ▼
256-byte ciphertext
    │
    ▼
predict(marketId, encryptedChoice)
    │
    ▼
Flare Coston2
```

A block explorer can therefore see the ciphertext, but cannot simply UTF-8 decode it back to `YES` or `NO`.

---

# Market Lifecycle

## 1. Create Market

A user connects a wallet and creates a market.

The frontend presents the question in a structured form such as:

```text
Will the price of BTC be above $65,000 after 5 minutes?
```

Internally the evaluator uses a normalized representation:

```text
BTC|ABOVE|6500000000000
```

The price uses 8 decimal places:

```text
65000 USD
→
6500000000000
```

The deadline is stored as a Unix timestamp.

The market also stores the API endpoint used by the evaluator/FDC request.

---

## 2. Place Prediction

A user enters a stake and chooses:

```text
YES
```

or:

```text
NO
```

The frontend encrypts the choice and calls:

```solidity
predict(
    uint256 marketId,
    bytes encryptedChoice
)
```

The contract:

1. verifies the market exists
2. verifies the market has not expired
3. requires a non-zero stake
4. records the user's stake
5. emits the encrypted prediction

The prediction itself is not stored as plaintext.

### One prediction per wallet

The current demo treats one wallet as one predictor per market.

This avoids a user creating multiple prediction entries from the same wallet for the same market.

---

# FDC Resolution

For the current crypto-price demo, Flare Data Connector's **Web2Json** attestation flow is used to retrieve Binance market data.

Example endpoint:

```text
https://data-api.binance.vision/api/v3/klines
```

The evaluator constructs an FDC request using:

```text
symbol = BTCUSDT
interval = 1m
startTime = market deadline
limit = 1
```

The response is post-processed into an integer price with 8 decimal places.

Example:

```text
$64,540
```

becomes:

```text
6454000000000
```

The evaluator then compares the verified price with the market target.

Example:

```text
Target:  $65,000
Actual:  $65,122

Condition: ABOVE

Result: YES
```

For a `BELOW` market:

```text
Target:  $65,000
Actual:  $64,500

Condition: BELOW

Result: YES
```

---

# Evaluation Engine

The evaluation engine lives in:

```text
veilmarket-tee/evaluator.js
```

For the current demo it is executed through GitHub Actions.

The evaluator performs the following sequence:

```text
1. Read market from contract
        ↓
2. Parse question
        ↓
3. Request FDC/Web2Json data
        ↓
4. Determine winning side
        ↓
5. Fetch bettors/predictions
        ↓
6. Decrypt YES/NO predictions
        ↓
7. Split bettors into winning/losing pools
        ↓
8. Calculate proportional payouts
        ↓
9. Create Merkle tree
        ↓
10. Generate winner proofs
        ↓
11. Sign marketId + MerkleRoot + outcome
        ↓
12. Call resolveMarket()
        ↓
13. Save payout data
```

---

# Merkle-Based Payouts

Instead of storing every user's payout directly in the contract, the evaluator creates a Merkle tree.

Each winner becomes a leaf containing:

```text
wallet address
+
payout amount
```

Conceptually:

```text
Leaf =
hash(walletAddress, payout)
```

The tree produces:

```text
Merkle Root
```

Only the root is stored in the market contract.

Example:

```text
Merkle Root:
0x130905010a119e10127872011800327ba448494e1d0aba13fee2044e1f320cc7
```

The evaluator also generates an individual proof for each winner.

Example claim data:

```json
{
  "marketId": 5,
  "bettor": "0x...",
  "payout": "12900000000000000000",
  "proof": [
    "0x..."
  ]
}
```

This allows the contract to verify:

> "This wallet + this payout is part of the Merkle tree authorized for this market."

without storing every payout on-chain.

---

# TEE Authorization

The Merkle root alone does **not** authorize a market resolution.

The evaluator creates:

```text
keccak256(
    marketId,
    merkleRoot,
    winningOutcome
)
```

The configured TEE signing account signs that hash.

The contract recovers the signer and compares it with the trusted TEE signer configured in the contract.

Conceptually:

```text
Evaluator
    │
    ├── marketId
    ├── merkleRoot
    └── winningOutcome
            │
            ▼
       message hash
            │
            ▼
      TEE private key
            │
            ▼
        signature
            │
            ▼
      resolveMarket()
            │
            ▼
    recover signer
            │
            ▼
       trusted TEE?
       /          \
     YES           NO
      │             │
      ▼             ▼
 resolve         revert
```

This prevents an arbitrary evaluator using a different private key from resolving the market.

---

# Payout and Fee Distribution

VeilMarket uses a parimutuel pool model. Once a market is resolved, the total market pool is distributed according to the following fixed allocation:

| Allocation | Share | Recipient |
|---|---:|---|
| Winning bettors | 86% | Distributed proportionally among winning bettors |
| Market creator | 10% | Creator of the market |
| Platform | 3% | VeilMarket platform treasury |
| Resolver | 1% | Account that submits the market resolution |

The full pool is therefore allocated as:

```text
86%  Winning bettors
10%  Market creator
 3%  Platform
 1%  Resolver
--------------------
100% Total pool
```

### Example

For a market with a total pool of 15 FLR:

```text
Winning bettors = 12.90 FLR
Market creator  =  1.50 FLR
Platform        =  0.45 FLR
Resolver        =  0.15 FLR
--------------------------------
Total           = 15.00 FLR
```

The 86% winning allocation is divided proportionally according to the stake of each winning bettor.

For example, if the winning side contains:

```text
Winner A = 8 FLR
Winner B = 2 FLR

Winning pool = 10 FLR
```

then Winner A owns 80% of the winning pool and Winner B owns 20%.

They therefore receive:

```text
Winner A → 80% of 12.90 FLR = 10.32 FLR
Winner B → 20% of 12.90 FLR =  2.58 FLR
```

The market creator, platform, and resolver allocations are separate from the winning bettors' proportional allocation.

# Claiming Winnings

After the market is resolved:

```text
Market
  ↓
Merkle root stored on-chain
  ↓
Evaluator generates payout JSON
  ↓
Payout JSON published to repository
  ↓
Frontend retrieves user's claim data
  ↓
User clicks Claim
  ↓
claimPayout()
```

The contract reconstructs the leaf from:

```text
msg.sender
+
payout
```

and verifies the supplied Merkle proof against the stored root.

A valid proof is required before the payout is released.

The contract also prevents the same wallet from claiming the same market payout twice.

---

# Emergency Refund

If a market cannot be resolved, the contract provides an emergency refund path after the configured resolution grace period.

This is intended to prevent user funds from becoming permanently inaccessible because the external evaluation pipeline stopped functioning.

---

# Smart Contract API

The main contract is:

```text
VeilMarket.sol
```

### Write functions

| Function | Purpose |
|---|---|
| `createMarket(...)` | Creates a new prediction market |
| `predict(uint256, bytes)` | Places a stake with an encrypted prediction |
| `resolveMarket(uint256, bytes32, string, bytes)` | Stores the authorized outcome and Merkle root |
| `claimPayout(uint256, uint256, bytes32[])` | Claims a verified winner payout |
| `emergencyRefund(uint256)` | Reclaims stake after the emergency-refund conditions are met |
| `withdrawTreasury(address)` | Owner treasury withdrawal |
| `transferOwnership(address)` | Transfers contract ownership |

### Important view functions

| Function | Purpose |
|---|---|
| `markets(uint256)` | Returns market information |
| `stakeOf(uint256,address)` | Returns a user's stake |
| `getPrediction(uint256,address)` | Returns the user's encrypted prediction |
| `getBettors(uint256)` | Returns bettors associated with a market |
| `marketCount()` | Returns the number of markets |
| `getRequiredFee()` | Returns the current market-creation fee |

---

# Key Management

There are two different cryptographic key purposes.

## TEE signing key

```text
TEE_PRIVATE_KEY
```

Used to:

```text
sign marketId + MerkleRoot + outcome
```

The corresponding Ethereum address must match the trusted TEE signer configured in the deployed contract.

## Prediction decryption key

```text
PREDICTION_PRIVATE_KEY
```

Used to decrypt RSA-OAEP encrypted YES/NO predictions.

This key must **never** be exposed in:

- frontend JavaScript
- `index.html`
- browser storage
- public GitHub files
- transaction calldata
- logs

For the demo, both secrets are injected into GitHub Actions as repository secrets.

---

# GitHub Actions Resolution

The demo uses a manually triggered GitHub workflow:

```text
.github/workflows/fdc-full-run.yml
```

The workflow accepts:

```text
market_id
```

and runs:

```bash
node veilmarket-tee/evaluator.js
```

The required secrets include:

```text
PRIVATE_KEY
TEE_PRIVATE_KEY
PREDICTION_PRIVATE_KEY
VEIL_MARKET_ADDRESS
```

After evaluation, the workflow publishes:

```text
veilmarket-tee/payouts/market-X.json
```

back to the repository.

The frontend can then retrieve the payout data and construct the claim transaction.

---

# Frontend

The current demo frontend is a lightweight HTML/JavaScript application.

Live:

https://veilmarket.adarshpandey.xyz

The interface provides:

- wallet connection
- market cards
- market creation
- BTC price market creation
- YES/NO prediction
- stake input
- deadline countdown
- resolution controls
- claim controls
- transaction status
- wallet-aware payout claiming

The frontend deliberately hides evaluator infrastructure such as:

- FDC request construction
- API endpoint configuration
- TEE signing
- GitHub workflow internals
- Merkle tree generation

Those are evaluation/settlement concerns rather than user-facing market configuration.

---

# Current Demo Example

A typical market can be created as:

```text
Will the price of BTC be above $65,000 after 5 minutes?
```

Internally:

```text
BTC|ABOVE|6500000000000
```

Users may then submit:

```text
YES
```

or:

```text
NO
```

with a FLR stake.

At expiry:

```text
FDC → BTC price
       ↓
Evaluator → winning side
       ↓
Decrypt predictions
       ↓
Calculate winning pool
       ↓
Calculate payouts
       ↓
Merkle tree
       ↓
TEE signature
       ↓
resolveMarket()
       ↓
Winner claims payout
```

---

# Repository Structure

```text
VeilMarket/
│
├── contracts/
│   └── VeilMarket.sol
│
├── script/
│   └── DeployVeilMarket.s.sol
│
├── test/
│   └── VeilMarket.t.sol
│
├── veilmarket-tee/
│   ├── evaluator.js
│   ├── fdc-run.js
│   ├── constants.js
│   └── payouts/
│       ├── market-1.json
│       ├── market-2.json
│       └── ...
│
├── .github/
│   └── workflows/
│       └── fdc-full-run.yml
│
├── index.html
├── foundry.toml
├── package.json
└── README.md
```

---

# Development Setup

## Prerequisites

Install:

- Node.js 20+
- Foundry
- Git
- A Coston2-compatible wallet
- Coston2 testnet FLR for testing

---

## Clone

```bash
git clone https://github.com/Pandey456/VeilMarket.git
cd VeilMarket
```

---

## Install Node dependencies

```bash
npm install
```

The evaluator currently relies on packages including:

```text
viem
@openzeppelin/merkle-tree
```

---

## Build Solidity contracts

```bash
forge build
```

---

## Run tests

```bash
forge test -vvv
```

---

# Flare Coston2

The current demo runs on:

```text
Flare Coston2
Chain ID: 114
```

RPC:

```text
https://coston2-api.flare.network/ext/C/rpc
```

The project is intentionally deployed to testnet while the architecture is being validated.

---

# Transparency vs Confidentiality

VeilMarket does not attempt to hide everything.

### Public

```text
Wallet address
Stake amount
Market ID
Transaction
Encrypted prediction
Deadline
Market outcome after resolution
Merkle root
Claim transaction
```

### Confidential before resolution

```text
YES / NO prediction
```

The core objective is therefore not:

> "Make the entire prediction market invisible."

It is:

> **"Prevent other market participants from seeing which side you selected before resolution."**

---

# Security Considerations

### Prediction encryption

The RSA private decryption key must remain secret.

If:

```text
PREDICTION_PRIVATE_KEY
```

is compromised, encrypted predictions can be decrypted.

### TEE signing authority

The TEE signing key is the authorization mechanism for `resolveMarket()`.

A compromised TEE signing key could potentially authorize a malicious resolution.

### GitHub Actions

The current demo uses GitHub Actions as the evaluator execution environment.

This is convenient for a public prototype but is not equivalent to a hardened production confidential-compute deployment.

### Merkle payouts

The Merkle root commits the evaluator's payout set.

Users can independently verify that their:

```text
address + payout
```

matches the root through their Merkle proof.

### Smart contract

The contract has not been independently audited.

**Do not use this deployment for real funds.**

---

# Known Prototype Limitations

1. **GitHub Actions is currently the evaluator execution layer.**
2. **The TEE architecture is represented by a trusted signing/decryption key boundary; a production hardware-enclave deployment is still a future step.**
3. **The FDC result is consumed by the evaluator before the signed resolution is submitted.**
4. **The frontend is intentionally lightweight and currently implemented as HTML/JavaScript.**
5. **The system is running on Flare Coston2 testnet.**
6. **No independent security audit has been completed.**
7. **The current demo focuses on binary YES/NO prediction markets.**
8. **BTC is currently the primary supported asset in the frontend market builder.**

---

# Roadmap

## Phase 1 — Core Market

- [x] Parimutuel pool
- [x] Market creation
- [x] FLR staking
- [x] Deadline enforcement
- [x] One prediction per wallet
- [x] Emergency refund
- [x] Owner/treasury functionality

## Phase 2 — Confidential Predictions

- [x] Client-side encryption
- [x] RSA-OAEP prediction ciphertext
- [x] Encrypted prediction stored on-chain
- [x] Evaluator-side decryption
- [x] Prediction direction hidden from block explorers

## Phase 3 — Verifiable Resolution

- [x] FDC Web2Json request
- [x] Binance BTC price retrieval
- [x] Deadline-based price query
- [x] Winning-side calculation
- [x] TEE authorization signature
- [x] On-chain signature verification

## Phase 4 — Payouts

- [x] Winning pool calculation
- [x] Pro-rata payout calculation
- [x] Merkle tree generation
- [x] Merkle proof generation
- [x] On-chain Merkle root
- [x] Claim payout
- [x] Claim protection against duplicate claims
- [x] Payout JSON publication

## Phase 5 — Production Hardening

- [ ] Deploy evaluator inside a hardened confidential-compute environment
- [ ] Hardware-backed key management
- [ ] Remove GitHub Actions as the trust boundary
- [ ] Independent smart-contract audit
- [ ] Formalize FDC proof verification architecture
- [ ] Improve decentralized resolution/keeper model
- [ ] Add additional asset feeds
- [ ] Add sports and real-world event resolution
- [ ] Improve monitoring and failure recovery
- [ ] Mainnet deployment

---

# Design Principles

### 1. Hide the decision, not the transaction

The blockchain should still provide transparent evidence that a bet happened.

### 2. Don't store unnecessary payout state on-chain

Merkle proofs allow the contract to commit to a complete payout set using a single root.

### 3. Separate truth from settlement

FDC provides external data.

The evaluator interprets that data and constructs the payout state.

The contract verifies that the authorized evaluator signed the resulting resolution.

### 4. Keep private keys outside the client

The browser gets the public encryption key.

Private decryption/signing keys stay in the evaluator environment.

---

# Build in Public

VeilMarket is being developed publicly.

Development updates, experiments, debugging sessions, and architecture decisions are shared on X:

**[@pandeyy456](https://x.com/pandeyy456)**

The goal is to document the process of taking a confidential prediction-market idea from a smart-contract prototype to a working end-to-end testnet application.

---

# About the Name

The project currently uses **VeilMarket** because that is the repository and deployed prototype name.

However, the name is not ideal for a long-term product brand.

There are already other projects/products using closely related names, including prediction-market projects using **VEIL**, so a future rename would reduce brand confusion.

For the **hackathon/demo stage**, I recommend keeping:

```text
VeilMarket
```

to avoid unnecessary migration work.

Before a public production launch, the project should choose a more distinctive name and migrate:

- repository
- contract naming where appropriate
- frontend branding
- domain/subdomain
- social handles
- documentation

---
# Future Scope

The current prototype focuses on BTC price prediction markets. The next stage of development will expand the platform beyond a single asset and introduce additional utility for longer-duration markets.

## 1. Expanded Assets and Real-World Markets

The platform will be expanded to support prediction markets across a broader range of assets and real-world events.

Planned categories include:

- Additional cryptocurrencies and token price markets
- Traditional financial assets
- Sports and event-based outcomes
- Other real-world scenarios that can be resolved using verifiable external data

The goal is to make the market creation system flexible enough that a market can be created around any supported event or data source, rather than being limited to BTC price predictions.

## 2. Yield Generation for Long-Duration Markets

For markets with a deadline longer than 15 days, the capital accumulated in the market will have an additional use during the waiting period.

Instead of leaving the prediction pool idle, the accumulated funds may be deployed into supported lending protocols to generate yield.

The intended flow is:

```text
Users place predictions
        ↓
Market pool accumulates
        ↓
Deadline > 15 days
        ↓
Pool is deployed into supported lending protocols
        ↓
Yield is generated during the market duration
        ↓
Market reaches its deadline
        ↓
Market is resolved
        ↓
Principal is returned to the market
        ↓
Generated yield is distributed among
the participants of that market

```
---

# License

Licensed under the MIT License.

---

## Built on Flare Coston2

**Built in public by Adarsh Pandey.**

The current objective is simple:

> **Make prediction markets less predictable from the outside.**
