import type { Express } from "express";
import type { Server } from "node:http";
import { createFacilitatorApp } from "../../src/facilitator/app.js";
import type { Logger } from "../../src/logging.js";
import { createResourceApp } from "../../src/resource/app.js";
import { USDC_ADDRESS } from "../../src/network.js";
import { createStubSigner, type StubSigner } from "./stub-signer.js";
import { newAccount, newKeyAccount, type TestAccount } from "./payment.js";

export interface RunningServer {
  url: string;
  server: Server;
  close(): Promise<void>;
}

export const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export async function startApp(app: Express): Promise<RunningServer> {
  return await new Promise<RunningServer>((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        reject(new Error("Test server did not expose a TCP address"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        server,
        close: async () =>
          await new Promise<void>((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error) rejectClose(error);
              else resolveClose();
            });
          }),
      });
    });
    server.on("error", reject);
  });
}

export interface TestStack {
  facilitator: RunningServer;
  resource: RunningServer;
  stub: StubSigner;
  payer: TestAccount;
  payerKey: `0x${string}`;
  payTo: `0x${string}`;
  close(): Promise<void>;
}

/**
 * Wire the real facilitator HTTP app and the real resource HTTP app together,
 * using only an in-memory facilitator signer for settlement. No chain calls and
 * no broadcasts occur.
 */
export async function createTestStack(): Promise<TestStack> {
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
    // Existing integration tests exercise the x402 protocol, not abuse
    // controls; dedicated rate-limit tests enable the limiter explicitly.
    rateLimit: { enabled: false },
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

  return {
    facilitator,
    resource,
    stub,
    payer: payer.account,
    payerKey: payer.privateKey,
    payTo,
    close: async () => {
      await resource.close();
      await facilitator.close();
    },
  };
}
