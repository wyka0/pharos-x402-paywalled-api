import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runPaymentFlow, type PaymentFlowResult } from "../src/client/flow.js";
import { createFacilitatorApp } from "../src/facilitator/app.js";
import { silentLogger, startApp } from "../test/helpers/servers.js";
import { newAccount, newKeyAccount } from "../test/helpers/payment.js";
import { createStubSigner } from "../test/helpers/stub-signer.js";
import { CHAIN_ID, NETWORK, USDC_ADDRESS } from "../src/network.js";
import { createResourceApp } from "../src/resource/app.js";

/**
 * Fully local end-to-end demo: real @x402/express middleware, real facilitator
 * HTTP endpoints, real @x402/fetch client, and an in-memory facilitator signer.
 *
 * This script never broadcasts a transaction and must not be presented as
 * on-chain evidence. `npm run demo` is the live-testnet client.
 */
async function main(): Promise<void> {
  const facilitatorAccount = newAccount();
  const payer = newKeyAccount();
  const payTo = newAccount().address;
  const stub = createStubSigner({
    address: facilitatorAccount.address,
    token: USDC_ADDRESS,
  });

  const facilitatorApp = createFacilitatorApp({
    signer: stub.signer,
    logger: silentLogger,
  });
  const facilitator = await startApp(facilitatorApp);

  const resourceApp = await createResourceApp({
    payTo,
    facilitatorUrl: facilitator.url,
    port: 0,
    trustProxy: false,
    facilitatorTimeoutMs: 5_000,
    logger: silentLogger,
  });
  const resource = await startApp(resourceApp);

  const transcript: string[] = [];
  const results: PaymentFlowResult[] = [];

  try {
    for (const route of ["/data", "/api/info"] as const) {
      const result = await runPaymentFlow({
        apiUrl: resource.url,
        route,
        payerPrivateKey: payer.privateKey,
        rpcUrl: "https://atlantic.dplabs-internal.com",
        mode: "local-stub",
        log: (line) => {
          console.log(line);
          transcript.push(line);
        },
      });
      results.push(result);
    }

    const summary = {
      mode: "local-stub",
      onChain: false,
      warning:
        "No transaction was broadcast. The transaction hashes below come from an in-memory test signer and are NOT blockchain evidence.",
      executedAt: new Date().toISOString(),
      network: NETWORK,
      chainId: CHAIN_ID,
      payTo,
      facilitatorSigner: facilitatorAccount.address,
      routes: results.map((result) => ({
        route: result.route,
        payer: result.payer,
        priceAtomic: result.accepted.amount,
        priceAsset: result.accepted.asset,
        responseStatus: result.responseStatus,
        settlementSuccess: result.settlement.success,
        stubTransaction: result.settlement.transaction,
        onChain: false,
      })),
    };

    const evidenceDir = join(process.cwd(), "evidence");
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      join(evidenceDir, "local-demo.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(evidenceDir, "local-demo.txt"),
      [
        "Pharos x402 LOCAL STUB demo - NOT on-chain evidence",
        `Generated: ${summary.executedAt}`,
        "",
        ...transcript,
        "",
        "Summary",
        "-------",
        ...summary.routes.map(
          (route) =>
            `${route.route}: ${route.priceAtomic} atomic USDC, HTTP ${route.responseStatus}, stub tx ${route.stubTransaction}`,
        ),
        "",
      ].join("\n"),
      "utf8",
    );

    console.log("");
    console.log("Local demo complete. No blockchain transaction was broadcast.");
    console.log(`Evidence: ${join(evidenceDir, "local-demo.txt")}`);
    console.log(`Summary:  ${join(evidenceDir, "local-demo.json")}`);
  } finally {
    await resource.close();
    await facilitator.close();
  }
}

main().catch((error: unknown) => {
  console.error("Local demo failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
