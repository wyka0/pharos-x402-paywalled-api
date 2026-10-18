import { randomUUID } from "node:crypto";
import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  paymentMiddlewareFromHTTPServer,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import express, { type NextFunction, type Request, type Response } from "express";
import type { ResourceConfig } from "../config.js";
import { errorMessage, type Logger, consoleLogger } from "../logging.js";
import {
  CHAIN_ID,
  EXPLORER_BASE_URL,
  NETWORK,
  NETWORK_NAME,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_NAME,
  USDC_SYMBOL,
  USDC_VERSION,
} from "../network.js";
import {
  assertRoutePricing,
  buildRoutes,
  registerUsdcMoneyParser,
  ROUTE_DEFINITIONS,
} from "./pricing.js";
import { createPaymentDemoRouter, type PaymentDemoDependencies } from "./demo-route.js";

export interface ResourceAppOptions extends ResourceConfig {
  logger?: Logger;
  paymentDemo?: PaymentDemoDependencies;
}

/**
 * Build the resource API. Construction performs three fail-fast checks:
 * 1. route prices convert to the expected USDC atomic amounts;
 * 2. the configured facilitator is reachable and advertises exact/eip155:688689;
 * 3. the middleware route table validates against the facilitator's /supported.
 */
export async function createResourceApp(options: ResourceAppOptions): Promise<express.Express> {
  const logger = options.logger ?? consoleLogger;

  const facilitatorClient = new HTTPFacilitatorClient({
    url: options.facilitatorUrl,
    timeoutMs: options.facilitatorTimeoutMs,
  });

  const evmScheme = new ExactEvmScheme();
  registerUsdcMoneyParser(evmScheme);
  await assertRoutePricing(evmScheme);

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    NETWORK,
    evmScheme,
  );
  const routes = buildRoutes(options.payTo);

  const httpServer = new x402HTTPResourceServer(resourceServer, routes);
  // This calls the facilitator /supported endpoint and throws if it does not
  // advertise the scheme/network used by these routes.
  await httpServer.initialize();

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", options.trustProxy);
  app.use(express.json({ limit: "64kb", strict: true }));

  // Additive, opt-in, server-side payment demo. Never behind payment middleware:
  // the demo itself drives the unpaid -> 402 -> paid sequence internally.
  app.use(
    "/demo",
    createPaymentDemoRouter(options, {
      ...options.paymentDemo,
      logger,
    }),
  );

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "pharos-x402-resource-api",
      network: NETWORK,
      networkName: NETWORK_NAME,
      chainId: CHAIN_ID,
      scheme: "exact",
      asset: {
        address: USDC_ADDRESS,
        symbol: USDC_SYMBOL,
        name: USDC_NAME,
        version: USDC_VERSION,
        decimals: USDC_DECIMALS,
      },
      payTo: options.payTo,
      facilitatorUrl: options.facilitatorUrl,
      explorer: EXPLORER_BASE_URL,
      prices: Object.fromEntries(
        Object.entries(ROUTE_DEFINITIONS).map(([path, definition]) => [
          path,
          {
            usd: definition.priceUsd,
            atomic: definition.amount,
            decimals: USDC_DECIMALS,
          },
        ]),
      ),
      timestamp: new Date().toISOString(),
    });
  });

  // The free health route is registered before the payment middleware.
  app.use(
    paymentMiddlewareFromHTTPServer(httpServer, undefined, undefined, false),
  );

  app.get("/data", (_req: Request, res: Response) => {
    res.status(200).json({
      requestId: randomUUID(),
      paid: true,
      network: NETWORK,
      chainId: CHAIN_ID,
      price: {
        usd: ROUTE_DEFINITIONS["/data"].priceUsd,
        amount: ROUTE_DEFINITIONS["/data"].amount,
        asset: USDC_ADDRESS,
        decimals: USDC_DECIMALS,
      },
      data: {
        dataset: "pharos-atlantic-sample",
        rows: [
          { id: 1, label: "alpha", value: 42 },
          { id: 2, label: "beta", value: 1337 },
          { id: 3, label: "gamma", value: 688689 },
        ],
        note: "This payload is only returned after x402 verification and settlement.",
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/info", (_req: Request, res: Response) => {
    res.status(200).json({
      requestId: randomUUID(),
      paid: true,
      network: NETWORK,
      chainId: CHAIN_ID,
      price: {
        usd: ROUTE_DEFINITIONS["/api/info"].priceUsd,
        amount: ROUTE_DEFINITIONS["/api/info"].amount,
        asset: USDC_ADDRESS,
        decimals: USDC_DECIMALS,
      },
      info: {
        name: "Pharos x402 Paywalled API",
        version: "1.0.0",
        scheme: "exact",
        network: NETWORK,
        chainId: CHAIN_ID,
        token: {
          address: USDC_ADDRESS,
          symbol: USDC_SYMBOL,
          name: USDC_NAME,
          version: USDC_VERSION,
          decimals: USDC_DECIMALS,
        },
        endpoints: Object.entries(ROUTE_DEFINITIONS).map(([path, definition]) => ({
          path,
          priceUsd: definition.priceUsd,
          amount: definition.amount,
          description: definition.description,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      (error as { type?: unknown }).type === "entity.parse.failed"
    ) {
      res.status(400).json({
        error: "invalid_json",
        message: "Request body must be valid JSON.",
      });
      return;
    }
    logger.error("unhandled resource API error", { message: errorMessage(error) });
    res.status(500).json({
      error: "internal_error",
      message: "Unexpected resource API error.",
    });
  });

  app.locals.httpServer = httpServer;
  app.locals.resourceServer = resourceServer;
  return app;
}
