import { describe, expect, it } from "vitest";
import {
  CHAIN_ID,
  NETWORK,
  NATIVE_GAS_DECIMALS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_NAME,
  USDC_VERSION,
  explorerAddressUrl,
  explorerTxUrl,
  pharosAtlantic,
} from "../src/network.js";

const TX = `0x${"ab".repeat(32)}`;

describe("verified Pharos Atlantic network constants", () => {
  it("uses the required CAIP-2 identifier and chain ID", () => {
    expect(NETWORK).toBe("eip155:688689");
    expect(CHAIN_ID).toBe(688689);
  });

  it("uses the official Token Registry test USDC and 6 ERC-20 decimals", () => {
    expect(USDC_ADDRESS).toBe("0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B");
    expect(USDC_DECIMALS).toBe(6);
    expect(USDC_NAME).toBe("USDC");
    expect(USDC_VERSION).toBe("2");
  });

  it("keeps native gas decimals separate from ERC-20 decimals", () => {
    expect(NATIVE_GAS_DECIMALS).toBe(18);
    expect(USDC_DECIMALS).not.toBe(NATIVE_GAS_DECIMALS);
  });

  it("defines the Atlantic chain without a mainnet fallback", () => {
    const chain = pharosAtlantic();
    expect(chain.id).toBe(688689);
    expect(chain.testnet).toBe(true);
    expect(chain.nativeCurrency.decimals).toBe(18);
    expect(chain.rpcUrls.default.http[0]).toBe("https://atlantic.dplabs-internal.com");
  });

  it("builds explorer transaction links only from a real 32-byte hash", () => {
    expect(explorerTxUrl(TX)).toBe(`https://atlantic.pharosscan.xyz/tx/${TX}`);
    expect(() => explorerTxUrl("0x1234")).toThrow(/32-byte/);
    expect(() => explorerTxUrl("https://example.com/tx/1")).toThrow(/32-byte/);
    expect(() => explorerTxUrl("")).toThrow(/32-byte/);
  });

  it("builds explorer address links only from a 20-byte address", () => {
    expect(explorerAddressUrl(USDC_ADDRESS)).toBe(
      `https://atlantic.pharosscan.xyz/address/${USDC_ADDRESS}`,
    );
    expect(() => explorerAddressUrl("0x1234")).toThrow(/20-byte/);
  });
});
