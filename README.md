# 🎭 VeilMarket

**The First Confidential Parimutuel Prediction Market on Flare Network.**

> _Predict outcomes on sports, crypto, and real-world events with zero herding bias or public position exposure — powered by Flare Confidential Compute (TEEs) and settled trustlessly via the Flare Data Connector (FDC)._

<p align="center">
  <img alt="Solidity" src="https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity" />
  <img alt="Foundry" src="https://img.shields.io/badge/Built%20with-Foundry-black" />
  <img alt="Flare" src="https://img.shields.io/badge/Network-Flare%20Coston2-e62058" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-blue" />
</p>

---

## 📖 The Problem: Polymarket Is Broken by Transparency

Traditional on-chain prediction markets (like Polymarket) suffer from **herding bias** and **front-running**. When a whale publicly places a $50,000 bet on "YES", other users copy the trade, and market sentiment shifts before the underlying question is even close to resolving.

**VeilMarket fixes this.** By moving prediction *selections* off-chain into a hardware enclave, bets stay 100% confidential until the market resolves. No one can see which side holds the most money, so users bet on their true convictions instead of following the crowd.

> Note on what is and isn't private: your **choice** (YES/NO) is encrypted. Your **stake amount and wallet address are inherently public** — `msg.value` and `msg.sender` always are on any EVM chain. VeilMarket hides the one thing that causes herding: the direction of the bet.

---

## 🚀 The Flare "Trifecta" Architecture

VeilMarket leverages three enshrined Flare protocols to build a fully decentralized, serverless dApp:

### 1. Flare Confidential Compute (FCC / TEEs) — _The Privacy Shield_
- User choices are encrypted client-side with the TEE's public key and submitted as an **opaque byte string**.
- The ciphertext is emitted in the `BetPlaced` event (on-chain data), so the enclave can read every bet without paying storage costs.
- Only the hardware TEE enclave can decrypt bets off-chain to compute the winning pool — **zero on-chain choice leakage**.

### 2. Flare Data Connector (FDC) — _The Trustless Truth_
- No centralized oracle, no human dispute resolution.
- Uses FDC's `Web2Json` attestation to trustlessly query real-world REST APIs (sports scores, crypto prices, election results) and bring a verifiable cryptographic proof on-chain.

### 3. Flare Time Series Oracle (FTSOv2) — _The Anti-Spam Gatekeeper_
- Anyone can create a market permissionlessly.
- To prevent spam, market creation costs a flat **$13 USD**. The contract queries the live `FLR/USD` feed and calculates the exact `wei` required at that block. Overpayment is refunded automatically.

---

## 🧮 Parimutuel Tokenomics (No AMM Required)

VeilMarket uses a **parimutuel pool model** — no liquidity seeding, no bonding curves. All staked collateral is pooled into a single escrow. When the market resolves, the **losing pool** is distributed to the **winning pool** proportionally, minus protocol fees.

**The Golden Ratio Resolution (100% on-chain execution):**

| Share | Recipient       | Purpose                                                              |
|-------|-----------------|----------------------------------------------------------------------|
| 86%   | Winning bettors | Distributed proportionally by stake weight within the winning pool.  |
| 10%   | Market creator  | Rewards users for posting high-quality, engaging markets.            |
| 3%    | Platform treasury | Self-funds the protocol (domains, future audits).                  |
| 1%    | The finalizer   | Keeper bounty for whoever pays gas to call `finalize()` after expiry. |

The contract is **serverless**: any user or MEV bot can trigger settlement and earns the 1% bounty.

---

## ⚙️ How It Works (Technical Sequence)

### 1. Market Creation — `createMarket`
Connect wallet, define a question, specify the FDC resolution endpoint, and set a `deadline`. The contract pulls the live FTSOv2 price, charges $13 in FLR (refunding any excess), and opens the market.

### 2. Confidential Betting — `predict`
Users lock FLR collateral in escrow. Their prediction is encrypted with the TEE public key and emitted as an opaque blob. Block-explorer observers see only that a deposit was made — not the chosen outcome.

### 3. Permissionless Settlement — `finalize` _(in progress)_
Once `block.timestamp >= deadline`, the market locks and the settlement handshake runs:
1. The FDC fetches the real-world answer via API and brings the `Web2Json` proof on-chain.
2. The TEE enclave reads the FDC truth and all encrypted bets from the chain.
3. The TEE decrypts bets, matches them against the truth, and computes payouts.
4. The TEE signs `keccak256(marketId, winningOption, payoutAmounts)`.
5. The contract validates the signature via `ecrecover` and distributes funds.

### 4. Safety Valve — `emergencyRefund`
If FDC/TEE settlement never happens, funds are **not** bricked. After `deadline + 3 days` with no resolution, any bettor can reclaim their exact stake.

---

## 📚 Contract API Reference

### Write Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createMarket(string question, uint256 deadline, string apiEndpoint)` | public, payable | Opens a market. Charges the FTSOv2 $13 fee, refunds excess. Returns `marketId`. |
| `predict(uint256 marketId, bytes encryptedChoice)` | public, payable | Stakes FLR and records a confidential bet. |
| `finalize(uint256 marketId, bytes fdcProof, bytes teeSignedPayload)` | public | Resolves a market and distributes payouts. **Currently a stub — reverts `NotImplemented`.** |
| `emergencyRefund(uint256 marketId)` | public | Reclaims your stake if the market is unresolved past the grace period. |
| `withdrawTreasury(address to)` | onlyOwner | Withdraws accumulated creation fees. |
| `transferOwnership(address newOwner)` | onlyOwner | Transfers admin rights. |

### View Functions

| Function | Description |
|----------|-------------|
| `getRequiredFee() → uint256` | Live FLR (wei) needed to pay the $13 fee. Quote this in your frontend, send a small buffer, and let `createMarket` refund the excess. |
| `markets(uint256) → Market` | Reads a market struct. |
| `stakeOf(uint256, address) → uint256` | A bettor's total stake in a market. |
| `marketCount() → uint256` | Number of markets created. |
| `accumulatedTreasuryFees() → uint256` | Withdrawable treasury balance. |

### Constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `TARGET_USD_FEE` | `13 ether` | $13, expressed with 18 decimals. |
| `MIN_MARKET_DURATION` | `5 minutes` | Minimum time a market must stay open. |
| `MAX_PRICE_AGE` | `1 hour` | Reject the oracle price if older than this. |
| `RESOLUTION_GRACE` | `3 days` | Refund window after an unresolved deadline. |

### Events
`MarketCreated`, `BetPlaced`, `EmergencyRefunded`, `TreasuryWithdrawn`, `OwnershipTransferred`.

### Custom Errors
Gas-efficient reverts instead of string messages: `NotOwner`, `ZeroAddress`, `DeadlineInPast`, `DurationTooShort`, `EmptyQuestion`, `EmptyEndpoint`, `InvalidOraclePrice`, `NegativeDecimals`, `StalePrice`, `InsufficientFee`, `RefundFailed`, `MarketNotFound`, `MarketClosed`, `ZeroStake`, `AlreadyResolved`, `GracePeriodNotPassed`, `NothingToWithdraw`, `TransferFailed`, `Reentrancy`, `NotImplemented`.

---

## 🔐 The Fee Math (Why It's Correct)

FTSOv2's `getFeedById` returns `value` and `decimals` such that:

```
price(USD) = value / 10^decimals
```

To convert the $13 target into FLR wei:

```
requiredWei = 13e18 / price
            = 13e18 / (value / 10^decimals)
            = 13e18 * 10^decimals / value
```

**Worked example** — FLR = $0.02, `decimals = 7`, `value = 200000`:

```
requiredWei = 13e18 * 1e7 / 2e5 = 650e18 wei = 650 FLR
650 FLR * $0.02 = $13 ✅
```

The contract guards against a negative `decimals`, a zero price, and a stale timestamp before doing this division.

---

## 🗺️ Development Roadmap & Phase Tracker

**Phase 1: Foundation & Smart Contracts (Core Escrow)**
- [x] Design parimutuel pool model & fee distribution (86/10/3/1).
- [x] Implement FTSOv2 integration for dynamic `$13` creation fees.
- [x] Write core `VeilMarket.sol` struct and escrow logic.
- [x] Add `predict` (confidential betting) and `emergencyRefund` safety valve.
- [x] Add owner + treasury withdrawal, custom errors, reentrancy guard.
- [ ] Setup Foundry test environment & mock oracles.

**Phase 2: The Trustless Truth (FDC Integration)**
- [ ] Integrate Flare Data Connector (FDC) for automated settlement.
- [ ] Configure `Web2Json` attestation types for external REST APIs.
- [ ] Implement `finalize()` logic to parse FDC cryptographic proofs.

**Phase 3: The Privacy Layer (Confidential Compute / TEE)**
- [ ] Develop Rust-based TEE enclave for off-chain decryption.
- [ ] Setup client-side encryption using the TEE public key.
- [ ] Implement TEE ECDSA signature verification (`ecrecover`) on-chain.

**Phase 4: UI/UX & Coston2 Deployment**
- [ ] Deploy VeilMarket contracts to Flare Coston2 Testnet.
- [ ] Build Next.js frontend for market creation and prediction.
- [ ] End-to-end integration testing.
- [ ] Submit to Flare Summer Signal Hackathon.

---

## 📂 Repository Architecture

```text
VeilMarket/
├── contracts/                  # Solidity Smart Contracts
│   ├── VeilMarket.sol          # Main parimutuel logic & escrow
│   ├── interfaces/             # Flare FDC/FTSO/TEE interfaces
│   └── mocks/                  # Mock oracles for local testing
├── enclave/                    # TEE Confidential Compute logic
│   ├── src/main.rs             # Rust-based TEE decryption & payout calc
│   └── Dockerfile              # Reproducible SGX enclave build
├── script/                     # Foundry deployment scripts
│   └── DeployVeilMarket.s.sol
├── test/                       # Foundry unit & integration tests
│   └── VeilMarket.t.sol
└── fdc-schemas/                # Web2Json attestation types for APIs
```

---

## 🛠️ Development & Installation

Built with **Foundry** and **Soldeer** for Flare dependencies.

### Prerequisites
- [Foundry](https://getfoundry.sh/) installed
- A Coston2 Testnet wallet funded with C2FLR ([faucet](https://faucet.flare.network/coston2))

### 1. Clone & Install
```bash
git clone https://github.com/Pandey456/VeilMarket.git
cd VeilMarket

# Install Flare peripherals using Soldeer
forge soldeer install flare-periphery~0.1.50
```

### 2. Import Your Private Key (no plaintext .env)
```bash
cast wallet import <keyName> --interactive
# 1. Paste your private key
# 2. Set a password
# 3. Confirm the success message
```

### 3. Environment Setup
Create a `.env` file in the root:
```env
COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
```

### 4. Compile & Test
```bash
forge build
forge test -vvv
```

### 5. Deploy to Coston2
```bash
forge script script/DeployVeilMarket.s.sol \
  --rpc-url coston2 \
  --account <keyName> \
  --broadcast
```

---

## ⚠️ Security Notes & Known Considerations

- **`finalize` is not implemented.** It reverts `NotImplemented` until FDC + TEE integration lands. **Invariant to enforce when building it:** zero out `stakeOf` (or set a claimed flag) on payout, so a winner cannot both collect a payout _and_ later trigger `emergencyRefund` (double-spend). Also verify `sum(payoutAmounts) <= totalPool` and make resolution idempotent.
- **Verify the FTSOv2 signature.** On some Flare interface versions `getFeedById` is `payable`, not `view`. Confirm the deployed Coston2 method and adjust the interface (and forward value) if needed.
- **CEI + reentrancy.** All state-changing external-call functions use the checks-effects-interactions pattern and a `nonReentrant` guard.
- **Fee rounding.** Integer division rounds down, so the fee can be short of $13 by a dust amount — harmless, and round-up can be added if you prefer.
- **Not audited.** Testnet / hackathon code. Do not deploy to mainnet with real funds without an audit.

---

## 🔮 Future Scope
- **Dynamic AMM integration:** move from locked parimutuel pools to continuous trading curves so users can trade position shares before expiry.
- **FAssets integration:** confidential predictions using non-native tokens like `FXRP` or `FBTC` directly inside the TEE enclave.

---

## 📄 License
Licensed under the MIT License — see the `LICENSE` file for details.

_Built for the Flare Summer Signal Hackathon._
