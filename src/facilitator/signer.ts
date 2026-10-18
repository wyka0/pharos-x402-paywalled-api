import { toFacilitatorEvmSigner, type FacilitatorEvmSigner } from "@x402/evm";
import { createWalletClient, http, publicActions, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { pharosAtlantic } from "../network.js";

/**
 * Build the production facilitator signer from a testnet-only private key.
 * The key is only used in memory with viem; it is never logged here.
 */
export function createFacilitatorSigner(
  privateKey: Hex,
  rpcUrl: string,
  confirmationTimeoutMs: number,
): {
  signer: FacilitatorEvmSigner;
  address: Address;
  client: ReturnType<typeof buildClient>;
} {
  const account = privateKeyToAccount(privateKey);
  const client = buildClient(rpcUrl, account);
  const signer = toFacilitatorEvmSigner(
    {
      address: account.address,
      getCode: (args) => client.getCode(args),
      readContract: (args) =>
        client.readContract({
          ...args,
          args: args.args ?? [],
        } as unknown as Parameters<typeof client.readContract>[0]),
      verifyTypedData: (args) =>
        client.verifyTypedData(
          args as unknown as Parameters<typeof client.verifyTypedData>[0],
        ),
      writeContract: (args) =>
        client.writeContract({
          ...args,
          args: args.args ?? [],
        } as unknown as Parameters<typeof client.writeContract>[0]),
      sendTransaction: (args) =>
        client.sendTransaction(
          args as unknown as Parameters<typeof client.sendTransaction>[0],
        ),
      waitForTransactionReceipt: (args) =>
        client.waitForTransactionReceipt(
          args as unknown as Parameters<typeof client.waitForTransactionReceipt>[0],
        ),
    },
    { confirmationTimeoutMs },
  );

  return { signer, address: account.address, client };
}

function buildClient(rpcUrl: string, account: ReturnType<typeof privateKeyToAccount>) {
  return createWalletClient({
    account,
    chain: pharosAtlantic(rpcUrl),
    transport: http(rpcUrl, {
      timeout: 30_000,
      retryCount: 2,
    }),
  }).extend(publicActions);
}
