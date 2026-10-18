# Reviewer Guide

This guide separates **local/deterministic checks** from **live Atlantic
Testnet** checks. Do not treat a local stub receipt as on-chain evidence.

## 0. What you need

- Node.js 20.19+ and npm
- No wallet or funds for steps 1-5
- For the live run only:
  - a payer wallet funded with Atlantic test USDC
  - a facilitator wallet funded with PHRS for gas
  - a separate `PAY_TO_ADDRESS`
  - explicit approval to broadcast a testnet transaction

There is no documented official USDC faucet in the Pharos docs. Obtain test
USDC through the official Pharos channels available to you; do not substitute a
different token address.

## 1. Inspect the verified constants

Open:

- `src/network.ts`
- `src/routes.ts`
- `docs/verified-output.md`
- `evidence/network-verification.json`

Confirm:

- `NETWORK = "eip155:688689"`
- `USDC_ADDRESS = 0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B`
- `USDC_DECIMALS = 6`
- `USDC_NAME = "USDC"`, `USDC_VERSION = "2"`
- `/data` -> `10000` atomic; `/api/info` -> `5000` atomic

`npm run verify:network` re-checks these directly against the official RPC. It
only reads; it never sends a transaction.

## 2. Install and run the static checks

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Expected current result: **83 passing tests in 8 files**. The tests use a
deterministic in-memory implementation of the official `FacilitatorEvmSigner`.
They exercise the real Express middleware, the real facilitator HTTP endpoints,
and the real `@x402/fetch` client. They do **not** broadcast.

## 3. Run the full local demo (no wallet, no chain)

```bash
npm run demo:local
```

This starts a temporary facilitator and resource API on loopback, pays both
routes with a random local key, and prints all nine demo steps. It writes:

- `evidence/local-demo.txt`
- `evidence/local-demo.json`

Look for:

- `HTTP 402` on the first request
- `amountAtomic: "10000"` and `"5000"`
- `PAYMENT-SIGNATURE` on the retry
- `HTTP 200` with protected data
- `PAYMENT-RESPONSE` decoding
- the explicit line `LOCAL STUB: this hash was produced by the in-memory test signer`
- `N/A in local-stub mode`

The last two lines are intentional. A local stub hash is not on-chain evidence.

## 4. Start the real services against Atlantic (read-only)

This proves startup validation, `/supported`, the 402 headers, and the
resource-to-facilitator wiring against the official RPC. It does not broadcast.

Create an ignored secrets directory and a throwaway facilitator key without
printing it:

```bash
mkdir -p .secrets   # bash
# mkdir .secrets    # PowerShell
node -e "console.log('0x'+require('crypto').randomBytes(32).toString('hex'))" > .secrets/facilitator.key
node --input-type=module -e "import {privateKeyToAccount} from 'viem/accounts'; import {readFileSync} from 'node:fs'; console.log(privateKeyToAccount(readFileSync('.secrets/facilitator.key','utf8').trim()).address)"
```

Set `.env` (copied from `.env.example`):

```dotenv
PAY_TO_ADDRESS=0x...your receiving address...
FACILITATOR_URL=http://127.0.0.1:4022
FACILITATOR_PRIVATE_KEY_FILE=./.secrets/facilitator.key
RPC_URL=https://atlantic.dplabs-internal.com
```

Start in two terminals from the project root:

```bash
npm run start:facilitator
npm run start:api
```

Then:

```bash
curl -s http://127.0.0.1:4022/health
curl -s http://127.0.0.1:4022/supported
curl -s http://127.0.0.1:4021/health
curl -i http://127.0.0.1:4021/data
curl -i http://127.0.0.1:4021/api/info
```

Expected:

- facilitator health contains `network: "eip155:688689"` and the signer address;
- supported kinds contain `{ "scheme": "exact", "network": "eip155:688689" }`;
- both paid routes return `402` with a `PAYMENT-REQUIRED` header;
- no protected data is present in the 402 body.

The facilitator startup also reads the token's `name()`, `version()`, and
`decimals()` and fails if the RPC chain or token metadata is wrong. It warns if
the signer has zero PHRS; a live settlement will fail until that wallet is
funded.

## 5. Negative checks (automated, no chain)

The following are all in `npm test`:

```bash
npx vitest run test/resource.test.ts
npx vitest run test/facilitator.test.ts
```

They prove:

- malformed payment header -> 402, no data
- invalid signature -> 402 / `isValid:false` / `success:false`, no data
- underpayment -> 402, no data
- wrong recipient -> 402, no data
- wrong network -> 402, no data
- expired / not-yet-valid authorization -> 402
- replayed nonce -> rejected
- same settlement body retried -> one transaction, same receipt
- rejected payments never include `data.dataset` or the protected info payload

These are local tests. Do not cite them as live transaction evidence.

## 6. Live payment runbook (approval required)

Only after explicit approval and funding:

1. Generate a **separate** payer key without printing it:

   ```bash
   node -e "console.log('0x'+require('crypto').randomBytes(32).toString('hex'))" > .secrets/payer.key
   node --input-type=module -e "import {privateKeyToAccount} from 'viem/accounts'; import {readFileSync} from 'node:fs'; console.log(privateKeyToAccount(readFileSync('.secrets/payer.key','utf8').trim()).address)"
   ```

2. Fund the payer address with Atlantic test USDC.
3. Fund the facilitator signer address with PHRS for gas.
4. Set `PAYER_PRIVATE_KEY_FILE=./.secrets/payer.key` and
   `PAY_TO_ADDRESS=0x...` in `.env`.
5. Start the facilitator and API (step 4).
6. Run:

   ```bash
   npm run demo
   ```

   The demo refuses to sign unless `LIVE_PAYMENT_APPROVED=YES` is set. Set it
   only for the approved run:

   ```bash
   # PowerShell
   $env:LIVE_PAYMENT_APPROVED="YES"; npm run demo
   # bash
   LIVE_PAYMENT_APPROVED=YES npm run demo
   ```

7. Confirm the output includes:
   - initial 402 and the decoded requirements;
   - the signed authorization (from/to/value/nonce);
   - the retry header;
   - HTTP 200 protected data;
   - `PAYMENT-RESPONSE` with `success: true`;
   - a real 32-byte transaction hash;
   - receipt status `success`, block number, and a matching USDC `Transfer` log;
   - a PharosScan link of the form
     `https://atlantic.pharosscan.xyz/tx/<hash>`.
8. The demo writes `evidence/live-<timestamp>-<hash>.json` and `.txt`.

Do not share `.env` or key files. Do not paste a private key into chat.

## 7. Independently verify the live transaction

Open the printed PharosScan link. Confirm:

- status is success;
- the transaction target is USDC `0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B`;
- the `from` is the facilitator signer (it pays gas);
- the logs contain `Transfer(from=payer, to=PAY_TO_ADDRESS, value=10000 or 5000)`.

Or query the public RPC directly:

```bash
curl -s -X POST https://atlantic.dplabs-internal.com \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["0x<actual-hash>"]}'
```

Check `result.status == "0x1"` and inspect `result.logs`. If the transaction is
still pending, wait and repeat; do not call it settled without a receipt.

## 8. Deployment checklist

- Deploy the facilitator and API separately; set `FACILITATOR_URL` to the
  facilitator's public HTTPS URL.
- Use a secret manager or platform environment variables. Never commit `.env`.
- Set `TRUST_PROXY=true` behind TLS termination so `resource.url` uses HTTPS.
- Fund the facilitator signer with PHRS.
- Use a dedicated RPC endpoint for production; the public endpoint is
  rate-limited.
- The settlement ledger is in-memory. If you run more than one facilitator
  replica, replace it with a shared store keyed by the settlement key.
- Add rate limiting at the gateway; the app does not rate-limit clients.
- Keep the deployment on Atlantic Testnet. The code rejects other networks.

## 9. Troubleshooting

| Symptom | Cause / action |
| --- | --- |
| API exits with `Could not initialize ... facilitator` | Facilitator not running or `FACILITATOR_URL` wrong. Start it first. |
| Facilitator exits with chain ID mismatch | `RPC_URL` points to another network. Use the official Atlantic endpoint. |
| Facilitator exits with USDC metadata mismatch | Wrong `USDC_ADDRESS`/network, or RPC returned unexpected data. Do not bypass the check. |
| 402 but no `PAYMENT-RESPONSE` | Settlement failed. Inspect facilitator logs; check signer PHRS and payer USDC. |
| `invalid_exact_evm_insufficient_balance` | Fund the payer with the registry USDC. |
| `invalid_exact_evm_nonce_already_used` | Authorization was already settled; make a fresh request. |
| RPC `cu limit exceeded` / `Request too fast` | Public RPC rate limit. Wait, or use a dedicated RPC. The `verify:network` script spaces its calls. |
| `EADDRINUSE` | Change `PORT` or `FACILITATOR_PORT`. |
| `npm run demo` exits with "live payment not approved" | Set `LIVE_PAYMENT_APPROVED=YES` only when you intend to broadcast. |

## 10. What to cite as evidence

Use:

- `evidence/test-results.txt` for local tests;
- `evidence/local-demo.txt` for the local end-to-end flow (clearly labelled);
- `evidence/network-verification.json` for the read-only token/network proof;
- `evidence/live-gate.txt` for the explicit live-payment opt-in;
- `evidence/facilitator-health.json`, `facilitator-supported.json`, and the
  `*-402-decoded.json` files for the real startup/HTTP behavior;
- `evidence/startup-*.txt` for fail-fast configuration behavior;
- a future `evidence/live-*.json` only after a real receipt exists.

Do not cite the local stub transaction hashes as on-chain transactions.
