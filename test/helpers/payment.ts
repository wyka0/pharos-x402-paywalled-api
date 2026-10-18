import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { authorizationTypes } from "@x402/evm";
import { randomBytes } from "node:crypto";
import { getAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  NETWORK,
  USDC_ADDRESS,
  USDC_NAME,
  USDC_VERSION,
} from "../../src/network.js";

export type TestAccount = ReturnType<typeof privateKeyToAccount>;

export interface SignPaymentOptions {
  value?: string;
  to?: Address;
  validAfter?: string;
  validBefore?: string;
  nonce?: Hex;
}

export function newAccount(): TestAccount {
  return privateKeyToAccount(`0x${randomBytes(32).toString("hex")}` as Hex);
}

export function newKeyAccount(): { account: TestAccount; privateKey: Hex } {
  const privateKey = `0x${randomBytes(32).toString("hex")}` as Hex;
  return { account: privateKeyToAccount(privateKey), privateKey };
}

export function buildRequirements(
  payTo: Address,
  overrides: Partial<PaymentRequirements> = {},
): PaymentRequirements {
  return {
    scheme: "exact",
    network: NETWORK,
    asset: USDC_ADDRESS,
    amount: "10000",
    payTo,
    maxTimeoutSeconds: 120,
    extra: { name: USDC_NAME, version: USDC_VERSION },
    ...overrides,
  };
}

export function newNonce(): Hex {
  return `0x${randomBytes(32).toString("hex")}` as Hex;
}

function chainIdFromNetwork(network: string): number {
  const [, id] = network.split(":");
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid network identifier: ${network}`);
  }
  return parsed;
}

/**
 * Create the same EIP-3009 authorization the official client creates, using a
 * local test wallet. The returned object is a complete x402 v2 PaymentPayload.
 */
export async function signPayment(
  payer: TestAccount,
  requirements: PaymentRequirements,
  options: SignPaymentOptions = {},
): Promise<PaymentPayload> {
  const now = Math.floor(Date.now() / 1_000);
  const authorization = {
    from: payer.address,
    to: getAddress(options.to ?? requirements.payTo),
    value: options.value ?? requirements.amount,
    validAfter: options.validAfter ?? "0",
    validBefore: options.validBefore ?? String(now + requirements.maxTimeoutSeconds),
    nonce: options.nonce ?? newNonce(),
  };

  const name = String(requirements.extra?.name ?? USDC_NAME);
  const version = String(requirements.extra?.version ?? USDC_VERSION);
  const signature = await payer.signTypedData({
    domain: {
      name,
      version,
      chainId: chainIdFromNetwork(requirements.network),
      verifyingContract: getAddress(requirements.asset),
    },
    types: authorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  });

  return {
    x402Version: 2,
    accepted: requirements,
    payload: {
      authorization,
      signature,
    },
  };
}

export function paymentHeader(payload: PaymentPayload): string {
  return encodePaymentSignatureHeader(payload);
}

export function tamperSignature(signature: string): string {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error("Expected a 65-byte ECDSA signature");
  }
  const body = signature.slice(2);
  const byteOffset = 62; // last byte of r (bytes 0..31), not v
  const current = body.slice(byteOffset, byteOffset + 2);
  const replacement = current === "00" ? "01" : "00";
  return `0x${body.slice(0, byteOffset)}${replacement}${body.slice(byteOffset + 2)}`;
}
