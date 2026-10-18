import { defineChain, type Chain } from "viem";

/**
 * Network constants verified against the official Pharos documentation:
 * - Atlantic Testnet network page: https://docs.pharos.xyz/getting-started/network/atlantic-testnet
 * - Token Registry: https://docs.pharos.xyz/getting-started/token-registry
 *
 * Do not add a mainnet fallback here. The application deliberately refuses to start
 * against any other chain.
 */
export const NETWORK = "eip155:688689" as const;
export const CHAIN_ID = 688_689;
export const NETWORK_NAME = "Pharos Atlantic Testnet";
export const DEFAULT_RPC_URL = "https://atlantic.dplabs-internal.com";
export const EXPLORER_BASE_URL = "https://atlantic.pharosscan.xyz";

/**
 * Atlantic Testnet USDC from the official Pharos Token Registry.
 *
 * Verified on-chain (block height recorded in docs/verified-output.md):
 * - proxy at 0x02c3fe2d1700814ec27da9e447f7957329c96126
 * - name()    = "USDC"
 * - version() = "2"
 * - decimals() = 6
 * - EIP-3009 transferWithAuthorization / receiveWithAuthorization selectors present
 *
 * The x402 guide also mentions 0xE0BE08c77f415F577A1B3A9aD7a1Df1479564ec8 and
 * explicitly labels it "not an official address". That contract exposes no
 * EIP-3009 functions, so it cannot be used with the x402 `exact` scheme that
 * settles through transferWithAuthorization. See docs/verified-output.md.
 */
export const USDC_ADDRESS = "0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B" as const;
export const USDC_NAME = "USDC";
export const USDC_VERSION = "2";
export const USDC_SYMBOL = "USDC";
/** ERC-20 USDC decimals. This is intentionally separate from the 18-decimal native gas token. */
export const USDC_DECIMALS = 6;
export const NATIVE_GAS_DECIMALS = 18;

export const X402_VERSION = 2;
export const SCHEME = "exact" as const;

export const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";
export const PAYMENT_SIGNATURE_HEADER = "PAYMENT-SIGNATURE";
export const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";

export const SOURCES = {
  x402Overview: "https://docs.pharos.xyz/developer-guide/x402",
  x402Atlantic: "https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet",
  x402Skill: "https://github.com/PharosNetwork/examples/tree/main/skills/x402-pharos",
  atlanticNetwork: "https://docs.pharos.xyz/getting-started/network/atlantic-testnet",
  tokenRegistry: "https://docs.pharos.xyz/getting-started/token-registry",
} as const;

export const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

/**
 * viem chain definition for Pharos Atlantic Testnet.
 */
export function pharosAtlantic(rpcUrl: string = DEFAULT_RPC_URL): Chain {
  return defineChain({
    id: CHAIN_ID,
    name: NETWORK_NAME,
    nativeCurrency: {
      name: "PHRS",
      symbol: "PHRS",
      decimals: NATIVE_GAS_DECIMALS,
    },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
    blockExplorers: {
      default: { name: "PharosScan Atlantic", url: EXPLORER_BASE_URL },
    },
    testnet: true,
  });
}

export const PHAROS_ATLANTIC: Chain = pharosAtlantic();

/**
 * Build a PharosScan transaction URL from a verified 32-byte transaction hash.
 * Throws for anything that is not a transaction hash; never fabricates a link.
 */
export function explorerTxUrl(txHash: string): string {
  if (!TX_HASH_PATTERN.test(txHash)) {
    throw new Error("Cannot build an explorer link: value is not a 32-byte hex transaction hash.");
  }
  return `${EXPLORER_BASE_URL}/tx/${txHash}`;
}

/**
 * Build a PharosScan address URL.
 */
export function explorerAddressUrl(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Cannot build an explorer link: value is not a 20-byte hex address.");
  }
  return `${EXPLORER_BASE_URL}/address/${address}`;
}
