import { config as loadEnv } from "dotenv";
import {
  assertPaymentDemoReady,
  ConfigError,
  formatStartupError,
  loadResourceConfig,
} from "../config.js";
import { consoleLogger, errorMessage } from "../logging.js";
import { CHAIN_ID, NETWORK, NETWORK_NAME, USDC_ADDRESS, USDC_DECIMALS } from "../network.js";
import { createResourceApp } from "./app.js";
import { ROUTE_DEFINITIONS } from "./pricing.js";

loadEnv();

async function main(): Promise<void> {
  let config;
  try {
    config = loadResourceConfig();
    assertPaymentDemoReady(config);
  } catch (error) {
    console.error("Resource API startup failed:");
    console.error(formatStartupError(error));
    process.exitCode = 1;
    return;
  }

  let app;
  try {
    app = await createResourceApp(config);
  } catch (error) {
    console.error("Resource API startup failed:");
    if (error instanceof ConfigError) {
      console.error(error.message);
    } else {
      console.error(
        `Could not initialize the x402 middleware against the facilitator at ${config.facilitatorUrl}: ${errorMessage(error)}`,
      );
      console.error(
        "Start the facilitator first (npm run start:facilitator) or set FACILITATOR_URL to a reachable x402 facilitator that supports eip155:688689.",
      );
    }
    process.exitCode = 1;
    return;
  }

  const server = app.listen(config.port, () => {
    consoleLogger.info("resource API listening", {
      port: config.port,
      network: NETWORK,
      networkName: NETWORK_NAME,
      chainId: CHAIN_ID,
      asset: USDC_ADDRESS,
      assetDecimals: USDC_DECIMALS,
      payTo: config.payTo,
      facilitatorUrl: config.facilitatorUrl,
      paymentDemoEnabled: config.paymentDemoEnabled === true,
      paymentDemoApiUrl: config.paymentDemoApiUrl,
      prices: Object.fromEntries(
        Object.entries(ROUTE_DEFINITIONS).map(([path, definition]) => [
          path,
          `${definition.priceUsd} USDC (${definition.amount} atomic)`,
        ]),
      ),
    });
  });

  server.on("error", (error) => {
    consoleLogger.error("resource API listener error", { message: errorMessage(error) });
    process.exitCode = 1;
  });

  const shutdown = (signal: string): void => {
    consoleLogger.info("shutting down resource API", { signal });
    server.close((error) => {
      if (error) {
        consoleLogger.error("resource API shutdown error", { message: errorMessage(error) });
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

void main();
