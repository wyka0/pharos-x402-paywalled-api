import express from "express";
import type { PaymentFlowResult } from "../src/client/flow.js";
import type { PayerConfig, ResourceConfig } from "../src/config.js";
import { createPaymentDemoRouter } from "../src/resource/demo-route.js";
import { NETWORK, USDC_ADDRESS } from "../src/network.js";
import { newAccount } from "./helpers/payment.js";
import { silentLogger, startApp, type RunningServer } from "./helpers/servers.js";
import { afterEach, describe, expect, it } from "vitest";

const TOKEN = "test-approval-token-123456";
const PAYER = newAccount();

const baseConfig: ResourceConfig = {
  payTo: newAccount().address,
  facilitatorUrl: "http://127.0.0.1:4022",
  port: 4021,
  trustProxy: false,
  facilitatorTimeoutMs: 5_000,
  paymentDemoEnabled: true,
  paymentDemoApprovalToken: TOKEN,
  paymentDemoApiUrl: "http://127.0.0.1:4021",
};

const payer: PayerConfig = {
  privateKey: `0x${"11".repeat(32)}`,
  apiUrl: "http://127.0.0.1:4021",
  route: "/data",
  rpcUrl: "https://atlantic.dplabs-internal.com",
  livePaymentApproved: true,
};

const TX = `0x${"ab".repeat(32)}`;

function settlementResult(route: "/data" | "/api/info" = "/data"): PaymentFlowResult {
  return {
    mode: "live",
    apiUrl: "http://127.0.0.1:4021",
    route,
    payer: PAYER.address,
    initialStatus: 402,
    paymentRequired: {
      x402Version: 2,
      resource: { url: "http://127.0.0.1:4021/data" },
      accepts: [],
    },
    accepted: {
      scheme: "exact",
      network: NETWORK,
      asset: USDC_ADDRESS,
      amount: route === "/data" ? "10000" : "5000",
      payTo: baseConfig.payTo,
      maxTimeoutSeconds: 120,
      extra: { name: "USDC", version: "2" },
    },
    paymentSignatureHeader: "stub",
    paymentPayload: {
      x402Version: 2,
      accepted: {
        scheme: "exact",
        network: NETWORK,
        asset: USDC_ADDRESS,
        amount: "10000",
        payTo: baseConfig.payTo,
        maxTimeoutSeconds: 120,
        extra: {},
      },
      payload: {},
    },
    responseStatus: 200,
    responseBody: { paid: true, data: { dataset: "pharos-atlantic-sample" } },
    settlement: {
      success: true,
      transaction: TX,
      network: NETWORK,
      payer: PAYER.address,
    },
    receipt: {
      status: "success",
      blockNumber: "123",
      transactionHash: TX,
      broadcaster: newAccount().address,
      to: USDC_ADDRESS,
      gasUsed: "50000",
      transfer: {
        from: PAYER.address,
        to: baseConfig.payTo,
        value: "10000",
      },
    },
    explorerUrl: `https://atlantic.pharosscan.xyz/tx/${TX}`,
    transcript: ["local transcript must not leak"],
  } as PaymentFlowResult;
}

let server: RunningServer | null = null;

afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
});

async function makeServer(options: {
  config?: Partial<ResourceConfig>;
  runner?: () => Promise<PaymentFlowResult>;
  now?: () => number;
}) {
  const app = express();
  app.use(express.json());
  app.use(
    "/demo",
    createPaymentDemoRouter(
      { ...baseConfig, ...options.config },
      {
        logger: silentLogger,
        resolvePayer: () => payer,
        runFlow: options.runner ?? (async () => settlementResult()),
        ...(options.now ? { now: options.now } : {}),
      },
    ),
  );
  server = await startApp(app);
  return server;
}

async function post(
  url: string,
  body: unknown,
  token?: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${url}/demo/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-payment-demo-token": token } : {}),
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    json: (await response.json()) as Record<string, unknown>,
  };
}

describe("gated payment demo route", () => {
  it("returns a clear not-configured state when disabled", async () => {
    let called = false;
    const running = await makeServer({
      config: { paymentDemoEnabled: false, paymentDemoApprovalToken: undefined },
      runner: async () => {
        called = true;
        return settlementResult();
      },
    });
    const result = await post(running.url, { route: "/data", confirm: true }, TOKEN);
    expect(result.status).toBe(503);
    expect(result.json.status).toBe("not_configured");
    expect(Array.isArray(result.json.required)).toBe(true);
    expect(called).toBe(false);
  });

  it("rejects a missing approval token", async () => {
    const running = await makeServer({});
    const result = await post(running.url, { route: "/data", confirm: true });
    expect(result.status).toBe(403);
    expect(result.json.status).toBe("approval_required");
  });

  it("rejects a wrong approval token", async () => {
    const running = await makeServer({});
    const result = await post(running.url, { route: "/data", confirm: true }, "wrong-token");
    expect(result.status).toBe(403);
  });

  it("requires the explicit confirmation flag", async () => {
    const running = await makeServer({});
    const result = await post(running.url, { route: "/data", confirm: false }, TOKEN);
    expect(result.status).toBe(400);
    expect(result.json.status).toBe("confirmation_required");
  });

  it("rejects an unsupported route", async () => {
    const running = await makeServer({});
    const result = await post(running.url, { route: "/health", confirm: true }, TOKEN);
    expect(result.status).toBe(400);
  });

  it("returns only sanitized settlement data after an approved run", async () => {
    const running = await makeServer({});
    const result = await post(running.url, { route: "/data", confirm: true }, TOKEN);
    expect(result.status).toBe(200);
    expect(result.json.status).toBe("settled");
    expect(result.json.explorerUrl).toContain(TX);
    expect(result.json.amountAtomic).toBe("10000");
    expect(result.json).not.toHaveProperty("paymentPayload");
    expect(result.json).not.toHaveProperty("paymentSignatureHeader");
    expect(result.json).not.toHaveProperty("transcript");
    expect(JSON.stringify(result.json)).not.toContain("11".repeat(32));
  });

  it("returns a failure state without claiming a transaction", async () => {
    const running = await makeServer({
      runner: async () => {
        throw new Error("simulated chain failure");
      },
    });
    const result = await post(running.url, { route: "/data", confirm: true }, TOKEN);
    expect(result.status).toBe(502);
    expect(result.json.status).toBe("failed");
    expect(result.json).not.toHaveProperty("settlement");
    expect(JSON.stringify(result.json)).not.toContain(TX);
  });

  it("enforces a short cooldown between successful payments", async () => {
    let clock = 1_000;
    let calls = 0;
    const running = await makeServer({
      now: () => clock,
      runner: async () => {
        calls += 1;
        return settlementResult();
      },
    });
    const first = await post(running.url, { route: "/data", confirm: true }, TOKEN);
    expect(first.status).toBe(200);
    const second = await post(running.url, { route: "/data", confirm: true }, TOKEN);
    expect(second.status).toBe(429);
    expect(calls).toBe(1);
    clock += 3_001;
    const third = await post(running.url, { route: "/data", confirm: true }, TOKEN);
    expect(third.status).toBe(200);
    expect(calls).toBe(2);
  });
});
