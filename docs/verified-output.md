# Verified Output

This file separates three kinds of evidence:

1. **Local deterministic tests** - no chain.
2. **Read-only Atlantic Testnet checks** - official RPC, no transaction.
3. **Live payment** - **not executed**; see the gap at the end.

No local stub hash in this repository is presented as an on-chain transaction.

## Environment

| Item | Value |
| --- | --- |
| Date of run | 2026-10-18 |
| OS | Windows (win32) |
| Node.js | v24.14.1 |
| npm | 11.11.0 |
| TypeScript | 5.9.3 |
| `@x402/core` | 2.28.0 |
| `@x402/express` | 2.28.0 |
| `@x402/evm` | 2.28.0 |
| `@x402/fetch` | 2.28.0 |
| `express` | 4.22.3 |
| `viem` | 2.57.7 |
| `zod` | 3.25.76 |

Commands were run from the repository root
(`C:\pharos-x402-paywalled-api`).

## 1. Static checks

```text
npm run typecheck   -> exit 0, no diagnostics
npm run lint        -> exit 0, no diagnostics
npm run build       -> exit 0, dist/ emitted
npm test            -> exit 0
```

Captured files:

- `evidence/typecheck.txt`
- `evidence/lint.txt`
- `evidence/build.txt`
- `evidence/test-results.txt`

## 2. Automated test result

```text
Test Files  8 passed (8)
Tests       83 passed (83)
```

Test areas:

| File | Focus | Result |
| --- | --- | --- |
| `test/config.test.ts` | startup validation, network/token guards, key sources, live gate | 19 passed |
| `test/network.test.ts` | constants, decimals, explorer URLs | 6 passed |
| `test/amounts.test.ts` | atomic conversion, route prices, SDK parser | 11 passed |
| `test/onchain.test.ts` | chain/token metadata checks | 5 passed |
| `test/facilitator.test.ts` | `/supported`, `/verify`, `/settle`, negative cases, idempotency | 22 passed |
| `test/resource.test.ts` | free/paid routes, 402 headers, valid flow, negative cases | 13 passed |
| `test/flow.test.ts` | official `wrapFetchWithPayment` end to end (stub signer) | 3 passed |
| `test/security.test.ts` | no hardcoded keys, ignore rules, placeholders, gate | 4 passed |

These are local tests. The facilitator signer is an in-memory test double that
implements the official `FacilitatorEvmSigner` interface. It verifies EIP-712
signatures and simulates EIP-3009 state, but it never broadcasts.

## 3. Read-only Atlantic Testnet verification

Command:

```bash
npm run verify:network
```

Captured in `evidence/network-verification.json`:

```json
{
  "checkedAt": "2026-10-18T00:32:19.804Z",
  "rpcUrl": "https://atlantic.dplabs-internal.com",
  "network": "eip155:688689",
  "expectedChainId": 688689,
  "observedChainId": 688689,
  "chainMatches": true,
  "blockNumber": "31555476",
  "token": {
    "address": "0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B",
    "name": "USDC",
    "symbol": "USDC",
    "version": "2",
    "decimals": 6,
    "totalSupplyAtomic": "100108337947829",
    "registrySource": "https://docs.pharos.xyz/getting-started/token-registry",
    "proxyCodeSizeBytes": 1798,
    "implementation": "0x02C3FE2d1700814Ec27da9E447F7957329C96126",
    "implementationCodeSizeBytes": 23464,
    "expected": { "name": "USDC", "version": "2", "decimals": 6 }
  },
  "eip3009Selectors": {
    "transferWithAuthorization": true,
    "receiveWithAuthorization": true,
    "authorizationState": true,
    "permit": true
  },
  "note": "Read-only RPC checks against the proxy and its implementation. No transaction was broadcast."
}
```

Why this matters:

- The registry address is an upgradeable proxy, so scanning the proxy bytecode
  alone would miss EIP-3009. The script resolves `implementation()` and scans the
  implementation.
- The EIP-712 domain used in code is `name=USDC`, `version=2`; both match the
  on-chain values.
- USDC is 6 decimals. The native gas token is 18 decimals; the code never uses
  the native value for ERC-20 amounts.

The other address mentioned in the x402 guide,
`0xE0BE08c77f415F577A1B3A9aD7a1Df1479564ec8`, is explicitly labelled "not an
official address" there. It exposes no EIP-3009 functions, so it cannot settle
with the `exact` scheme. It is rejected by this project's configuration guard.

## 4. Local end-to-end demo (no chain)

Command:

```bash
npm run demo:local
```

This starts a real facilitator HTTP app and a real resource API on loopback,
then uses the official `@x402/fetch` `wrapFetchWithPayment` client with a random
local key. The signer is an in-memory test double.

Captured in `evidence/local-demo.txt` and `evidence/local-demo.json`.

Key excerpts (from the `/data` run):

```text
Pharos x402 payment demo (LOCAL STUB - no chain broadcast)

[1/9] Initial request without a payment header: GET /data
      HTTP 402

[2/9] Payment requirements decoded from the PAYMENT-REQUIRED header
      PAYMENT-REQUIRED header length: 584 base64 characters
{
  "x402Version": 2,
  "resource": { "url": "http://127.0.0.1:48330/data", ... },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:688689",
      "asset": "0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B",
      "amountAtomic": "10000",
      "amountUsdc": "0.01",
      "maxTimeoutSeconds": 120,
      "extra": { "name": "USDC", "version": "2" }
    }
  ]
}
      Selected price: 0.01 USDC (10000 atomic units at 6 decimals)

[3/9] Payer 0x... signs the EIP-3009 authorization with ExactEvmScheme
      value:       10000 atomic (0.01 USDC)
      signature:   0x... (65 bytes)

[4/9] Retry carried PAYMENT-SIGNATURE
      header length: 1100 base64 characters
      decoded payload: x402Version=2, scheme=exact, network=eip155:688689, amount=10000

[5/9] Facilitator verification and settlement
      Local facilitator verified the authorization and returned a simulated receipt (no chain broadcast).

[6/9] Protected resource returned
      HTTP 200
      ... "paid": true, "data": { "dataset": "pharos-atlantic-sample", ... }

[7/9] PAYMENT-RESPONSE header decoded
      "success": true, "network": "eip155:688689", ...

[8/9] Settlement transaction
      LOCAL STUB: this hash was produced by the in-memory test signer, not by a blockchain.
      No receipt was fetched and no explorer link is produced.

[9/9] Explorer verification link
      N/A in local-stub mode (no on-chain transaction).
```

The second run used `/api/info` and produced `amountAtomic: "5000"`, HTTP 200,
and the same explicit local-stub warnings. Summary:

```text
/data: 10000 atomic USDC, HTTP 200, stub tx 0x...0001
/api/info: 5000 atomic USDC, HTTP 200, stub tx 0x...0002
```

The stub hashes are deliberately obvious (all-zero prefixes) and are not chain
evidence.

## 5. Live-payment safety gate

A live run was attempted only up to the approval gate, with a random local key
and `LIVE_PAYMENT_APPROVED=NO`:

```text
Invalid configuration:
  - live payment not approved: set LIVE_PAYMENT_APPROVED=YES ...
  - the demo is intentionally blocked by default; tests and `npm run demo:local` never broadcast
Nothing was signed. Nothing was broadcast.
exit code 2
```

Captured in `evidence/live-gate.txt`. This confirms the client refuses to sign or
broadcast without an explicit opt-in. No request reached the API and no key was
printed.

## 6. Real service startup against the official Atlantic RPC (read-only)
Two real Node processes were started from the built output with an ephemeral,
unfunded facilitator key:

- facilitator on `127.0.0.1:4122`
- resource API on `127.0.0.1:4121`
- `PAY_TO_ADDRESS=0x1111111111111111111111111111111111111111` (smoke-only)
- `RPC_URL=https://atlantic.dplabs-internal.com`

Startup log:

```json
{"level":"info","message":"facilitator listening","port":4122,"network":"eip155:688689","networkName":"Pharos Atlantic Testnet","chainId":688689,"asset":"0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B","assetName":"USDC","assetVersion":"2","assetDecimals":6,"signer":"0xBc6B...3E66","signerPhrsBalance":"0","settlementMode":"on-chain eip3009 transferWithAuthorization"}
{"level":"info","message":"resource API listening","port":4121,"network":"eip155:688689","chainId":688689,"asset":"0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B","assetDecimals":6,"prices":{"/data":"0.01 USDC (10000 atomic)","/api/info":"0.005 USDC (5000 atomic)"}}
```

The facilitator warned that the ephemeral signer had zero PHRS. It still
started because configuration and token metadata were valid; settlement would
fail until funded. This is intentional and honest startup behavior.

`GET /supported` (`evidence/facilitator-supported.json`):

```json
{
  "kinds": [{ "x402Version": 2, "scheme": "exact", "network": "eip155:688689" }],
  "extensions": [],
  "signers": { "eip155:*": ["0xBc6B7b90478037E803b056dC384F6199C83b3E66"] }
}
```

`GET /health` (`evidence/resource-health.json`) reported:

```json
{
  "status": "ok",
  "network": "eip155:688689",
  "chainId": 688689,
  "asset": { "address": "0xcfC8...Fc8B", "symbol": "USDC", "name": "USDC", "version": "2", "decimals": 6 },
  "prices": { "/data": { "usd": "0.01", "atomic": "10000" }, "/api/info": { "usd": "0.005", "atomic": "5000" } }
}
```

`GET /data` and `GET /api/info` returned HTTP 402 with `PAYMENT-REQUIRED`
headers. Decoded `/data` (`evidence/data-402-decoded.json`):

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": { "url": "http://127.0.0.1:4121/data", "mimeType": "application/json", ... },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:688689",
      "amount": "10000",
      "asset": "0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B",
      "payTo": "0x1111111111111111111111111111111111111111",
      "maxTimeoutSeconds": 120,
      "extra": { "name": "USDC", "version": "2" }
    }
  ]
}
```

The `/api/info` decode is identical except `amount: "5000"` and its resource
description (`evidence/info-402-decoded.json`).

No transaction was broadcast in this section. The ephemeral key was not written
to the repository or evidence.

## 7. Live Atlantic Testnet payment

**NOT EXECUTED.**

There is no live transaction hash, no live receipt, and no live explorer link in
this repository. The demo's live branch is implemented, and the same flow is
exercised locally through the labelled stub settlement; the live receipt branch
has not been executed against a funded wallet because:

- broadcasting requires explicit approval;
- the payer and facilitator wallets are not configured/funded in this
  environment;
- the official Pharos docs do not document a USDC faucet, so obtaining test
  USDC is an operator prerequisite;
- the facilitator signer used for the smoke test had `0` PHRS.

The live branch will only claim success after it:

1. receives `success: true` and a 32-byte transaction hash in
   `PAYMENT-RESPONSE`;
2. fetches the receipt and confirms `status == "success"`;
3. confirms the transaction target is the USDC contract;
4. finds a `Transfer(from=payer, to=payTo, value=required)` log;
5. builds the PharosScan link from `eip155:688689` and that actual hash.

Until then, the live requirements remain **unproven**.

### Exact next action

1. Create/fund a payer wallet with Atlantic test USDC.
2. Create/fund a separate facilitator wallet with PHRS.
3. Write the keys to ignored files under `.secrets/` (never paste them in chat).
4. Set `PAY_TO_ADDRESS`, `PAYER_PRIVATE_KEY_FILE`,
   `FACILITATOR_PRIVATE_KEY_FILE`, and `LIVE_PAYMENT_APPROVED=YES` in `.env`.
5. Start the facilitator and API, then run `npm run demo`.
6. Verify the printed receipt and explorer link, and add the captured
   `evidence/live-*.json` plus a short section here.

## 8. Evidence index

| File | Meaning |
| --- | --- |
| `evidence/test-results.txt` | 83 local tests passing |
| `evidence/typecheck.txt` | TypeScript clean |
| `evidence/lint.txt` | ESLint clean |
| `evidence/build.txt` | Production build succeeds |
| `evidence/network-verification.json` | Read-only Atlantic chain/token proof |
| `evidence/facilitator-health.json` | Real facilitator process health |
| `evidence/facilitator-supported.json` | Real `/supported` response |
| `evidence/resource-health.json` | Real resource API health |
| `evidence/data-402-headers.txt` | Real 402 headers for `/data` |
| `evidence/data-402-decoded.json` | Decoded `/data` requirements |
| `evidence/info-402-headers.txt` | Real 402 headers for `/api/info` |
| `evidence/info-402-decoded.json` | Decoded `/api/info` requirements |
| `evidence/facilitator-smoke.log` | Real startup log (no secrets) |
| `evidence/resource-smoke.log` | Real startup log (no secrets) |
| `evidence/local-demo.txt` | Local end-to-end transcript (labelled stub) |
| `evidence/local-demo.json` | Local summary (labelled `onChain: false`) |
| `evidence/live-gate.txt` | Proof the live client refuses to sign without approval |

## 9. Honest limitations

- The in-memory settlement ledger is single-instance; multi-replica deployment
  needs a shared store.
- The public RPC is rate-limited; `verify:network` spaces its calls, but a
  production deployment should use a dedicated endpoint.
- Local tests replace the facilitator signer with a test double. They prove
  protocol and HTTP behavior, not chain settlement.
- No live payment has been executed, so live settlement, the live transaction
  hash, and the live explorer link are **not** proven.
