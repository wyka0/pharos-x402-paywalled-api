import { convertToTokenAmount, parseMoneyString } from "@x402/core/utils";
import { formatUnits } from "viem";

/**
 * Convert a USD decimal string (e.g. "0.01" or "$0.005") into an ERC-20 atomic
 * amount using the token's own decimals.
 *
 * USDC on Atlantic has 6 decimals. Native PHRS has 18; using 18 here would
 * overcharge by 10^12, so the decimals are always passed explicitly.
 */
export function usdToAtomic(price: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error(`Invalid token decimals: ${decimals}`);
  }
  const cleaned = parseMoneyString(price);
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Invalid USD amount: ${price}`);
  }
  const fractional = cleaned.split(".")[1] ?? "";
  if (fractional.length > decimals) {
    throw new Error(
      `USD amount ${price} has more than ${decimals} decimal places for this token`,
    );
  }
  const atomic = convertToTokenAmount(cleaned, decimals);
  if (!/^\d+$/.test(atomic)) {
    throw new Error(`Failed to convert USD amount ${price} to atomic units`);
  }
  return atomic;
}

/**
 * Format an atomic ERC-20 amount for display using the token's decimals.
 */
export function formatAtomic(amount: string, decimals: number): string {
  if (!/^\d+$/.test(amount)) {
    throw new Error(`Invalid atomic amount: ${amount}`);
  }
  return formatUnits(BigInt(amount), decimals);
}

/**
 * Reject zero or non-integer route prices at startup.
 */
export function assertPositiveAtomic(amount: string): void {
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
    throw new Error(`Route price must be a positive atomic integer, received: ${amount}`);
  }
}
