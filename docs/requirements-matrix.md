# Requirements Matrix

Status legend:

- **Proven (local)** - executable tests or local stub demo, reproducible without a chain.
- **Proven (testnet read-only)** - verified against the official Atlantic RPC or a live local startup using it; no transaction broadcast.
- **Unproven** - requires an approved live payment and a funded wallet.

No row is marked proven on the basis of an unexecuted command.

| ID | Arena requirement | Implementation | Named tests | Demo / evidence | Status |
| --- | --- | --- | --- | --- | --- |
| 1.1 | Use `eip155:688689` everywhere | `src/network.ts` `NETWORK`, `CHAIN_ID`; route config in `src/resource/pricing.ts` | `test/network.test.ts` "uses the required CAIP-2 identifier and chain ID"; every 402 assertion in `test/resource.test.ts` | `evidence/data-402-decoded.json`, `evidence/info-402-decoded.json` | **Proven (local + testnet read-only)** |
| 1.2 | Verified test-USDC address | `src/network.ts` `USDC_ADDRESS = 0xcfC8...Fc8B`; `scripts/verify-network.ts` resolves proxy implementation and selectors | `test/network.test.ts` "uses the official Token Registry test USDC"; `test/amounts.test.ts` parser asset | `evidence/network-verification.json` (name/version/decimals, implementation, EIP-3009 selectors) | **Proven (testnet read-only)** |
| 1.3 | Correct ERC-20 decimals, not native 18 | `src/amounts.ts` `usdToAtomic`; `src/resource/pricing.ts` `registerUsdcMoneyParser` | `test/amounts.test.ts` "converts $0.01 to 10,000", "converts $0.005 to 5,000", "would be wrong with 18" | `evidence/local-demo.txt` shows `10000`/`5000` and 6 decimals | **Proven (local)** |
| 1.4 | Exact supported scheme and official facilitator implementation | `src/facilitator/app.ts` (`x402Facilitator`, `ExactEvmScheme`); `src/resource/app.ts` (`x402ResourceServer`, `paymentMiddlewareFromHTTPServer`) | `test/facilitator.test.ts` `/supported`; `test/resource.test.ts` 402 challenges | `evidence/facilitator-supported.json` | **Proven (local + testnet read-only startup)** |
| 1.5 | Fail startup on missing/inconsistent config | `src/config.ts` `ConfigError`, `load*Config`, `assertNetworkConsistency`; `src/facilitator/onchain.ts`; `src/facilitator/server.ts` token metadata check | `test/config.test.ts` (all cases); `test/onchain.test.ts` | Startup logs in `evidence/facilitator-smoke.log`; negative tests | **Proven (local + testnet read-only)** |
| 1.6 | No mainnet/mock fallback | `assertNetworkConsistency` rejects `eip155:1672`, chain `1672`, substituted token, 18 decimals; no fallback constants | `test/config.test.ts` mainnet/token/decimals cases; `test/amounts.test.ts` missing-parser startup failure | Config tests | **Proven (local)** |
| 2.1 | `GET /health` free, HTTP 200 | `src/resource/app.ts`, registered before payment middleware | `test/resource.test.ts` "returns HTTP 200 without a payment challenge" | `npm run demo:local`; `evidence/resource-health.json` | **Proven (local + testnet read-only startup)** |
| 2.2 | `GET /data` paid $0.01 | `src/routes.ts` `amount: "10000"`; `src/resource/app.ts` | `test/resource.test.ts` "returns HTTP 402 ... for /data", "valid payments ... for /data" | `evidence/data-402-decoded.json` | **Proven (local)** |
| 2.3 | `GET /api/info` paid $0.005 | `src/routes.ts` `amount: "5000"` | `test/resource.test.ts` "lower $0.005 price", "protected info payload" | `evidence/info-402-decoded.json` | **Proven (local)** |
| 2.4 | Unpaid requests return 402 + `PAYMENT-REQUIRED` | `@x402/express` middleware in `src/resource/app.ts` | `test/resource.test.ts` 402 tests | `evidence/data-402-headers.txt`, decoded JSON | **Proven (local + testnet read-only startup)** |
| 2.5 | Correct SDK amount format | `src/routes.ts` + `usdToAtomic`; startup `assertRoutePricing` | `test/amounts.test.ts` "passes the startup pricing assertion" | Local demo decoded amounts | **Proven (local)** |
| 3.1 | `GET /supported` | `src/facilitator/app.ts` | `test/facilitator.test.ts` "advertises exact on eip155:688689" | `evidence/facilitator-supported.json` | **Proven (local + testnet read-only startup)** |
| 3.2 | `POST /verify` | `src/facilitator/app.ts`, `src/facilitator/validation.ts` | `test/facilitator.test.ts` validation and payment cases | Facilitator test output | **Proven (local)** |
| 3.3 | `POST /settle` | `src/facilitator/app.ts`, `src/facilitator/ledger.ts` | `test/facilitator.test.ts` settle cases | Facilitator test output; stub only | **Proven (local, no chain)** |
| 3.4 | Validate bodies / malformed payloads / status codes | `src/facilitator/validation.ts` zod schemas; 400 vs 200 semantics | `test/facilitator.test.ts` malformed envelope, malformed JSON, unsupported version | Facilitator test output | **Proven (local)** |
| 3.5 | Never equate signature verification with settlement | `/verify` does not call `settle`; `/settle` uses `facilitator.settle`; failure returns `success:false, transaction:""` | `test/facilitator.test.ts` "accepts ... without settling", invalid signature settle, transient failure | Code + tests | **Proven (local)** |
| 3.6 | `/settle` returns real settlement result/hash | `facilitator.settle` from `@x402/core`; `ExactEvmScheme` returns hash after receipt | `test/facilitator.test.ts` "returns the real settlement transaction hash" (stub hash, labelled local) | Stub only; **live hash unproven** | **Proven (local protocol), live Unproven** |
| 3.7 | Resource server contacts our facilitator | `HTTPFacilitatorClient({ url: FACILITATOR_URL })` in `src/resource/app.ts` | `test/resource.test.ts` valid payments require facilitator; startup fails if unreachable | `evidence/resource-smoke.log` points to port 4122 | **Proven (local + testnet read-only startup)** |
| 4.1 | Official `wrapFetchWithPayment` client | `src/client/paying-fetch.ts`; `src/client/flow.ts` | `test/flow.test.ts` end-to-end | `npm run demo:local` transcript | **Proven (local)** |
| 4.2 | Show initial 402 and requirements/price | `src/client/flow.ts` steps 1-2 | `test/flow.test.ts` asserts `initialStatus === 402` and amount | `evidence/local-demo.txt` | **Proven (local)** |
| 4.3 | Signed payer authorization | `src/client/flow.ts` step 3; `ExactEvmScheme` | `test/flow.test.ts` checks from/to/value | `evidence/local-demo.txt` | **Proven (local)** |
| 4.4 | Retry with x402 payment header | `src/client/flow.ts` step 4; capture fetch | `test/flow.test.ts` | `evidence/local-demo.txt` | **Proven (local)** |
| 4.5 | Verification + actual on-chain settlement | `src/client/flow.ts` step 5; live receipt branch | Local path proven with stub; live branch requires funded run | **No live receipt** | **Unproven (live)** |
| 4.6 | HTTP 200 protected data | `src/resource/app.ts`; `src/client/flow.ts` step 6 | `test/resource.test.ts`, `test/flow.test.ts` | `evidence/local-demo.txt` | **Proven (local)** |
| 4.7 | Decode and print `PAYMENT-RESPONSE` | `src/client/flow.ts` step 7 | `test/flow.test.ts` | `evidence/local-demo.txt` | **Proven (local)** |
| 4.8 | Print actual settlement transaction hash | `src/client/flow.ts` step 8; `src/client/demo.ts` evidence | Local stub only; live receipt branch verifies hash | `evidence/local-demo.txt` (stub) | **Proven (local stub), live Unproven** |
| 4.9 | Clickable PharosScan link from verified network + actual hash | `src/network.ts` `explorerTxUrl`; `src/client/flow.ts` step 9 | `test/network.test.ts` link construction; live branch requires receipt | No live link yet | **Unproven (live)** |
| 5.1 | Malformed payment rejected 402 | `@x402/express` middleware | `test/resource.test.ts` malformed header | Test output | **Proven (local)** |
| 5.2 | Invalid signature rejected | facilitator `ExactEvmScheme` | `test/facilitator.test.ts`, `test/resource.test.ts` | Test output | **Proven (local)** |
| 5.3 | Underpayment rejected | amount/value check in `ExactEvmScheme`; route price enforcement | facilitator + resource underpaid tests | Test output | **Proven (local)** |
| 5.4 | Wrong recipient/network rejected | EVM scheme + facilitator prechecks | facilitator wrong recipient/network; resource wrong network | Test output | **Proven (local)** |
| 5.5 | Invalid/expired authorization rejected | EVM scheme `validBefore`/`validAfter` and nonce checks | expired, not-yet-valid, replayed nonce tests | Test output | **Proven (local)** |
| 5.6 | Rejections do not expose protected data | Middleware returns empty 402 body | `expectNoProtectedData` in `test/resource.test.ts` | Test output | **Proven (local)** |
| 5.7 | No double settlement on retry | `SettlementLedger` + nonce replay rejection | "does not settle twice", "replayed nonce", resource replay test | Test output | **Proven (local)** |
| 6.1 | Keys via env/ignored file | `src/config.ts` `readPrivateKey` | `test/config.test.ts` env/file/missing/both cases | Startup smoke used an ephemeral env key (not recorded) | **Proven (local)** |
| 6.2 | `.env.example` placeholders only | `.env.example` | `test/security.test.ts` | File | **Proven (local)** |
| 6.3 | Secrets ignored by Git | `.gitignore` | `test/security.test.ts`; `git check-ignore` | Final Git audit | **Proven (local)** |
| 6.4 | Never hardcode/print keys | no key literals; logger redaction; evidence redaction; live gate | `test/security.test.ts`; config error sentinel test | Source + `evidence/live-gate.txt` | **Proven (local)** |
| 6.5 | Separate payer/facilitator config | distinct variables and loaders | `test/config.test.ts` | `.env.example` | **Proven (local)** |
| T.1 | Automated tests for all six areas | 8 test files, 83 tests | `npm test` | `evidence/test-results.txt` | **Proven (local)** |
| T.2 | Type checking and lint | TypeScript + ESLint | `npm run typecheck`, `npm run lint` | `evidence/typecheck.txt`, `evidence/lint.txt` | **Proven (local)** |
| D.1 | README, matrix, reviewer guide, verified output | `README.md`, `docs/*` | - | This repository | **Proven (local)** |
| D.2 | No secrets tracked / no push | `.gitignore`; local Git audit | `git status`, `git check-ignore`, grep | Final report | **Proven (local)** |
| L.1 | Real Atlantic payment + explorer link | `npm run demo` live branch | Not executed | **Pending approval + funding** | **Unproven** |

## Live evidence gap

The only unproven requirements are the live-chain parts of 3.6, 4.5, 4.8, 4.9,
and L.1. They require:

1. a payer wallet funded with Atlantic test USDC and a facilitator wallet
   funded with PHRS;
2. explicit approval to broadcast;
3. `LIVE_PAYMENT_APPROVED=YES` and a local `.env` (never shared in chat).

Until a real transaction hash and receipt are captured, this repository does
not claim live settlement.
