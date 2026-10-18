import { ExactEvmScheme } from "@x402/evm/exact/server";
import { describe, expect, it } from "vitest";
import { assertPositiveAtomic, formatAtomic, usdToAtomic } from "../src/amounts.js";
import { NETWORK, USDC_ADDRESS, USDC_DECIMALS, USDC_NAME, USDC_VERSION } from "../src/network.js";
import {
  ROUTE_DEFINITIONS,
  assertRoutePricing,
  registerUsdcMoneyParser,
} from "../src/resource/pricing.js";
import { routeDefinition } from "../src/routes.js";

describe("USDC amount conversion", () => {
  it("converts $0.01 to 10,000 atomic USDC units", () => {
    expect(usdToAtomic("0.01", USDC_DECIMALS)).toBe("10000");
    expect(usdToAtomic("$0.01", USDC_DECIMALS)).toBe("10000");
  });

  it("converts $0.005 to 5,000 atomic USDC units", () => {
    expect(usdToAtomic("0.005", USDC_DECIMALS)).toBe("5000");
    expect(usdToAtomic("$0.005", USDC_DECIMALS)).toBe("5000");
  });

  it("would be wrong with 18 native-token decimals, which is why the code is explicit", () => {
    expect(usdToAtomic("0.01", 18)).toBe("10000000000000000");
    expect(usdToAtomic("0.01", 18)).not.toBe(usdToAtomic("0.01", USDC_DECIMALS));
  });

  it("rejects negative, scientific, and over-precision amounts", () => {
    expect(() => usdToAtomic("-0.01", 6)).toThrow();
    expect(() => usdToAtomic("1e-7", 6)).toThrow();
    expect(() => usdToAtomic("0.0000001", 6)).toThrow(/more than 6 decimal places/);
  });

  it("formats atomic amounts for humans", () => {
    expect(formatAtomic("10000", 6)).toBe("0.01");
    expect(formatAtomic("5000", 6)).toBe("0.005");
    expect(formatAtomic("1", 6)).toBe("0.000001");
    expect(() => formatAtomic("1.5", 6)).toThrow(/Invalid atomic/);
  });

  it("rejects zero or non-integer route prices", () => {
    expect(() => assertPositiveAtomic("0")).toThrow(/positive/);
    expect(() => assertPositiveAtomic("abc")).toThrow(/positive/);
    expect(() => assertPositiveAtomic("10000")).not.toThrow();
  });
});

describe("route pricing", () => {
  it("defines exactly the two required prices", () => {
    expect(ROUTE_DEFINITIONS["/data"].amount).toBe("10000");
    expect(ROUTE_DEFINITIONS["/data"].priceUsd).toBe("0.01");
    expect(ROUTE_DEFINITIONS["/api/info"].amount).toBe("5000");
    expect(ROUTE_DEFINITIONS["/api/info"].priceUsd).toBe("0.005");
  });

  it("rejects unknown routes", () => {
    expect(() => routeDefinition("/nope")).toThrow(/Unknown paid route/);
  });

  it("uses the SDK money parser to produce USDC asset and domain", async () => {
    const scheme = registerUsdcMoneyParser(new ExactEvmScheme());
    const parsed = await scheme.parsePrice("$0.01", NETWORK);
    expect(parsed.amount).toBe("10000");
    expect(parsed.asset).toBe(USDC_ADDRESS);
    expect(parsed.extra).toMatchObject({ name: USDC_NAME, version: USDC_VERSION });
  });

  it("passes the startup pricing assertion for both routes", async () => {
    const scheme = registerUsdcMoneyParser(new ExactEvmScheme());
    await expect(assertRoutePricing(scheme)).resolves.toBeUndefined();
  });

  it("fails startup when the USDC parser is missing (no silent mainnet/default fallback)", async () => {
    const scheme = new ExactEvmScheme();
    await expect(assertRoutePricing(scheme)).rejects.toThrow();
  });
});
