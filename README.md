# 🎭 VeilMarket

**The First Confidential Parimutuel Prediction Market on Flare Network.**

> _Predict outcomes on sports, crypto, and real-world events with zero herding bias or public position exposure—powered by Flare Confidential Compute (TEEs) and automated trustlessly via the Flare Data Connector (FDC)._

---

## 📖 The Problem: Polymarket is Broken by Transparency

Traditional on-chain prediction markets (like Polymarket) suffer from **Herding Bias** and **Front-Running**. When a whale publicly places a $50,000 bet on "YES", it forces other users to copy the trade or prematurely shifts market sentiment.

**VeilMarket fixes this.** By moving prediction selections off-chain into a hardware enclave, bets remain 100% confidential until the market resolves. No one knows which side has the most money, forcing users to bet on their true convictions rather than following the crowd.

---

## 🚀 The Flare "Trifecta" Architecture

VeilMarket leverages three enshrined Flare Network protocols simultaneously to create a fully decentralized, serverless Web3 application:

1. **Flare Confidential Compute (FCC / TEEs) - _The Privacy Shield_**
   - User choices (e.g., YES or NO) are encrypted client-side and sent as an opaque byte string on-chain.
   - Only the hardware TEE enclave can decrypt the bets off-chain to calculate the final winner pool, ensuring zero on-chain data leakage.
2. **Flare Data Connector (FDC) - _The Trustless Truth_**
   - VeilMarket completely eliminates centralized oracles or human dispute resolution.
   - Uses FDC's `Web2Json` attestation to trustlessly query real-world REST APIs (sports scores, crypto prices, election results) and bring the verifiable cryptographic proof directly on-chain.
3. **Flare Time Series Oracle (FTSOv2) - _The Anti-Spam Gatekeeper_**
   - Anyone can create a market permissionlessly.
   - To prevent spam, creating a market requires a flat ~$13 USD fee. The smart contract dynamically queries the FTSOv2 FLR/USD feed to calculate the exact amount of FLR `wei` required at that exact second.

---

## 🧮 Parimutuel Tokenomics (No AMM Required)

VeilMarket utilizes a **Parimutuel Pool Model**, avoiding the complexity of liquidity seeding or AMM (Logarithmic Market Scoring Rule) bonding curves.

All staked collateral is pooled into a single Master Escrow. When the market resolves, the **Losing Pool** is distributed to the **Winning Pool** proportionally, minus protocol fees.

**The Golden Ratio Resolution (100% On-Chain Execution):**

- **86% - Winning Bettors:** Distributed proportionally based on their stake weight in the winning pool.
- **10% - Market Creator:** Incentivizes users to research and post high-quality, engaging prediction markets.
- **3% - Platform Treasury:** Self-funds the decentralized protocol (e.g., buying Web3 domains, funding future audits).
- **1% - The Finalizer (Keeper Bounty):** The smart contract is 100% serverless. To incentivize execution, the user or MEV bot who pays the gas to call `finalize()` after the timer expires is automatically rewarded with 1% of the pool.

---

## ⚙️ How It Works (The Technical Sequence)

### 1. Market Creation (`addQuestion`)

A user connects their wallet, defines a question, specifies the API endpoint for FDC resolution, and sets an `endTime`. The contract pulls the live FTSOv2 price, charges $13 in FLR, and opens the market.

### 2. Confidential Betting (`predict`)

Users lock FLR collateral in the smart contract escrow. Their actual prediction (e.g., Option A or Option B) is encrypted using the TEE's public key. Observers on the block explorer only see that a deposit was made, not the chosen outcome.

### 3. Permissionless Settlement (`finalize`)

Once `block.timestamp >= endTime`, the market is locked. The settlement handshake occurs:

1. The FDC fetches the real-world answer via API and brings the `Web2Json` proof on-chain.
2. The TEE Enclave reads the FDC-verified truth and all encrypted user bets from the blockchain.
3. The TEE decrypts bets, matches them against the FDC truth, and calculates payouts.
4. The TEE signs the result payload: `keccak256(marketId, winningOption, payoutAmounts)`.
5. The smart contract validates the TEE's signature via `ecrecover` and instantly distributes the funds.

---

## 🗺️ Development Roadmap & Phase Tracker

**Phase 1: Foundation & Smart Contracts (Core Escrow)**

- [x] Design Parimutuel pool model & fee distribution (86/10/3/1).
- [ ] Implement FTSOv2 integration for dynamic `$13` market creation fees.
- [ ] Write core `VeilMarket.sol` struct and escrow logic.
- [ ] Setup Foundry test environment & mock oracles.

**Phase 2: The Trustless Truth (FDC Integration)**

- [ ] Integrate Flare Data Connector (FDC) for automated settlement.
- [ ] Configure `Web2Json` attestation types for external REST APIs.
- [ ] Implement `finalize()` logic to parse FDC cryptographic proofs.

**Phase 3: The Privacy Layer (Confidential Compute / TEE)**

- [ ] Develop Rust-based TEE enclave for off-chain decryption.
- [ ] Setup client-side encryption logic using TEE public keys.
- [ ] Implement TEE ECDSA signature verification (`ecrecover`) on-chain.

**Phase 4: UI/UX & Coston2 Deployment**

- [ ] Deploy VeilMarket contracts to Flare Coston2 Testnet.
- [ ] Build Next.js frontend for market creation and prediction.
- [ ] Finalize end-to-end integration testing.
- [ ] Submit to Flare Summer Signal Hackathon.

---

## 📂 Repository Architecture

```text
VeilMarket/
├── contracts/                  # Solidity Smart Contracts
│   ├── VeilMarket.sol          # Main Parimutuel Logic & Escrow
│   ├── interfaces/             # Flare FDC/FTSO/TEE Interfaces
│   └── mocks/                  # Mock Oracles for local testing
├── enclave/                    # TEE Confidential Compute Logic
│   ├── src/main.rs             # Rust-based TEE decryption & payout calculation
│   └── Dockerfile              # Reproducible SGX Enclave build
├── script/                     # Foundry Deployment Scripts
│   └── DeployVeilMarket.s.sol
├── test/                       # Foundry Unit & Integration Tests
│   └── VeilMarket.t.sol
└── fdc-schemas/                # Web2Json Attestation types for APIs
```

---

## 🛠️ Development & Installation

This project is built using **Foundry** and relies on **Soldeer** for Flare dependencies.

### Prerequisites

- [Foundry](https://getfoundry.sh/) installed
- A Coston2 Testnet wallet funded with C2FLR.

### 1. Clone & Install

```bash
git clone https://github.com/Pandey456/VeilMarket.git
cd VeilMarket

# Install Flare peripherals using Soldeer
forge soldeer install flare-periphery~0.1.50
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
PRIVATE_KEY=your_wallet_private_key_here
COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
```

### 3. Compile & Test

```bash
forge build
forge test
```

### 4. Deploy to Coston2

```bash
forge script script/DeployVeilMarket.s.sol --rpc-url coston2 --broadcast
```

---

## 🔮 Future Scope

- **Dynamic AMM Integration:** Transitioning from locked Parimutuel pools to continuous trading curves, allowing users to trade position shares before the market expires.
- **FAssets Integration:** Allowing users to place confidential predictions using non-smart contract tokens like `FXRP` or `FBTC` directly inside the TEE enclave.

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

_Built for the Flare Summer Signal Hackathon._
