import {
  createPublicClient,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
} from "viem";
import {
  DEFAULT_RPC_URL,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_SYMBOL,
  explorerAddressUrl,
} from "../src/network.js";

const erc20Abi = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read-only balance check for a PUBLIC wallet address.
 *
 * It accepts only an address, never a private key, and prints only public data
 * (balances and an explorer link). Use it to confirm funding before any live
 * run: the payer needs test USDC, the facilitator signer needs PHRS for gas.
 */
async function main(): Promise<void> {
  const [input] = process.argv.slice(2);
  if (!input) {
    console.error("Usage: npm run balances -- <public-address>");
    console.error("Never pass a private key; only an address is accepted.");
    process.exitCode = 1;
    return;
  }
  if (!isAddress(input)) {
    console.error("Not a valid 20-byte hex address. Nothing was checked; no key is ever needed.");
    process.exitCode = 1;
    return;
  }

  const address = getAddress(input);
  const client = createPublicClient({
    transport: http(DEFAULT_RPC_URL, { timeout: 30_000, retryCount: 2 }),
  });

  // Two sequential reads stay well under the public RPC's burst limit.
  const phrs = await client.getBalance({ address });
  await sleep(300);
  const usdc = await client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  console.log(`Address:       ${address}`);
  console.log(`PHRS (native): ${formatEther(phrs)}  (facilitator signer needs this for gas)`);
  console.log(
    `${USDC_SYMBOL} (test): ${formatUnits(usdc, USDC_DECIMALS)}  (payer needs at least 0.01)`,
  );
  console.log(`Explorer:      ${explorerAddressUrl(address)}`);
}

main().catch((error: unknown) => {
  console.error("Balance check failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
