import { config as loadEnv } from "dotenv";
import { formatEther, parseAbi, type Address, type Hex } from "viem";
import { ConfigError, formatStartupError, loadFacilitatorConfig } from "../config.js";
import { consoleLogger, errorMessage } from "../logging.js";
import {
  CHAIN_ID,
  NETWORK,
  NETWORK_NAME,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_NAME,
  USDC_VERSION,
} from "../network.js";
import { createFacilitatorApp } from "./app.js";
import { assertOnChainMetadata } from "./onchain.js";
import { createFacilitatorSigner } from "./signer.js";

loadEnv();

const metadataAbi = parseAbi([
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function decimals() view returns (uint8)",
]);

interface OnChainClient {
  getChainId(): Promise<number>;
  getCode(args: { address: Address }): Promise<Hex | undefined>;
  getBalance(args: { address: Address }): Promise<bigint>;
  readContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
}

async function verifyDeployment(client: OnChainClient, signerAddress: Address): Promise<bigint> {
  const chainId = await client.getChainId();
  const code = await client.getCode({ address: USDC_ADDRESS });
  const name = await client.readContract({
    address: USDC_ADDRESS,
    abi: metadataAbi,
    functionName: "name",
  });
  const version = await client.readContract({
    address: USDC_ADDRESS,
    abi: metadataAbi,
    functionName: "version",
  });
  const decimals = await client.readContract({
    address: USDC_ADDRESS,
    abi: metadataAbi,
    functionName: "decimals",
  });

  assertOnChainMetadata({
    chainId,
    code,
    name: String(name),
    version: String(version),
    decimals: Number(decimals),
  });

  return await client.getBalance({ address: signerAddress });
}

async function main(): Promise<void> {
  let config;
  try {
    config = loadFacilitatorConfig();
  } catch (error) {
    console.error("Facilitator startup failed:");
    console.error(formatStartupError(error));
    process.exitCode = 1;
    return;
  }

  let handle;
  try {
    handle = createFacilitatorSigner(
      config.privateKey,
      config.rpcUrl,
      config.confirmationTimeoutMs,
    );
  } catch (error) {
    console.error("Facilitator startup failed:");
    console.error(`Could not create the facilitator signer: ${errorMessage(error)}`);
    process.exitCode = 1;
    return;
  }

  let balance: bigint;
  try {
    balance = await verifyDeployment(
      handle.client as unknown as OnChainClient,
      handle.address,
    );
  } catch (error) {
    console.error("Facilitator startup failed:");
    if (error instanceof ConfigError) {
      console.error(error.message);
    } else {
      console.error(
        `Could not verify Pharos Atlantic RPC and USDC metadata at ${config.rpcUrl}: ${errorMessage(error)}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  if (balance === 0n) {
    consoleLogger.warn("facilitator signer has no PHRS for gas; settlements will fail until funded", {
      signer: handle.address,
    });
  }

  const app = createFacilitatorApp({ signer: handle.signer });
  const server = app.listen(config.port, () => {
    consoleLogger.info("facilitator listening", {
      port: config.port,
      network: NETWORK,
      networkName: NETWORK_NAME,
      chainId: CHAIN_ID,
      asset: USDC_ADDRESS,
      assetName: USDC_NAME,
      assetVersion: USDC_VERSION,
      assetDecimals: USDC_DECIMALS,
      signer: handle.address,
      signerPhrsBalance: formatEther(balance),
      settlementMode: "on-chain eip3009 transferWithAuthorization",
    });
  });

  server.on("error", (error) => {
    consoleLogger.error("facilitator listener error", { message: errorMessage(error) });
    process.exitCode = 1;
  });

  const shutdown = (signal: string): void => {
    consoleLogger.info("shutting down facilitator", { signal });
    server.close((error) => {
      if (error) {
        consoleLogger.error("facilitator shutdown error", { message: errorMessage(error) });
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

void main();
