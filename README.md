# Veynt

## Confidential prediction markets with FDC-powered resolution on BOT Chain

> Veynt is a prototype confidential prediction market where users can take positions on binary outcomes without publicly revealing whether they selected YES or NO before the market is resolved.

Veynt combines encrypted predictions, Flare Data Connector (FDC) data retrieval, an off-chain evaluator, TEE-authorized resolution, and Merkle-based payouts.

The market itself is created, funded, and resolved on BOT Chain. For supported price-based markets, external price data is retrieved through Flare's Data Connector and passed into the evaluator. The evaluator determines the outcome and prepares the settlement data before submitting the authorized resolution back to BOT Chain.

**Live application:**  
https://veyntmarket.adarshpandey.xyz/

**Repository:**  
https://github.com/Pandey456/VEYNT

---

## Project Status

Veynt is currently a **testnet prototype** intended to demonstrate the complete prediction-market lifecycle.

The system currently supports:

**Market & Staking**

- Market creation on BOT Chain
- Fixed market creation fee of 1 BOT
- Native BOT staking
- Binary YES/NO predictions

**Confidentiality**

- Client-side RSA-OAEP encryption of predictions
- Encrypted prediction storage on-chain

**Data & Resolution**

- Off-chain market evaluation
- FDC-powered external price retrieval
- Price-based market resolution
- TEE-authorized resolution

**Payouts**

- Proportional winner payouts
- Merkle tree-based payout verification
- Individual Merkle proofs for winners
- On-chain claim verification
- Emergency refund handling

**Infrastructure**

- GitHub Actions-based evaluator execution

The project is **not production-ready** and should not be used with funds that cannot be lost.

There has not yet been an independent security audit or a production-grade confidential-computing deployment.

---

# The Problem

Traditional prediction markets expose a user's prediction direction.

For example, a public market may effectively reveal:

```text
Alice    → YES → 100 BOT
Bob      → YES → 500 BOT
Charlie  → NO  → 20 BOT
```

Even when the market itself is transparent, exposing the prediction direction before resolution can influence subsequent participants.

This can lead to:

- Herding
- Copy trading
- Information leakage
- Strategic behavior based on other participants
- Distorted market sentiment

Veynt takes a different approach.

The transaction and stake remain visible on-chain, but the actual prediction direction is encrypted until the evaluation process takes place.

The objective is simple:

> Hide the prediction direction while keeping the market settlement verifiable.

---

# What Is Private?

A user selects:

```text
YES
```

or:

```text
NO
```

The prediction is encrypted in the browser before it is submitted to the smart contract.

The current implementation uses:

```text
RSA-OAEP
SHA-256
```

The frontend uses the public encryption key.

The corresponding private decryption key is kept outside the frontend and supplied only to the evaluator environment.

---

# What Remains Public?

Veynt does not claim to make the entire prediction market private.

An EVM blockchain still exposes information such as:

- Wallet address
- Transaction
- Stake amount
- Market ID
- Contract address
- Deadline
- Encrypted prediction ciphertext
- Resolution transaction
- Market outcome after resolution
- Merkle root

The key distinction is:

```text
Public:
    Alice placed 10 BOT

Not publicly revealed before evaluation:
    Alice selected YES
```

The purpose is therefore not full transaction privacy.

It is prediction-direction confidentiality.

---

# Architecture

The current architecture separates the blockchain settlement layer from the external-data and evaluation layer.

```text
                    ┌──────────────────────────┐
                    │         Frontend         │
                    │                          │
                    │ veyntmarket.adarsh...    │
                    └────────────┬─────────────┘
                                 │
                         Encrypt YES / NO
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │     VeyntMarket.sol      │
                    │        BOT Chain         │
                    └────────────┬─────────────┘
                                 │
                    Encrypted predictions
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │       Evaluator          │
                    │      GitHub Actions      │
                    └────────────┬─────────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
                  ▼                             ▼
        ┌──────────────────┐          ┌──────────────────┐
        │       FDC        │          │  Prediction      │
        │   Flare Data     │          │   Decryption     │
        │    Connector     │          │   Private Key    │
        └────────┬─────────┘          └────────┬─────────┘
                 │                             │
          Verified external                YES / NO
             price data                       │
                 │                             │
                 └──────────────┬──────────────┘
                                │
                                ▼
                       Determine outcome
                                │
                                ▼
                       Calculate payouts
                                │
                                ▼
                         Merkle tree
                                │
                                ▼
                         TEE signature
                                │
                                ▼
                    ┌──────────────────────────┐
                    │     BOT Chain            │
                    │    resolveMarket()       │
                    │                          │
                    │  Outcome + Merkle Root  │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                         claimPayout()
```

The important distinction is that **FDC is used as the source of external data, while BOT Chain is the settlement and resolution chain.**

---

# Market Lifecycle

## 1. Create a Market

A user connects a wallet and creates a prediction market through the Veynt frontend.

A market contains information such as:

```text
Question
Deadline
Data/API endpoint
```

For example:

```text
Will BTC be above $65,000 at the market deadline?
```

The market is created directly on BOT Chain.

### Market Creation Fee

The current Veynt implementation uses a fixed creation fee:

```text
1 BOT
```

The user pays 1 BOT when creating a market.

This fixed fee keeps market creation simple and predictable while avoiding the need for an external price feed for fee calculation.

The user simply pays:

```text
1 BOT
```

when creating a market.

---

# 2. Place a Prediction

A user chooses:

```text
YES
```

or:

```text
NO
```

The frontend does not submit the plaintext prediction.

Instead:

```text
User choice
     |
     v
"YES"
     |
     v
RSA-OAEP
SHA-256
     |
     v
Encrypted ciphertext
     |
     v
predict(marketId, encryptedChoice)
     |
     v
BOT Chain
```

The contract stores the encrypted prediction.

The current implementation allows one prediction per wallet for a given market.

---

# 3. Market Reaches Its Deadline

Once the market reaches its deadline, the evaluator begins the resolution process.

For a price-based market, the evaluator needs the relevant external price at the specified market deadline.

This is where Flare Data Connector is used.

---

# FDC-Powered Price Resolution

Veynt uses Flare Data Connector to retrieve externally sourced data for supported markets.

The current flow is:

```text
BOT Chain market
       |
       | market question + deadline
       v
Evaluator
       |
       v
FDC request
       |
       v
External data source
       |
       v
FDC attested response
       |
       v
Evaluator
       |
       v
Determine winning outcome
       |
       v
BOT Chain resolution
```

The important architectural point is:

> FDC provides the external data used by the evaluator. BOT Chain remains the chain where the Veynt market exists and where the final authorized resolution is recorded.

For example, a market could represent:

```text
Will BTC be above $65,000 at the deadline?
```

The evaluator obtains the relevant BTC price through the FDC flow and compares it against the market condition.

Conceptually:

```text
Target:  $65,000
Actual:  $65,122

Condition: ABOVE

Result: YES
```

For a BELOW market:

```text
Target:  $65,000
Actual:  $64,500

Condition: BELOW

Result: YES
```

The external data is therefore used to determine the result, while the resulting market state is committed to BOT Chain.

---

# Evaluation Engine

The evaluator is located in:

```text
veyntmarket-tee/evaluator.js
```

The current public prototype executes the evaluator through GitHub Actions.

The evaluator performs the following process:

```text
1. Read market from BOT Chain
        |
        v
2. Read market configuration
        |
        v
3. Request external data through FDC
        |
        v
4. Determine the winning side
        |
        v
5. Retrieve bettors from BOT Chain
        |
        v
6. Retrieve encrypted predictions
        |
        v
7. Decrypt YES / NO predictions
        |
        v
8. Separate winning and losing bettors
        |
        v
9. Calculate proportional payouts
        |
        v
10. Build Merkle tree
        |
        v
11. Generate individual winner proofs
        |
        v
12. Sign resolution data
        |
        v
13. Call resolveMarket() on BOT Chain
        |
        v
14. Publish payout data
```

---

# Prediction Decryption

The frontend uses the public prediction key to encrypt the prediction.

The evaluator uses the corresponding private key to decrypt it.

The two keys have completely different purposes.

### Frontend

```text
PREDICTION_PUBLIC_KEY
```

Used for:

```text
YES / NO
     |
     v
RSA-OAEP
     |
     v
Encrypted prediction
```

### Evaluator

```text
PREDICTION_PRIVATE_KEY
```

Used to recover:

```text
Encrypted prediction
     |
     v
RSA-OAEP / SHA-256
     |
     v
YES / NO
```

The private key must never be included in the frontend.

---

# TEE Authorization

The evaluator does not simply send an arbitrary outcome to the contract.

The resolution is authorized through a trusted signing key.

The evaluator constructs a resolution payload containing:

```text
marketId
MerkleRoot
winningOutcome
```

The payload is signed by the configured TEE signing key.

Conceptually:

```text
Evaluator
    |
    ├── marketId
    ├── MerkleRoot
    └── outcome
           |
           v
      Message Hash
           |
           v
     Signing Key
           |
           v
       Signature
           |
           v
   resolveMarket()
           |
           v
   Signature Verification
           |
       ┌───┴───┐
       │       │
      Valid   Invalid
       │       │
       v       v
    Resolve   Revert
```

The smart contract verifies that the signer corresponds to the trusted signer configured in the contract.

### Important Prototype Limitation

The current implementation uses a trusted signing/decryption key boundary and executes the evaluator through GitHub Actions.

This should not be described as a production hardware TEE.

A hardened confidential-compute deployment with hardware-backed key protection remains part of the future roadmap.

---

# Merkle-Based Payouts

Veynt does not need to store every winner's payout directly in the contract.

Instead, the evaluator constructs a Merkle tree.

Each winner becomes a leaf containing:

```text
wallet address
+
payout amount
```

Conceptually:

```text
Leaf = hash(walletAddress, payout)
```

The complete set of winner leaves produces:

```text
Merkle Root
```

Only the root is stored on-chain.

The evaluator also produces an individual Merkle proof for each winner.

Example claim data:

```json
{
  "marketId": 5,
  "bettor": "0x...",
  "payout": "1000000000000000000",
  "proof": ["0x..."]
}
```

The user can then submit the payout and Merkle proof to:

```solidity
claimPayout(
    marketId,
    payout,
    merkleProof
)
```

The contract verifies that:

```text
wallet + payout
```

belongs to the Merkle tree authorized for that market.

---

# Payout Model

Veynt uses a parimutuel pool model.

The current implementation allocates the market pool as follows:

| Allocation      |    Share | Recipient                                        |
| --------------- | -------: | ------------------------------------------------ |
| Winning bettors |      86% | Distributed proportionally among winning bettors |
| Market creator  |      10% | Creator of the market                            |
| Platform        |       3% | Veynt treasury                                   |
| Resolver        |       1% | Resolution submitter                             |
| **Total**       | **100%** |                                                  |

The winning allocation is distributed proportionally according to each winning bettor's stake.

For example:

```text
Total market pool = 15 BOT
```

The allocation is:

```text
Winning bettors = 12.90 BOT
Market creator  = 1.50 BOT
Platform        = 0.45 BOT
Resolver        = 0.15 BOT
--------------------------------
Total           = 15.00 BOT
```

If the winning side contains:

```text
Winner A = 8 BOT
Winner B = 2 BOT
```

then the winning pool is divided:

```text
Winner A = 80%
Winner B = 20%
```

Therefore:

```text
Winner A → 80% of 12.90 BOT = 10.32 BOT
Winner B → 20% of 12.90 BOT =  2.58 BOT
```

All payout calculations are performed by the evaluator before the resulting Merkle root is submitted to the contract.

---

# Claiming Winnings

After a market has been resolved:

```text
Market resolved
      |
      v
Merkle root stored on BOT Chain
      |
      v
Evaluator generates payout data
      |
      v
Payout JSON published
      |
      v
Frontend retrieves claim data
      |
      v
User clicks Claim
      |
      v
claimPayout()
      |
      v
Contract verifies Merkle proof
      |
      v
BOT payout
```

The contract verifies the supplied proof against the stored Merkle root.

A wallet cannot claim the same market payout more than once.

---

# Emergency Refund

The contract includes an emergency refund mechanism for markets that cannot be resolved normally.

If the configured resolution conditions and grace period are satisfied, participants can recover their stake according to the contract rules.

This is intended to prevent funds from remaining permanently inaccessible if the external evaluation process fails.

---

# Smart Contract

The primary contract is:

```text
src/VeyntMarket.sol
```

The contract is responsible for:

- Creating markets
- Collecting the 1 BOT market creation fee
- Accepting BOT stakes
- Storing encrypted predictions
- Tracking market state
- Verifying authorized resolution signatures
- Storing the Merkle root
- Processing winner claims
- Handling emergency refunds
- Managing treasury functionality

### Main Write Functions

| Function                                         | Purpose                                                        |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `createMarket(...)`                              | Creates a new prediction market                                |
| `predict(uint256, bytes)`                        | Places a BOT stake with an encrypted prediction                |
| `resolveMarket(uint256, bytes32, string, bytes)` | Resolves a market using the authorized outcome and Merkle root |
| `claimPayout(uint256, uint256, bytes32[])`       | Claims a verified winner payout                                |
| `emergencyRefund(uint256)`                       | Recovers a stake when refund conditions are satisfied          |
| `withdrawTreasury(address)`                      | Withdraws accumulated platform fees                            |
| `transferOwnership(address)`                     | Transfers contract ownership                                   |

### Important View Functions

| Function                         | Purpose                                       |
| -------------------------------- | --------------------------------------------- |
| `markets(uint256)`               | Returns market information                    |
| `marketCount()`                  | Returns the number of markets                 |
| `stakeOf(uint256,address)`       | Returns a user's stake                        |
| `getPrediction(uint256,address)` | Returns a user's encrypted prediction         |
| `getBettors(uint256)`            | Returns bettors in a market                   |
| `hasBet(uint256,address)`        | Checks whether a wallet has already predicted |
| `hasClaimed(uint256,address)`    | Checks whether a wallet has claimed           |
| `i_teeSigner()`                  | Returns the authorized resolution signer      |

---

# Market Creation Fee

The current BOT Chain implementation uses a fixed creation fee:

```text
1 BOT
```

This is deliberately simple.

The previous Flare implementation used an FTSO-derived native-token/USD conversion for determining the creation fee. That mechanism is no longer part of the BOT Chain implementation.

The current model is:

```text
Create market
     |
     v
Pay 1 BOT
     |
     v
VeyntMarket
     |
     v
Market created
```

This removes the need for a native BOT/USD oracle solely for calculating the market creation fee.

External price data is instead used where it actually matters: resolving price-based prediction markets.

---

# FDC and BOT Chain: Separation of Responsibilities

One of the main architectural changes in the BOT Chain version is the separation between external data retrieval and blockchain settlement.

```text
                  FDC / Flare
                      |
                      | External price data
                      v
                 Evaluator
                      |
                      | Outcome
                      | Payouts
                      | Merkle root
                      | Signature
                      v
                  BOT Chain
                      |
                      v
                VeyntMarket
```

### FDC

Used for:

- Retrieving supported external data
- Obtaining price information
- Providing an attested data source to the evaluator

### Evaluator

Used for:

- Interpreting market conditions
- Decrypting predictions
- Determining the winning side
- Calculating payouts
- Building Merkle trees
- Generating proofs
- Signing the resolution payload

### BOT Chain

Used for:

- Market creation
- User staking
- Encrypted prediction storage
- Resolution
- Merkle root storage
- Payout claims
- Treasury operations

This separation keeps the market settlement logic on BOT Chain while allowing the resolution engine to consume externally sourced data.

---

# GitHub Actions Evaluation

The current public prototype uses GitHub Actions as the evaluator execution layer.

A typical workflow provides a market ID and executes:

```bash
node veyntmarket-tee/evaluator.js
```

The evaluator uses:

```text
BOT Chain RPC
+
VeyntMarket contract
+
FDC request
+
Prediction private key
+
Resolution signing key
```

The generated payout data is published under:

```text
veyntmarket-tee/payouts/
```

For example:

```text
veyntmarket-tee/payouts/market-1.json
veyntmarket-tee/payouts/market-2.json
```

The frontend retrieves the relevant payout data after the market has been resolved.

---

# Key Management

Veynt currently uses separate keys for separate purposes.

## TEE / Resolution Signing Key

```text
TEE_PRIVATE_KEY
```

Used to authorize:

```text
marketId
+
MerkleRoot
+
winningOutcome
```

The corresponding address must match the trusted signer configured in the deployed contract.

---

## Prediction Decryption Key

```text
PREDICTION_PRIVATE_KEY
```

Used to decrypt the RSA-OAEP encrypted YES/NO predictions.

This key must never be exposed through:

- Frontend JavaScript
- `index.html`
- Browser storage
- Public repositories
- Transaction calldata
- Client-side logs

For the current prototype, the secret is supplied to the evaluator environment.

---

# Frontend

The current Veynt frontend is a lightweight HTML/JavaScript application.

Live application:

https://veyntmarket.adarshpandey.xyz/

The interface provides:

- Wallet connection
- Market discovery
- Market creation
- BOT staking
- YES/NO prediction
- Client-side prediction encryption
- Market deadlines
- Market resolution information
- Payout information
- Merkle-proof-based claiming
- Transaction status

The frontend does not expose evaluator internals such as:

- FDC request construction
- Prediction decryption
- TEE signing
- Merkle tree generation
- GitHub Actions execution

Those operations belong to the evaluation and settlement layer.

---

# Example Market

A market could look like:

```text
Will BTC be above $65,000 at the market deadline?
```

A user chooses:

```text
YES
```

The frontend encrypts the prediction:

```text
YES
  |
  v
RSA-OAEP / SHA-256
  |
  v
Encrypted ciphertext
  |
  v
BOT Chain
```

Another user could choose:

```text
NO
```

without the first user's prediction direction being directly visible on-chain.

At the deadline:

```text
FDC
 |
 | Verified external price
 v
Evaluator
 |
 | Compare price against condition
 v
Winning side
 |
 | Decrypt encrypted predictions
 v
Winning bettors
 |
 | Calculate proportional payouts
 v
Merkle tree
 |
 | Generate Merkle root
 v
TEE signature
 |
 v
BOT Chain
 |
 v
resolveMarket()
 |
 v
Winner claims payout
```

---

# Repository Structure

```text
VEYNT/
│
├── src/
│   └── VeyntMarket.sol
│
├── script/
│   └── DeployVeyntMarket.s.sol
│
├── test/
│   └── VeyntMarket.t.sol
│
├── veyntmarket-tee/
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
│       └── ...
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
- A BOT Chain-compatible wallet

The evaluator additionally requires the configured environment variables/secrets used by the project.

---

## Clone

```bash
git clone https://github.com/Pandey456/VEYNT.git
cd VEYNT
```

---

## Install Dependencies

```bash
npm install
```

The evaluator uses packages including:

```text
viem
@openzeppelin/merkle-tree
```

---

## Build Contracts

```bash
forge build
```

---

## Run Tests

```bash
forge test -vvv
```

---

# BOT Chain

Veynt's current market contract is deployed for the BOT Chain testnet environment.

RPC used by the current evaluator and deployment flow:

```text
https://rpc.bohr.life
```

The exact deployed contract address should be taken from the project's current deployment configuration rather than hard-coded into this README.

---

# Transparency and Confidentiality

Veynt deliberately separates information into two categories.

## Public

```text
Wallet address
Stake amount
Market ID
Transaction
Encrypted prediction
Deadline
Contract state
Resolution
Merkle root
Claim transaction
```

## Confidential Before Resolution

```text
YES / NO prediction
```

The system therefore does not attempt to hide the fact that someone participated.

It attempts to hide **which side they selected**.

This distinction is fundamental to the design.

---

# Security Considerations

## Prediction Encryption

The security of prediction confidentiality depends on protecting:

```text
PREDICTION_PRIVATE_KEY
```

If the private decryption key is compromised, previously stored encrypted predictions may be decrypted.

---

## Resolution Signing Key

The resolution signing key is trusted by the smart contract.

A compromised signing key could potentially authorize an incorrect market resolution.

This is one of the most important security boundaries in the current prototype.

---

## Evaluator Environment

The current evaluator runs through GitHub Actions.

This is suitable for demonstrating the architecture and automating the public testnet workflow, but it should not be treated as equivalent to a hardened production confidential-computing environment.

A future version should move sensitive evaluation and key operations into a stronger confidential-compute environment with hardware-backed key protection.

---

## FDC Dependency

For price-based markets, the evaluator depends on the FDC flow to obtain the external data required for resolution.

If the external data pipeline or evaluation process fails, the market must rely on the contract's emergency-refund conditions rather than silently assuming an outcome.

---

## Smart Contract

The smart contracts have not been independently audited.

This project is a testnet prototype.

Do not use this deployment with funds you cannot afford to lose.

---

# Known Prototype Limitations

1. The evaluator currently runs through GitHub Actions.
2. Sensitive evaluator keys are supplied through the evaluator environment.
3. The current key boundary should not be described as a production hardware TEE.
4. FDC data is consumed by the evaluator before the resulting resolution is submitted to BOT Chain.
5. The current frontend is implemented as HTML/JavaScript.
6. The smart contract has not undergone an independent security audit.
7. The current market model focuses on binary YES/NO outcomes.
8. Price-based markets currently depend on the supported FDC data flow.
9. The current market creation fee is fixed at 1 BOT.
10. The current implementation is intended for testnet experimentation rather than production financial use.

---

# Roadmap

The current architecture is intentionally designed so that additional market types and data sources can be added without fundamentally changing the settlement model.

## Phase 1 — Core Market

- [x] Parimutuel prediction pool
- [x] Market creation
- [x] Fixed 1 BOT market creation fee
- [x] BOT staking
- [x] Deadline enforcement
- [x] One prediction per wallet
- [x] Emergency refund
- [x] Owner and treasury functionality

## Phase 2 — Confidential Predictions

- [x] Client-side encryption
- [x] RSA-OAEP prediction encryption
- [x] Encrypted predictions stored on-chain
- [x] Evaluator-side decryption
- [x] Prediction direction hidden from block explorers before resolution

## Phase 3 — External Data Resolution

- [x] FDC integration
- [x] External price retrieval
- [x] Deadline-based evaluation
- [x] Winning-side calculation
- [x] Authorized resolution signature
- [x] On-chain resolution on BOT Chain

## Phase 4 — Verifiable Payouts

- [x] Winning pool calculation
- [x] Proportional payout calculation
- [x] Merkle tree generation
- [x] Merkle proof generation
- [x] On-chain Merkle root
- [x] Claim verification
- [x] Duplicate-claim protection
- [x] Payout JSON generation

## Phase 5 — Production Hardening

- [ ] Move evaluation into a hardened confidential-compute environment
- [ ] Hardware-backed key management
- [ ] Remove GitHub Actions as the sensitive evaluation trust boundary
- [ ] Independent smart-contract audit
- [ ] Strengthen FDC verification architecture
- [ ] Improve evaluator reliability and failure recovery
- [ ] Improve decentralized keeper/resolution infrastructure
- [ ] Add additional asset feeds
- [ ] Add sports and real-world event markets
- [ ] Improve monitoring and observability
- [ ] Mainnet deployment

---

# Future Scope

The current prototype focuses primarily on crypto price prediction markets. The longer-term goal is to turn the same settlement architecture into a more general prediction-market platform.

## 1. More Assets and Real-World Markets

The market engine can be extended beyond a single price feed.

Potential future categories include:

- Additional cryptocurrencies
- Token price markets
- Traditional financial assets
- Sports outcomes
- Event-based markets
- Other real-world events that can be resolved using verifiable external data

The goal is to make the market definition flexible enough that the settlement engine is not tightly coupled to a single asset or API.

---

## 2. Yield Generation for Long-Duration Markets

For markets with sufficiently long deadlines, idle capital could potentially be deployed into supported lending protocols rather than remaining unused for the entire market duration.

A possible future model is:

```text
Users place predictions
        |
        v
Market pool accumulates
        |
        v
Long-duration market
        |
        v
Capital deployed into supported lending protocol
        |
        v
Yield generated during market duration
        |
        v
Market reaches deadline
        |
        v
Market resolved
        |
        v
Principal returned
        |
        v
Generated yield distributed according
to the future market rules
```

This feature is not part of the current implementation.

It would require careful consideration of liquidity, protocol risk, withdrawal timing, accounting, and how yield interacts with the existing payout model.

---

# Design Principles

## 1. Hide the Decision, Not the Transaction

The blockchain should still provide transparent evidence that a market position exists.

The prediction direction is the information Veynt attempts to keep confidential until evaluation.

---

## 2. Keep Settlement Verifiable

The evaluator can perform complex processing off-chain, but the final market resolution still produces an on-chain state.

The Merkle root provides a compact commitment to the payout set.

---

## 3. Separate External Data From Settlement

FDC is responsible for providing the external data required by supported markets.

The evaluator interprets that data.

BOT Chain records the resulting market resolution.

This separation makes it easier to evolve the data layer without redesigning the core market contract.

---

## 4. Keep Private Keys Outside the Client

The browser only needs the public encryption key.

Sensitive decryption and signing keys remain outside the frontend.

---

## 5. Minimize On-Chain Payout State

Instead of storing every winner's payout directly in the contract, the evaluator commits to the payout set using a Merkle root.

Users prove their individual allocation when claiming.

---

# Why Veynt?

Prediction markets benefit from transparency, but complete transparency can also expose participant behavior too early.

Veynt explores a middle ground:

```text
Transparent settlement
+
Encrypted prediction direction
+
Externally sourced data
+
Off-chain evaluation
+
Authorized resolution
+
Merkle-based claims
```

The result is a prediction-market architecture where participants can interact with a public blockchain without immediately broadcasting which side they selected.

---

# Build in Public

Veynt is being developed as an open project.

The repository contains the smart contracts, evaluator, FDC integration, payout generation, and frontend components required to understand the current implementation.

Repository:

https://github.com/Pandey456/VEYNT

Live application:

https://veyntmarket.adarshpandey.xyz/

---

# License

Licensed under the MIT License.

---

## Built for BOT Chain

Veynt is an experimental prediction-market architecture built around BOT Chain settlement and Flare Data Connector-powered external data resolution.

The current objective is straightforward:

> **Keep the prediction private. Keep the settlement verifiable.**
