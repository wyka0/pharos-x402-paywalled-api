# Pharos x402 Paywalled API

A complete, reviewer-ready x402 pay-per-request API for **Pharos Atlantic Testnet** (`eip155:688689`), with:

1. a resource API (`/health`, `/data`, `/api/info`);
2. a self-hosted facilitator (`/supported`, `/verify`, `/settle`);
3. a payment client using the official `@x402/fetch` integration.

> **Live status:** All local tests pass and the API/facilitator have been started against the official Atlantic RPC in read-only mode. **No live payment has been broadcast yet.** It is blocked on an approved funded payer wallet and an approved live run. See [docs/verified-output.md](docs/verified-output.md).

## Verified network and token

| Parameter | Value | Source |
| --- | --- | --- |
| Network | `eip155:688689` | [Atlantic Testnet](https://docs.pharos.xyz/getting-started/network/atlantic-testnet) |
| Chain ID | `688689` | Atlantic Testnet docs |
| RPC | `https://atlantic.dplabs-internal.com` | Atlantic Testnet docs |
| Explorer | `https://atlantic.pharosscan.xyz` | Atlantic Testnet docs |
| Test USDC | `0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B` | [Token Registry](https://docs.pharos.xyz/getting-started/token-registry) |
| USDC name / version | `USDC` / `2` | Read on-chain; used as the EIP-712 domain |
| USDC decimals | `6` | Token Registry and on-chain `decimals()` |
| Scheme | `exact` (EIP-3009) | Official x402 EVM scheme |

The registry token is an upgradeable proxy. Its implementation at
`0x02C3FE2d1700814Ec27da9E447F7957329C96126` contains the EIP-3009
`transferWithAuthorization`, `receiveWithAuthorization`, and
`authorizationState` entry points. `npm run verify:network` records the
read-only proof. The token can be inspected at
[PharosScan](https://atlantic.pharosscan.xyz/address/0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B).

The x402 guide also mentions `0xE0BE08c77f415F577A1B3A9aD7a1Df1479564ec8` but
explicitly says it is **not an official address**. That contract exposes no
EIP-3009 functions, so the `exact` scheme cannot settle with it. This project
deliberately uses the official Token Registry address instead. See
[docs/verified-output.md](docs/verified-output.md) for the evidence.

## Architecture

```text
+-------------------+        1. GET /data (no payment)          +--------------------+
|   Payment client  | ----------------------------------------> |    Resource API    |
|  @x402/fetch      | <---------------------------------------- |  @x402/express     |
|  ExactEvmScheme   |      2. HTTP 402 + PAYMENT-REQUIRED       |  price middleware  |
|  (payer wallet)   |                                           +---------+----------+
|                   |                                                     |
|                   |        5. POST /verify  <--------------------------+
|                   |        6. POST /settle  <--------------------------+
|                   |                                                     |
|                   |                                           +---------v----------+
|                   |        3. retry + PAYMENT-SIGNATURE       |  Our facilitator  |
|                   | ----------------------------------------> |  @x402/core       |
|                   |                                           |  exact/EIP-3009   |
|                   |        7. HTTP 200 + PAYMENT-RESPONSE      |  (separate key)   |
|                   | <---------------------------------------- +---------+----------+
+-------------------+                                                     |
                                                                          | 8. transferWithAuthorization
                                                                          v
                                                              Pharos Atlantic Testnet
                                                              USDC 0xcfC8...Fc8B
```

Components:

- `src/resource/` - Express app, pricing, routes, paid handlers.
- `src/facilitator/` - self-hosted facilitator, body validation, settlement
  idempotency ledger, viem signer, on-chain startup checks.
- `src/client/` - paying fetch factory and the nine-step demo flow.
- `test/` - deterministic unit and HTTP integration tests. The settlement
  double uses the official `FacilitatorEvmSigner` interface; it never
  broadcasts.
- `scripts/` - local demo and read-only network verification.
- `evidence/` - captured outputs. Local-stub evidence is labelled as such.

## Routes and prices

| Route | Price | Atomic amount (6 decimals) | Payment |
| --- | --- | --- | --- |
| `GET /health` | Free | - | None |
| `GET /data` | `$0.01` test USDC | `10000` | x402 `exact` |
| `GET /api/info` | `$0.005` test USDC | `5000` | x402 `exact` |

Prices are defined once in `src/routes.ts` and converted with the token's
**ERC-20** decimals (6), never the native gas token's 18 decimals. Startup
asserts that the SDK parser produces exactly `10000` and `5000` atomic units.

An unpaid request returns HTTP `402` with the standard base64
`PAYMENT-REQUIRED` header. The body is intentionally empty; the machine-readable
requirements are in the header. Protected data is only produced after
verification **and** settlement succeed.

## Quick start

Prerequisites:

- Node.js 20.19+ (tested on Node 24)
- npm 10+
- Two separate testnet wallets: a payer and a facilitator signer
- Test USDC for the payer and PHRS for the facilitator's gas

```bash
npm install
cp .env.example .env          # bash
# Copy-Item .env.example .env # PowerShell
# Edit .env: set PAY_TO_ADDRESS, FACILITATOR_PRIVATE_KEY or ..._FILE,
# and (for the live demo only) PAYER_PRIVATE_KEY or ..._FILE.
```

Start the facilitator and the API in two terminals:

```bash
npm run start:facilitator   # default http://127.0.0.1:4022
npm run start:api           # default http://127.0.0.1:4021
```

Check the free route and the 402 challenge:

```bash
curl -i http://127.0.0.1:4021/health
curl -i http://127.0.0.1:4021/data
curl -i http://127.0.0.1:4021/api/info
```

Run the full local demo (no wallet, no chain broadcast):

```bash
npm run demo:local
```

It exercises the real middleware, the real facilitator HTTP endpoints, and the
real `wrapFetchWithPayment` client against an in-memory signer. It writes
`evidence/local-demo.txt` and `evidence/local-demo.json` and clearly labels the
result as **not on-chain**.

## Configuration

All values are validated at startup. Missing or inconsistent values stop the
process with a clear error; there is no mainnet or mock fallback.

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `PAY_TO_ADDRESS` | API | yes | Payment recipient; must not be zero |
| `FACILITATOR_URL` | API | yes | e.g. `http://127.0.0.1:4022`; HTTPS in production |
| `PORT` | API | no | default `4021` |
| `TRUST_PROXY` | API | no | `true` behind a reverse proxy so `resource.url` uses HTTPS |
| `FACILITATOR_TIMEOUT_MS` | API | no | default `30000` |
| `FACILITATOR_PORT` | facilitator | no | default `4022` |
| `RPC_URL` | facilitator/client | no | default official Atlantic RPC |
| `FACILITATOR_PRIVATE_KEY` | facilitator | one source | 32-byte hex; pays gas; never logged |
| `FACILITATOR_PRIVATE_KEY_FILE` | facilitator | one source | ignored local file |
| `FACILITATOR_CONFIRMATION_TIMEOUT_MS` | facilitator | no | default `60000` |
| `FACILITATOR_RATE_LIMIT_ENABLED` | facilitator | no | default `true`; per-process limiter |
| `FACILITATOR_VERIFY_LIMIT_PER_MINUTE` | facilitator | no | default `120`; per client IP |
| `FACILITATOR_SETTLE_LIMIT_PER_MINUTE` | facilitator | no | default `30`; per client IP |
| `FACILITATOR_MAX_CONCURRENT_SETTLEMENTS` | facilitator | no | default `2`; per process |
| `FACILITATOR_TRUST_PROXY_HOPS` | facilitator | no | default `0` (ignore XFF); use only the verified hop count, never a boolean |
| `PAYER_PRIVATE_KEY` | client | live demo only | separate wallet; never logged |
| `PAYER_PRIVATE_KEY_FILE` | client | live demo only | ignored local file |
| `API_URL` | client | no | default `http://127.0.0.1:4021` |
| `DEMO_ROUTE` | client | no | `/data` (default) or `/api/info` |
| `LIVE_PAYMENT_APPROVED` | client | live demo only | must be exactly `YES` |
| `NETWORK`, `CHAIN_ID`, `USDC_*` | all | no | if set, must match the verified Atlantic values |

Provide exactly one key source per role. If both the inline key and the file
variable are set, startup fails.

### Secret handling

- `.env`, `.env.*` (except `.env.example`), `.secrets/`, `.private_key`, and
  `*.key` are ignored by Git.
- `.env.example` contains placeholders only.
- Private keys are loaded into memory, never printed, never placed in a
  request header, and never written to evidence.
- Evidence redacts the EIP-712 signature.
- Tests scan `src/` for hardcoded key patterns.
- The payer and facilitator keys must be separate wallets.
- The client configures the SDK spend controls to allow only the verified
  Atlantic USDC, with a `0.10` USDC per-payment cap (`MAX_PAYMENT_ATOMIC`).

For least privilege, run each component with only its own variables: the
resource API needs no private key, the facilitator needs only
`FACILITATOR_*`, and the client needs only `PAYER_*`. Use separate process
environments or secret scopes in production rather than one shared `.env`.

## Commands

| Purpose | Command |
| --- | --- |
| Install exact dependencies | `npm install` |
| Type check | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit + integration tests | `npm test` |
| All checks | `npm run check` |
| Build to `dist/` | `npm run build` |
| Start facilitator (dev) | `npm run start:facilitator` |
| Start API (dev) | `npm run start:api` |
| Full local demo (no broadcast) | `npm run demo:local` |
| Read-only token/network verification | `npm run verify:network` |
| Live payment demo (approval required) | `npm run demo` |
| Run built services | `npm run start:facilitator:prod`, `npm run start:api:prod` |

## Facilitator API

The facilitator uses `x402Facilitator` and `ExactEvmScheme` from
`@x402/evm/exact/facilitator`, registered for `eip155:688689`.

### `GET /supported`

Returns the SDK-supported response:

```json
{
  "kinds": [{ "x402Version": 2, "scheme": "exact", "network": "eip155:688689" }],
  "extensions": [],
  "signers": { "eip155:*": ["0x..."] }
}
```

### `POST /verify`

Body: `{ x402Version, paymentPayload, paymentRequirements }`.

- Structurally invalid body -> HTTP `400`, `{ "error": "invalid_request", "details": [...] }`.
- Valid envelope but unsupported network/asset/scheme/domain -> HTTP `200`,
  `{ "isValid": false, "invalidReason": "...", "invalidMessage": "..." }`.
- Valid payment -> HTTP `200`, `{ "isValid": true, "payer": "0x..." }`.

`/verify` **never broadcasts** and never claims settlement.

Both `POST` routes use the separate abuse budgets described in
[Facilitator abuse protection](#facilitator-abuse-protection). An over-budget
request gets HTTP `429` with `Retry-After`; it does not run verification or
settlement.

### `POST /settle`

- Same validation rules.
- A valid payment -> HTTP `200`, `{ "success": true, "transaction": "0x...", "network": "eip155:688689", "payer": "0x..." }`.
- A rejected payment -> HTTP `200`, `{ "success": false, "transaction": "", "errorReason": "..." }`.
- The transaction hash is the one returned by the EVM scheme after it broadcast
  and confirmed `transferWithAuthorization`. There is no fake success path.
- Retries with the same body are idempotent: the original receipt is returned
  with `X-X402-Settlement-Reused: true` and no second transaction. Failures are
  not cached, so a transient RPC failure can be retried.

## Tests

`npm test` currently runs **117 tests** across 10 files:

- `test/config.test.ts` - startup validation, mainnet/token/decimal rejection,
  key-source rules, live-payment gate.
- `test/network.test.ts` - network constants, decimals separation, explorer URL
  construction.
- `test/amounts.test.ts` - `$0.01` -> `10000`, `$0.005` -> `5000`, precision
  rejection, SDK parser and startup pricing assertion.
- `test/onchain.test.ts` - chain/token name/version/decimals checks.
- `test/facilitator.test.ts` - `/supported`, malformed bodies, valid/invalid
  verification, underpayment, wrong recipient/network/asset/scheme/domain,
  expiry, settlement hash, double-settlement retry, transient failure.
- `test/resource.test.ts` - free health, 402 challenges for both prices,
  malformed header, valid payments + `PAYMENT-RESPONSE`, replay, negative cases,
  no protected data on rejection.
- `test/flow.test.ts` - the official `wrapFetchWithPayment` flow end to end
  against a local stub signer.
- `test/rate-limit.test.ts` - fixed-window budgets, `429`/`Retry-After`,
  case/trailing-slash normalization, trusted-proxy behavior, settle concurrency,
  idempotent retries, malformed and oversized bodies.
- `test/security.test.ts` - no hardcoded keys, ignore rules, placeholder-only
  `.env.example`, approval gate.

Local tests use an in-memory implementation of the official facilitator signer.
They prove protocol, HTTP, validation, and idempotency behavior, but they are
**not** on-chain settlement evidence.

## Deployment

Deploy the facilitator and API as two services (or two processes on one host):

1. Set `FACILITATOR_URL` on the API to the public HTTPS URL of the facilitator.
2. Set `PORT`/`FACILITATOR_PORT` as required by the platform.
3. Set `TRUST_PROXY=true` when TLS terminates at a reverse proxy.
4. Inject secrets through the platform's secret manager or environment
   variables. Never commit them.
5. Fund the facilitator signer with PHRS for gas. The payer only needs USDC
   because EIP-3009 settlement is submitted by the facilitator.
6. Keep the resource server and facilitator on testnet only. The code rejects
   any other `NETWORK`, `CHAIN_ID`, or USDC address.

Limitations:

- The settlement idempotency ledger is in-memory and single-instance. For
  multiple facilitator replicas, replace it with a shared store (for example
  Redis) keyed by the same settlement key.
- The facilitator's limiter is also in-memory and per-instance. It protects the
  single-replica testnet demo but is not a distributed quota; use an edge or
  shared limiter for broad public exposure.
- The exact Railway reverse-proxy hop count cannot be verified from this
  repository. Keep `FACILITATOR_TRUST_PROXY_HOPS=0` (fail-closed) until a
  controlled post-deployment check confirms the chain; then set exactly that
  integer. Setting it above the real count can trust a client-controlled
  `X-Forwarded-For` entry.
- The public Atlantic RPC is rate-limited. Production deployments should use a
  dedicated RPC provider.
- The official docs do not document a USDC faucet. Funding test USDC is an
  operator prerequisite; this project does not guess a faucet URL.

### Facilitator abuse protection

The facilitator applies an in-memory, per-resolved-client-address (`req.ip`)
fixed-window budget to its two expensive routes, with a separate budget for
each:

| Route | Default budget | Scope |
| --- | --- | --- |
| `POST /verify` | 120 requests / 60 s | per resolved client address, per process |
| `POST /settle` | 30 requests / 60 s | per resolved client address, per process |
| `POST /settle` | 2 concurrent requests | global, per process |

- Over-budget requests get HTTP `429`, a `Retry-After` header in whole seconds,
  `Cache-Control: no-store`, and `{ "error": "rate_limited", "message": "..." }`.
  The response contains no signer, recipient, payload, or transaction data.
- The limiter runs before JSON parsing, so rejected attempts are cheap. The body
  limit remains 256 KB; oversized bodies now return `413` instead of a generic
  `500`.
- `FACILITATOR_TRUST_PROXY_HOPS` controls whether `X-Forwarded-For` is trusted.
  `0` (the default and the safe initial setting) ignores it entirely. That is
  fail-closed against spoofing, but all requests may then share the platform
  edge/API address, making the budgets effectively global. A positive integer
  trusts exactly that many reverse-proxy hops and uses the rightmost
  proxy-added address. Set it only after verifying the actual hop count; a
  value higher than the real number can trust a client-controlled entry.
  Only raise it above `0` when every request is forced through that exact
  proxy chain and the service cannot be reached directly. Booleans are
  rejected by configuration validation.
- Counters live in memory and reset on restart. With one replica, the limits are
  effective for this demo; they are not global across replicas. For multiple
  replicas or serious public traffic, use a shared edge/gateway limiter and a
  shared settlement ledger.
- Per-IP limits are approximate under NAT (many users share one key) and can be
  diluted by IPv6 rotation or a large pool of source addresses. They are an
  abuse brake, not a substitute for signature, amount, recipient, chain, domain,
  nonce, and replay validation, which remain unchanged.
- In this topology the facilitator's direct client is the resource API, not the
  browser. These budgets therefore act as a per-API-instance quota for
  API-driven payments (effectively global with one API replica). Direct callers
  to the public facilitator URL are keyed by their own IP only after the exact
  trusted-proxy hop count is configured; with the safe initial `0`, all callers
  may share the immediate platform/edge address. Add end-user quotas at the
  edge or resource API if per-browser fairness is needed.
- Retries within the budget still use the settlement ledger's idempotency: the
  same payload returns the original receipt and writes no second transaction.
  A client that receives `429` should wait for `Retry-After` before retrying.

### Concrete deployment shape

Two services, built from the same commit:

| Service | Build | Start | Required env |
| --- | --- | --- | --- |
| Facilitator | `npm ci && npm run build` | `node dist/src/facilitator/server.js` | `FACILITATOR_PRIVATE_KEY` or `_FILE`, `RPC_URL` |
| Resource API | `npm ci && npm run build` | `node dist/src/resource/server.js` | `PAY_TO_ADDRESS`, `FACILITATOR_URL`, `TRUST_PROXY=true` |

Health checks: `/health` on both services. The API's `FACILITATOR_URL` must be
the facilitator's public HTTPS URL (for example
`https://facilitator.example.com`). A minimal Caddy reverse proxy:

```caddyfile
api.example.com {
  reverse_proxy 127.0.0.1:4021
}
facilitator.example.com {
  reverse_proxy 127.0.0.1:4022
}
```

Use the platform's secret manager for keys; do not bake `.env` into an image.
Reviewers can then call `https://api.example.com/data`, receive the 402
challenge, and use the payment client against that URL. Keep the deployment on
Atlantic Testnet and monitor the facilitator's PHRS balance.

### Railway (facilitator and resource API)

Deploy both services from the repository root as two Railway services. Railpack
builds with `npm ci` + `npm run build` (the root `engines` field pins Node >=
20.19), then runs the configured start command:

| Setting | Facilitator service | Resource API service |
| --- | --- | --- |
| Build command | `npm run build` | `npm run build` |
| Start command | `node dist/src/facilitator/server.js` | `node dist/src/resource/server.js` |
| Healthcheck path | `/health` | `/health` |
| Replicas | 1 - do not scale out | 1 - do not scale out |

- Railway injects `PORT` into each service and health-checks that same port.
  The API reads `PORT` directly; the facilitator uses it as a fallback when
  `FACILITATOR_PORT` is unset. **Do not set `FACILITATOR_PORT` on Railway**
  (when both are set, `FACILITATOR_PORT` stays authoritative).
- Leave `NODE_ENV` unset: setting it to `production` makes `npm ci` skip
  devDependencies (including TypeScript) and the build fails.
- Set `TRUST_PROXY=true` on the API. Railway's edge always sends
  `X-Forwarded-Proto: https`; without it the 402 `resource.url` would
  advertise `http://`.
- Keep `FACILITATOR_TRUST_PROXY_HOPS=0` on the first deployment. That is the
  fail-closed setting: Express ignores `X-Forwarded-For`, so a client cannot
  spoof its limiter key, though all requests may share Railway's edge/API
  address and the budgets become effectively global. The exact hop count
  cannot be verified without a deployment; after a controlled check confirms
  it, set exactly that integer (for example `1` only if Railway is confirmed
  to add exactly one trusted hop). Never set it above the verified count or to
  `true`. The limiter is in-memory, so keep the facilitator at one replica.
- Deploy order: facilitator first, then the API. The API refuses to start
  until `FACILITATOR_URL` answers `/supported`; Railway's restart policy retries
  it automatically until the facilitator is up.
- Keep exactly one replica of each service until the settlement ledger has
  shared storage (see Limitations). Do not enable horizontal scaling or
  multi-region replicas.
- `/health` on both services is static and never calls the testnet RPC, so a
  rate-limited public RPC cannot fail a Railway healthcheck. Startup does run
  read-only RPC checks (chain ID, token metadata); if the RPC is rate-limited
  at boot the process exits and Railway restarts it.
- To prevent automatic deploys before approval, disconnect the source branch
  in the service settings (Railway auto-deploys only from a connected branch),
  or create the services only when the deployment is approved.
- Leave `PAYMENT_DEMO_ENABLED` and `LIVE_PAYMENT_APPROVED` unset on both
  services until a live payment is explicitly approved.

### Vercel dashboard

- Root Directory `web`. Set the server-only variables `API_ORIGIN` and
  `FACILITATOR_ORIGIN` to the public HTTPS URLs of the two Railway services.
- Vercel cannot reach Railway private hostnames (`*.railway.internal`), so the
  facilitator needs a public HTTPS domain (Railway-provided or custom) for the
  status page. Its `/verify` and `/settle` endpoints become internet-reachable
  that way but only act on authorizations that a payer signed; keep the service
  on Atlantic Testnet as the network guards require.
- Use the public HTTPS URL for the API's `FACILITATOR_URL`. The API's `/health`
  echoes that URL, so a private `*.railway.internal` hostname would leak into a
  public health response. Private networking is runtime-only and is not used by
  the Vercel status proxy.
- The browser never calls either service directly; the Next.js route handlers
  proxy everything server-side, so no CORS or public API keys are needed.

### Funding check (read-only, public addresses only)

`npm run balances` accepts an address, never a key, and prints the PHRS native
balance (facilitator gas) and the test USDC balance (payer):

```powershell
npm run balances -- 0xYourPublicAddress
```

It performs two read-only RPC calls. The facilitator signer address is printed
at startup (and appears in `GET /health` as `signers`); the payer address comes
from the payer wallet.

## Live payment evidence

No live payment has been executed. `npm run demo` is deliberately blocked
unless `LIVE_PAYMENT_APPROVED=YES` is set. When approved and funded, it prints
the nine required steps, verifies the receipt and the USDC `Transfer` log, and
writes a redacted evidence file plus the PharosScan link:

```text
https://atlantic.pharosscan.xyz/tx/<actual-returned-transaction-hash>
```

See [docs/reviewer-guide.md](docs/reviewer-guide.md) for the exact runbook and
[docs/verified-output.md](docs/verified-output.md) for the captured local and
read-only testnet evidence.
