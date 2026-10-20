import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { afterEach, describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  createFacilitatorApp,
  type FacilitatorRateLimitOptions,
} from "../src/facilitator/app.js";
import { FixedWindowRateLimiter } from "../src/facilitator/rate-limit.js";
import { USDC_ADDRESS } from "../src/network.js";
import {
  buildRequirements,
  newAccount,
  newKeyAccount,
  newNonce,
  signPayment,
  type TestAccount,
} from "./helpers/payment.js";
import { silentLogger, startApp, type RunningServer } from "./helpers/servers.js";
import { createStubSigner, type StubSigner } from "./helpers/stub-signer.js";

const runningServers: RunningServer[] = [];

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map((server) => server.close()));
});

interface TestFacilitator {
  url: string;
  stub: StubSigner;
  payer: TestAccount;
  payTo: Address;
}

async function startFacilitator(options: {
  rateLimit?: FacilitatorRateLimitOptions;
  trustProxyHops?: number;
}): Promise<TestFacilitator> {
  const signerAccount = newAccount();
  const stub = createStubSigner({
    address: signerAccount.address,
    token: USDC_ADDRESS,
  });
  const payer = newKeyAccount();
  const payTo = newAccount().address;
  const app = createFacilitatorApp({
    signer: stub.signer,
    logger: silentLogger,
    trustProxyHops: options.trustProxyHops,
    rateLimit: options.rateLimit,
  });
  const server = await startApp(app);
  runningServers.push(server);
  return { url: server.url, stub, payer: payer.account, payTo };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object response");
  }
  return value as Record<string, unknown>;
}

async function post(
  url: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  return await postRaw(url, path, JSON.stringify(body), headers);
}

async function postRaw(
  url: string,
  path: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text.length > 0 ? asRecord(JSON.parse(text)) : {},
    headers: response.headers,
  };
}

function envelope(payload: PaymentPayload, requirements: PaymentRequirements): unknown {
  return {
    x402Version: 2,
    paymentPayload: payload,
    paymentRequirements: requirements,
  };
}

async function waitFor(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("FixedWindowRateLimiter", () => {
  it("allows the configured budget, reports retry-after, and resets at the window boundary", () => {
    let now = 1_000_000;
    const limiter = new FixedWindowRateLimiter(2, 60_000, () => now);

    expect(limiter.check("ip-a")).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.check("ip-a")).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.check("ip-a")).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.check("ip-b")).toEqual({ allowed: true, retryAfterSeconds: 0 });

    now += 59_000;
    expect(limiter.check("ip-a").allowed).toBe(false);
    expect(limiter.check("ip-a").retryAfterSeconds).toBe(1);

    now += 1_000;
    expect(limiter.check("ip-a")).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("sweeps expired buckets so distinct keys do not accumulate forever", () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(1, 1_000, () => now);
    limiter.check("a");
    limiter.check("b");
    expect(limiter.size).toBe(2);

    now = 1_000;
    limiter.check("c");
    expect(limiter.size).toBe(1);
  });
});

describe("facilitator rate limiting", () => {
  it("enforces a per-client /verify budget with a safe 429 and Retry-After", async () => {
    let now = 2_000_000;
    const facilitator = await startFacilitator({
      rateLimit: {
        verifyPerMinute: 2,
        settlePerMinute: 10,
        maxConcurrentSettlements: 2,
        windowMs: 60_000,
        now: () => now,
      },
    });
    const invalid = { foo: "bar" };

    expect((await post(facilitator.url, "/verify", invalid)).status).toBe(400);
    expect((await post(facilitator.url, "/verify", invalid)).status).toBe(400);

    const limited = await post(facilitator.url, "/verify", invalid);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(limited.headers.get("cache-control")).toBe("no-store");
    expect(limited.json).toEqual({
      error: "rate_limited",
      message: "Too many requests. Retry after the indicated delay.",
    });
    expect(JSON.stringify(limited.json)).not.toContain(facilitator.payTo);
    expect(JSON.stringify(limited.json)).not.toContain(facilitator.stub.address);

    now += 60_000;
    expect((await post(facilitator.url, "/verify", invalid)).status).toBe(400);
  });

  it("normalizes case and trailing slashes and keeps verify/settle budgets separate", async () => {
    const facilitator = await startFacilitator({
      rateLimit: {
        verifyPerMinute: 1,
        settlePerMinute: 1,
        maxConcurrentSettlements: 2,
      },
    });

    expect((await post(facilitator.url, "/VERIFY/", { foo: "bar" })).status).toBe(400);
    expect((await post(facilitator.url, "/verify", { foo: "bar" })).status).toBe(429);

    expect((await post(facilitator.url, "/settle/", { foo: "bar" })).status).toBe(400);
    expect((await post(facilitator.url, "/settle", { foo: "bar" })).status).toBe(429);
  });

  it("ignores X-Forwarded-For when no proxy hop is trusted", async () => {
    const facilitator = await startFacilitator({
      trustProxyHops: 0,
      rateLimit: {
        verifyPerMinute: 2,
        settlePerMinute: 10,
        maxConcurrentSettlements: 2,
      },
    });

    expect(
      (await post(facilitator.url, "/verify", {}, { "x-forwarded-for": "198.51.100.1" }))
        .status,
    ).toBe(400);
    expect(
      (await post(facilitator.url, "/verify", {}, { "x-forwarded-for": "198.51.100.2" }))
        .status,
    ).toBe(400);
    expect(
      (await post(facilitator.url, "/verify", {}, { "x-forwarded-for": "198.51.100.3" }))
        .status,
    ).toBe(429);
  });

  it("uses the rightmost forwarded address behind one trusted proxy hop", async () => {
    const facilitator = await startFacilitator({
      trustProxyHops: 1,
      rateLimit: {
        verifyPerMinute: 2,
        settlePerMinute: 10,
        maxConcurrentSettlements: 2,
      },
    });

    expect(
      (await post(facilitator.url, "/verify", {}, { "x-forwarded-for": "203.0.113.10" }))
        .status,
    ).toBe(400);
    expect(
      (await post(facilitator.url, "/verify", {}, { "x-forwarded-for": "203.0.113.11" }))
        .status,
    ).toBe(400);
    expect(
      (await post(facilitator.url, "/verify", {}, { "x-forwarded-for": "203.0.113.10" }))
        .status,
    ).toBe(400);

    // The leftmost entry is client-controlled; only the rightmost entry (added
    // by the trusted proxy) identifies the client, whose budget is exhausted.
    expect(
      (
        await post(facilitator.url, "/verify", {}, {
          "x-forwarded-for": "198.51.100.99, 203.0.113.10",
        })
      ).status,
    ).toBe(429);
    expect(
      (await post(facilitator.url, "/verify", {}, { "x-forwarded-for": "203.0.113.11" }))
        .status,
    ).toBe(400);
  });

  it("caps concurrent settlements and releases the slot after completion", async () => {
    const facilitator = await startFacilitator({
      rateLimit: {
        verifyPerMinute: 100,
        settlePerMinute: 100,
        maxConcurrentSettlements: 1,
      },
    });
    const requirements = buildRequirements(facilitator.payTo);
    const first = envelope(
      await signPayment(facilitator.payer, requirements, { nonce: newNonce() }),
      requirements,
    );
    const second = envelope(
      await signPayment(facilitator.payer, requirements, { nonce: newNonce() }),
      requirements,
    );

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const originalWait = facilitator.stub.signer.waitForTransactionReceipt;
    facilitator.stub.signer.waitForTransactionReceipt = async (args) => {
      await gate;
      return await originalWait(args);
    };

    try {
      const firstRequest = post(facilitator.url, "/settle", first);
      await waitFor(() => facilitator.stub.writes.length === 1);

      const blocked = await post(facilitator.url, "/settle", second);
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).toBe("1");
      expect(blocked.json.error).toBe("rate_limited");

      release();
      const firstResult = await firstRequest;
      expect(firstResult.status).toBe(200);
      expect(firstResult.json.success).toBe(true);

      const retried = await post(facilitator.url, "/settle", second);
      expect(retried.status).toBe(200);
      expect(retried.json.success).toBe(true);
    } finally {
      release();
      facilitator.stub.signer.waitForTransactionReceipt = originalWait;
    }
  });

  it("keeps settle retries idempotent while limits are enabled", async () => {
    const facilitator = await startFacilitator({
      rateLimit: {
        verifyPerMinute: 10,
        settlePerMinute: 10,
        maxConcurrentSettlements: 2,
      },
    });
    const requirements = buildRequirements(facilitator.payTo);
    const body = envelope(
      await signPayment(facilitator.payer, requirements),
      requirements,
    );

    const first = await post(facilitator.url, "/settle", body);
    const retry = await post(facilitator.url, "/settle", body);

    expect(first.status).toBe(200);
    expect(first.json.success).toBe(true);
    expect(retry.status).toBe(200);
    expect(retry.json.transaction).toBe(first.json.transaction);
    expect(retry.headers.get("x-x402-settlement-reused")).toBe("true");
    expect(facilitator.stub.writes).toHaveLength(1);
  });

  it("still rejects malformed and oversized bodies with 400 and 413", async () => {
    const facilitator = await startFacilitator({ rateLimit: { enabled: false } });

    const malformed = await postRaw(facilitator.url, "/verify", "{");
    expect(malformed.status).toBe(400);
    expect(malformed.json.error).toBe("invalid_json");

    const oversized = await postRaw(
      facilitator.url,
      "/verify",
      JSON.stringify({ padding: "x".repeat(300_000) }),
    );
    expect(oversized.status).toBe(413);
    expect(oversized.json.error).toBe("payload_too_large");
  });

  it("does not apply the budgets to /health or /supported", async () => {
    const facilitator = await startFacilitator({
      rateLimit: {
        verifyPerMinute: 1,
        settlePerMinute: 1,
        maxConcurrentSettlements: 1,
      },
    });

    // Exhaust both POST budgets, then confirm the health/status routes still
    // work (Railway healthchecks and the Vercel status proxy depend on them).
    expect((await post(facilitator.url, "/verify", { foo: "bar" })).status).toBe(400);
    expect((await post(facilitator.url, "/verify", { foo: "bar" })).status).toBe(429);
    expect((await post(facilitator.url, "/settle", { foo: "bar" })).status).toBe(400);
    expect((await post(facilitator.url, "/settle", { foo: "bar" })).status).toBe(429);

    for (let i = 0; i < 5; i += 1) {
      expect((await fetch(`${facilitator.url}/health`)).status).toBe(200);
      expect((await fetch(`${facilitator.url}/supported`)).status).toBe(200);
    }
  });
});
