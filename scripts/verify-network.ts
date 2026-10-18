import { createPublicClient, http, parseAbi, type Address } from "viem";
import {
  CHAIN_ID,
  DEFAULT_RPC_URL,
  NETWORK,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_NAME,
  USDC_VERSION,
  pharosAtlantic,
} from "../src/network.js";

const abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function version() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function implementation() view returns (address)",
]);

const selectors = {
  transferWithAuthorization: "e3ee160e",
  receiveWithAuthorization: "ef55bec6",
  authorizationState: "e94a0102",
  permit: "d505accf",
};

function hasSelector(bytecode: string, selector: string): boolean {
  return bytecode.toLowerCase().includes(selector.toLowerCase());
}

function sizeBytes(bytecode: string): number {
  return (bytecode.length - 2) / 2;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const client = createPublicClient({
    chain: pharosAtlantic(DEFAULT_RPC_URL),
    transport: http(DEFAULT_RPC_URL, { timeout: 30_000, retryCount: 2 }),
  });

  // Sequential reads with a small gap avoid the public RPC's per-second burst limit.
  const chainId = await client.getChainId();
  await sleep(300);
  const blockNumber = await client.getBlockNumber();
  await sleep(300);
  const proxyCode = await client.getCode({ address: USDC_ADDRESS });

  if (!proxyCode || proxyCode === "0x") {
    throw new Error(`No bytecode at ${USDC_ADDRESS}`);
  }

  const name = await client.readContract({ address: USDC_ADDRESS, abi, functionName: "name" });
  await sleep(300);
  const symbol = await client.readContract({ address: USDC_ADDRESS, abi, functionName: "symbol" });
  await sleep(300);
  const version = await client.readContract({ address: USDC_ADDRESS, abi, functionName: "version" });
  await sleep(300);
  const decimals = await client.readContract({ address: USDC_ADDRESS, abi, functionName: "decimals" });
  await sleep(300);
  const totalSupply = await client.readContract({
    address: USDC_ADDRESS,
    abi,
    functionName: "totalSupply",
  });
  await sleep(300);

  // The registry address is an upgradeable proxy. Resolve its implementation and
  // inspect the implementation bytecode for the EIP-3009 entry points.
  let implementation: Address | undefined;
  try {
    implementation = await client.readContract({
      address: USDC_ADDRESS,
      abi,
      functionName: "implementation",
    });
  } catch {
    implementation = undefined;
  }
  const implementationCode =
    implementation !== undefined ? await client.getCode({ address: implementation }) : undefined;
  const selectorSource = implementationCode ?? proxyCode;

  const result = {
    checkedAt: new Date().toISOString(),
    rpcUrl: DEFAULT_RPC_URL,
    network: NETWORK,
    expectedChainId: CHAIN_ID,
    observedChainId: chainId,
    chainMatches: chainId === CHAIN_ID,
    blockNumber: blockNumber.toString(),
    token: {
      address: USDC_ADDRESS,
      name,
      symbol,
      version,
      decimals,
      totalSupplyAtomic: totalSupply.toString(),
      registrySource: "https://docs.pharos.xyz/getting-started/token-registry",
      proxyCodeSizeBytes: sizeBytes(proxyCode),
      implementation: implementation ?? null,
      implementationCodeSizeBytes: implementationCode ? sizeBytes(implementationCode) : 0,
      expected: {
        name: USDC_NAME,
        version: USDC_VERSION,
        decimals: USDC_DECIMALS,
      },
    },
    eip3009Selectors: Object.fromEntries(
      Object.entries(selectors).map(([key, selector]) => [
        key,
        hasSelector(selectorSource, selector),
      ]),
    ),
    note: "Read-only RPC checks against the proxy and its implementation. No transaction was broadcast.",
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error("Network verification failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
