export function formatUsd(price: string | null): string {
  if (price === null) return "FREE";
  return `$${price}`;
}

export function formatAtomicUsdc(amountAtomic: string | null | undefined): string {
  if (!amountAtomic || !/^\d+$/.test(amountAtomic)) return "—";
  const value = BigInt(amountAtomic);
  const whole = value / 1_000_000n;
  const fraction = value % 1_000_000n;
  const fractionText = fraction
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "")
    .padEnd(2, "0");
  return `${whole.toString()}.${fractionText}`;
}

export function shortAddress(value: string | null | undefined, size = 6): string {
  if (!value) return "—";
  if (value.length <= size * 2 + 2) return value;
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`;
}

export function shortHash(value: string | null | undefined): string {
  return shortAddress(value, 8);
}

export function isTxHash(value: string | null | undefined): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function explorerTxUrl(txHash: string): string {
  if (!isTxHash(txHash)) {
    throw new Error("Cannot build an explorer link without a 32-byte transaction hash");
  }
  return `https://atlantic.pharosscan.xyz/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Cannot build an explorer link without a 20-byte address");
  }
  return `https://atlantic.pharosscan.xyz/address/${address}`;
}
