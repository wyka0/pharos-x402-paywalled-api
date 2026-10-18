import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runPaymentFlow } from "../src/client/flow.js";
import { NETWORK, USDC_ADDRESS } from "../src/network.js";
import { ROUTE_DEFINITIONS } from "../src/routes.js";
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

describe("official x402 fetch client flow (local stub)", () => {
  it("discovers 402, signs, retries, settles, and decodes the receipt for /data", async () => {
    const lines: string[] = [];
    const result = await runPaymentFlow({
      apiUrl: stack.resource.url,
      route: "/data",
      payerPrivateKey: stack.payerKey,
      rpcUrl: "https://atlantic.dplabs-internal.com",
      mode: "local-stub",
      log: (line) => lines.push(line),
    });

    expect(result.initialStatus).toBe(402);
    expect(result.paymentRequired.accepts).toHaveLength(1);
    expect(result.accepted.amount).toBe(ROUTE_DEFINITIONS["/data"].amount);
    expect(result.accepted.network).toBe(NETWORK);
    expect(result.accepted.asset).toBe(USDC_ADDRESS);
    expect(result.accepted.payTo).toBe(stack.payTo);

    const authorization = result.paymentPayload.payload.authorization as Record<string, unknown>;
    expect(authorization.from).toBe(stack.payer.address);
    expect(authorization.to).toBe(stack.payTo);
    expect(authorization.value).toBe("10000");

    expect(result.responseStatus).toBe(200);
    expect((result.responseBody as Record<string, unknown>).paid).toBe(true);
    expect(result.settlement.success).toBe(true);
    expect(result.settlement.network).toBe(NETWORK);
    expect(result.settlement.transaction).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.receipt).toBeUndefined();
    expect(result.explorerUrl).toBeUndefined();
    expect(stack.stub.writes).toHaveLength(1);

    const transcript = result.transcript.join("\n");
    expect(transcript).toContain("[1/9]");
    expect(transcript).toContain("[2/9]");
    expect(transcript).toContain("[3/9]");
    expect(transcript).toContain("[4/9]");
    expect(transcript).toContain("[5/9]");
    expect(transcript).toContain("[6/9]");
    expect(transcript).toContain("[7/9]");
    expect(transcript).toContain("[8/9]");
    expect(transcript).toContain("[9/9]");
    expect(transcript).toContain("LOCAL STUB");
    expect(transcript).toContain("N/A in local-stub mode");
    expect(lines.length).toBeGreaterThan(20);
  });

  it("pays the distinct $0.005 price on /api/info", async () => {
    const result = await runPaymentFlow({
      apiUrl: stack.resource.url,
      route: "/api/info",
      payerPrivateKey: stack.payerKey,
      rpcUrl: "https://atlantic.dplabs-internal.com",
      mode: "local-stub",
      log: () => undefined,
    });

    expect(result.accepted.amount).toBe("5000");
    expect(result.settlement.success).toBe(true);
    expect((result.responseBody as Record<string, unknown>).paid).toBe(true);
    expect(stack.stub.writes).toHaveLength(1);
    expect(stack.stub.writes[0]?.authorization.value).toBe("5000");
  });

  it("rejects an unknown demo route before signing", async () => {
    await expect(
      runPaymentFlow({
        apiUrl: stack.resource.url,
        route: "/not-a-route",
        payerPrivateKey: stack.payerKey,
        rpcUrl: "https://atlantic.dplabs-internal.com",
        mode: "local-stub",
        log: () => undefined,
      }),
    ).rejects.toThrow(/Unknown paid route/);
    expect(stack.stub.writes).toHaveLength(0);
  });
});
