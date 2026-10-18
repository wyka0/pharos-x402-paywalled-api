import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertLivePaymentApproved,
  formatStartupError,
  loadPayerConfig,
  type PayerConfig,
} from "../config.js";
import { runPaymentFlow, type PaymentFlowResult } from "./flow.js";
import { errorMessage } from "../logging.js";
import { CHAIN_ID, NETWORK } from "../network.js";

function redactedAuthorization(result: PaymentFlowResult): Record<string, unknown> {
  const payload = result.paymentPayload.payload;
  return typeof payload.authorization === "object" && payload.authorization !== null
    ? { ...(payload.authorization as Record<string, unknown>) }
    : {};
}

function redactedSignature(result: PaymentFlowResult): string {
  const signature = result.paymentPayload.payload.signature;
  return typeof signature === "string" && signature.length > 2
    ? `<redacted ${(signature.length - 2) / 2}-byte EIP-712 signature>`
    : "<missing>";
}

/**
 * Persist a live run as reviewer evidence. Only public chain data, the decoded
 * authorization (with the signature redacted), and the transcript are written.
 * No environment variables, private keys, or full payment credentials.
 */
function writeEvidence(result: PaymentFlowResult, transcript: string[]): {
  jsonPath: string;
  textPath: string;
} {
  if (result.mode !== "live" || !result.receipt || !result.explorerUrl) {
    throw new Error("Refusing to write live evidence without a live receipt and explorer URL");
  }

  const evidenceDir = join(process.cwd(), "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = result.settlement.transaction.slice(2, 10);
  const base = `live-${stamp}-${suffix}`;
  const jsonPath = join(evidenceDir, `${base}.json`);
  const textPath = join(evidenceDir, `${base}.txt`);

  const evidence = {
    mode: "live-testnet",
    executedAt: new Date().toISOString(),
    network: NETWORK,
    chainId: CHAIN_ID,
    apiUrl: result.apiUrl,
    route: result.route,
    payer: result.payer,
    price: {
      amountAtomic: result.accepted.amount,
      asset: result.accepted.asset,
      payTo: result.accepted.payTo,
      extra: result.accepted.extra,
    },
    paymentRequired: result.paymentRequired,
    authorization: redactedAuthorization(result),
    signature: redactedSignature(result),
    paymentSignatureHeader: {
      length: result.paymentSignatureHeader.length,
      prefix: result.paymentSignatureHeader.slice(0, 24),
    },
    responseStatus: result.responseStatus,
    responseBody: result.responseBody,
    settlement: result.settlement,
    receipt: result.receipt,
    explorerUrl: result.explorerUrl,
    onChain: true,
    note: "Signature material is redacted. Private keys are never written to disk.",
  };

  writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  const header = [
    "Pharos x402 live payment evidence",
    `Executed: ${evidence.executedAt}`,
    `Network: ${NETWORK} (chain ID ${CHAIN_ID})`,
    `Transaction: ${result.settlement.transaction}`,
    `Explorer: ${result.explorerUrl}`,
    `Payer: ${result.payer}`,
    "",
    "Transcript",
    "----------",
    "",
  ].join("\n");
  writeFileSync(textPath, `${header}${transcript.join("\n")}\n`, "utf8");
  return { jsonPath, textPath };
}

async function main(): Promise<void> {
  let config: PayerConfig;
  try {
    config = loadPayerConfig();
  } catch (error) {
    console.error("Payment demo configuration error:");
    console.error(formatStartupError(error));
    process.exitCode = 1;
    return;
  }

  try {
    assertLivePaymentApproved(config);
  } catch (error) {
    console.error(formatStartupError(error));
    console.error("");
    console.error("Nothing was signed. Nothing was broadcast.");
    console.error(
      "To approve a testnet payment, set LIVE_PAYMENT_APPROVED=YES in your ignored .env and run the demo again.",
    );
    process.exitCode = 2;
    return;
  }

  console.log("LIVE MODE: this run will sign and broadcast a real Atlantic Testnet payment.");
  console.log("The payer key is loaded locally and is never printed.");
  console.log("");

  try {
    const result = await runPaymentFlow({
      apiUrl: config.apiUrl,
      route: config.route,
      payerPrivateKey: config.privateKey,
      rpcUrl: config.rpcUrl,
      mode: "live",
    });
    const paths = writeEvidence(result, result.transcript);
    console.log("");
    console.log(`Evidence JSON: ${paths.jsonPath}`);
    console.log(`Evidence text: ${paths.textPath}`);
  } catch (error) {
    console.error("");
    console.error("Live payment demo failed:");
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}

void main();
