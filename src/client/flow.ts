import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  decodePaymentSignatureHeader,
} from "@x402/core/http";
import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  SettleResponse,
} from "@x402/core/types";
import {
  createPublicClient,
  erc20Abi,
  getAddress,
  http,
  isAddressEqual,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { formatAtomic } from "../amounts.js";
import {
  NETWORK,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  TX_HASH_PATTERN,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_NAME,
  USDC_VERSION,
  explorerTxUrl,
  pharosAtlantic,
} from "../network.js";
import { routeDefinition } from "../routes.js";
import { createPayingFetch } from "./paying-fetch.js";

export type FlowMode = "live" | "local-stub";

export interface PaymentFlowOptions {
  apiUrl: string;
  route: string;
  payerPrivateKey: Hex;
  rpcUrl: string;
  mode: FlowMode;
  log?: (line: string) => void;
}

export interface ReceiptSummary {
  status: string;
  blockNumber: string;
  transactionHash: string;
  broadcaster: string;
  to: string;
  gasUsed: string;
  transfer: {
    from: string;
    to: string;
    value: string;
  };
}

export interface PaymentFlowResult {
  mode: FlowMode;
  apiUrl: string;
  route: string;
  payer: Address;
  initialStatus: number;
  paymentRequired: PaymentRequired;
  accepted: PaymentRequirements;
  paymentSignatureHeader: string;
  paymentPayload: PaymentPayload;
  responseStatus: number;
  responseBody: unknown;
  settlement: SettleResponse;
  receipt?: ReceiptSummary;
  explorerUrl?: string;
  transcript: string[];
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function selectAccept(required: PaymentRequired, expectedAmount: string): PaymentRequirements {
  const candidates = required.accepts.filter(
    (accept) =>
      accept.scheme === "exact" &&
      accept.network === NETWORK &&
      accept.asset.toLowerCase() === USDC_ADDRESS.toLowerCase(),
  );
  if (candidates.length === 0) {
    throw new Error(
      `The 402 response does not offer exact/${NETWORK} with asset ${USDC_ADDRESS}. Offered: ${required.accepts
        .map((accept) => `${accept.scheme}/${accept.network}/${accept.asset}`)
        .join(", ")}`,
    );
  }
  const match = candidates.find((accept) => accept.amount === expectedAmount);
  if (!match) {
    throw new Error(
      `The 402 response offers amount(s) ${candidates.map((c) => c.amount).join(", ")}, expected ${expectedAmount}`,
    );
  }
  if (match.extra?.name !== USDC_NAME || match.extra?.version !== USDC_VERSION) {
    throw new Error(
      `The 402 response is missing the verified EIP-712 domain name=${USDC_NAME}, version=${USDC_VERSION}`,
    );
  }
  return match;
}

async function waitForReceipt(
  client: ReturnType<typeof createPublicClient>,
  hash: Hex,
): Promise<Awaited<ReturnType<typeof client.getTransactionReceipt>>> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const receipt = await client.getTransactionReceipt({ hash });
    if (receipt) {
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for a transaction receipt for ${hash}`);
}

/**
 * Run the complete x402 flow. In "live" mode this signs and broadcasts a real
 * Atlantic Testnet payment and verifies the receipt. In "local-stub" mode it
 * uses the same official fetch integration against a local in-memory
 * facilitator signer and clearly labels the settlement as non-chain evidence.
 */
export async function runPaymentFlow(options: PaymentFlowOptions): Promise<PaymentFlowResult> {
  const transcript: string[] = [];
  const log = options.log ?? ((line: string) => console.log(line));
  const say = (line: string): void => {
    transcript.push(line);
    log(line);
  };

  const definition = routeDefinition(options.route);
  const expectedAmount = definition.amount;
  const target = new URL(options.route, options.apiUrl).toString();
  const expectedDisplay = formatAtomic(expectedAmount, USDC_DECIMALS);

  say("");
  say(`Pharos x402 payment demo (${options.mode === "live" ? "LIVE Atlantic Testnet" : "LOCAL STUB - no chain broadcast"})`);
  say(`Target: ${target}`);
  say("");
  say(`[1/9] Initial request without a payment header: GET ${options.route}`);

  const initial = await fetch(target, {
    headers: { accept: "application/json" },
    redirect: "follow",
  });
  await initial.text();
  say(`      HTTP ${initial.status}`);
  if (initial.status !== 402) {
    throw new Error(`Expected HTTP 402 from the unpaid request, received ${initial.status}`);
  }

  say("");
  say("[2/9] Payment requirements decoded from the PAYMENT-REQUIRED header");
  const requiredHeader = initial.headers.get(PAYMENT_REQUIRED_HEADER);
  if (!requiredHeader) {
    throw new Error(`HTTP 402 response is missing the ${PAYMENT_REQUIRED_HEADER} header`);
  }
  const required = decodePaymentRequiredHeader(requiredHeader);
  const accepted = selectAccept(required, expectedAmount);
  say(`      PAYMENT-REQUIRED header length: ${requiredHeader.length} base64 characters`);
  say(
    JSON.stringify(
      {
        x402Version: required.x402Version,
        resource: required.resource,
        accepts: required.accepts.map((accept) => ({
          scheme: accept.scheme,
          network: accept.network,
          asset: accept.asset,
          amountAtomic: accept.amount,
          amountUsdc: formatAtomic(accept.amount, USDC_DECIMALS),
          payTo: accept.payTo,
          maxTimeoutSeconds: accept.maxTimeoutSeconds,
          extra: accept.extra,
        })),
      },
      null,
      2,
    ),
  );
  say(
    `      Selected price: ${expectedDisplay} USDC (${expectedAmount} atomic units at ${USDC_DECIMALS} decimals)`,
  );

  let capturedSignature: string | undefined;
  const { payer, fetchWithPayment } = createPayingFetch(options.payerPrivateKey, async (input, init) => {
    const headers = new Headers(
      input instanceof Request ? input.headers : init?.headers,
    );
    const signature = headers.get(PAYMENT_SIGNATURE_HEADER);
    if (signature) {
      capturedSignature = signature;
    }
    return await fetch(input, init);
  });
  say("");
  say(`[3/9] Payer ${payer} signs the EIP-3009 authorization with ExactEvmScheme`);
  const response = await fetchWithPayment(target, {
    headers: { accept: "application/json" },
  });

  if (!capturedSignature) {
    throw new Error("The x402 fetch wrapper did not send a PAYMENT-SIGNATURE header");
  }
  const paymentPayload = decodePaymentSignatureHeader(capturedSignature);
  const authorization = asRecord(paymentPayload.payload.authorization, "payload.authorization");
  const from = asString(authorization.from, "authorization.from");
  const to = asString(authorization.to, "authorization.to");
  const value = asString(authorization.value, "authorization.value");
  const validAfter = asString(authorization.validAfter, "authorization.validAfter");
  const validBefore = asString(authorization.validBefore, "authorization.validBefore");
  const nonce = asString(authorization.nonce, "authorization.nonce");
  const signature = asString(paymentPayload.payload.signature, "payload.signature");

  if (getAddress(from) !== getAddress(payer)) {
    throw new Error(`Authorization signer ${from} does not match payer ${payer}`);
  }
  if (getAddress(to) !== getAddress(accepted.payTo)) {
    throw new Error(`Authorization recipient ${to} does not match required payTo ${accepted.payTo}`);
  }
  if (value !== accepted.amount) {
    throw new Error(`Authorization value ${value} does not match required amount ${accepted.amount}`);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(nonce)) {
    throw new Error("Authorization nonce is not a 32-byte hex value");
  }
  if (signature.length < 130) {
    throw new Error("Authorization signature is shorter than an ECDSA signature");
  }
  const nowSeconds = Math.floor(Date.now() / 1_000);
  if (Number(validBefore) <= nowSeconds) {
    throw new Error("Authorization is already expired");
  }
  if (Number(validAfter) > nowSeconds) {
    throw new Error("Authorization is not valid yet");
  }

  say(`      from:        ${from}`);
  say(`      to:          ${to}`);
  say(`      value:       ${value} atomic (${formatAtomic(value, USDC_DECIMALS)} USDC)`);
  say(`      validAfter:  ${validAfter} (${new Date(Number(validAfter) * 1_000).toISOString()})`);
  say(`      validBefore: ${validBefore} (${new Date(Number(validBefore) * 1_000).toISOString()})`);
  say(`      nonce:       ${nonce}`);
  say(`      signature:   ${signature.slice(0, 10)}...${signature.slice(-8)} (${(signature.length - 2) / 2} bytes)`);

  say("");
  say(`[4/9] Retry carried ${PAYMENT_SIGNATURE_HEADER}`);
  say(`      header length: ${capturedSignature.length} base64 characters`);
  say(
    `      decoded payload: x402Version=${paymentPayload.x402Version}, scheme=${paymentPayload.accepted.scheme}, network=${paymentPayload.accepted.network}, amount=${paymentPayload.accepted.amount}`,
  );

  say("");
  say("[5/9] Facilitator verification and settlement");
  if (response.status !== 200) {
    const body = await response.text();
    throw new Error(`Paid request failed with HTTP ${response.status}: ${body.slice(0, 1_000)}`);
  }

  const settlementHeader = response.headers.get(PAYMENT_RESPONSE_HEADER);
  if (!settlementHeader) {
    throw new Error(`HTTP 200 response is missing the ${PAYMENT_RESPONSE_HEADER} header`);
  }
  const settlement = decodePaymentResponseHeader(settlementHeader);
  if (!settlement.success) {
    throw new Error(`Settlement did not succeed: ${settlement.errorReason ?? "unknown reason"}`);
  }
  if (settlement.network !== NETWORK) {
    throw new Error(`Settlement network ${settlement.network} does not match ${NETWORK}`);
  }
  if (!TX_HASH_PATTERN.test(settlement.transaction)) {
    throw new Error("Settlement response did not include a valid transaction hash");
  }
  if (settlement.payer && getAddress(settlement.payer) !== getAddress(payer)) {
    throw new Error(`Settlement payer ${settlement.payer} does not match payer ${payer}`);
  }
  say(
    options.mode === "live"
      ? "      Facilitator verified the authorization and the EVM scheme returned a confirmed settlement receipt."
      : "      Local facilitator verified the authorization and returned a simulated receipt (no chain broadcast).",
  );

  say("");
  say("[6/9] Protected resource returned");
  const responseBody = (await response.json()) as unknown;
  say(`      HTTP ${response.status}`);
  say(JSON.stringify(responseBody, null, 2));

  say("");
  say("[7/9] PAYMENT-RESPONSE header decoded");
  say(`      PAYMENT-RESPONSE header length: ${settlementHeader.length} base64 characters`);
  say(
    JSON.stringify(
      {
        success: settlement.success,
        transaction: settlement.transaction,
        network: settlement.network,
        payer: settlement.payer,
        amount: settlement.amount,
        errorReason: settlement.errorReason,
      },
      null,
      2,
    ),
  );

  say("");
  say("[8/9] Settlement transaction");
  say(`      transaction hash: ${settlement.transaction}`);
  let receipt: ReceiptSummary | undefined;
  let explorerUrl: string | undefined;

  if (options.mode === "live") {
    const client = createPublicClient({
      chain: pharosAtlantic(options.rpcUrl),
      transport: http(options.rpcUrl, { timeout: 30_000, retryCount: 2 }),
    });
    const rawReceipt = await waitForReceipt(client, settlement.transaction as Hex);
    if (!rawReceipt) {
      throw new Error("Settlement transaction has no receipt");
    }
    if (rawReceipt.status !== "success") {
      throw new Error(`Settlement transaction reverted: ${settlement.transaction}`);
    }
    if (rawReceipt.transactionHash.toLowerCase() !== settlement.transaction.toLowerCase()) {
      throw new Error("Receipt transaction hash does not match the settlement response");
    }
    if (!rawReceipt.to || rawReceipt.to.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
      throw new Error(`Settlement transaction target ${rawReceipt.to ?? "null"} is not the USDC contract`);
    }

    const transfers = parseEventLogs({
      abi: erc20Abi,
      eventName: "Transfer",
      logs: rawReceipt.logs,
    });
    const transfer = transfers.find(
      (event) =>
        event.address.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
        isAddressEqual(event.args.from, getAddress(payer)) &&
        isAddressEqual(event.args.to, getAddress(accepted.payTo)) &&
        event.args.value === BigInt(accepted.amount),
    );
    if (!transfer) {
      throw new Error(
        "Receipt does not contain a matching USDC Transfer(from=payer, to=payTo, value=required amount) log",
      );
    }

    receipt = {
      status: rawReceipt.status,
      blockNumber: rawReceipt.blockNumber.toString(),
      transactionHash: rawReceipt.transactionHash,
      broadcaster: rawReceipt.from,
      to: rawReceipt.to,
      gasUsed: rawReceipt.gasUsed.toString(),
      transfer: {
        from: transfer.args.from,
        to: transfer.args.to,
        value: transfer.args.value.toString(),
      },
    };

    say(`      receipt status: ${receipt.status}`);
    say(`      block number: ${receipt.blockNumber}`);
    say(`      broadcaster (facilitator signer): ${receipt.broadcaster}`);
    say(`      transaction target: ${receipt.to} (USDC)`);
    say(`      gas used: ${receipt.gasUsed}`);
    say(
      `      Transfer log matched: ${receipt.transfer.from} -> ${receipt.transfer.to}, ${receipt.transfer.value} atomic units`,
    );

    explorerUrl = explorerTxUrl(settlement.transaction);
  } else {
    say("      LOCAL STUB: this hash was produced by the in-memory test signer, not by a blockchain.");
    say("      No receipt was fetched and no explorer link is produced.");
  }

  say("");
  say("[9/9] Explorer verification link");
  if (explorerUrl) {
    say(`      ${explorerUrl}`);
  } else {
    say("      N/A in local-stub mode (no on-chain transaction).");
  }
  say("");

  return {
    mode: options.mode,
    apiUrl: options.apiUrl,
    route: options.route,
    payer,
    initialStatus: initial.status,
    paymentRequired: required,
    accepted,
    paymentSignatureHeader: capturedSignature,
    paymentPayload,
    responseStatus: response.status,
    responseBody,
    settlement,
    ...(receipt ? { receipt } : {}),
    ...(explorerUrl ? { explorerUrl } : {}),
    transcript,
  };
}
