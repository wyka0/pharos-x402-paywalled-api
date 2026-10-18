import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { NETWORK, USDC_ADDRESS, USDC_NAME, USDC_VERSION } from "../network.js";

const hexAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 20-byte hex address");

const paymentRequirementsSchema = z
  .object({
    scheme: z.string().min(1),
    network: z.string().min(1),
    asset: hexAddress,
    amount: z.string().regex(/^\d+$/, "must be an integer string in atomic units"),
    payTo: hexAddress,
    maxTimeoutSeconds: z.number().int().positive().max(86_400),
    extra: z.record(z.unknown()).optional().default({}),
  })
  .passthrough();

const paymentPayloadSchema = z
  .object({
    x402Version: z.literal(2),
    resource: z
      .object({
        url: z.string().min(1),
      })
      .passthrough()
      .optional(),
    accepted: paymentRequirementsSchema,
    payload: z.record(z.unknown()),
    extensions: z.record(z.unknown()).optional(),
  })
  .passthrough();

const facilitatorRequestSchema = z
  .object({
    x402Version: z.literal(2).optional(),
    paymentPayload: paymentPayloadSchema,
    paymentRequirements: paymentRequirementsSchema,
  })
  .passthrough();

export interface ParsedFacilitatorRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

export type ParseRequestResult =
  | { ok: true; value: ParsedFacilitatorRequest }
  | { ok: false; issues: string[] };

/**
 * Validate the /verify and /settle request envelope. Structurally invalid
 * requests are a 400; valid requests with bad payment data are a 200 with
 * isValid/success = false, matching the facilitator interface.
 */
export function parseFacilitatorRequest(body: unknown): ParseRequestResult {
  const parsed = facilitatorRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "body";
        return `${path}: ${issue.message}`;
      }),
    };
  }
  return {
    ok: true,
    value: parsed.data as ParsedFacilitatorRequest,
  };
}

export type PrecheckResult =
  | { ok: true }
  | { ok: false; reason: string; message: string };

/**
 * Facilitator policy for this project: exact scheme, Atlantic Testnet only,
 * the verified registry USDC, and the EIP-3009 asset-transfer method. The SDK
 * scheme then checks the signature, recipient, amount, nonce, expiry, and
 * on-chain simulation.
 */
export function precheckRequirements(requirements: PaymentRequirements): PrecheckResult {
  if (requirements.scheme !== "exact") {
    return {
      ok: false,
      reason: "unsupported_scheme",
      message: `This facilitator supports only the exact scheme, received ${requirements.scheme}`,
    };
  }
  if (requirements.network !== NETWORK) {
    return {
      ok: false,
      reason: "unsupported_network",
      message: `This facilitator supports only ${NETWORK} (Pharos Atlantic Testnet), received ${requirements.network}`,
    };
  }
  if (getAddress(requirements.asset) !== getAddress(USDC_ADDRESS)) {
    return {
      ok: false,
      reason: "unsupported_asset",
      message: `This facilitator settles only the verified Atlantic USDC ${USDC_ADDRESS}`,
    };
  }
  if (requirements.payTo === "0x0000000000000000000000000000000000000000") {
    return {
      ok: false,
      reason: "invalid_pay_to",
      message: "The recipient must not be the zero address",
    };
  }
  if (BigInt(requirements.amount) <= 0n) {
    return {
      ok: false,
      reason: "invalid_amount",
      message: "The amount must be greater than zero",
    };
  }
  if (requirements.extra?.assetTransferMethod !== undefined) {
    if (requirements.extra.assetTransferMethod !== "eip3009") {
      return {
        ok: false,
        reason: "unsupported_asset_transfer_method",
        message: `Only eip3009 is enabled on this facilitator, received ${String(requirements.extra.assetTransferMethod)}`,
      };
    }
  }
  if (requirements.extra?.name !== USDC_NAME || requirements.extra?.version !== USDC_VERSION) {
    return {
      ok: false,
      reason: "unsupported_token_domain",
      message: `Payment requirements must include the verified EIP-712 domain name=${USDC_NAME}, version=${USDC_VERSION}`,
    };
  }
  if (!isAddress(requirements.payTo)) {
    return {
      ok: false,
      reason: "invalid_pay_to",
      message: "The recipient is not a valid address",
    };
  }
  return { ok: true };
}
