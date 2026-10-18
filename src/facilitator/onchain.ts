import type { Hex } from "viem";
import { ConfigError } from "../config.js";
import { CHAIN_ID, USDC_DECIMALS, USDC_NAME, USDC_VERSION } from "../network.js";

export interface OnChainTokenMetadata {
  chainId: number;
  code: Hex | undefined;
  name: string;
  version: string;
  decimals: number;
}

/**
 * Fail startup if the RPC, chain, or token metadata does not match the verified
 * Atlantic Testnet configuration. This prevents a mainnet key or a different
 * USDC deployment from silently being used.
 */
export function assertOnChainMetadata(metadata: OnChainTokenMetadata): void {
  const issues: string[] = [];

  if (metadata.chainId !== CHAIN_ID) {
    issues.push(`RPC chain ID is ${metadata.chainId}, expected ${CHAIN_ID} (Pharos Atlantic Testnet)`);
  }
  if (metadata.code === undefined || metadata.code === "0x") {
    issues.push(`No contract bytecode at the configured USDC address`);
  }
  if (metadata.name !== USDC_NAME) {
    issues.push(`USDC name() returned "${metadata.name}", expected "${USDC_NAME}"`);
  }
  if (metadata.version !== USDC_VERSION) {
    issues.push(`USDC version() returned "${metadata.version}", expected "${USDC_VERSION}"`);
  }
  if (metadata.decimals !== USDC_DECIMALS) {
    issues.push(`USDC decimals() returned ${metadata.decimals}, expected ${USDC_DECIMALS}`);
  }

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }
}
