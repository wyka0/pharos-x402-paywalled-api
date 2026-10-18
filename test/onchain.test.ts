import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/config.js";
import { assertOnChainMetadata } from "../src/facilitator/onchain.js";

const valid = {
  chainId: 688689,
  code: "0x60016000" as const,
  name: "USDC",
  version: "2",
  decimals: 6,
};

describe("on-chain startup validation", () => {
  it("accepts the verified Atlantic USDC metadata", () => {
    expect(() => assertOnChainMetadata(valid)).not.toThrow();
  });

  it("rejects a mainnet RPC", () => {
    try {
      assertOnChainMetadata({ ...valid, chainId: 1672 });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).issues.join()).toContain("1672");
    }
  });

  it("rejects an address with no contract code", () => {
    expect(() => assertOnChainMetadata({ ...valid, code: "0x" })).toThrow(/No contract bytecode/);
    expect(() => assertOnChainMetadata({ ...valid, code: undefined })).toThrow(
      /No contract bytecode/,
    );
  });

  it("rejects wrong name, version, or decimals", () => {
    expect(() => assertOnChainMetadata({ ...valid, name: "USD Coin" })).toThrow(/name\(\)/);
    expect(() => assertOnChainMetadata({ ...valid, version: "1" })).toThrow(/version\(\)/);
    expect(() => assertOnChainMetadata({ ...valid, decimals: 18 })).toThrow(/decimals\(\)/);
  });

  it("reports every mismatch at once", () => {
    try {
      assertOnChainMetadata({
        chainId: 1,
        code: "0x",
        name: "DAI",
        version: "1",
        decimals: 18,
      });
      throw new Error("expected failure");
    } catch (error) {
      const issues = (error as ConfigError).issues;
      expect(issues).toHaveLength(5);
    }
  });
});
