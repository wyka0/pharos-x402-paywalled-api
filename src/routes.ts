import { usdToAtomic } from "./amounts.js";
import { USDC_DECIMALS } from "./network.js";

export interface PaidRouteDefinition {
  readonly priceUsd: string;
  readonly amount: string;
  readonly description: string;
}

/**
 * Route pricing is defined once, in USD, and converted with USDC's 6 decimals.
 * `/data` costs $0.01 = 10,000 atomic units.
 * `/api/info` costs $0.005 = 5,000 atomic units.
 */
export const ROUTE_DEFINITIONS = {
  "/data": {
    priceUsd: "0.01",
    amount: usdToAtomic("0.01", USDC_DECIMALS),
    description: "Premium dataset endpoint ($0.01 test USDC per request)",
  },
  "/api/info": {
    priceUsd: "0.005",
    amount: usdToAtomic("0.005", USDC_DECIMALS),
    description: "Low-cost API information endpoint ($0.005 test USDC per request)",
  },
} as const satisfies Record<string, PaidRouteDefinition>;

export type PaidRoute = keyof typeof ROUTE_DEFINITIONS;

export function isPaidRoute(path: string): path is PaidRoute {
  return Object.prototype.hasOwnProperty.call(ROUTE_DEFINITIONS, path);
}

export function routeDefinition(path: string): PaidRouteDefinition {
  if (!isPaidRoute(path)) {
    throw new Error(`Unknown paid route: ${path}`);
  }
  return ROUTE_DEFINITIONS[path];
}
