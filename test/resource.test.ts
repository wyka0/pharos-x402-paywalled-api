import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
} from "@x402/core/http";
import type { PaymentPayload } from "@x402/core/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  NETWORK,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  USDC_ADDRESS,
  USDC_NAME,
  USDC_VERSION,
} from "../src/network.js";
import { ROUTE_DEFINITIONS } from "../src/routes.js";
import {
  buildRequirements,
  newAccount,
  paymentHeader,
  signPayment,
  tamperSignature,
} from "./helpers/payment.js";
import { createTestStack, type TestStack } from "./helpers/servers.js";

let stack: TestStack;

beforeAll(async () => {
  stack = await createTestStack();
});

afterAll(async () => {
  await stack.close();
});

beforeEach(() => {
  stack.stub.writes.length = 0;
  stack.stub.usedNonces.clear();
  stack.stub.failWritesWith(undefined);
});

async function get(
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const response = await fetch(`${stack.resource.url}${path}`, { headers });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep the raw text for non-JSON responses.
  }
  return { status: response.status, headers: response.headers, body };
}

function expectNoProtectedData(body: unknown): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("pharos-atlantic-sample");
  expect(serialized).not.toContain("Pharos x402 Paywalled API");
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    expect(body).not.toHaveProperty("data");
    expect(body).not.toHaveProperty("info");
  }
}

function requiredHeader(headers: Headers) {
  const header = headers.get(PAYMENT_REQUIRED_HEADER);
  expect(header, `missing ${PAYMENT_REQUIRED_HEADER}`).toBeTruthy();
  return { header: header as string, decoded: decodePaymentRequiredHeader(header as string) };
}

describe("free health endpoint", () => {
  it("returns HTTP 200 without a payment challenge", async () => {
    const result = await get("/health");
    expect(result.status).toBe(200);
    expect(result.headers.get(PAYMENT_REQUIRED_HEADER)).toBeNull();
    const body = result.body as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.network).toBe(NETWORK);
    expect(body.chainId).toBe(688689);
    const prices = body.prices as Record<string, { atomic: string }>;
    expect(prices["/data"]?.atomic).toBe("10000");
    expect(prices["/api/info"]?.atomic).toBe("5000");
  });
});

describe("unpaid requests", () => {
  it("returns HTTP 402 with valid machine-readable requirements for /data", async () => {
    const result = await get("/data");
    expect(result.status).toBe(402);
    expectNoProtectedData(result.body);
    const { decoded } = requiredHeader(result.headers);
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts).toHaveLength(1);
    const accept = decoded.accepts[0];
    expect(accept).toBeDefined();
    expect(accept?.scheme).toBe("exact");
    expect(accept?.network).toBe(NETWORK);
    expect(accept?.asset).toBe(USDC_ADDRESS);
    expect(accept?.amount).toBe(ROUTE_DEFINITIONS["/data"].amount);
    expect(accept?.amount).toBe("10000");
    expect(accept?.payTo).toBe(stack.payTo);
    expect(accept?.extra).toMatchObject({ name: USDC_NAME, version: USDC_VERSION });
    expect(stack.stub.writes).toHaveLength(0);
  });

  it("returns the lower $0.005 price for /api/info", async () => {
    const result = await get("/api/info");
    expect(result.status).toBe(402);
    expectNoProtectedData(result.body);
    const { decoded } = requiredHeader(result.headers);
    expect(decoded.accepts[0]?.amount).toBe("5000");
  });

  it("rejects a malformed payment header with HTTP 402 and no data", async () => {
    const result = await get("/data", { [PAYMENT_SIGNATURE_HEADER]: "!!!not-base64!!!" });
    expect(result.status).toBe(402);
    expectNoProtectedData(result.body);
    expect(stack.stub.writes).toHaveLength(0);
  });
});

describe("valid payments", () => {
  it("returns protected data and a real settlement receipt for /data", async () => {
    const requirements = buildRequirements(stack.payTo, {
      amount: ROUTE_DEFINITIONS["/data"].amount,
    });
    const payload = await signPayment(stack.payer, requirements);
    const result = await get("/data", { [PAYMENT_SIGNATURE_HEADER]: paymentHeader(payload) });

    expect(result.status).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.paid).toBe(true);
    expect((body.data as Record<string, unknown>).dataset).toBe("pharos-atlantic-sample");

    const responseHeader = result.headers.get(PAYMENT_RESPONSE_HEADER);
    expect(responseHeader).toBeTruthy();
    const settlement = decodePaymentResponseHeader(responseHeader as string);
    expect(settlement.success).toBe(true);
    expect(settlement.network).toBe(NETWORK);
    expect(settlement.transaction).toMatch(/^0x[0-9a-f]{64}$/);
    expect(settlement.payer).toBe(stack.payer.address);
    expect(stack.stub.writes).toHaveLength(1);
  });

  it("returns the protected info payload for /api/info at the lower price", async () => {
    const requirements = buildRequirements(stack.payTo, {
      amount: ROUTE_DEFINITIONS["/api/info"].amount,
    });
    const payload = await signPayment(stack.payer, requirements);
    const result = await get("/api/info", {
      [PAYMENT_SIGNATURE_HEADER]: paymentHeader(payload),
    });

    expect(result.status).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect((body.info as Record<string, unknown>).name).toBe("Pharos x402 Paywalled API");
    expect((body.price as Record<string, unknown>).amount).toBe("5000");
    expect(stack.stub.writes).toHaveLength(1);
  });

  it("does not settle the same authorization twice when the header is replayed", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    const header = paymentHeader(payload);

    const first = await get("/data", { [PAYMENT_SIGNATURE_HEADER]: header });
    expect(first.status).toBe(200);
    expect(stack.stub.writes).toHaveLength(1);

    const second = await get("/data", { [PAYMENT_SIGNATURE_HEADER]: header });
    expect(second.status).toBe(402);
    expectNoProtectedData(second.body);
    expect(stack.stub.writes).toHaveLength(1);
  });
});

describe("invalid and underpaid payments", () => {
  it("rejects an underpaid authorization and exposes no data", async () => {
    const requirements = buildRequirements(stack.payTo, { amount: "10000" });
    const payload = await signPayment(stack.payer, requirements, { value: "5000" });
    const result = await get("/data", { [PAYMENT_SIGNATURE_HEADER]: paymentHeader(payload) });
    expect(result.status).toBe(402);
    expectNoProtectedData(result.body);
    const { decoded } = requiredHeader(result.headers);
    expect(decoded.error).toContain("value_mismatch");
    expect(stack.stub.writes).toHaveLength(0);
  });

  it("rejects the wrong recipient", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements, {
      to: newAccount().address,
    });
    const result = await get("/data", { [PAYMENT_SIGNATURE_HEADER]: paymentHeader(payload) });
    expect(result.status).toBe(402);
    expectNoProtectedData(result.body);
    const { decoded } = requiredHeader(result.headers);
    expect(decoded.error).toContain("recipient_mismatch");
    expect(stack.stub.writes).toHaveLength(0);
  });

  it("rejects a payload for the wrong network", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    const mismatched: PaymentPayload = {
      ...payload,
      accepted: { ...payload.accepted, network: "eip155:1" },
    };
    const result = await get("/data", {
      [PAYMENT_SIGNATURE_HEADER]: paymentHeader(mismatched),
    });
    expect(result.status).toBe(402);
    expectNoProtectedData(result.body);
    expect(stack.stub.writes).toHaveLength(0);
  });

  it("rejects an expired authorization", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements, {
      validBefore: String(Math.floor(Date.now() / 1_000) - 30),
    });
    const result = await get("/data", { [PAYMENT_SIGNATURE_HEADER]: paymentHeader(payload) });
    expect(result.status).toBe(402);
    expectNoProtectedData(result.body);
    const { decoded } = requiredHeader(result.headers);
    expect(decoded.error).toContain("valid_before");
    expect(stack.stub.writes).toHaveLength(0);
  });

  it("rejects an invalid signature", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    payload.payload = {
      ...payload.payload,
      signature: tamperSignature(String(payload.payload.signature)),
    };
    const result = await get("/data", { [PAYMENT_SIGNATURE_HEADER]: paymentHeader(payload) });
    expect(result.status).toBe(402);
    expectNoProtectedData(result.body);
    const { decoded } = requiredHeader(result.headers);
    expect(decoded.error).toContain("signature");
    expect(stack.stub.writes).toHaveLength(0);
  });
});

describe("routing", () => {
  it("returns a JSON 404 for unknown free paths", async () => {
    const result = await get("/nope");
    expect(result.status).toBe(404);
    expect(result.body).toMatchObject({ error: "not_found" });
  });
});
