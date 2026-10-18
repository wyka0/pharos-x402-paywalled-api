import type { RoutesConfig } from "@x402/core/server";
import type { ExactEvmScheme } from "@x402/evm/exact/server";
import { getAddress, type Address } from "viem";
import { numberToDecimalString } from "@x402/core/utils";
import { assertPositiveAtomic, usdToAtomic } from "../amounts.js";
import { NETWORK, USDC_ADDRESS, USDC_DECIMALS, USDC_NAME, USDC_VERSION } from "../network.js";
import { ROUTE_DEFINITIONS, routeDefinition } from "../routes.js";

export { ROUTE_DEFINITIONS, isPaidRoute, routeDefinition } from "../routes.js";
export type { PaidRoute, PaidRouteDefinition } from "../routes.js";

for (const definition of Object.values(ROUTE_DEFINITIONS)) {
  assertPositiveAtomic(definition.amount);
}

/**
 * Build the x402 route table consumed by the official @x402/express middleware.
 */
export function buildRoutes(payTo: Address): RoutesConfig {
  return {
    "GET /data": {
      accepts: {
        scheme: "exact",
        price: `$${ROUTE_DEFINITIONS["/data"].priceUsd}`,
        network: NETWORK,
        payTo,
        maxTimeoutSeconds: 120,
      },
      description: ROUTE_DEFINITIONS["/data"].description,
      mimeType: "application/json",
    },
    "GET /api/info": {
      accepts: {
        scheme: "exact",
        price: `$${ROUTE_DEFINITIONS["/api/info"].priceUsd}`,
        network: NETWORK,
        payTo,
        maxTimeoutSeconds: 120,
      },
      description: ROUTE_DEFINITIONS["/api/info"].description,
      mimeType: "application/json",
    },
  };
}

/**
 * Register a USDC-specific money parser. The fallback SDK parser is never used
 * for Pharos, because it does not know this testnet's token decimals/domain.
 */
export function registerUsdcMoneyParser(scheme: ExactEvmScheme): ExactEvmScheme {
  return scheme.registerMoneyParser(async (amount, network) => {
    if (network !== NETWORK) {
      return null;
    }
    const decimalAmount = typeof amount === "number" ? numberToDecimalString(amount) : amount;
    return {
      amount: usdToAtomic(decimalAmount, USDC_DECIMALS),
      asset: USDC_ADDRESS,
      extra: {
        name: USDC_NAME,
        version: USDC_VERSION,
      },
    };
  });
}

/**
 * Prove at startup that the SDK produces the exact amounts, asset, and EIP-712
 * domain we expect. A silent decimals or parser regression fails startup.
 */
export async function assertRoutePricing(scheme: ExactEvmScheme): Promise<void> {
  for (const [path, definition] of Object.entries(ROUTE_DEFINITIONS)) {
    const parsed = await scheme.parsePrice(`$${definition.priceUsd}`, NETWORK);
    if (getAddress(parsed.asset) !== getAddress(USDC_ADDRESS)) {
      throw new Error(`${path}: parsed asset ${parsed.asset} does not match ${USDC_ADDRESS}`);
    }
    if (parsed.amount !== definition.amount) {
      throw new Error(
        `${path}: parsed amount ${parsed.amount} does not match expected ${definition.amount} (${definition.priceUsd} USDC, ${USDC_DECIMALS} decimals)`,
      );
    }
    if (parsed.extra?.name !== USDC_NAME || parsed.extra?.version !== USDC_VERSION) {
      throw new Error(
        `${path}: parsed EIP-712 domain must be name=${USDC_NAME}, version=${USDC_VERSION}`,
      );
    }
  }
}

/**
 * Assert a route is known and return its definition. Used by the client demo.
 */
export function expectedRouteAmount(path: string): string {
  const definition = routeDefinition(path);
  return definition.amount;
}
