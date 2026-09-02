# Veynt
 
### Confidential prediction markets with FDC-powered resolution on BOT Chain
 
Veynt (built for [@BOTChain-bot](https://github.com/Pandey456/VEYNT)) is a prototype prediction market where users take positions on binary outcomes **without publicly revealing whether they picked YES or NO** until the market is resolved.
 
The stake and transaction stay public on-chain. The **prediction direction** is encrypted in the browser and only revealed to the off-chain evaluator at resolution time.
 
- **Live app:** https://veyntmarket.adarshpandey.xyz/
- **Repository:** https://github.com/Pandey456/VEYNT
> **Prototype — not production.** No independent audit, no hardware-backed confidential compute yet. Do not use with funds you cannot afford to lose. See [Security](#security) and [Known Limitations](#known-limitations).
 
---
 
## Deployed Contracts
 
| Network | Chain ID | VeyntMarket Address | Explorer |
| ------- | -------- | ------------------- | -------- |
| BOT Chain Testnet | 968 | `<TESTNET_ADDRESS_TBD>` | https://scan.bohr.life |
| BOT Chain Mainnet | `<TBD>` | `<MAINNET_ADDRESS_TBD>` (not deployed) | `<TBD>` |
 
> Take the live address from the current deployment config, not from this table, until mainnet is finalized.
 
---
 
## What's private, what's public
 
Veynt does **not** hide that you participated. It hides **which side you took**, until resolution.
 
| Public on-chain | Confidential until resolution |
| --------------- | ----------------------------- |
| Wallet address, stake amount | The YES / NO choice |
| Market ID, deadline, contract state | |
| Encrypted prediction ciphertext | |
| Resolution tx, outcome, Merkle root | |
 
**Why it matters:** fully transparent markets leak sentiment early, which drives herding, copy-trading, and strategic timing. Veynt keeps settlement verifiable while keeping the decision confidential until it can no longer influence other participants.
 
Confidentiality rests on the RSA-OAEP keypair: the frontend holds the **public** key and encrypts each choice; the **private** key lives only in the evaluator environment and never touches the client.
 
---
 
## How resolution works (read this carefully)
 
For price markets, the evaluator does **not** compare the price at a single deadline instant. It requests the **maximum and minimum price over the whole market window** (`startTime → deadline`) via the Flare Data Connector, then resolves against whether the target was *reached* during that window:
 
```
ABOVE market → YES if the price REACHED the target at any point in the window
BELOW market → YES if the price DROPPED TO the target at any point in the window
otherwise    → NO
```
 
So a market phrased "Will BTC reach $65,000?" is a **touch/breach** bet over the window, not an "is it above $65,000 at the deadline" snapshot. Bet accordingly.
 
Example (ABOVE, target $65,000): if the window high hits $65,122, the outcome is **YES** — even if BTC closes lower at the deadline.
 
---
 
## Architecture
 
```
Frontend  ──encrypt YES/NO──▶  VeyntMarket.sol (BOT Chain)
                                      │
                        encrypted predictions
                                      ▼
                            Evaluator (off-chain)
                          ┌───────────┴───────────┐
                          ▼                       ▼
                  FDC (external price)   Prediction private key
                          └───────────┬───────────┘
                                      ▼
              determine outcome → payouts → Merkle tree → signature
                                      │
                                      ▼
                       VeyntMarket.resolveMarket()
                          (outcome + Merkle root)
                                      │
                                      ▼
                            user claimPayout()
```
 
**Separation of responsibilities:** FDC supplies attested external data; the evaluator interprets it and builds the settlement; BOT Chain is the sole settlement and resolution layer.
 
---
 
## Market lifecycle
 
1. **Create** — Connect wallet, pick asset / direction / target / duration. Fixed **1 BOT** creation fee (no oracle needed for fees). Question is stored as `SYMBOL|DIRECTION|SCALED_PRICE`.
2. **Predict** — Choose YES or NO. The frontend encrypts it (RSA-OAEP / SHA-256) before calling `predict(marketId, encryptedChoice)` with your BOT stake. A wallet can add to its stake more than once; **the most recent encrypted choice sets the side for the wallet's entire accumulated stake** — the two sides are not tracked separately, so a later opposite bet reclassifies everything. Pick one side.
3. **Resolve** — After the deadline, the evaluator reads the market, fetches FDC price data, decrypts predictions, computes the winning side and proportional payouts, builds a Merkle tree, signs the resolution, and submits `resolveMarket()`.
4. **Claim** — Winners fetch their proof from the published payout JSON and call `claimPayout(marketId, payout, proof)`. One claim per wallet per market.
If a market can't be resolved and the grace period passes, bettors recover their stake via `emergencyRefund(marketId)`.
 
---
 
## Payout model (parimutuel)
 
| Allocation | Share | Recipient |
| ---------- | ----: | --------- |
| Winning bettors | 86% | Split proportionally by stake |
| Market creator | 10% | Market creator |
| Platform | 3% | Veynt treasury |
| Resolver | 1% | Resolution submitter |
 
Example — 15 BOT pool, winners A (8 BOT) and B (2 BOT): distributable 12.90 BOT → A gets 80% = 10.32 BOT, B gets 20% = 2.58 BOT.
 
> **Note on the rake:** after the 14% total cut, a winner on a heavily favored side can still net less than their stake. The effective payout is shown before you confirm.
 
Payouts are computed off-chain; only the **Merkle root** is stored on-chain. Each winner is a leaf of `hash(walletAddress, payout)`, and proves their allocation at claim time.
 
---
 
## User quickstart
 
1. **Get a wallet** (e.g. MetaMask) and add **BOT Chain Testnet** — Chain ID `968`, RPC `https://rpc.bohr.life`, symbol `BOT`, explorer `https://scan.bohr.life`. The app can add the network for you on connect.
2. **Fund it** with testnet BOT.
3. Open the [live app](https://veyntmarket.adarshpandey.xyz/) and **Connect Wallet**.
4. **Create a market** (1 BOT) or **bet** on an existing one — enter an amount, pick YES or NO. Your choice is encrypted before it's sent.
5. After the deadline, anyone can hit **Resolve** to trigger the evaluator.
6. Once resolved, winners click **Claim Winnings**.
---
 
## Resolution signing (current prototype)
 
The evaluator can't submit an arbitrary outcome. It signs a payload over `(chainId, contract, marketId, merkleRoot, outcome)` with an **authorized signer key**; `resolveMarket()` verifies the recovered address matches the signer configured in the contract.
 
**This is not a hardware TEE.** The current prototype runs the evaluator in **GitHub Actions** and supplies the signer and decryption keys as CI secrets. That's fine for demonstrating the flow, but it is a trusted-server boundary, not an attested enclave. Moving to real hardware-backed confidential compute with verifiable remote attestation is the core of [Phase 5](#roadmap).
 
---
 
## Security
 
- **No independent audit.** Testnet prototype only.
- **Shared contract balance / no per-market fund isolation.** All markets' funds are held in one balance and `claimPayout` pays whatever a valid Merkle leaf specifies. Nothing on-chain caps total claims for a market to that market's pool, so a single bad or malicious Merkle root could drain funds belonging to *other* markets and the treasury. This is the most serious structural risk in the current design and must be fixed before mainnet.
- **Single trusted signer.** A compromised signing key could authorize an incorrect resolution. Because one key controls every market's root, one compromise = systemic risk.
- **Prediction key compromise** would let previously stored ciphertexts be decrypted.
- **Evaluator environment** (GitHub Actions) is a trusted server, not an enclave — see above.
- **FDC dependency.** If the external data pipeline or evaluation fails, the market falls back to emergency refund rather than assuming an outcome.
---
 
## Smart contract
 
Primary contract: `src/VeyntMarket.sol`.
 
**Write:** `createMarket`, `predict`, `resolveMarket`, `claimPayout`, `emergencyRefund`, `withdrawTreasury`, `transferOwnership`.
 
**View:** `markets`, `marketCount`, `stakeOf`, `getPrediction`, `getBettors`, `hasBet`, `hasClaimed`, `i_teeSigner`.
 
---
 
## Repository structure
 
```
VEYNT/
├── src/VeyntMarket.sol
├── script/DeployVeyntMarket.s.sol
├── test/VeyntMarket.t.sol
├── veyntmarket-tee/
│   ├── evaluator.js
│   ├── fdc-run.js
│   ├── constants.js
│   └── payouts/market-*.json
├── .github/workflows/
├── index.html
├── foundry.toml
├── package.json
└── README.md
```
 
---
 
## Development setup
 
**Prerequisites:** Node.js 20+, Foundry, Git, a BOT Chain-compatible wallet.
 
```bash
git clone https://github.com/Pandey456/VEYNT.git
cd VEYNT
npm install          # viem, @openzeppelin/merkle-tree, ...
forge build
forge test -vvv
```
 
The evaluator additionally requires the configured environment secrets (`PRIVATE_KEY`, `TEE_PRIVATE_KEY`, `PREDICTION_PRIVATE_KEY`, `MARKET_ID`). Never place the prediction or signer private keys in the frontend, browser storage, calldata, or a public repo.
 
---
 
## Known limitations
 
1. Evaluator runs in GitHub Actions — a trusted server, not a hardware TEE.
2. Sensitive keys are supplied as CI secrets.
3. Single authorized signer controls resolution for all markets.
4. No per-market fund isolation in the contract.
5. Price markets resolve on a **window touch/breach**, not a deadline snapshot.
6. A wallet's most recent choice sets the side for its full stake (no per-side tracking).
7. Frontend is a single HTML/JS file.
8. Binary YES/NO markets only; price markets depend on the supported FDC flow.
9. Fixed 1 BOT creation fee.
10. Testnet experimentation only — not for production financial use.
---
 
## Roadmap
 
**Done — Phases 1–4:** parimutuel pool, market creation, 1 BOT fee, BOT staking, deadline enforcement, emergency refund, owner/treasury; client-side RSA-OAEP encryption with on-chain ciphertext and evaluator-side decryption; FDC integration and authorized on-chain resolution; proportional payouts with Merkle root, per-winner proofs, claim verification, and duplicate-claim protection.
 
**Phase 5 — production hardening (planned):**
- [ ] Real confidential-compute enclave with **verifiable remote attestation**
- [ ] Hardware-backed key management; remove GitHub Actions as the trust boundary
- [ ] **Per-market fund isolation** in the contract
- [ ] Bind resolver address into the signed payload (prevent fee front-running)
- [ ] Pull-payment settlement (avoid push-payment resolution bricking)
- [ ] Independent smart-contract audit + bug bounty
- [ ] Stronger FDC verification and evaluator failure recovery
- [ ] Decentralized keeper/resolution infrastructure
- [ ] More asset feeds; sports and real-world event markets
- [ ] Monitoring/observability; mainnet deployment
---
 
## Future scope
 
- **More markets:** additional cryptos, traditional assets, sports, and event-based markets resolvable via verifiable external data — the market definition is kept decoupled from any single feed.
- **Yield on long-duration markets:** idle pool capital could be deployed into supported lending protocols for the market's duration, with generated yield distributed per future rules. Not implemented; needs careful treatment of liquidity, protocol risk, and payout interaction.
---
 
## Design principles
 
1. **Hide the decision, not the transaction** — the chain still proves a position exists.
2. **Keep settlement verifiable** — off-chain compute, on-chain commitment via Merkle root.
3. **Separate external data from settlement** — FDC provides data, BOT Chain records results.
4. **Keep private keys off the client** — browser only holds the public encryption key.
5. **Minimize on-chain payout state** — store the root, prove allocations at claim time.
---
 
## License
 
MIT.
 
> **Keep the prediction private. Keep the settlement verifiable.**
