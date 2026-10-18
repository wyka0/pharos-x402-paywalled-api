import { createHash } from "node:crypto";
import type { PaymentPayload, PaymentRequirements, SettleResponse } from "@x402/core/types";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Cannot canonicalize a non-finite number");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const result: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (entry !== undefined) {
        result[key] = canonicalize(entry);
      }
    }
    return result;
  }
  throw new Error(`Cannot canonicalize value of type ${typeof value}`);
}

/**
 * Stable idempotency key for a settlement attempt. Two HTTP retries with the
 * same payload and requirements map to the same key, so the facilitator can
 * return the original receipt instead of broadcasting a second transaction.
 */
export function settlementKey(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): string {
  const canonical = canonicalize({ paymentPayload, paymentRequirements });
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export interface LedgerResult {
  response: SettleResponse;
  reused: boolean;
}

/**
 * In-memory settlement ledger for a single facilitator instance.
 *
 * - Concurrent duplicate requests share one in-flight settlement.
 * - Successful settlements are cached by settlement key and replayed with the
 *   original transaction hash, so a client retry cannot settle twice.
 * - Failures are not cached; a transient RPC failure may be retried.
 *
 * A multi-instance deployment should replace this with a shared store (for
 * example Redis). This limitation is documented in README.md.
 */
export class SettlementLedger {
  private readonly completed = new Map<string, SettleResponse>();
  private readonly inFlight = new Map<string, Promise<SettleResponse>>();

  async run(
    key: string,
    operation: () => Promise<SettleResponse>,
  ): Promise<LedgerResult> {
    const completed = this.completed.get(key);
    if (completed !== undefined) {
      return { response: structuredClone(completed), reused: true };
    }

    const pending = this.inFlight.get(key);
    if (pending !== undefined) {
      return { response: await pending, reused: true };
    }

    const promise = operation().then((response) => {
      if (response.success) {
        this.completed.set(key, response);
      }
      return response;
    });

    this.inFlight.set(key, promise);
    try {
      return { response: await promise, reused: false };
    } finally {
      this.inFlight.delete(key);
    }
  }

  get cachedSettlementCount(): number {
    return this.completed.size;
  }
}
