import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { NETWORK, USDC_ADDRESS } from "../network.js";

/** Hard per-payment cap for the non-default Atlantic USDC asset (0.10 USDC). */
export const MAX_PAYMENT_ATOMIC = "100000";

export interface PayingFetch {
  payer: `0x${string}`;
  client: x402Client;
  fetchWithPayment: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
}

/**
 * Build the official x402 fetch integration. Only the payer's local account is
 * used; the private key is never logged or placed in a header. The authorization
 * signature is created by ExactEvmScheme.signTypedData.
 */
export function createPayingFetch(
  privateKey: Hex,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): PayingFetch {
  const account = privateKeyToAccount(privateKey);
  const client = new x402Client();
  client.setSpendControls({
    allowedAssets: [
      {
        network: NETWORK,
        asset: USDC_ADDRESS,
        maxAmountPerPayment: MAX_PAYMENT_ATOMIC,
      },
    ],
  });
  client.register(NETWORK, new ExactEvmScheme(account));
  return {
    payer: account.address,
    client,
    fetchWithPayment: wrapFetchWithPayment(fetchImpl, client),
  };
}
