import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NETWORK, USDC_ADDRESS } from "../src/network.js";
import {
  buildRequirements,
  newNonce,
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

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object response");
  }
  return value as Record<string, unknown>;
}

async function post(
  path: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const response = await fetch(`${stack.facilitator.url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text.length > 0 ? asRecord(JSON.parse(text)) : {},
    headers: response.headers,
  };
}

async function postRaw(
  path: string,
  body: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${stack.facilitator.url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text.length > 0 ? asRecord(JSON.parse(text)) : {},
  };
}

function envelope(payload: PaymentPayload, requirements: PaymentRequirements): unknown {
  return {
    x402Version: 2,
    paymentPayload: payload,
    paymentRequirements: requirements,
  };
}

describe("GET /supported", () => {
  it("advertises exact on eip155:688689 and the facilitator signer", async () => {
    const response = await fetch(`${stack.facilitator.url}/supported`);
    expect(response.status).toBe(200);
    const body = asRecord(await response.json());
    const kinds = body.kinds as Array<Record<string, unknown>>;
    expect(kinds).toContainEqual({
      x402Version: 2,
      scheme: "exact",
      network: NETWORK,
    });
    const signers = body.signers as Record<string, string[]>;
    expect(Object.values(signers).flat().map((value) => value.toLowerCase())).toContain(
      stack.stub.address.toLowerCase(),
    );
    expect(Array.isArray(body.extensions)).toBe(true);
  });
});

describe("facilitator /health", () => {
  it("reports the network, asset, and signer without secrets", async () => {
    const response = await fetch(`${stack.facilitator.url}/health`);
    expect(response.status).toBe(200);
    const body = asRecord(await response.json());
    expect(body.status).toBe("ok");
    expect(body.network).toBe(NETWORK);
    expect(body.chainId).toBe(688689);
    expect(body.asset).toBe(USDC_ADDRESS);
    expect(body).not.toHaveProperty("privateKey");
  });
});

describe("POST /verify request validation", () => {
  it("rejects a structurally invalid envelope with HTTP 400", async () => {
    const result = await post("/verify", { foo: "bar" });
    expect(result.status).toBe(400);
    expect(result.json.error).toBe("invalid_request");
    expect(Array.isArray(result.json.details)).toBe(true);
  });

  it("rejects malformed JSON with HTTP 400", async () => {
    const result = await postRaw("/verify", "{");
    expect(result.status).toBe(400);
    expect(result.json.error).toBe("invalid_json");
  });

  it("rejects an unsupported x402 version", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    const result = await post("/verify", {
      x402Version: 1,
      paymentPayload: payload,
      paymentRequirements: requirements,
    });
    expect(result.status).toBe(400);
  });
});

describe("POST /verify payment checks", () => {
  it("accepts a valid, correctly priced authorization without settling", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    const result = await post("/verify", envelope(payload, requirements));
    expect(result.status).toBe(200);
    expect(result.json.isValid).toBe(true);
    expect(result.json.payer).toBe(stack.payer.address);
    expect(stack.stub.writes).toHaveLength(0);
  });

  it("rejects an invalid signature", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    payload.payload = {
      ...payload.payload,
      signature: tamperSignature(String(payload.payload.signature)),
    };
    const result = await post("/verify", envelope(payload, requirements));
    expect(result.status).toBe(200);
    expect(result.json.isValid).toBe(false);
    expect(result.json.invalidReason).toBe("invalid_exact_evm_signature");
  });

  it("rejects an underpaid authorization", async () => {
    const requirements = buildRequirements(stack.payTo, { amount: "10000" });
    const payload = await signPayment(stack.payer, requirements, { value: "5000" });
    const result = await post("/verify", envelope(payload, requirements));
    expect(result.json.isValid).toBe(false);
    expect(result.json.invalidReason).toBe(
      "invalid_exact_evm_payload_authorization_value_mismatch",
    );
  });

  it("rejects the wrong recipient", async () => {
    const requirements = buildRequirements(stack.payTo);
    const wrongRecipient = newAccount().address;
    const payload = await signPayment(stack.payer, requirements, { to: wrongRecipient });
    const result = await post("/verify", envelope(payload, requirements));
    expect(result.json.isValid).toBe(false);
    expect(result.json.invalidReason).toBe("invalid_exact_evm_recipient_mismatch");
  });

  it("rejects an unsupported network in the requirements", async () => {
    const requirements = buildRequirements(stack.payTo, {
      network: "eip155:1",
    });
    const payload = await signPayment(stack.payer, requirements);
    const result = await post("/verify", envelope(payload, requirements));
    expect(result.json.isValid).toBe(false);
    expect(result.json.invalidReason).toBe("unsupported_network");
  });

  it("rejects a payload whose accepted network does not match the requirements", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    const mismatched: PaymentPayload = {
      ...payload,
      accepted: { ...payload.accepted, network: "eip155:1" },
    };
    const result = await post("/verify", envelope(mismatched, requirements));
    expect(result.json.isValid).toBe(false);
    expect(result.json.invalidReason).toBe("invalid_exact_evm_network_mismatch");
  });

  it("rejects an expired authorization", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements, {
      validBefore: String(Math.floor(Date.now() / 1_000) - 60),
    });
    const result = await post("/verify", envelope(payload, requirements));
    expect(result.json.isValid).toBe(false);
    expect(result.json.invalidReason).toBe(
      "invalid_exact_evm_payload_authorization_valid_before",
    );
  });

  it("rejects a not-yet-valid authorization", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements, {
      validAfter: String(Math.floor(Date.now() / 1_000) + 3_600),
    });
    const result = await post("/verify", envelope(payload, requirements));
    expect(result.json.isValid).toBe(false);
    expect(result.json.invalidReason).toBe(
      "invalid_exact_evm_payload_authorization_valid_after",
    );
  });

  it("rejects an unsupported asset, scheme, and EIP-712 domain", async () => {
    const wrongAsset = buildRequirements(stack.payTo, {
      asset: newAccount().address,
    });
    const wrongAssetPayload = await signPayment(stack.payer, wrongAsset);
    const assetResult = await post("/verify", envelope(wrongAssetPayload, wrongAsset));
    expect(assetResult.json.invalidReason).toBe("unsupported_asset");

    const wrongScheme = buildRequirements(stack.payTo, { scheme: "upto" });
    const wrongSchemePayload = await signPayment(stack.payer, wrongScheme);
    const schemeResult = await post("/verify", envelope(wrongSchemePayload, wrongScheme));
    expect(schemeResult.json.invalidReason).toBe("unsupported_scheme");

    const noDomain = buildRequirements(stack.payTo, { extra: {} });
    const noDomainPayload = await signPayment(stack.payer, noDomain);
    const domainResult = await post("/verify", envelope(noDomainPayload, noDomain));
    expect(domainResult.json.invalidReason).toBe("unsupported_token_domain");
  });

  it("rejects a replayed nonce after a successful settlement", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    const settle = await post("/settle", envelope(payload, requirements));
    expect(settle.json.success).toBe(true);

    const verify = await post("/verify", envelope(payload, requirements));
    expect(verify.json.isValid).toBe(false);
    expect(verify.json.invalidReason).toBe("invalid_exact_evm_nonce_already_used");
  });
});

describe("POST /settle", () => {
  it("rejects a malformed envelope with HTTP 400", async () => {
    const result = await post("/settle", { paymentPayload: null });
    expect(result.status).toBe(400);
    expect(result.json.error).toBe("invalid_request");
  });

  it("returns success=false with an empty transaction for an invalid signature", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    payload.payload = {
      ...payload.payload,
      signature: tamperSignature(String(payload.payload.signature)),
    };
    const result = await post("/settle", envelope(payload, requirements));
    expect(result.status).toBe(200);
    expect(result.json.success).toBe(false);
    expect(result.json.transaction).toBe("");
    expect(result.json.errorReason).toBe("invalid_exact_evm_signature");
    expect(stack.stub.writes).toHaveLength(0);
  });

  it("returns the real settlement transaction hash from the scheme", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    const result = await post("/settle", envelope(payload, requirements));
    expect(result.status).toBe(200);
    expect(result.json.success).toBe(true);
    expect(result.json.transaction).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.json.network).toBe(NETWORK);
    expect(result.json.payer).toBe(stack.payer.address);
    expect(stack.stub.writes).toHaveLength(1);
    expect(result.json.transaction).toBe(stack.stub.writes[0]?.hash);
  });

  it("does not settle twice when the same body is retried", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    const body = envelope(payload, requirements);

    const first = await post("/settle", body);
    expect(first.json.success).toBe(true);
    expect(stack.stub.writes).toHaveLength(1);

    const second = await post("/settle", body);
    expect(second.json.success).toBe(true);
    expect(second.json.transaction).toBe(first.json.transaction);
    expect(second.headers.get("x-x402-settlement-reused")).toBe("true");
    expect(stack.stub.writes).toHaveLength(1);
  });

  it("allows a retry after a transient settlement failure and does not cache it", async () => {
    const requirements = buildRequirements(stack.payTo);
    const payload = await signPayment(stack.payer, requirements);
    const body = envelope(payload, requirements);

    stack.stub.failWritesWith(new Error("simulated RPC outage"));
    const failed = await post("/settle", body);
    expect(failed.status).toBe(200);
    expect(failed.json.success).toBe(false);
    expect(failed.json.transaction).toBe("");
    expect(failed.json.errorReason).toBe("invalid_exact_evm_transaction_failed");
    expect(stack.stub.writes).toHaveLength(0);

    stack.stub.failWritesWith(undefined);
    const retried = await post("/settle", body);
    expect(retried.status).toBe(200);
    expect(retried.json.success).toBe(true);
    expect(stack.stub.writes).toHaveLength(1);
  });

  it("never reports success for an unsupported network", async () => {
    const requirements = buildRequirements(stack.payTo, { network: "eip155:1" });
    const payload = await signPayment(stack.payer, requirements);
    const result = await post("/settle", envelope(payload, requirements));
    expect(result.status).toBe(200);
    expect(result.json.success).toBe(false);
    expect(result.json.transaction).toBe("");
    expect(result.json.errorReason).toBe("unsupported_network");
    expect(stack.stub.writes).toHaveLength(0);
  });
});

describe("payment header encoding helper", () => {
  it("encodes a v2 payment payload", async () => {
    const requirements = buildRequirements(stack.payTo, {
      amount: "5000",
      extra: { name: "USDC", version: "2" },
    });
    const payload = await signPayment(stack.payer, requirements, {
      value: "5000",
      nonce: newNonce(),
    });
    expect(paymentHeader(payload).length).toBeGreaterThan(100);
  });
});
